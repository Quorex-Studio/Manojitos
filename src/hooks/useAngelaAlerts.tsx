/**
 * useAngelaAlerts — Hook to manage AI-generated alerts from Ángela.
 * Tables: `angela_alerts`
 * Functions: `angela-proactive` (Edge function)
 * Returns: { alerts, loading, unreadCount, markAsRead, dismissAlert, generateAlerts, refetch }
 */
/**
 * useAngelaPersonalShopper — Hook for personalized product recommendations.
 * Analyzes: customer purchase history and credit status.
 * Tables: `orders`, `credits`, `products`
 * Returns: { recommendations, behavior, loading, refresh }
 */
// Hook para recomendaciones personalizadas de productos (Personal Shopper)
/**
 * useAuth — Hook and Provider to manage Supabase Authentication state.
 * Returns: { user, session, loading, isAdmin, signIn, signUp, signOut }
 */
/**
 * useBrowsingHistory — Hook to manage user browsing history.
 * Tables: `browsing_history`
 * Returns: { history, addEntry, clearHistory }
 */
/**
 * useBusinessRules — Hook to manage business rules.
 * Tables: `business_rules`
 * Returns: { rules, loading, updateRule }
 */
/**
 * useCashRegister — Hook to manage cash register operations.
 * Tables: `cash_registers`, `transactions`
 * Returns: { registerState, openRegister, closeRegister, makeTransaction }
 */
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
      const { error: invokeError } = await supabase.functions.invoke('angela-proactive');
      if (!invokeError) {
        await fetchAlerts();
        return true;
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

  // Las mutaciones ya invalidan el caché automáticamente.
  // No se necesita suscripción realtime.

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
