import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  variant?: 'default' | 'gold' | 'rose';
  delay?: number;
}

export function StatCard({ title, value, subtitle, icon, variant = 'default', delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4 }}
      className={cn(
        "rounded-2xl transition-all duration-300 p-4 md:p-5",
        variant === 'gold' && "glass-card-gold",
        variant === 'rose' && "glass-card border-primary/30",
        variant === 'default' && "glass-card"
      )}
    >
      {/* Mobile Layout (Horizontal) */}
      <div className="flex md:hidden items-center gap-4">
        <div className={cn(
          "p-2.5 rounded-xl shrink-0",
          variant === 'gold' && "gradient-gold text-accent-foreground",
          variant === 'rose' && "gradient-primary text-primary-foreground",
          variant === 'default' && "bg-secondary text-secondary-foreground"
        )}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium truncate">{title}</p>
          <p className={cn(
            "text-xl font-bold font-serif truncate",
            variant === 'gold' && "text-gradient-gold",
            variant !== 'gold' && "text-foreground"
          )}>
            {value}
          </p>
        </div>
      </div>

      {/* Desktop Layout (Vertical) */}
      <div className="hidden md:block">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm font-medium">{title}</p>
            <p className={cn(
              "text-3xl font-bold mt-2 font-serif",
              variant === 'gold' && "text-gradient-gold",
              variant !== 'gold' && "text-foreground"
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl",
            variant === 'gold' && "gradient-gold text-accent-foreground",
            variant === 'rose' && "gradient-primary text-primary-foreground",
            variant === 'default' && "bg-secondary text-secondary-foreground"
          )}>
            {icon}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
