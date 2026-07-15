import { ReactNode } from 'react';
import { StoreHeader } from './StoreHeader';
import { StoreFooter } from './StoreFooter';
import { OverdueCreditBanner } from './OverdueCreditBanner';

interface StoreLayoutProps {
  children: ReactNode;
}

// Layout principal de la tienda para clientes
export function StoreLayout({ children }: StoreLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden w-full max-w-[1600px] mx-auto relative shadow-2xl" style={{ isolation: "isolate" }}>
      {/* Header fijo */}
      <StoreHeader />
      
      <OverdueCreditBanner />

      {/* Contenido principal */}
      <main className="flex-1">
        {children}
      </main>
      
      {/* Footer */}
      <StoreFooter />
    </div>
  );
}
