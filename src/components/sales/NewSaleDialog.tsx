import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Search, Plus, Minus, Trash2, Loader, User, Check, Package, CloseSquare, ShoppingCart, Edit, Sparkles } from 'reicon-react';
import { useAuth } from '@/hooks/useAuth';
import { createCustomerAccount, isValidEmail } from '@/lib/customerAccounts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { sortedVariants, variantLabel, variantPrice } from '@/lib/productCategories';
import { useProductCategories } from '@/hooks/useProductCategories';

type SaleModality = 'contado' | 'dos_partes' | 'financiamiento' | 'fiado' | 'cashea';
/** Cashea: inicial según el nivel del cliente (Nivel 1 = 50% … Nivel 6 = 0%); el resto lo paga Cashea a la tienda y el cliente se lo paga a Cashea en 3 o 6 cuotas. */
export const CASHEA_LEVELS = [50, 40, 30, 20, 10, 0] as const;
/** Plan de Cashea. `initialOverride`: la inicial exacta que indica Cashea (manda sobre la del nivel). */
export function casheaPlan(total: number, level: number, installments: 3 | 6, initialOverride?: string) {
  const pct = CASHEA_LEVELS[Math.min(Math.max(level, 1), 6) - 1];
  const manual = initialOverride ? Number(initialOverride.replace(',', '.')) : NaN;
  const initial = Number.isFinite(manual) && manual >= 0 ? Math.min(Math.round(manual * 100) / 100, total) : Math.round(total * pct) / 100;
  const financed = Math.max(0, Math.round((total - initial) * 100) / 100);
  return { pct, initial, financed, installment: Math.round((financed / installments) * 100) / 100 };
}
type ClientMode = 'walkin' | 'search' | 'new';
type ClientMatch = { name: string; dni: string; phone: string; email: string; address: string; userId?: string | null };
/**
 * Una línea por producto y variante (talla, tono o presentación), o un servicio especial /
 * pedido personalizado que no sale del inventario (custom = descripción).
 * price: precio unitario en USD puesto a mano por la administración (si no, el del catálogo).
 */
interface CartLine { key: string; productId: string; variantId?: string; qty: number; price?: number; custom?: string }
const MAX_CUSTOM_QTY = 999;

const EMPTY_CLIENT = { dni: '', name: '', phone: '', email: '', address: '' };
const BS_METHODS = ['efectivo_bs', 'pago_movil', 'transferencia'];
const FALLBACK_METHODS: { method_key: string; label: string }[] = Object.entries(PAYMENT_METHOD_LABELS)
  .filter(([key]) => !key.startsWith('efectivo') && key !== 'cashea')
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
  // Cashea es una modalidad (no el método con que se paga la inicial)
  const paymentMethods: { method_key: string; label: string }[] = (configuredMethods.length > 0 ? configuredMethods : FALLBACK_METHODS).filter(m => m.method_key !== 'cashea');
  const { config: pricingConfig } = usePricingConfig();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();

  const [productQuery, setProductQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [clientMode, setClientMode] = useState<ClientMode>('walkin');
  const [client, setClient] = useState(EMPTY_CLIENT);
  const [clientSelected, setClientSelected] = useState(false);
  const [clientQuery, setClientQuery] = useState('');
  const [modality, setModality] = useState<SaleModality>('contado');
  const [method, setMethod] = useState('');
  const [received, setReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Producto con varias tallas/tonos/presentaciones: se elige cuál antes de agregarlo
  const [pickFor, setPickFor] = useState<string | null>(null);
  // Cambiar el precio de una línea (solo administración)
  const { isAdmin } = useAuth();
  const [priceEdit, setPriceEdit] = useState<{ key: string; value: string } | null>(null);
  // Servicio especial / pedido personalizado (sin inventario)
  const [customOpen, setCustomOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ description: '', price: '', qty: '1' });
  // Cashea: nivel del cliente (1-6) y cuotas (3 o 6)
  const [casheaLevel, setCasheaLevel] = useState(1);
  const [casheaInstallments, setCasheaInstallments] = useState<3 | 6>(3);
  // Inicial exacta que indica la plataforma de Cashea (Merchant web); vacío = la del nivel
  const [casheaInitialInput, setCasheaInitialInput] = useState('');
  // Fiado con abono inicial opcional (USD)
  const [abono, setAbono] = useState('');
  // Cuenta de la clienta elegida (para que la venta quede en su ficha) y correo para crearle una
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [saveEmail, setSaveEmail] = useState('');
  const { byName } = useProductCategories();

  const reset = () => {
    setProductQuery('');
    setCart([]);
    setClientMode('walkin');
    setClient(EMPTY_CLIENT);
    setClientSelected(false);
    setClientQuery('');
    setModality('contado');
    setCasheaLevel(1);
    setCasheaInstallments(3);
    setCasheaInitialInput('');
    setMethod('');
    setReceived('');
    setNotes('');
    setShowNotes(false);
    setPriceEdit(null);
    setCustomOpen(false);
    setCustomForm({ description: '', price: '', qty: '1' });
    setAbono('');
    setClientUserId(null);
    setSaveEmail('');
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

  const qtyInCart = (productId: string) => cart.filter(l => !l.custom && l.productId === productId).reduce((n, l) => n + l.qty, 0);
  const variantOf = (productId: string, variantId?: string) =>
    variantId ? productById.get(productId)?.product_variants?.find(v => v.id === variantId) ?? null : null;
  const lineStock = (productId: string, variantId?: string) =>
    variantId ? variantOf(productId, variantId)?.stock ?? 0 : productById.get(productId)?.stock ?? 0;
  const lineMax = (l: CartLine) => (l.custom !== undefined ? MAX_CUSTOM_QTY : lineStock(l.productId, l.variantId));

  const addLine = (productId: string, variantId?: string) => {
    const product = productById.get(productId);
    if (!product) return;
    const key = `${productId}:${variantId ?? ''}`;
    const current = cart.find(l => l.key === key)?.qty ?? 0;
    const stock = lineStock(productId, variantId);
    if (current >= stock) {
      const v = variantOf(productId, variantId);
      toast.error('No hay más unidades', { description: `${product.name}${v ? ` (${v.label})` : ''}: ${stock} en stock.` });
      return;
    }
    setCart(prev => current ? prev.map(l => l.key === key ? { ...l, qty: l.qty + 1 } : l) : [...prev, { key, productId, variantId, qty: 1 }]);
  };

  const addProduct = (productId: string) => {
    const variants = sortedVariants(productById.get(productId)?.product_variants);
    if (variants.length > 1) { setPickFor(productId); return; }
    addLine(productId, variants[0]?.id);
  };

  const setQty = (key: string, qty: number) => {
    const line = cart.find(l => l.key === key);
    if (!line) return;
    const next = Math.max(0, Math.min(qty, lineMax(line)));
    setCart(prev => next === 0 ? prev.filter(l => l.key !== key) : prev.map(l => l.key === key ? { ...l, qty: next } : l));
  };

  // ── Montos ──
  const isBsPayment = BS_METHODS.includes(method);
  const surchargePct = modality === 'financiamiento' ? (pricingConfig?.credit_surcharge_pct || 10) : 0;
  type SaleLine = CartLine & {
    product: (typeof products)[number] | null;
    variant: ReturnType<typeof variantOf>;
    name: string; stock: number; base: number; listBase: number; unit: number; subtotal: number;
  };
  const lines = cart.flatMap((l): SaleLine[] => {
    if (l.custom !== undefined) {
      const base = l.price ?? 0;
      const unit = base * (1 + surchargePct / 100);
      return [{ ...l, product: null, variant: null, name: l.custom, stock: MAX_CUSTOM_QTY, base, listBase: base, unit, subtotal: unit * l.qty }];
    }
    const p = productById.get(l.productId);
    if (!p) return [];
    const variant = variantOf(l.productId, l.variantId);
    // Una variante con precio propio manda; si no, el precio del producto (o su precio en Bs)
    const listBase = variant && variant.price_usd != null
      ? variantPrice(p.price_usd, variant)
      : isBsPayment && p.price_bs_usd != null && Number(p.price_bs_usd) > 0 ? Number(p.price_bs_usd) : Number(p.price_usd);
    // Precio puesto a mano por la administración (descuento, precio especial)
    const base = l.price ?? listBase;
    const unit = base * (1 + surchargePct / 100);
    return [{ ...l, product: p, variant, name: p.name, stock: lineStock(l.productId, l.variantId), base, listBase, unit, subtotal: unit * l.qty }];
  });
  const total = lines.reduce((s, l) => s + l.subtotal, 0);
  const totalBs = convertToBS(total);
  const [cut1, cut2] = getNextTwoCutoffDates();
  const abonoNum = Math.max(0, Number(abono.replace(',', '.')) || 0);
  const payToday =
    modality === 'contado' ? total :
    modality === 'dos_partes' ? total / 2 :
    modality === 'financiamiento' ? total / 3 :
    modality === 'cashea' ? casheaPlan(total, casheaLevel, casheaInstallments, casheaInitialInput).initial : Math.min(abonoNum, total);
  // Cashea: lo que paga Cashea a la tienda y cada cuota que el cliente le paga a Cashea
  const casheaFinanced = modality === 'cashea' ? casheaPlan(total, casheaLevel, casheaInstallments, casheaInitialInput).financed : 0;
  const casheaInstallment = modality === 'cashea' ? casheaPlan(total, casheaLevel, casheaInstallments, casheaInitialInput).installment : 0;

  const isCash = method === 'efectivo_usd' || method === 'efectivo_bs';
  const receivedNum = Number(received.replace(',', '.')) || 0;
  const dueInMethod = method === 'efectivo_bs' ? convertToBS(payToday) : payToday;
  const change = isCash && receivedNum > 0 ? receivedNum - dueInMethod : 0;
  const cashShort = isCash && payToday > 0 && receivedNum > 0 && change < -0.009;

  // ── Cliente ──
  // Directorio completo (clientes registrados + los que ya compraron), filtrado aquí mismo:
  // así aparecen todos, sin el tope de 8 resultados que tenía la búsqueda en el servidor.
  const { data: clientDirectory = [], isLoading: clientSearching } = useQuery({
    queryKey: ['sale-client-directory'],
    enabled: open && clientMode === 'search',
    staleTime: 60_000,
    queryFn: async () => {
      const [salesRes, profRes] = await Promise.all([
        supabase.from('sales')
          .select('client_name, client_dni, client_phone, client_email, client_address, customer_user_id, created_at')
          .not('client_name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase.from('customer_profiles')
          .select('user_id, full_name, dni, phone, email, address')
          .order('full_name', { ascending: true })
          .limit(5000),
      ]);
      const map = new Map<string, ClientMatch>();
      const push = (m: ClientMatch) => {
        const name = m.name.trim();
        if (!name) return;
        const key = m.dni.trim().toUpperCase() || name.toLowerCase();
        if (!map.has(key)) map.set(key, { ...m, name });
      };
      for (const r of profRes.data || []) push({ name: r.full_name || '', dni: r.dni || '', phone: r.phone || '', email: r.email || '', address: r.address || '', userId: r.user_id });
      for (const r of salesRes.data || []) push({ name: r.client_name || '', dni: r.client_dni || '', phone: r.client_phone || '', email: r.client_email || '', address: r.client_address || '', userId: r.customer_user_id });
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    },
  });

  const clientResults = useMemo(() => {
    const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = fold(clientQuery.trim());
    if (!q) return clientDirectory;
    const digits = q.replace(/\D/g, '');
    return clientDirectory.filter(m =>
      fold(m.name).includes(q) ||
      fold(m.dni).includes(q) ||
      (digits.length >= 3 && (m.phone.replace(/\D/g, '').includes(digits) || m.dni.replace(/\D/g, '').includes(digits))),
    );
  }, [clientDirectory, clientQuery]);

  const pickClient = (m: ClientMatch) => {
    setClient({ dni: m.dni, name: m.name, phone: m.phone, email: m.email, address: m.address });
    setClientUserId(m.userId ?? null);
    setSaveEmail(m.userId ? '' : m.email);
    setClientSelected(true);
  };

  const changeClientMode = (mode: ClientMode) => {
    setClientMode(mode);
    setClient(EMPTY_CLIENT);
    setClientSelected(false);
    setClientQuery('');
    setClientUserId(null);
    setSaveEmail('');
  };

  const phoneNormalized = normalizeVePhone(client.phone);
  const hasClient = clientMode === 'search' ? clientSelected : clientMode === 'new' ? client.name.trim().length > 1 : false;

  // ── Validación: el botón explica lo que falta ──
  const missing = (() => {
    if (!lines.length) return 'Agrega al menos un producto o servicio';
    if (lines.some(l => !(l.unit > 0))) return 'Hay una línea sin precio';
    if (modality !== 'contado' && modality !== 'cashea' && !hasClient) return 'Las ventas a crédito necesitan un cliente';
    if (clientMode !== 'walkin' && !hasClient) return clientMode === 'search' ? 'Elige un cliente de la lista' : 'Escribe el nombre del cliente';
    if (clientMode === 'new' && !isValidVePhone(phoneNormalized)) return 'Completa el teléfono (7 dígitos después del prefijo)';
    if (clientMode === 'new' && client.email.trim() && !isValidEmail(client.email)) return 'El correo no es válido (o déjalo vacío)';
    // Sin correo no hay cuenta: en crédito/fiado el teléfono es lo que luego enlaza la deuda con su cuenta
    if (clientMode === 'new' && modality !== 'contado' && !client.email.trim() && !phoneNormalized) return 'En crédito o fiado pon el teléfono o el correo del cliente';
    if (clientMode === 'search' && clientSelected && !clientUserId && saveEmail && !isValidEmail(saveEmail)) return 'Revisa el correo del cliente';
    if (!method) return modality === 'fiado' ? 'Elige con qué va a pagar ($ o Bs)' : 'Elige el método de pago';
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
    } else if (modality === 'cashea') {
      finalNotes = `[CASHEA Nivel ${casheaLevel} · inicial $${payToday.toFixed(2)} · ${casheaInstallments} cuotas de $${casheaInstallment.toFixed(2)} que cobra Cashea] ${finalNotes}`.trim();
    } else if (modality === 'fiado') {
      finalNotes = (payToday > 0
        ? `[FIADO - abonó $${payToday.toFixed(2)}, resta $${(total - payToday).toFixed(2)} al ${formatCutoffDate(cut1)}] ${finalNotes}`
        : `[FIADO QUINCENA - 100% al ${formatCutoffDate(cut1)}] ${finalNotes}`).trim();
    }
    if (lines.some(l => l.custom !== undefined)) {
      finalNotes = `[SERVICIO ESPECIAL] ${finalNotes}`.trim();
    }

    // Con correo (cliente nuevo, o buscado sin cuenta) primero se crea su cuenta (sin contraseña) para que la venta quede a su nombre.
    // Sin correo no se crea cuenta: la venta guarda sus datos y luego aparece en "Buscar cliente".
    let customerUserId: string | null = clientMode === 'search' && clientSelected ? clientUserId : null;
    let accountCreated = false;
    const accountEmail = clientMode === 'new' ? client.email : clientMode === 'search' && !customerUserId ? saveEmail : '';
    if (accountEmail.trim()) {
      try {
        const account = await createCustomerAccount({
          email: accountEmail.trim().toLowerCase(),
          full_name: sanitizeText(client.name.trim()),
          phone: phoneNormalized || null,
          dni: client.dni.trim() || null,
          address: client.address.trim() ? sanitizeText(client.address.trim()) : null,
        });
        customerUserId = account.userId;
        accountCreated = !account.existing;
      } catch (err) {
        toast.error('No se pudo crear la cuenta del cliente', { description: err instanceof Error ? err.message : String(err) });
        setSubmitting(false);
        return;
      }
    }

    // Cashea no es crédito de la tienda: Cashea le paga el resto
    const isCredit = modality !== 'contado' && modality !== 'cashea';
    const saleGroupId = crypto.randomUUID();
    const withClient = clientMode !== 'walkin';
    let failed = false;
    // Lo pagado hoy se reparte entre las líneas; la última se queda con el redondeo
    const ratio = total > 0 ? payToday / total : 0;
    let paidLeft = Math.round(payToday * 100) / 100;

    for (const [i, line] of lines.entries()) {
      const itemTotal = Math.round(line.subtotal * 100) / 100;
      const paid = modality === 'contado'
        ? itemTotal
        : i === lines.length - 1 ? Math.min(paidLeft, itemTotal) : Math.min(Math.round(itemTotal * ratio * 100) / 100, paidLeft);
      paidLeft = Math.round((paidLeft - paid) * 100) / 100;
      const { data, error } = await addSale({
        product_id: line.product ? line.productId : null,
        product_name: line.custom !== undefined
          ? `Servicio especial: ${line.custom}`
          : line.variant && line.product
          ? `${line.product.name} (${variantLabel(byName(line.product.category)?.detail_kind)}: ${line.variant.label})`
          : line.name,
        variant_id: line.variant?.id ?? null,
        variant_label: line.variant?.label ?? null,
        quantity: line.qty,
        unit_price_usd: line.unit,
        total_usd: itemTotal,
        total_bs: convertToBS(itemTotal),
        payment_method: modality === 'cashea' && payToday <= 0 ? 'cashea' : method || 'efectivo_usd',
        client_name: withClient && client.name ? sanitizeText(client.name) : null,
        client_dni: withClient && client.dni ? sanitizeText(client.dni) : null,
        client_email: withClient && client.email ? sanitizeText(client.email) : null,
        ...(customerUserId ? { customer_user_id: customerUserId } : {}),
        client_phone: withClient && phoneNormalized ? phoneNormalized : null,
        client_address: withClient && client.address ? sanitizeText(client.address) : null,
        is_credit: isCredit,
        sale_modality: modality,
        sale_group_id: saleGroupId,
        amount_paid: paid,
        payment_status: paid >= itemTotal - 0.005 ? 'paid' : paid > 0 ? 'partial' : 'pending',
        status: isCredit ? 'confirmed' : 'pending',
        notes: finalNotes ? sanitizeText(finalNotes) : null,
      } as Parameters<typeof addSale>[0]);
      if (error) { failed = true; break; }
      if (data?.id) await confirmSale(data.id);
    }

    // Cashea: lo que financia Cashea entra como pago con método Cashea (la venta queda pagada)
    let casheaPending = false;
    if (!failed && modality === 'cashea' && casheaFinanced > 0.004) {
      const amount = Math.round(casheaFinanced * 100) / 100;
      const { error } = await supabase.rpc('process_group_abono', {
        p_sale_group_id: saleGroupId,
        p_amount_usd: amount,
        p_amount_bs: convertToBS(amount),
        p_exchange_rate: rate || 0,
        p_usdt_rate: 0,
        p_usdt_bought: 0,
        p_payment_method: 'cashea',
        p_notes: `Cashea: ${casheaInstallments} cuotas (Nivel ${casheaLevel})`,
      });
      casheaPending = !!error;
    }

    if (!failed && withClient) queryClient.invalidateQueries({ queryKey: ['customers'] });
    if (!failed) queryClient.invalidateQueries({ queryKey: ['sale-client-directory'] });
    if (!failed && withClient) queryClient.invalidateQueries({ queryKey: ['sale-clients'] });

    setSubmitting(false);
    if (casheaPending) {
      toast.warning('El pago de Cashea quedó por registrar', {
        description: `La venta se guardó, pero los $${casheaFinanced.toFixed(2)} de Cashea quedaron por cobrar. Regístralos en Por cobrar como abono con método Cashea.`,
        duration: 10000,
      });
    }
    if (!failed) {
      toast.success('Venta registrada', {
        description: `$${total.toFixed(2)}${hasClient ? ` · ${client.name}` : ''}${accountCreated ? `. Se creó su cuenta con ${accountEmail.trim()}: para entrar, toca «Olvidé mi contraseña» en la tienda.` : ''}`,
        duration: accountCreated ? 9000 : undefined,
      });
      onCreated?.();
      close(false);
    }
  };

  const commitPrice = () => {
    if (!priceEdit) return;
    const value = Number(priceEdit.value.replace(',', '.'));
    if (Number.isFinite(value) && value > 0) {
      setCart(prev => prev.map(l => l.key === priceEdit.key ? { ...l, price: Math.round(value * 100) / 100 } : l));
    }
    setPriceEdit(null);
  };
  const resetPrice = (key: string) => setCart(prev => prev.map(l => l.key === key ? { ...l, price: undefined } : l));

  const customPrice = Number(customForm.price.replace(',', '.')) || 0;
  const customQty = Math.max(1, Math.min(MAX_CUSTOM_QTY, Math.floor(Number(customForm.qty) || 1)));
  const addCustom = () => {
    const description = customForm.description.trim().replace(/\s+/g, ' ');
    if (description.length < 3 || customPrice <= 0) return;
    setCart(prev => [...prev, { key: `custom:${crypto.randomUUID()}`, productId: '', qty: customQty, price: Math.round(customPrice * 100) / 100, custom: description.slice(0, 150) }]);
    setCustomForm({ description: '', price: '', qty: '1' });
    setCustomOpen(false);
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
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/50 bg-primary/5 p-3 text-left transition-colors hover:border-primary"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Sparkles className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Servicio especial o pedido personalizado</span>
                <span className="block text-xs text-muted-foreground">Sin inventario: escribe qué es y cuánto cuesta</span>
              </span>
            </button>
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
                        key={l.key}
                        layout={!reduceMotion}
                        initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{l.name}</p>
                          {l.custom !== undefined && <p className="text-xs font-medium text-primary">Servicio especial</p>}
                          {l.variant && <p className="truncate text-xs font-medium text-primary">{l.variant.label}</p>}
                          {priceEdit?.key === l.key ? (
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">$</span>
                              <Input
                                autoFocus
                                inputMode="decimal"
                                value={priceEdit.value}
                                onChange={e => setPriceEdit({ key: l.key, value: e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10) })}
                                onKeyDown={e => { if (e.key === 'Enter') commitPrice(); if (e.key === 'Escape') setPriceEdit(null); }}
                                onBlur={commitPrice}
                                aria-label={`Precio de ${l.name} en dólares`}
                                className="h-8 w-24 rounded-lg px-2 text-sm"
                              />
                            </div>
                          ) : isAdmin ? (
                            <button
                              type="button"
                              onClick={() => setPriceEdit({ key: l.key, value: l.base.toFixed(2) })}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                              aria-label={`Cambiar el precio de ${l.name}`}
                            >
                              {money(l.unit)} c/u <Edit className="h-3 w-3" />
                            </button>
                          ) : (
                            <p className="text-xs text-muted-foreground">{money(l.unit)} c/u</p>
                          )}
                          {l.price !== undefined && l.custom === undefined && Math.abs(l.price - l.listBase) > 0.004 && priceEdit?.key !== l.key && (
                            <button type="button" onClick={() => resetPrice(l.key)} className="block text-[11px] text-muted-foreground underline-offset-2 hover:underline">
                              Precio cambiado (lista ${l.listBase.toFixed(2)}) · volver
                            </button>
                          )}
                        </div>
                        <div className="flex items-center rounded-full border border-border">
                          <button type="button" onClick={() => setQty(l.key, l.qty - 1)} aria-label="Quitar uno" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
                            {l.qty === 1 ? <Trash2 className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4" />}
                          </button>
                          <span className="w-7 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                          <button type="button" onClick={() => setQty(l.key, l.qty + 1)} disabled={l.qty >= l.stock} aria-label="Agregar uno" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40">
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
                    <button type="button" onClick={() => { setClientSelected(false); setClient(EMPTY_CLIENT); setClientUserId(null); setSaveEmail(''); }} aria-label="Cambiar cliente" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
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
                      <p className="px-1 text-xs text-muted-foreground">
                        {clientQuery.trim() ? `${clientResults.length} de ${clientDirectory.length} clientes` : `${clientDirectory.length} clientes · escribe para filtrar`}
                      </p>
                    )}
                    {clientResults.length > 0 && (
                      <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-2xl border border-border bg-card">
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
                    {!clientSearching && clientResults.length === 0 && (
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

              {clientMode === 'search' && clientSelected && (
                clientUserId ? (
                  <p className="text-xs text-success">Tiene cuenta: la venta queda en su ficha de Clientes.</p>
                ) : (
                  <div className="space-y-1 rounded-2xl border border-border bg-card p-3">
                    <Label htmlFor="ns-save-email">Correo para guardarlo en Clientes (opcional)</Label>
                    <Input id="ns-save-email" type="email" inputMode="email" autoComplete="off" value={saveEmail}
                      onChange={e => setSaveEmail(e.target.value.replace(/\s/g, '').slice(0, 100))}
                      placeholder="nombre@correo.com"
                      className={cn('h-11 rounded-xl', saveEmail && !isValidEmail(saveEmail) && 'border-sale')} />
                    <p className="text-xs text-muted-foreground">Aún no tiene cuenta. Con el correo se le crea y la venta queda en su ficha; sin correo igual aparece en Clientes como «sin cuenta».</p>
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
                    <Label htmlFor="ns-phone">Teléfono *</Label>
                    <PhoneInput
                      id="ns-phone"
                      value={client.phone}
                      onChange={phone => setClient(c => ({ ...c, phone }))}
                      inputClassName={cn('h-11 rounded-xl', client.phone && !isValidVePhone(phoneNormalized) && 'border-sale')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ns-email">Correo <span className="font-normal text-muted-foreground">(opcional: con correo se le crea su cuenta)</span></Label>
                    <Input id="ns-email" type="email" inputMode="email" autoComplete="off" value={client.email} onChange={e => setClient(c => ({ ...c, email: e.target.value.replace(/\s/g, '').slice(0, 100) }))} placeholder="nombre@correo.com" className={cn('h-11 rounded-xl', client.email && !isValidEmail(client.email) && 'border-sale')} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ns-address">Dirección</Label>
                    <Input id="ns-address" value={client.address} onChange={e => setClient(c => ({ ...c, address: e.target.value.slice(0, 150) }))} placeholder="opcional" className="h-11 rounded-xl" />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Con el correo se le crea su cuenta y le llega la factura. Para entrar, toca «Olvidé mi contraseña» en la tienda, crea su contraseña y completa su perfil.
                  </p>
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
                  { v: 'cashea', t: 'Cashea', d: 'Inicial según su nivel · 3 o 6 cuotas' },
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
              {modality === 'cashea' && (
                <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Nivel del cliente en Cashea</p>
                    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Nivel en Cashea">
                      {CASHEA_LEVELS.map((pct, i) => (
                        <button key={pct} type="button" role="radio" aria-checked={casheaLevel === i + 1} onClick={() => setCasheaLevel(i + 1)}
                          className={cn('h-11 rounded-xl border px-2 text-xs font-medium transition-colors', casheaLevel === i + 1 ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50')}>
                          Nivel {i + 1} · {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Cuotas</p>
                    <div className="flex gap-2" role="radiogroup" aria-label="Cuotas de Cashea">
                      {([3, 6] as const).map(n => (
                        <button key={n} type="button" role="radio" aria-checked={casheaInstallments === n} onClick={() => setCasheaInstallments(n)} className={pill(casheaInstallments === n)}>{n} cuotas</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ns-cashea-initial">Inicial que indica Cashea ($)</Label>
                    <Input id="ns-cashea-initial" inputMode="decimal" value={casheaInitialInput}
                      onChange={e => setCasheaInitialInput(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10))}
                      placeholder={casheaPlan(total, casheaLevel, casheaInstallments).initial.toFixed(2)} className="h-11 rounded-xl" />
                    <p className="text-[11px] text-muted-foreground">Cópiala de la plataforma de Cashea al escanear el QR. Vacía = la del nivel.</p>
                  </div>
                  {total > 0 && (
                    <p className="rounded-xl bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                      Inicial hoy en la tienda <strong>{money(payToday)}</strong>{casheaInitialInput ? '' : ` (${CASHEA_LEVELS[casheaLevel - 1]}%)`} · Cashea te paga <strong>{money(casheaFinanced)}</strong> · el cliente le paga a Cashea {casheaInstallments} cuotas de <strong>{money(casheaInstallment)}</strong>
                    </p>
                  )}
                </div>
              )}
              {modality === 'fiado' && (
                <div className="space-y-1 rounded-2xl border border-border bg-card p-3">
                  <Label htmlFor="ns-abono">Abono hoy (opcional, $)</Label>
                  <Input id="ns-abono" inputMode="decimal" value={abono}
                    onChange={e => setAbono(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10))}
                    placeholder="0.00" className="h-11 rounded-xl" />
                  {abonoNum > total + 0.004 && total > 0 && <p className="text-xs text-sale">El abono no puede pasar del total; se toma {money(total)}.</p>}
                  {payToday > 0 && <p className="text-xs text-muted-foreground">Queda por cobrar <strong>{money(total - payToday)}</strong></p>}
                </div>
              )}
              {modality === 'financiamiento' && total > 0 && (
                <p className="rounded-xl bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                  Inicial hoy <strong>{money(total / 3)}</strong> · Cuota {formatCutoffDate(cut1)} <strong>{money(total / 3)}</strong> · Cuota {formatCutoffDate(cut2)} <strong>{money(total / 3)}</strong>
                </p>
              )}
            </div>

            {/* Método y efectivo (en fiado también: el método define la moneda y el precio, $ o Bs) */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Método de pago {modality === 'fiado' ? <span className="font-normal text-muted-foreground">(con qué va a pagar: define el precio en $ o Bs)</span> : modality === 'cashea' ? <span className="font-normal text-muted-foreground">(de la inicial)</span> : modality !== 'contado' && <span className="font-normal text-muted-foreground">(de lo que paga hoy)</span>}</p>
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

      {/* Servicio especial / pedido personalizado */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Servicio especial</DialogTitle>
            <DialogDescription>Para pedidos personalizados o servicios que no están en el inventario. No descuenta stock.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cs-desc">Descripción del pedido *</Label>
              <Textarea id="cs-desc" value={customForm.description} rows={3} className="resize-none rounded-xl"
                onChange={e => setCustomForm(f => ({ ...f, description: e.target.value.slice(0, 150) }))}
                placeholder="Ej: maquillaje para boda a domicilio, kit personalizado…" />
              <p className="text-right text-[11px] text-muted-foreground">{customForm.description.length}/150</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="cs-price">Precio ($) *</Label>
                <Input id="cs-price" inputMode="decimal" value={customForm.price} placeholder="0.00" className="h-11 rounded-xl"
                  onChange={e => setCustomForm(f => ({ ...f, price: e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10) }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cs-qty">Cantidad</Label>
                <Input id="cs-qty" inputMode="numeric" value={customForm.qty} className="h-11 rounded-xl"
                  onChange={e => setCustomForm(f => ({ ...f, qty: e.target.value.replace(/\D/g, '').slice(0, 3) }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Si el cliente deja un abono, elige «Fiado» en ¿Cómo paga? y escribe el monto abonado.</p>
            <Button className="h-11 w-full rounded-full" disabled={customForm.description.trim().length < 3 || customPrice <= 0} onClick={addCustom}>
              Agregar {customPrice > 0 ? `· $${(customPrice * customQty).toFixed(2)}` : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Elegir talla, tono o presentación */}
      <Dialog open={!!pickFor} onOpenChange={o => !o && setPickFor(null)}>
        <DialogContent className="sm:max-w-sm">
          {pickFor && (() => {
            const p = productById.get(pickFor)!;
            const name = variantLabel(byName(p.category)?.detail_kind);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{p.name}</DialogTitle>
                  <DialogDescription>Elige {name.toLowerCase()}.</DialogDescription>
                </DialogHeader>
                <ul className="grid gap-2">
                  {sortedVariants(p.product_variants).map(v => {
                    const inCart = cart.find(l => l.key === `${p.id}:${v.id}`)?.qty ?? 0;
                    const left = v.stock - inCart;
                    return (
                      <li key={v.id}>
                        <button type="button" disabled={left <= 0}
                          onClick={() => { addLine(p.id, v.id); setPickFor(null); }}
                          className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 text-left hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-40">
                          <span className="font-medium">{v.label}</span>
                          <span className="text-sm tabular-nums text-muted-foreground">
                            ${variantPrice(p.price_usd, v).toFixed(2)} · {left > 0 ? `${left} uds` : 'Agotado'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
