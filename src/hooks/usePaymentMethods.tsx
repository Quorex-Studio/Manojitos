import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PaymentMethodRow {
  id: string;
  method_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  display_order: number;
  config: Record<string, string>;
}

export function usePaymentMethods(includeDisabled = false) {
  const queryClient = useQueryClient();

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['payment-methods', includeDisabled],
    queryFn: async () => {
      let query = supabase.from('payment_methods').select('*').order('display_order');
      if (!includeDisabled) query = query.eq('enabled', true);
      const { data, error } = await query;
      if (error) throw error;
      return data as PaymentMethodRow[];
    },
  });

  const createMethod = useMutation({
    mutationFn: async (input: Omit<PaymentMethodRow, 'id'>) => {
      const { data, error } = await supabase.from('payment_methods').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Método de pago creado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMethod = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PaymentMethodRow> & { id: string }) => {
      const { error } = await supabase.from('payment_methods').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Método de pago actualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMethod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_methods').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Método de pago eliminado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { methods, isLoading, createMethod, updateMethod, deleteMethod };
}
