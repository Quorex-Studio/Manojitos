import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { StoreHeader } from './StoreHeader';
import { StoreFooter } from './StoreFooter';
import { OverdueCreditBanner } from './OverdueCreditBanner';
import { MobileTabBar } from './MobileTabBar';
import { ProfileCompletionGate } from './ProfileCompletionGate';

interface StoreLayoutProps {
  children: ReactNode;
}

// Layout principal de la tienda para clientes
export function StoreLayout({ children }: StoreLayoutProps) {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-clip w-full relative pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0" style={{ isolation: "isolate" }}>
      {/* Header fijo */}
      <ProfileCompletionGate />
      <StoreHeader />
      
      <OverdueCreditBanner />

      {/* Contenido principal */}
      {/* Transición corta entre páginas (se omite con "reducir movimiento") */}
      <motion.main
        key={pathname}
        className="flex-1"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.main>
      
      {/* Footer */}
      <StoreFooter />

      <MobileTabBar />
    </div>
  );
}
