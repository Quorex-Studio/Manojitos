// Componente de validez de precio con soporte para forwardRef
import { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
      normal: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };

    const UrgencyIcon = validity.urgency === 'urgent' 
      ? AlertTriangle 
      : validity.urgency === 'warning' 
        ? Clock 
        : Zap;

    if (compact) {
      return (
        <div ref={ref} className={className}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${urgencyStyles[validity.urgency]}`}
          >
            <UrgencyIcon className="h-2.5 w-2.5" />
            <span>{validity.minutesRemaining}min</span>
          </motion.div>
        </div>
      );
    }

    return (
      <div ref={ref} className={className}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1"
        >
          {showRate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3 w-3 text-gold" />
              <span>Tasa BCV: <strong className="text-foreground">{formattedRate}</strong></span>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={validity.urgency}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${urgencyStyles[validity.urgency]}`}
            >
              <UrgencyIcon className="h-3 w-3" />
              <span>{validity.message}</span>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }
);
