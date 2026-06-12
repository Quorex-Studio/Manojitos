/**
 * useNotifications — Hook to manage system-wide notifications and credit reminders.
 * Supports internal, email, SMS, and WhatsApp channels via Edge Functions.
 * Tables: `notifications`, `credit_reminders`
 * Edge Function: `send-credit-notifications`
 * Returns: { notifications, unreadCount, markAsRead, markAllAsRead, sendManualNotification, processAutomaticNotifications, checkCreditsStatus }
 */
// Hook para gestionar notificaciones del sistema
// Proporciona acceso a notificaciones internas, envío y marcado como leídas
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { usePushNotifications } from './usePushNotifications';

// ── Module-level singleton registry ──────────────────────────────────────────
// Keeps ONE channel per user ID regardless of how many components use this hook.
// Ref-counted: created on first mount, destroyed when last consumer unmounts.
type NotifChannelEntry = { channel: ReturnType<typeof supabase.channel>; refs: number };
const notifChannelRegistry = new Map<string, NotifChannelEntry>();

// Tipo para notificación
export interface AdminNotification {
  id: string;
  user_id: string;
  credit_id: string | null;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  channel: 'internal' | 'email' | 'sms' | 'whatsapp';
  is_read: boolean;
  sent_at: string;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Tipo para recordatorio de crédito con historial
export interface CreditReminderHistory {
  id: string;
  credit_id: string;
  reminder_type: string;
  channel: string;
  message: string;
  sent_at: string | null;
  delivered: boolean;
  delivery_status: string;
  error_message: string | null;
  created_at: string;
}

// Hook principal para notificaciones
export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Obtener notificaciones del usuario
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AdminNotification[];
    },
    enabled: !!user,
  });

  // Contar notificaciones no leídas
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Marcar notificación como leída
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Marcar todas como leídas
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Todas las notificaciones marcadas como leídas');
    },
  });

  // Enviar notificación manual (solo admin)
  const sendManualNotification = useMutation({
    mutationFn: async ({
      creditId,
      channels,
      reminderType,
      message,
    }: {
      creditId: string;
      channels: ('internal' | 'email' | 'sms')[];
      reminderType: string;
      message?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-credit-notifications', {
        body: {
          action: 'send_manual',
          credit_id: creditId,
          channels,
          reminder_type: reminderType,
          message,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['credit-reminders'] });

      const successCount = data.results?.filter((r: { success: boolean }) => r.success).length || 0;
      if (successCount > 0) {
        toast.success(`Notificación enviada por ${successCount} canal(es)`);
      } else {
        toast.error('No se pudo enviar la notificación');
      }
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Procesar notificaciones automáticas (admin/cron)
  const processAutomaticNotifications = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-credit-notifications', {
        body: { action: 'process_automatic' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['credit-reminders'] });
      toast.success(`Procesados: ${data.stats?.processed}, Enviados: ${data.stats?.sent}`);
    },
  });

  // Verificar estado de créditos
  const checkCreditsStatus = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-credit-notifications', {
        body: { action: 'check_credits' },
      });

      if (error) throw error;
      return data;
    },
  });

  // ── Realtime subscription: singleton ref-counted per user ──
  const { showNotification } = usePushNotifications();
  const knownIds = useRef(new Set<string>());

  // Keep knownIds in sync with loaded notifications (without re-triggering the channel effect)
  useEffect(() => {
    notifications.forEach(n => knownIds.current.add(n.id));
  }, [notifications]);

  useEffect(() => {
    if (!user) return;

    const channelName = `notifications-${user.id}`;
    const existing = notifChannelRegistry.get(channelName);

    if (existing) {
      // Another mount already owns this channel — just bump the ref count.
      existing.refs += 1;
      return () => {
        existing.refs -= 1;
        if (existing.refs === 0) {
          supabase.removeChannel(existing.channel);
          notifChannelRegistry.delete(channelName);
        }
      };
    }

    // First mount for this user: create and subscribe the channel.
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const notif = payload.new as AdminNotification;
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          if (!knownIds.current.has(notif.id)) {
            knownIds.current.add(notif.id);
            toast(notif.title, {
              description: notif.message,
              duration: 6000,
            });
            await showNotification(
              `🩷 Manojitos: ${notif.title}`,
              notif.message,
              { tag: notif.id, url: '/' }
            );
          }
        }
      )
      .subscribe();

    notifChannelRegistry.set(channelName, { channel, refs: 1 });

    return () => {
      const entry = notifChannelRegistry.get(channelName);
      if (!entry) return;
      entry.refs -= 1;
      if (entry.refs === 0) {
        supabase.removeChannel(entry.channel);
        notifChannelRegistry.delete(channelName);
      }
    };
  }, [user?.id]); // Only re-subscribe when the user ID changes

  return {
    notifications,
    isLoading,
    unreadCount,
    refetch,
    markAsRead,
    markAllAsRead,
    sendManualNotification,
    processAutomaticNotifications,
    checkCreditsStatus,
  };
}

// Hook para historial de recordatorios de un crédito
export function useCreditReminderHistory(creditId: string) {
  return useQuery({
    queryKey: ['credit-reminder-history', creditId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_reminders')
        .select('*')
        .eq('credit_id', creditId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CreditReminderHistory[];
    },
    enabled: !!creditId,
  });
}
