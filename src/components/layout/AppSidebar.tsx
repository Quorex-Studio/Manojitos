import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout, Package, ShoppingCart, CreditCard, Truck, FileText, Settings, Logout, Menu, CloseSquare, Store, FileUp, Wallet, Users } from 'reicon-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import logoImage from '@/assets/logo.jpeg';

const menuItems = [
  { icon: Layout, label: 'Panel General', path: '/dashboard' },
  { icon: Package, label: 'Productos', path: '/products' },
  { icon: FileUp, label: 'Importar', path: '/import-products' },
  { icon: ShoppingCart, label: 'Ventas', path: '/sales' },
  { icon: CreditCard, label: 'Cuentas por Cobrar', path: '/debts' },
  { icon: Wallet, label: 'Créditos', path: '/credits' },
  { icon: Truck, label: 'Proveedores', path: '/providers' },
  { icon: Users, label: 'Clientes', path: '/dashboard/clientes' },
  { icon: FileText, label: 'Reportes', path: '/reports' },
  { icon: Settings, label: 'Configuración', path: '/settings' },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location.pathname, isMobile]);

  return (
    <>
      {/* Mobile menu button */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <CloseSquare className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      )}


      {/* Overlay - mobile only */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "relative h-full bg-sidebar border-r border-sidebar-border flex-shrink-0 transition-all duration-300",
          isCollapsed && !isMobile ? "w-[80px]" : "w-[280px]",
          isMobile && "fixed left-0 top-0 z-50",
          isMobile && !isOpen && "-translate-x-full",
          isMobile && isOpen && "translate-x-0",
          !isMobile && "sticky top-0"
        )}
      >
        {/* Desktop collapse button */}
        {!isMobile && (
          <Button
            variant="outline"
            size="icon"
            className="absolute top-8 -right-4 z-50 h-8 w-8 rounded-full bg-background shadow-md border border-border flex items-center justify-center hover:bg-accent hover:text-accent-foreground"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        <div className={cn("flex flex-col h-full", isCollapsed && !isMobile ? "p-3" : "p-6")}>
          {/* Logo */}
          <div className={cn("mb-8 flex items-center", isCollapsed && !isMobile ? "justify-center pt-2" : "gap-3 pt-2")}>
            <img 
              src={logoImage} 
              alt="Manojitos" 
              className="h-11 w-11 rounded-full object-cover ring-1 ring-gold/20 flex-shrink-0"
            />
            {(!isCollapsed || isMobile) && (
              <div className="overflow-hidden">
                <h1 className="font-serif text-xl font-bold text-gradient-gold tracking-normal whitespace-nowrap">
                  Manojitos
                </h1>
                <p className="text-sidebar-foreground/30 text-[10px] font-sans tracking-[0.15em] uppercase whitespace-nowrap">Sistema de Gestión</p>
              </div>
            )}
          </div>

          {/* Ver Tienda */}
          <div className={cn("flex items-center justify-between mb-6 pb-4 border-b border-sidebar-border", isCollapsed && !isMobile && "justify-center")}>
            <Link to="/" className="flex items-center gap-2 text-xs text-sidebar-foreground/40 hover:text-gold transition-colors duration-300 tracking-wide" title="Ver tienda">
              <Store className="h-4 w-4" />
              {(!isCollapsed || isMobile) && <span>Ver tienda</span>}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => isMobile && setIsOpen(false)}
                >
                  <motion.div
                    whileHover={{ x: isCollapsed && !isMobile ? 0 : 4, scale: isCollapsed && !isMobile ? 1.1 : 1 }}
                    whileTap={{ scale: 0.98 }}
                    title={isCollapsed && !isMobile ? item.label : undefined}
                    className={cn(
                      "flex items-center rounded-xl transition-all duration-300",
                      isCollapsed && !isMobile ? "justify-center p-3" : "gap-3 px-4 py-2.5",
                      isActive 
                        ? "bg-primary/10 text-primary shadow-sm" 
                        : "hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className={cn(isCollapsed && !isMobile ? "h-5 w-5" : "h-4.5 w-4.5", isActive && "text-primary")} />
                    {(!isCollapsed || isMobile) && <span className="text-sm font-medium tracking-wide whitespace-nowrap">{item.label}</span>}
                  </motion.div>
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className={cn("flex items-center gap-2 mb-4", isCollapsed && !isMobile ? "flex-col" : "")}>
            <NotificationBell />
            <ThemeToggle />
          </div>

          {/* Logout */}
          <Button
            variant="ghost"
            onClick={() => signOut()}
            title={isCollapsed && !isMobile ? "Cerrar Sesión" : undefined}
            className={cn(
              "text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10 text-sm",
              isCollapsed && !isMobile ? "w-10 h-10 p-0 mx-auto justify-center" : "w-full justify-start gap-3"
            )}
          >
            <Logout className="h-5 w-5" />
            {(!isCollapsed || isMobile) && <span>Cerrar Sesión</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
