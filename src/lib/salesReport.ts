import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BRAND_FILE_SLUG } from '@/config/brand';
import { localDateISO } from '@/lib/dates';
import { paymentLabel } from '@/lib/receipt';
import {
  PDF, drawInfoBox, drawPdfFooter, drawPdfHeader, drawSectionTitle, drawTiles, pdfBs, pdfLastY, pdfLongDate, pdfMoney, pdfShortDate, tint,
} from '@/lib/pdfBrand';

/**
 * Lógica del módulo Reportes (ventas del panel). Pura y probada: la página, el PDF y el
 * Excel usan las mismas cifras.
 * - Una "venta" (ticket) es un grupo de líneas (`sale_group_id` o `id`); las anuladas no cuentan.
 * - "A crédito" = líneas `is_credit`; su método se muestra como "Crédito".
 * - La comparación usa el período anterior de la misma duración.
 */

export interface ReportSaleRow {
  id: string;
  sale_group_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price_usd: number | string;
  total_usd: number | string;
  amount_paid?: number | string | null;
  payment_method: string;
  is_credit: boolean;
  client_name: string | null;
  status?: string | null;
  created_at: string;
}

export interface SalesFilters {
  from: string; // YYYY-MM-DD (local)
  to: string;
  /** método de pago o 'credito' */
  method?: string | null;
  /** día puntual dentro del rango (clic en el gráfico) */
  day?: string | null;
  q?: string | null;
}

export const CREDIT_KEY = 'credito';
export const methodKey = (s: Pick<ReportSaleRow, 'is_credit' | 'payment_method'>) => (s.is_credit ? CREDIT_KEY : s.payment_method || 'otro');
export const methodName = (key: string) => (key === CREDIT_KEY ? 'Crédito' : paymentLabel(key) || 'Otro');

const num = (v: unknown) => Number(v) || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;
export const saleDay = (s: Pick<ReportSaleRow, 'created_at'>) => localDateISO(new Date(s.created_at));
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Ventas activas dentro del rango y los filtros (búsqueda por producto o clienta, sin acentos). */
export function filterSales<T extends ReportSaleRow>(sales: T[], f: SalesFilters): T[] {
  const q = f.q ? norm(f.q.trim()) : '';
  return sales.filter(s => {
    if (s.status === 'cancelled') return false;
    const d = saleDay(s);
    if (d < f.from || d > f.to) return false;
    if (f.day && d !== f.day) return false;
    if (f.method && methodKey(s) !== f.method) return false;
    if (q && !norm(`${s.product_name} ${s.client_name ?? ''}`).includes(q)) return false;
    return true;
  });
}

/** Rango anterior de la misma cantidad de días (para comparar). */
export function previousRange(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return {
    from: localDateISO(new Date(fy, fm - 1, fd - days)),
    to: localDateISO(new Date(fy, fm - 1, fd - 1)),
    days,
  };
}

/** Variación porcentual; null si no hay base para comparar. */
export const pctChange = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);

export interface SalesSummary {
  total: number;
  units: number;
  tickets: number;
  lines: number;
  averageTicket: number;
  creditTotal: number;
  creditPending: number;
  byMethod: { key: string; label: string; amount: number; count: number; share: number }[];
  byDay: { day: string; label: string; amount: number; tickets: number }[];
  topProducts: { name: string; units: number; amount: number; share: number }[];
  topClients: { name: string; tickets: number; amount: number; share: number; lastDate: string }[];
}

const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
};

/** Resumen del período. `range` rellena los días sin ventas con 0 (el gráfico no salta días). */
export function summarizeSales(sales: ReportSaleRow[], range?: { from: string; to: string }): SalesSummary {
  const total = round2(sales.reduce((s, x) => s + num(x.total_usd), 0));
  const units = sales.reduce((s, x) => s + num(x.quantity), 0);
  const tickets = new Set(sales.map(s => s.sale_group_id || s.id)).size;
  const credit = sales.filter(s => s.is_credit);
  const creditTotal = round2(credit.reduce((s, x) => s + num(x.total_usd), 0));
  const creditPending = round2(credit.reduce((s, x) => s + Math.max(0, num(x.total_usd) - num(x.amount_paid)), 0));
  const share = (n: number) => (total > 0 ? n / total : 0);

  const methods = new Map<string, { amount: number; groups: Set<string> }>();
  const days = new Map<string, { amount: number; groups: Set<string> }>();
  const products = new Map<string, { units: number; amount: number }>();
  const clients = new Map<string, { name: string; groups: Set<string>; amount: number; lastDate: string }>();
  for (const s of sales) {
    const g = s.sale_group_id || s.id;
    const m = methods.get(methodKey(s)) ?? { amount: 0, groups: new Set() };
    m.amount += num(s.total_usd); m.groups.add(g); methods.set(methodKey(s), m);
    const d = days.get(saleDay(s)) ?? { amount: 0, groups: new Set() };
    d.amount += num(s.total_usd); d.groups.add(g); days.set(saleDay(s), d);
    const p = products.get(s.product_name) ?? { units: 0, amount: 0 };
    p.units += num(s.quantity); p.amount += num(s.total_usd); products.set(s.product_name, p);
    const name = (s.client_name ?? '').trim().replace(/\s+/g, ' ');
    if (name) {
      const key = name.toLowerCase();
      const c = clients.get(key) ?? { name, groups: new Set(), amount: 0, lastDate: s.created_at };
      c.groups.add(g); c.amount += num(s.total_usd);
      if (s.created_at > c.lastDate) c.lastDate = s.created_at;
      clients.set(key, c);
    }
  }

  if (range) {
    const [y, m, d] = range.from.split('-').map(Number);
    for (let i = 0; ; i++) {
      const iso = localDateISO(new Date(y, m - 1, d + i));
      if (iso > range.to || i > 400) break;
      if (!days.has(iso)) days.set(iso, { amount: 0, groups: new Set() });
    }
  }

  return {
    total, units, tickets, lines: sales.length,
    averageTicket: tickets ? round2(total / tickets) : 0,
    creditTotal, creditPending,
    byMethod: [...methods.entries()].map(([key, v]) => ({ key, label: methodName(key), amount: round2(v.amount), count: v.groups.size, share: share(v.amount) }))
      .sort((a, b) => b.amount - a.amount),
    byDay: [...days.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, label: dayLabel(day), amount: round2(v.amount), tickets: v.groups.size })),
    topProducts: [...products.entries()].map(([name, v]) => ({ name, units: v.units, amount: round2(v.amount), share: share(v.amount) }))
      .sort((a, b) => b.amount - a.amount || b.units - a.units),
    topClients: [...clients.values()].map(c => ({ name: c.name, tickets: c.groups.size, amount: round2(c.amount), share: share(c.amount), lastDate: c.lastDate }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export const salesFileName = (f: SalesFilters, ext: 'pdf' | 'xlsx' | 'csv') => `reporte_ventas_${BRAND_FILE_SLUG}_${f.day ?? f.from}_${f.day ?? f.to}.${ext}`;

/** Texto que describe los filtros activos (para el PDF, el Excel y la pantalla). */
export function filtersLabel(f: SalesFilters): string {
  const parts = [f.day ? `Día ${pdfShortDate(new Date(`${f.day}T12:00:00`))}` : `${pdfShortDate(new Date(`${f.from}T12:00:00`))} al ${pdfShortDate(new Date(`${f.to}T12:00:00`))}`];
  if (f.method) parts.push(`Pago: ${methodName(f.method)}`);
  if (f.q) parts.push(`Búsqueda: "${f.q}"`);
  return parts.join(' · ');
}

// ─────────────────────────────── PDF ───────────────────────────────

export function buildSalesPdf(
  sales: ReportSaleRow[],
  f: SalesFilters,
  opts: { now?: Date; rate?: number | null; previousTotal?: number | null } = {},
): jsPDF {
  const now = opts.now ?? new Date();
  const sum = summarizeSales(sales, f.day ? { from: f.day, to: f.day } : { from: f.from, to: f.to });
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = PDF.margin;
  const number = `VEN-${localDateISO(now).replace(/-/g, '')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const title = 'Reporte de ventas';

  let y = drawPdfHeader(doc, title, number, now);
  const colW = (W - M * 2 - 6) / 2;
  const change = opts.previousTotal != null ? pctChange(sum.total, opts.previousTotal) : null;
  drawInfoBox(doc, M, y, colW, 'Período', [
    f.day ? pdfLongDate(new Date(`${f.day}T12:00:00`)) : `${pdfShortDate(new Date(`${f.from}T12:00:00`))} al ${pdfShortDate(new Date(`${f.to}T12:00:00`))}`,
    [f.method ? `Pago: ${methodName(f.method)}` : 'Todos los métodos de pago', f.q ? `"${f.q}"` : ''].filter(Boolean).join(' · '),
    change == null ? 'Sin período anterior para comparar' : `${change >= 0 ? '+' : ''}${change}% frente al período anterior`,
  ]);
  drawInfoBox(doc, M + colW + 6, y, colW, 'Resumen', [
    `${sum.tickets} ${sum.tickets === 1 ? 'venta' : 'ventas'} · ${sum.units} ${sum.units === 1 ? 'unidad' : 'unidades'}`,
    `Ticket promedio: ${pdfMoney(sum.averageTicket)}`,
    opts.rate ? `Tasa BCV: ${pdfBs(opts.rate)} por $1` : 'Montos en dólares (USD)',
  ]);
  y += 31;

  y = drawTiles(doc, y, [
    { label: 'Total vendido', value: pdfMoney(sum.total), sub: opts.rate ? pdfBs(sum.total * opts.rate) : undefined, accent: true },
    { label: 'Ventas', value: String(sum.tickets), sub: `${sum.lines} líneas de producto` },
    { label: 'Ticket promedio', value: pdfMoney(sum.averageTicket) },
    { label: 'A crédito', value: pdfMoney(sum.creditTotal), sub: sum.creditPending > 0 ? `${pdfMoney(sum.creditPending)} por cobrar` : 'Todo cobrado' },
  ]);

  // Ventas por día: barras simples en el color de marca (una sola serie, sin leyenda)
  if (sum.byDay.length > 1) {
    y = drawSectionTitle(doc, y, 'Ventas por día', 'Total vendido cada día del período (USD).');
    const chartH = 32;
    const max = Math.max(...sum.byDay.map(d => d.amount), 1);
    const barGap = sum.byDay.length > 40 ? 0.4 : 1;
    const barW = (W - M * 2 - barGap * (sum.byDay.length - 1)) / sum.byDay.length;
    doc.setDrawColor(...PDF.line);
    doc.setLineWidth(0.2);
    doc.line(M, y + chartH, W - M, y + chartH);
    const best = sum.byDay.reduce((a, b) => (b.amount > a.amount ? b : a));
    sum.byDay.forEach((d, i) => {
      const h = (d.amount / max) * (chartH - 4);
      const x = M + i * (barW + barGap);
      if (h > 0) {
        doc.setFillColor(...(d === best ? PDF.brand : tint(PDF.brand, 0.45)));
        doc.rect(x, y + chartH - h, barW, h, 'F');
      }
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF.muted);
    doc.text(sum.byDay[0].label, M, y + chartH + 4);
    doc.text(sum.byDay[sum.byDay.length - 1].label, W - M, y + chartH + 4, { align: 'right' });
    doc.setTextColor(...PDF.ink);
    doc.setFont('helvetica', 'bold');
    doc.text(`Mejor día: ${best.label} · ${pdfMoney(best.amount)}`, W / 2, y + chartH + 4, { align: 'center' });
    y += chartH + 10;
  }

  const head = { fillColor: PDF.brand, textColor: PDF.white, fontStyle: 'bold' as const, fontSize: 8 };
  const foot = { fillColor: PDF.cream, textColor: PDF.ink, fontStyle: 'bold' as const, fontSize: 8.5 };
  const styles = { fontSize: 8, cellPadding: 2.2, textColor: PDF.ink, lineColor: PDF.line, lineWidth: 0.1 };
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const halfW = (W - M * 2 - 6) / 2;

  // Métodos de pago y productos más vendidos, lado a lado
  if (sum.total > 0) {
    if (y > H - 70) { doc.addPage(); y = 20; }
    const top = y;
    drawSectionTitle(doc, y, 'Por método de pago');
    autoTable(doc, {
      startY: y + 3, margin: { left: M, right: W - M - halfW, bottom: 18 },
      head: [['Método', 'Ventas', 'Total', '%']],
      body: sum.byMethod.map(m => [m.label, String(m.count), pdfMoney(m.amount), pct(m.share)]),
      headStyles: head, styles, alternateRowStyles: { fillColor: PDF.canvas },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right' } },
    });
    const leftEnd = pdfLastY(doc);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PDF.ink);
    doc.text('Productos más vendidos', M + halfW + 6, top);
    autoTable(doc, {
      startY: top + 3, margin: { left: M + halfW + 6, right: M, bottom: 18 },
      head: [['Producto', 'Uds.', 'Total']],
      body: sum.topProducts.slice(0, 8).map(p => [p.name, String(p.units), pdfMoney(p.amount)]),
      headStyles: head, styles, alternateRowStyles: { fillColor: PDF.canvas },
      columnStyles: { 1: { halign: 'center', cellWidth: 12 }, 2: { halign: 'right', fontStyle: 'bold', cellWidth: 22 } },
    });
    y = Math.max(leftEnd, pdfLastY(doc)) + 10;
  }

  // Detalle completo
  if (y > H - 50) { doc.addPage(); y = 20; }
  drawSectionTitle(doc, y, `Detalle de ventas (${sales.length} ${sales.length === 1 ? 'línea' : 'líneas'})`);
  const sorted = [...sales].sort((a, b) => a.created_at.localeCompare(b.created_at));
  autoTable(doc, {
    startY: y + 3, margin: { left: M, right: M, bottom: 18 },
    head: [['Fecha', 'Producto', 'Cant.', 'Precio', 'Total', 'Pago', 'Clienta']],
    body: sorted.map(s => [
      pdfShortDate(new Date(s.created_at)), s.product_name, String(s.quantity), pdfMoney(num(s.unit_price_usd)), pdfMoney(num(s.total_usd)), methodName(methodKey(s)), s.client_name || '—',
    ]),
    foot: [['', 'TOTAL', String(sum.units), '', pdfMoney(sum.total), '', '']],
    headStyles: { ...head, fillColor: PDF.ink }, footStyles: foot, styles, showHead: 'everyPage', showFoot: 'lastPage',
    alternateRowStyles: { fillColor: PDF.canvas },
    columnStyles: { 0: { cellWidth: 21 }, 2: { halign: 'center', cellWidth: 12 }, 3: { halign: 'right', cellWidth: 19 }, 4: { halign: 'right', fontStyle: 'bold', cellWidth: 21 }, 5: { cellWidth: 25 } },
  });
  if (!sales.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF.muted);
    doc.text('No hay ventas con estos filtros.', W / 2, pdfLastY(doc) + 8, { align: 'center' });
  }

  drawPdfFooter(doc, `${title} ${number}`);
  return doc;
}
