import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { saleSchema, validateInput } from '@/lib/validations';

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
      setSales(data || []);
    }
    setLoading(false);
  };

  const addSale = async (sale: Omit<Sale, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return { error: new Error('No autenticado') };

    // Validate input before database operation
    try {
      const validated = validateInput(saleSchema, sale);

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
          user_id: user.id
        }])
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: 'No se pudo registrar la venta', variant: 'destructive' });
      } else {
        toast({ title: 'Éxito', description: 'Venta registrada correctamente' });
        
        // Update product stock and sold count
        if (validated.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('stock, sold_count')
            .eq('id', validated.product_id)
            .single();
            
          if (product) {
            await supabase
              .from('products')
              .update({
                stock: product.stock - validated.quantity,
                sold_count: product.sold_count + validated.quantity
              })
              .eq('id', validated.product_id);
          }
        }
      }
      return { data, error };
    } catch (validationError) {
      const errorMessage = validationError instanceof Error ? validationError.message : 'Datos inválidos';
      toast({ title: 'Error de validación', description: errorMessage, variant: 'destructive' });
      return { error: new Error(errorMessage) };
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

  return { sales, loading, addSale, deleteSale, refetch: fetchSales };
}
