import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import type { ProductSummary, ProductDebtor } from '../types';

export function useProductSummary(startDate?: Date | null, endDate?: Date | null, category?: string | null) {
  return useQuery({
    queryKey: ['product-summary', startDate?.toISOString(), endDate?.toISOString(), category],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_product_summary', {
        p_start_date: startDate ? startDate.toISOString() : null,
        p_end_date: endDate ? endDate.toISOString() : null,
        p_category: category || 'all'
      });

      if (error) {
        console.error('Error fetching product summary:', error);
        throw error;
      }

      return (data || []) as ProductSummary[];
    },
    // Cache the data for a reasonable time since it might be heavy, but allow refetching.
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useProductDebtors(productId?: string) {
  return useQuery({
    queryKey: ['product-debtors', productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase.rpc('get_product_debtors', {
        p_product_id: productId
      });

      if (error) {
        console.error('Error fetching product debtors:', error);
        throw error;
      }

      return (data || []) as ProductDebtor[];
    },
    enabled: !!productId,
  });
}
