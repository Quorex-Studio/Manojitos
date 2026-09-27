import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDown, ArrowRight2, ArrowUp, ChartSuccess, CloseCircle, DollarSign, Download, FileText, Receipt, Search, ShoppingCart, Users, Wallet } from 'reicon-react';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { ReceivablesReportDialog } from '@/components/reports/ReceivablesReportDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BRAND_COLOR_RGB, BRAND_NAME, BRAND_NAME_UPPER } from '@/config/brand';
import { useSales } from '@/hooks/useSales';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { localDateISO } from '@/lib/dates';
import { cn, formatBS } from '@/lib/utils';
import { buildReceivablesReport } from '@/lib/receivablesReport';
import {
  buildSalesPdf, filterSales, filtersLabel, methodKey, methodName, pctChange, previousRange, salesFileName, summarizeSales, type SalesFilters,
} from '@/lib/salesReport';

const REPORT_LAUNCH_DATE = '2026-01-01';
const VIEWS = ['resumen', 'productos', 'clientas', 'detalle'] as const;
type View = (typeof VIEWS)[number];
const PAGE = 50;

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const clampDate = (iso: string) => (iso < REPORT_LAUNCH_DATE ? REPORT_LAUNCH_DATE : iso);
const argb = (rgb: [number, number, number]) => `FF${rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** Rangos rápidos (fechas locales, nunca antes del lanzamiento). */
function rangePresets() {
  const now = new Date();
  const today = localDateISO(now);
  const daysAgo = (n: number) => localDateISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  return [
    { label: 'Hoy', from: today, to: today },
    { label: '7 días', from: clampDate(daysAgo(6)), to: today },
    { label: '30 días', from: clampDate(daysAgo(29)), to: today },
    { label: 'Este mes', from: clampDate(localDateISO(new Date(now.getFullYear(), now.getMonth(), 1))), to: today },
    { label: 'Mes pasado', from: clampDate(localDateISO(new Date(now.getFullYear(), now.getMonth() - 1, 1))), to: localDateISO(new Date(now.getFullYear(), now.getMonth(), 0)) },
    { label: 'Este año', from: clampDate(localDateISO(new Date(now.getFullYear(), 0, 1))), to: today },
  ].filter(p => p.to >= REPORT_LAUNCH_DATE);
}

/** Variación frente al período anterior, con flecha y texto (nunca solo color). */
function Delta({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-muted-foreground">Sin período anterior para comparar</span>;
  const up = value >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-medium', up ? 'text-success' : 'text-sale')}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {up ? '+' : ''}{value}% <span className="font-normal text-muted-foreground">&nbsp;{label}</span>
    </span>
  );
}

/** Fila de ranking tocable con barra de participación (productos, clientas, métodos). */
function RankRow({ rank, title, detail, amount, max, active, onClick }: {
  rank?: number; title: string; detail: string; amount: number; /** monto del primero: la barra es relativa a él */ max: number; active?: boolean; onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/60',
          active && 'bg-primary/10 ring-1 ring-primary/40',
        )}
      >
        {rank !== undefined && <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">{rank}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="shrink-0 text-sm font-semibold tabular-nums">{money(amount)}</p>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${max > 0 ? Math.max(2, (amount / max) * 100) : 0}%` }} />
            </div>
            <p className="max-w-[55%] shrink-0 truncate text-right text-xs text-muted-foreground">{detail}</p>
          </div>
        </div>
        <ArrowRight2 className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
      </button>
    </li>
  );
}

export default function Reports() {
  const { sales } = useSales();
  const { rate, convertToBS } = useExchangeRate();
  const [params, setParams] = useSearchParams();
  const today = localDateISO();

  // Filtros en la URL: un enlace abre la vista exacta y "atrás" funciona
  const defaultFrom = clampDate(localDateISO(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 29)));
  const from = params.get('desde') || defaultFrom;
  const to = params.get('hasta') || today;
  const view: View = (VIEWS as readonly string[]).includes(params.get('vista') ?? '') ? (params.get('vista') as View) : 'resumen';
  const method = params.get('metodo');
  const day = params.get('dia');
  const q = params.get('q') ?? '';
  const [detailSort, setDetailSort] = useState<'reciente' | 'antigua' | 'mayor' | 'menor'>('reciente');
  const [visible, setVisible] = useState(PAGE);
  const [receivablesOpen, setReceivablesOpen] = useState(false);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
    setVisible(PAGE);
  };

  const setRange = (f: string, t: string) => {
    if (f > today || t > today) { toast.error('No se pueden generar reportes con fecha futura.'); return; }
    const a = clampDate(f), b = clampDate(t);
    update({ desde: a <= b ? a : b, hasta: a <= b ? b : a, dia: null });
  };

  const filters: SalesFilters = { from, to, method, day, q };
  const filtered = useMemo(() => filterSales(sales, filters), [sales, from, to, method, day, q]); // eslint-disable-line react-hooks/exhaustive-deps
  // El resumen de gráficos ignora el día elegido (así el gráfico no se reduce a una barra)
  const chartBase = useMemo(() => filterSales(sales, { from, to, method, q }), [sales, from, to, method, q]);
  const summary = useMemo(() => summarizeSales(filtered, day ? { from: day, to: day } : { from, to }), [filtered, day, from, to]);
  const chart = useMemo(() => summarizeSales(chartBase, { from, to }), [chartBase, from, to]);
  // Los métodos ignoran el método elegido: así se puede cambiar de uno a otro con un toque
  const methods = useMemo(() => summarizeSales(filterSales(sales, { from, to, day, q })).byMethod, [sales, from, to, day, q]);
  const prev = useMemo(() => {
    const r = previousRange(from, to);
    return { ...r, summary: r.to >= REPORT_LAUNCH_DATE ? summarizeSales(filterSales(sales, { from: r.from, to: r.to, method, q })) : null };
  }, [sales, from, to, method, q]);
  const compareLabel = `vs. ${prev.days === 1 ? 'el día anterior' : `los ${prev.days} días anteriores`}`;
  const receivables = useMemo(() => buildReceivablesReport(sales), [sales]);

  // Más de 3 meses: el gráfico agrupa por mes para que se lea
  const byMonth = chart.byDay.length > 92;
  const chartData = useMemo(() => {
    if (!byMonth) return chart.byDay.map(d => ({ key: d.day, label: d.label, amount: d.amount, tickets: d.tickets }));
    const months = new Map<string, { key: string; label: string; amount: number; tickets: number }>();
    chart.byDay.forEach(d => {
      const k = d.day.slice(0, 7);
      const [y, m] = k.split('-').map(Number);
      const e = months.get(k) ?? { key: k, label: new Date(y, m - 1, 1).toLocaleDateString('es-VE', { month: 'short', year: '2-digit' }), amount: 0, tickets: 0 };
      e.amount += d.amount; e.tickets += d.tickets;
      months.set(k, e);
    });
    return [...months.values()];
  }, [chart.byDay, byMonth]);
  const bestDay = chart.byDay.reduce<(typeof chart.byDay)[number] | null>((b, d) => (!b || d.amount > b.amount ? d : b), null);

  const onBarClick = (key: string) => {
    if (byMonth) {
      const [y, m] = key.split('-').map(Number);
      const end = localDateISO(new Date(y, m, 0));
      setRange(`${key}-01`, end > today ? today : end);
      return;
    }
    update({ dia: day === key ? null : key });
  };

  const detailRows = useMemo(() => {
    const list = [...filtered];
    const t = (s: (typeof list)[number]) => new Date(s.created_at).getTime();
    switch (detailSort) {
      case 'antigua': return list.sort((a, b) => t(a) - t(b));
      case 'mayor': return list.sort((a, b) => Number(b.total_usd) - Number(a.total_usd));
      case 'menor': return list.sort((a, b) => Number(a.total_usd) - Number(b.total_usd));
      default: return list.sort((a, b) => t(b) - t(a));
    }
  }, [filtered, detailSort]);

  // ── Exportaciones (respetan los filtros activos) ────────────────────
  const exportPDF = () => {
    buildSalesPdf(filtered, filters, { rate: rate || null, previousTotal: day ? null : prev.summary?.total ?? null }).save(salesFileName(filters, 'pdf'));
    toast.success('Reporte de ventas descargado');
  };

  const exportCSV = () => {
    const headers = ['Fecha', 'Producto', 'Cantidad', 'Precio Unit.', 'Total USD', 'Método Pago', 'Cliente'];
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = detailRows.map(s => [
      new Date(s.created_at).toLocaleDateString('es'), cell(s.product_name), s.quantity,
      Number(s.unit_price_usd).toFixed(2).replace('.', ','), Number(s.total_usd).toFixed(2).replace('.', ','),
      methodName(methodKey(s)), cell(s.client_name || '-'),
    ]);
    // Excel en español usa ";" como separador; el BOM hace que lea bien los acentos
    const csv = 'sep=;\r\n' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = salesFileName(filters, 'csv');
    link.click();
  };

  const exportExcel = async () => {
    const brand = argb(BRAND_COLOR_RGB);
    const cream = 'FFF4E7D7';
    const wb = new ExcelJS.Workbook();
    wb.creator = BRAND_NAME;
    const title = (sheet: ExcelJS.Worksheet, cols: number, text: string) => {
      sheet.mergeCells(1, 1, 1, cols);
      const t = sheet.getCell('A1');
      t.value = `${BRAND_NAME_UPPER} — ${text}`;
      t.font = { name: 'Georgia', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      t.alignment = { vertical: 'middle', horizontal: 'center' };
      t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brand } };
      sheet.getRow(1).height = 28;
      sheet.mergeCells(2, 1, 2, cols);
      const s = sheet.getCell('A2');
      s.value = `${filtersLabel(filters)}  ·  Generado: ${new Date().toLocaleString('es')}`;
      s.font = { size: 10, italic: true, color: { argb: 'FF252024' } };
      s.alignment = { horizontal: 'center' };
      s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cream } };
      sheet.addRow([]);
    };
    const header = (row: ExcelJS.Row) => row.eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brand } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Hoja 1: resumen
    const res = wb.addWorksheet('Resumen');
    title(res, 4, 'Resumen de ventas');
    [['Total vendido', summary.total], ['Ventas (tickets)', summary.tickets], ['Unidades', summary.units], ['Ticket promedio', summary.averageTicket], ['A crédito', summary.creditTotal], ['Por cobrar de esas ventas', summary.creditPending]]
      .forEach(([k, v]) => { const r = res.addRow([k, v]); r.getCell(1).font = { bold: true }; if (k !== 'Ventas (tickets)' && k !== 'Unidades') r.getCell(2).numFmt = '"$"#,##0.00'; });
    res.addRow([]);
    header(res.addRow(['Método de pago', 'Ventas', 'Total', '%']));
    summary.byMethod.forEach(m => { const r = res.addRow([m.label, m.count, m.amount, m.share]); r.getCell(3).numFmt = '"$"#,##0.00'; r.getCell(4).numFmt = '0%'; });
    res.addRow([]);
    header(res.addRow(['Producto', 'Unidades', 'Total', '%']));
    summary.topProducts.forEach(p => { const r = res.addRow([p.name, p.units, p.amount, p.share]); r.getCell(3).numFmt = '"$"#,##0.00'; r.getCell(4).numFmt = '0%'; });
    res.columns = [{ width: 34 }, { width: 14 }, { width: 16 }, { width: 10 }];

    // Hoja 2: detalle
    const sheet = wb.addWorksheet('Ventas', { views: [{ state: 'frozen', ySplit: 4 }] });
    title(sheet, 7, 'Detalle de ventas');
    header(sheet.addRow(['Fecha', 'Producto', 'Cantidad', 'Precio Unit. ($)', 'Total ($)', 'Método de Pago', 'Cliente']));
    detailRows.forEach((s, i) => {
      const row = sheet.addRow([new Date(s.created_at).toLocaleDateString('es'), s.product_name, s.quantity, Number(s.unit_price_usd), Number(s.total_usd), methodName(methodKey(s)), s.client_name || '-']);
      if (i % 2) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCF8F3' } }; });
      row.getCell(4).numFmt = '"$"#,##0.00';
      row.getCell(5).numFmt = '"$"#,##0.00';
    });
    const total = sheet.addRow(['', 'TOTAL', summary.units, '', summary.total, '', '']);
    total.eachCell(c => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cream } }; });
    total.getCell(5).numFmt = '"$"#,##0.00';
    sheet.columns = [{ width: 14 }, { width: 34 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 18 }, { width: 24 }];

    const buffer = await wb.xlsx.writeBuffer();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    link.download = salesFileName(filters, 'xlsx');
    link.click();
  };

  const presets = rangePresets();
  const activeChips = [
    day && { key: 'dia', label: `Día: ${new Date(`${day}T12:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}` },
    method && { key: 'metodo', label: `Pago: ${methodName(method)}` },
    q && { key: 'q', label: `“${q}”` },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-header">Reportes</h1>
            <p className="page-subtitle">Cómo van las ventas, qué se vende y quién compra. Toca cualquier barra o fila para ver el detalle.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Button onClick={exportPDF} className="h-11 gap-2 rounded-full sm:h-10"><FileText className="h-4 w-4" />PDF</Button>
            <Button variant="outline" onClick={() => void exportExcel()} className="h-11 gap-2 rounded-full sm:h-10"><Download className="h-4 w-4" />Excel</Button>
            <Button variant="outline" onClick={exportCSV} className="h-11 gap-2 rounded-full sm:h-10"><Download className="h-4 w-4" />CSV</Button>
          </div>
        </div>

        {/* Filtros: rangos rápidos + fechas + búsqueda */}
        <Card className="border-border">
          <CardContent className="space-y-4 p-4">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:px-0" role="group" aria-label="Rango rápido">
              {presets.map(p => {
                const active = from === p.from && to === p.to;
                return (
                  <button key={p.label} type="button" onClick={() => setRange(p.from, p.to)} aria-pressed={active}
                    className={cn('h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors',
                      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50')}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_2fr]">
              <div className="space-y-1.5">
                <Label htmlFor="rep-desde">Desde</Label>
                <Input id="rep-desde" type="date" value={from} min={REPORT_LAUNCH_DATE} max={today} onChange={e => e.target.value && setRange(e.target.value, to < e.target.value ? e.target.value : to)} className="input-glass rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rep-hasta">Hasta</Label>
                <Input id="rep-hasta" type="date" value={to} min={REPORT_LAUNCH_DATE} max={today} onChange={e => e.target.value && setRange(from > e.target.value ? e.target.value : from, e.target.value)} className="input-glass rounded-xl" />
              </div>
              <div className="col-span-2 space-y-1.5 md:col-span-1">
                <Label htmlFor="rep-q">Buscar producto o clienta</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="rep-q" value={q} onChange={e => update({ q: e.target.value || null })} placeholder="Ej.: sérum, María…" className="input-glass rounded-xl pl-9" />
                </div>
              </div>
            </div>
            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Filtrando:</span>
                {activeChips.map(c => (
                  <button key={c.key} type="button" onClick={() => update({ [c.key]: null })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15" aria-label={`Quitar filtro ${c.label}`}>
                    {c.label}<CloseCircle className="h-3.5 w-3.5" />
                  </button>
                ))}
                <button type="button" onClick={() => update({ dia: null, metodo: null, q: null })} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
                  Quitar todos
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPIs con comparación */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <StatCard title="Total vendido" value={money(summary.total)} subtitle={rate ? formatBS(convertToBS(summary.total)) : undefined} icon={<DollarSign />} variant="gold" />
          <StatCard title="Ventas" value={summary.tickets} subtitle={`${summary.units} ${summary.units === 1 ? 'unidad' : 'unidades'}`} icon={<ShoppingCart />} />
          <StatCard title="Ticket promedio" value={money(summary.averageTicket)} subtitle="por venta" icon={<Receipt />} />
          <StatCard title="A crédito" value={money(summary.creditTotal)} subtitle={summary.total > 0 ? `${Math.round((summary.creditTotal / summary.total) * 100)}% del total` : 'sin ventas'} icon={<Wallet />} />
        </div>
        {!day && prev.summary && (
          <p className="-mt-2 text-xs">
            <Delta value={pctChange(summary.total, prev.summary.total)} label={`en ventas ${compareLabel} (${money(prev.summary.total)})`} />
          </p>
        )}

        {/* Por cobrar: acceso directo al PDF estilo factura */}
        <button type="button" onClick={() => setReceivablesOpen(true)}
          className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cuentas por cobrar</p>
            <p className="font-serif text-xl font-semibold tabular-nums">{money(receivables.totals.balance)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {receivables.totals.clients} {receivables.totals.clients === 1 ? 'clienta' : 'clientas'} · {receivables.totals.invoices} {receivables.totals.invoices === 1 ? 'factura' : 'facturas'} · toca para el reporte en PDF
            </p>
          </div>
          <ArrowRight2 className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
        <ReceivablesReportDialog open={receivablesOpen} onOpenChange={setReceivablesOpen} />

        <Tabs value={view} onValueChange={v => update({ vista: v === 'resumen' ? null : v })}>
          <TabsList className="admin-tabs">
            <TabsTrigger value="resumen"><ChartSuccess className="h-4 w-4" />Resumen</TabsTrigger>
            <TabsTrigger value="productos"><ShoppingCart className="h-4 w-4" />Productos</TabsTrigger>
            <TabsTrigger value="clientas"><Users className="h-4 w-4" />Clientas</TabsTrigger>
            <TabsTrigger value="detalle"><FileText className="h-4 w-4" />Detalle ({filtered.length})</TabsTrigger>
          </TabsList>

          {/* RESUMEN: gráfico por día + métodos de pago */}
          <TabsContent value="resumen" className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="border-border">
              <CardContent className="p-4 md:p-5">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-lg font-semibold">Ventas por {byMonth ? 'mes' : 'día'}</h2>
                    <p className="text-xs text-muted-foreground">
                      {byMonth ? 'Toca un mes para verlo por días.' : day ? 'Toca la barra otra vez para quitar el filtro.' : 'Toca una barra para ver ese día.'}
                    </p>
                  </div>
                  {bestDay && bestDay.amount > 0 && !byMonth && (
                    <p className="text-xs text-muted-foreground">Mejor día: <strong className="text-foreground">{bestDay.label} · {money(bestDay.amount)}</strong></p>
                  )}
                </div>
                {chart.total === 0 ? (
                  <div className="flex h-[240px] flex-col items-center justify-center gap-3 rounded-2xl bg-studio px-6 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-card text-muted-foreground"><ChartSuccess className="h-6 w-6" /></span>
                    <p className="max-w-xs text-sm text-muted-foreground">No hay ventas en este período. Prueba otro rango o quita los filtros.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" minTickGap={16} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `$${v}`} width={52} />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.6 }}
                        content={({ active, payload }) => {
                          const d = active && payload?.[0]?.payload as { label: string; amount: number; tickets: number } | undefined;
                          if (!d) return null;
                          return (
                            <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-md">
                              <p className="font-semibold">{d.label}</p>
                              <p className="tabular-nums">{money(d.amount)} · {d.tickets} {d.tickets === 1 ? 'venta' : 'ventas'}</p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={36} cursor="pointer" onClick={(d: { key?: string; payload?: { key: string } }) => onBarClick(d.payload?.key ?? d.key ?? '')}>
                        {chartData.map(d => (
                          <Cell key={d.key} fill="hsl(var(--primary))" fillOpacity={day && d.key !== day ? 0.3 : 1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 md:p-5">
                <h2 className="font-serif text-lg font-semibold">Métodos de pago</h2>
                <p className="mb-2 text-xs text-muted-foreground">Toca uno para filtrar todo el reporte.</p>
                {methods.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Sin ventas en el período.</p>
                ) : (
                  <ul className="-mx-3 space-y-0.5">
                    {methods.map(m => (
                      <RankRow key={m.key} title={m.label} detail={`${m.count} ${m.count === 1 ? 'venta' : 'ventas'} · ${Math.round(m.share * 100)}%`}
                        amount={m.amount} max={methods[0]?.amount ?? 0} active={method === m.key}
                        onClick={() => update({ metodo: method === m.key ? null : m.key })} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-border lg:col-span-2">
              <CardContent className="grid gap-4 p-4 md:grid-cols-2 md:p-5">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <h2 className="font-serif text-lg font-semibold">Lo más vendido</h2>
                    <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => update({ vista: 'productos' })}>Ver todo</button>
                  </div>
                  <ul className="-mx-3 space-y-0.5">
                    {summary.topProducts.slice(0, 5).map((p, i) => (
                      <RankRow key={p.name} rank={i + 1} title={p.name} detail={`${p.units} uds · ${Math.round(p.share * 100)}%`} amount={p.amount} max={summary.topProducts[0]?.amount ?? 0}
                        onClick={() => update({ q: p.name, vista: 'detalle' })} />
                    ))}
                    {!summary.topProducts.length && <li className="px-3 py-4 text-sm text-muted-foreground">Sin ventas.</li>}
                  </ul>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <h2 className="font-serif text-lg font-semibold">Mejores clientas</h2>
                    <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => update({ vista: 'clientas' })}>Ver todo</button>
                  </div>
                  <ul className="-mx-3 space-y-0.5">
                    {summary.topClients.slice(0, 5).map((c, i) => (
                      <RankRow key={c.name} rank={i + 1} title={c.name} detail={`${c.tickets} ${c.tickets === 1 ? 'compra' : 'compras'}`} amount={c.amount} max={summary.topClients[0]?.amount ?? 0}
                        onClick={() => update({ q: c.name, vista: 'detalle' })} />
                    ))}
                    {!summary.topClients.length && <li className="px-3 py-4 text-sm text-muted-foreground">Sin clientas registradas en estas ventas.</li>}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRODUCTOS */}
          <TabsContent value="productos" className="mt-4">
            <Card className="border-border">
              <CardContent className="p-4 md:p-5">
                <p className="mb-2 text-sm text-muted-foreground">{summary.topProducts.length} productos vendidos · toca uno para ver sus ventas.</p>
                <ul className="-mx-3 space-y-0.5">
                  {summary.topProducts.map((p, i) => (
                    <RankRow key={p.name} rank={i + 1} title={p.name} detail={`${p.units} uds · ${Math.round(p.share * 100)}% del total`} amount={p.amount} max={summary.topProducts[0]?.amount ?? 0}
                      onClick={() => update({ q: p.name, vista: 'detalle' })} />
                  ))}
                  {!summary.topProducts.length && <li className="px-3 py-8 text-center text-sm text-muted-foreground">No hay ventas con estos filtros.</li>}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CLIENTAS */}
          <TabsContent value="clientas" className="mt-4">
            <Card className="border-border">
              <CardContent className="p-4 md:p-5">
                <p className="mb-2 text-sm text-muted-foreground">{summary.topClients.length} clientas compraron en el período · toca una para ver sus compras.</p>
                <ul className="-mx-3 space-y-0.5">
                  {summary.topClients.map((c, i) => (
                    <RankRow key={c.name} rank={i + 1} title={c.name}
                      detail={`${c.tickets} ${c.tickets === 1 ? 'compra' : 'compras'} · última ${new Date(c.lastDate).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}`}
                      amount={c.amount} max={summary.topClients[0]?.amount ?? 0} onClick={() => update({ q: c.name, vista: 'detalle' })} />
                  ))}
                  {!summary.topClients.length && <li className="px-3 py-8 text-center text-sm text-muted-foreground">No hay clientas registradas en estas ventas.</li>}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DETALLE */}
          <TabsContent value="detalle" className="mt-4">
            <Card className="border-border">
              <CardContent className="space-y-3 p-4 md:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} {filtered.length === 1 ? 'línea' : 'líneas'} · <strong className="text-foreground">{money(summary.total)}</strong>
                  </p>
                  <Select value={detailSort} onValueChange={v => setDetailSort(v as typeof detailSort)}>
                    <SelectTrigger className="w-full rounded-xl sm:w-[200px]" aria-label="Ordenar ventas"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reciente">Más recientes</SelectItem>
                      <SelectItem value="antigua">Más antiguas</SelectItem>
                      <SelectItem value="mayor">Mayor monto</SelectItem>
                      <SelectItem value="menor">Menor monto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Móvil: lista; escritorio: tabla */}
                <ul className="divide-y divide-border md:hidden">
                  {detailRows.slice(0, visible).map(s => (
                    <li key={s.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{s.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })} · {s.quantity} ud{s.quantity === 1 ? '' : 's'}{s.client_name ? ` · ${s.client_name}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums">{money(Number(s.total_usd))}</p>
                        <p className="text-[11px] text-muted-foreground">{methodName(methodKey(s))}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-center">Cant.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Pago</TableHead>
                        <TableHead>Clienta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailRows.slice(0, visible).map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(s.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}</TableCell>
                          <TableCell className="font-medium">{s.product_name}</TableCell>
                          <TableCell className="text-center tabular-nums">{s.quantity}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{money(Number(s.total_usd))}</TableCell>
                          <TableCell>
                            <button type="button" onClick={() => update({ metodo: method === methodKey(s) ? null : methodKey(s) })}
                              className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium hover:bg-primary/10 hover:text-primary">
                              {methodName(methodKey(s))}
                            </button>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {s.client_name
                              ? <button type="button" className="hover:text-primary hover:underline" onClick={() => update({ q: s.client_name })}>{s.client_name}</button>
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {filtered.length === 0 && (
                  <div className="py-8 text-center">
                    <FileText className="mx-auto mb-2 h-12 w-12 text-muted-foreground/40" />
                    <p className="text-muted-foreground">No hay ventas con estos filtros</p>
                  </div>
                )}
                {filtered.length > visible && (
                  <div className="flex flex-col items-center gap-1 pt-2">
                    <Button variant="outline" className="rounded-full" onClick={() => setVisible(v => v + PAGE)}>Ver {Math.min(PAGE, filtered.length - visible)} más</Button>
                    <p className="text-xs text-muted-foreground">Mostrando {visible} de {filtered.length}. El PDF y el Excel traen todas.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
