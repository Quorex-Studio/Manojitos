import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TickCircle, Location, Loader, Package, Truck, CheckCircle, Clock, XCircle, ArrowLeft, Refresh, ShoppingBag } from 'reicon-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { useState } from 'react';
import { StoreLayout } from '@/components/store/StoreLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { useAuth } from '@/hooks/useAuth';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { cn } from '@/lib/utils';

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En revisión', color: 'bg-gold/20 text-gold border-gold/30' },
  confirmed: { label: 'Aprobado / En proceso', color: 'bg-primary/10 text-primary border-primary/20' },
  processing: { label: 'En proceso', color: 'bg-primary/10 text-primary border-primary/20' },
  shipped: { label: 'En camino', color: 'bg-primary/20 text-primary border-primary/30' },
  delivered: { label: 'Entregado', color: 'bg-primary text-primary-foreground' },
  cancelled: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  paid: { label: 'Pagado', color: 'bg-primary text-primary-foreground' },
  pending: { label: 'Pendiente', color: 'bg-gold/20 text-gold border-gold/30' },
  failed: { label: 'Fallido', color: 'bg-destructive text-destructive-foreground' },
};

const STATUS_ICONS: Record<string, typeof Package> = {
  pending: Clock,
  confirmed: TickCircle,
  processing: Package,
  shipped: Truck,
  delivered: TickCircle,
  cancelled: XCircle,
};

export default function CustomerOrders() {
  // --- DERIVED ---
  const { user } = useAuth();
  const { orders, isLoading, stats } = useCustomerOrders();

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

  return (
    <StoreLayout>
      <div className="container py-8 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link to="/cliente/perfil">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="page-header">Mis Pedidos</h1>
              <p className="text-muted-foreground">Historial y seguimiento de tus compras</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Pedidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-gold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">En Progreso</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Entregados</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="active">Activos</TabsTrigger>
              <TabsTrigger value="completed">Completados</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <OrderList orders={orders} />
            </TabsContent>

            <TabsContent value="active">
              <OrderList orders={orders.filter(o => !['delivered', 'cancelled'].includes(o.status))} />
            </TabsContent>

            <TabsContent value="completed">
              <OrderList orders={orders.filter(o => ['delivered', 'cancelled'].includes(o.status))} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </StoreLayout>
  );
}

function OrderList({ orders }: { orders: ReturnType<typeof useCustomerOrders>['orders'] }) {
  const [trackingOrder, setTrackingOrder] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay pedidos</h3>
          <p className="text-muted-foreground mb-6">No se encontraron pedidos en esta categoría.</p>
          <Link to="/tienda">
            <Button>Explorar Tienda</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {orders.map(order => {
        const statusConfig = ORDER_STATUS_LABELS[order.status] || ORDER_STATUS_LABELS.pending;
        const paymentConfig = PAYMENT_STATUS_LABELS[order.payment_status] || PAYMENT_STATUS_LABELS.pending;

        return (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="border border-border/60 rounded-xl overflow-hidden bg-card/40">
              
              {/* Header - Amazon Style */}
              <div className="bg-muted/40 px-4 md:px-6 py-3 border-b border-border/60 text-sm flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  <div>
                    <p className="text-muted-foreground uppercase text-[10px] tracking-wider font-semibold mb-0.5">Pedido realizado</p>
                    <p className="font-medium text-foreground/80">{format(new Date(order.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase text-[10px] tracking-wider font-semibold mb-0.5">Total</p>
                    <PriceDisplay amountUsd={order.total_usd || 0} primaryClassName="font-medium text-foreground/80" showSecondary={false} />
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase text-[10px] tracking-wider font-semibold mb-0.5">Enviar a</p>
                    <p className="font-medium text-primary hover:underline cursor-pointer">
                      {order.shipping_address ? 'Cliente' : 'Retiro en Tienda'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col md:items-end">
                  <p className="text-muted-foreground uppercase text-[10px] tracking-wider font-semibold mb-0.5">Pedido n.º {order.id.slice(0, 8)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-primary text-sm hover:underline cursor-pointer">Ver detalles del pedido</span>
                    <span className="text-border/60">|</span>
                    <span className="text-primary text-sm hover:underline cursor-pointer">Ver recibo</span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 md:p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  {statusConfig.label}
                  <Badge className={cn(paymentConfig.color, "text-xs font-normal px-2 py-0 h-5")}>
                    Pago: {paymentConfig.label}
                  </Badge>
                </h3>

                <div className="flex flex-col md:flex-row gap-6">
                  {/* Items List */}
                  <div className="flex-1 space-y-4">
                    {order.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex gap-4 items-start">
                        <div className="w-20 h-20 bg-muted/30 rounded-lg flex items-center justify-center border border-border/40 shrink-0">
                          <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                        <div>
                          <p className="font-medium text-primary hover:underline cursor-pointer line-clamp-2 leading-snug">
                            {item.product_name || 'Producto sin nombre'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Cantidad: {item.quantity}
                          </p>
                          <PriceDisplay amountUsd={item.total || 0} primaryClassName="text-sm font-semibold mt-1" showSecondary={false} />
                        </div>
                      </div>
                    ))}
                    
                    {order.items.length > 3 && (
                      <div className="pt-2">
                        <span className="text-sm text-primary hover:underline cursor-pointer">
                          Ver {order.items.length - 3} artículos más
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 md:w-64 shrink-0">
                    <Button 
                      variant="default" 
                      onClick={() => setTrackingOrder(order.id)}
                      className="w-full bg-[#FFD814] hover:bg-[#F7CA00] text-black border border-[#FCD200] shadow-sm"
                    >
                      Rastrear paquete
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => toast.info('La función de volver a comprar estará disponible pronto.')}
                      className="w-full bg-background hover:bg-muted/50"
                    >
                      Comprar de nuevo
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => toast.info('El portal de devoluciones está en desarrollo.')}
                      className="w-full bg-background hover:bg-muted/50"
                    >
                      Devolver o reemplazar productos
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        );
      })}
      {/* Tracking Modal */}
      <Dialog open={!!trackingOrder} onOpenChange={(open) => !open && setTrackingOrder(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[450px] p-0 overflow-hidden rounded-2xl bg-background border border-border/40 shadow-2xl">
          <div className="bg-muted/30 px-6 py-4 border-b border-border/40 flex justify-between items-center">
            <DialogTitle className="text-xl font-medium tracking-tight">Rastreo de Paquete</DialogTitle>
          </div>
          <div className="p-6">
            <p className="text-sm font-medium text-foreground mb-6">
              Pedido n.º {trackingOrder?.slice(0, 8)}
            </p>
            
            <div className="relative pl-6 border-l-2 border-primary/20 space-y-8 pb-4">
              <div className="relative">
                <div className="absolute -left-[35px] bg-primary rounded-full p-1.5 shadow-[0_0_0_4px_hsl(var(--background))]">
                  <TickCircle className="h-4 w-4 text-primary-foreground" />
                </div>
                <h4 className="font-semibold text-sm">Pedido Confirmado</h4>
                <p className="text-xs text-muted-foreground mt-1">Hemos recibido tu pedido correctamente.</p>
              </div>
              
              <div className="relative">
                <div className="absolute -left-[35px] bg-primary rounded-full p-1.5 shadow-[0_0_0_4px_hsl(var(--background))]">
                  <Package className="h-4 w-4 text-primary-foreground" />
                </div>
                <h4 className="font-semibold text-sm">En Preparación</h4>
                <p className="text-xs text-muted-foreground mt-1">Tu pedido está siendo empaquetado en nuestra tienda.</p>
              </div>

              <div className="relative">
                <div className="absolute -left-[35px] bg-muted rounded-full p-1.5 shadow-[0_0_0_4px_hsl(var(--background))] border border-border">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </div>
                <h4 className="font-semibold text-sm text-muted-foreground">En Camino</h4>
                <p className="text-xs text-muted-foreground mt-1">Pronto será recolectado por el repartidor.</p>
              </div>

              <div className="relative">
                <div className="absolute -left-[35px] bg-muted rounded-full p-1.5 shadow-[0_0_0_4px_hsl(var(--background))] border border-border">
                  <Location className="h-4 w-4 text-muted-foreground" />
                </div>
                <h4 className="font-semibold text-sm text-muted-foreground">Entregado</h4>
                <p className="text-xs text-muted-foreground mt-1">Esperando confirmación de entrega.</p>
              </div>
            </div>
            
            <Button 
              className="w-full mt-6 bg-[#FFD814] hover:bg-[#F7CA00] text-black font-medium"
              onClick={() => setTrackingOrder(null)}
            >
              Cerrar Detalles
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
