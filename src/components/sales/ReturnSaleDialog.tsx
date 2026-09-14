/**
 * ReturnSaleDialog — Modal de devolución manual de una venta/grupo.
 *
 * Recopila cantidades por línea, valida la UX y delega TODA la operación
 * financiera al RPC transaccional `process_sale_return` (única autoridad).
 * La UI nunca toca stock, ventas, pagos ni sale_returns directamente.
 *
 * Flujo: seleccionar cantidades + motivo → confirmar → llamar RPC → resultado.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { GroupedSale } from '@/pages/Sales';
import type { Sale, SaleReturnResult, SaleReturnType } from '@/types';

const REASON_OPTIONS = [
  'Producto devuelto',
  'Producto defectuoso',
  'Error en la venta',
  'Otro',
] as const;

export const returnableOf = (sale: Sale): number =>
  Math.max(0, Number(sale.quantity) - Number(sale.returned_quantity || 0));

// Normaliza una cantidad tecleada: entero >= 0, recortado a `max`.
export const clampReturnQty = (raw: string, max: number): number => {
  const digits = raw.replace(/[^0-9]/g, '');
  let n = digits === '' ? 0 : parseInt(digits, 10);
  if (Number.isNaN(n) || n < 0) n = 0;
  if (n > max) n = max;
  return n;
};

// devolucion_total sólo si, tras aplicar las cantidades, TODAS las líneas quedan
// completamente devueltas; en caso contrario, parcial.
export const computeReturnType = (
  items: Sale[],
  quantities: Record<string, number>
): SaleReturnType =>
  items.every(
    (sale) => Number(sale.returned_quantity || 0) + Math.trunc(quantities[sale.id] || 0) >= Number(sale.quantity)
  )
    ? 'devolucion_total'
    : 'devolucion_parcial';

export interface ReturnSaleDialogProps {
  group: GroupedSale | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    saleGroupId: string;
    items: { sale_id: string; quantity: number }[];
    returnType: SaleReturnType;
    reason: string | null;
    idempotencyKey: string;
  }) => Promise<SaleReturnResult>;
}

export function ReturnSaleDialog({ group, onOpenChange, onSubmit }: ReturnSaleDialogProps) {
  const open = !!group;

  const [step, setStep] = useState<'select' | 'confirm' | 'done'>('select');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reasonChoice, setReasonChoice] = useState<string>('');
  const [reasonOther, setReasonOther] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<SaleReturnResult | null>(null);
  // Clave de idempotencia estable para un mismo intento (un reintento por error
  // de red reutiliza la clave; sólo se regenera si el usuario edita cantidades).
  const idempotencyKeyRef = useRef<string | null>(null);

  // Reiniciar todo el estado al abrir/cambiar de grupo.
  useEffect(() => {
    setStep('select');
    setQuantities({});
    setReasonChoice('');
    setReasonOther('');
    setProcessing(false);
    setErrorMsg(null);
    setResult(null);
    idempotencyKeyRef.current = null;
  }, [group?.id]);

  const items = useMemo(() => group?.items ?? [], [group]);

  const finalReason = useMemo(() => {
    if (reasonChoice === 'Otro') return reasonOther.trim();
    return reasonChoice.trim();
  }, [reasonChoice, reasonOther]);

  const selectedItems = useMemo(
    () =>
      items
        .map((sale) => ({ sale, qty: Math.trunc(quantities[sale.id] || 0) }))
        .filter((x) => x.qty > 0),
    [items, quantities]
  );

  const totalRefundPreviewUsd = useMemo(
    () =>
      selectedItems.reduce((sum, { sale, qty }) => {
        const returnable = returnableOf(sale);
        if (returnable <= 0) return sum;
        const frac = qty / returnable;
        return sum + Number(sale.total_usd) * frac;
      }, 0),
    [selectedItems]
  );

  // devolucion_total: tras esta devolución TODAS las líneas quedan totalmente
  // devueltas. En caso contrario, parcial.
  const returnType: SaleReturnType = useMemo(
    () => computeReturnType(items, quantities),
    [items, quantities]
  );

  const anySelected = selectedItems.length > 0;
  const reasonValid = reasonChoice !== '' && (reasonChoice !== 'Otro' || reasonOther.trim().length > 0);
  const canContinue = anySelected && reasonValid && !processing;

  const setQty = (saleId: string, raw: string, max: number) => {
    setQuantities((prev) => ({ ...prev, [saleId]: clampReturnQty(raw, max) }));
  };

  const handleClose = () => {
    if (processing) return; // no cerrar mientras procesa
    onOpenChange(false);
  };

  const goToConfirm = () => {
    if (!canContinue) return;
    setErrorMsg(null);
    // Nueva clave para este intento concreto (selección + motivo actuales).
    idempotencyKeyRef.current = crypto.randomUUID();
    setStep('confirm');
  };

  const backToSelect = () => {
    if (processing) return;
    // El usuario va a poder editar: invalidar la clave para no mezclar intentos.
    idempotencyKeyRef.current = null;
    setErrorMsg(null);
    setStep('select');
  };

  const handleConfirm = async () => {
    if (!group || processing) return;
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
    setProcessing(true);
    setErrorMsg(null);
    try {
      const res = await onSubmit({
        saleGroupId: group.id,
        items: selectedItems.map(({ sale, qty }) => ({ sale_id: sale.id, quantity: qty })),
        returnType,
        reason: finalReason || null,
        idempotencyKey: idempotencyKeyRef.current,
      });
      setResult(res);
      setStep('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo procesar la devolución';
      setErrorMsg(msg);
      // Se mantiene el paso de confirmación y la MISMA clave para permitir
      // reintentar el mismo intento de forma idempotente.
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : undefined)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'done' ? 'Devolución procesada' : 'Devolver venta'}
          </DialogTitle>
        </DialogHeader>

        {group && step === 'select' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Cliente:</span>{' '}
                {group.client_name || 'Sin nombre'}
              </p>
              <p>
                <span className="font-medium text-foreground">Fecha:</span>{' '}
                {new Date(group.created_at).toLocaleDateString('es-VE', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
              <p className="break-all">
                <span className="font-medium text-foreground">Grupo:</span> {group.id}
              </p>
            </div>

            <div className="space-y-3">
              {items.map((sale) => {
                const returnable = returnableOf(sale);
                const already = Number(sale.returned_quantity || 0);
                const disabled = returnable <= 0;
                return (
                  <div key={sale.id} className="rounded-lg border border-border/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm leading-tight">{sale.product_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Precio histórico: ${Number(sale.unit_price_usd).toFixed(2)} · Total línea: ${Number(sale.total_usd).toFixed(2)}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge variant="secondary">Vendidos: {sale.quantity}</Badge>
                          <Badge variant="secondary">Devueltos: {already}</Badge>
                          <Badge variant={disabled ? 'outline' : 'default'}>Disponibles: {returnable}</Badge>
                        </div>
                      </div>
                      <div className="flex-shrink-0 w-24">
                        <Label htmlFor={`ret-${sale.id}`} className="text-xs">A devolver</Label>
                        <Input
                          id={`ret-${sale.id}`}
                          inputMode="numeric"
                          type="text"
                          value={String(quantities[sale.id] ?? 0)}
                          onChange={(e) => setQty(sale.id, e.target.value, returnable)}
                          disabled={disabled}
                          className="mt-1 text-right"
                        />
                      </div>
                    </div>
                    {disabled && (
                      <p className="text-xs text-muted-foreground mt-2">Esta línea ya fue devuelta por completo.</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label>Motivo de la devolución</Label>
              <Select value={reasonChoice} onValueChange={setReasonChoice}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reasonChoice === 'Otro' && (
                <Textarea
                  placeholder="Describe el motivo"
                  value={reasonOther}
                  onChange={(e) => setReasonOther(e.target.value)}
                  maxLength={500}
                />
              )}
            </div>

            {anySelected && (
              <p className="text-sm">
                Importe estimado a devolver:{' '}
                <span className="font-semibold">${totalRefundPreviewUsd.toFixed(2)}</span>{' '}
                <span className="text-xs text-muted-foreground">
                  ({returnType === 'devolucion_total' ? 'total' : 'parcial'})
                </span>
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={goToConfirm} disabled={!canContinue}>Continuar</Button>
            </DialogFooter>
          </div>
        )}

        {group && step === 'confirm' && (
          <div className="space-y-4">
            <p className="font-medium">Confirma la devolución</p>
            <div className="rounded-lg border border-border/50 p-3 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Cliente:</span> {group.client_name || 'Sin nombre'}</p>
              <div>
                <span className="text-muted-foreground">Productos:</span>
                <ul className="mt-1 list-disc list-inside">
                  {selectedItems.map(({ sale, qty }) => (
                    <li key={sale.id}>{qty} × {sale.product_name}</li>
                  ))}
                </ul>
              </div>
              <p><span className="text-muted-foreground">Motivo:</span> {finalReason || '—'}</p>
              <p><span className="text-muted-foreground">Tipo:</span> {returnType === 'devolucion_total' ? 'Devolución total' : 'Devolución parcial'}</p>
              <p><span className="text-muted-foreground">Importe estimado:</span> ${totalRefundPreviewUsd.toFixed(2)}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Esta operación actualizará el inventario y la cuenta asociada a la venta.
            </p>

            {errorMsg && (
              <p className="text-sm text-destructive break-words">{errorMsg}</p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={backToSelect} disabled={processing}>Volver</Button>
              <Button onClick={handleConfirm} disabled={processing}>
                {processing ? 'Procesando…' : 'Confirmar devolución'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 p-3 space-y-1.5 text-sm">
              <p className="font-medium text-foreground">Devolución registrada correctamente.</p>
              <p><span className="text-muted-foreground">Importe devuelto:</span> ${Number(result.total_usd).toFixed(2)}</p>
              {result.idempotent && (
                <p className="text-xs text-muted-foreground">Esta devolución ya había sido registrada (idempotente).</p>
              )}
              {Number(result.refund_due_usd) > 0 && (
                <p className="text-amber-600 dark:text-amber-500">
                  Existe un monto pendiente de reembolso de ${Number(result.refund_due_usd).toFixed(2)}.
                  No se ejecuta ningún reembolso automáticamente.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
