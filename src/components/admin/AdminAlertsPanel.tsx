// Panel de alertas inteligentes para el admin
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle, ChevronRight, ChevronDown, X, DollarSign, Clock, FileText, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { useAdminAlerts, AdminAlert, AlertType } from '@/hooks/useAdminAlerts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';

const alertIcons: Record<AlertType, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
  success: CheckCircle
};

const lucideIcons: Record<string, typeof AlertTriangle> = {
  AlertTriangle,
  AlertCircle,
  DollarSign,
  Clock,
  FileText,
  TrendingDown,
  CheckCircle
};

const alertColors: Record<AlertType, { bg: string; border: string; icon: string }> = {
  critical: {
    bg: 'bg-destructive/15 dark:bg-destructive/10',
    border: 'border-destructive/30 dark:border-destructive/30',
    icon: 'text-destructive'
  },
  warning: {
    bg: 'bg-gold/15 dark:bg-gold/10',
    border: 'border-gold/30 dark:border-gold/30',
    icon: 'text-gold'
  },
  info: {
    bg: 'bg-primary/15 dark:bg-primary/10',
    border: 'border-primary/30 dark:border-primary/25',
    icon: 'text-primary'
  },
  success: {
    bg: 'bg-secondary dark:bg-secondary/50',
    border: 'border-border dark:border-border/30',
    icon: 'text-primary dark:text-primary/90'
  }
};

function AlertItem({ alert, onDismiss }: { alert: AdminAlert; onDismiss?: () => void }) {
  const Icon = lucideIcons[alert.icon] || alertIcons[alert.type] || Info;
  const colors = alertColors[alert.type];
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`${colors.bg} ${colors.border} border rounded-lg p-3`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${colors.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm text-foreground">{alert.title}</h4>
            <Badge variant="outline" className="text-[10px]">
              {alert.category}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
          {alert.action && (
            <Button
              asChild
              variant="link"
              size="sm"
              className="h-auto p-0 mt-1 text-xs"
            >
              <Link to={alert.action.path} className="flex items-center gap-1">
                {alert.action.label}
                <ChevronRight className="h-3 w-3" />
              </Link>
            </Button>
          )}

          {/* Drill-down de inventario o data adicional */}
          {alert.category === 'stock' && Array.isArray(alert.data) && alert.data.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/10">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary transition-colors"
              >
                {isExpanded ? 'Ocultar detalles' : 'Ver detalle'}
                <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <ul className="mt-2 space-y-1">
                      {alert.data.map((product: any) => (
                        <li key={product.id} className="text-xs flex items-center justify-between py-1 bg-background/40 px-2 rounded">
                          <span className="truncate pr-2">{product.name}</span>
                          <span className="font-semibold">{product.stock} und</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-black/5 rounded transition-colors shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function AdminAlertsPanel() {
  const { alerts, criticalCount, warningCount, hasAlerts } = useAdminAlerts();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id));

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  if (!hasAlerts || visibleAlerts.length === 0) {
    return (
      <Card className="p-4 bg-secondary border-border">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-primary" />
          <div>
            <h4 className="font-medium text-foreground">Todo en orden</h4>
            <p className="text-xs text-muted-foreground">No hay alertas pendientes</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Alertas</h3>
          </div>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} crítica{criticalCount !== 1 ? 's' : ''}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="text-xs bg-gold/10 text-gold border-gold/30">
                {warningCount} aviso{warningCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <ScrollArea className="max-h-[300px]">
        <div className="p-3 space-y-2">
          <AnimatePresence mode="popLayout">
            {visibleAlerts.map(alert => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onDismiss={() => handleDismiss(alert.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </Card>
  );
}

// Badge compacto para el sidebar
export function AlertsBadge() {
  const { criticalCount, warningCount } = useAdminAlerts();
  
  if (criticalCount === 0 && warningCount === 0) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="flex items-center gap-1"
    >
      {criticalCount > 0 && (
        <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
          {criticalCount}
        </Badge>
      )}
      {warningCount > 0 && criticalCount === 0 && (
        <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-gold">
          {warningCount}
        </Badge>
      )}
    </motion.div>
  );
}
