// Componente de Timeline del Cliente - historial visual completo
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ShoppingBag, CreditCard, AlertCircle, CheckCircle, Bell, Calendar, Clock, DollarSign, Ban, Unlock, MessageSquare, FileText, ArrowUp } from 'reicon-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCustomerTimeline } from '@/hooks/useCustomerTimeline';

interface CustomerTimelineProps {
  customerPhone?: string;
  customerUserId?: string;
  limit?: number;
}

const EVENT_CONFIG: Record<string, {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  label: string;
}> = {
  'PURCHASE': {
    icon: <ShoppingBag className="h-4 w-4" />,
    color: 'text-primary/80',
    bgColor: 'bg-primary/10',
    label: 'Compra'
  },
  'CREDIT_CHARGE': {
    icon: <CreditCard className="h-4 w-4" />,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'Cargo a crédito'
  },
  'PAYMENT': {
    icon: <DollarSign className="h-4 w-4" />,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'Pago'
  },
  'LATE_PAYMENT': {
    icon: <Clock className="h-4 w-4" />,
    color: 'text-gold',
    bgColor: 'bg-gold/10',
    label: 'Pago tardío'
  },
  'PROMISE_CREATED': {
    icon: <Calendar className="h-4 w-4" />,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    label: 'Promesa de pago'
  },
  'PROMISE_FULFILLED': {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'Promesa cumplida'
  },
  'PROMISE_BROKEN': {
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    label: 'Promesa incumplida'
  },
  'CREDIT_BLOCKED': {
    icon: <Ban className="h-4 w-4" />,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    label: 'Crédito bloqueado'
  },
  'CREDIT_UNBLOCKED': {
    icon: <Unlock className="h-4 w-4" />,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'Crédito desbloqueado'
  },
  'REMINDER_SENT': {
    icon: <Bell className="h-4 w-4" />,
    color: 'text-gold',
    bgColor: 'bg-gold/10',
    label: 'Recordatorio enviado'
  },
  'NOTIFICATION_SENT': {
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-primary/80',
    bgColor: 'bg-primary/10',
    label: 'Notificación'
  },
  'LIMIT_INCREASED': {
    icon: <TrendingUp className="h-4 w-4" />,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'Límite aumentado'
  },
  'ORDER_PLACED': {
    icon: <FileText className="h-4 w-4" />,
    color: 'text-primary/80',
    bgColor: 'bg-primary/10',
    label: 'Pedido realizado'
  },
  'DEFAULT': {
    icon: <Clock className="h-4 w-4" />,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    label: 'Evento'
  }
};

export function CustomerTimeline({ customerPhone, customerUserId, limit = 20 }: CustomerTimelineProps) {
  const { events: timeline, isLoading } = useCustomerTimeline(customerPhone || customerUserId, customerPhone ? 'phone' : 'user_id');
  
  const displayedTimeline = timeline.slice(0, limit);

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-secondary rounded" />
                  <div className="h-3 w-2/3 bg-secondary rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (displayedTimeline.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No hay eventos registrados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Historial del Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="relative">
          {/* Línea vertical */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
          
          <div className="space-y-4">
            {displayedTimeline.map((event, index) => {
              const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.DEFAULT;
              const eventData = event.event_data as Record<string, unknown> | null;
              
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex gap-4 relative"
                >
                  {/* Icono */}
                  <div className={`w-10 h-10 rounded-full ${config.bgColor} ${config.color} flex items-center justify-center flex-shrink-0 z-10`}>
                    {config.icon}
                  </div>
                  
                  {/* Contenido */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), "d 'de' MMM, HH:mm", { locale: es })}
                      </span>
                    </div>
                    
                    {eventData && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        {eventData.amount && (
                          <span className="font-medium text-foreground">
                            ${Number(eventData.amount).toFixed(2)}
                          </span>
                        )}
                        {eventData.description && (
                          <p className="mt-0.5">{String(eventData.description)}</p>
                        )}
                        {eventData.product_name && (
                          <p className="mt-0.5">{String(eventData.product_name)}</p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
