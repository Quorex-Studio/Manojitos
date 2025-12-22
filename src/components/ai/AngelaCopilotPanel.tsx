// Panel de recomendaciones de Ángela para el Dashboard
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Package, 
  CreditCard,
  RefreshCw,
  X,
  ChevronRight,
  Lightbulb
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAngelaAlerts, type AngelaAlert } from '@/hooks/useAngelaAlerts';
import { cn } from '@/lib/utils';
import stitchRosaMascot from '@/assets/stitch-rosa-mascot.png';

const alertIcons: Record<string, typeof Package> = {
  stock_low: Package,
  risky_client: AlertTriangle,
  overdue_debt: CreditCard,
  star_product: TrendingUp,
  recommendation: Lightbulb,
};

const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

interface AlertCardProps {
  alert: AngelaAlert;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
}

function AlertCard({ alert, onDismiss, onMarkRead }: AlertCardProps) {
  const Icon = alertIcons[alert.alert_type] || Lightbulb;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        "p-3 rounded-lg border transition-all",
        !alert.is_read && "bg-pink-50/50 dark:bg-pink-900/10 border-pink-200 dark:border-pink-800",
        alert.is_read && "bg-muted/50 border-border"
      )}
      onClick={() => !alert.is_read && onMarkRead(alert.id)}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-full",
          severityColors[alert.severity]
        )}>
          <Icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{alert.title}</span>
            {!alert.is_read && (
              <Badge variant="secondary" className="text-xs bg-pink-500 text-white">
                Nuevo
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {alert.message}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {new Date(alert.created_at).toLocaleString('es-VE')}
          </p>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-50 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(alert.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}

export function AngelaCopilotPanel() {
  const { alerts, loading, unreadCount, markAsRead, dismissAlert, generateAlerts } = useAngelaAlerts();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    await generateAlerts();
    setIsGenerating(false);
  };

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const infoAlerts = alerts.filter(a => a.severity === 'info');

  return (
    <Card className="border-pink-200 dark:border-pink-800 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-pink-500 to-rose-500 text-white pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30">
              <img src={stitchRosaMascot} alt="Ángela" className="w-full h-full object-cover" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Ángela recomienda
              </CardTitle>
              <p className="text-xs text-white/80">
                {unreadCount > 0 ? `${unreadCount} alertas nuevas` : 'Todo al día 🩷'}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="text-white hover:bg-white/20"
          >
            <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-sm">Analizando datos...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium">¡Todo está excelente! 🩷</p>
            <p className="text-xs text-muted-foreground mt-1">
              No hay alertas pendientes
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              className="mt-3"
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              Analizar ahora
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="p-3 space-y-2">
              {/* Alertas críticas primero */}
              {criticalAlerts.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2 px-1">
                    🚨 Crítico ({criticalAlerts.length})
                  </p>
                  <AnimatePresence>
                    {criticalAlerts.map(alert => (
                      <AlertCard 
                        key={alert.id} 
                        alert={alert} 
                        onDismiss={dismissAlert}
                        onMarkRead={markAsRead}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
              
              {/* Alertas de advertencia */}
              {warningAlerts.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 px-1">
                    ⚠️ Atención ({warningAlerts.length})
                  </p>
                  <AnimatePresence>
                    {warningAlerts.map(alert => (
                      <AlertCard 
                        key={alert.id} 
                        alert={alert} 
                        onDismiss={dismissAlert}
                        onMarkRead={markAsRead}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
              
              {/* Alertas informativas */}
              {infoAlerts.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 px-1">
                    💡 Sugerencias ({infoAlerts.length})
                  </p>
                  <AnimatePresence>
                    {infoAlerts.map(alert => (
                      <AlertCard 
                        key={alert.id} 
                        alert={alert} 
                        onDismiss={dismissAlert}
                        onMarkRead={markAsRead}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
