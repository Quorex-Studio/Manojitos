import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight2, FileText, Loader, MoneyRecive, MoneySend, Truck, Wallet } from 'reicon-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReceivablesReportDialog } from '@/components/reports/ReceivablesReportDialog';
import { PurchaseDetailDialog } from '@/components/purchases/PurchaseDetailDialog';
import { PURCHASE_METHODS, purchaseMethodName } from '@/components/purchases/purchaseMethods';
import { useSales } from '@/hooks/useSales';
import { missingMigration, useExpenses, usePurchasesDetail, usePurchasingActions, type ExpenseRow, type PurchaseRow } from '@/hooks/usePurchasing';
import { buildReceivablesReport } from '@/lib/receivablesReport';
import { localDateISO } from '@/lib/dates';
import { cn } from '@/lib/utils';

const money = (n: number) => `$${Number(n).toFixed(2)}`;
const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });

type Payable = { key: string; kind: 'compra' | 'gasto'; title: string; detail: string; balance: number; due: string | null; date: string; purchase?: PurchaseRow; expense?: ExpenseRow };

/** Cuentas por pagar (compras con saldo y gastos pendientes) y por cobrar (ventas con saldo). */
export default function Accounts() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'cobrar' ? 'cobrar' : 'pagar';
  const today = localDateISO();
  const { sales } = useSales();
  const { data: purchasesData, isLoading: loadingPurchases } = usePurchasesDetail();
  const { expenses, categories } = useExpenses();
  const { payExpense } = usePurchasingActions();
  const [openPurchase, setOpenPurchase] = useState<PurchaseRow | null>(null);
  const [payingExpense, setPayingExpense] = useState<ExpenseRow | null>(null);
  const [expenseMethod, setExpenseMethod] = useState('efectivo_usd');
  const [reportOpen, setReportOpen] = useState(false);

  const receivables = useMemo(() => buildReceivablesReport(sales), [sales]);
  const catName = (id: string | null) => categories.data?.find(c => c.id === id)?.name ?? 'Gasto';

  const payables = useMemo<Payable[]>(() => {
    const fromPurchases = (purchasesData?.rows ?? [])
      .map(p => ({ p, balance: Math.round((Number(p.amount_usd) - Number(p.amount_paid)) * 100) / 100 }))
      .filter(x => x.balance > 0.009)
      .map(({ p, balance }) => ({
        key: `c-${p.id}`, kind: 'compra' as const, title: p.provider_name,
        detail: `Compra del ${short(p.purchase_date)} · total ${money(p.amount_usd)}${Number(p.amount_paid) > 0 ? ` · pagado ${money(p.amount_paid)}` : ''}`,
        balance, due: p.due_date, date: p.purchase_date, purchase: p,
      }));
    const fromExpenses = (expenses.data ?? []).filter(e => e.status === 'pending').map(e => ({
      key: `g-${e.id}`, kind: 'gasto' as const, title: e.description, detail: `${catName(e.category_id)} · ${short(e.expense_date)}`,
      balance: Number(e.amount_usd), due: e.due_date, date: e.expense_date, expense: e,
    }));
    // Primero lo vencido y lo que vence antes; sin fecha, al final por antigüedad
    return [...fromPurchases, ...fromExpenses].sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.date.localeCompare(b.date));
  }, [purchasesData, expenses.data, categories.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPayable = payables.reduce((s, p) => s + p.balance, 0);
  const overdue = payables.filter(p => p.due && p.due < today);
  const totalReceivable = receivables.totals.balance;

  const confirmExpense = async () => {
    if (!payingExpense) return;
    try {
      await payExpense.mutateAsync({ id: payingExpense.id, method: expenseMethod });
      toast.success('Gasto pagado', { description: `${payingExpense.description} · ${money(payingExpense.amount_usd)}` });
      setPayingExpense(null);
    } catch (e) {
      toast.error('No se pudo marcar pagado', { description: missingMigration(e) ? 'Falta aplicar la migración de compras y gastos.' : e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="page-header">Cuentas por pagar y por cobrar</h1>
          <p className="page-subtitle">Lo que debes a proveedores y gastos pendientes, y lo que te deben tus clientes</p>
        </div>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => setParams({}, { replace: true })} className={cn('rounded-2xl border bg-card p-4 text-left transition-colors', tab === 'pagar' ? 'border-primary' : 'border-border hover:border-primary/40')}>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"><MoneySend className="h-4 w-4" />Por pagar</p>
            <p className="font-serif text-2xl font-semibold tabular-nums text-sale">{money(totalPayable)}</p>
            <p className="text-xs text-muted-foreground">{payables.length} {payables.length === 1 ? 'cuenta' : 'cuentas'}{overdue.length ? ` · ${overdue.length} vencidas` : ''}</p>
          </button>
          <button type="button" onClick={() => setParams({ tab: 'cobrar' }, { replace: true })} className={cn('rounded-2xl border bg-card p-4 text-left transition-colors', tab === 'cobrar' ? 'border-primary' : 'border-border hover:border-primary/40')}>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"><MoneyRecive className="h-4 w-4" />Por cobrar</p>
            <p className="font-serif text-2xl font-semibold tabular-nums text-primary">{money(totalReceivable)}</p>
            <p className="text-xs text-muted-foreground">{receivables.totals.clients} {receivables.totals.clients === 1 ? 'cliente' : 'clientes'} · {receivables.totals.invoices} {receivables.totals.invoices === 1 ? 'factura' : 'facturas'}</p>
          </button>
          <div className="rounded-2xl border border-border bg-studio p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"><Wallet className="h-4 w-4" />Balance</p>
            <p className={cn('font-serif text-2xl font-semibold tabular-nums', totalReceivable - totalPayable >= 0 ? 'text-success' : 'text-sale')}>{money(totalReceivable - totalPayable)}</p>
            <p className="text-xs text-muted-foreground">Por cobrar menos por pagar</p>
          </div>
        </section>

        <Tabs value={tab} onValueChange={v => setParams(v === 'cobrar' ? { tab: 'cobrar' } : {}, { replace: true })}>
          <TabsList className="admin-tabs">
            <TabsTrigger value="pagar"><MoneySend className="h-4 w-4" />Por pagar</TabsTrigger>
            <TabsTrigger value="cobrar"><MoneyRecive className="h-4 w-4" />Por cobrar</TabsTrigger>
          </TabsList>

          <TabsContent value="pagar" className="mt-4">
            {loadingPurchases || expenses.isLoading ? (
              <div className="flex justify-center py-12"><Loader className="h-6 w-6 animate-spin text-primary" /></div>
            ) : payables.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                No debes nada. Las compras que no pagas completas y los gastos «por pagar» aparecen aquí.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {payables.map(p => {
                  const late = !!p.due && p.due < today;
                  return (
                    <li key={p.key} className="flex items-center gap-3 px-4 py-3">
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', p.kind === 'compra' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground')}>
                        {p.kind === 'compra' ? <Truck className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.detail}</p>
                        {p.due && <p className={cn('text-xs font-medium', late ? 'text-sale' : 'text-muted-foreground')}>{late ? 'Venció' : 'Vence'} el {short(p.due)}</p>}
                      </div>
                      <p className="font-semibold tabular-nums text-sale">{money(p.balance)}</p>
                      <Button size="sm" className="h-10 rounded-full" onClick={() => (p.purchase ? setOpenPurchase(p.purchase) : p.expense && setPayingExpense(p.expense))}>Pagar</Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="cobrar" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-10 gap-2 rounded-full" onClick={() => setReportOpen(true)}><FileText className="h-4 w-4" />Reporte en PDF</Button>
              <Button asChild variant="outline" className="h-10 gap-2 rounded-full"><Link to="/sales?tab=cuentas-cobrar">Cobrar y abonar en Ventas<ArrowRight2 className="h-4 w-4" /></Link></Button>
            </div>
            {receivables.clients.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">Nadie te debe. Las ventas fiadas, en 2 partes o financiadas con saldo aparecen aquí.</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {receivables.clients.map(c => (
                  <li key={c.key} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.invoices.length} {c.invoices.length === 1 ? 'factura' : 'facturas'} · abonado {money(c.paid)} de {money(c.total)}
                        {c.oldestDays > 0 ? ` · la más vieja hace ${c.oldestDays} días` : ''}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums text-primary">{money(c.balance)}</p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <PurchaseDetailDialog purchase={openPurchase} onOpenChange={o => { if (!o) setOpenPurchase(null); }} />
      <ReceivablesReportDialog open={reportOpen} onOpenChange={setReportOpen} />

      <Dialog open={!!payingExpense} onOpenChange={o => { if (!o) setPayingExpense(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pagar gasto</DialogTitle>
            <DialogDescription>{payingExpense?.description} · {payingExpense ? money(payingExpense.amount_usd) : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ac-method">¿Con qué pagaste?</Label>
            <select id="ac-method" value={expenseMethod} onChange={e => setExpenseMethod(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
              {PURCHASE_METHODS.map(m => <option key={m} value={m}>{purchaseMethodName(m)}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-full" onClick={() => setPayingExpense(null)}>Cancelar</Button>
            <Button className="h-11 gap-2 rounded-full" disabled={payExpense.isPending} onClick={() => void confirmExpense()}>
              {payExpense.isPending && <Loader className="h-4 w-4 animate-spin" />}Marcar pagado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
