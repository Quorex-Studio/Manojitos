import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AppSidebar } from './AppSidebar';
import { AdminMobileNav } from './AdminMobileNav';

interface AppLayoutProps {
  children: ReactNode;
}

// Estructura del panel: barra lateral (md+) o barras superior/inferior (móvil).
export function AppLayout({ children }: AppLayoutProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav />
        <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-24">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="admin-page mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 md:px-8 md:py-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
