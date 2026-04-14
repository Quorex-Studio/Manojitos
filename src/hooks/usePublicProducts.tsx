/**
 * usePublicProducts — Hook to fetch public product catalog for customers.
 * Filters: Only products with stock > 0.
 * Tables: `products`
 * Cache: 5min stale, 30min garbage collection.
 * Returns: { products, loading, categories, refetch, getProductById }
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PublicProduct } from '@/types';


// Hook para obtener productos públicos
export function usePublicProducts() {

  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ['public-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, price_usd, stock, category, image_url, sold_count, created_at')
        .gt('stock', 0) // Solo productos con stock
        .order('created_at', { ascending: false })
        .limit(100); // Limitar a 100 productos para carga inicial

      if (error) throw error;
      return data as PublicProduct[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de caché (evita lecturas innecesarias)
    gcTime: 1000 * 60 * 30, // Mantener en memoria 30 min
    refetchOnWindowFocus: false, // No recargar al cambiar de tab
  });

  // Derivar categorías de los datos en caché
  const categories = [...new Set(
    products
      .map(p => p.category)
      .filter((c): c is string => c !== null && c.trim() !== '')
  )];

  // Función helper para obtener un producto específico (usa caché si existe)
  const getProductById = async (id: string): Promise<PublicProduct | null> => {
    // Primero buscar en el caché de React Query
    const cachedProduct = products.find(p => p.id === id);
    if (cachedProduct) return cachedProduct;

    // Si no está en caché (ej. navegación directa), buscar en DB
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price_usd, stock, category, image_url, sold_count, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as PublicProduct;
  };

  return {
    products,
    loading: isLoading,
    categories,
    refetch,
    getProductById
  };
}
