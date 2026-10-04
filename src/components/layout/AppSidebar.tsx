import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logout, Store, SidebarLeft } from 'reicon-react';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { storageKey } from '@/config/brand';
import { cn } from '@/lib/utils';
import { ADMIN_NAV, isAdminPathActive } from './adminNav';

const COLLAPSE_KEY = storageKey('admin_sidebar_collapsed');

// Barra lateral del panel (tablet y escritorio). En móvil la navegación vive en AdminMobileNav.
// Se colapsa con un botón (y se recuerda), no con hover: así el contenido no salta de lado.
export function AppSidebar() {
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      // Por defecto: colapsada en tablet, expandida en escritorio
      return stored ? stored === '1' : window.innerWidth < 1280;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* sin almacenamiento */ }
  }, [collapsed]);

  const withTip = (label: string, node: React.ReactNode) =>
    collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : node;

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        aria-label="Menú del panel"
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex',
          collapsed ? 'w-[76px]' : 'w-[248px]'
        )}
      >
        {/* Marca + colapsar */}
        <div className={cn('flex h-16 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          <Link to="/dashboard" aria-label="Ir al panel" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {collapsed ? <BrandLogo variant="isotipo" className="h-9" /> : <BrandLogo className="h-8" />}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Contraer menú"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <SidebarLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {collapsed && (
            <div className="mb-3 flex justify-center">
              {withTip('Expandir menú', (
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  aria-label="Expandir menú"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <SidebarLeft className="h-5 w-5 rotate-180" />
                </button>
              ))}
            </div>
          )}
          {ADMIN_NAV.map(section => (
            <div key={section.title} className="mb-5 last:mb-0">
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/50">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map(item => {
                  const active = isAdminPathActive(pathname, item.path);
                  return (
                    <li key={item.path}>
                      {withTip(item.label, (
                        <Link
                          to={item.path}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'relative flex h-10 items-center rounded-lg text-sm font-medium transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            collapsed ? 'justify-center' : 'gap-3 px-3',
                            active
                              ? 'bg-sidebar-accent text-sidebar-primary'
                              : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                          )}
                        >
                          {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-sidebar-primary" />}
                          <item.icon className="h-5 w-5 shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Pie: tienda, avisos, tema, usuario, salir */}
        <div className="border-t border-sidebar-border p-3">
          <div className={cn('mb-2 flex items-center', collapsed ? 'flex-col gap-1' : 'gap-1')}>
            {withTip('Ver tienda', (
              <Link
                to="/"
                aria-label="Ver tienda"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Store className="h-5 w-5" />
              </Link>
            ))}
            <NotificationBell />
            <ThemeToggle />
          </div>
          <div className={cn('flex items-center rounded-lg', collapsed ? 'justify-center' : 'gap-3 px-2 py-1.5')}>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">{user?.user_metadata?.full_name || 'Administración'}</p>
                <p className="truncate text-xs text-sidebar-foreground/60">{user?.email}</p>
              </div>
            )}
            {withTip('Cerrar sesión', (
              <button
                type="button"
                onClick={() => signOut()}
                aria-label="Cerrar sesión"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive"
              >
                <Logout className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
