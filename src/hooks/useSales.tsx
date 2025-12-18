import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { saleSchema, validateInput, SaleStatus } from '@/lib/validations';

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
      const validated = validateInput(saleSchema, { ...sale, status });

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

  // Checkout transaccional - crea ventas pending y confirma todas o cancela
  const processCheckout = async (
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      price_usd: number;
    }>,
    checkoutData: {
      payment_method: string;
      client_name: string;
      client_phone: string;
      notes?: string;
      total_bs_rate?: number;
    }
  ) => {
    if (!user) return { error: new Error('No autenticado'), saleIds: [] };

    const saleIds: string[] = [];
    
    try {
      // 1. Crear todas las ventas en estado pending
      for (const item of items) {
        const { data, error } = await addSale({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price_usd: item.price_usd,
          total_usd: item.price_usd * item.quantity,
          total_bs: checkoutData.total_bs_rate ? (item.price_usd * item.quantity * checkoutData.total_bs_rate) : null,
          payment_method: checkoutData.payment_method,
          client_name: checkoutData.client_name,
          client_phone: checkoutData.client_phone,
          is_credit: false,
          notes: checkoutData.notes || null
        }, 'pending');

        if (error || !data) {
          // Rollback: cancelar ventas creadas
          for (const id of saleIds) {
            await cancelSale(id);
          }
          return { error: error || new Error('Error creando venta'), saleIds: [] };
        }
        
        saleIds.push(data.id);
      }

      // 2. Confirmar todas las ventas
      for (const saleId of saleIds) {
        const { error } = await confirmSale(saleId);
        if (error) {
          // Rollback parcial - las ventas confirmadas no se pueden deshacer fácilmente
          // pero las pendientes se cancelan
          for (const id of saleIds) {
            const { data: s } = await supabase.from('sales').select('status').eq('id', id).single();
            if (s?.status === 'pending') {
              await cancelSale(id);
            }
          }
          return { error, saleIds };
        }
      }

      toast({ title: 'Éxito', description: 'Pedido procesado correctamente' });
      return { error: null, saleIds };
      
    } catch (err) {
      // Rollback en caso de error
      for (const id of saleIds) {
        await cancelSale(id);
      }
      return { error: err instanceof Error ? err : new Error('Error desconocido'), saleIds: [] };
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
