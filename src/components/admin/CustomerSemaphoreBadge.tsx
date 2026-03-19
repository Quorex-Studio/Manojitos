// Componente semáforo de cliente
import { motion } from 'framer-motion';
import { CustomerSemaphore, SemaphoreLevel } from '@/hooks/useCustomerSemaphore';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CustomerSemaphoreBadgeProps {
  semaphore: CustomerSemaphore;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function CustomerSemaphoreBadge({ 
  semaphore, 
  showLabel = true,
  size = 'md'
}: CustomerSemaphoreBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  const dotSizes = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3'
  };

  const dotColors = {
  green: "bg-primary shadow-[0_0_8px_rgba(20,184,166,0.4)]",
  yellow: "bg-gold shadow-[0_0_8px_rgba(234,179,8,0.4)]",
  red: "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]",
};

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`${semaphore.bgColor} ${sizeClasses[size]} rounded-full inline-flex items-center gap-2 font-medium cursor-help`}
        >
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`${dotSizes[size]} ${dotColors[semaphore.level]} rounded-full`}
          />
          {showLabel && (
            <span className={semaphore.color}>{semaphore.label}</span>
          )}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{semaphore.icon} {semaphore.label}</p>
        <p className="text-xs text-muted-foreground">{semaphore.description}</p>
        {!semaphore.canBuyOnCredit && (
          <p className="text-xs text-destructive mt-1">No puede comprar a crédito</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
