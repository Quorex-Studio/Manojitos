import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { saleSchema, validateInput, SaleStatus, SaleInput } from '@/lib/validations';

export interface Sale {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_usd: number;
  total_usd: number;
  total_bs: number | null;
  payment_method: string;
  client_name: string | null;
  client_phone: string | null;
  is_credit: boolean;
  notes: string | null;
  status: SaleStatus;
  created_at: string;
}

export function useSales() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSales = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las ventas', variant: 'destructive' });
    } else {
      setSales((data || []).map(sale => ({
        ...sale,
        status: sale.status as SaleStatus
      })));
    }
    setLoading(false);
  };

  // Crea venta en estado pending (transaccional)
  const addSale = async (sale: Omit<Sale, 'id' | 'user_id' | 'created_at' | 'status'>, status: SaleStatus = 'pending') => {
    if (!user) return { error: new Error('No autenticado') };

    try {
      const validated = validateInput<SaleInput>(saleSchema, { ...sale, status });

      const { data, error } = await supabase
        .from('sales')
        .insert([{
          product_id: validated.product_id,
          product_name: validated.product_name,
          quantity: validated.quantity,
          unit_price_usd: validated.unit_price_usd,
          total_usd: validated.total_usd,
          total_bs: validated.total_bs,
          payment_method: validated.payment_method,
          client_name: validated.client_name,
          client_phone: validated.client_phone,
          is_credit: validated.is_credit,
          notes: validated.notes,
          status: validated.status,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: 'No se pudo registrar la venta', variant: 'destructive' });
      }
      return { data, error };
    } catch (validationError) {
      const errorMessage = validationError instanceof Error ? validationError.message : 'Datos inválidos';
      toast({ title: 'Error de validación', description: errorMessage, variant: 'destructive' });
      return { error: new Error(errorMessage) };
    }
  };

  // Confirmar venta - actualiza stock y crea entrada en ledger
  const confirmSale = async (saleId: string) => {
    if (!user) return { error: new Error('No autenticado') };

    // Obtener venta
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (fetchError || !sale) {
      toast({ title: 'Error', description: 'Venta no encontrada', variant: 'destructive' });
      return { error: fetchError || new Error('Venta no encontrada') };
    }

    if (sale.status !== 'pending') {
      toast({ title: 'Error', description: 'La venta ya fue procesada', variant: 'destructive' });
      return { error: new Error('La venta ya fue procesada') };
    }

    // Actualizar estado a confirmed
    const { error: updateError } = await supabase
      .from('sales')
      .update({ status: 'confirmed' })
      .eq('id', saleId);

    if (updateError) {
      toast({ title: 'Error', description: 'No se pudo confirmar la venta', variant: 'destructive' });
      return { error: updateError };
    }

    // Actualizar stock del producto
    if (sale.product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('stock, sold_count')
        .eq('id', sale.product_id)
        .single();

      if (product) {
        await supabase
          .from('products')
          .update({
            stock: Math.max(0, product.stock - sale.quantity),
            sold_count: product.sold_count + sale.quantity
          })
          .eq('id', sale.product_id);
      }
    }

    toast({ title: 'Éxito', description: 'Venta confirmada' });
    return { data: sale, error: null };
  };

  // Cancelar venta pendiente
  const cancelSale = async (saleId: string) => {
    if (!user) return { error: new Error('No autenticado') };

    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('status')
      .eq('id', saleId)
      .single();

    if (fetchError || !sale) {
      return { error: fetchError || new Error('Venta no encontrada') };
    }

    if (sale.status === 'confirmed') {
      toast({ title: 'Error', description: 'No se puede cancelar una venta confirmada', variant: 'destructive' });
      return { error: new Error('No se puede cancelar una venta confirmada') };
    }

    const { error } = await supabase
      .from('sales')
      .update({ status: 'cancelled' })
      .eq('id', saleId);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo cancelar la venta', variant: 'destructive' });
    } else {
      toast({ title: 'Venta cancelada', description: 'La venta ha sido cancelada' });
    }
    return { error };
  };

  // Tipos para el checkout transaccional
  interface CheckoutItem {
    id: string;
    name: string;
    quantity: number;
    price_usd: number;
  }

  interface CheckoutData {
    payment_method: string;
    client_name: string;
    client_phone: string;
    notes?: string;
    total_bs_rate?: number;
  }

  interface CheckoutResponse {
    success: boolean;
    sale_ids: string[];
    total_usd: number;
    exchange_rate_used: number;
  }

  // Checkout transaccional - usa la función atómica del servidor
  // Nota: process_checkout usa un tipo compuesto (order_item_input[]) que Supabase
  // no expone en los tipos autogenerados del cliente. El cast es necesario.
  const processCheckout = async (
    items: CheckoutItem[],
    checkoutData: CheckoutData
  ) => {
    if (!user) return { error: new Error('No autenticado'), saleIds: [] as string[] };

    try {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: 'process_checkout',
        args: {
          items: CheckoutItem[];
          payment_method: string;
          client_name: string;
          client_phone: string;
          notes: string | null;
          total_bs_rate: number | null;
        }
      ) => Promise<{ data: CheckoutResponse | null; error: Error | null }>)(
        'process_checkout',
        {
          items,
          payment_method: checkoutData.payment_method,
          client_name: checkoutData.client_name,
          client_phone: checkoutData.client_phone,
          notes: checkoutData.notes || null,
          total_bs_rate: checkoutData.total_bs_rate || null,
        }
      );

      if (error) {
        console.error('Error processing checkout:', error);
        throw error;
      }

      if (data?.success) {
        toast({ title: 'Éxito', description: 'Pedido procesado correctamente' });
        fetchSales();
        return { error: null, saleIds: data.sale_ids };
      } else {
        throw new Error('La transacción no se pudo completar');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error desconocido procesando la compra');
      toast({
        title: 'Error',
        description: error.message || 'No se pudo procesar el pedido. Verifica el stock.',
        variant: 'destructive',
      });
      return { error, saleIds: [] as string[] };
    }
  };

  const deleteSale = async (id: string) => {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar la venta', variant: 'destructive' });
    } else {
      toast({ title: 'Éxito', description: 'Venta eliminada' });
    }
    return { error };
  };

  useEffect(() => {
    if (user) {
      fetchSales();

      const channel = supabase
        .channel('sales-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sales' },
          () => { fetchSales(); }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  return {
    sales,
    loading,
    addSale,
    confirmSale,
    cancelSale,
    processCheckout,
    deleteSale,
    refetch: fetchSales
  };
}
