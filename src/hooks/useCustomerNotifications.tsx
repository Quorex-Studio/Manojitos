// Hook para notificaciones del cliente
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  channel: string;
  is_read: boolean;
  read_at: string | null;
  sent_at: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  credit_id: string | null;
}

export function useCustomerNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Obtener notificaciones
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['customer-notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
  });

  // Contar no leídas
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Marcar como leída
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notifications'] });
    },
  });

  // Marcar todas como leídas
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user!.id)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notifications'] });
      toast.success('Todas las notificaciones marcadas como leídas');
    },
  });

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
