// Hook para gestionar alertas de Ángela
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AngelaAlert {
  id: string;
  user_id: string;
  alert_type: 'stock_low' | 'risky_client' | 'overdue_debt' | 'star_product' | 'recommendation';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  action_data?: Record<string, unknown>;
  is_read: boolean;
  is_dismissed: boolean;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

export function useAngelaAlerts() {
  const { user, isAdmin } = useAuth();
  const [alerts, setAlerts] = useState<AngelaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('angela_alerts')
        .select('*')
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Type assertion since we know the structure
      const typedAlerts = (data || []) as unknown as AngelaAlert[];
      setAlerts(typedAlerts);
      setUnreadCount(typedAlerts.filter(a => !a.is_read).length);
    } catch (error) {
      console.error('Error fetching angela alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsRead = async (alertId: string) => {
    try {
      await supabase
        .from('angela_alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      setAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, is_read: true } : a
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      await supabase
        .from('angela_alerts')
        .update({ is_dismissed: true })
        .eq('id', alertId);

      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const generateAlerts = async () => {
    try {
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error('No session available for generating alerts');
        return false;
      }

      const response = await fetch(
        `https://utfoempgdbhhikpvbvir.supabase.co/functions/v1/angela-proactive`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      
      if (response.ok) {
        await fetchAlerts();
        return true;
      }
      
      if (response.status === 401 || response.status === 403) {
        console.error('Unauthorized to generate alerts');
      }
      
      return false;
    } catch (error) {
      console.error('Error generating alerts:', error);
      return false;
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchAlerts();
    }
  }, [user, isAdmin, fetchAlerts]);

  // Suscripción realtime
  useEffect(() => {
    if (!user || !isAdmin) return;

    const channel = supabase
      .channel('angela-alerts-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'angela_alerts',
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, fetchAlerts]);

  return {
    alerts,
    loading,
    unreadCount,
    markAsRead,
    dismissAlert,
    generateAlerts,
    refetch: fetchAlerts,
  };
}
