import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Loader, MoneyRecive } from 'reicon-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatBS, cn } from '@/lib/utils';
import { BRAND_FILE_SLUG } from '@/config/brand';
import { INCOME_METHODS, OTHER_METHOD, incomeMethodName, summarizeIncomeByMonth, type IncomePaymentRow } from '@/lib/incomeReport';

/** Color fijo por método (no cambia al filtrar ni con el orden) */
const SERIES: Record<string, string> = Object.fromEntries([
  ...INCOME_METHODS.map((m, i) => [m, `var(--series-${i + 1})`]),
  [OTHER_METHOD, 'var(--series-other)'],
]);
const money = (n: number) => `$${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function loadPayments(year: number): Promise<IncomePaymentRow[]> {
  const rows: IncomePaymentRow[] = [];
  const from = new Date(year, 0, 1).toISOString();
  const to = new Date(year + 1, 0, 1).toISOString();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('sale_payments')
      .select('amount_usd, amount_bs, payment_method, status, created_at')
      .gte('created_at', from).lt('created_at', to)
      .order('created_at', { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...((data || []) as IncomePaymentRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/**
 * Reportes → Ingresos por mes: cuánto dinero entró cada mes y por cuál método de pago
 * (pagos de contado y abonos de las ventas por cobrar, en el mes en que se cobraron).
 */
export function IncomeByMonth() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const { data: payments, isLoading, error } = useQuery({
    queryKey: ['income-by-month', year],
    queryFn: () => loadPayments(year),
    staleTime: 60_000,
  });
  const summary = useMemo(() => summarizeIncomeByMonth(payments ?? [], year), [payments, year]);
  const chartData = summary.months.map(m => ({ key: m.key, label: m.label.slice(0, 3), full: m.label, ...m.byMethod, total: m.total }));
  const bestMonth = summary.months.reduce<(typeof summary.months)[number] | null>((b, m) => (!b || m.total > b.total ? m : b), null);

  const exportCsv = () => {
    const header = ['Mes', ...summary.methods.map(incomeMethodName), 'Total USD', 'Total Bs'];
    const rows = summary.months.map(m => [m.label, ...summary.methods.map(k => (m.byMethod[k] || 0).toFixed(2).replace('.', ',')), m.total.toFixed(2).replace('.', ','), m.totalBs.toFixed(2).replace('.', ',')]);
    rows.push(['TOTAL', ...summary.methods.map(k => (summary.totals.byMethod[k] || 0).toFixed(2).replace('.', ',')), summary.totals.total.toFixed(2).replace('.', ','), summary.totals.totalBs.toFixed(2).replace('.', ',')]);
    const csv = 'sep=;\r\n' + [header, ...rows].map(r => r.join(';')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `${BRAND_FILE_SLUG}-ingresos-por-metodo-${year}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-serif text-lg font-semibold">Ingresos por mes y método de pago</h2>
              <p className="text-xs text-muted-foreground">El dinero que entró: pagos de contado y abonos, en el mes en que se cobraron. No incluye lo que aún está por cobrar.</p>
            </div>
            <div className="flex gap-2" role="group" aria-label="Año">
              {[thisYear, thisYear - 1, thisYear - 2].map(y => (
                <button key={y} type="button" aria-pressed={year === y} onClick={() => setYear(y)}
                  className={cn('h-10 rounded-full border px-4 text-sm font-medium transition-colors', year === y ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50')}>
                  {y}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-[240px] items-center justify-center"><Loader className="h-6 w-6 animate-spin text-primary" /></div>
          ) : error ? (
            <p className="rounded-2xl bg-studio px-4 py-8 text-center text-sm text-muted-foreground">No se pudieron cargar los pagos. Revisa tu conexión e inténtalo de nuevo.</p>
          ) : summary.totals.total <= 0 ? (
            <div className="flex h-[200px] flex-col items-center justify-center gap-3 rounded-2xl bg-studio px-6 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-card text-muted-foreground"><MoneyRecive className="h-6 w-6" /></span>
              <p className="max-w-xs text-sm text-muted-foreground">No hay pagos registrados en {year}.</p>
            </div>
          ) : (
            <>
              {/* Totales del año por método (también es la leyenda del gráfico) */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <div className="col-span-2 rounded-2xl bg-primary/10 p-3 sm:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Total {year}</p>
                  <p className="font-serif text-xl font-semibold tabular-nums">{money(summary.totals.total)}</p>
                  <p className="text-xs text-muted-foreground">{summary.totals.count} pagos{bestMonth && bestMonth.total > 0 ? ` · mejor mes: ${bestMonth.label}` : ''}</p>
                </div>
                {summary.methods.map(k => (
                  <div key={k} className="rounded-2xl border border-border p-3">
                    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES[k] }} aria-hidden />
                      {incomeMethodName(k)}
                    </p>
                    <p className="font-semibold tabular-nums">{money(summary.totals.byMethod[k] || 0)}</p>
                    <p className="text-xs text-muted-foreground">{Math.round(((summary.totals.byMethod[k] || 0) / summary.totals.total) * 100)}% del año</p>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `$${v}`} width={56} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.6 }}
                    content={({ active, payload }) => {
                      const d = active && (payload?.[0]?.payload as (typeof chartData)[number] | undefined);
                      if (!d) return null;
                      const row = d as unknown as Record<string, number>;
                      return (
                        <div className="min-w-[180px] rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-md">
                          <p className="mb-1 font-semibold">{d.full} · {money(d.total)}</p>
                          {summary.methods.filter(k => row[k] > 0).map(k => (
                            <p key={k} className="flex items-center justify-between gap-3 tabular-nums">
                              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES[k] }} />{incomeMethodName(k)}</span>
                              <span>{money(row[k])}</span>
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  {summary.methods.map(k => (
                    <Bar key={k} dataKey={k} stackId="m" fill={SERIES[k]} stroke="hsl(var(--card))" strokeWidth={2} maxBarSize={40} name={incomeMethodName(k)} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tabla: cada mes con lo que entró por método (también en Bs) */}
      {!isLoading && !error && summary.totals.total > 0 && (
        <Card className="border-border">
          <CardContent className="space-y-3 p-4 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-serif text-base font-semibold">Detalle por mes</h3>
              <Button variant="outline" size="sm" className="h-10 gap-2 rounded-full" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Mes</th>
                    {summary.methods.map(k => (
                      <th key={k} className="px-2 py-2 text-right font-medium">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES[k] }} aria-hidden />{incomeMethodName(k)}</span>
                      </th>
                    ))}
                    <th className="py-2 pl-2 text-right font-semibold text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...summary.months].reverse().map(m => (
                    <tr key={m.key} className={cn('border-b border-border/60', m.total <= 0 && 'text-muted-foreground')}>
                      <td className="py-2 pr-3 font-medium">{m.label}</td>
                      {summary.methods.map(k => (
                        <td key={k} className="px-2 py-2 text-right tabular-nums">
                          {m.byMethod[k] ? money(m.byMethod[k]) : '—'}
                          {m.byMethodBs[k] ? <span className="block text-[11px] text-muted-foreground">{formatBS(m.byMethodBs[k])}</span> : null}
                        </td>
                      ))}
                      <td className="py-2 pl-2 text-right font-semibold tabular-nums">{m.total ? money(m.total) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="py-2 pr-3">Total {year}</td>
                    {summary.methods.map(k => <td key={k} className="px-2 py-2 text-right tabular-nums">{money(summary.totals.byMethod[k] || 0)}</td>)}
                    <td className="py-2 pl-2 text-right tabular-nums">{money(summary.totals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
