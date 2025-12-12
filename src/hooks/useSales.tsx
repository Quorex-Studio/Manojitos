import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

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

    const { data, error } = await supabase
      .from('sales')
      .insert({ ...sale, user_id: user.id })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'No se pudo registrar la venta', variant: 'destructive' });
    } else {
      toast({ title: 'Éxito', description: 'Venta registrada correctamente' });
      
      // Update product stock and sold count
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
              stock: product.stock - sale.quantity,
              sold_count: product.sold_count + sale.quantity
            })
            .eq('id', sale.product_id);
        }
      }
    }
    return { data, error };
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
