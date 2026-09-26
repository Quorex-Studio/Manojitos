import { Download, Share, Printer } from 'reicon-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BRAND, BRAND_NAME } from '@/config/brand';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  type ReceiptData, STATUS_LABEL, buildReceiptPdf, paymentDetail, paymentLabel, receiptFileName, receiptTotals, receiptWhatsappText,
} from '@/lib/receipt';
import { whatsappLink } from '@/components/customers/customerUi';
import { formatPhone } from '@/lib/venezuela';

const money = (n: number) => `$${n.toFixed(2)}`;

interface ReceiptDialogProps {
  data: ReceiptData | null;
  onClose: () => void;
}

/** Acciones del recibo: descargar el PDF, compartirlo (archivo o WhatsApp) e imprimir. */
export function receiptActions(data: ReceiptData) {
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

  return { download, share, print };
}

/** Botones del recibo (Imprimir · Compartir · PDF). */
export function ReceiptActions({ data, className }: { data: ReceiptData; className?: string }) {
  const { download, share, print } = receiptActions(data);
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      <Button variant="outline" className="rounded-full" onClick={print}><Printer className="mr-1.5 h-4 w-4" />Imprimir</Button>
      <Button variant="outline" className="rounded-full" onClick={share}><Share className="mr-1.5 h-4 w-4" />Compartir</Button>
      <Button className="rounded-full" onClick={download}><Download className="mr-1.5 h-4 w-4" />PDF</Button>
    </div>
  );
}

/**
 * El recibo tal como se ve en pantalla (mismas cifras que el PDF). Lo usan la ventana de recibo
 * (Mis pedidos, Ventas) y la pantalla de compra exitosa, así todas las facturas son iguales.
 */
export function ReceiptView({ data }: { data: ReceiptData }) {
  const { subtotal, paid, balance } = receiptTotals(data);
  return (
    <>
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

        {(data.customerName || data.paymentMethod || !!data.details?.length) && (
          <dl className="space-y-1 text-xs">
            {data.customerName && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Cliente</dt><dd className="text-right font-medium">{data.customerName}</dd></div>}
            {data.customerPhone && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Teléfono</dt><dd className="text-right tabular-nums">{formatPhone(data.customerPhone)}</dd></div>}
            {data.paymentMethod && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pago</dt><dd className="text-right">{paymentLabel(data.paymentMethod)}</dd></div>}
            {data.details?.map(d => (
              <div key={d.label} className="flex justify-between gap-3"><dt className="shrink-0 text-muted-foreground">{d.label}</dt><dd className="text-right">{d.value}</dd></div>
            ))}
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
        </dl>

        {!!data.payments?.length && (
          <div className="rounded-xl bg-studio p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary">Abonos</p>
            <ul className="space-y-1.5 text-xs">
              {data.payments.map((p, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">{paymentDetail(p)}</span>
                  <span className="shrink-0 font-medium tabular-nums">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(balance > 0 || !!data.payments?.length) && (
          <dl className="space-y-1 tabular-nums">
            <div className="flex justify-between text-muted-foreground"><dt>Abonado</dt><dd>{money(paid)}</dd></div>
            <div className="flex justify-between font-semibold text-primary">
              <dt>{balance > 0 ? 'Saldo pendiente' : 'Saldo'}</dt><dd>{balance > 0 ? money(balance) : 'Pagada'}</dd>
            </div>
          </dl>
        )}

        <p className="text-center text-xs text-muted-foreground">¡Gracias por tu compra en {BRAND_NAME}! · {BRAND.domain}</p>
      </div>
    </>
  );
}

/** Recibo en una ventana, con sus acciones abajo. */
export function ReceiptDialog({ data, onClose }: ReceiptDialogProps) {
  if (!data) return null;
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-sm max-sm:!pb-0">
        <DialogTitle className="sr-only">Recibo {data.number}</DialogTitle>
        <DialogDescription className="sr-only">Detalle del recibo con opciones para descargar y compartir</DialogDescription>
        <ReceiptView data={data} />
        <ReceiptActions data={data} className="sticky bottom-0 border-t border-border bg-background p-3" />
      </DialogContent>
    </Dialog>
  );
}
