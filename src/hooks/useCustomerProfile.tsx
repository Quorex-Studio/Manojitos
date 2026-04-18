/**
 * useCustomerProfile — Hook to manage customer's personal profile and preferences.
 * Tables: `customer_profiles`, `sales` (for history)
 * Returns: { profile, isLoading, upsertProfile, updateNotificationPreferences, hasProfile }
 */
// Hook para perfil completo de cliente
// Incluye datos personales, historial, estado crediticio y preferencias

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import type { Json } from '@/integrations/supabase/types';
import type { CustomerProfile } from '@/types';
// Schema de validación para perfil de cliente
const customerProfileSchema = z.object({
  full_name: z.string().min(2, 'Nombre muy corto').max(100).optional(),
  phone: z.string().min(10, 'Teléfono inválido').max(20),
  email: z.string().email('Email inválido').optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zip_code: z.string().max(20).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  notification_preferences: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    internal: z.boolean(),
  }).optional(),
});

export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;

// Hook para el perfil del cliente actual
export function useCustomerProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch perfil del cliente actual
  const { data: profile, isLoading } = useQuery({
    queryKey: ['customer-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as CustomerProfile | null;
    },
    enabled: !!user,
  });

  // Crear o actualizar perfil
  const upsertProfile = useMutation({
    mutationFn: async (input: CustomerProfileInput) => {
      if (!user) throw new Error('No autenticado');

      // Validar input
      const validated = customerProfileSchema.parse(input);

      const insertData = {
        user_id: user.id,
        full_name: validated.full_name,
        phone: validated.phone,
        email: validated.email,
        address: validated.address,
        city: validated.city,
        state: validated.state,
        zip_code: validated.zip_code,
        notes: validated.notes,
        notification_preferences: validated.notification_preferences as Json,
      };

      const { data, error } = await supabase
        .from('customer_profiles')
        .upsert(insertData, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] });
      toast({
        title: 'Perfil actualizado',
        description: 'Tus datos han sido guardados',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo actualizar el perfil',
        variant: 'destructive',
      });
    },
  });

  // Actualizar preferencias de notificación
  const updateNotificationPreferences = useMutation({
    mutationFn: async (preferences: { email: boolean; sms: boolean; internal: boolean }) => {
      if (!user) throw new Error('No autenticado');

      const { data, error } = await supabase
        .from('customer_profiles')
        .update({ notification_preferences: preferences })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] });
      toast({
        title: 'Preferencias actualizadas',
      });
    },
  });

  return {
    profile,
    isLoading,
    upsertProfile,
    updateNotificationPreferences,
    hasProfile: !!profile,
  };
}

// Hook para admin: ver perfil de cualquier cliente
export function useAdminCustomerProfile(customerId?: string) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['admin-customer-profile', customerId],
    queryFn: async () => {
      if (!customerId) return null;

      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', customerId)
        .maybeSingle();

      if (error) throw error;
      return data as CustomerProfile | null;
    },
    enabled: !!customerId && isAdmin,
  });

  // Admin puede actualizar notas del cliente
  const updateCustomerNotes = useMutation({
    mutationFn: async ({ customerId, notes }: { customerId: string; notes: string }) => {
      const { data, error } = await supabase
        .from('customer_profiles')
        .update({ notes })
        .eq('user_id', customerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-profile'] });
      toast({ title: 'Notas actualizadas' });
    },
  });

  return {
    profile,
    isLoading,
    updateCustomerNotes,
  };
}

// Hook para historial de compras del cliente
export function useCustomerPurchaseHistory(customerId?: string) {
  const { user, isAdmin } = useAuth();
  const targetUserId = customerId || user?.id;

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['customer-purchases', targetUserId],
    queryFn: async () => {
      // Try by user_id first (direct match)
      let query = supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('phone')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (profile?.phone) {
        // Search by phone (linked to old sales records)
        const { data } = await supabase
          .from('sales')
          .select('*')
          .or(`client_phone.eq.${profile.phone},customer_user_id.eq.${user!.id}`)
          .order('created_at', { ascending: false })
          .limit(100);
        return data || [];
      } else {
        // Fallback: search by customer_user_id only
        const { data } = await supabase
          .from('sales')
          .select('*')
          .eq('customer_user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(100);
        return data || [];
      }
    },
    enabled: !!targetUserId,
  });

  const totalSpent = purchases.reduce((sum, p) => sum + (p.total_usd || 0), 0);
  const totalPurchases = purchases.length;

  return {
    purchases,
    isLoading,
    totalSpent,
    totalPurchases,
  };
}
