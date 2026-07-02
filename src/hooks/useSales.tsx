/**
 * useSales — Core hook to manage sales processing and checkout.
 * Handles: CRUD, transactional checkouts, stock management on confirmation.
 * Tables: `sales`, `products`
 * RPCs: `process_checkout`
 * Returns: { sales, loading, addSale, confirmSale, cancelSale, processCheckout, deleteSale, refetch }
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { saleSchema, validateInput } from '@/lib/validations';
import type { 
  Sale, 
  SaleStatus, 
  SaleInput, 
  StockValidationError 
} from '@/types';


export function useSales() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: sales = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data || []).map(sale => ({
        ...sale,
        status: sale.status as SaleStatus
      })) as Sale[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const invalidateSales = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
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
    banco_origen?: string;
    numero_referencia?: string;
  }

  interface CheckoutResponse {
    success: boolean;
    sale_ids: string[];
    total_usd: number;
    exchange_rate_used: number;
  }

  // Validar stock antes de checkout
  const validateStock = async (items: CheckoutItem[]): Promise<{ valid: boolean; errors: StockValidationError[] }> => {
    const errors: StockValidationError[] = [];

    for (const item of items) {
      const { data: product, error } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.id)
        .single();

      if (error || !product) {
        errors.push({
          productId: item.id,
          productName: item.name,
          requested: item.quantity,
          available: 0,
        });
      } else if (product.stock < item.quantity) {
        errors.push({
          productId: item.id,
          productName: item.name,
          requested: item.quantity,
          available: product.stock,
        });
      }
    }

    return { valid: errors.length === 0, errors };
  };

  // Checkout transaccional - usa la función atómica del servidor
  // Nota: process_checkout usa un tipo compuesto (order_item_input[]) que Supabase
  // no expone en los tipos autogenerados del cliente. El cast es necesario.
  const processCheckout = async (
    items: CheckoutItem[],
    checkoutData: CheckoutData
  ) => {
    if (!user) return { error: new Error('No autenticado'), saleIds: [] as string[] };

    try {
      // Validar stock antes de procesar
      const { valid, errors } = await validateStock(items);

      if (!valid) {
        const errorMessages = errors.map(
          e => `${e.productName}: solicitaste ${e.requested}, pero solo quedan ${e.available}`
        );
        const errorMessage = `Stock insuficiente:\n${errorMessages.join('\n')}`;

        toast({
          title: 'Stock no disponible',
          description: errorMessage,
          variant: 'destructive',
        });

        return {
          error: new Error(errorMessage),
          saleIds: [],
          stockErrors: errors,
        };
      }

      const { data, error } = await (supabase.rpc as unknown as (
        fn: 'process_checkout',
        args: {
          items: CheckoutItem[];
          payment_method: string;
          client_name: string;
          client_phone: string;
          notes: string | null;
          total_bs_rate: number | null;
          p_banco_origen: string | null;
          p_numero_referencia: string | null;
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
          p_banco_origen: checkoutData.banco_origen || null,
          p_numero_referencia: checkoutData.numero_referencia || null,
        }
      );

      if (error) {
        console.error('Error processing checkout:', error);
        throw error;
      }

      if (data?.success) {
        toast({ title: 'Éxito', description: 'Pedido procesado correctamente' });
        invalidateSales();
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

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateSales();
      toast({ title: 'Éxito', description: 'Venta eliminada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'No se pudo eliminar la venta', variant: 'destructive' });
    },
  });

  // Las mutaciones ya invalidan el caché automáticamente vía invalidateSales().
  // No se necesita suscripción realtime.

  return {
    sales,
    loading: isLoading,
    addSale,
    confirmSale,
    cancelSale,
    processCheckout,
    validateStock,
    deleteSale: deleteSale.mutateAsync,
    refetch,
  };
}
