import { Layout, Package, ShoppingCart, Truck, FileText, Settings, FileUp, Wallet, Users, Scale } from 'reicon-react';

export interface AdminNavItem {
  icon: typeof Layout;
  label: string;
  /** Etiqueta corta para la barra inferior móvil */
  short?: string;
  path: string;
}

// Navegación del panel agrupada por frecuencia de uso: lo diario arriba, la configuración al final.
export const ADMIN_NAV: { title: string; items: AdminNavItem[] }[] = [
  {
    title: 'Día a día',
    items: [
      { icon: Layout, label: 'Panel general', short: 'Panel', path: '/dashboard' },
      { icon: ShoppingCart, label: 'Ventas y pedidos', short: 'Ventas', path: '/sales' },
      { icon: Package, label: 'Productos', short: 'Productos', path: '/products' },
      { icon: Wallet, label: 'Créditos', short: 'Créditos', path: '/credits' },
      { icon: Users, label: 'Clientes', path: '/dashboard/clientes' },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { icon: Truck, label: 'Proveedores', path: '/providers' },
      { icon: FileText, label: 'Reportes', path: '/reports' },
      { icon: FileUp, label: 'Importar productos', path: '/import-products' },
      { icon: Scale, label: 'Reglas de negocio', path: '/reglas' },
    ],
  },
  {
    title: 'Sistema',
    items: [{ icon: Settings, label: 'Configuración', path: '/settings' }],
  },
];

export const ADMIN_NAV_FLAT = ADMIN_NAV.flatMap(s => s.items);

/** Las 4 secciones de la barra inferior móvil; el resto vive en "Más" */
export const ADMIN_TABS = ['/dashboard', '/sales', '/products', '/credits'];

export const isAdminPathActive = (pathname: string, path: string) =>
  path === '/dashboard' ? pathname === '/dashboard' : pathname === path || pathname.startsWith(`${path}/`);

export const adminPageTitle = (pathname: string) =>
  ADMIN_NAV_FLAT.find(i => isAdminPathActive(pathname, i.path))?.label ?? 'Panel';
