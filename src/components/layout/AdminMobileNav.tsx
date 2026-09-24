import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { MoreSquare, Logout, Store } from 'reicon-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { OPEN_ANGELA_EVENT } from '@/lib/events';
import { BRAND } from '@/config/brand';
import { ADMIN_NAV, ADMIN_NAV_FLAT, ADMIN_TABS, adminPageTitle, isAdminPathActive } from './adminNav';

// Navegación del panel en móvil: barra superior con el título de la sección y barra inferior
// con las 4 secciones diarias + "Más" (hoja con todo el menú, tema y cerrar sesión).
export function AdminMobileNav() {
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [pathname]);

  const tabs = ADMIN_TABS.map(path => ADMIN_NAV_FLAT.find(i => i.path === path)!);
  const moreActive = !tabs.some(t => isAdminPathActive(pathname, t.path));

  return (
    <>
      {/* Barra superior */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-xl md:hidden">
        <Link to="/dashboard" aria-label="Ir al panel" className="shrink-0">
          <BrandLogo variant="isotipo" className="h-8" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-serif text-lg text-foreground">{adminPageTitle(pathname)}</h1>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_ANGELA_EVENT))}
          aria-label={`Preguntar a ${BRAND.assistantName}`}
          className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground active:bg-muted"
        >
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          {BRAND.assistantName}
        </button>
        <NotificationBell />
      </header>

      {/* Barra inferior */}
      <nav
        aria-label="Secciones del panel"
        className="mobile-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid h-16 grid-cols-5">
          {tabs.map(({ path, icon: Icon, short, label }) => {
            const active = isAdminPathActive(pathname, path);
            return (
              <li key={path}>
                <Link
                  to={path}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground active:text-foreground'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId={reduceMotion ? undefined : 'admin-tab-indicator'}
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                    />
                  )}
                  <Icon className="h-[22px] w-[22px]" />
                  {short || label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={cn(
                'relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium',
                moreActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {moreActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
              <MoreSquare className="h-[22px] w-[22px]" />
              Más
            </button>
          </li>
        </ul>
      </nav>

      {/* Hoja "Más" */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle className="font-serif">Menú</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            {ADMIN_NAV.map(section => (
              <div key={section.title}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{section.title}</p>
                <div className="grid grid-cols-3 gap-2">
                  {section.items.map(item => {
                    const active = isAdminPathActive(pathname, item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          'flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center text-xs font-medium transition-colors',
                          active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground active:bg-muted'
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="leading-tight">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-2">
              <span className="text-sm font-medium">Modo de color</span>
              <ThemeToggle />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link to="/" className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-medium">
                <Store className="h-4 w-4" /> Ver tienda
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="flex h-12 items-center justify-center gap-2 rounded-full border border-destructive/30 text-sm font-medium text-destructive"
              >
                <Logout className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
            {user?.email && <p className="text-center text-xs text-muted-foreground">{user.email}</p>}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
