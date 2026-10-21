import { useState } from 'react';
import { Loader } from 'reicon-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { missingMigration, usePurchasingActions, type PurchaseRow } from '@/hooks/usePurchasing';
import { PURCHASE_METHODS, purchaseMethodName } from '@/components/purchases/purchaseMethods';
import { formatBS } from '@/lib/utils';

const money = (n: number) => `$${Number(n).toFixed(2)}`;
const day = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' });

/** Detalle de una compra: productos, costos, pagos y abonar lo que falta. */
export function PurchaseDetailDialog({ purchase, onOpenChange }: { purchase: PurchaseRow | null; onOpenChange: (open: boolean) => void }) {
  const { rate } = useExchangeRate();
  const { payPurchase } = usePurchasingActions();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('zelle');
  const balance = purchase ? Math.max(0, Math.round((Number(purchase.amount_usd) - Number(purchase.amount_paid)) * 100) / 100) : 0;

  const pay = async () => {
    if (!purchase) return;
    const value = Math.min(Number(amount.replace(',', '.')) || 0, balance);
    if (value <= 0) return;
    try {
      await payPurchase.mutateAsync({ purchaseId: purchase.id, amountUsd: value, amountBs: rate > 0 ? Math.round(value * rate * 100) / 100 : null, method });
      toast.success(value >= balance - 0.004 ? 'Compra pagada' : 'Pago registrado', { description: `${money(value)} a ${purchase.provider_name}` });
      setAmount('');
      onOpenChange(false);
    } catch (e) {
      toast.error('No se pudo registrar el pago', { description: missingMigration(e) ? 'Falta aplicar la migración de compras y gastos.' : e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });
    }
  };

  return (
    <Dialog open={!!purchase} onOpenChange={o => { onOpenChange(o); if (!o) setAmount(''); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {purchase && (
          <>
            <DialogHeader>
              <DialogTitle>{purchase.provider_name}</DialogTitle>
              <DialogDescription>{day(purchase.purchase_date)}{purchase.notes ? ` · ${purchase.notes}` : ''}</DialogDescription>
            </DialogHeader>

            {purchase.purchase_items.length > 0 && (
              <ul className="divide-y divide-border rounded-2xl border border-border">
                {purchase.purchase_items.map(i => (
                  <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{i.product_name}{i.variant_label ? ` · ${i.variant_label}` : ''}</p>
                      <p className="text-xs text-muted-foreground">{i.quantity} × {money(i.unit_cost_usd)} neto · {money(i.landed_unit_cost_usd)} c/u con impuesto y envío</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{money(i.quantity * i.unit_cost_usd)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-1 rounded-2xl bg-studio p-4 text-sm">
              {purchase.subtotal_usd != null && <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(purchase.subtotal_usd)}</span></div>}
              {Number(purchase.tax_usd) > 0 && <div className="flex justify-between text-muted-foreground"><span>Impuesto {Number(purchase.tax_pct)}%</span><span className="tabular-nums">{money(purchase.tax_usd)}</span></div>}
              {Number(purchase.shipping_usd) > 0 && <div className="flex justify-between text-muted-foreground"><span>Envío</span><span className="tabular-nums">{money(purchase.shipping_usd)}</span></div>}
              <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span className="tabular-nums">{money(purchase.amount_usd)}</span></div>
              <div className="flex justify-between"><span>Pagado</span><span className="tabular-nums">{money(purchase.amount_paid)}</span></div>
              {balance > 0 && <div className="flex justify-between font-semibold text-sale"><span>Por pagar{purchase.due_date ? ` · vence ${day(purchase.due_date)}` : ''}</span><span className="tabular-nums">{money(balance)}</span></div>}
            </div>

            {purchase.purchase_payments.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-semibold">Pagos</p>
                <ul className="space-y-1 text-sm">
                  {[...purchase.purchase_payments].sort((a, b) => a.paid_at.localeCompare(b.paid_at)).map(p => (
                    <li key={p.id} className="flex justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
                      <span>{day(p.paid_at)} · {purchaseMethodName(p.payment_method)}</span>
                      <span className="tabular-nums">{money(p.amount_usd)}{p.amount_bs ? <span className="ml-1 text-xs text-muted-foreground">{formatBS(Number(p.amount_bs))}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {balance > 0 && (
              <div className="space-y-2 rounded-2xl border border-border p-3">
                <p className="text-sm font-semibold">Registrar pago</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="pp-amount">Monto ($)</Label>
                    <Input id="pp-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10))} placeholder={balance.toFixed(2)} className="h-11 w-32 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pp-method">Método</Label>
                    <select id="pp-method" value={method} onChange={e => setMethod(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm">
                      {PURCHASE_METHODS.map(m => <option key={m} value={m}>{purchaseMethodName(m)}</option>)}
                    </select>
                  </div>
                  <Button variant="outline" className="h-11 rounded-full" onClick={() => setAmount(balance.toFixed(2))}>Todo</Button>
                  <Button className="h-11 gap-2 rounded-full" disabled={!(Number(amount.replace(',', '.')) > 0) || payPurchase.isPending} onClick={() => void pay()}>
                    {payPurchase.isPending && <Loader className="h-4 w-4 animate-spin" />}Pagar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
