// Componente de centro de notificaciones para el panel admin
// Muestra historial de notificaciones, estado de envío y permite acciones manuales
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Bell,
  Mail,
  MessageSquare,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  RefreshCw,
  ChevronDown,
  Loader2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useNotifications, useCreditReminderHistory } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

// Configuración de iconos por canal
const CHANNEL_ICONS = {
  internal: Bell,
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
};

// Configuración de colores por tipo
const TYPE_COLORS = {
  info: "bg-primary/10 text-primary border-primary/20",
  warning: "bg-gold/10 text-gold border-gold/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  success: "bg-primary/10 text-primary border-primary/20",
};

// Props del componente
interface NotificationCenterProps {
  creditId?: string; // Si se pasa, muestra solo notificaciones de ese crédito
  compact?: boolean; // Modo compacto para sidebar
}

export function NotificationCenter({ creditId, compact }: NotificationCenterProps) {
  const {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    processAutomaticNotifications,
  } = useNotifications();

  // Filtrar notificaciones si hay creditId
  const filteredNotifications = creditId
    ? notifications.filter(n => n.credit_id === creditId)
    : notifications;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="text-sm font-medium">Notificaciones</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
        </div>
        <ScrollArea className="h-48">
          {filteredNotifications.slice(0, 5).map(notif => (
            <div
              key={notif.id}
              className={cn(
                "p-2 rounded-md mb-1 text-xs cursor-pointer transition-colors",
                notif.is_read ? "bg-muted/50" : "bg-primary/10"
              )}
              onClick={() => markAsRead.mutate(notif.id)}
            >
              <p className="font-medium truncate">{notif.title}</p>
              <p className="text-muted-foreground truncate">{notif.message}</p>
            </div>
          ))}
        </ScrollArea>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Centro de Notificaciones
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount} nuevas</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Historial de notificaciones y recordatorios enviados
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => processAutomaticNotifications.mutate()}
              disabled={processAutomaticNotifications.isPending}
            >
              {processAutomaticNotifications.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Procesar automáticos</span>
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Marcar todas</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay notificaciones</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <AnimatePresence>
              {filteredNotifications.map((notif, index) => {
                const ChannelIcon = CHANNEL_ICONS[notif.channel] || Bell;

                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      "p-4 rounded-lg mb-3 border transition-all cursor-pointer",
                      notif.is_read 
                        ? "bg-muted/30 border-transparent" 
                        : "bg-primary/5 border-primary/20 shadow-sm"
                    )}
                    onClick={() => !notif.is_read && markAsRead.mutate(notif.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Indicador de tipo */}
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                        TYPE_COLORS[notif.type]
                      )} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={cn(
                            "font-medium",
                            !notif.is_read && "text-primary"
                          )}>
                            {notif.title}
                          </h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(notif.sent_at), "dd MMM HH:mm", { locale: es })}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        {notif.metadata?.client_name && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            Cliente: {String(notif.metadata.client_name)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// Componente para historial de recordatorios de un crédito específico
interface CreditReminderHistoryProps {
  creditId: string;
  clientName: string;
}

export function CreditReminderHistoryPanel({ creditId, clientName }: CreditReminderHistoryProps) {
  const { data: reminders = [], isLoading } = useCreditReminderHistory(creditId);
  const [isOpen, setIsOpen] = useState(false);

  const statusIcon = (delivered: boolean, status: string) => {
    if (status === 'pending') return <Clock className="h-4 w-4 text-gold" />;
    if (delivered) return <CheckCircle2 className="h-4 w-4 text-primary" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const channelLabel = (channel: string) => {
    switch (channel) {
      case 'internal': return 'Interno';
      case 'email': return 'Email';
      case 'sms': return 'SMS';
      case 'whatsapp': return 'WhatsApp';
      default: return channel;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Historial de recordatorios ({reminders.length})
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "rotate-180"
          )} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay recordatorios enviados
            </p>
          ) : (
            reminders.map(reminder => (
              <div
                key={reminder.id}
                className="p-3 rounded-md bg-muted/50 text-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {statusIcon(reminder.delivered, reminder.delivery_status)}
                    <Badge variant="outline" className="text-xs">
                      {channelLabel(reminder.channel)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {reminder.reminder_type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {reminder.sent_at 
                      ? format(new Date(reminder.sent_at), "dd/MM HH:mm")
                      : format(new Date(reminder.created_at), "dd/MM HH:mm")
                    }
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {reminder.message}
                </p>
                {reminder.error_message && (
                  <p className="text-xs text-destructive mt-1">
                    Error: {reminder.error_message}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
