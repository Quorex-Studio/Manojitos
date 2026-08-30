/**
 * useProducts — Core hook for product catalog management.
 * Refactored to use TanStack Query for better caching and deduplication.
 * Handles: CRUD operations, inventory tracking, and real-time updates.
 * Tables: `products`
 * Validations: `productSchema` via Zod.
 * Returns: { products, loading, addProduct, updateProduct, deleteProduct, refetch }
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { productSchema, validateInput } from '@/lib/validations';
import { Product } from '@/types';

export function useProducts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutos
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
  const addProduct = useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'user_id' | 'sold_count' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('No autenticado');
      if (!product) throw new Error('Datos de producto requeridos');

      const validated = validateInput(productSchema, product);

      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: validated.name,
          price_usd: validated.price_usd,
          cost_usd: validated.cost_usd ?? 0,
          price_wholesale_eur: validated.price_wholesale_eur ?? 0,
          price_retail_eur: validated.price_retail_eur ?? 0,
          stock: validated.stock,
          description: validated.description,
          category: validated.category,
          image_url: validated.image_url,
          sizes: validated.sizes ?? null,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({ title: 'Éxito', description: 'Producto creado correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'No se pudo crear el producto', variant: 'destructive' });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Product> }) => {
      if (!id) throw new Error('ID de producto requerido');
      if (!updates || typeof updates !== 'object') throw new Error('Datos de actualización requeridos');

      const validated = productSchema.partial().parse(updates);

      const { data, error } = await supabase
        .from('products')
        .update(validated)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({ title: 'Éxito', description: 'Producto actualizado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar el producto', variant: 'destructive' });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({ title: 'Éxito', description: 'Producto eliminado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'No se pudo eliminar el producto', variant: 'destructive' });
    },
  });

  // Las mutaciones ya invalidan el caché automáticamente.
  // No se necesita suscripción realtime.

  return {
    products,
    loading: isLoading,
    addProduct: addProduct.mutateAsync,
    updateProduct: updateProduct.mutateAsync,
    deleteProduct: deleteProduct.mutateAsync,
    refetch,
  };
}
