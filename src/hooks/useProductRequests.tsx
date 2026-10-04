/**
 * "Lo quiero": solicitudes de productos agotados.
 * - useRequestProduct: la clienta (con o sin cuenta) pide el producto; la función request_product
 *   valida, evita duplicados y avisa a la dueña.
 * - useProductRequests: el panel (/solicitudes) las ve agrupadas por producto.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ProductRequestStatus = 'pending' | 'notified' | 'closed';

export interface ProductRequestRow {
  id: string;
  product_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  status: ProductRequestStatus;
  notified_at: string | null;
  created_at: string;
  product: { id: string; name: string; image_url: string | null; stock: number; price_usd: number; category: string | null } | null;
}

// La tabla es nueva y aún no está en los tipos generados: se consulta sin tipar.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useRequestProduct() {
  return useMutation({
    mutationFn: async (input: { productId: string; name?: string; phone?: string; note?: string }) => {
      const { data, error } = await db.rpc('request_product', {
        p_product_id: input.productId,
        p_name: input.name ?? null,
        p_phone: input.phone ?? null,
        p_note: input.note ?? null,
      });
      if (error) throw new Error(error.message);
      return data as { ok: boolean; already: boolean; count?: number };
    },
  });
}

export function useProductRequests() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['product-requests'],
    queryFn: async () => {
      const { data, error } = await db
        .from('product_requests')
        .select('*, product:products(id, name, image_url, stock, price_usd, category)')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ProductRequestRow[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: ProductRequestStatus }) => {
      const { error } = await db
        .from('product_requests')
        .update({ status, notified_at: status === 'notified' ? new Date().toISOString() : null })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-requests'] }),
  });

  return { requests: query.data ?? [], isLoading: query.isLoading, setStatus };
}
