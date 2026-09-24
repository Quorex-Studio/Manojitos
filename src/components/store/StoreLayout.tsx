import { ReactNode } from 'react';
import { StoreHeader } from './StoreHeader';
import { StoreFooter } from './StoreFooter';
import { OverdueCreditBanner } from './OverdueCreditBanner';
import { MobileTabBar } from './MobileTabBar';

interface StoreLayoutProps {
  children: ReactNode;
}

// Layout principal de la tienda para clientes
export function StoreLayout({ children }: StoreLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-clip w-full relative pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0" style={{ isolation: "isolate" }}>
      {/* Header fijo */}
      <StoreHeader />
      
      <OverdueCreditBanner />

      {/* Contenido principal */}
      <main className="flex-1">
        {children}
      </main>
      
      {/* Footer */}
      <StoreFooter />

      <MobileTabBar />
    </div>
  );
}
