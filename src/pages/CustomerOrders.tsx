import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  XCircle,
  ArrowLeft,
  Loader2,
  ShoppingBag,
  MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { StoreLayout } from '@/components/store/StoreLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCustomerOrders, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/hooks/useCustomerOrders';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const STATUS_ICONS: Record<string, typeof Package> = {
  pending: Clock,
  confirmed: CheckCircle2,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
};

export default function CustomerOrders() {
  const { user } = useAuth();
  const { orders, isLoading, stats } = useCustomerOrders();

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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                <p className="text-3xl font-bold text-yellow-500">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-blue-500">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">En Progreso</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-green-500">{stats.completed}</p>
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
  if (orders.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No hay pedidos</h2>
          <p className="text-muted-foreground mb-6">
            Aún no has realizado ningún pedido
          </p>
          <Link to="/tienda">
            <Button>Explorar Tienda</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map(order => {
        const statusConfig = ORDER_STATUS_LABELS[order.status] || ORDER_STATUS_LABELS.pending;
        const paymentConfig = PAYMENT_STATUS_LABELS[order.payment_status] || PAYMENT_STATUS_LABELS.pending;
        const StatusIcon = STATUS_ICONS[order.status] || Package;

        return (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-full", statusConfig.color.replace('bg-', 'bg-') + '/20')}>
                      <StatusIcon className={cn("h-5 w-5", statusConfig.color.replace('bg-', 'text-'))} />
                    </div>
                    <div>
                      <CardTitle className="text-base">Pedido #{order.id.slice(0, 8)}</CardTitle>
                      <CardDescription>
                        {format(new Date(order.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn(paymentConfig.color, "text-white")}>
                      {paymentConfig.label}
                    </Badge>
                    <Badge className={cn(statusConfig.color, "text-white")}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Items */}
                <div className="space-y-2 mb-4">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.quantity}x {item.product_name}
                      </span>
                      <span>${item.total.toFixed(2)}</span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-sm text-muted-foreground">
                      +{order.items.length - 3} productos más
                    </p>
                  )}
                </div>

                {/* Shipping info */}
                {order.shipping_address && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50 mb-4">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="text-sm">
                      <p>{order.shipping_address}</p>
                      {order.shipping_city && (
                        <p className="text-muted-foreground">
                          {order.shipping_city}, {order.shipping_state}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tracking */}
                {order.tracking_number && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 mb-4">
                    <Truck className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">
                      Número de seguimiento: <strong>{order.tracking_number}</strong>
                    </span>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center pt-3 border-t border-border">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold">${order.total_usd.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
