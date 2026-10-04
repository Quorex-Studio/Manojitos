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
import { productSchema, validateFriendly } from '@/lib/validations';
import type { Product } from '@/types';
import { withDirectImage } from '@/lib/imageUrl';
export type { Product };

export interface VariantDraft { id?: string; label: string; stock: number; price_usd: number | null }

export function useProducts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_variants(id, label, stock, price_usd, sort_order)')
        .order('created_at', { ascending: false })
        .limit(1000); // el catálogo completo (antes 200 escondía productos)

      if (error) throw error;
      return (data as Product[]).map(withDirectImage);
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

      const validated = validateFriendly(productSchema, product);

      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: validated.name,
          price_usd: validated.price_usd,
          price_bs_usd: validated.price_bs_usd ?? null,
          cost_usd: validated.cost_usd ?? 0,
          price_wholesale_eur: validated.price_wholesale_eur ?? 0,
          price_retail_eur: validated.price_retail_eur ?? 0,
          stock: validated.stock,
          description: validated.description,
          category: validated.category,
          image_url: validated.image_url,
          sizes: validated.sizes ?? null,
          presentation: validated.presentation ?? null,
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

      const validated = validateFriendly(productSchema.partial(), updates);

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

  /**
   * Guarda las tallas/tonos/presentaciones de un producto tal como quedaron en el formulario:
   * borra las que se quitaron, actualiza las existentes y crea las nuevas. El stock y las
   * etiquetas del producto los recalcula la base (trigger).
   */
  const saveVariants = async (productId: string, rows: VariantDraft[]) => {
    const { data: current, error: readErr } = await supabase.from('product_variants').select('id').eq('product_id', productId);
    if (readErr) throw readErr;
    const keep = new Set(rows.filter(r => r.id).map(r => r.id));
    const removed = (current || []).map(v => v.id).filter(id => !keep.has(id));
    if (removed.length) {
      const { error } = await supabase.from('product_variants').delete().in('id', removed);
      if (error) throw error;
    }
    for (const [i, r] of rows.entries()) {
      const row = { label: r.label.trim(), stock: Math.max(0, Math.floor(r.stock)), price_usd: r.price_usd, sort_order: i + 1 };
      const { error } = r.id
        ? await supabase.from('product_variants').update(row).eq('id', r.id)
        : await supabase.from('product_variants').insert({ ...row, product_id: productId });
      if (error) throw error;
    }
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    queryClient.invalidateQueries({ queryKey: ['public-products'] });
  };

  // Las mutaciones ya invalidan el caché automáticamente.
  // No se necesita suscripción realtime.

  return {
    products,
    loading: isLoading,
    addProduct: addProduct.mutateAsync,
    updateProduct: updateProduct.mutateAsync,
    deleteProduct: deleteProduct.mutateAsync,
    saveVariants,
    refetch,
  };
}
