import { motion } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {Loader,  Bell, BellOff, Check, InfoCircle, AlertTriangle, CheckCircle, XCircle, ArrowLeft, Refresh } from 'reicon-react';
import { Link } from 'react-router-dom';

import { StoreLayout } from '@/components/store/StoreLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCustomerNotifications } from '@/hooks/useCustomerNotifications';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const TYPE_CONFIG: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-primary/80', bg: 'bg-primary/10' },
  warning: { icon: AlertTriangle, color: 'text-gold', bg: 'bg-gold/10' },
  success: { icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10' },
  error: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
};

// Map interface for Notification compatibility
interface LocalNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  channel: string;
  is_read: boolean;
  read_at: string | null;
  sent_at: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  credit_id: string | null;
}

export default function CustomerNotifications() {
  // --- DERIVED ---
  const { user } = useAuth();
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead } = useCustomerNotifications();
  const { permission, requestPermission } = usePushNotifications();

  // --- RENDER ---

  if (!user) {
    return (
      <StoreLayout>
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso requerido</h1>
          <p className="text-muted-foreground mb-6">Debes iniciar sesión para ver tus notificaciones</p>
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
      <div className="container py-8 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Link to="/cliente/perfil">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="page-header">Notificaciones</h1>
                <p className="text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>

          {permission !== 'granted' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-left"
            >
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm">Activar notificaciones en el teléfono</h4>
                  <p className="text-xs text-muted-foreground">Recibe avisos al instante cuando cambie el estado de tus pedidos.</p>
                </div>
              </div>
              <Button size="sm" onClick={requestPermission} className="rounded-full flex-shrink-0 bg-primary/80 hover:bg-primary">
                Activar
              </Button>
            </motion.div>
          )}

          {notifications.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <BellOff className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Sin notificaciones</h2>
                <p className="text-muted-foreground">
                  No tienes notificaciones por el momento
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="divide-y divide-border">
                    {notifications.map((notification, index) => (
                      <NotificationItem 
                        key={notification.id} 
                        notification={notification as unknown as LocalNotification}
                        onMarkAsRead={() => markAsRead.mutate(notification.id)}
                        index={index}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </StoreLayout>
  );
}

function NotificationItem({ 
  notification, 
  onMarkAsRead,
  index 
}: { 
  notification: LocalNotification; 
  onMarkAsRead: () => void;
  index: number;
}) {
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "p-4 hover:bg-secondary/80 transition-colors cursor-pointer",
        !notification.is_read && "bg-primary/5"
      )}
      onClick={() => !notification.is_read && onMarkAsRead()}
    >
      <div className="flex gap-4">
        <div className={cn("p-2 rounded-full h-fit", config.bg)}>
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn(
              "font-medium",
              !notification.is_read && "font-semibold"
            )}>
              {notification.title}
            </h3>
            {!notification.is_read && (
              <Badge variant="default" className="flex-shrink-0 h-5 w-5 p-0 rounded-full justify-center">
                <span className="sr-only">No leída</span>
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(notification.created_at), { 
              addSuffix: true, 
              locale: es 
            })}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
