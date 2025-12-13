import { ReactNode } from 'react';
import { StoreHeader } from './StoreHeader';
import { StoreFooter } from './StoreFooter';

interface StoreLayoutProps {
  children: ReactNode;
}

// Layout principal de la tienda para clientes
export function StoreLayout({ children }: StoreLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header fijo */}
      <StoreHeader />
      
      {/* Contenido principal */}
      <main className="flex-1">
        {children}
      </main>
      
      {/* Footer */}
      <StoreFooter />
    </div>
  );
}
