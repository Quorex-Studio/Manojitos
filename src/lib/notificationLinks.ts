/**
 * A dónde lleva cada notificación según lo que trae (pedido, crédito, clienta, producto, venta).
 * Lo usan la campana del panel, la de la tienda y las páginas de notificaciones.
 */
export interface NotificationLike {
  credit_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface NotificationAction {
  to: string;
  label: string;
}

export function notificationAction(n: NotificationLike, audience: 'admin' | 'customer'): NotificationAction | null {
  const m = n.metadata ?? {};
  const str = (k: string) => (typeof m[k] === 'string' && m[k] ? String(m[k]) : null);
  if (audience === 'admin') {
    if (str('product_request_id') || (str('product_id') && m.kind === 'product_request')) return { to: '/solicitudes', label: 'Ver solicitudes' };
    if (str('sale_group_id')) return { to: '/sales', label: 'Ver ventas' };
    if (str('order_id')) return { to: '/sales?tab=pedidos', label: 'Ver pedidos' };
    if (n.credit_id) return { to: '/credits', label: 'Ver créditos' };
    if (str('customer_user_id')) return { to: '/dashboard/clientes', label: 'Ver clientes' };
    return null;
  }
  if (str('product_id')) return { to: `/producto/${str('product_id')}`, label: 'Ver el producto' };
  if (str('order_id') || str('sale_group_id')) return { to: '/cliente/pedidos', label: 'Ver mis pedidos' };
  if (n.credit_id) return { to: '/cliente/credito', label: 'Ver mi crédito' };
  return null;
}
