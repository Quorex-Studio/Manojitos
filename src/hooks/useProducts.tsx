import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price_usd: number;
  stock: number;
  category: string | null;
  image_url: string | null;
  sold_count: number;
  created_at: string;
  updated_at: string;
}

export function useProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los productos', variant: 'destructive' });
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const addProduct = async (product: Omit<Product, 'id' | 'user_id' | 'sold_count' | 'created_at' | 'updated_at'>) => {
    if (!user) return { error: new Error('No autenticado') };

    const { data, error } = await supabase
      .from('products')
      .insert({ ...product, user_id: user.id })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'No se pudo crear el producto', variant: 'destructive' });
    } else {
      toast({ title: 'Éxito', description: 'Producto creado correctamente' });
    }
    return { data, error };
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar el producto', variant: 'destructive' });
    } else {
      toast({ title: 'Éxito', description: 'Producto actualizado' });
    }
    return { data, error };
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el producto', variant: 'destructive' });
    } else {
      toast({ title: 'Éxito', description: 'Producto eliminado' });
    }
    return { error };
  };

  useEffect(() => {
    if (user) {
      fetchProducts();

      // Subscribe to realtime updates
      const channel = supabase
        .channel('products-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'products'
          },
          () => {
            fetchProducts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return { products, loading, addProduct, updateProduct, deleteProduct, refetch: fetchProducts };
}
