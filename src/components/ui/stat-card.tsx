import { ReactNode, memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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

// Tarjeta KPI del panel (DESIGN.md → Panel): etiqueta, valor y detalle siempre visibles
// (en táctil no existe el hover). Si tiene href es un enlace a la sección que la explica;
// hoverContent es un extra solo para puntero fino (escritorio).
export const StatCard = memo(function StatCard({ title, value, subtitle, tertiaryText, icon, variant = 'default', delay = 0, href, hoverContent }: StatCardProps) {
  const reduceMotion = useReducedMotion();
  const detail = [subtitle, tertiaryText].filter(Boolean).join(' · ');

  const CardContent = (
    <div
      className={cn(
        'group relative flex h-full flex-col rounded-2xl border bg-card p-4 transition-colors duration-200 md:p-5',
        variant === 'gold' ? 'border-primary/25' : 'border-border',
        href && 'hover:border-primary/50 active:bg-muted/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-muted-foreground md:text-xs">{title}</p>
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl md:h-10 md:w-10 [&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-5 md:[&_svg]:w-5',
            variant === 'gold' || variant === 'rose' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          'mt-2 truncate font-serif text-2xl font-semibold tabular-nums md:text-3xl',
          variant === 'gold' ? 'text-primary' : 'text-foreground'
        )}
      >
        {value}
      </p>
      {detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}
      {href && (
        <ArrowUpRight className="absolute bottom-4 right-4 hidden h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary md:block" />
      )}
    </div>
  );

  const InnerElement = (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(delay, 0.2) }}
      className="h-full"
    >
      {href ? (
        <Link to={href} aria-label={`${title}: ${value}`} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {CardContent}
        </Link>
      ) : (
        CardContent
      )}
    </motion.div>
  );

  if (hoverContent) {
    return (
      <HoverCard openDelay={250} closeDelay={100}>
        <HoverCardTrigger asChild>{InnerElement}</HoverCardTrigger>
        <HoverCardContent className="hidden w-80 border-border bg-card p-4 shadow-xl md:block" align="center" sideOffset={10}>
          {hoverContent}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return InnerElement;
});
