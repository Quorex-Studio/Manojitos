// Componente de indicador de notificaciones para el header/sidebar
// Muestra badge con contador y dropdown de notificaciones recientes
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader, Bell, Check, ChevronRight, Refresh } from 'reicon-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const { permission, requestPermission } = usePushNotifications();

  // Mostrar solo las últimas 5 notificaciones
  const recentNotifications = notifications.slice(0, 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1"
              >
                <Badge
                  variant="destructive"
                  className="h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between">
          <h4 className="font-semibold">Notificaciones</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="text-xs h-7"
            >
              <Check className="h-3 w-3 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>

        {permission !== 'granted' && (
          <div className="p-3 bg-primary/10 border-b border-primary/20 flex flex-col gap-2 text-left">
            <p className="text-[11px] text-muted-foreground leading-normal">
              Activa notificaciones nativas en tu Google Chrome / navegador para recibir avisos de compras al instante.
            </p>
            <Button size="sm" variant="outline" className="h-7 text-xs rounded-full w-full bg-background hover:bg-muted" onClick={requestPermission}>
              Activar notificaciones
            </Button>
          </div>
        )}

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          ) : (
            <div className="p-2">
              <AnimatePresence>
              {recentNotifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "p-2.5 rounded-lg mb-1 cursor-pointer transition-colors border border-transparent",
                    notif.is_read
                      ? "hover:bg-muted/50 hover:border-border/50"
                      : "bg-primary/5 border-primary/10 hover:bg-primary/10"
                  )}
                  onClick={() => {
                    if (!notif.is_read) markAsRead.mutate(notif.id);
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-1.5 flex-shrink-0 shadow-sm",
                      notif.type === 'warning' ? 'bg-gold shadow-gold/40' :
                      notif.type === 'error' ? 'bg-destructive shadow-destructive/40' :
                      notif.type === 'success' ? 'bg-primary shadow-primary/40' :
                      'bg-primary/70 shadow-primary/20'
                    )} />
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex justify-between items-start gap-2">
                        <p className={cn(
                          "text-sm font-semibold truncate leading-tight",
                          !notif.is_read ? "text-primary" : "text-foreground/90"
                        )}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
                          {format(new Date(notif.sent_at), "dd MMM, HH:mm", { locale: es })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t">
          <Button
            variant="ghost"
            className="w-full justify-between text-sm"
            onClick={() => {
              setOpen(false);
              navigate('/credits');
            }}
          >
            Ver todas las notificaciones
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
