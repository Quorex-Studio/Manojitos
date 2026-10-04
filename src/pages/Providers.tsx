import { PhoneInput } from '@/components/ui/ve-inputs';
import { localDateISO } from '@/lib/dates';
import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, Truck, Search, Trash2, Call, Mailbox, MessageSquare, Package } from 'reicon-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProviders } from '@/hooks/useProviders';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatBS, cn } from '@/lib/utils';
import { formatPhone } from '@/lib/venezuela';
import { whatsappLink } from '@/components/customers/customerUi';

const money = (n: number) => `$${n.toFixed(2)}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export default function Providers() {
  const confirmDialog = useConfirm();
  const reduce = useReducedMotion();
  const { providers, purchases, addProvider, deleteProvider, addPurchase, deletePurchase, refetch } = useProviders();
  const { rate } = useExchangeRate();
  const [tab, setTab] = useState('compras');
  const [search, setSearch] = useState('');
  const [providerOpen, setProviderOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providerForm, setProviderForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [purchaseForm, setPurchaseForm] = useState({ provider: '', amount_usd: '', amount_bs: '', notes: '', purchase_date: localDateISO() });

  // --- Resumen ---
  const stats = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const year = String(now.getFullYear());
    const sum = (list: typeof purchases) => list.reduce((s, p) => s + Number(p.amount_usd || 0), 0);
    return {
      total: sum(purchases),
      year: sum(purchases.filter(p => (p.purchase_date || '').startsWith(year))),
      month: sum(purchases.filter(p => (p.purchase_date || '').startsWith(monthKey))),
      count: purchases.length,
    };
  }, [purchases]);

  // Compras por proveedor (total y última compra)
  const byProvider = useMemo(() => {
    const map = new Map<string, { total: number; count: number; last: string }>();
    purchases.forEach(p => {
      const key = (p.provider_name || '').toLowerCase();
      const cur = map.get(key) || { total: 0, count: 0, last: '' };
      cur.total += Number(p.amount_usd || 0);
      cur.count += 1;
      if ((p.purchase_date || '') > cur.last) cur.last = p.purchase_date;
      map.set(key, cur);
    });
    return map;
  }, [purchases]);

  const q = search.trim().toLowerCase();
  const visiblePurchases = purchases.filter(p => !q || p.provider_name.toLowerCase().includes(q) || (p.notes || '').toLowerCase().includes(q));
  const months = useMemo(() => {
    const groups = new Map<string, typeof purchases>();
    [...visiblePurchases]
      .sort((a, b) => (b.purchase_date || '').localeCompare(a.purchase_date || ''))
      .forEach(p => {
        const key = (p.purchase_date || '').slice(0, 7) || 'sin-fecha';
        groups.set(key, [...(groups.get(key) || []), p]);
      });
    return [...groups.entries()];
  }, [visiblePurchases]);
  const visibleProviders = providers.filter(p => !q || p.name.toLowerCase().includes(q));

  // --- Acciones ---
  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { sanitizeText } = await import('@/lib/validations');
    const { error } = await addProvider({
      name: sanitizeText(providerForm.name.trim()),
      phone: providerForm.phone || null,
      email: providerForm.email ? sanitizeText(providerForm.email) : null,
      notes: providerForm.notes ? sanitizeText(providerForm.notes) : null,
    });
    setSaving(false);
    if (!error) {
      setProviderOpen(false);
      setProviderForm({ name: '', phone: '', email: '', notes: '' });
    }
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = purchaseForm.provider.trim();
    const amount = Number(purchaseForm.amount_usd);
    if (!name || !(amount > 0)) return;
    setSaving(true);
    const { sanitizeText } = await import('@/lib/validations');
    // Si el proveedor no existe todavía, se crea al vuelo
    let provider = providers.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (!provider) {
      const res = await addProvider({ name: sanitizeText(name), phone: null, email: null, notes: null });
      provider = (res as { data?: typeof providers[number] }).data;
    }
    const { error } = await addPurchase({
      provider_id: provider?.id ?? null,
      provider_name: provider?.name ?? sanitizeText(name),
      amount_usd: amount,
      amount_bs: rate > 0 ? Math.round(amount * rate * 100) / 100 : null,
      status: 'paid',
      notes: purchaseForm.notes ? sanitizeText(purchaseForm.notes) : null,
      purchase_date: purchaseForm.purchase_date,
    });
    setSaving(false);
    if (!error) {
      setPurchaseOpen(false);
      setPurchaseForm({ provider: '', amount_usd: '', amount_bs: '', notes: '', purchase_date: localDateISO() });
      refetch();
    }
  };

  const setUsd = (val: string) => setPurchaseForm(f => ({ ...f, amount_usd: val, amount_bs: rate > 0 && val ? (Number(val) * rate).toFixed(2) : '' }));
  const setBs = (val: string) => setPurchaseForm(f => ({ ...f, amount_bs: val, amount_usd: rate > 0 && val ? (Number(val) / rate).toFixed(2) : '' }));

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-header">Proveedores</h1>
            <p className="page-subtitle">Lo que compras para la tienda y a quién</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button className="h-11 rounded-full" onClick={() => setPurchaseOpen(true)}><Plus className="h-4 w-4" />Registrar compra</Button>
            <Button variant="outline" className="h-11 rounded-full" onClick={() => setProviderOpen(true)}><Plus className="h-4 w-4" />Proveedor</Button>
          </div>
        </div>

        {/* Resumen */}
        <section className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-4 md:gap-4 md:p-5">
          {[
            ['Este mes', stats.month],
            [`En ${new Date().getFullYear()}`, stats.year],
            ['Total', stats.total],
          ].map(([label, value], i) => (
            <div key={label as string} className={cn(i > 0 && 'border-l border-border pl-2 md:pl-4')}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
              <p className={cn('font-serif text-xl font-semibold tabular-nums md:text-3xl', i === 0 && 'text-primary')}>{money(value as number)}</p>
            </div>
          ))}
        </section>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={search} onChange={e => setSearch(e.target.value.slice(0, 60))} placeholder="Buscar proveedor o nota" className="h-12 rounded-full pl-12" aria-label="Buscar" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="admin-tabs">
            <TabsTrigger value="compras"><Package className="h-4 w-4" />Compras <span className="text-muted-foreground">{stats.count}</span></TabsTrigger>
            <TabsTrigger value="proveedores"><Truck className="h-4 w-4" />Proveedores <span className="text-muted-foreground">{providers.length}</span></TabsTrigger>
          </TabsList>

          {/* ===== COMPRAS por mes ===== */}
          <TabsContent value="compras" className="mt-5 space-y-5">
            {months.length === 0 ? (
              <EmptyState
                title={purchases.length === 0 ? 'Aún no hay compras' : 'Nada coincide con la búsqueda'}
                text="Registra lo que compras a tus proveedores para saber cuánto inviertes cada mes."
                action={purchases.length === 0 ? <Button className="h-11 rounded-full" onClick={() => setPurchaseOpen(true)}><Plus className="h-4 w-4" />Registrar compra</Button> : null}
              />
            ) : months.map(([key, list]) => (
              <section key={key}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="font-serif text-lg">{key === 'sin-fecha' ? 'Sin fecha' : monthLabel(key)}</h2>
                  <span className="text-sm font-semibold tabular-nums">{money(list.reduce((s, p) => s + Number(p.amount_usd || 0), 0))}</span>
                </div>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {list.map((p, i) => (
                    <motion.li
                      key={p.id}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 10) * 0.02 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Truck className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.provider_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.purchase_date ? new Date(p.purchase_date + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }) : 'Sin fecha'}
                          {p.notes ? ` · ${p.notes.replace(/^\[Treinta\]\s*/, '')}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{money(Number(p.amount_usd))}</p>
                        {p.amount_bs ? <p className="text-[11px] text-muted-foreground">{formatBS(Number(p.amount_bs))}</p> : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                        aria-label={`Eliminar compra de ${p.provider_name}`}
                        onClick={async () => {
                          if (await confirmDialog({ title: '¿Eliminar esta compra?', description: `${p.provider_name} · ${money(Number(p.amount_usd))}. No se puede deshacer.`, confirmText: 'Eliminar', destructive: true })) deletePurchase(p.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </motion.li>
                  ))}
                </ul>
              </section>
            ))}
          </TabsContent>

          {/* ===== PROVEEDORES ===== */}
          <TabsContent value="proveedores" className="mt-5">
            {visibleProviders.length === 0 ? (
              <EmptyState
                title={providers.length === 0 ? 'Aún no hay proveedores' : 'Nada coincide con la búsqueda'}
                text="Guarda aquí a quién le compras: tiendas online, distribuidores o personas."
                action={providers.length === 0 ? <Button className="h-11 rounded-full" onClick={() => setProviderOpen(true)}><Plus className="h-4 w-4" />Agregar proveedor</Button> : null}
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleProviders.map(provider => {
                  const info = byProvider.get(provider.name.toLowerCase());
                  return (
                    <li key={provider.id} className="flex flex-col rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-lg text-primary">
                          {provider.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{provider.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {info ? `${info.count} ${info.count === 1 ? 'compra' : 'compras'} · ${money(info.total)}` : 'Sin compras todavía'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive"
                          aria-label={`Eliminar ${provider.name}`}
                          onClick={async () => {
                            if (await confirmDialog({ title: `¿Eliminar a ${provider.name}?`, description: 'Sus compras registradas se conservan.', confirmText: 'Eliminar', destructive: true })) deleteProvider(provider.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {(provider.phone || provider.email || provider.notes) && (
                        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                          {provider.phone && <p className="flex items-center gap-2"><Call className="h-3.5 w-3.5" />{formatPhone(provider.phone)}</p>}
                          {provider.email && <p className="flex items-center gap-2 truncate"><Mailbox className="h-3.5 w-3.5" />{provider.email}</p>}
                          {provider.notes && <p className="line-clamp-2 text-xs">{provider.notes}</p>}
                        </div>
                      )}
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 flex-1 rounded-full"
                          onClick={() => { setPurchaseForm(f => ({ ...f, provider: provider.name })); setPurchaseOpen(true); }}
                        >
                          <Plus className="h-4 w-4" />Compra
                        </Button>
                        {provider.phone && (
                          <Button asChild variant="outline" size="sm" className="h-10 rounded-full">
                            <a href={whatsappLink(provider.phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${provider.name}`}><MessageSquare className="h-4 w-4" /></a>
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Registrar compra */}
      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar compra</DialogTitle>
            <DialogDescription>Lo que pagaste a un proveedor por mercancía o insumos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPurchase} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pu-provider">Proveedor</Label>
              <Input
                id="pu-provider"
                list="providers-list"
                value={purchaseForm.provider}
                onChange={e => setPurchaseForm(f => ({ ...f, provider: e.target.value.slice(0, 60) }))}
                placeholder="Escribe o elige (ej: SHEIN)"
                className="h-11 rounded-xl"
                required
              />
              <datalist id="providers-list">
                {providers.map(p => <option key={p.id} value={p.name} />)}
              </datalist>
              {purchaseForm.provider.trim() && !providers.some(p => p.name.toLowerCase() === purchaseForm.provider.trim().toLowerCase()) && (
                <p className="text-xs text-muted-foreground">Se creará el proveedor "{purchaseForm.provider.trim()}".</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pu-usd">Monto en $</Label>
                <Input id="pu-usd" inputMode="decimal" value={purchaseForm.amount_usd} onChange={e => setUsd(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className="h-11 rounded-xl" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pu-bs">o en Bs</Label>
                <Input id="pu-bs" inputMode="decimal" value={purchaseForm.amount_bs} onChange={e => setBs(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pu-date">Fecha</Label>
              <Input id="pu-date" type="date" value={purchaseForm.purchase_date} max={localDateISO()} onChange={e => e.target.value <= localDateISO() && setPurchaseForm(f => ({ ...f, purchase_date: e.target.value }))} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pu-notes">¿Qué compraste? (opcional)</Label>
              <Textarea id="pu-notes" value={purchaseForm.notes} onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value.slice(0, 200) }))} rows={2} className="resize-none rounded-xl" placeholder="Ej: 12 protectores solares y 6 sérums" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPurchaseOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving || !purchaseForm.provider.trim() || !(Number(purchaseForm.amount_usd) > 0)}>Guardar compra</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Nuevo proveedor */}
      <Dialog open={providerOpen} onOpenChange={setProviderOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
            <DialogDescription>Solo el nombre es obligatorio.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddProvider} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pr-name">Nombre</Label>
              <Input id="pr-name" value={providerForm.name} onChange={e => setProviderForm(f => ({ ...f, name: e.target.value.slice(0, 60) }))} className="h-11 rounded-xl" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-phone">Teléfono</Label>
              <PhoneInput id="pr-phone" value={providerForm.phone} onChange={phone => setProviderForm(f => ({ ...f, phone }))} inputClassName="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-email">Correo</Label>
              <Input id="pr-email" type="email" value={providerForm.email} onChange={e => setProviderForm(f => ({ ...f, email: e.target.value.replace(/[^a-zA-Z0-9@._+-]/g, '').slice(0, 100) }))} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-notes">Notas</Label>
              <Textarea id="pr-notes" value={providerForm.notes} onChange={e => setProviderForm(f => ({ ...f, notes: e.target.value.slice(0, 200) }))} rows={2} className="resize-none rounded-xl" placeholder="Ej: tiempos de envío, cuenta, contacto" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProviderOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving || !providerForm.name.trim()}>Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-studio"><Truck className="h-7 w-7 text-muted-foreground" /></span>
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
