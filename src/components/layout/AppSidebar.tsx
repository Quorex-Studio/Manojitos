import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  CreditCard, 
  Truck, 
  FileText, 
  Settings,
  LogOut,
  Menu,
  X,
  Store,
  FileUp,
  Wallet,
  Calculator,
  Scale
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import logoImage from '@/assets/logo.jpeg';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Package, label: 'Productos', path: '/products' },
  { icon: FileUp, label: 'Importar', path: '/import-products' },
  { icon: ShoppingCart, label: 'Ventas', path: '/sales' },
  { icon: CreditCard, label: 'Deudas', path: '/debts' },
  { icon: Wallet, label: 'Créditos', path: '/credits' },
  { icon: Truck, label: 'Proveedores', path: '/providers' },
  { icon: FileText, label: 'Reportes', path: '/reports' },
  { icon: Calculator, label: 'Calculadora', path: '/calculadora' },
  { icon: Settings, label: 'Configuración', path: '/settings' },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
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
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
          "h-full w-[280px] bg-[#120A0C] border-r border-[#F5EDE8]/5 flex-shrink-0",
          isMobile && "fixed left-0 top-0 z-50 transition-transform duration-300",
          isMobile && !isOpen && "-translate-x-full",
          isMobile && isOpen && "translate-x-0",
          !isMobile && "sticky top-0"
        )}
      >
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="mb-8 flex items-center gap-3">
            <img 
              src={logoImage} 
              alt="Manojitos" 
              className="h-11 w-11 rounded-full object-cover ring-1 ring-gold/20"
            />
            <div>
              <h1 className="font-serif text-xl font-bold text-gradient-gold tracking-normal">
                Manojitos
              </h1>
              <p className="text-[#F5EDE8]/30 text-[10px] font-sans tracking-[0.15em] uppercase">Sistema de Gestión</p>
            </div>
          </div>

          {/* Ver Tienda */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#F5EDE8]/5">
            <Link to="/" className="flex items-center gap-2 text-xs text-[#F5EDE8]/40 hover:text-gold transition-colors duration-300 tracking-wide">
              <Store className="h-3.5 w-3.5" />
              <span>Ver tienda</span>
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
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300",
                      isActive 
                        ? "bg-primary/15 text-primary shadow-[0_0_20px_rgba(196,96,122,0.15)]" 
                        : "hover:bg-[#F5EDE8]/5 text-[#F5EDE8]/50 hover:text-[#F5EDE8]/80"
                    )}
                  >
                    <item.icon className={cn("h-4.5 w-4.5", isActive && "text-primary")} />
                    <span className="text-sm font-medium tracking-wide">{item.label}</span>
                  </motion.div>
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 mb-4">
            <NotificationBell />
            <ThemeToggle />
          </div>

          {/* Logout */}
          <Button
            variant="ghost"
            onClick={() => signOut()}
            className="w-full justify-start gap-3 text-[#F5EDE8]/30 hover:text-destructive hover:bg-destructive/10 text-sm"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>
    </>
  );
}
