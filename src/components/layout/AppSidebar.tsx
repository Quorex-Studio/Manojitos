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
  Calculator
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useState } from 'react';
import { cn } from '@/lib/utils';

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

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        className={cn(
          "fixed left-0 top-0 h-full w-[280px] sidebar-glass border-r border-border z-50",
          "md:translate-x-0 md:static"
        )}
      >
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-gradient-gold">
              Manojitos
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Sistema de Gestión</p>
          </div>

          {/* Theme Toggle y Ver Tienda */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Store className="h-4 w-4" />
              <span>Ver tienda</span>
            </Link>
            <ThemeToggle />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                >
                  <motion.div
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                      isActive 
                        ? "gradient-primary text-primary-foreground shadow-rose" 
                        : "hover:bg-secondary text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
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
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-5 w-5" />
            Cerrar Sesión
          </Button>
        </div>
      </motion.aside>
    </>
  );
}
