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
  pending: { label: 'Pendiente', color: 'bg-yellow-500' },
  confirmed: { label: 'Confirmado', color: 'bg-blue-500' },
  processing: { label: 'En preparación', color: 'bg-purple-500' },
  shipped: { label: 'Enviado', color: 'bg-indigo-500' },
  delivered: { label: 'Entregado', color: 'bg-green-500' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500' },
};

export const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-500' },
  paid: { label: 'Pagado', color: 'bg-green-500' },
  failed: { label: 'Fallido', color: 'bg-red-500' },
  refunded: { label: 'Reembolsado', color: 'bg-gray-500' },
};

export function useCustomerOrders() {
  const { user } = useAuth();

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['customer-orders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse items JSON
      return (data || []).map(order => ({
        ...order,
        items: (order.items as unknown) as OrderItem[],
      })) as Order[];
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
