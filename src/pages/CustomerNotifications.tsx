import { motion } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Bell, 
  BellOff, 
  Check, 
  CheckCheck, 
  Info, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { StoreLayout } from '@/components/store/StoreLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCustomerNotifications, Notification } from '@/hooks/useCustomerNotifications';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  success: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
};

export default function CustomerNotifications() {
  // --- DERIVED ---
  const { user } = useAuth();
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead } = useCustomerNotifications();

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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                <CheckCheck className="h-4 w-4 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>

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
                        notification={notification}
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
  notification: Notification; 
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
        "p-4 hover:bg-secondary/50 transition-colors cursor-pointer",
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
