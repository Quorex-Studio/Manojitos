import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BRAND, BRAND_FILE_SLUG } from '@/config/brand';
import { PDF, PDF_PAGE_TOP, PDF_TABLE_MARGIN, type RGB, drawInfoBox, drawPdfFooter, drawRunningHeader, drawPdfHeader, drawSectionTitle, drawTiles, pdfBs as bs, pdfLastY, pdfLongDate as longDate, pdfMoney as money, pdfShortDate as shortDate, tint } from '@/lib/pdfBrand';
import { localDateISO } from '@/lib/dates';
import { paymentLabel, receiptNumber } from '@/lib/receipt';
import { formatPhone } from '@/lib/venezuela';

/**
 * Reporte de Cuentas por Cobrar (estado de cuenta estilo factura).
 *
 * Un solo armado de datos alimenta el PDF del módulo Por cobrar (Ventas) y el que entrega la
 * asistente (Ina / Ángela), así los dos dicen siempre lo mismo que la pantalla:
 * - Una "factura" es una venta del panel: sus líneas se agrupan por `sale_group_id` (o `id`).
 * - Debe si total − abonado > 0,009. Las ventas anuladas (`status = cancelled`) no cuentan.
 * - Las clientas se agrupan por nombre normalizado (igual que las tarjetas de Por cobrar).
 * - Antigüedad por factura (días desde la venta): 0–15, 16–30, 31–60 y más de 60.
 */

/** Línea de venta mínima que necesita el reporte (subconjunto de `Sale`). */
export interface ReceivableSaleRow {
  id: string;
  product_id?: string | null;
  sale_group_id: string | null;
  client_name: string | null;
  client_phone?: string | null;
  product_name: string;
  variant_label?: string | null;
  /** Categoría del producto (se completa desde `products`); vacío = "Sin categoría" */
  category?: string | null;
  quantity: number;
  total_usd: number | string | null;
  amount_paid: number | string | null;
  total_bs?: number | string | null;
  sale_modality?: string | null;
  payment_method?: string | null;
  status?: string | null;
  created_at: string;
}

/** Abono registrado (`sale_payments`). Los anulados (`status = void`) se ignoran. */
export interface ReceivablePaymentRow {
  sale_id: string | null;
  sale_group_id: string | null;
  amount_usd: number | string;
  amount_bs?: number | string | null;
  payment_method?: string | null;
  status?: string | null;
  created_at: string;
}

export interface ReceivableInvoice {
  id: string;
  number: string;
  date: Date;
  days: number;
  modality: string;
  items: { name: string; quantity: number; total: number }[];
  units: number;
  total: number;
  paid: number;
  balance: number;
  payments: { date: Date; amount: number; method: string; amountBs: number | null }[];
}

export interface ReceivableClient {
  key: string;
  name: string;
  phone: string | null;
  invoices: ReceivableInvoice[];
  units: number;
  total: number;
  paid: number;
  balance: number;
  oldestDays: number;
  lastDate: Date;
}

/** Deuda de una categoría de producto, con una fila por clienta. */
export interface ReceivableCategory {
  name: string;
  units: number;
  total: number;
  paid: number;
  balance: number;
  /** % ya cobrado de lo facturado en la categoría (0–100) */
  collectedPct: number;
  rows: { name: string; units: number; total: number; paid: number; balance: number }[];
  /** Clientas que no han abonado nada en esta categoría */
  unpaidCount: number;
}

/** Lectura automática del reporte: a quién cobrar primero y cómo va la cobranza. */
export interface ReceivablesInsights {
  priority: { name: string; balance: number; units: number; paidPct: number; oldestDays: number }[];
  partial: { count: number; names: string[] };
  unpaid: { count: number; amount: number };
  overdue: { count: number; amount: number };
  overTen: { count: number; amount: number };
}

export interface AgingBucket {
  label: string;
  hint: string;
  amount: number;
  count: number;
}

export interface ReceivablesReport {
  number: string;
  generatedAt: Date;
  /** Nombre de la clienta si es un estado de cuenta individual */
  clientFilter: string | null;
  clients: ReceivableClient[];
  categories: ReceivableCategory[];
  totals: { total: number; paid: number; balance: number; units: number; invoices: number; clients: number; averageDays: number };
  aging: AgingBucket[];
  insights: ReceivablesInsights;
  /** Cómo se agrupa el detalle del PDF */
  groupBy: 'clienta' | 'categoria';
  /** Tasa BCV del día (Bs por USD) para mostrar el equivalente; null = no se muestra */
  rate: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => Number(v) || 0;
export const normalizeClientKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const DAY = 86_400_000;

/** Días calendario entre la venta y el corte (por fecha local, no por horas). */
const daysBetween = (from: Date, to: Date) => {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.max(0, Math.round((b - a) / DAY));
};

export const AGING_RANGES = [
  { label: '0–15 días', hint: 'Reciente', max: 15 },
  { label: '16–30 días', hint: 'Por vencer', max: 30 },
  { label: '31–60 días', hint: 'Atrasada', max: 60 },
  { label: 'Más de 60 días', hint: 'Muy atrasada', max: Infinity },
] as const;

export const agingIndex = (days: number) => AGING_RANGES.findIndex(r => days <= r.max);

export interface BuildReportOptions {
  now?: Date;
  /** Solo esta clienta (se compara por nombre normalizado) */
  clientName?: string | null;
  rate?: number | null;
  /** Orden de las clientas: por saldo (por defecto), antigüedad o nombre */
  sort?: 'saldo' | 'antiguedad' | 'clienta';
  /** Detalle por clienta (facturas y abonos) o por categoría de producto */
  groupBy?: 'clienta' | 'categoria';
}

export const NO_CATEGORY = 'Sin categoría';
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** Estado de cobro de una cuenta: "Sin abono", "Abonó 40%" o "Pagada". */
export function paymentState(paid: number, total: number): { label: string; tone: 'none' | 'partial' | 'paid' } {
  if (total <= 0 || paid >= total - 0.009) return { label: 'Pagada', tone: 'paid' };
  if (paid <= 0.009) return { label: 'Sin abono', tone: 'none' };
  return { label: `Abonó ${Math.round((paid / total) * 100)}%`, tone: 'partial' };
}

export function buildReceivablesReport(
  sales: ReceivableSaleRow[],
  payments: ReceivablePaymentRow[] = [],
  opts: BuildReportOptions = {},
): ReceivablesReport {
  const now = opts.now ?? new Date();
  const onlyKey = opts.clientName ? normalizeClientKey(opts.clientName) : null;

  // 1) Facturas: líneas agrupadas por venta
  const groups = new Map<string, { rows: ReceivableSaleRow[]; total: number; paid: number }>();
  for (const s of sales) {
    if (s.status === 'cancelled') continue;
    const key = s.sale_group_id || s.id;
    const g = groups.get(key) ?? { rows: [], total: 0, paid: 0 };
    g.rows.push(s);
    g.total += num(s.total_usd);
    g.paid += num(s.amount_paid);
    groups.set(key, g);
  }

  // 2) Abonos por factura (por grupo o, si no tiene, por línea)
  const lineToGroup = new Map<string, string>();
  groups.forEach((g, key) => g.rows.forEach(r => lineToGroup.set(r.id, key)));
  const paymentsByGroup = new Map<string, ReceivableInvoice['payments']>();
  for (const p of payments) {
    if (p.status === 'void') continue;
    const key = (p.sale_group_id && groups.has(p.sale_group_id) ? p.sale_group_id : null) ?? (p.sale_id ? lineToGroup.get(p.sale_id) : undefined);
    if (!key) continue;
    const list = paymentsByGroup.get(key) ?? [];
    list.push({ date: new Date(p.created_at), amount: round2(num(p.amount_usd)), method: paymentLabel(p.payment_method), amountBs: p.amount_bs ? num(p.amount_bs) : null });
    paymentsByGroup.set(key, list);
  }

  // 3) Clientas (y, de paso, sus líneas por categoría)
  const clients = new Map<string, ReceivableClient>();
  const categoryLines = new Map<string, Map<string, { name: string; units: number; total: number; paid: number }>>();
  groups.forEach((g, key) => {
    const balance = round2(g.total - g.paid);
    if (balance <= 0.009) return;
    const first = [...g.rows].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    const name = (g.rows.find(r => r.client_name?.trim())?.client_name ?? '').trim().replace(/\s+/g, ' ') || 'Cliente sin nombre';
    const clientKey = normalizeClientKey(name);
    if (onlyKey && clientKey !== onlyKey) return;
    const date = new Date(first.created_at);
    const items = new Map<string, { name: string; quantity: number; total: number }>();
    for (const r of g.rows) {
      const label = r.variant_label ? `${r.product_name} (${r.variant_label})` : r.product_name;
      const it = items.get(label) ?? { name: label, quantity: 0, total: 0 };
      it.quantity += num(r.quantity);
      it.total = round2(it.total + num(r.total_usd));
      items.set(label, it);
    }
    const invoice: ReceivableInvoice = {
      id: key,
      number: receiptNumber(key),
      date,
      days: daysBetween(date, now),
      modality: first.sale_modality || '',
      items: [...items.values()],
      units: g.rows.reduce((n, r) => n + num(r.quantity), 0),
      total: round2(g.total),
      paid: round2(g.paid),
      balance,
      payments: (paymentsByGroup.get(key) ?? []).sort((a, b) => a.date.getTime() - b.date.getTime()),
    };
    const c = clients.get(clientKey) ?? { key: clientKey, name, phone: null, invoices: [], units: 0, total: 0, paid: 0, balance: 0, oldestDays: 0, lastDate: date };
    c.invoices.push(invoice);
    c.units += invoice.units;
    // Líneas de esta factura por categoría (para el detalle y el balance por categoría)
    for (const r of g.rows) {
      const cat = r.category?.trim() || NO_CATEGORY;
      const e = categoryLines.get(cat) ?? new Map<string, { name: string; units: number; total: number; paid: number }>();
      const row = e.get(clientKey) ?? { name, units: 0, total: 0, paid: 0 };
      row.units += num(r.quantity);
      row.total += num(r.total_usd);
      row.paid += num(r.amount_paid);
      e.set(clientKey, row);
      categoryLines.set(cat, e);
    }
    c.total = round2(c.total + invoice.total);
    c.paid = round2(c.paid + invoice.paid);
    c.balance = round2(c.balance + invoice.balance);
    c.oldestDays = Math.max(c.oldestDays, invoice.days);
    if (date > c.lastDate) c.lastDate = date;
    c.phone ||= g.rows.find(r => r.client_phone)?.client_phone ?? null;
    clients.set(clientKey, c);
  });

  const list = [...clients.values()].map(c => ({ ...c, invoices: c.invoices.sort((a, b) => a.date.getTime() - b.date.getTime()) }));
  list.sort((a, b) => {
    if (opts.sort === 'antiguedad') return b.oldestDays - a.oldestDays || b.balance - a.balance;
    if (opts.sort === 'clienta') return a.name.localeCompare(b.name, 'es');
    return b.balance - a.balance;
  });

  const invoices = list.flatMap(c => c.invoices);
  const aging: AgingBucket[] = AGING_RANGES.map(r => ({ label: r.label, hint: r.hint, amount: 0, count: 0 }));
  for (const inv of invoices) {
    const b = aging[agingIndex(inv.days)];
    b.amount = round2(b.amount + inv.balance);
    b.count += 1;
  }
  const balance = round2(list.reduce((s, c) => s + c.balance, 0));
  // Días promedio ponderados por saldo: cuánto tarda, en promedio, cada dólar que se debe
  const averageDays = balance > 0 ? Math.round(invoices.reduce((s, i) => s + i.days * i.balance, 0) / balance) : 0;

  // 4) Categorías: una fila por clienta con saldo en esa categoría, de mayor a menor saldo
  const categories: ReceivableCategory[] = [...categoryLines.entries()].map(([catName, byClient]) => {
    const rows = [...byClient.values()]
      .map(r => ({ name: r.name, units: r.units, total: round2(r.total), paid: round2(r.paid), balance: round2(r.total - r.paid) }))
      .filter(r => r.balance > 0.009)
      .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'es'));
    const total = round2(rows.reduce((t, r) => t + r.total, 0));
    const paid = round2(rows.reduce((t, r) => t + r.paid, 0));
    return {
      name: catName, rows, total, paid, balance: round2(total - paid),
      units: rows.reduce((n, r) => n + r.units, 0),
      collectedPct: pct(paid, total),
      unpaidCount: rows.filter(r => r.paid <= 0.009).length,
    };
  }).filter(c => c.rows.length > 0)
    .sort((a, b) => (a.name === NO_CATEGORY ? 1 : b.name === NO_CATEGORY ? -1 : b.balance - a.balance));

  // 5) Lectura automática
  const partial = list.filter(c => c.paid > 0.009);
  const unpaid = list.filter(c => c.paid <= 0.009);
  const overdue = list.filter(c => c.oldestDays > 30);
  const overTen = list.filter(c => c.balance > 10);
  const insights: ReceivablesInsights = {
    priority: [...list].sort((a, b) => b.balance - a.balance).slice(0, 3)
      .map(c => ({ name: c.name, balance: c.balance, units: c.units, paidPct: Math.round(pct(c.paid, c.total)), oldestDays: c.oldestDays })),
    partial: { count: partial.length, names: partial.map(c => c.name) },
    unpaid: { count: unpaid.length, amount: round2(unpaid.reduce((t, c) => t + c.balance, 0)) },
    overdue: { count: overdue.length, amount: round2(overdue.reduce((t, c) => t + c.balance, 0)) },
    overTen: { count: overTen.length, amount: round2(overTen.reduce((t, c) => t + c.balance, 0)) },
  };

  const stamp = `${localDateISO(now).replace(/-/g, '')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return {
    number: `CXC-${stamp}`,
    generatedAt: now,
    clientFilter: opts.clientName ? (list[0]?.name ?? opts.clientName) : null,
    clients: list,
    categories,
    insights,
    groupBy: opts.groupBy ?? 'clienta',
    totals: {
      total: round2(list.reduce((s, c) => s + c.total, 0)),
      paid: round2(list.reduce((s, c) => s + c.paid, 0)),
      balance,
      units: list.reduce((n, c) => n + c.units, 0),
      invoices: invoices.length,
      clients: list.length,
      averageDays,
    },
    aging,
    rate: opts.rate && opts.rate > 0 ? opts.rate : null,
  };
}

export const receivablesFileName = (r: ReceivablesReport) => {
  const who = r.clientFilter ? `_${r.clientFilter.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}` : '';
  return `cuentas_por_cobrar_${BRAND_FILE_SLUG}${who}_${localDateISO(r.generatedAt)}.pdf`;
};

/** Texto corto para WhatsApp o para acompañar el PDF. */
export function receivablesSummaryText(r: ReceivablesReport): string {
  const top = r.clients.slice(0, 5).map(c => `• ${c.name}: ${money(c.balance)} (${c.invoices.length} ${c.invoices.length === 1 ? 'factura' : 'facturas'})`);
  return [
    `*${BRAND.name} · ${r.clientFilter ? `Estado de cuenta de ${r.clientFilter}` : 'Cuentas por cobrar'}*`,
    `Corte: ${longDate(r.generatedAt)}`,
    `*Total por cobrar: ${money(r.totals.balance)}*${r.rate ? ` (${bs(r.totals.balance * r.rate)})` : ''}`,
    `${r.totals.clients} ${r.totals.clients === 1 ? 'clienta' : 'clientas'} · ${r.totals.invoices} ${r.totals.invoices === 1 ? 'factura' : 'facturas'} · ${r.totals.units} ${r.totals.units === 1 ? 'unidad' : 'unidades'}`,
    ...(r.clientFilter ? [] : [`Con abono parcial: ${r.insights.partial.count} · Sin abonos: ${r.insights.unpaid.count} (${money(r.insights.unpaid.amount)})`, ...top]),
  ].join('\n');
}

// ─────────────────────────────── PDF ───────────────────────────────

const { ink: INK, muted: MUTED, line: LINE, cream: CREAM, canvas: CANVAS, copper: COPPER, success: SUCCESS, danger: DANGER } = PDF;
/** Color de cada tramo de antigüedad: de tranquilo a urgente */
const AMBER: RGB = [196, 146, 60];
const AGING_COLORS: RGB[] = [SUCCESS, AMBER, COPPER, DANGER];
type PayState = ReturnType<typeof paymentState>;
/** Saldo en rojo si no abonó nada, cobre si abonó una parte; abonado en verde si hubo pago. */
const balanceColor = (st: PayState): RGB => (st.tone === 'none' ? DANGER : st.tone === 'partial' ? COPPER : SUCCESS);
const BADGE: Record<PayState['tone'], { fill: RGB; text: RGB }> = {
  none: { fill: tint(DANGER, 0.1), text: DANGER },
  partial: { fill: tint(AMBER, 0.22), text: COPPER },
  paid: { fill: tint(SUCCESS, 0.12), text: SUCCESS },
};

/**
 * Hooks de autoTable para una columna "Estado" con etiqueta (pastilla) y para pintar Abonado
 * y Saldo según el estado de cada fila. `stateOf` devuelve null en filas sin estado (abonos).
 */
function stateColumns(doc: jsPDF, stateOf: (row: number) => PayState | null, cols: { paid: number; balance: number; state: number }) {
  return {
    didParseCell: (data: { section: string; row: { index: number }; column: { index: number }; cell: { text: string[]; styles: { textColor: unknown; fontStyle: unknown } } }) => {
      if (data.section !== 'body') return;
      const st = stateOf(data.row.index);
      if (!st) return;
      if (data.column.index === cols.paid && st.tone !== 'none') data.cell.styles.textColor = SUCCESS;
      if (data.column.index === cols.balance) { data.cell.styles.textColor = balanceColor(st); data.cell.styles.fontStyle = 'bold'; }
      if (data.column.index === cols.state) data.cell.text = [''];
    },
    didDrawCell: (data: { section: string; row: { index: number }; column: { index: number }; cell: { x: number; y: number; width: number; height: number } }) => {
      if (data.section !== 'body' || data.column.index !== cols.state) return;
      const st = stateOf(data.row.index);
      if (!st) return;
      const { fill, text } = BADGE[st.tone];
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      const w = doc.getTextWidth(st.label) + 5;
      const h = 4.6;
      const x = data.cell.x + (data.cell.width - w) / 2;
      const y = data.cell.y + (data.cell.height - h) / 2;
      doc.setFillColor(...fill);
      doc.roundedRect(x, y, w, h, 1.4, 1.4, 'F');
      doc.setTextColor(...text);
      doc.text(st.label, x + w / 2, y + 3.2, { align: 'center' });
    },
  };
}

export function buildReceivablesPdf(r: ReceivablesReport): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = PDF.margin;
  const brand = PDF.brand;
  const single = !!r.clientFilter;
  const title = single ? 'Estado de cuenta' : 'Cuentas por cobrar';

  let y = drawPdfHeader(doc, title, r.number, r.generatedAt);

  // ── Bloque "Para / Corte" (como el encabezado de una factura) ───────
  const colW = (W - M * 2 - 6) / 2;
  const infoBox = (x: number, label: string, lines: string[]) => drawInfoBox(doc, x, y, colW, label, lines);
  const client = single ? r.clients[0] : null;
  infoBox(M, single ? 'Clienta' : 'Alcance', single
    ? [r.clientFilter ?? '', client?.phone ? `Teléfono: ${formatPhone(client.phone)}` : 'Sin teléfono registrado', `${client?.invoices.length ?? 0} ${client?.invoices.length === 1 ? 'factura pendiente' : 'facturas pendientes'}`]
    : ['Todas las clientas con saldo', `${r.totals.clients} ${r.totals.clients === 1 ? 'clienta' : 'clientas'} · ${r.totals.invoices} ${r.totals.invoices === 1 ? 'factura' : 'facturas'}`, 'Ventas fiadas, en 2 partes y financiadas']);
  infoBox(M + colW + 6, 'Corte', [
    longDate(r.generatedAt),
    r.rate ? `Tasa BCV: ${bs(r.rate)} por $1` : 'Montos en dólares (USD)',
    `Antigüedad promedio: ${r.totals.averageDays} ${r.totals.averageDays === 1 ? 'día' : 'días'}`,
  ]);
  y += 31;

  // ── Resumen: el número que importa primero ──────────────────────────
  const tiles: { label: string; value: string; sub?: string; accent?: boolean }[] = [
    { label: 'Total por cobrar', value: money(r.totals.balance), sub: [r.totals.total > 0 ? `${pct(r.totals.balance, r.totals.total)}% pendiente` : '', r.rate ? bs(r.totals.balance * r.rate) : ''].filter(Boolean).join(' · ') || undefined, accent: true },
    { label: 'Facturado', value: money(r.totals.total), sub: `${r.totals.units} ${r.totals.units === 1 ? 'unidad' : 'unidades'} · ${r.totals.clients} ${r.totals.clients === 1 ? 'clienta' : 'clientas'}` },
    { label: 'Abonado (recaudado)', value: money(r.totals.paid), sub: r.totals.total > 0 ? `${pct(r.totals.paid, r.totals.total)}% ya cobrado` : undefined },
  ];
  y = drawTiles(doc, y, tiles);

  // ── Antigüedad de la deuda: barra apilada + leyenda ─────────────────
  y = drawSectionTitle(doc, y, 'Antigüedad de la deuda', 'Días desde cada venta hasta hoy. Mientras más a la derecha, más urgente cobrar.');
  const barW = W - M * 2;
  let bx = M;
  const total = r.totals.balance || 1;
  doc.setFillColor(...LINE);
  doc.roundedRect(M, y, barW, 5, 2.5, 2.5, 'F');
  r.aging.forEach((b, i) => {
    if (b.amount <= 0) return;
    const w = Math.max(1.5, (b.amount / total) * barW);
    doc.setFillColor(...AGING_COLORS[i]);
    doc.rect(bx, y, Math.min(w, M + barW - bx), 5, 'F');
    bx += w;
  });
  y += 9;
  const legW = barW / 4;
  r.aging.forEach((b, i) => {
    const x = M + i * legW;
    doc.setFillColor(...AGING_COLORS[i]);
    doc.circle(x + 1.5, y - 1, 1.3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(`${b.label}`, x + 4.5, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${money(b.amount)} · ${b.count} fact.`, x + 4.5, y + 4.5);
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(`${b.hint} · ${Math.round((b.amount / total) * 100)}%`, x + 4.5, y + 8.5);
  });
  y += 15;

  if (r.clients.length === 0) {
    doc.setFillColor(...tint(SUCCESS, 0.12));
    doc.roundedRect(M, y, barW, 18, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...SUCCESS);
    doc.text(single ? `${r.clientFilter} no tiene saldo pendiente.` : 'Todo está al día: no hay cuentas por cobrar.', W / 2, y + 11, { align: 'center' });
    y += 24;
  }

  const head = { fillColor: brand, textColor: [255, 255, 255] as RGB, fontStyle: 'bold' as const, fontSize: 8 };
  const foot = { fillColor: CREAM, textColor: INK, fontStyle: 'bold' as const, fontSize: 8.5 };
  const lastY = () => pdfLastY(doc);

  // ── Resumen por clienta (solo en el reporte general) ────────────────
  if (!single && r.clients.length > 0) {
    const clientState = r.clients.map(c => paymentState(c.paid, c.total));
    const summaryState = stateColumns(doc, i => clientState[i] ?? null, { paid: 5, balance: 6, state: 8 });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text('Resumen por clienta', M, y);
    autoTable(doc, {
      startY: y + 3,
      margin: PDF_TABLE_MARGIN,
      head: [['#', 'Clienta', 'Teléfono', 'Uds.', 'Facturado', 'Abonado', 'Saldo', 'Días', 'Estado']],
      body: r.clients.map((c, i) => [
        String(i + 1), c.name, c.phone ? formatPhone(c.phone) : '—', String(c.units),
        money(c.total), money(c.paid), money(c.balance), `${c.oldestDays} d`, '',
      ]),
      foot: [['', 'TOTAL', '', String(r.totals.units), money(r.totals.total), money(r.totals.paid), money(r.totals.balance), '', `${pct(r.totals.paid, r.totals.total)}% cobrado`]],
      headStyles: head,
      footStyles: foot,
      showFoot: 'lastPage',
      styles: { fontSize: 8, cellPadding: 2.4, textColor: INK, lineColor: LINE, lineWidth: 0.1 },
      alternateRowStyles: { fillColor: CANVAS },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center', textColor: MUTED },
        1: { fontStyle: 'bold' },
        2: { cellWidth: 25 },
        3: { halign: 'center', cellWidth: 11 },
        4: { halign: 'right', cellWidth: 21 }, 5: { halign: 'right', cellWidth: 20 },
        6: { halign: 'right', cellWidth: 21 },
        7: { halign: 'center', cellWidth: 12 },
        8: { halign: 'center', cellWidth: 22 },
      },
      didParseCell: (data) => {
        summaryState.didParseCell(data as never);
        // "Días" (la factura más antigua) toma el color de su tramo
        if (data.section === 'body' && data.column.index === 7) {
          const c = r.clients[data.row.index];
          if (c) data.cell.styles.textColor = AGING_COLORS[agingIndex(c.oldestDays)];
        }
        if (data.section === 'foot' && data.column.index === 8) { data.cell.styles.fontSize = 7; data.cell.styles.textColor = MUTED; }
      },
      didDrawCell: (data) => summaryState.didDrawCell(data as never),
    });
    y = lastY() + 10;
  }

  const newPage = () => { doc.addPage(); y = PDF_PAGE_TOP; };
  const byCategory = !single && r.groupBy === 'categoria';

  // ── Detalle por clienta: una "factura" por venta con sus abonos ─────
  if (!byCategory && r.clients.length > 0) {
    if (y > H - 50) newPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(single ? 'Detalle de facturas' : 'Detalle por clienta', M, y);
    y += 3;
  }

  if (!byCategory) r.clients.forEach((c) => {
    if (y > H - 55) newPage();
    // Franja de la clienta
    doc.setFillColor(...tint(brand, 0.1));
    doc.roundedRect(M, y, barW, 11, 2, 2, 'F');
    doc.setFillColor(...brand);
    doc.rect(M, y, 1.4, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(c.name, M + 5, y + 7);
    const nameW = doc.getTextWidth(c.name); // medido con la fuente del nombre (negrita 10)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${c.phone ? formatPhone(c.phone) + ' · ' : ''}${c.invoices.length} ${c.invoices.length === 1 ? 'factura' : 'facturas'} · ${c.units} ${c.units === 1 ? 'unidad' : 'unidades'}`, M + 8 + nameW, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...brand);
    doc.text(`Debe ${money(c.balance)}`, W - M - 4, y + 7, { align: 'right' });

    const body: string[][] = [];
    const rowState: (PayState | null)[] = [];
    const rowDays: number[] = [];
    c.invoices.forEach(inv => {
      body.push([
        inv.number,
        shortDate(inv.date),
        inv.items.map(it => `${it.quantity} × ${it.name}`).join('\n'),
        `${inv.days} d`,
        money(inv.total),
        money(inv.paid),
        money(inv.balance),
        '',
      ]);
      rowState.push(paymentState(inv.paid, inv.total));
      rowDays.push(inv.days);
      inv.payments.forEach(p => {
        body.push(['', shortDate(p.date), `Abono · ${p.method || 'sin método'}${p.amountBs ? ` · ${bs(p.amountBs)}` : ''}`, '', '', `-${money(p.amount)}`, '', '']);
        rowState.push(null);
        rowDays.push(0);
      });
    });
    const st = stateColumns(doc, i => rowState[i], { paid: 5, balance: 6, state: 7 });

    autoTable(doc, {
      startY: y + 13,
      margin: PDF_TABLE_MARGIN,
      head: [['Factura', 'Fecha', 'Productos / abonos', 'Días', 'Total', 'Abonado', 'Saldo', 'Estado']],
      body,
      foot: [['', '', `Subtotal de ${c.name}`, '', money(c.total), money(c.paid), money(c.balance), `${pct(c.paid, c.total)}% cobrado`]],
      headStyles: { ...head, fillColor: INK },
      footStyles: foot,
      showHead: 'everyPage',
      showFoot: 'lastPage',
      alternateRowStyles: { fillColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2.2, textColor: INK, lineColor: LINE, lineWidth: 0.1, valign: 'top' },
      columnStyles: {
        0: { cellWidth: 21, fontStyle: 'bold' },
        1: { cellWidth: 19 },
        3: { cellWidth: 11, halign: 'center' },
        4: { cellWidth: 19, halign: 'right' },
        5: { cellWidth: 19, halign: 'right' },
        6: { cellWidth: 19, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 22, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'foot' && data.column.index === 7) { data.cell.styles.fontSize = 7; data.cell.styles.textColor = MUTED; return; }
        if (data.section !== 'body') return;
        if (!rowState[data.row.index]) {
          data.cell.styles.fillColor = CANVAS;
          data.cell.styles.textColor = SUCCESS;
          data.cell.styles.fontSize = 7.5;
          data.cell.styles.fontStyle = 'normal';
          return;
        }
        st.didParseCell(data as never);
        if (data.column.index === 3) {
          data.cell.styles.textColor = AGING_COLORS[agingIndex(rowDays[data.row.index])];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawCell: (data) => st.didDrawCell(data as never),
    });
    y = lastY() + 8;
  });

  // ── Detalle por categoría de producto (una sección por categoría) ───
  if (byCategory) r.categories.forEach((cat, ci) => {
    if (y > H - 60) newPage();
    // Banda oscura de la sección: número, nombre y conteos
    doc.setFillColor(...INK);
    doc.roundedRect(M, y, barW, 10, 1.8, 1.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`${ci + 1}. ${cat.name}`, M + 4, y + 6.7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 214, 217);
    doc.text(`${cat.rows.length} ${cat.rows.length === 1 ? 'clienta' : 'clientas'} · ${cat.units} ${cat.units === 1 ? 'unidad' : 'unidades'}`, W - M - 4, y + 6.7, { align: 'right' });

    const rowState = cat.rows.map(row => paymentState(row.paid, row.total));
    const st = stateColumns(doc, i => rowState[i] ?? null, { paid: 3, balance: 4, state: 5 });
    autoTable(doc, {
      startY: y + 11,
      margin: PDF_TABLE_MARGIN,
      head: [['Clienta', 'Cantidad', 'Total', 'Abonado', 'Saldo deudor', 'Estado']],
      body: cat.rows.map(row => [row.name, String(row.units), money(row.total), money(row.paid), money(row.balance), '']),
      foot: [[`Subtotal ${cat.name}`, `${cat.units} uds`, money(cat.total), money(cat.paid), money(cat.balance), `${cat.collectedPct}% cobrado`]],
      headStyles: { fillColor: tint(brand, 0.08), textColor: INK, fontStyle: 'bold', fontSize: 7.5 },
      footStyles: foot,
      showHead: 'everyPage',
      showFoot: 'lastPage',
      alternateRowStyles: { fillColor: CANVAS },
      styles: { fontSize: 8.5, cellPadding: 2.4, textColor: INK, lineColor: LINE, lineWidth: 0.1 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 24, halign: 'right' },
        3: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 26, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'foot') {
          if (data.column.index === 1) data.cell.styles.halign = 'center';
          if (data.column.index >= 2 && data.column.index <= 4) data.cell.styles.halign = 'right';
          if (data.column.index === 3) data.cell.styles.textColor = SUCCESS;
          if (data.column.index === 4) data.cell.styles.textColor = DANGER;
          if (data.column.index === 5) { data.cell.styles.halign = 'center'; data.cell.styles.fontSize = 7; data.cell.styles.textColor = MUTED; }
          return;
        }
        st.didParseCell(data as never);
      },
      didDrawCell: (data) => st.didDrawCell(data as never),
    });
    y = lastY() + 3;

    // Nota operativa: lo que dice la sección en una frase
    const unpaidPct = Math.round(pct(cat.unpaidCount, cat.rows.length));
    const note = cat.unpaidCount === 0
      ? `Todas las clientas de ${cat.name.toLowerCase()} ya abonaron algo; falta ${money(cat.balance)} (${Math.round(100 - cat.collectedPct)}% de lo facturado).`
      : `En ${cat.name.toLowerCase()}, ${unpaidPct}% de las clientas (${cat.unpaidCount} de ${cat.rows.length}) no ha abonado nada. ${cat.collectedPct < 30 ? 'Conviene empezar la cobranza por esta categoría.' : 'Recordarles el saldo con el estado de cuenta.'}`;
    doc.setFont('helvetica', 'bold').setFontSize(7.8);
    const label = 'Nota operativa: ';
    const labelW = doc.getTextWidth(label);
    const lines = doc.setFont('helvetica', 'normal').splitTextToSize(note, barW - 10 - labelW) as string[];
    const boxH = 5 + lines.length * 3.8;
    if (y + boxH > H - 18) newPage();
    doc.setFillColor(...CANVAS);
    doc.rect(M, y, barW, boxH, 'F');
    doc.setFillColor(...brand);
    doc.rect(M, y, 1.2, boxH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text(label, M + 4, y + 4.6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    lines.forEach((l, i) => doc.text(l, M + 4 + labelW, y + 4.6 + i * 3.8));
    y += boxH + 9;
  });

  // ── Balance general por categoría + análisis (reporte general) ──────
  if (!single && r.categories.length > 0) {
    if (y > H - 60) newPage();
    y = drawSectionTitle(doc, y, 'Balance general por categoría', 'Cuánto se ha cobrado de lo facturado en cada tipo de producto.');
    autoTable(doc, {
      startY: y,
      margin: PDF_TABLE_MARGIN,
      head: [['Categoría', 'Artículos', 'Total facturado', 'Abonos recibidos', 'Saldo por cobrar', '% recaudación']],
      body: r.categories.map(c => [c.name, String(c.units), money(c.total), money(c.paid), money(c.balance), `${c.collectedPct}%`]),
      foot: [['TOTAL CONSOLIDADO', `${r.totals.units} uds`, money(r.totals.total), money(r.totals.paid), money(r.totals.balance), `${pct(r.totals.paid, r.totals.total)}%`]],
      headStyles: head,
      footStyles: { ...foot, fillColor: INK, textColor: PDF.white },
      showFoot: 'lastPage',
      alternateRowStyles: { fillColor: CANVAS },
      styles: { fontSize: 8.5, cellPadding: 2.4, textColor: INK, lineColor: LINE, lineWidth: 0.1 },
      columnStyles: { 1: { halign: 'center', cellWidth: 20 }, 2: { halign: 'right', cellWidth: 28 }, 3: { halign: 'right', cellWidth: 28, textColor: SUCCESS }, 4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' }, 5: { halign: 'center', cellWidth: 24 } },
      didParseCell: (data) => {
        if (data.section === 'foot' && data.column.index >= 1) data.cell.styles.halign = data.column.index === 1 || data.column.index === 5 ? 'center' : 'right';
      },
    });
    y = lastY() + 8;
  }

  if (!single && r.clients.length > 0) {
    const ins = r.insights;
    const colW2 = (barW - 6) / 2;
    const left = [
      ...ins.priority.map(p => `${p.name}: debe ${money(p.balance)} (${p.units} ${p.units === 1 ? 'unidad' : 'unidades'}), ${p.paidPct > 0 ? `abonó ${p.paidPct}%` : 'sin abonos'}, la deuda más antigua tiene ${p.oldestDays} días.`),
    ];
    const right = [
      ins.partial.count
        ? `Con abono parcial: ${ins.partial.count} ${ins.partial.count === 1 ? 'clienta' : 'clientas'} (${ins.partial.names.slice(0, 4).join(', ')}${ins.partial.count > 4 ? ` y ${ins.partial.count - 4} más` : ''}).`
        : 'Con abono parcial: ninguna todavía.',
      ins.unpaid.count
        ? `Sin abonos (100% pendiente): ${ins.unpaid.count} ${ins.unpaid.count === 1 ? 'clienta' : 'clientas'} por ${money(ins.unpaid.amount)}.`
        : 'Sin abonos: ninguna; todas las clientas ya abonaron algo.',
      ins.overdue.count
        ? `Meta inmediata: cobrar las ${ins.overdue.count} cuentas con más de 30 días (${money(ins.overdue.amount)}).`
        : `Meta inmediata: recuperar los ${ins.overTen.count} saldos mayores a $10 (${money(ins.overTen.amount)}).`,
    ];
    doc.setFont('helvetica', 'normal').setFontSize(7.8);
    const wrap = (items: string[]) => items.map(t => doc.splitTextToSize(t, colW2 - 11) as string[]);
    const lw = wrap(left), rw = wrap(right);
    const boxH = 13 + Math.max(lw.flat().length + lw.length * 0.4, rw.flat().length + rw.length * 0.4) * 3.9;
    if (y + boxH > H - 18) newPage();
    const box = (x: number, titleText: string, dot: RGB, items: string[][]) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...LINE);
      doc.roundedRect(x, y, colW2, boxH, 2.5, 2.5, 'FD');
      doc.setFillColor(...dot);
      doc.circle(x + 5, y + 6.2, 1.3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(titleText, x + 8.5, y + 7.2);
      let ly = y + 13;
      doc.setFontSize(7.8);
      items.forEach(lines => {
        doc.setTextColor(...MUTED);
        doc.text('•', x + 5, ly);
        lines.forEach(l => { doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK); doc.text(l, x + 8.5, ly); ly += 3.9; });
        ly += 1.5;
      });
    };
    box(M, 'Cuentas prioritarias', DANGER, lw);
    box(M + colW2 + 6, 'Estado de recaudación', SUCCESS, rw);
    y += boxH + 8;
  }

  // ── Cómo leer el reporte + firmas (cierre tipo factura) ─────────────
  if (y > H - 62) newPage();
  doc.setFillColor(...CANVAS);
  doc.setDrawColor(...LINE);
  doc.roundedRect(M, y, barW, 30, 2.5, 2.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text('Cómo leer este reporte', M + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const notes = [
    '• Cada factura es una venta registrada en el panel; "Total" es lo acordado, "Abonado" lo recibido y "Saldo" lo que falta.',
    '• "Días" cuenta desde la fecha de la venta. Verde: reciente · Dorado: 16–30 · Cobre: 31–60 · Rojo: más de 60 días.',
    r.groupBy === 'categoria' && !single
      ? '• Por categoría: cada fila suma lo que esa clienta debe en ese tipo de producto. "Estado": Sin abono (rojo) o Abonó X% (cobre).'
      : '• Los abonos se listan debajo de su factura. "Estado": Sin abono (saldo en rojo) o Abonó X% (saldo en cobre).',
    `• Montos en USD${r.rate ? `; el equivalente en bolívares usa la tasa BCV del día (${bs(r.rate)})` : ''}. Las ventas anuladas no se incluyen.`,
  ];
  notes.forEach((n, i) => doc.text(n, M + 4, y + 12 + i * 4.4, { maxWidth: barW - 8 }));
  y += 38;

  if (single) {
    const sw = (barW - 20) / 2;
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.2);
    doc.line(M + 4, y + 12, M + 4 + sw, y + 12);
    doc.line(W - M - 4 - sw, y + 12, W - M - 4, y + 12);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Por ${BRAND.name}`, M + 4 + sw / 2, y + 16, { align: 'center' });
    doc.text('Conforme (clienta)', W - M - 4 - sw / 2, y + 16, { align: 'center' });
  }

  drawRunningHeader(doc, `${title} · ${BRAND.name}`, `N° ${r.number} · Corte ${shortDate(r.generatedAt)}`);
  drawPdfFooter(doc, `${title} ${r.number}`);

  return doc;
}
