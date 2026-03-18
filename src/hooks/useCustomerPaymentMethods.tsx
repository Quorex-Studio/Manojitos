/**
 * useCustomerPaymentMethods — Hook to manage customer's saved payment methods.
 * Tables: `customer_payment_methods`
 * Returns: { methods, isLoading, addMethod, updateMethod, setPreferred, deleteMethod, preferredMethod, hasPaymentMethods }
 */
// Hook para métodos de pago guardados del cliente
// Permite guardar métodos preferidos sin datos sensibles

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import type { Json } from '@/integrations/supabase/types';

// Tipos de métodos de pago
export const PAYMENT_METHOD_TYPES = [
  { id: 'efectivo_usd', label: 'Efectivo USD', description: 'Pago en dólares en efectivo' },
  { id: 'efectivo_bs', label: 'Efectivo Bs', description: 'Pago en bolívares en efectivo' },
  { id: 'zelle', label: 'Zelle', description: 'Transferencia Zelle' },
  { id: 'pago_movil', label: 'Pago Móvil', description: 'Pago móvil venezolano' },
  { id: 'transferencia', label: 'Transferencia', description: 'Transferencia bancaria' },
] as const;

export type PaymentMethodType = typeof PAYMENT_METHOD_TYPES[number]['id'];

// Schema de validación
const paymentMethodSchema = z.object({
  method_type: z.enum(['efectivo_usd', 'efectivo_bs', 'zelle', 'pago_movil', 'transferencia']),
  alias: z.string().max(50).optional().nullable(),
  details: z.object({
    bank_name: z.string().optional(),
    last_four: z.string().max(4).optional(),
    phone_number: z.string().optional(),
    email: z.string().email().optional(),
  }).optional(),
  is_preferred: z.boolean().optional(),
});

export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;

export interface CustomerPaymentMethod {
  id: string;
  user_id: string;
  method_type: PaymentMethodType;
  alias: string | null;
  details: {
    bank_name?: string;
    last_four?: string;
    phone_number?: string;
    email?: string;
  };
  is_preferred: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Hook principal
export function useCustomerPaymentMethods() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch métodos de pago del usuario
  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['customer-payment-methods', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_payment_methods')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .order('is_preferred', { ascending: false });

      if (error) throw error;
      return data as CustomerPaymentMethod[];
    },
    enabled: !!user,
  });

  // Agregar método de pago
  const addMethod = useMutation({
    mutationFn: async (input: PaymentMethodInput) => {
      if (!user) throw new Error('No autenticado');

      const validated = paymentMethodSchema.parse(input);

      // Si es preferido, quitar preferido de otros
      if (validated.is_preferred) {
        await supabase
          .from('customer_payment_methods')
          .update({ is_preferred: false })
          .eq('user_id', user.id);
      }

      const insertData = {
        user_id: user.id,
        method_type: validated.method_type,
        alias: validated.alias,
        details: (validated.details || {}) as Json,
        is_preferred: validated.is_preferred ?? false,
      };

      const { data, error } = await supabase
        .from('customer_payment_methods')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-payment-methods'] });
      toast({
        title: 'Método de pago agregado',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo agregar el método',
        variant: 'destructive',
      });
    },
  });

  // Actualizar método de pago
  const updateMethod = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PaymentMethodInput> & { id: string }) => {
      if (!user) throw new Error('No autenticado');

      // Si es preferido, quitar preferido de otros
      if (updates.is_preferred) {
        await supabase
          .from('customer_payment_methods')
          .update({ is_preferred: false })
          .eq('user_id', user.id)
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('customer_payment_methods')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-payment-methods'] });
      toast({ title: 'Método actualizado' });
    },
  });

  // Establecer como preferido
  const setPreferred = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('No autenticado');

      // Quitar preferido de todos
      await supabase
        .from('customer_payment_methods')
        .update({ is_preferred: false })
        .eq('user_id', user.id);

      // Establecer el nuevo preferido
      const { data, error } = await supabase
        .from('customer_payment_methods')
        .update({ is_preferred: true })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-payment-methods'] });
      toast({ title: 'Método preferido actualizado' });
    },
  });

  // Eliminar método (soft delete)
  const deleteMethod = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('No autenticado');

      const { error } = await supabase
        .from('customer_payment_methods')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-payment-methods'] });
      toast({ title: 'Método eliminado' });
    },
  });

  // Obtener método preferido
  const preferredMethod = methods.find(m => m.is_preferred) || methods[0] || null;

  return {
    methods,
    isLoading,
    addMethod,
    updateMethod,
    setPreferred,
    deleteMethod,
    preferredMethod,
    hasPaymentMethods: methods.length > 0,
  };
}
