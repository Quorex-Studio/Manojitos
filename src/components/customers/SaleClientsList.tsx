import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader, MessageSquare, UserAdd, Link as LinkIcon } from 'reicon-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { initials, whatsappLink } from '@/components/customers/customerUi';
import { supabase } from '@/integrations/supabase/client';
import { createCustomerAccount, isValidEmail } from '@/lib/customerAccounts';
import { phoneKey, type SaleClient } from '@/hooks/useSaleClients';
import type { CustomerProfile } from '@/hooks/useCustomers';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog';

const digits = (s?: string | null) => (s || '').replace(/\D/g, '');

/** Cuenta existente que coincide con el cliente de las ventas (teléfono, cédula o correo). */
export function matchAccount(c: SaleClient, profiles: CustomerProfile[]): CustomerProfile | null {
  return profiles.find(p =>
    (phoneKey(c.phone).length === 10 && phoneKey(p.phone) === phoneKey(c.phone)) ||
    (digits(c.dni).length >= 6 && digits(p.dni) === digits(c.dni)) ||
    (!!c.email && !!p.email && p.email.toLowerCase() === c.email.toLowerCase())
  ) ?? null;
}

/** Vincula las ventas de un cliente sin cuenta a una cuenta (en tandas, por si son muchas). */
async function linkSales(saleIds: string[], userId: string) {
  for (let i = 0; i < saleIds.length; i += 150) {
    const { error } = await supabase.from('sales').update({ customer_user_id: userId }).in('id', saleIds.slice(i, i + 150));
    if (error) throw error;
  }
}

/**
 * Clientes que compraron (contado, fiado o a crédito) pero aún no tienen cuenta. Se pueden
 * vincular a una cuenta existente o guardar con una cuenta nueva (con su correo).
 */
export function SaleClientsList({ clients, profiles, search }: { clients: SaleClient[]; profiles: CustomerProfile[]; search: string }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  // Sin cédula ni teléfono, las ventas se juntaron solo por el nombre: confirmar antes de vincularlas
  const checkNameOnly = async (c: SaleClient) => !c.nameOnly || await confirm({
    title: `¿Todas son de ${c.name}?`,
    description: `Estas ${c.purchases} compras se juntaron solo por el nombre (no tienen cédula ni teléfono). Si hay dos personas con ese nombre, corrige primero la venta que no es suya desde «Editar venta».`,
    confirmText: 'Sí, son suyas',
  });
  const [saving, setSaving] = useState<SaleClient | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const d = digits(search);
    return clients
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (!!d && (digits(c.phone).includes(d) || digits(c.dni).includes(d))))
      .sort((a, b) => b.balanceUsd - a.balanceUsd || +new Date(b.lastAt) - +new Date(a.lastAt));
  }, [clients, search]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['sale-clients'] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
  };

  const link = async (c: SaleClient, account: CustomerProfile) => {
    if (!(await checkNameOnly(c))) return;
    setBusy(c.key);
    try {
      await linkSales(c.saleIds, account.user_id);
      toast.success('Ventas vinculadas', { description: `Ahora están en la ficha de ${account.full_name}.` });
      refresh();
    } catch (e) {
      toast.error('No se pudo vincular', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!saving || !isValidEmail(email)) return;
    setBusy(saving.key);
    try {
      const account = await createCustomerAccount({
        email: email.trim().toLowerCase(),
        full_name: saving.name,
        phone: saving.phone || null,
        dni: saving.dni || null,
        address: saving.address || null,
      });
      await linkSales(saving.saleIds, account.userId);
      toast.success(account.existing ? 'Vinculado a su cuenta' : 'Cliente guardado', {
        description: account.existing ? `Ese correo ya tenía cuenta; sus ventas quedaron en ella.` : `Se creó su cuenta con ${email.trim()}. Para entrar, toca «Olvidé mi contraseña» en la tienda.`,
      });
      setSaving(null);
      refresh();
    } catch (e) {
      toast.error('No se pudo guardar', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  if (visible.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        {clients.length === 0 ? 'Todos los clientes de tus ventas ya tienen cuenta.' : 'Ningún cliente coincide.'}
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(c => {
          const account = matchAccount(c, profiles);
          return (
            <li key={c.key} className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-3', c.balanceUsd > 0.009 ? 'border-sale/40' : 'border-border')}>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 shrink-0 border border-border">
                  <AvatarFallback className="bg-muted font-serif text-muted-foreground">{initials(c.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{[c.phone, c.dni && `CI ${c.dni}`].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
                  {c.nameOnly && c.purchases > 1 && <p className="text-[11px] text-muted-foreground">Agrupado por nombre (sin cédula ni teléfono)</p>}
                  <p className="text-xs text-muted-foreground">
                    {c.purchases} {c.purchases === 1 ? 'compra' : 'compras'} · ${c.totalUsd.toFixed(2)}
                    {c.balanceUsd > 0.009 && <span className="ml-1 font-semibold text-sale">· debe ${c.balanceUsd.toFixed(2)}</span>}
                  </p>
                </div>
                {c.phone && (
                  <a href={whatsappLink(c.phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${c.name}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-success/10 hover:text-success">
                    <MessageSquare className="h-5 w-5" />
                  </a>
                )}
              </div>
              {account ? (
                <Button variant="outline" className="h-10 gap-2 rounded-full" disabled={busy === c.key} onClick={() => link(c, account)}>
                  {busy === c.key ? <Loader className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                  Vincular a la cuenta de {account.full_name.split(' ')[0]}
                </Button>
              ) : (
                <Button variant="outline" className="h-10 gap-2 rounded-full" disabled={busy === c.key} onClick={async () => { if (await checkNameOnly(c)) { setSaving(c); setEmail(c.email); } }}>
                  <UserAdd className="h-4 w-4" />
                  Guardar con cuenta
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={!!saving} onOpenChange={o => { if (!o) setSaving(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar a {saving?.name}</DialogTitle>
            <DialogDescription>Se le crea su cuenta con el correo y sus {saving?.purchases} {saving?.purchases === 1 ? 'compra queda' : 'compras quedan'} en su ficha, con lo que debe.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="sc-email">Correo</Label>
            <Input id="sc-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value.replace(/\s/g, '').slice(0, 100))}
              placeholder="nombre@correo.com" className={cn('h-11 rounded-xl', email && !isValidEmail(email) && 'border-sale')} />
            <p className="text-xs text-muted-foreground">Para entrar a la tienda toca «Olvidé mi contraseña» y crea la suya.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-full" onClick={() => setSaving(null)}>Cancelar</Button>
            <Button className="h-11 gap-2 rounded-full" disabled={!isValidEmail(email) || !!busy} onClick={create}>
              {busy ? <Loader className="h-4 w-4 animate-spin" /> : <UserAdd className="h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
