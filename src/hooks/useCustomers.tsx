import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CustomerProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  address: string | null;
  location_coords: string | null;
  dni: string | null;
  dni_photo_url: string | null;
  face_photo_url: string | null;
  verification_photo_url: string | null;
  kyc_status: 'pending' | 'approved' | 'rejected' | 'none';
  created_at: string;
}

export function useCustomers() {
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: 'Error al cargar clientes',
          description: error.message,
          variant: 'destructive',
        });
        throw error;
      }
      
      // Mapear los estados nulos a 'none'
      return (data as any[]).map(c => ({
        ...c,
        kyc_status: c.kyc_status || 'none'
      })) as CustomerProfile[];
    },
  });

  const updateKycStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'approved' | 'rejected' | 'pending' }) => {
      const { data, error } = await supabase
        .from('customer_profiles')
        .update({ kyc_status: status })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: 'Estado actualizado',
        description: `El estado KYC ha sido marcado como ${variables.status === 'approved' ? 'Aprobado' : variables.status === 'rejected' ? 'Rechazado' : 'Pendiente'}.`,
      });

      // Send email notification if approved or rejected
      if (variables.status === 'approved' || variables.status === 'rejected') {
        const action = variables.status === 'approved' ? 'kyc_approved' : 'kyc_rejected';
        
        // Find user email from current state
        const customers = queryClient.getQueryData(['customers']) as CustomerProfile[] || [];
        const customer = customers.find(c => c.user_id === variables.userId);
        
        if (customer && customer.email) {
          try {
            await supabase.functions.invoke('send-email', {
              body: {
                action,
                email: customer.email,
                data: { client_name: customer.full_name }
              }
            });
          } catch (fnError) {
            console.error('Error enviando correo de KYC:', fnError);
          }
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error al actualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    customers,
    isLoading,
    updateKycStatus,
  };
}
