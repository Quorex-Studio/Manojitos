import React, { ReactNode, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  tertiaryText?: string;
  icon: ReactNode;
  variant?: 'default' | 'gold' | 'rose';
  delay?: number;
}

export const StatCard = memo(function StatCard({ title, value, subtitle, tertiaryText, icon, variant = 'default', delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -6, transition: { duration: 0.3 } }}
      className={cn(
        "rounded-2xl transition-all duration-300 p-4 md:p-5 backdrop-blur-sm",
        variant === 'gold' && "bg-card border border-gold/20 shadow-[0_8px_32px_hsl(var(--gold)/0.12)] hover:shadow-[0_16px_48px_hsl(var(--gold)/0.2)] hover:border-gold/40",
        variant === 'rose' && "bg-card border border-primary/20 shadow-[0_8px_32px_hsl(var(--rose)/0.12)] hover:shadow-[0_16px_48px_hsl(var(--rose)/0.2)] hover:border-primary/40",
        variant === 'default' && "bg-card border border-border/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_16px_48px_rgba(0,0,0,0.4)] hover:border-border/60"
      )}
    >
      {/* Mobile Layout (Horizontal) */}
      <div className="flex md:hidden items-center gap-4">
        <div className={cn(
          "p-2.5 rounded-xl shrink-0",
          variant === 'gold' && "bg-gold/10 text-gold",
          variant === 'rose' && "bg-primary/10 text-primary",
          variant === 'default' && "bg-secondary/80 text-secondary-foreground"
        )}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground/60 text-[10px] font-medium truncate tracking-[0.1em] uppercase">{title}</p>
          <p className={cn(
            "text-xl font-bold font-serif truncate",
            variant === 'gold' && "text-gradient-gold",
            variant !== 'gold' && "text-foreground"
          )}>
            {value}
          </p>
          {subtitle && <p className="text-muted-foreground/50 text-[10px] truncate mt-0.5">{subtitle}</p>}
          {tertiaryText && <p className="text-muted-foreground/40 text-[10px] truncate">{tertiaryText}</p>}
        </div>
      </div>

      {/* Desktop Layout (Vertical) */}
      <div className="hidden md:block">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground/60 text-xs font-medium tracking-[0.1em] uppercase">{title}</p>
            <p className={cn(
              "text-3xl font-bold mt-2 font-serif",
              variant === 'gold' && "text-gradient-gold",
              variant !== 'gold' && "text-foreground"
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="text-muted-foreground/50 text-sm mt-1">{subtitle}</p>
            )}
            {tertiaryText && (
              <p className="text-muted-foreground/40 text-xs mt-0.5">{tertiaryText}</p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl",
            variant === 'gold' && "bg-gold/10 text-gold",
            variant === 'rose' && "bg-primary/10 text-primary",
            variant === 'default' && "bg-secondary/80 text-secondary-foreground"
          )}>
            {icon}
          </div>
        </div>
      </div>
    </motion.div>
  );
});
