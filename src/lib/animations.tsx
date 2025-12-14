import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ReactNode } from 'react';

// ============= VARIANTES DE ANIMACIÓN REUTILIZABLES =============

// Fade in con movimiento sutil
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

// Fade simple
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

// Scale con fade
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

// Slide desde la derecha
export const slideInRight: Variants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 30 }
};

// Slide desde la izquierda
export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 }
};

// Stagger children - para listas animadas
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

// Item para stagger
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

// ============= TRANSICIONES COMUNES =============

export const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30
};

export const smoothTransition = {
  duration: 0.3,
  ease: 'easeOut' as const
};

export const fastTransition = {
  duration: 0.2,
  ease: 'easeOut' as const
};

// ============= COMPONENTES DE ANIMACIÓN =============

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

// Wrapper para transiciones de página
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={fadeInUp}
      transition={smoothTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Wrapper para listas con stagger
export function StaggerList({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Item animado para listas
export function StaggerItem({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

// ============= HOVER EFFECTS =============

export const hoverScale = {
  scale: 1.02,
  transition: fastTransition
};

export const hoverLift = {
  y: -4,
  transition: fastTransition
};

export const tapScale = {
  scale: 0.98
};

// ============= SKELETON LOADER =============

interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Skeleton({ className = '', rounded = 'lg' }: SkeletonProps) {
  const roundedClass = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full'
  }[rounded];

  return (
    <div 
      className={`
        bg-gradient-to-r from-muted via-muted/60 to-muted
        bg-[length:200%_100%]
        animate-shimmer
        ${roundedClass}
        ${className}
      `}
    />
  );
}

// Skeleton para tarjetas de producto
export function ProductCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <Skeleton className="aspect-square w-full" rounded="sm" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

// Grid de skeletons para productos
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          <ProductCardSkeleton />
        </motion.div>
      ))}
    </div>
  );
}
