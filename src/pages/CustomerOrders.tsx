import { BRAND_WHATSAPP_URL } from '@/config/brand';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TickCircle, Location, Loader, Package, Truck, Clock, XCircle, ArrowLeft, Refresh, ShoppingBag, Receipt, MessageSquare } from 'reicon-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useState } from 'react';
import { StoreLayout } from '@/components/store/StoreLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { useAuth } from '@/hooks/useAuth';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { cn } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';
import { ReceiptDialog } from '@/components/receipts/ReceiptDialog';
import { receiptNumber, type ReceiptData, type ReceiptPayment } from '@/lib/receipt';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem } from '@/types';

type ExtendedOrderItem = OrderItem & { id?: string; price?: number; price_usd?: number };

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En revisión', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  confirmed: { label: 'Confirmado', color: 'bg-primary/10 text-primary' },
  processing: { label: 'Preparando', color: 'bg-primary/10 text-primary' },
  shipped: { label: 'En camino', color: 'bg-primary/15 text-primary' },
  delivered: { label: 'Entregado', color: 'bg-success/15 text-success' },
  cancelled: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive' },
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  paid: { label: 'Pagado', color: 'text-success' },
  pending: { label: 'Pago por confirmar', color: 'text-amber-700 dark:text-amber-400' },
  failed: { label: 'Pago rechazado', color: 'text-destructive' },
};

// Recorrido del pedido: cada estado marca hasta qué paso llegó
const ORDER_STEPS = [
  { label: 'Recibido', hint: 'Recibimos tu pedido y estamos verificando el pago.', icon: Clock },
  { label: 'Confirmado', hint: 'Pago confirmado. Estamos preparando tu pedido.', icon: Package },
  { label: 'En camino', hint: 'Tu pedido va en camino (delivery o MRW).', icon: Truck },
  { label: 'Entregado', hint: '¡Listo! Disfruta tu compra.', icon: Location },
];
const STEP_INDEX: Record<string, number> = { pending: 0, confirmed: 1, processing: 1, shipped: 2, delivered: 3 };

const isActiveOrder = (o: Order) => !['delivered', 'cancelled'].includes(o.status);

function OrderProgress({ status }: { status: string }) {
  const current = STEP_INDEX[status] ?? 0;
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Progreso del pedido">
      {ORDER_STEPS.map((step, i) => (
        <li key={step.label} className="min-w-0">
          <div className={cn('h-1.5 rounded-full', i <= current ? 'bg-primary' : 'bg-muted')} />
          <p className={cn('mt-1.5 truncate text-[11px]', i === current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{step.label}</p>
        </li>
      ))}
    </ol>
  );
}

export default function CustomerOrders() {
  // --- DERIVED ---
  const { user } = useAuth();
  const { orders, isLoading } = useCustomerOrders();
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');

  // --- RENDER ---

  if (!user) {
    return (
      <StoreLayout>
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso requerido</h1>
          <p className="text-muted-foreground mb-6">Debes iniciar sesión para ver tus pedidos</p>
          <Link to="/cliente/auth">
            <Button>Iniciar Sesión</Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="container py-12 flex items-center justify-center">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  const counts = {
    all: orders.length,
    active: orders.filter(isActiveOrder).length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };
  const visible = orders.filter(o =>
    filter === 'all' ? true : filter === 'active' ? isActiveOrder(o) : o.status === filter
  );
  const spent = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_usd || 0), 0);

  return (
    <StoreLayout>
      <div className="container max-w-3xl py-6 md:py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="flex items-center gap-3">
            <Link to="/cliente/perfil" aria-label="Volver a mi cuenta">
              <Button variant="ghost" size="icon" className="shrink-0 rounded-full"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-semibold md:text-3xl">Mis pedidos</h1>
              <p className="text-sm text-muted-foreground">Sigue tus compras y descarga tus recibos</p>
            </div>
          </div>

          {orders.length > 0 && (
            <section className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card p-4">
              {([
                ['Pedidos', String(counts.all)],
                ['En curso', String(counts.active)],
                ['Invertido', `$${spent.toFixed(2)}`],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="min-w-0 px-2 text-center first:pl-0 last:pr-0">
                  <p className="truncate font-serif text-xl font-semibold tabular-nums md:text-2xl">{value}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                </div>
              ))}
            </section>
          )}

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:px-0" role="tablist" aria-label="Filtrar pedidos">
            {([
              ['all', 'Todos'],
              ['active', 'En curso'],
              ['delivered', 'Entregados'],
              ['cancelled', 'Cancelados'],
            ] as [keyof typeof counts, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  'flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                  filter === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40'
                )}
              >
                {label}
                <span className={cn('tabular-nums', filter === key ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{counts[key]}</span>
              </button>
            ))}
          </div>

          <OrderList orders={visible} emptyAll={orders.length === 0} />
        </motion.div>
      </div>
    </StoreLayout>
  );
}

function OrderList({ orders, emptyAll }: { orders: ReturnType<typeof useCustomerOrders>['orders']; emptyAll: boolean }) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const handleReorder = (order: Order) => {
    const reorderableItems = (order.items as ExtendedOrderItem[] || []).filter(
      (it: ExtendedOrderItem) => it.product_id && it.id !== 'credit_payment' && it.id !== 'credit_request'
    );
    if (reorderableItems.length === 0) {
      toast.error('No se pudo volver a agregar los productos de este pedido.');
      return;
    }
    reorderableItems.forEach((it: ExtendedOrderItem) => {
      addItem({
        id: it.product_id,
        name: it.product_name,
        price_usd: Number(it.unit_price),
        quantity: it.quantity,
        image_url: it.image_url || null,
        stock: 999,
      });
    });
    toast.success('Productos agregados al carrito');
    navigate('/carrito');
  };
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [receiptPayments, setReceiptPayments] = useState<ReceiptPayment[]>([]);

  // Compra a crédito hecha en la tienda física: el recibo trae sus abonos uno por uno
  const openReceipt = async (order: Order) => {
    setReceiptPayments([]);
    setReceiptOrder(order);
    if (order.source !== 'sale' || !order.is_credit) return;
    const filters = [`sale_group_id.eq.${order.sale_group_id || order.id}`];
    if (order.sale_ids?.length) filters.push(`sale_id.in.(${order.sale_ids.join(',')})`);
    const { data, error } = await supabase
      .from('sale_payments')
      .select('amount_usd, amount_bs, payment_method, created_at, status')
      .or(filters.join(','))
      .order('created_at', { ascending: true });
    if (error) return;
    setReceiptPayments((data || [])
      .filter(p => (p as { status?: string }).status !== 'void')
      .map(p => ({ date: new Date(p.created_at ?? Date.now()), amount: Number(p.amount_usd), method: p.payment_method, amountBs: p.amount_bs ? Number(p.amount_bs) : null })));
  };
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);

  const getItemDisplay = (item: ExtendedOrderItem): { name: string; total: number } => {
    if (item.id === 'credit_payment') {
      return { name: 'Abono a tu línea de crédito', total: Number(item.price ?? item.price_usd ?? 0) };
    }
    if (item.id === 'credit_request') {
      return { name: 'Solicitud de línea de crédito', total: Number(item.price_usd ?? 0) };
    }
    return { name: item.product_name || 'Producto sin nombre', total: Number(item.total || 0) };
  };

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><ShoppingBag className="h-7 w-7" /></span>
        <h3 className="mt-4 font-serif text-lg font-semibold">{emptyAll ? 'Aún no tienes pedidos' : 'Nada por aquí'}</h3>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
          {emptyAll ? 'Cuando compres, aquí verás el estado de tu pedido y tu recibo.' : 'No hay pedidos en esta categoría.'}
        </p>
        {emptyAll && (
          <Link to="/tienda"><Button className="mt-5 rounded-full">Explorar la tienda</Button></Link>
        )}
      </div>
    );
  }

  const toReceipt = (order: Order): ReceiptData => {
    const items = (order.items || []) as ExtendedOrderItem[];
    const isSale = order.source === 'sale';
    const credit = isSale && order.is_credit;
    return {
      kind: isSale ? 'venta' : 'pedido',
      number: receiptNumber(order.id),
      date: new Date(order.created_at),
      customerName: order.customer_name,
      paymentMethod: order.payment_method,
      items: items.map(it => {
        const shown = getItemDisplay(it);
        const qty = Number(it.quantity) || 1;
        return { name: shown.name, quantity: qty, unitPrice: Number(it.unit_price ?? shown.total / qty) || 0 };
      }),
      delivery: Number(order.delivery_fee) || 0,
      total: Number(order.total_usd) || 0,
      totalBs: Number(order.total_bs) || null,
      ...(credit ? { paid: order.amount_paid ?? 0, payments: receiptPayments } : {}),
      status: order.payment_status === 'paid' ? 'pagado' : credit ? 'por_cobrar' : 'pendiente',
    };
  };

  return (
    <div className="space-y-4">
      {orders.map(order => {
        const statusConfig = ORDER_STATUS_LABELS[order.status] || ORDER_STATUS_LABELS.pending;
        const owes = order.source === 'sale' && order.is_credit && order.payment_status !== 'paid';
        const paymentConfig = owes
          ? { label: `Por pagar · debes $${Math.max(0, order.total_usd - (order.amount_paid ?? 0)).toFixed(2)}`, color: 'text-amber-700 dark:text-amber-400' }
          : PAYMENT_STATUS_LABELS[order.payment_status] || PAYMENT_STATUS_LABELS.pending;
        const items = (order.items || []) as ExtendedOrderItem[];
        const units = items.reduce((n, it) => n + Number(it.quantity || 0), 0);
        const canReorder = items.some(it => it.product_id && it.id !== 'credit_payment' && it.id !== 'credit_request');

        return (
          <motion.article
            key={order.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="space-y-4 p-4 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{order.source === 'sale' ? 'Compra en tienda' : 'Pedido'} #{order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {format(new Date(order.created_at), "d 'de' MMMM, yyyy", { locale: es })} · {units} {units === 1 ? 'artículo' : 'artículos'}
                  </p>
                </div>
                <span className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-semibold', statusConfig.color)}>{statusConfig.label}</span>
              </div>

              {order.status !== 'cancelled' && <OrderProgress status={order.status} />}

              {order.status === 'cancelled' && order.notes?.includes('[MOTIVO_RECHAZO]') && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p><span className="font-semibold">Motivo: </span>{order.notes.split('[MOTIVO_RECHAZO]')[1].trim()}</p>
                </div>
              )}

              <ul className="space-y-3">
                {items.slice(0, 3).map((item, idx) => {
                  const shown = getItemDisplay(item);
                  return (
                    <li key={idx} className="flex items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
                        {item.image_url
                          ? <img src={item.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          : <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{shown.name}</p>
                        <p className="text-xs text-muted-foreground">Cantidad: {item.quantity}</p>
                      </div>
                      <PriceDisplay amountUsd={shown.total} primaryClassName="text-sm font-semibold tabular-nums" showSecondary={false} />
                    </li>
                  );
                })}
              </ul>
              {items.length > 3 && (
                <button type="button" onClick={() => setDetailsOrder(order)} className="text-sm font-medium text-primary hover:underline">
                  Ver {items.length - 3} {items.length - 3 === 1 ? 'artículo más' : 'artículos más'}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between md:px-5">
              <div className="flex items-baseline justify-between gap-3 md:block">
                <PriceDisplay amountUsd={order.total_usd || 0} primaryClassName="font-serif text-xl font-semibold tabular-nums" showSecondary={false} />
                <p className={cn('text-xs font-medium', paymentConfig.color)}>{paymentConfig.label}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 md:flex">
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setTrackingOrder(order)}>
                  <Truck className="mr-1.5 h-4 w-4" />Seguir
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => openReceipt(order)}>
                  <Receipt className="mr-1.5 h-4 w-4" />Recibo
                </Button>
                {canReorder ? (
                  <Button size="sm" className="rounded-full" onClick={() => handleReorder(order)}>
                    <Refresh className="mr-1.5 h-4 w-4" />Repetir
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setDetailsOrder(order)}>Detalles</Button>
                )}
              </div>
            </div>
          </motion.article>
        );
      })}

      {/* Seguimiento: pasos según el estado real del pedido */}
      <Dialog open={!!trackingOrder} onOpenChange={(open) => !open && setTrackingOrder(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Seguimiento</DialogTitle>
            <DialogDescription>Pedido #{trackingOrder?.id.slice(0, 8).toUpperCase()}</DialogDescription>
          </DialogHeader>
          {trackingOrder?.status === 'cancelled' ? (
            <div className="flex items-start gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Este pedido fue cancelado.{trackingOrder.notes?.includes('[MOTIVO_RECHAZO]') ? ` ${trackingOrder.notes.split('[MOTIVO_RECHAZO]')[1].trim()}` : ''}</p>
            </div>
          ) : (
            <ol className="relative mt-2 space-y-6 border-l-2 border-border pl-6">
              {ORDER_STEPS.map((step, i) => {
                const current = STEP_INDEX[trackingOrder?.status || 'pending'] ?? 0;
                const done = i <= current;
                const Icon = i < current ? TickCircle : step.icon;
                return (
                  <li key={step.label} className="relative">
                    <span className={cn(
                      'absolute -left-[37px] flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-background',
                      done ? 'bg-primary text-primary-foreground' : 'border border-border bg-muted text-muted-foreground'
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className={cn('text-sm font-semibold', !done && 'text-muted-foreground')}>
                      {step.label}{i === current && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Ahora</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.hint}</p>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {BRAND_WHATSAPP_URL ? (
              <a
                href={`${BRAND_WHATSAPP_URL}?text=${encodeURIComponent(`Hola, quiero saber de mi pedido #${trackingOrder?.id.slice(0, 8).toUpperCase()}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border text-sm font-medium hover:border-primary/40"
              >
                <MessageSquare className="h-4 w-4" />Escribir por WhatsApp
              </a>
            ) : (
              <Link to="/atencion" className="inline-flex h-10 items-center justify-center rounded-full border border-border text-sm font-medium hover:border-primary/40">Atención al cliente</Link>
            )}
            <Button className="rounded-full" onClick={() => setTrackingOrder(null)}>Listo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detalle del Pedido Modal */}
      <Dialog open={!!detailsOrder} onOpenChange={(open) => !open && setDetailsOrder(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl bg-background border border-border/40 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif">Detalles del Pedido</DialogTitle>
            <DialogDescription>
              Pedido realizado el {detailsOrder ? format(new Date(detailsOrder.created_at), "d 'de' MMMM 'de' yyyy", { locale: es }) : ''} | 
              N.º {detailsOrder?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-border bg-card/40">
                <h4 className="font-semibold mb-2">Dirección de envío</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {detailsOrder?.shipping_address || 'Retiro en tienda (Acordado con el vendedor)'}
                </p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card/40">
                <h4 className="font-semibold mb-2">Método de pago</h4>
                <p className="text-sm text-muted-foreground capitalize">
                  {detailsOrder?.payment_method?.replace('_', ' ') || 'No especificado'}
                </p>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Artículos comprados</h4>
              <div className="space-y-4">
                {(detailsOrder?.items as ExtendedOrderItem[])?.map((item: ExtendedOrderItem, idx: number) => (
                  <div key={idx} className="flex gap-4 items-center p-3 rounded-lg border border-border/50">
                    <div className="w-16 h-16 bg-muted/30 rounded-lg flex items-center justify-center border border-border/40 shrink-0 overflow-hidden">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm line-clamp-1">{getItemDisplay(item).name}</p>
                      <p className="text-xs text-muted-foreground">Cantidad: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <PriceDisplay amountUsd={getItemDisplay(item).total} primaryClassName="font-semibold text-sm" showSecondary={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />
            <div className="flex justify-between items-center font-bold text-lg">
              <span>Total del pedido</span>
              <PriceDisplay amountUsd={detailsOrder?.total_usd || 0} primaryClassName="text-primary" showSecondary={true} amountBs={detailsOrder?.total_bs} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recibo: misma vista y PDF que en el panel */}
      <ReceiptDialog data={receiptOrder ? toReceipt(receiptOrder) : null} onClose={() => setReceiptOrder(null)} />
    </div>
  );
}
