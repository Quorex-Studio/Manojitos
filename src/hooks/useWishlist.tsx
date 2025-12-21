// Hook para gestionar la lista de deseos del cliente
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  product?: {
    id: string;
    name: string;
    price_usd: number;
    image_url: string | null;
    stock: number;
    category: string | null;
  };
}

export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Obtener wishlist con productos
  const { data: wishlist = [], isLoading } = useQuery({
    queryKey: ['wishlist', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wishlist')
        .select(`
          *,
          product:products(id, name, price_usd, image_url, stock, category)
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WishlistItem[];
    },
    enabled: !!user,
  });

  // Verificar si un producto está en wishlist
  const isInWishlist = (productId: string): boolean => {
    return wishlist.some(item => item.product_id === productId);
  };

  // Agregar a wishlist
  const addToWishlist = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('No autenticado');

      const { data, error } = await supabase
        .from('wishlist')
        .insert({ user_id: user.id, product_id: productId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.success('Agregado a favoritos');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.info('Ya está en tu lista de deseos');
      } else {
        toast.error('Error al agregar a favoritos');
      }
    },
  });

  // Eliminar de wishlist
  const removeFromWishlist = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('No autenticado');

      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.success('Eliminado de favoritos');
    },
    onError: () => {
      toast.error('Error al eliminar de favoritos');
    },
  });

  // Toggle wishlist
  const toggleWishlist = (productId: string) => {
    if (isInWishlist(productId)) {
      removeFromWishlist.mutate(productId);
    } else {
      addToWishlist.mutate(productId);
    }
  };

  return {
    wishlist,
    isLoading,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    count: wishlist.length,
  };
}
