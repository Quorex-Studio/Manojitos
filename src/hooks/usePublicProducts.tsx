import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Interfaz del producto público
export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price_usd: number;
  stock: number;
  category: string | null;
  image_url: string | null;
}

// Hook para obtener productos públicos (sin autenticación)
export function usePublicProducts() {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);

  // Obtener todos los productos disponibles públicamente
  const fetchProducts = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price_usd, stock, category, image_url')
      .gt('stock', 0) // Solo productos con stock
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProducts(data);
      
      // Extraer categorías únicas
      const uniqueCategories = [...new Set(
        data
          .map(p => p.category)
          .filter((c): c is string => c !== null && c.trim() !== '')
      )];
      setCategories(uniqueCategories);
    }
    
    setLoading(false);
  };

  // Obtener un producto por ID
  const getProductById = async (id: string): Promise<PublicProduct | null> => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price_usd, stock, category, image_url')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  };

  // Cargar productos al montar y suscribirse a cambios
  useEffect(() => {
    fetchProducts();

    // Suscripción realtime para actualizaciones de stock
    const channel = supabase
      .channel('public-products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => { fetchProducts(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { 
    products, 
    loading, 
    categories, 
    refetch: fetchProducts,
    getProductById 
  };
}
