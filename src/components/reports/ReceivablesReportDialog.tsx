import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer, Share, FileText, Loader } from 'reicon-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { loadReceivablesReport, receivablesPdfActions, receivablesQueryKey } from '@/lib/receivablesData';
import { AGING_RANGES, agingIndex, type BuildReportOptions, type ReceivablesReport } from '@/lib/receivablesReport';

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Colores de los tramos de antigüedad (tokens): reciente → muy atrasada. Rojo = dinero en riesgo. */
const AGING_CLASSES = ['bg-success', 'bg-gold-light', 'bg-gold', 'bg-sale'] as const;

/** Barra apilada de antigüedad + leyenda tocable (misma lectura que el PDF). */
export function AgingBar({ report, className }: { report: ReceivablesReport; className?: string }) {
  const total = report.totals.balance || 1;
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary" role="img"
        aria-label={report.aging.map(b => `${b.label}: ${money(b.amount)}`).join(', ')}>
        {report.aging.map((b, i) => b.amount > 0 && (
          <div key={b.label} className={AGING_CLASSES[i]} style={{ width: `${(b.amount / total) * 100}%` }} />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        {report.aging.map((b, i) => (
          <div key={b.label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', AGING_CLASSES[i])} />{b.label}
            </dt>
            <dd className="font-semibold tabular-nums">{money(b.amount)} <span className="font-normal text-muted-foreground">· {b.count}</span></dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Estado de cuenta de una sola clienta; vacío = todas */
  clientName?: string | null;
  sort?: BuildReportOptions['sort'];
}

/**
 * Vista previa del reporte de Cuentas por cobrar con sus acciones (PDF, compartir, imprimir).
 * Lo que se ve aquí es exactamente lo que trae el PDF.
 */
export function ReceivablesReportDialog({ open, onOpenChange, clientName, sort = 'saldo' }: Props) {
  const { data: report, isLoading, isError, refetch } = useQuery({
    queryKey: receivablesQueryKey(clientName, sort),
    queryFn: () => loadReceivablesReport({ clientName, sort }),
    enabled: open,
    staleTime: 0, // al abrir siempre trae los abonos recién registrados
  });
  // El agrupado solo cambia cómo se arma el PDF: no hace falta volver a pedir los datos
  const [groupBy, setGroupBy] = useState<'clienta' | 'categoria'>('clienta');
  const actions = report ? receivablesPdfActions({ ...report, groupBy }) : null;
  const single = !!report?.clientFilter;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-lg">
        <div className="min-w-0 bg-primary px-6 py-5 text-primary-foreground">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="font-serif text-2xl font-medium">
              {single ? `Estado de cuenta` : 'Cuentas por cobrar'}
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80">
              {single ? report?.clientFilter : 'Reporte en PDF estilo factura, listo para imprimir o enviar'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-w-0 space-y-5 px-6 pb-6 pt-5">
          {isLoading && (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader className="h-4 w-4 animate-spin" /> Armando el reporte…
            </p>
          )}
          {isError && (
            <div className="space-y-3 py-6 text-center text-sm">
              <p className="text-muted-foreground">No se pudo cargar el reporte. Revisa tu conexión.</p>
              <Button variant="outline" className="rounded-full" onClick={() => refetch()}>Reintentar</Button>
            </div>
          )}

          {report && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Total por cobrar</p>
                <p className="font-serif text-4xl font-semibold tabular-nums">{money(report.totals.balance)}</p>
                {report.rate && <p className="text-sm text-muted-foreground tabular-nums">{bs(report.totals.balance * report.rate)} · tasa BCV</p>}
                <p className="mt-1 text-sm text-muted-foreground">
                  {report.totals.clients} {report.totals.clients === 1 ? 'clienta' : 'clientas'} · {report.totals.invoices} {report.totals.invoices === 1 ? 'factura' : 'facturas'}
                  {report.totals.paid > 0 && <> · abonado {money(report.totals.paid)}</>}
                  {report.totals.invoices > 0 && <> · {report.totals.averageDays} días en promedio</>}
                </p>
              </div>

              {report.totals.invoices > 0 ? (
                <>
                  <AgingBar report={report} />
                  {!single && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{report.insights.partial.count}</span> con abono parcial ·{' '}
                      <span className="font-medium text-sale">{report.insights.unpaid.count}</span> sin abonos ({money(report.insights.unpaid.amount)})
                      {report.insights.overdue.count > 0 && <> · <span className="font-medium text-foreground">{report.insights.overdue.count}</span> con más de 30 días</>}
                    </p>
                  )}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {single ? 'Facturas' : 'Quién debe más'}
                    </p>
                    <ul className="divide-y divide-border rounded-2xl border border-border">
                      {(single ? report.clients[0].invoices.map(inv => ({ key: inv.id, title: `${inv.number} · ${inv.date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}`, sub: inv.items.map(i => `${i.quantity} × ${i.name}`).join(', '), amount: inv.balance, days: inv.days }))
                        : report.clients.slice(0, 5).map(c => ({ key: c.key, title: c.name, sub: `${c.invoices.length} ${c.invoices.length === 1 ? 'factura' : 'facturas'} · la más antigua de ${c.oldestDays} días`, amount: c.balance, days: c.oldestDays }))
                      ).map(row => (
                        <li key={row.key} className="flex items-center gap-3 px-4 py-2.5">
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', AGING_CLASSES[agingIndex(row.days)])} title={AGING_RANGES[agingIndex(row.days)].hint} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{row.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{row.sub}</p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold tabular-nums">{money(row.amount)}</p>
                        </li>
                      ))}
                    </ul>
                    {!single && report.clients.length > 5 && (
                      <p className="mt-2 text-xs text-muted-foreground">Y {report.clients.length - 5} más en el PDF, con el detalle de cada factura y sus abonos.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-2xl bg-success/10 px-4 py-6 text-center text-sm font-medium text-success">
                  Todo está al día: no hay saldos pendientes.
                </p>
              )}

              {!single && report.totals.invoices > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Detalle del PDF por</p>
                  <div className="flex rounded-full bg-secondary p-1" role="radiogroup" aria-label="Agrupar el detalle del PDF">
                    {([['clienta', 'Clienta'], ['categoria', 'Categoría']] as const).map(([value, label]) => (
                      <button key={value} type="button" role="radio" aria-checked={groupBy === value} onClick={() => setGroupBy(value)}
                        className={cn('h-9 rounded-full px-4 text-sm font-medium transition-colors',
                          groupBy === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {actions && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Button variant="outline" className="rounded-full" onClick={actions.print}><Printer className="mr-1.5 h-4 w-4" />Imprimir</Button>
                  <Button variant="outline" className="rounded-full" onClick={actions.share}><Share className="mr-1.5 h-4 w-4" />Enviar</Button>
                  <Button className="rounded-full" onClick={actions.download}><Download className="mr-1.5 h-4 w-4" />PDF</Button>
                </div>
              )}
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                El PDF trae encabezado de la tienda, resumen, antigüedad de la deuda, {single ? 'cada factura con su estado, sus abonos y firmas' : groupBy === 'categoria' ? 'resumen por clienta, una sección por categoría con notas, balance por categoría y cuentas prioritarias' : 'resumen por clienta con su estado, cada factura con sus abonos, balance por categoría y cuentas prioritarias'}.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
