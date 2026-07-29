// Panel de alertas inteligentes para el admin (Refactorizado a Dropdown Popover UX)
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle, AlertCircle, InfoCircle, CheckCircle, ChevronRight, ChevronDown, CloseSquare, DollarSign, Clock, FileText, ArrowDown } from 'reicon-react';
import { useState } from 'react';
import { useAdminAlerts, AdminAlert, AlertType } from '@/hooks/useAdminAlerts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const alertIcons: Record<AlertType, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: InfoCircle,
  success: CheckCircle
};

const lucideIcons: Record<string, typeof AlertTriangle> = {
  AlertTriangle,
  AlertCircle,
  DollarSign,
  Clock,
  FileText,
  TrendingDown: ArrowDown,
  CheckCircle
};

const alertColors: Record<AlertType, { bg: string; border: string; icon: string; hover: string }> = {
  critical: {
    bg: 'bg-destructive/10 dark:bg-destructive/10',
    border: 'border-destructive/20 dark:border-destructive/30',
    icon: 'text-destructive',
    hover: 'hover:bg-destructive/15'
  },
  warning: {
    bg: 'bg-gold/10 dark:bg-gold/10',
    border: 'border-gold/20 dark:border-gold/30',
    icon: 'text-gold',
    hover: 'hover:bg-gold/15'
  },
  info: {
    bg: 'bg-primary/10 dark:bg-primary/10',
    border: 'border-primary/20 dark:border-primary/25',
    icon: 'text-primary',
    hover: 'hover:bg-primary/15'
  },
  success: {
    bg: 'bg-secondary/50 dark:bg-secondary/50',
    border: 'border-border dark:border-border/30',
    icon: 'text-primary dark:text-primary/90',
    hover: 'hover:bg-secondary'
  }
};

function AlertItem({ alert, onDismiss }: { alert: AdminAlert; onDismiss?: () => void }) {
  const Icon = lucideIcons[alert.icon] || alertIcons[alert.type] || InfoCircle;
  const colors = alertColors[alert.type];
  const [isExpanded, setIsExpanded] = useState(false);

  // If this alert has drill-down data, expand on click
  const hasDrillDown = Array.isArray(alert.data) && alert.data.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "border rounded-xl p-3 mb-2 transition-colors cursor-default",
        colors.bg, colors.border,
        hasDrillDown && `cursor-pointer ${colors.hover}`
      )}
      onClick={() => hasDrillDown && setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${colors.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-sm text-foreground/90 leading-tight">{alert.title}</h4>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
              {alert.timestamp.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alert.message}</p>
          
          {alert.action && (
            <Button
              asChild
              variant="link"
              size="sm"
              className="h-auto p-0 mt-1.5 text-[11px] font-medium"
            >
              <Link to={alert.action.path} className="flex items-center gap-1 text-primary hover:text-primary/80">
                {alert.action.label}
                <ChevronRight className="h-3 w-3" />
              </Link>
            </Button>
          )}

          {/* Drill-down in-situ detail */}
          {hasDrillDown && (
            <div className="mt-2">
              <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70 group-hover:text-primary transition-colors cursor-pointer w-fit" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
                {isExpanded ? 'Ocultar detalles' : 'Ver detalles desplegables'}
                <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", isExpanded && "rotate-180")} />
              </div>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <ul className="mt-2 space-y-1 bg-background/50 rounded-lg p-2 border border-border/50">
                      {alert.category === 'stock' && alert.data.map((item: any) => (
                        <li key={item.id} className="text-xs flex items-center justify-between py-1 px-1 border-b border-border/30 last:border-0">
                          <span className="truncate pr-2 font-medium text-foreground/80">{item.name}</span>
                          <span className="font-bold text-destructive whitespace-nowrap">{item.stock} und</span>
                        </li>
                      ))}
                      {alert.category === 'credit' && alert.data.map((item: any) => (
                        <li key={item.id} className="text-xs flex items-center justify-between py-1 px-1 border-b border-border/30 last:border-0">
                          <span className="truncate pr-2 font-medium text-foreground/80">{item.client_name}</span>
                          <span className="font-bold text-destructive whitespace-nowrap">${item.current_balance.toFixed(2)}</span>
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
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors shrink-0 ml-1"
          >
            <CloseSquare className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function DashboardAlertsDropdown() {
  const { alerts, criticalCount, warningCount, hasAlerts } = useAdminAlerts();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id));
  const activeCritical = visibleAlerts.filter(a => a.type === 'critical').length;
  const activeWarning = visibleAlerts.filter(a => a.type === 'warning').length;

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className={cn(
          "relative h-10 w-10 rounded-xl border-border/50 bg-card hover:bg-muted/50 transition-colors shadow-sm",
          activeCritical > 0 && "border-destructive/30 hover:bg-destructive/10",
          activeWarning > 0 && activeCritical === 0 && "border-gold/30 hover:bg-gold/10"
        )}>
          <Bell className={cn(
            "h-5 w-5",
            activeCritical > 0 ? "text-destructive" : activeWarning > 0 ? "text-gold" : "text-muted-foreground"
          )} />
          <AnimatePresence>
            {(activeCritical > 0 || activeWarning > 0) && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1.5 -right-1.5 flex"
              >
                <span className="relative flex h-3 w-3">
                  <span className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                    activeCritical > 0 ? "bg-destructive" : "bg-gold"
                  )}></span>
                  <span className={cn(
                    "relative inline-flex rounded-full h-3 w-3",
                    activeCritical > 0 ? "bg-destructive" : "bg-gold"
                  )}></span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="p-4 border-b border-border/40 bg-muted/20 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-2">
            <h4 className="font-serif font-bold text-lg text-foreground">Alertas</h4>
          </div>
          <div className="flex gap-2">
            {activeCritical > 0 && (
              <Badge variant="destructive" className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
                {activeCritical} crítica{activeCritical !== 1 ? 's' : ''}
              </Badge>
            )}
            {activeWarning > 0 && (
              <Badge variant="outline" className="text-[10px] bg-gold/10 text-gold border-gold/30 font-semibold uppercase tracking-wider px-2 py-0.5">
                {activeWarning} aviso{activeWarning !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[450px]">
          {visibleAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-card">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-medium text-foreground">Todo bajo control</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">No tienes alertas pendientes ni métricas críticas que revisar.</p>
            </div>
          ) : (
            <div className="p-3 bg-card/50">
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
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

