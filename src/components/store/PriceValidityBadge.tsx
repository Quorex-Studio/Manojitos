// Componente de validez de precio con soporte para forwardRef
import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, Zap, AlertTriangle } from 'lucide-react';
import { usePriceValidity } from '@/hooks/usePriceValidity';

interface PriceValidityBadgeProps {
  showRate?: boolean;
  compact?: boolean;
  className?: string;
}

// Usar forwardRef para permitir que componentes padres pasen refs
export const PriceValidityBadge = forwardRef<HTMLDivElement, PriceValidityBadgeProps>(
  function PriceValidityBadge({ showRate = true, compact = false, className = '' }, ref) {
    const { formattedRate, validity, loading } = usePriceValidity();

    if (loading) {
      return (
        <div 
          ref={ref}
          className={`flex items-center gap-1.5 text-muted-foreground text-xs animate-pulse ${className}`}
        >
          <Clock className="h-3 w-3" />
          <span>Calculando tasa...</span>
        </div>
      );
    }

    const urgencyStyles = {
      normal: 'bg-primary/10 text-primary',
      warning: 'bg-gold/10 text-gold',
      urgent: 'bg-destructive/10 text-destructive'
    };

    const UrgencyIcon = validity.urgency === 'urgent' 
      ? AlertTriangle 
      : validity.urgency === 'warning' 
        ? Clock 
        : Zap;

    if (compact) {
      if (validity.urgency === 'normal' || validity.minutesRemaining === 0) {
        return null;
      }
      const label = validity.minutesRemaining >= 60 
        ? `${Math.floor(validity.minutesRemaining / 60)}h`
        : `${validity.minutesRemaining} min`;
      return (
        <div ref={ref} className={className}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${urgencyStyles[validity.urgency]}`}
          >
            <UrgencyIcon className="h-2.5 w-2.5" />
            <span>{label}</span>
          </motion.div>
        </div>
      );
    }

    return (
      <div ref={ref} className={className}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {showRate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3 w-3 text-gold" />
              <span>Tasa BCV: <strong className="text-foreground">{formattedRate}</strong></span>
            </div>
          )}
        </motion.div>
      </div>
    );
  }
);
