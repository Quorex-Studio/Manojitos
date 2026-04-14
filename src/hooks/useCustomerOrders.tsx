/**
 * useCustomerOrders — Hook to manage and track customer orders.
 * Tables: `orders`
 * Returns: { orders, isLoading, refetch, stats }
 */
// Hook para gestionar los pedidos del cliente
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  image_url?: string;
}

export interface Order {
  id: string;
  user_id: string;
  customer_user_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total_usd: number;
  total_bs: number | null;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_method: string | null;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

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
      // Fetch from orders table (future/new system)
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch from sales table (current checkout system)
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .eq('customer_user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const fromOrders: Order[] = (ordersData || []).map(order => ({
        ...order,
        items: (order.items as unknown) as OrderItem[],
      })) as Order[];

      // Map sales records to Order shape for unified display
      const fromSales: Order[] = (salesData || []).map(sale => ({
        id: sale.id,
        user_id: sale.user_id,
        customer_user_id: sale.customer_user_id ?? null,
        customer_name: sale.client_name ?? 'Cliente',
        customer_phone: sale.client_phone ?? null,
        customer_email: null,
        items: [{
          product_id: sale.product_id ?? '',
          product_name: sale.product_name,
          quantity: sale.quantity,
          unit_price: sale.unit_price_usd,
          total: sale.total_usd,
        }] as OrderItem[],
        subtotal: sale.total_usd,
        discount: 0,
        total_usd: sale.total_usd,
        total_bs: sale.total_bs ?? null,
        status: (sale.status as Order['status']) ?? 'pending',
        payment_method: sale.payment_method ?? null,
        payment_status: sale.is_credit ? 'pending' : 'paid',
        shipping_address: null,
        shipping_city: null,
        shipping_state: null,
        tracking_number: null,
        notes: sale.notes ?? null,
        created_at: sale.created_at,
        updated_at: sale.created_at,
      }));

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
