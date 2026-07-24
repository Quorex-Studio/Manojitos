import React, { ReactNode, memo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'reicon-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  tertiaryText?: string;
  icon: ReactNode;
  variant?: 'default' | 'gold' | 'rose';
  delay?: number;
  href?: string;
  hoverContent?: ReactNode;
}

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

export const StatCard = memo(function StatCard({ title, value, subtitle, tertiaryText, icon, variant = 'default', delay = 0, href, hoverContent }: StatCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  const CardContent = (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={cn(
        "group relative overflow-hidden rounded-2xl transition-all duration-300 p-4 md:p-5 backdrop-blur-sm",
        href && "cursor-pointer",
        variant === 'gold' && "bg-card border border-gold/20 shadow-[0_8px_32px_hsl(var(--gold)/0.12)] hover:shadow-[0_16px_48px_hsl(var(--gold)/0.2)] hover:border-gold/40",
        variant === 'rose' && "bg-card border border-primary/20 shadow-[0_8px_32px_hsl(var(--rose)/0.12)] hover:shadow-[0_16px_48px_hsl(var(--rose)/0.2)] hover:border-primary/40",
        variant === 'default' && "bg-card border border-border/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_16px_48px_rgba(0,0,0,0.4)] hover:border-border/60"
      )}
    >
      {/* Glow Effect on Hover */}
      <div 
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" 
        style={{
          background: `radial-gradient(400px circle at var(--mouse-x, 0) var(--mouse-y, 0), ${
            variant === 'gold' ? 'hsl(var(--gold)/0.15)' : 'hsl(var(--primary)/0.15)'
          }, transparent 40%)`
        }} 
      />

      {/* Mobile Layout (Horizontal) */}
      <div className="flex md:hidden items-center gap-4 relative z-10">
        <div className={cn(
          "p-2.5 rounded-xl shrink-0 transition-transform duration-300 group-hover:scale-110",
          variant === 'gold' && "bg-gold/10 text-gold",
          variant === 'rose' && "bg-primary/10 text-primary",
          variant === 'default' && "bg-secondary/80 text-secondary-foreground"
        )}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground/60 text-[10px] font-medium truncate tracking-[0.1em] uppercase">{title}</p>
          <div className="flex items-center justify-between">
            <p className={cn(
              "text-xl font-bold font-serif truncate transition-colors duration-300",
              variant === 'gold' && "text-gradient-gold",
              variant !== 'gold' && "text-foreground group-hover:text-primary"
            )}>
              {value}
            </p>
            {href && <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0" />}
          </div>
          <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-300 group-hover:grid-rows-[1fr] group-hover:opacity-100 mt-0 group-hover:mt-1">
            <div className="overflow-hidden">
              {subtitle && <p className="text-muted-foreground/50 text-[10px] truncate mt-0.5">{subtitle}</p>}
              {tertiaryText && <p className="text-muted-foreground/40 text-[10px] truncate">{tertiaryText}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout (Vertical) */}
      <div className="hidden md:block relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground/60 text-xs font-medium tracking-[0.1em] uppercase">{title}</p>
            <p className={cn(
              "text-3xl font-bold mt-2 font-serif transition-colors duration-300",
              variant === 'gold' && "text-gradient-gold",
              variant !== 'gold' && "text-foreground group-hover:text-primary"
            )}>
              {value}
            </p>
            <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-300 group-hover:grid-rows-[1fr] group-hover:opacity-100 mt-0 group-hover:mt-1">
              <div className="overflow-hidden">
                {subtitle && (
                  <p className="text-muted-foreground/50 text-sm mt-1">{subtitle}</p>
                )}
                {tertiaryText && (
                  <p className="text-muted-foreground/40 text-xs mt-0.5">{tertiaryText}</p>
                )}
              </div>
            </div>
          </div>
          <div className={cn(
            "p-3 rounded-xl transition-all duration-300 group-hover:scale-110",
            variant === 'gold' && "bg-gold/10 text-gold group-hover:shadow-[0_0_15px_hsl(var(--gold)/0.3)]",
            variant === 'rose' && "bg-primary/10 text-primary group-hover:shadow-[0_0_15px_hsl(var(--rose)/0.3)]",
            variant === 'default' && "bg-secondary/80 text-secondary-foreground group-hover:bg-primary/10 group-hover:text-primary group-hover:shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
          )}>
            {icon}
          </div>
        </div>
        {href && (
          <div className="absolute top-0 right-0 p-1 opacity-0 -translate-x-2 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0">
            <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
          </div>
        )}
      </div>
    </div>
  );

  const InnerElement = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -6, transition: { duration: 0.3 } }}
      className="h-full block"
    >
      {href ? (
        <Link to={href} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
          {CardContent}
        </Link>
      ) : (
        <div className="h-full block">{CardContent}</div>
      )}
    </motion.div>
  );

  if (hoverContent) {
    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          {InnerElement}
        </HoverCardTrigger>
        <HoverCardContent className="w-80 glass-card bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl z-50 p-4" align="center" sideOffset={10}>
          {hoverContent}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return InnerElement;
});
