import { Download, Share, Printer } from 'reicon-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BRAND, BRAND_NAME } from '@/config/brand';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  type ReceiptData, STATUS_LABEL, buildReceiptPdf, paymentLabel, receiptFileName, receiptTotals, receiptWhatsappText,
} from '@/lib/receipt';
import { whatsappLink } from '@/components/customers/customerUi';
import { formatPhone } from '@/lib/venezuela';

const money = (n: number) => `$${n.toFixed(2)}`;

interface ReceiptDialogProps {
  data: ReceiptData | null;
  onClose: () => void;
}

/**
 * Recibo en pantalla con las mismas cifras del PDF. Acciones: descargar el PDF, compartirlo
 * (en el teléfono abre el menú de compartir con el archivo; si no se puede, WhatsApp con el
 * texto) e imprimir.
 */
export function ReceiptDialog({ data, onClose }: ReceiptDialogProps) {
  if (!data) return null;
  const { subtotal, paid, balance } = receiptTotals(data);

  const download = () => buildReceiptPdf(data).save(receiptFileName(data));

  const share = async () => {
    const text = receiptWhatsappText(data);
    try {
      const blob = buildReceiptPdf(data).output('blob');
      const file = new File([blob], receiptFileName(data), { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Recibo ${data.number}`, text });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return; // la persona cerró el menú
    }
    // Escritorio o navegador sin compartir archivos: WhatsApp con el texto del recibo
    const phoneLink = data.customerPhone ? whatsappLink(data.customerPhone) : '';
    const base = phoneLink || 'https://wa.me/';
    window.open(`${base}${base.includes('?') ? '&' : '?'}text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const print = () => {
    const url = URL.createObjectURL(buildReceiptPdf(data).output('blob'));
    const win = window.open(url, '_blank');
    if (!win) {
      toast.error('Permite las ventanas emergentes para imprimir, o descarga el PDF.');
      return;
    }
    win.addEventListener('load', () => win.print());
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-sm max-sm:!pb-0">
        <DialogTitle className="sr-only">Recibo {data.number}</DialogTitle>
        <DialogDescription className="sr-only">Detalle del recibo con opciones para descargar y compartir</DialogDescription>

        <div className="bg-primary px-6 py-5 text-center text-primary-foreground">
          <p className="font-serif text-2xl tracking-[0.12em]">{BRAND_NAME.toUpperCase()}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] opacity-80">{BRAND.category}</p>
        </div>

        <div className="space-y-4 px-6 py-5 text-sm">
          <div className="text-center">
            <p className="font-semibold">{data.kind === 'pedido' ? 'Recibo de compra' : 'Recibo de venta'}</p>
            <p className="text-xs text-muted-foreground">
              {data.number} · {data.date.toLocaleDateString('es-VE')} {data.date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {data.status && (
              <span className={cn(
                'mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-semibold',
                data.status === 'pagado' ? 'bg-success/15 text-success' : 'bg-secondary text-foreground'
              )}>{STATUS_LABEL[data.status]}</span>
            )}
          </div>

          {(data.customerName || data.paymentMethod) && (
            <dl className="space-y-1 text-xs">
              {data.customerName && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Cliente</dt><dd className="text-right font-medium">{data.customerName}</dd></div>}
              {data.customerPhone && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Teléfono</dt><dd className="text-right tabular-nums">{formatPhone(data.customerPhone)}</dd></div>}
              {data.paymentMethod && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pago</dt><dd className="text-right">{paymentLabel(data.paymentMethod)}</dd></div>}
            </dl>
          )}

          <ul className="divide-y divide-border border-y border-border">
            {data.items.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="leading-snug">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity} × {money(item.unitPrice)}</p>
                </div>
                <p className="shrink-0 font-medium tabular-nums">{money(item.quantity * item.unitPrice)}</p>
              </li>
            ))}
          </ul>

          <dl className="space-y-1 tabular-nums">
            {!!data.delivery && (
              <>
                <div className="flex justify-between text-muted-foreground"><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
                <div className="flex justify-between text-muted-foreground"><dt>Delivery</dt><dd>{money(data.delivery)}</dd></div>
              </>
            )}
            <div className="flex justify-between font-serif text-lg font-semibold"><dt>Total</dt><dd>{money(data.total)}</dd></div>
            {!!data.totalBs && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <dt>Total en bolívares</dt>
                <dd>Bs {data.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
              </div>
            )}
            {balance > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground"><dt>Abonado</dt><dd>{money(paid)}</dd></div>
                <div className="flex justify-between font-semibold text-primary"><dt>Saldo pendiente</dt><dd>{money(balance)}</dd></div>
              </>
            )}
          </dl>

          <p className="text-center text-xs text-muted-foreground">¡Gracias por tu compra en {BRAND_NAME}! · {BRAND.domain}</p>
        </div>

        <div className="sticky bottom-0 grid grid-cols-3 gap-2 border-t border-border bg-background p-3">
          <Button variant="outline" className="rounded-full" onClick={print}><Printer className="mr-1.5 h-4 w-4" />Imprimir</Button>
          <Button variant="outline" className="rounded-full" onClick={share}><Share className="mr-1.5 h-4 w-4" />Compartir</Button>
          <Button className="rounded-full" onClick={download}><Download className="mr-1.5 h-4 w-4" />PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
