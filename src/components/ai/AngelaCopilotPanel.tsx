// Panel de recomendaciones de Ángela para el Dashboard
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Package, 
  CreditCard,
  RefreshCw,
  X,
  Filter,
  Bell,
  Lightbulb,
  Clock,
  CheckCircle2,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAngelaAlerts, type AngelaAlert } from '@/hooks/useAngelaAlerts';
import { cn } from '@/lib/utils';
import stitchRosaMascot from '@/assets/stitch-rosa-mascot.png';
import { toast } from 'sonner';

const alertIcons: Record<string, typeof Package> = {
  stock_low: Package,
  risky_client: AlertTriangle,
  overdue_debt: CreditCard,
  star_product: TrendingUp,
  recommendation: Lightbulb,
};

const alertTypeLabels: Record<string, string> = {
  stock_low: 'Stock',
  risky_client: 'Riesgo',
  overdue_debt: 'Deudas',
  star_product: 'Estrella',
  recommendation: 'Sugerencia',
};

const severityColors = {
  info: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/25",
  },
  warning: {
    bg: "bg-gold/10",
    text: "text-gold",
    border: "border-gold/30",
  },
  critical: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30",
  },
};

type FilterType = 'all' | 'critical' | 'warning' | 'info' | 'unread';

interface AlertCardProps {
  alert: AngelaAlert;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
}

function AlertCard({ alert, onDismiss, onMarkRead }: AlertCardProps) {
  const Icon = alertIcons[alert.alert_type] || Lightbulb;
  const colors = severityColors[alert.severity] || severityColors.info;
  const timeAgo = getTimeAgo(new Date(alert.created_at));
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "p-3 rounded-lg border transition-all cursor-pointer group",
        !alert.is_read && `${colors.bg} ${colors.border}`,
        alert.is_read && "bg-muted/30 border-border hover:bg-muted/50"
      )}
      onClick={() => !alert.is_read && onMarkRead(alert.id)}
    >
      <div className="flex items-start gap-3">
        <motion.div 
          className={cn("p-2 rounded-full shrink-0", colors.bg)}
          whileHover={{ scale: 1.1 }}
        >
          <Icon className={cn("h-4 w-4", colors.text)} />
        </motion.div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm">{alert.title}</span>
            <Badge 
              variant="outline" 
              className={cn("text-[10px] px-1.5", colors.text, colors.border)}
            >
              {alertTypeLabels[alert.alert_type] || alert.alert_type}
            </Badge>
            {!alert.is_read && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <Badge className="text-[10px] bg-primary text-primary-foreground px-1.5">
                  Nuevo
                </Badge>
              </motion.div>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
            {alert.message}
          </p>
          
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
            
            {alert.action_data && Object.keys(alert.action_data).length > 0 && (
              <span className="text-[10px] text-muted-foreground/60">
                {formatActionData(alert.action_data)}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!alert.is_read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(alert.id);
              }}
              title="Marcar como leído"
            >
              <Eye className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(alert.id);
            }}
            title="Descartar"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
}

function formatActionData(data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof data.balance === 'number') parts.push(`$${data.balance}`);
  if (typeof data.currentStock === 'number') parts.push(`Stock: ${data.currentStock}`);
  if (typeof data.daysOverdue === 'number') parts.push(`${data.daysOverdue} días`);
  if (typeof data.increase === 'string') parts.push(`+${data.increase}%`);
  return parts.slice(0, 2).join(' • ');
}

export function AngelaCopilotPanel() {
  const { alerts, loading, unreadCount, markAsRead, dismissAlert, generateAlerts } = useAngelaAlerts();
  const [isGenerating, setIsGenerating] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const handleGenerate = async () => {
    setIsGenerating(true);
    const success = await generateAlerts();
    setIsGenerating(false);
    if (success) {
      toast.success('Análisis completado');
    } else {
      toast.error('Error al generar alertas');
    }
  };

  const handleMarkAllRead = async () => {
    const unreadAlerts = alerts.filter(a => !a.is_read);
    for (const alert of unreadAlerts) {
      await markAsRead(alert.id);
    }
    toast.success('Todas las alertas marcadas como leídas');
  };

  const filteredAlerts = useMemo(() => {
    switch (filter) {
      case 'critical':
        return alerts.filter(a => a.severity === 'critical');
      case 'warning':
        return alerts.filter(a => a.severity === 'warning');
      case 'info':
        return alerts.filter(a => a.severity === 'info');
      case 'unread':
        return alerts.filter(a => !a.is_read);
      default:
        return alerts;
    }
  }, [alerts, filter]);

  const stats = useMemo(() => ({
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
    unread: alerts.filter(a => !a.is_read).length,
  }), [alerts]);

  return (
    <Card className="border-primary/20 overflow-hidden shadow-lg">
      {/* Header con gradiente */}
      <CardHeader className="bg-gradient-to-r from-primary/90 to-rose-dark text-primary-foreground pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30 shadow-lg"
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              <img src={stitchRosaMascot} alt="Ángela" className="w-full h-full object-cover" />
            </motion.div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Ángela Copilot
              </CardTitle>
              <p className="text-xs text-white/80">
                {unreadCount > 0 
                  ? `${unreadCount} alerta${unreadCount !== 1 ? 's' : ''} nueva${unreadCount !== 1 ? 's' : ''}`
                  : 'Todo bajo control 🩷'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-white/80 hover:text-white hover:bg-white/20 text-xs"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Leer todo
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="text-white hover:bg-white/20"
              title="Analizar ahora"
            >
              <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Stats pills */}
        {alerts.length > 0 && (
          <div className="flex gap-2 mt-3">
            {stats.critical > 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-xs">
                🚨 {stats.critical} crítica{stats.critical !== 1 ? 's' : ''}
              </Badge>
            )}
            {stats.warning > 0 && (
              <Badge className="bg-gold/90 text-accent-foreground text-xs">
                ⚠️ {stats.warning} aviso{stats.warning !== 1 ? 's' : ''}
              </Badge>
            )}
            {stats.info > 0 && (
              <Badge className="bg-primary/80 text-primary-foreground text-xs">
                💡 {stats.info} sugerencia{stats.info !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Filtros */}
        {alerts.length > 0 && (
          <div className="p-2 border-b bg-muted/30">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <TabsList className="grid grid-cols-5 h-8">
                <TabsTrigger value="all" className="text-xs px-2">
                  <Bell className="h-3 w-3 mr-1" />
                  Todo
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-xs px-2">
                  Nuevas
                  {stats.unread > 0 && (
                    <Badge className="ml-1 h-4 w-4 p-0 text-[10px] bg-primary">
                      {stats.unread}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="critical" className="text-xs px-2">
                  🚨
                </TabsTrigger>
                <TabsTrigger value="warning" className="text-xs px-2">
                  ⚠️
                </TabsTrigger>
                <TabsTrigger value="info" className="text-xs px-2">
                  💡
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {loading ? (
          <div className="p-6 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw className="h-6 w-6 mx-auto text-primary" />
            </motion.div>
            <p className="text-sm text-muted-foreground mt-2">Analizando datos...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center">
            <motion.div 
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            >
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </motion.div>
            <p className="font-medium text-primary">¡Todo está excelente! 🩷</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              No hay alertas pendientes en este momento
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              <RefreshCw className={cn("h-3 w-3 mr-2", isGenerating && "animate-spin")} />
              Analizar ahora
            </Button>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-6 text-center">
            <Filter className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay alertas con este filtro
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setFilter('all')}
            >
              Ver todas
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[350px]">
            <div className="p-3 space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredAlerts.map(alert => (
                  <AlertCard 
                    key={alert.id} 
                    alert={alert} 
                    onDismiss={dismissAlert}
                    onMarkRead={markAsRead}
                  />
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
