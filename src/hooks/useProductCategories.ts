import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cleanOptions, type DetailKind, type ProductCategory } from '@/lib/productCategories';

const KEY = ['product-categories'];

/** Categorías de producto (públicas: la tienda también las lee para saber si se elige talla o tono). */
export function useProductCategories() {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name, detail_kind, options, sort_order')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data || []) as ProductCategory[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const byName = (name?: string | null) => categories.find(c => c.name === name) ?? null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: KEY });
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    queryClient.invalidateQueries({ queryKey: ['public-products'] });
  };
  const fail = (title: string) => (error: Error) => {
    const duplicated = /duplicate|unique/i.test(error.message);
    toast({ title, description: duplicated ? 'Ya existe una categoría con ese nombre.' : error.message, variant: 'destructive' });
  };

  const saveCategory = useMutation({
    mutationFn: async (c: { id?: string; name: string; detail_kind: DetailKind; options: string[] }) => {
      const row = { name: c.name.trim().replace(/\s+/g, ' ').slice(0, 50), detail_kind: c.detail_kind, options: cleanOptions(c.options) };
      if (c.id) {
        const { error } = await supabase.from('product_categories').update(row).eq('id', c.id);
        if (error) throw error;
      } else {
        const next = categories.reduce((m, x) => Math.max(m, x.sort_order), 0) + 1;
        const { error } = await supabase.from('product_categories').insert({ ...row, sort_order: next });
        if (error) throw error;
      }
    },
    onSuccess: (_d, c) => {
      refresh();
      toast({ title: c.id ? 'Categoría actualizada' : 'Categoría creada', description: c.name });
    },
    onError: fail('No se pudo guardar la categoría'),
  });

  /** Mueve los productos a otra categoría (si se indica) y borra la categoría. */
  const deleteCategory = useMutation({
    mutationFn: async ({ category, moveTo }: { category: ProductCategory; moveTo: string | null }) => {
      if (moveTo) {
        const { error } = await supabase.from('products').update({ category: moveTo }).eq('category', category.name);
        if (error) throw error;
      }
      const { error } = await supabase.from('product_categories').delete().eq('id', category.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      refresh();
      toast({ title: 'Categoría eliminada', description: v.moveTo ? `Sus productos pasaron a ${v.moveTo}.` : v.category.name });
    },
    onError: fail('No se pudo eliminar'),
  });

  /** Sube o baja una categoría en la lista (el orden es el de la tienda y los desplegables). */
  const moveCategory = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: -1 | 1 }) => {
      const i = categories.findIndex(c => c.id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= categories.length) return;
      const reordered = [...categories];
      [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
      await Promise.all(reordered.map((c, idx) =>
        c.sort_order === idx + 1 ? null : supabase.from('product_categories').update({ sort_order: idx + 1 }).eq('id', c.id)
      ));
    },
    onSuccess: refresh,
    onError: fail('No se pudo reordenar'),
  });

  return { categories, isLoading, byName, saveCategory, deleteCategory, moveCategory };
}
