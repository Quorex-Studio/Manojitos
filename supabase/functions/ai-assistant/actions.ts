// Acciones de la asistente (preparar → confirmar).
//
// La IA NUNCA escribe en la base de datos. Solo puede PREPARAR una operación con las
// herramientas `preparar_*`: aquí se valida (productos reales, stock, saldo), se arma una
// propuesta legible y se devuelve al navegador. La operación se ejecuta únicamente cuando la
// persona toca "Confirmar", en una llamada nueva que vuelve a comprobar el rol en el servidor
// y usa el token de esa persona (RLS e is_admin() de las RPC siguen aplicando).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// deno-lint-ignore no-explicit-any
type Db = ReturnType<typeof createClient<any, 'public', any>>;

export type ProposalType = 'ADD_TO_CART' | 'CREATE_SALE' | 'CREATE_PURCHASE' | 'REGISTER_ABONO' | 'ADD_STOCK';

export interface Proposal {
  id: string;
  type: ProposalType;
  title: string;
  /** Renglones que la persona revisa antes de confirmar */
  lines: string[];
  total?: number;
  confirmLabel: string;
  /** Se ejecuta en el navegador (carrito), no en el servidor */
  clientSide?: boolean;
  data: Record<string, unknown>;
}

export interface ActionContext {
  supabase: Db; // service role: solo LECTURAS para validar y armar la propuesta
  isAdmin: boolean;
  bcvRate: number;
  proposals: Proposal[];
}

const ADMIN_ONLY = new Set(['preparar_venta', 'preparar_compra', 'preparar_abono', 'preparar_entrada_stock']);
export const ADMIN_EXECUTABLE: ProposalType[] = ['CREATE_SALE', 'CREATE_PURCHASE', 'REGISTER_ABONO', 'ADD_STOCK'];

const PAYMENT_LABELS: Record<string, string> = {
  pago_movil: 'Pago Móvil', transferencia: 'Transferencia Bs', zelle: 'Zelle', binance: 'Binance',
  zinli: 'Zinli', wally: 'Wally', efectivo_usd: 'Efectivo (USD)', efectivo_bs: 'Efectivo (Bs)',
};
const PAYMENT_KEYS = Object.keys(PAYMENT_LABELS);

const money = (n: number) => `$${n.toFixed(2)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
/** Fecha de hoy en Venezuela (UTC-4), no en UTC: a las 8 p. m. el día UTC ya cambió. */
const todayVE = () => new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);

/** Normaliza lo que diga la IA ("pago movil", "zelle", "efectivo") a la clave del sistema. */
function normalizeMethod(raw?: unknown): string | null {
  const t = String(raw ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!t) return null;
  if (PAYMENT_KEYS.includes(t)) return t;
  if (t.includes('movil')) return 'pago_movil';
  if (t.includes('transfer')) return 'transferencia';
  if (t.includes('zelle')) return 'zelle';
  if (t.includes('binance') || t.includes('usdt')) return 'binance';
  if (t.includes('zinli')) return 'zinli';
  if (t.includes('wally')) return 'wally';
  if (t.includes('efectivo') && (t.includes('bs') || t.includes('bolivar'))) return 'efectivo_bs';
  if (t.includes('efectivo') || t.includes('cash') || t.includes('dolar')) return 'efectivo_usd';
  return null;
}

// Declaraciones para Gemini (functionDeclarations, tipos en mayúsculas).
const ITEMS_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      product: { type: 'STRING', description: 'nombre del producto como lo dijo la persona' },
      quantity: { type: 'NUMBER', description: 'unidades (por defecto 1)' },
      unit_price: { type: 'NUMBER', description: 'precio unitario en USD solo si la persona lo dijo; si no, se usa el del catálogo' },
      variant: { type: 'STRING', description: 'talla, tono o presentación si el producto las tiene (ej. "M", "120 Classic Ivory", "50 ml")' },
    },
    required: ['product'],
  },
};

export const ACTION_TOOL_DECLARATIONS = [
  { name: 'preparar_carrito', description: 'Prepara agregar productos al carrito de la clienta (cuando dice "quiero comprar…", "agrégame…", "me llevo…"). No compra: la clienta confirma y luego paga en el checkout.',
    parameters: { type: 'OBJECT', properties: { items: ITEMS_SCHEMA }, required: ['items'] } },
  { name: 'preparar_venta', description: 'SOLO ADMIN. Prepara registrar una venta hecha en persona ("vendí 2 bases a María por pago móvil"). Varios productos en una sola venta. modalidad: "contado" (pagada completa) o "fiado" (queda por cobrar, con abono_inicial opcional).',
    parameters: { type: 'OBJECT', properties: {
      items: ITEMS_SCHEMA,
      client_name: { type: 'STRING' },
      client_phone: { type: 'STRING' },
      payment_method: { type: 'STRING', description: 'pago_movil, transferencia, zelle, binance, zinli, wally, efectivo_usd o efectivo_bs' },
      modalidad: { type: 'STRING', description: 'contado o fiado' },
      abono_inicial: { type: 'NUMBER', description: 'USD pagados hoy en una venta fiada' },
    }, required: ['items'] } },
  { name: 'preparar_compra', description: 'SOLO ADMIN. Prepara registrar una compra a un proveedor ("compré $80 en YesStyle de sérums"). Si el proveedor no existe, se crea al confirmar.',
    parameters: { type: 'OBJECT', properties: {
      provider: { type: 'STRING' },
      amount_usd: { type: 'NUMBER' },
      amount_bs: { type: 'NUMBER' },
      description: { type: 'STRING', description: 'qué se compró' },
      date: { type: 'STRING', description: 'YYYY-MM-DD; por defecto hoy' },
    }, required: ['provider'] } },
  { name: 'preparar_abono', description: 'SOLO ADMIN. Prepara registrar un abono de una clienta a lo que debe por ventas fiadas ("María abonó $20 por Zelle"). Se aplica primero a la deuda más antigua.',
    parameters: { type: 'OBJECT', properties: {
      client_name: { type: 'STRING' },
      amount_usd: { type: 'NUMBER' },
      payment_method: { type: 'STRING' },
    }, required: ['client_name', 'amount_usd'] } },
  { name: 'preparar_entrada_stock', description: 'SOLO ADMIN. Prepara sumar unidades al inventario de un producto que ya existe ("llegaron 10 protectores solares").',
    parameters: { type: 'OBJECT', properties: {
      product: { type: 'STRING' },
      quantity: { type: 'NUMBER' },
      variant: { type: 'STRING', description: 'talla, tono o presentación si el producto las tiene' },
    }, required: ['product', 'quantity'] } },
];

export const isActionTool = (name: string) => name.startsWith('preparar_');

type VariantRow = { id: string; label: string; stock: number; price_usd: number | null; sort_order: number };
type ProductRow = { id: string; name: string; price_usd: number; stock: number; image_url: string | null; product_variants?: VariantRow[] | null };

/** Busca un producto real. Nunca inventa: único, ambiguo (opciones) o no encontrado. */
async function resolveProduct(db: Db, term: string): Promise<{ status: 'ok'; product: ProductRow } | { status: 'ambiguous'; options: string[] } | { status: 'none' }> {
  const clean = term.trim().replace(/[%,()]/g, ' ').replace(/\s+/g, ' ');
  if (!clean) return { status: 'none' };
  const cols = 'id, name, price_usd, stock, image_url, product_variants(id, label, stock, price_usd, sort_order)';
  let { data } = await db.from('products').select(cols).ilike('name', `%${clean}%`).limit(8);
  if (!data?.length) {
    // Todas las palabras, en cualquier orden ("base matte" → "Base líquida matte")
    const words = clean.split(' ').filter(w => w.length > 2);
    if (words.length) {
      let q = db.from('products').select(cols);
      for (const w of words) q = q.ilike('name', `%${w}%`);
      ({ data } = await q.limit(8));
    }
  }
  const rows = (data || []) as ProductRow[];
  if (!rows.length) return { status: 'none' };
  const exact = rows.filter(r => r.name.toLowerCase() === clean.toLowerCase());
  if (exact.length === 1) return { status: 'ok', product: exact[0] };
  if (rows.length === 1) return { status: 'ok', product: rows[0] };
  return { status: 'ambiguous', options: rows.map(r => `${r.name} (${money(Number(r.price_usd))}, ${r.stock} disp.)`) };
}

type RawItem = { product?: unknown; quantity?: unknown; unit_price?: unknown; variant?: unknown };

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/** Resuelve todos los productos de una lista; si alguno falla, devuelve el problema para que la IA pregunte. */
async function resolveItems(db: Db, rawItems: unknown, checkStock: boolean) {
  const items = Array.isArray(rawItems) ? (rawItems as RawItem[]) : [];
  if (!items.length) return { error: { status: 'error', message: 'No entendí qué productos. Pregunta cuáles.' } };
  const resolved: { product: ProductRow; variant: VariantRow | null; quantity: number; unitPrice: number }[] = [];
  for (const it of items) {
    const quantity = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const r = await resolveProduct(db, String(it.product ?? ''));
    if (r.status === 'none') return { error: { status: 'no_encontrado', product: it.product, message: `No encontré "${it.product}" en el catálogo.` } };
    if (r.status === 'ambiguous') return { error: { status: 'ambiguo', product: it.product, options: r.options, message: 'Hay varios productos parecidos: pregunta cuál.' } };
    // Tallas, tonos o presentaciones: cada una tiene su stock y puede tener su precio
    const variants = [...(r.product.product_variants || [])].sort((a, b) => a.sort_order - b.sort_order);
    let variant: VariantRow | null = null;
    if (variants.length === 1) variant = variants[0];
    else if (variants.length > 1) {
      const wanted = norm(String(it.variant ?? ''));
      variant = wanted ? variants.find(v => norm(v.label) === wanted) ?? variants.find(v => norm(v.label).includes(wanted)) ?? null : null;
      if (!variant) {
        return { error: {
          status: 'falta_dato', product: r.product.name,
          options: variants.map(v => `${v.label} (${v.stock} disp., ${money(v.price_usd != null ? Number(v.price_usd) : Number(r.product.price_usd))})`),
          message: `${r.product.name} viene en varias opciones: pregunta cuál quiere.`,
        } };
      }
    }
    const available = variant ? variant.stock : r.product.stock;
    const fullName = variant ? `${r.product.name} (${variant.label})` : r.product.name;
    if (checkStock && available < quantity) {
      return { error: { status: 'sin_stock', product: fullName, disponible: available, message: `Solo hay ${available} unidades de ${fullName}.` } };
    }
    const listPrice = variant && variant.price_usd != null ? Number(variant.price_usd) : Number(r.product.price_usd);
    const price = Number(it.unit_price) > 0 ? Number(it.unit_price) : listPrice;
    resolved.push({ product: r.product, variant, quantity, unitPrice: round2(price) });
  }
  return { resolved };
}

/** Ejecuta una herramienta preparar_*: valida, arma la propuesta y la guarda en ctx.proposals. */
export async function prepareAction(name: string, args: Record<string, unknown>, ctx: ActionContext): Promise<Record<string, unknown>> {
  if (ADMIN_ONLY.has(name) && !ctx.isAdmin) {
    return { status: 'forbidden', message: 'Solo la administración puede registrar operaciones.' };
  }
  const db = ctx.supabase;
  const push = (p: Omit<Proposal, 'id'>) => {
    const proposal = { ...p, id: crypto.randomUUID() };
    ctx.proposals.push(proposal);
    return { status: 'propuesta_lista', resumen: [p.title, ...p.lines].join(' · '), nota: 'Aún NO está hecho: la persona debe tocar el botón para confirmar.' };
  };

  try {
    switch (name) {
      case 'preparar_carrito': {
        const { resolved, error } = await resolveItems(db, args.items, true);
        if (error) return error;
        // En la tienda siempre se cobra el precio de lista (no el que diga la IA)
        const listPrice = (i: typeof resolved[number]) => i.variant && i.variant.price_usd != null ? Number(i.variant.price_usd) : Number(i.product.price_usd);
        const total = round2(resolved!.reduce((s, i) => s + i.quantity * listPrice(i), 0));
        return push({
          type: 'ADD_TO_CART',
          title: 'Agregar al carrito',
          lines: resolved!.map(i => `${i.quantity} × ${i.product.name}${i.variant ? ` (${i.variant.label})` : ''} — ${money(i.quantity * listPrice(i))}`),
          total,
          confirmLabel: 'Agregar al carrito',
          clientSide: true,
          data: {
            items: resolved!.map(i => ({
              id: i.product.id, name: i.product.name, price_usd: listPrice(i),
              quantity: i.quantity, image_url: i.product.image_url, stock: i.variant ? i.variant.stock : i.product.stock,
              variant_id: i.variant?.id ?? null, size: i.variant?.label ?? null,
            })),
          },
        });
      }

      case 'preparar_venta': {
        const { resolved, error } = await resolveItems(db, args.items, true);
        if (error) return error;
        const modality = String(args.modalidad ?? '').toLowerCase().includes('fia') ? 'fiado' : 'contado';
        const method = normalizeMethod(args.payment_method);
        if (modality === 'contado' && !method) {
          return { status: 'falta_dato', message: 'Pregunta con qué método pagó (Pago Móvil, Transferencia, Zelle, Binance, Zinli, Wally o efectivo).' };
        }
        const clientName = String(args.client_name ?? '').trim();
        if (modality === 'fiado' && !clientName) {
          return { status: 'falta_dato', message: 'Una venta fiada necesita el nombre de la clienta. Pregúntalo.' };
        }
        const total = round2(resolved!.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
        const abono = modality === 'fiado' ? Math.min(round2(Number(args.abono_inicial) || 0), total) : total;
        const lines = [
          ...resolved!.map(i => `${i.quantity} × ${i.product.name}${i.variant ? ` (${i.variant.label})` : ''} — ${money(i.quantity * i.unitPrice)}`),
          clientName ? `Cliente: ${clientName}` : 'Cliente: venta de mostrador',
          modality === 'contado'
            ? `Pagado completo por ${PAYMENT_LABELS[method!]}`
            : `Fiado · abona hoy ${money(abono)}${abono > 0 && method ? ` por ${PAYMENT_LABELS[method]}` : ''} · queda ${money(total - abono)}`,
        ];
        if (ctx.bcvRate > 0) lines.push(`Equivale a Bs ${(total * ctx.bcvRate).toFixed(2)} (BCV ${ctx.bcvRate})`);
        return push({
          type: 'CREATE_SALE',
          title: 'Registrar venta',
          lines,
          total,
          confirmLabel: 'Registrar venta',
          data: {
            items: resolved!.map(i => ({
              product_id: i.product.id, name: i.product.name, quantity: i.quantity, unit_price: i.unitPrice,
              variant_id: i.variant?.id ?? null, variant_label: i.variant?.label ?? null,
            })),
            client_name: clientName || null,
            client_phone: String(args.client_phone ?? '').trim() || null,
            payment_method: method,
            modality,
            abono_inicial: modality === 'fiado' ? abono : 0,
          },
        });
      }

      case 'preparar_compra': {
        const provider = String(args.provider ?? '').trim();
        const usd = round2(Number(args.amount_usd) || 0);
        const bsIn = round2(Number(args.amount_bs) || 0);
        const amountUsd = usd > 0 ? usd : bsIn > 0 && ctx.bcvRate > 0 ? round2(bsIn / ctx.bcvRate) : 0;
        if (!provider) return { status: 'falta_dato', message: 'Pregunta a qué proveedor se le compró.' };
        if (amountUsd <= 0) return { status: 'falta_dato', message: 'Pregunta cuánto costó la compra (en $ o en Bs).' };
        const { data: existing } = await db.from('providers').select('id, name').ilike('name', provider).limit(1);
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(args.date ?? '')) ? String(args.date) : todayVE();
        return push({
          type: 'CREATE_PURCHASE',
          title: 'Registrar compra',
          lines: [
            `Proveedor: ${existing?.[0]?.name ?? provider}${existing?.length ? '' : ' (nuevo)'}`,
            `Monto: ${money(amountUsd)}${bsIn > 0 ? ` (Bs ${bsIn.toFixed(2)})` : ''}`,
            args.description ? `Detalle: ${String(args.description)}` : '',
            `Fecha: ${date.split('-').reverse().join('/')}`,
          ].filter(Boolean),
          total: amountUsd,
          confirmLabel: 'Registrar compra',
          data: {
            provider_id: existing?.[0]?.id ?? null,
            provider_name: existing?.[0]?.name ?? provider,
            amount_usd: amountUsd,
            amount_bs: bsIn > 0 ? bsIn : (ctx.bcvRate > 0 ? round2(amountUsd * ctx.bcvRate) : null),
            notes: args.description ? String(args.description).slice(0, 300) : null,
            purchase_date: date,
          },
        });
      }

      case 'preparar_abono': {
        const amount = round2(Number(args.amount_usd) || 0);
        if (amount <= 0) return { status: 'falta_dato', message: 'Pregunta cuánto abonó.' };
        const method = normalizeMethod(args.payment_method);
        if (!method) return { status: 'falta_dato', message: 'Pregunta con qué método pagó el abono.' };
        const term = String(args.client_name ?? '').trim();
        const { data: rows } = await db.from('sales')
          .select('id, sale_group_id, client_name, total_usd, amount_paid, created_at')
          .eq('sale_modality', 'fiado').ilike('client_name', `%${term}%`).limit(500);
        const names = [...new Set(((rows || []) as { client_name: string }[]).map(r => r.client_name))];
        if (!names.length) return { status: 'no_encontrado', message: `No encontré ventas fiadas de "${term}".` };
        if (names.length > 1 && !names.some(n => n.toLowerCase() === term.toLowerCase())) {
          return { status: 'ambiguo', options: names.slice(0, 8), message: 'Hay varias clientas con ese nombre: pregunta cuál.' };
        }
        const name0 = names.find(n => n.toLowerCase() === term.toLowerCase()) ?? names[0];
        const groups = new Map<string, { total: number; paid: number; created: string }>();
        for (const r of (rows || []) as { id: string; sale_group_id: string | null; client_name: string; total_usd: number; amount_paid: number | null; created_at: string }[]) {
          if (r.client_name !== name0) continue;
          const key = r.sale_group_id || r.id;
          const g = groups.get(key) || { total: 0, paid: 0, created: r.created_at };
          g.total += Number(r.total_usd) || 0;
          g.paid += Number(r.amount_paid) || 0;
          if (r.created_at < g.created) g.created = r.created_at;
          groups.set(key, g);
        }
        const open = [...groups.entries()]
          .map(([id, g]) => ({ id, balance: round2(g.total - g.paid), created: g.created }))
          .filter(g => g.balance > 0.009)
          .sort((a, b) => a.created.localeCompare(b.created));
        const debt = round2(open.reduce((s, g) => s + g.balance, 0));
        if (!open.length) return { status: 'sin_deuda', message: `${name0} no tiene saldo pendiente.` };
        if (amount > debt + 0.01) return { status: 'excede', message: `${name0} debe ${money(debt)}; el abono de ${money(amount)} es mayor. Pregunta el monto correcto.` };
        // Reparte el abono desde la deuda más antigua
        let left = amount;
        const allocations: { sale_group_id: string; amount_usd: number }[] = [];
        for (const g of open) {
          if (left <= 0.009) break;
          const a = round2(Math.min(left, g.balance));
          allocations.push({ sale_group_id: g.id, amount_usd: a });
          left = round2(left - a);
        }
        return push({
          type: 'REGISTER_ABONO',
          title: 'Registrar abono',
          lines: [
            `Cliente: ${name0}`,
            `Abono: ${money(amount)} por ${PAYMENT_LABELS[method]}`,
            `Debía ${money(debt)} · queda ${money(round2(debt - amount))}`,
            allocations.length > 1 ? `Se aplica a ${allocations.length} ventas, empezando por la más antigua` : '',
          ].filter(Boolean),
          total: amount,
          confirmLabel: 'Registrar abono',
          data: { client_name: name0, payment_method: method, allocations },
        });
      }

      case 'preparar_entrada_stock': {
        const quantity = Math.floor(Number(args.quantity) || 0);
        if (quantity <= 0) return { status: 'falta_dato', message: 'Pregunta cuántas unidades llegaron.' };
        const r = await resolveProduct(db, String(args.product ?? ''));
        if (r.status === 'none') return { status: 'no_encontrado', message: `No encontré "${args.product}". Si es nuevo, créalo en Productos.` };
        if (r.status === 'ambiguous') return { status: 'ambiguo', options: r.options, message: 'Pregunta cuál producto.' };
        // Con tallas, tonos o presentaciones las unidades entran a una de ellas
        const variants = [...(r.product.product_variants || [])].sort((a, b) => a.sort_order - b.sort_order);
        let variant: VariantRow | null = variants.length === 1 ? variants[0] : null;
        if (variants.length > 1) {
          const wanted = norm(String(args.variant ?? ''));
          variant = wanted ? variants.find(v => norm(v.label) === wanted) ?? variants.find(v => norm(v.label).includes(wanted)) ?? null : null;
          if (!variant) return { status: 'falta_dato', options: variants.map(v => `${v.label} (${v.stock} disp.)`), message: `Pregunta a cuál opción de ${r.product.name} entran las unidades.` };
        }
        const current = variant ? variant.stock : r.product.stock;
        return push({
          type: 'ADD_STOCK',
          title: 'Sumar al inventario',
          lines: [`${r.product.name}${variant ? ` (${variant.label})` : ''}`, `+${quantity} unidades · quedaría en ${current + quantity}`],
          confirmLabel: 'Sumar al inventario',
          data: { product_id: r.product.id, name: r.product.name, quantity, variant_id: variant?.id ?? null, variant_label: variant?.label ?? null },
        });
      }

      default:
        return { status: 'error', message: `Herramienta desconocida: ${name}` };
    }
  } catch (err) {
    console.error(`Action tool ${name} error:`, err);
    return { status: 'error', message: 'No pude preparar esa operación en este momento.' };
  }
}

// ================== EJECUCIÓN (solo tras "Confirmar") ==================

export interface ExecuteContext {
  /** Cliente con el token de la persona: RLS e is_admin() aplican */
  userDb: Db;
  userId: string;
  bcvRate: number;
}

const num = (v: unknown) => Number(v) || 0;

export async function executeConfirmedAction(type: string, data: Record<string, unknown>, ctx: ExecuteContext): Promise<{ success: boolean; message: string; detail?: Record<string, unknown> }> {
  const db = ctx.userDb;
  try {
    switch (type) {
      case 'CREATE_SALE': {
        const items = (Array.isArray(data.items) ? data.items : []) as { product_id: string; name: string; quantity: number; unit_price: number; variant_id?: string | null; variant_label?: string | null }[];
        if (!items.length) return { success: false, message: 'La venta no tiene productos.' };
        const modality = data.modality === 'fiado' ? 'fiado' : 'contado';
        const method = normalizeMethod(data.payment_method) ?? 'efectivo_usd';
        // Revalidar stock actual antes de escribir nada (evita ventas a medias)
        const ids = items.map(i => i.product_id);
        const { data: stockRows, error: stockErr } = await db.from('products').select('id, name, stock, product_variants(id, label, stock)').in('id', ids);
        if (stockErr) throw stockErr;
        for (const it of items) {
          const row = (stockRows || []).find((r: { id: string }) => r.id === it.product_id) as { stock: number; name: string; product_variants?: { id: string; label: string; stock: number }[] } | undefined;
          if (!row) return { success: false, message: `El producto ${it.name} ya no existe.` };
          const v = it.variant_id ? row.product_variants?.find(x => x.id === it.variant_id) : null;
          if (it.variant_id && !v) return { success: false, message: `La opción ${it.variant_label} de ${row.name} ya no existe.` };
          const left = v ? v.stock : row.stock;
          if (left < num(it.quantity)) return { success: false, message: `Ya no hay suficiente ${row.name}${v ? ` (${v.label})` : ''} (quedan ${left}).` };
        }
        const groupId = crypto.randomUUID();
        const rate = ctx.bcvRate > 0 ? ctx.bcvRate : null;
        let total = 0;
        for (const it of items) {
          const qty = Math.max(1, Math.floor(num(it.quantity)));
          const lineTotal = round2(qty * num(it.unit_price));
          total += lineTotal;
          const { data: sale, error } = await db.from('sales').insert({
            product_id: it.product_id,
            product_name: it.variant_label ? `${it.name} (${it.variant_label})` : it.name,
            variant_id: it.variant_id || null,
            variant_label: it.variant_label || null,
            quantity: qty,
            unit_price_usd: num(it.unit_price),
            total_usd: lineTotal,
            total_bs: rate ? round2(lineTotal * rate) : null,
            payment_method: method,
            client_name: (data.client_name as string) || null,
            client_phone: (data.client_phone as string) || null,
            is_credit: modality === 'fiado',
            sale_modality: modality,
            sale_group_id: groupId,
            amount_paid: modality === 'contado' ? lineTotal : 0,
            payment_status: modality === 'contado' ? 'paid' : 'pending',
            status: 'pending',
            notes: '[Registrada por la asistente]',
            user_id: ctx.userId,
          }).select('id').single();
          if (error) throw error;
          const { error: confirmErr } = await db.rpc('confirm_pos_sale', { p_sale_id: (sale as { id: string }).id });
          if (confirmErr) throw confirmErr;
        }
        total = round2(total);
        const abono = modality === 'fiado' ? Math.min(num(data.abono_inicial), total) : 0;
        if (abono > 0) {
          const { error } = await db.rpc('process_group_abono', {
            p_sale_group_id: groupId, p_amount_usd: abono, p_amount_bs: rate ? round2(abono * rate) : null,
            p_exchange_rate: rate, p_usdt_rate: null, p_usdt_bought: null, p_payment_method: method,
            p_notes: 'Abono inicial (asistente)',
          });
          if (error) throw error;
        }
        const who = data.client_name ? ` a ${data.client_name}` : '';
        return {
          success: true,
          message: modality === 'contado'
            ? `✅ Venta registrada${who} por ${money(total)}. El inventario ya se actualizó.`
            : `✅ Venta fiada registrada${who} por ${money(total)}${abono > 0 ? ` con abono de ${money(abono)}` : ''}. Queda por cobrar ${money(round2(total - abono))}.`,
          detail: { sale_group_id: groupId, total },
        };
      }

      case 'CREATE_PURCHASE': {
        let providerId = (data.provider_id as string) || null;
        const providerName = String(data.provider_name ?? '').trim();
        if (!providerName) return { success: false, message: 'Falta el proveedor.' };
        if (!providerId) {
          const { data: found } = await db.from('providers').select('id').ilike('name', providerName).limit(1);
          providerId = (found?.[0] as { id: string } | undefined)?.id ?? null;
          if (!providerId) {
            const { data: created, error } = await db.from('providers').insert({ name: providerName, user_id: ctx.userId }).select('id').single();
            if (error) throw error;
            providerId = (created as { id: string }).id;
          }
        }
        const amount = round2(num(data.amount_usd));
        if (amount <= 0) return { success: false, message: 'El monto de la compra debe ser mayor a cero.' };
        const { error } = await db.from('purchases').insert({
          provider_id: providerId,
          provider_name: providerName,
          amount_usd: amount,
          amount_bs: data.amount_bs != null ? num(data.amount_bs) : null,
          purchase_date: String(data.purchase_date || todayVE()),
          status: 'paid',
          notes: (data.notes as string) || null,
          user_id: ctx.userId,
        });
        if (error) throw error;
        return { success: true, message: `✅ Compra a ${providerName} registrada por ${money(amount)}.` };
      }

      case 'REGISTER_ABONO': {
        const allocations = (Array.isArray(data.allocations) ? data.allocations : []) as { sale_group_id: string; amount_usd: number }[];
        if (!allocations.length) return { success: false, message: 'No hay a qué aplicar el abono.' };
        const method = normalizeMethod(data.payment_method) ?? 'efectivo_usd';
        const rate = ctx.bcvRate > 0 ? ctx.bcvRate : null;
        let applied = 0;
        for (const a of allocations) {
          const amt = round2(num(a.amount_usd));
          if (amt <= 0) continue;
          const { error } = await db.rpc('process_group_abono', {
            p_sale_group_id: a.sale_group_id, p_amount_usd: amt, p_amount_bs: rate ? round2(amt * rate) : null,
            p_exchange_rate: rate, p_usdt_rate: null, p_usdt_bought: null, p_payment_method: method,
            p_notes: 'Abono registrado por la asistente',
          });
          if (error) {
            if (applied > 0) return { success: false, message: `Se aplicaron ${money(applied)}, pero falló el resto: ${error.message}` };
            throw error;
          }
          applied = round2(applied + amt);
        }
        return { success: true, message: `✅ Abono de ${money(applied)} registrado a ${data.client_name}.` };
      }

      case 'ADD_STOCK': {
        const qty = Math.floor(num(data.quantity));
        if (qty <= 0) return { success: false, message: 'La cantidad debe ser mayor a cero.' };
        if (data.variant_id) {
          const { data: v, error: vErr } = await db.from('product_variants').select('stock, label').eq('id', data.variant_id as string).single();
          if (vErr || !v) return { success: false, message: 'No encontré esa opción del producto.' };
          const nextV = num((v as { stock: number }).stock) + qty;
          const { error } = await db.from('product_variants').update({ stock: nextV, updated_at: new Date().toISOString() }).eq('id', data.variant_id as string);
          if (error) throw error;
          return { success: true, message: `✅ ${data.name} (${(v as { label: string }).label}): ahora hay ${nextV} unidades.` };
        }
        const { data: row, error: readErr } = await db.from('products').select('stock, name').eq('id', data.product_id as string).single();
        if (readErr || !row) return { success: false, message: 'No encontré el producto.' };
        const next = num((row as { stock: number }).stock) + qty;
        const { error } = await db.from('products').update({ stock: next, updated_at: new Date().toISOString() }).eq('id', data.product_id as string);
        if (error) throw error;
        return { success: true, message: `✅ ${(row as { name: string }).name}: ahora hay ${next} unidades.` };
      }

      default:
        return { success: false, message: 'Acción desconocida.' };
    }
  } catch (err) {
    console.error(`Execute ${type} error:`, err);
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
    return { success: false, message: `No se pudo completar: ${msg || 'error inesperado'}.` };
  }
}
