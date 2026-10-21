import { useMemo, useState } from 'react';
import { Loader, Package, Plus, Search, Trash2, Truck } from 'reicon-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProducts } from '@/hooks/useProducts';
import { useProviders } from '@/hooks/useProviders';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { missingMigration, purchaseTotals, usePurchasingActions } from '@/hooks/usePurchasing';
import { sortedVariants } from '@/lib/productCategories';
import { localDateISO } from '@/lib/dates';
import { cn, formatBS } from '@/lib/utils';
import { PURCHASE_METHODS, purchaseMethodName } from '@/components/purchases/purchaseMethods';

interface Line { key: string; productId: string; variantId: string | null; name: string; variantLabel: string | null; qty: string; cost: string }

const num = (v: string) => Number(v.replace(',', '.')) || 0;
const money = (n: number) => `$${n.toFixed(2)}`;
const TAX_PRESETS = [{ v: 0, t: 'Sin impuesto' }, { v: 7, t: 'Tax USA 7%' }];

/**
 * Registrar una compra a un proveedor eligiendo productos del inventario: cuántas unidades,
 * a qué costo neto, impuesto (tax de USA 7% u otro), envío interno (o gratis) y cómo se pagó.
 * Al guardar, las unidades entran al inventario y lo que falte por pagar queda en Cuentas por pagar.
 */
export function PurchaseDialog({ open, onOpenChange, defaultProvider = '' }: { open: boolean; onOpenChange: (open: boolean) => void; defaultProvider?: string }) {
  const { products } = useProducts();
  const { providers, addProvider, refetch } = useProviders();
  const { rate } = useExchangeRate();
  const { registerPurchase } = usePurchasingActions();

  const [provider, setProvider] = useState(defaultProvider);
  const [date, setDate] = useState(localDateISO());
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState('');
  const [pickVariantsOf, setPickVariantsOf] = useState<string | null>(null);
  const [taxPct, setTaxPct] = useState('0');
  const [customTax, setCustomTax] = useState(false);
  const [freeShipping, setFreeShipping] = useState(true);
  const [shipping, setShipping] = useState('');
  const [method, setMethod] = useState('zelle');
  const [payMode, setPayMode] = useState<'all' | 'part' | 'none'>('all');
  const [paidPart, setPaidPart] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const [lastDefault, setLastDefault] = useState(defaultProvider);
  if (open && defaultProvider !== lastDefault) { setLastDefault(defaultProvider); setProvider(defaultProvider); }

  const reset = () => {
    setProvider(''); setDate(localDateISO()); setLines([]); setQuery(''); setPickVariantsOf(null);
    setTaxPct('0'); setCustomTax(false); setFreeShipping(true); setShipping(''); setMethod('zelle');
    setPayMode('all'); setPaidPart(''); setDueDate(''); setNotes(''); setLastDefault('');
  };
  const close = (o: boolean) => { onOpenChange(o); if (!o) reset(); };

  const productById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)).slice(0, 8);
  }, [products, query]);

  const addLine = (productId: string, variantId: string | null) => {
    const p = productById.get(productId);
    if (!p) return;
    const v = variantId ? p.product_variants?.find(x => x.id === variantId) : null;
    const key = `${productId}:${variantId ?? ''}`;
    if (lines.some(l => l.key === key)) { toast.info('Ese producto ya está en la compra'); return; }
    const knownCost = Number((p as { cost_usd?: number | null }).cost_usd) || 0;
    setLines(ls => [...ls, { key, productId, variantId, name: p.name, variantLabel: v?.label ?? null, qty: '1', cost: knownCost > 0 ? knownCost.toFixed(2) : '' }]);
    setQuery('');
    setPickVariantsOf(null);
  };
  const pickProduct = (productId: string) => {
    const variants = sortedVariants(productById.get(productId)?.product_variants);
    if (variants.length > 1) { setPickVariantsOf(productId); return; }
    addLine(productId, variants[0]?.id ?? null);
  };
  const updateLine = (key: string, patch: Partial<Line>) => setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const tax = Math.max(0, num(taxPct));
  const ship = freeShipping ? 0 : Math.max(0, num(shipping));
  const items = lines.map(l => ({ quantity: Math.floor(num(l.qty)), unit_cost_usd: num(l.cost) }));
  const totals = purchaseTotals(items, tax, ship);
  const paid = payMode === 'all' ? totals.total : payMode === 'none' ? 0 : Math.min(num(paidPart), totals.total);
  const units = items.reduce((s, i) => s + i.quantity, 0);

  const missing = (() => {
    if (!provider.trim()) return 'Escribe el proveedor';
    if (!lines.length) return 'Agrega al menos un producto';
    if (items.some(i => i.quantity <= 0)) return 'Revisa las cantidades';
    if (items.some(i => i.unit_cost_usd <= 0)) return 'Escribe el costo de cada producto';
    if (!freeShipping && num(shipping) <= 0) return 'Escribe el costo del envío o marca «Gratis»';
    if (paid > 0 && !method) return 'Elige con qué pagaste';
    if (payMode === 'part' && !(num(paidPart) > 0)) return 'Escribe cuánto pagaste';
    return '';
  })();

  const save = async () => {
    if (missing || registerPurchase.isPending) return;
    try {
      const { sanitizeText } = await import('@/lib/validations');
      const name = sanitizeText(provider.trim());
      let prov = providers.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (!prov) {
        const res = await addProvider({ name, phone: null, email: null, notes: null });
        prov = (res as { data?: typeof providers[number] }).data;
      }
      const result = await registerPurchase.mutateAsync({
        purchase: {
          provider_id: prov?.id ?? null,
          provider_name: prov?.name ?? name,
          purchase_date: date,
          tax_pct: tax,
          shipping_usd: ship,
          payment_method: paid > 0 ? method : null,
          amount_paid: Math.round(paid * 100) / 100,
          due_date: paid < totals.total && dueDate ? dueDate : null,
          notes: notes.trim() ? sanitizeText(notes.trim()).slice(0, 500) : null,
          rate: rate > 0 ? rate : null,
        },
        items: lines.map((l, i) => ({
          product_id: l.productId, variant_id: l.variantId, product_name: l.name, variant_label: l.variantLabel,
          quantity: items[i].quantity, unit_cost_usd: items[i].unit_cost_usd,
        })),
      });
      refetch();
      toast.success('Compra registrada', {
        description: `${result.units} ${result.units === 1 ? 'unidad entró' : 'unidades entraron'} al inventario · ${money(Number(result.total_usd))}${Number(result.paid_usd) < Number(result.total_usd) ? ` · por pagar ${money(Number(result.total_usd) - Number(result.paid_usd))}` : ''}`,
      });
      close(false);
    } catch (e) {
      toast.error('No se pudo registrar la compra', {
        description: missingMigration(e) ? 'Falta aplicar la migración de compras y gastos en la base de datos.' : e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
      });
    }
  };

  const pill = (active: boolean) => cn('h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50');
  const pickProductData = pickVariantsOf ? productById.get(pickVariantsOf) : null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar compra</DialogTitle>
          <DialogDescription>Elige los productos del inventario: al guardar, las unidades se suman al stock.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="pd-provider">Proveedor</Label>
              <Input id="pd-provider" list="pd-providers" value={provider} onChange={e => setProvider(e.target.value.slice(0, 60))} placeholder="Ej: Victoria's Secret, SHEIN" className="h-11 rounded-xl" />
              <datalist id="pd-providers">{providers.map(p => <option key={p.id} value={p.name} />)}</datalist>
              {provider.trim() && !providers.some(p => p.name.toLowerCase() === provider.trim().toLowerCase()) && (
                <p className="text-xs text-muted-foreground">Se creará el proveedor «{provider.trim()}».</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pd-date">Fecha</Label>
              <Input id="pd-date" type="date" value={date} max={localDateISO()} onChange={e => e.target.value && setDate(e.target.value)} className="h-11 rounded-xl" />
            </div>
          </div>

          {/* Productos */}
          <section className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><Package className="h-4 w-4 text-primary" /> Productos</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={e => setQuery(e.target.value.slice(0, 60))} placeholder="Buscar producto del inventario (ej: splash)" className="h-11 rounded-full pl-10" aria-label="Buscar producto" />
            </div>
            {matches.length > 0 && (
              <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-2xl border border-border bg-card">
                {matches.map(p => (
                  <li key={p.id}>
                    <button type="button" onClick={() => pickProduct(p.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-primary/5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">{p.category || 'Sin categoría'} · {p.stock} en stock</span>
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-primary" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && matches.length === 0 && (
              <p className="text-xs text-muted-foreground">No está en el inventario. Créalo primero en Productos y vuelve a buscarlo.</p>
            )}
            {pickProductData && (
              <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3">
                <p className="mb-2 text-sm font-medium">{pickProductData.name}: ¿a cuál opción entran?</p>
                <div className="flex flex-wrap gap-2">
                  {sortedVariants(pickProductData.product_variants).map(v => (
                    <button key={v.id} type="button" className={pill(false)} onClick={() => addLine(pickProductData.id, v.id)}>{v.label}</button>
                  ))}
                </div>
              </div>
            )}

            {lines.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Busca y toca los productos que compraste.</p>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {lines.map((l, i) => (
                  <li key={l.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_auto] sm:items-end">
                    <div className="min-w-0 sm:self-center">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      {l.variantLabel && <p className="text-xs font-medium text-primary">{l.variantLabel}</p>}
                      {items[i].unit_cost_usd > 0 && (tax > 0 || ship > 0) && (
                        <p className="text-[11px] text-muted-foreground">Con impuesto y envío: {money(totals.landed(items[i].unit_cost_usd))} c/u</p>
                      )}
                    </div>
                    <button type="button" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} aria-label={`Quitar ${l.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:order-last">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="space-y-1">
                      <Label htmlFor={`pd-q-${l.key}`} className="text-xs text-muted-foreground">Cantidad</Label>
                      <Input id={`pd-q-${l.key}`} inputMode="numeric" value={l.qty} onChange={e => updateLine(l.key, { qty: e.target.value.replace(/\D/g, '').slice(0, 5) })} className="h-10 rounded-xl text-center tabular-nums" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pd-c-${l.key}`} className="text-xs text-muted-foreground">Costo neto c/u ($)</Label>
                      <Input id={`pd-c-${l.key}`} inputMode="decimal" value={l.cost} placeholder="0.00" onChange={e => updateLine(l.key, { cost: e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10) })} className="h-10 rounded-xl text-right tabular-nums" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Impuesto y envío */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Impuesto</p>
              <div className="flex flex-wrap gap-2">
                {TAX_PRESETS.map(t => (
                  <button key={t.v} type="button" className={pill(!customTax && tax === t.v)} onClick={() => { setCustomTax(false); setTaxPct(String(t.v)); }}>{t.t}</button>
                ))}
                <button type="button" className={pill(customTax)} onClick={() => setCustomTax(true)}>Otro %</button>
              </div>
              {customTax && (
                <Input inputMode="decimal" value={taxPct} onChange={e => setTaxPct(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 5))} placeholder="%" aria-label="Porcentaje de impuesto" className="h-11 w-28 rounded-xl" />
              )}
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4 text-primary" /> Envío interno</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={pill(freeShipping)} onClick={() => setFreeShipping(true)}>Gratis</button>
                <button type="button" className={pill(!freeShipping)} onClick={() => setFreeShipping(false)}>Con costo</button>
              </div>
              {!freeShipping && (
                <Input inputMode="decimal" value={shipping} onChange={e => setShipping(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10))} placeholder="$ 0.00" aria-label="Costo del envío en dólares" className="h-11 w-36 rounded-xl" />
              )}
            </div>
          </section>

          {/* Totales */}
          <section className="rounded-2xl bg-studio p-4 text-sm">
            <div className="flex justify-between"><span>Subtotal ({units} {units === 1 ? 'unidad' : 'unidades'})</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
            {tax > 0 && <div className="flex justify-between text-muted-foreground"><span>Impuesto {tax}%</span><span className="tabular-nums">{money(totals.tax)}</span></div>}
            {ship > 0 && <div className="flex justify-between text-muted-foreground"><span>Envío</span><span className="tabular-nums">{money(totals.shipping)}</span></div>}
            <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{money(totals.total)}{rate > 0 && totals.total > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{formatBS(totals.total * rate)}</span>}</span>
            </div>
          </section>

          {/* Pago */}
          <section className="space-y-2">
            <p className="text-sm font-semibold">¿Cuánto pagaste?</p>
            <div className="flex flex-wrap gap-2">
              {([['all', 'Todo'], ['part', 'Una parte'], ['none', 'Nada aún']] as const).map(([v, t]) => (
                <button key={v} type="button" className={pill(payMode === v)} onClick={() => setPayMode(v)}>{t}</button>
              ))}
            </div>
            {payMode === 'part' && (
              <Input inputMode="decimal" value={paidPart} onChange={e => setPaidPart(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10))} placeholder="$ pagado" aria-label="Monto pagado en dólares" className="h-11 w-40 rounded-xl" />
            )}
            {payMode !== 'all' && (
              <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-3">
                <p className="w-full text-xs text-muted-foreground">Quedan <strong className="text-foreground">{money(Math.max(0, totals.total - paid))}</strong> en Cuentas por pagar.</p>
                <div className="space-y-1">
                  <Label htmlFor="pd-due">Vence (opcional)</Label>
                  <Input id="pd-due" type="date" value={dueDate} min={date} onChange={e => setDueDate(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
            )}
            {paid > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="pd-method">Método de pago</Label>
                <select id="pd-method" value={method} onChange={e => setMethod(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm sm:w-64">
                  {PURCHASE_METHODS.map(m => <option key={m} value={m}>{purchaseMethodName(m)}</option>)}
                </select>
              </div>
            )}
          </section>

          <div className="space-y-1.5">
            <Label htmlFor="pd-notes">Nota (opcional)</Label>
            <Textarea id="pd-notes" value={notes} onChange={e => setNotes(e.target.value.slice(0, 300))} rows={2} className="resize-none rounded-xl" placeholder="Ej: pedido #1234, llegó por MRW" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:items-center">
          {missing && <p className="text-xs text-muted-foreground sm:mr-auto">{missing}</p>}
          <Button variant="outline" className="h-11 rounded-full" onClick={() => close(false)}>Cancelar</Button>
          <Button className="h-11 gap-2 rounded-full" disabled={!!missing || registerPurchase.isPending} onClick={() => void save()}>
            {registerPurchase.isPending && <Loader className="h-4 w-4 animate-spin" />}
            Guardar compra · {money(totals.total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
