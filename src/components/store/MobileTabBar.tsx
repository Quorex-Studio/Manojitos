import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Home, Store, ShoppingBag, Heart, User } from 'reicon-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// Barra de navegación inferior (solo móvil): las 5 acciones más usadas al alcance del pulgar.
export function MobileTabBar() {
  const { pathname } = useLocation();
  const { getItemCount } = useCart();
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const itemCount = getItemCount();

  const tabs = [
    { to: '/', label: 'Inicio', icon: Home, active: pathname === '/' },
    { to: '/tienda', label: 'Tienda', icon: Store, active: pathname.startsWith('/tienda') || pathname.startsWith('/producto') },
    { to: '/carrito', label: 'Carrito', icon: ShoppingBag, active: pathname.startsWith('/carrito') || pathname.startsWith('/checkout'), badge: itemCount },
    { to: '/cliente/favoritos', label: 'Favoritos', icon: Heart, active: pathname.startsWith('/cliente/favoritos') },
    { to: user ? '/cliente/perfil' : `/cliente/auth?redirect=${encodeURIComponent(pathname)}`, label: user ? 'Mi cuenta' : 'Entrar', icon: User, active: pathname.startsWith('/cliente') && !pathname.startsWith('/cliente/favoritos') },
  ];

  return (
    <nav
      aria-label="Navegación principal"
      className="mobile-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {tabs.map(({ to, label, icon: Icon, active, badge }) => (
          <li key={label}>
            <Link
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                active ? 'text-primary' : 'text-muted-foreground active:text-foreground'
              )}
            >
              {active && (
                <motion.span
                  layoutId={reduceMotion ? undefined : 'tabbar-indicator'}
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">
                <Icon className="h-[22px] w-[22px]" />
                {!!badge && badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
