import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Search, Plus, Minus, Trash2, Loader, User, Check, Package, CloseSquare, ShoppingCart } from 'reicon-react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { usePricingConfig } from '@/hooks/usePricingConfig';
import { getNextTwoCutoffDates, formatCutoffDate } from '@/lib/cutoffDates';
import { BRAND_NAME_UPPER } from '@/config/brand';
import { formatBS, cn } from '@/lib/utils';
import { PAYMENT_METHOD_LABELS } from '@/lib/paymentMethodFields';
import { PhoneInput, DocumentIdInput } from '@/components/ui/ve-inputs';
import { toast } from 'sonner';

type SaleModality = 'contado' | 'dos_partes' | 'financiamiento' | 'fiado';
type ClientMode = 'walkin' | 'search' | 'new';
type ClientMatch = { name: string; dni: string; phone: string; email: string; address: string };
interface CartLine { productId: string; qty: number }

const EMPTY_CLIENT = { dni: '', name: '', phone: '', email: '', address: '' };
const BS_METHODS = ['efectivo_bs', 'pago_movil', 'transferencia'];
const FALLBACK_METHODS: { method_key: string; label: string }[] = Object.entries(PAYMENT_METHOD_LABELS)
  .filter(([key]) => !key.startsWith('efectivo'))
  .map(([method_key, label]) => ({ method_key, label }));

/** Convierte teléfonos venezolanos a +58XXXXXXXXXX (formato que exige la base). */
export function normalizeVePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('58') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+58${digits.slice(1)}`;
  if (digits.length === 10) return `+58${digits}`;
  return raw.startsWith('+') ? `+${digits}` : digits;
}
const isValidVePhone = (p: string) => !p || /^\+58(?:412|414|422|424|416|426|2\d{2})\d{7}$/.test(p);

interface NewSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

// Nueva venta (mostrador): elegir productos con buscador, cliente opcional en contado,
// cobro con modalidades y vuelto. Una sola pantalla con el total siempre visible.
export function NewSaleDialog({ open, onOpenChange, onCreated }: NewSaleDialogProps) {
  const { addSale, confirmSale } = useSales();
  const { products } = useProducts();
  const { rate, convertToBS } = useExchangeRate();
  const { methods: configuredMethods } = usePaymentMethods(false);
  const paymentMethods: { method_key: string; label: string }[] = configuredMethods.length > 0 ? configuredMethods : FALLBACK_METHODS;
  const { config: pricingConfig } = usePricingConfig();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();

  const [productQuery, setProductQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [clientMode, setClientMode] = useState<ClientMode>('walkin');
  const [client, setClient] = useState(EMPTY_CLIENT);
  const [clientSelected, setClientSelected] = useState(false);
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<ClientMatch[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [modality, setModality] = useState<SaleModality>('contado');
  const [method, setMethod] = useState('');
  const [received, setReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setProductQuery('');
    setCart([]);
    setClientMode('walkin');
    setClient(EMPTY_CLIENT);
    setClientSelected(false);
    setClientQuery('');
    setClientResults([]);
    setModality('contado');
    setMethod('');
    setReceived('');
    setNotes('');
    setShowNotes(false);
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  // ── Productos ──
  const productById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const matches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const list = q
      ? products.filter(p => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q))
      : [...products].sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
    return list.slice(0, q ? 12 : 8);
  }, [products, productQuery]);

  const qtyInCart = (productId: string) => cart.find(l => l.productId === productId)?.qty ?? 0;

  const addProduct = (productId: string) => {
    const product = productById.get(productId);
    if (!product) return;
    const current = qtyInCart(productId);
    if (current >= product.stock) {
      toast.error('No hay más unidades', { description: `${product.name}: ${product.stock} en stock.` });
      return;
    }
    setCart(prev => current ? prev.map(l => l.productId === productId ? { ...l, qty: l.qty + 1 } : l) : [...prev, { productId, qty: 1 }]);
  };

  const setQty = (productId: string, qty: number) => {
    const stock = productById.get(productId)?.stock ?? 0;
    const next = Math.max(0, Math.min(qty, stock));
    setCart(prev => next === 0 ? prev.filter(l => l.productId !== productId) : prev.map(l => l.productId === productId ? { ...l, qty: next } : l));
  };

  // ── Montos ──
  const isBsPayment = BS_METHODS.includes(method);
  const surchargePct = modality === 'financiamiento' ? (pricingConfig?.credit_surcharge_pct || 10) : 0;
  const lines = cart.map(l => {
    const p = productById.get(l.productId)!;
    const base = isBsPayment && p.price_bs_usd != null && Number(p.price_bs_usd) > 0 ? Number(p.price_bs_usd) : Number(p.price_usd);
    const unit = base * (1 + surchargePct / 100);
    return { ...l, product: p, unit, subtotal: unit * l.qty };
  }).filter(l => l.product);
  const total = lines.reduce((s, l) => s + l.subtotal, 0);
  const totalBs = convertToBS(total);
  const [cut1, cut2] = getNextTwoCutoffDates();
  const payToday =
    modality === 'contado' ? total :
    modality === 'dos_partes' ? total / 2 :
    modality === 'financiamiento' ? total / 3 : 0;

  const isCash = method === 'efectivo_usd' || method === 'efectivo_bs';
  const receivedNum = Number(received.replace(',', '.')) || 0;
  const dueInMethod = method === 'efectivo_bs' ? convertToBS(payToday) : payToday;
  const change = isCash && receivedNum > 0 ? receivedNum - dueInMethod : 0;
  const cashShort = isCash && payToday > 0 && receivedNum > 0 && change < -0.009;

  // ── Cliente ──
  const runClientSearch = useCallback(async (raw: string) => {
    const safe = raw.trim().replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (safe.length < 2) { setClientResults([]); setClientSearching(false); return; }
    setClientSearching(true);
    try {
      const [salesRes, profRes] = await Promise.allSettled([
        supabase.from('sales')
          .select('client_name, client_dni, client_phone, client_email, client_address, created_at')
          .not('client_name', 'is', null)
          .or(`client_name.ilike.%${safe}%,client_dni.ilike.%${safe}%,client_phone.ilike.%${safe}%`)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('customer_profiles')
          .select('full_name, dni, phone, email, address')
          .or(`full_name.ilike.%${safe}%,dni.ilike.%${safe}%,phone.ilike.%${safe}%`)
          .limit(20),
      ]);
      const map = new Map<string, ClientMatch>();
      const push = (m: ClientMatch) => {
        const name = m.name.trim();
        if (!name) return;
        const key = m.dni.trim().toUpperCase() || name.toLowerCase();
        if (!map.has(key)) map.set(key, m);
      };
      if (profRes.status === 'fulfilled') {
        for (const r of profRes.value.data || []) push({ name: r.full_name || '', dni: r.dni || '', phone: r.phone || '', email: r.email || '', address: r.address || '' });
      }
      if (salesRes.status === 'fulfilled') {
        for (const r of salesRes.value.data || []) push({ name: r.client_name || '', dni: r.client_dni || '', phone: r.client_phone || '', email: r.client_email || '', address: r.client_address || '' });
      }
      setClientResults(Array.from(map.values()).slice(0, 8));
    } catch {
      setClientResults([]);
    } finally {
      setClientSearching(false);
    }
  }, []);

  useEffect(() => {
    if (clientMode !== 'search' || clientSelected) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runClientSearch(clientQuery), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [clientQuery, clientMode, clientSelected, runClientSearch]);

  const pickClient = (m: ClientMatch) => {
    setClient({ dni: m.dni, name: m.name, phone: m.phone, email: m.email, address: m.address });
    setClientSelected(true);
    setClientResults([]);
  };

  const changeClientMode = (mode: ClientMode) => {
    setClientMode(mode);
    setClient(EMPTY_CLIENT);
    setClientSelected(false);
    setClientQuery('');
    setClientResults([]);
  };

  const phoneNormalized = normalizeVePhone(client.phone);
  const hasClient = clientMode === 'search' ? clientSelected : clientMode === 'new' ? client.name.trim().length > 1 : false;

  // ── Validación: el botón explica lo que falta ──
  const missing = (() => {
    if (!lines.length) return 'Agrega al menos un producto';
    if (modality !== 'contado' && !hasClient) return 'Las ventas a crédito necesitan un cliente';
    if (clientMode !== 'walkin' && !hasClient) return clientMode === 'search' ? 'Elige un cliente de la lista' : 'Escribe el nombre del cliente';
    if (clientMode === 'new' && !isValidVePhone(phoneNormalized)) return 'Completa el teléfono (7 dígitos después del prefijo)';
    if (modality !== 'fiado' && !method) return 'Elige el método de pago';
    if (isCash && payToday > 0 && receivedNum <= 0) return 'Indica cuánto recibiste';
    if (cashShort) return 'El monto recibido no alcanza';
    return '';
  })();

  // ── Registrar ──
  const handleSubmit = async () => {
    if (missing || submitting) return;
    setSubmitting(true);
    const { sanitizeText } = await import('@/lib/validations');

    let finalNotes = notes.trim();
    if (modality === 'contado' && isCash && receivedNum > 0) {
      const cur = method === 'efectivo_usd' ? '$' : 'Bs ';
      const receipt = `[Recibido: ${cur}${receivedNum.toFixed(2)} | Vuelto: ${cur}${Math.max(change, 0).toFixed(2)}${rate > 0 ? ` (Tasa: Bs ${rate.toFixed(2)})` : ''}]`;
      finalNotes = finalNotes ? `${receipt} - ${finalNotes}` : receipt;
    }
    if (modality === 'dos_partes') {
      finalNotes = `[EN 2 PARTES - 50% contado, 50% al ${formatCutoffDate(cut1)}] ${finalNotes}`.trim();
    } else if (modality === 'financiamiento') {
      finalNotes = `[FINANCIAMIENTO ${BRAND_NAME_UPPER} +${surchargePct}% - Inicial 33%, Cuota 1: ${formatCutoffDate(cut1)}, Cuota 2: ${formatCutoffDate(cut2)}] ${finalNotes}`.trim();
    } else if (modality === 'fiado') {
      finalNotes = `[FIADO QUINCENA - 100% al ${formatCutoffDate(cut1)}] ${finalNotes}`.trim();
    }

    const isCredit = modality !== 'contado';
    const saleGroupId = crypto.randomUUID();
    const withClient = clientMode !== 'walkin';
    let failed = false;

    for (const line of lines) {
      const itemTotal = line.subtotal;
      const paid =
        modality === 'contado' ? itemTotal :
        modality === 'dos_partes' ? itemTotal / 2 :
        modality === 'financiamiento' ? itemTotal / 3 : 0;
      const { data, error } = await addSale({
        product_id: line.productId,
        product_name: line.product.name,
        quantity: line.qty,
        unit_price_usd: line.unit,
        total_usd: itemTotal,
        total_bs: convertToBS(itemTotal),
        payment_method: method || 'efectivo_usd',
        client_name: withClient && client.name ? sanitizeText(client.name) : null,
        client_dni: withClient && client.dni ? sanitizeText(client.dni) : null,
        client_email: withClient && client.email ? sanitizeText(client.email) : null,
        client_phone: withClient && phoneNormalized ? phoneNormalized : null,
        client_address: withClient && client.address ? sanitizeText(client.address) : null,
        is_credit: isCredit,
        sale_modality: modality,
        sale_group_id: saleGroupId,
        amount_paid: paid,
        payment_status: paid >= itemTotal ? 'paid' : paid > 0 ? 'partial' : 'pending',
        status: isCredit ? 'confirmed' : 'pending',
        notes: finalNotes ? sanitizeText(finalNotes) : null,
      } as Parameters<typeof addSale>[0]);
      if (error) { failed = true; break; }
      if (data?.id) await confirmSale(data.id);
    }

    // Cliente nuevo: guardar su perfil para encontrarlo la próxima vez
    if (!failed && clientMode === 'new' && client.name.trim()) {
      try {
        const profile = {
          full_name: sanitizeText(client.name.trim()),
          dni: client.dni.trim() || null,
          phone: phoneNormalized || null,
          email: client.email.trim() || null,
          address: client.address.trim() || null,
        };
        const lookup = profile.dni ? { col: 'dni', val: profile.dni } : profile.phone ? { col: 'phone', val: profile.phone } : null;
        const { data: existing } = lookup
          ? await supabase.from('customer_profiles').select('id').eq(lookup.col, lookup.val).maybeSingle()
          : { data: null };
        if (existing) await supabase.from('customer_profiles').update(profile).eq('id', existing.id);
        else await supabase.from('customer_profiles').insert({ ...profile, user_id: crypto.randomUUID() });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      } catch (err) {
        console.warn('No se pudo guardar el perfil del cliente:', err);
      }
    }

    setSubmitting(false);
    if (!failed) {
      toast.success('Venta registrada', { description: `$${total.toFixed(2)}${hasClient ? ` · ${client.name}` : ''}` });
      onCreated?.();
      close(false);
    }
  };

  const money = (usd: number) => (isBsPayment && rate > 0 ? formatBS(convertToBS(usd)) : `$${usd.toFixed(2)}`);
  const pill = (active: boolean) =>
    cn('rounded-full border px-4 text-sm font-medium transition-colors h-10 shrink-0',
      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50');

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] gap-0 p-0 max-sm:!pb-0 sm:max-w-5xl sm:overflow-hidden">
        <DialogHeader className="border-b border-border px-5 pb-4 pt-6 sm:px-6">
          <DialogTitle>Nueva venta</DialogTitle>
          <DialogDescription>Toca los productos para agregarlos. El total se actualiza solo.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[minmax(0,1fr)] sm:max-h-[calc(90vh-9rem)] sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:overflow-hidden">
          {/* ── Columna 1: productos ── */}
          <section className="min-w-0 space-y-3 border-border p-5 sm:overflow-y-auto sm:border-r sm:p-6" aria-label="Productos">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productQuery}
                onChange={e => setProductQuery(e.target.value)}
                placeholder="Buscar producto o categoría"
                aria-label="Buscar producto"
                className="h-11 rounded-full pl-10"
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {productQuery ? `${matches.length} resultados` : 'Más vendidos'}
            </p>
            <ul className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
              {matches.map(p => {
                const inCart = qtyInCart(p.id);
                const soldOut = p.stock <= 0 || inCart >= p.stock;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(p.id)}
                      disabled={p.stock <= 0}
                      className={cn(
                        'relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-card p-2 text-left transition-colors',
                        inCart ? 'border-primary' : 'border-border hover:border-primary/50',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                      )}
                    >
                      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-studio">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center"><Package className="h-5 w-5 text-muted-foreground/40" /></span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1 space-y-0.5 pr-7">
                        <span className="line-clamp-2 block text-xs font-semibold leading-snug">{p.name}</span>
                        <span className="flex items-baseline justify-between gap-1">
                          <span className="text-sm font-bold tabular-nums">${Number(p.price_usd).toFixed(2)}</span>
                          <span className={cn('text-[11px]', p.stock <= 3 ? 'text-sale' : 'text-muted-foreground')}>{p.stock} uds</span>
                        </span>
                      </span>
                      {inCart > 0 && (
                        <span className="absolute right-2 top-1/2 flex h-7 min-w-7 -translate-y-1/2 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
                          {inCart}
                        </span>
                      )}
                      {soldOut && p.stock > 0 && (
                        <span className="absolute bottom-1 left-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-sale">Máximo</span>
                      )}
                    </button>
                  </li>
                );
              })}
              {matches.length === 0 && (
                <li className="col-span-full rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  No hay productos con “{productQuery}”.
                </li>
              )}
            </ul>
          </section>

          {/* ── Columna 2: carrito, cliente y cobro ── */}
          <section className="min-w-0 space-y-5 bg-background p-5 sm:overflow-y-auto sm:p-6" aria-label="Detalle de la venta">
            {/* Carrito */}
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShoppingCart className="h-4 w-4 text-primary" /> Carrito</p>
              {lines.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Aún no hay productos.</p>
              ) : (
                <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                  <AnimatePresence initial={false}>
                    {lines.map(l => (
                      <motion.li
                        key={l.productId}
                        layout={!reduceMotion}
                        initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{l.product.name}</p>
                          <p className="text-xs text-muted-foreground">{money(l.unit)} c/u</p>
                        </div>
                        <div className="flex items-center rounded-full border border-border">
                          <button type="button" onClick={() => setQty(l.productId, l.qty - 1)} aria-label="Quitar uno" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
                            {l.qty === 1 ? <Trash2 className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4" />}
                          </button>
                          <span className="w-7 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                          <button type="button" onClick={() => setQty(l.productId, l.qty + 1)} disabled={l.qty >= l.product.stock} aria-label="Agregar uno" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="w-20 text-right text-sm font-bold tabular-nums">{money(l.subtotal)}</p>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Cliente */}
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold"><User className="h-4 w-4 text-primary" /> Cliente</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide" role="radiogroup" aria-label="Tipo de cliente">
                {([
                  { v: 'walkin', t: 'Sin datos' },
                  { v: 'search', t: 'Buscar cliente' },
                  { v: 'new', t: 'Cliente nuevo' },
                ] as { v: ClientMode; t: string }[]).map(o => (
                  <button key={o.v} type="button" role="radio" aria-checked={clientMode === o.v} onClick={() => changeClientMode(o.v)} className={pill(clientMode === o.v)}>
                    {o.t}
                  </button>
                ))}
              </div>

              {clientMode === 'walkin' && (
                <p className="text-xs text-muted-foreground">Venta de mostrador de contado. Para crédito o fiado elige un cliente.</p>
              )}

              {clientMode === 'search' && (
                clientSelected ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {client.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{client.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{[client.dni, client.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
                    </div>
                    <button type="button" onClick={() => { setClientSelected(false); setClient(EMPTY_CLIENT); }} aria-label="Cambiar cliente" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
                      <CloseSquare className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={clientQuery} onChange={e => setClientQuery(e.target.value)} placeholder="Nombre, cédula o teléfono" className="h-11 rounded-full pl-10" autoFocus />
                      {clientSearching && <Loader className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                    </div>
                    {clientResults.length > 0 && (
                      <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-2xl border border-border bg-card">
                        {clientResults.map((m, i) => (
                          <li key={`${m.dni}-${m.name}-${i}`}>
                            <button type="button" onClick={() => pickClient(m)} className="w-full px-3 py-2.5 text-left hover:bg-primary/5">
                              <p className="text-sm font-medium">{m.name}</p>
                              <p className="text-xs text-muted-foreground">{[m.dni, m.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {clientQuery.trim().length >= 2 && !clientSearching && clientResults.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Sin coincidencias.{' '}
                        <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => { changeClientMode('new'); setClient({ ...EMPTY_CLIENT, name: /\d/.test(clientQuery) ? '' : clientQuery, dni: /\d/.test(clientQuery) ? clientQuery.toUpperCase() : '' }); }}>
                          Registrarlo como nuevo
                        </button>
                      </p>
                    )}
                  </div>
                )
              )}

              {clientMode === 'new' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="ns-name">Nombre *</Label>
                    <Input id="ns-name" value={client.name} onChange={e => setClient(c => ({ ...c, name: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ'\s.-]/g, '').slice(0, 60) }))} placeholder="Nombre y apellido" className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ns-dni">Cédula / RIF</Label>
                    <DocumentIdInput id="ns-dni" value={client.dni} onChange={dni => setClient(c => ({ ...c, dni }))} inputClassName="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ns-phone">Teléfono</Label>
                    <PhoneInput
                      id="ns-phone"
                      value={client.phone}
                      onChange={phone => setClient(c => ({ ...c, phone }))}
                      inputClassName={cn('h-11 rounded-xl', client.phone && !isValidVePhone(phoneNormalized) && 'border-sale')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ns-email">Correo</Label>
                    <Input id="ns-email" type="email" value={client.email} onChange={e => setClient(c => ({ ...c, email: e.target.value.slice(0, 100) }))} placeholder="opcional" className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ns-address">Dirección</Label>
                    <Input id="ns-address" value={client.address} onChange={e => setClient(c => ({ ...c, address: e.target.value.slice(0, 150) }))} placeholder="opcional" className="h-11 rounded-xl" />
                  </div>
                </div>
              )}
            </div>

            {/* Modalidad */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">¿Cómo paga?</p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modalidad">
                {([
                  { v: 'contado', t: 'Contado', d: 'Paga todo hoy' },
                  { v: 'dos_partes', t: 'En 2 partes', d: `50% hoy · 50% el ${formatCutoffDate(cut1)}` },
                  { v: 'financiamiento', t: 'Financiado', d: `+${pricingConfig?.credit_surcharge_pct || 10}% · inicial y 2 cuotas` },
                  { v: 'fiado', t: 'Fiado', d: `Paga todo el ${formatCutoffDate(cut1)}` },
                ] as { v: SaleModality; t: string; d: string }[]).map(o => (
                  <button
                    key={o.v}
                    type="button"
                    role="radio"
                    aria-checked={modality === o.v}
                    onClick={() => setModality(o.v)}
                    className={cn(
                      'rounded-2xl border p-3 text-left transition-colors',
                      modality === o.v ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/50'
                    )}
                  >
                    <p className="text-sm font-semibold">{o.t}</p>
                    <p className="text-xs leading-snug text-muted-foreground">{o.d}</p>
                  </button>
                ))}
              </div>
              {modality === 'financiamiento' && total > 0 && (
                <p className="rounded-xl bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                  Inicial hoy <strong>{money(total / 3)}</strong> · Cuota {formatCutoffDate(cut1)} <strong>{money(total / 3)}</strong> · Cuota {formatCutoffDate(cut2)} <strong>{money(total / 3)}</strong>
                </p>
              )}
            </div>

            {/* Método y efectivo */}
            {modality !== 'fiado' && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Método de pago {modality !== 'contado' && <span className="font-normal text-muted-foreground">(de lo que paga hoy)</span>}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Método de pago">
                  {paymentMethods.map(m => (
                    <button key={m.method_key} type="button" role="radio" aria-checked={method === m.method_key} onClick={() => setMethod(m.method_key)} className={pill(method === m.method_key)}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {isCash && payToday > 0 && (
                  <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                    <Label htmlFor="ns-received">Recibido ({method === 'efectivo_usd' ? '$' : 'Bs'})</Label>
                    <Input
                      id="ns-received"
                      inputMode="decimal"
                      value={received}
                      onChange={e => setReceived(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 12))}
                      placeholder="0.00"
                      className="h-12 rounded-xl text-lg font-bold"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(new Set([
                        Math.ceil(dueInMethod * 100) / 100,
                        ...(method === 'efectivo_usd' ? [5, 10, 20, 50, 100] : [100, 500, 1000, 5000]).map(step => Math.ceil(dueInMethod / step) * step),
                      ])).filter(v => v > 0).slice(0, 5).map(v => (
                        <button key={v} type="button" onClick={() => setReceived(String(v))} className="h-8 rounded-full border border-border px-3 text-xs font-medium hover:border-primary">
                          {v === Math.ceil(dueInMethod * 100) / 100 ? 'Exacto' : method === 'efectivo_usd' ? `$${v}` : `Bs ${v}`}
                        </button>
                      ))}
                    </div>
                    {receivedNum > 0 && (
                      <p className={cn('text-sm font-semibold', cashShort ? 'text-sale' : 'text-success')}>
                        {cashShort
                          ? `Faltan ${method === 'efectivo_usd' ? `$${Math.abs(change).toFixed(2)}` : formatBS(Math.abs(change))}`
                          : `Vuelto: ${method === 'efectivo_usd' ? `$${change.toFixed(2)}` : formatBS(change)}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Nota */}
            {showNotes ? (
              <div className="space-y-1">
                <Label htmlFor="ns-notes">Nota</Label>
                <Textarea id="ns-notes" value={notes} onChange={e => setNotes(e.target.value.slice(0, 200))} rows={2} className="resize-none rounded-xl" placeholder="Ej: envolver para regalo" />
              </div>
            ) : (
              <button type="button" onClick={() => setShowNotes(true)} className="text-sm font-medium text-primary underline-offset-2 hover:underline">+ Agregar nota</button>
            )}
          </section>
        </div>

        {/* Pie fijo con total y acción */}
        <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border bg-background/95 px-5 py-4 backdrop-blur pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pb-4">
          <div>
            <p className="text-xs text-muted-foreground">
              {lines.reduce((s, l) => s + l.qty, 0)} artículos · {modality === 'contado' ? 'paga hoy' : `hoy ${money(payToday)}`}
            </p>
            <p className="font-serif text-2xl tabular-nums">
              {money(total)}
              {!isBsPayment && rate > 0 && total > 0 && <span className="ml-2 font-sans text-sm text-muted-foreground">{formatBS(totalBs)}</span>}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <Button className="h-12 gap-2 rounded-full px-8 text-base" disabled={!!missing || submitting} onClick={handleSubmit}>
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Registrar venta
            </Button>
            {missing && lines.length > 0 && <p className="text-center text-xs text-muted-foreground sm:text-right">{missing}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
