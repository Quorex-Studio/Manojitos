/**
 * useCustomerOrders — Hook to manage and track customer orders.
 * Tables: `orders`
 * Returns: { orders, isLoading, refetch, stats }
 */
// Hook para gestionar los pedidos del cliente
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Order, OrderItem } from '@/types';


export const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-gold/80' },
  confirmed: { label: 'Confirmado', color: 'bg-primary/80' },
  processing: { label: 'En preparación', color: 'bg-primary/60' },
  shipped: { label: 'Enviado', color: 'bg-primary' },
  delivered: { label: 'Entregado', color: 'bg-rose-dark' },
  cancelled: { label: 'Cancelado', color: 'bg-destructive/80' },
};

export const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-gold/80' },
  paid: { label: 'Pagado', color: 'bg-rose-dark' },
  failed: { label: 'Fallido', color: 'bg-destructive/80' },
  refunded: { label: 'Reembolsado', color: 'bg-muted-foreground/60' },
};

export function useCustomerOrders() {
  const { user } = useAuth();

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['customer-orders', user?.id],
    queryFn: async () => {
      // 1. Orders table (new system) — by customer_user_id
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // 2. Sales table — solo ventas vinculadas explícitamente a este cliente (customer_user_id)
      //    o procesadas por esta misma cuenta (user_id), nunca por coincidencia de teléfono suelta.
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .or(`customer_user_id.eq.${user!.id},user_id.eq.${user!.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      const fromOrders: Order[] = (ordersData || []).map(order => ({
        ...order,
        items: (order.items as unknown) as OrderItem[],
      })) as Order[];

      // Ventas del panel: una por sale_group_id (antes salía un "pedido" por cada producto)
      const saleGroups = new Map<string, NonNullable<typeof salesData>>();
      (salesData || []).forEach(sale => {
        const key = sale.sale_group_id || sale.id;
        saleGroups.set(key, [...(saleGroups.get(key) || []), sale]);
      });
      const fromSales: Order[] = [...saleGroups.entries()].map(([groupId, lines]) => {
        const first = lines[0];
        const total = lines.reduce((sum, l) => sum + Number(l.total_usd || 0), 0);
        const isCredit = lines.some(l => l.is_credit);
        const paid = isCredit ? lines.reduce((sum, l) => sum + Number(l.amount_paid || 0), 0) : total;
        return {
          id: groupId,
          user_id: first.user_id,
          customer_user_id: first.customer_user_id ?? null,
          customer_name: first.client_name ?? 'Cliente',
          customer_phone: first.client_phone ?? null,
          customer_email: null,
          items: lines.map(l => ({
            product_id: l.product_id ?? '',
            product_name: l.variant_label ? `${l.product_name} · ${l.variant_label}` : l.product_name,
            quantity: l.quantity,
            unit_price: l.unit_price_usd,
            total: l.total_usd,
          })) as OrderItem[],
          subtotal: total,
          discount: 0,
          total_usd: total,
          total_bs: lines.every(l => l.total_bs) ? lines.reduce((sum, l) => sum + Number(l.total_bs), 0) : null,
          // Venta en persona: ya se entregó
          status: 'delivered',
          payment_method: isCredit ? null : first.payment_method ?? null,
          banco_origen: null,
          numero_referencia: null,
          payment_status: total - paid > 0.009 ? 'pending' : 'paid',
          shipping_address: null,
          shipping_city: null,
          shipping_state: null,
          tracking_number: null,
          notes: first.notes ?? null,
          created_at: first.created_at,
          updated_at: first.created_at,
          source: 'sale',
          sale_group_id: groupId,
          sale_ids: lines.map(l => l.id),
          is_credit: isCredit,
          amount_paid: paid,
        };
      });

      // Merge and sort by date, deduplicate by id
      const all = [...fromOrders, ...fromSales];
      const seen = new Set<string>();
      return all
        .filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: !!user,
  });


  // Estadísticas
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    inProgress: orders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length,
    completed: orders.filter(o => o.status === 'delivered').length,
    totalSpent: orders
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + o.total_usd, 0),
  };

  return {
    orders,
    isLoading,
    refetch,
    stats,
  };
}

// Hook para un pedido específico
export function useCustomerOrder(orderId: string) {
  const { user } = useAuth();

  const { data: order, isLoading } = useQuery({
    queryKey: ['customer-order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('customer_user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        items: (data.items as unknown) as OrderItem[],
      } as Order;
    },
    enabled: !!user && !!orderId,
  });

  return { order, isLoading };
}
