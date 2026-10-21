import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader, Search, User, Check, CloseSquare } from 'reicon-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { PhoneInput, DocumentIdInput } from '@/components/ui/ve-inputs';
import { supabase } from '@/integrations/supabase/client';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { createCustomerAccount, isValidEmail } from '@/lib/customerAccounts';
import { PAYMENT_METHOD_LABELS } from '@/lib/paymentMethodFields';
import { normalizeVePhone } from '@/components/sales/NewSaleDialog';
import { cn } from '@/lib/utils';
import type { Sale } from '@/types';

interface EditSaleDialogProps {
  /** Líneas de la venta (mismo sale_group_id). null = cerrado. */
  items: Sale[] | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

type ClientForm = { name: string; dni: string; phone: string; email: string; address: string };
type LineForm = { id: string; name: string; qty: number; unit: string; originalUnit: number; productId: string | null };
type AccountMatch = { userId: string; name: string; dni: string; phone: string; email: string; address: string };

const isValidVePhone = (p: string) => !p || /^\+58(?:412|414|422|424|416|426|2\d{2})\d{7}$/.test(p);
const round2 = (n: number) => Math.round(n * 100) / 100;
/** YYYY-MM-DD en hora de Venezuela */
const veDay = (iso: string) => new Date(new Date(iso).getTime() - 4 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * Editar una venta ya registrada: cliente (y vincularlo a su cuenta o crearle una), fecha,
 * método de pago, nombre y precio de cada línea y la nota. Las cantidades no se cambian aquí
 * porque mueven inventario: para eso está «Devolver».
 */
export function EditSaleDialog({ items, onOpenChange, onSaved }: EditSaleDialogProps) {
  const queryClient = useQueryClient();
  const { methods } = usePaymentMethods(false);
  const methodOptions = methods.length ? methods : Object.entries(PAYMENT_METHOD_LABELS).map(([method_key, label]) => ({ method_key, label }));

  const first = items?.[0] ?? null;
  const [client, setClient] = useState<ClientForm>({ name: '', dni: '', phone: '', email: '', address: '' });
  const [userId, setUserId] = useState<string | null>(null);
  const [createAccount, setCreateAccount] = useState(false);
  const [day, setDay] = useState('');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineForm[]>([]);
  const [saving, setSaving] = useState(false);
  // Buscar una cuenta existente para vincular la venta
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<AccountMatch[]>([]);
  const [linkSearching, setLinkSearching] = useState(false);
  const linkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!items?.length) return;
    const s = items[0];
    setClient({ name: s.client_name ?? '', dni: s.client_dni ?? '', phone: s.client_phone ?? '', email: s.client_email ?? '', address: s.client_address ?? '' });
    setUserId(s.customer_user_id ?? null);
    setCreateAccount(false);
    setDay(veDay(s.created_at));
    setMethod(s.payment_method ?? '');
    setNotes(s.notes ?? '');
    setLines(items.map(i => ({
      id: i.id,
      name: i.product_name,
      qty: Number(i.quantity),
      unit: Number(i.unit_price_usd).toFixed(2),
      originalUnit: Number(i.unit_price_usd),
      productId: i.product_id ?? null,
    })));
    setLinkQuery('');
    setLinkResults([]);
  }, [items]);

  useEffect(() => {
    const safe = linkQuery.trim().replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (linkTimer.current) clearTimeout(linkTimer.current);
    if (safe.length < 2) { setLinkResults([]); setLinkSearching(false); return; }
    setLinkSearching(true);
    linkTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('customer_profiles')
        .select('user_id, full_name, dni, phone, email, address')
        .or(`full_name.ilike.%${safe}%,dni.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`)
        .limit(8);
      setLinkResults((data || []).map(r => ({ userId: r.user_id, name: r.full_name || '', dni: r.dni || '', phone: r.phone || '', email: r.email || '', address: r.address || '' })));
      setLinkSearching(false);
    }, 300);
    return () => { if (linkTimer.current) clearTimeout(linkTimer.current); };
  }, [linkQuery]);

  const phone = normalizeVePhone(client.phone);
  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.unit.replace(',', '.')) || 0) * l.qty, 0), [lines]);
  const originalTotal = useMemo(() => (items ?? []).reduce((s, i) => s + Number(i.total_usd), 0), [items]);
  const isCredit = !!first?.is_credit;

  const missing = (() => {
    if (lines.some(l => !l.name.trim())) return 'Cada línea necesita un nombre';
    if (lines.some(l => !((Number(l.unit.replace(',', '.')) || 0) > 0))) return 'Revisa los precios';
    if (isCredit && !client.name.trim()) return 'Una venta por cobrar necesita el nombre del cliente';
    if (!isValidVePhone(phone)) return 'Completa el teléfono (7 dígitos después del prefijo)';
    if (client.email && !isValidEmail(client.email)) return 'Revisa el correo';
    if (createAccount && !isValidEmail(client.email)) return 'Para crearle la cuenta escribe su correo';
    if (!day) return 'Elige la fecha';
    return '';
  })();

  const pickAccount = (m: AccountMatch) => {
    setUserId(m.userId);
    setClient({ name: m.name, dni: m.dni, phone: m.phone, email: m.email, address: m.address });
    setCreateAccount(false);
    setLinkQuery('');
    setLinkResults([]);
  };

  const save = async () => {
    if (!items?.length || missing || saving) return;
    setSaving(true);
    try {
      const { sanitizeText } = await import('@/lib/validations');
      // 1. Cuenta nueva (si se pidió): así la venta y lo que debe quedan en su ficha de Clientes
      let customerUserId = userId;
      if (!customerUserId && createAccount) {
        const account = await createCustomerAccount({
          email: client.email.trim().toLowerCase(),
          full_name: sanitizeText(client.name.trim()),
          phone: phone || null,
          dni: client.dni.trim() || null,
          address: client.address.trim() ? sanitizeText(client.address.trim()) : null,
        });
        customerUserId = account.userId;
      }

      const cleanNotes = notes.trim() ? sanitizeText(notes.trim()).slice(0, 1000) : null;
      const s0 = items[0];
      // Nueva fecha, misma hora: se corre la venta los días de diferencia
      const shiftDays = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${veDay(s0.created_at)}T12:00:00Z`)) / 86400000);
      const createdAt = shiftDays ? new Date(new Date(s0.created_at).getTime() + shiftDays * 86400000).toISOString() : null;

      for (const line of lines) {
        const sale = items.find(i => i.id === line.id)!;
        const unit = round2(Number(line.unit.replace(',', '.')) || 0);
        // 2. Precio: el total de la línea se cambia con la función de la base, que recalcula
        //    lo abonado y el saldo de toda la venta
        if (Math.abs(unit - line.originalUnit) > 0.004) {
          const newTotal = round2(unit * line.qty);
          const { error } = await supabase.rpc('edit_sale_total', { p_sale_id: sale.id, p_new_total_usd: newTotal, p_notes: cleanNotes ?? '' });
          if (error) throw error;
          const oldTotal = Number(sale.total_usd) || 0;
          const totalBs = sale.total_bs && oldTotal > 0 ? round2(Number(sale.total_bs) * newTotal / oldTotal) : sale.total_bs;
          const { error: e2 } = await supabase.from('sales').update({ unit_price_usd: unit, total_bs: totalBs }).eq('id', sale.id);
          if (e2) throw e2;
        }
        // 3. Cliente, método, nota, nombre de la línea y fecha
        const { error } = await supabase.from('sales').update({
          product_name: sanitizeText(line.name.trim()).slice(0, 200),
          client_name: client.name.trim() ? sanitizeText(client.name.trim()) : null,
          client_dni: client.dni.trim() || null,
          client_phone: phone || null,
          client_email: client.email.trim().toLowerCase() || null,
          client_address: client.address.trim() ? sanitizeText(client.address.trim()) : null,
          customer_user_id: customerUserId,
          payment_method: method || sale.payment_method,
          notes: cleanNotes,
          ...(createdAt ? { created_at: createdAt } : {}),
        }).eq('id', sale.id);
        if (error) throw error;
      }

      // 4. El pago registrado al vender lleva el mismo método (cuadra los ingresos por método).
      //    En una venta a crédito solo el pago inicial; los abonos posteriores conservan el suyo.
      if (method && method !== s0.payment_method) {
        const ids = items.map(i => i.id);
        let q = supabase.from('sale_payments').update({ payment_method: method }).in('sale_id', ids);
        if (isCredit) q = q.eq('notes', 'Pago inicial (POS)');
        const { error } = await q;
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Venta actualizada', { description: createAccount && !userId ? `Se creó la cuenta de ${client.name} con ${client.email}.` : undefined });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error('No se pudo guardar', { description: err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!items} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar venta</DialogTitle>
          <DialogDescription>Corrige cualquier dato de la venta. Para cambiar cantidades usa «Devolver».</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Cliente */}
          <section className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><User className="h-4 w-4 text-primary" /> Cliente</p>
            {userId ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-success/10 px-3 py-2 text-xs text-success">
                <span>Vinculada a su cuenta: aparece en su ficha de Clientes.</span>
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-success/15" aria-label="Quitar vínculo con la cuenta" onClick={() => setUserId(null)}>
                  <CloseSquare className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={linkQuery} onChange={e => setLinkQuery(e.target.value.slice(0, 60))} placeholder="Buscar un cliente con cuenta para vincularlo" className="h-11 rounded-full pl-10" />
                  {linkSearching && <Loader className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
                {linkResults.length > 0 && (
                  <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-2xl border border-border bg-card">
                    {linkResults.map(m => (
                      <li key={m.userId}>
                        <button type="button" onClick={() => pickAccount(m)} className="w-full px-3 py-2.5 text-left hover:bg-primary/5">
                          <p className="text-sm font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{[m.dni, m.phone, m.email].filter(Boolean).join(' · ')}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="es-name">Nombre</Label>
                <Input id="es-name" value={client.name} onChange={e => setClient(c => ({ ...c, name: e.target.value.slice(0, 60) }))} placeholder="Sin datos (venta de mostrador)" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="es-dni">Cédula / RIF</Label>
                <DocumentIdInput id="es-dni" value={client.dni} onChange={dni => setClient(c => ({ ...c, dni }))} inputClassName="h-11 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="es-phone">Teléfono</Label>
                <PhoneInput id="es-phone" value={client.phone} onChange={v => setClient(c => ({ ...c, phone: v }))} inputClassName={cn('h-11 rounded-xl', client.phone && !isValidVePhone(phone) && 'border-sale')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="es-email">Correo</Label>
                <Input id="es-email" type="email" inputMode="email" autoComplete="off" value={client.email} onChange={e => setClient(c => ({ ...c, email: e.target.value.replace(/\s/g, '').slice(0, 100) }))} className={cn('h-11 rounded-xl', client.email && !isValidEmail(client.email) && 'border-sale')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="es-address">Dirección</Label>
                <Input id="es-address" value={client.address} onChange={e => setClient(c => ({ ...c, address: e.target.value.slice(0, 150) }))} className="h-11 rounded-xl" />
              </div>
            </div>
            {!userId && client.name.trim() && (
              <label className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                <Checkbox checked={createAccount} onCheckedChange={v => setCreateAccount(v === true)} className="mt-0.5" />
                <span>
                  Guardarlo en Clientes con una cuenta
                  <span className="block text-xs text-muted-foreground">Se le crea con su correo; entra con «Olvidé mi contraseña» en la tienda.</span>
                </span>
              </label>
            )}
          </section>

          {/* Fecha y método */}
          <section className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="es-day">Fecha</Label>
              <Input id="es-day" type="date" value={day} max={veDay(new Date().toISOString())} onChange={e => setDay(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="es-method">{isCredit ? 'Método (del pago inicial)' : 'Método de pago'}</Label>
              <select id="es-method" value={method} onChange={e => setMethod(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                {!methodOptions.some(m => m.method_key === method) && method && <option value={method}>{PAYMENT_METHOD_LABELS[method] ?? method}</option>}
                {methodOptions.map(m => <option key={m.method_key} value={m.method_key}>{m.label}</option>)}
              </select>
            </div>
          </section>

          {/* Líneas */}
          <section className="space-y-2">
            <p className="text-sm font-semibold">Productos y precios</p>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {lines.map(l => (
                <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 p-3">
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor={`es-n-${l.id}`} className="text-xs text-muted-foreground">{l.productId ? 'Producto' : 'Descripción'} · {l.qty} {l.qty === 1 ? 'unidad' : 'unidades'}</Label>
                    <Input id={`es-n-${l.id}`} value={l.name} onChange={e => setLines(ls => ls.map(x => x.id === l.id ? { ...x, name: e.target.value.slice(0, 200) } : x))} className="h-10 rounded-xl" />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label htmlFor={`es-p-${l.id}`} className="text-xs text-muted-foreground">Precio c/u ($)</Label>
                    <Input id={`es-p-${l.id}`} inputMode="decimal" value={l.unit} onChange={e => setLines(ls => ls.map(x => x.id === l.id ? { ...x, unit: e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10) } : x))} className="h-10 rounded-xl text-right tabular-nums" />
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-right text-sm">
              Total <strong className="tabular-nums">${total.toFixed(2)}</strong>
              {Math.abs(total - originalTotal) > 0.004 && <span className="ml-2 text-xs text-muted-foreground">(antes ${originalTotal.toFixed(2)}; el saldo se recalcula)</span>}
            </p>
          </section>

          <section className="space-y-1">
            <Label htmlFor="es-notes">Nota</Label>
            <Textarea id="es-notes" value={notes} onChange={e => setNotes(e.target.value.slice(0, 500))} rows={2} className="resize-none rounded-xl" />
          </section>
        </div>

        <DialogFooter className="gap-2 sm:items-center">
          {missing && <p className="text-xs text-muted-foreground sm:mr-auto">{missing}</p>}
          <Button variant="outline" className="h-11 rounded-full" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button className="h-11 gap-2 rounded-full" onClick={save} disabled={!!missing || saving}>
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
