/**
 * useCustomerNotifications — Hook to manage customer notifications.
 * Tables: `notifications`
 * Returns: { notifications, isLoading, unreadCount, markAsRead, markAllAsRead }
 */
// Hook para notificaciones del cliente
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { usePushNotifications } from './usePushNotifications';

export interface CustomerNotification {
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
      return data as CustomerNotification[];
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

  // ── Realtime subscription: singleton per user to avoid duplicate channel errors ──
  // This hook can be mounted in multiple places (StoreHeader bell + notifications page).
  // Supabase throws if you call .on() on an already-subscribed channel, so we keep
  // a module-level registry and reuse the same channel for every concurrent mount.
  const { showNotification } = usePushNotifications();
  const knownIds = useRef(new Set<string>());

  // Sync knownIds when notifications change
  useEffect(() => {
    notifications.forEach(n => knownIds.current.add(n.id));
  }, [notifications]);

  useEffect(() => {
    if (!user) return;

    const channelName = `customer-notifications-${user.id}`;

    // Re-use an existing active channel for this user if one already exists
    const existing = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
    if (existing) {
      // Another instance of this hook already owns the subscription — nothing to do.
      return;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const notif = payload.new as CustomerNotification;
          queryClient.invalidateQueries({ queryKey: ['customer-notifications'] });

          // Only push if we haven't seen this ID before
          if (!knownIds.current.has(notif.id)) {
            knownIds.current.add(notif.id);
            // In-app toast
            toast(notif.title, {
              description: notif.message,
              duration: 6000,
            });
            // Browser push notification
            await showNotification(
              `🩷 Manojitos: ${notif.title}`,
              notif.message,
              { tag: notif.id, url: '/cliente/notificaciones' }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]); // Only re-subscribe when the user ID actually changes

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
