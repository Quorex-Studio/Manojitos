/**
 * useCustomerTimeline — Hook to manage chronological event history for a customer.
 * Events: sales, payments, credit adjustments, blocks, and trust score changes.
 * Tables: `customer_timeline`
 * Returns: { events, groupedEvents, isLoading, addEvent, stats }
 */
// Hook para timeline cronológico de eventos por cliente
// Muestra ventas, créditos, pagos, promesas, recordatorios, bloqueos

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Json } from '@/integrations/supabase/types';

// Tipos de eventos del timeline
export type TimelineEventType = 
  | 'sale' 
  | 'payment' 
  | 'credit_granted' 
  | 'credit_blocked' 
  | 'credit_unblocked'
  | 'reminder_sent' 
  | 'promise_created' 
  | 'promise_fulfilled' 
  | 'promise_broken'
  | 'limit_adjusted'
  | 'trust_score_changed';

export interface TimelineEvent {
  id: string;
  user_id: string;
  customer_user_id: string | null;
  customer_phone: string | null;
  event_type: TimelineEventType;
  event_data: Record<string, unknown>;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface TimelineEventInput {
  customer_user_id?: string | null;
  customer_phone?: string | null;
  event_type: TimelineEventType;
  event_data?: Record<string, unknown>;
  reference_type?: string | null;
  reference_id?: string | null;
}

// Hook para el timeline de un cliente específico
export function useCustomerTimeline(customerIdentifier?: string, identifierType: 'user_id' | 'phone' = 'user_id') {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch eventos del timeline
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['customer-timeline', customerIdentifier, identifierType],
    queryFn: async () => {
      let query = supabase
        .from('customer_timeline')
        .select('*')
        .order('created_at', { ascending: false });

      if (identifierType === 'user_id' && customerIdentifier) {
        query = query.eq('customer_user_id', customerIdentifier);
      } else if (identifierType === 'phone' && customerIdentifier) {
        query = query.eq('customer_phone', customerIdentifier);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as TimelineEvent[];
    },
    enabled: !!customerIdentifier && (isAdmin || user?.id === customerIdentifier),
  });

  // Agregar evento al timeline
  const addEvent = useMutation({
    mutationFn: async (input: TimelineEventInput) => {
      if (!user) throw new Error('No autenticado');

      const insertData = {
        user_id: user.id,
        customer_user_id: input.customer_user_id,
        customer_phone: input.customer_phone,
        event_type: input.event_type,
        event_data: (input.event_data || {}) as Json,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
      };

      const { data, error } = await supabase
        .from('customer_timeline')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-timeline'] });
    },
  });

  // Agrupar eventos por fecha
  const groupedEvents = events.reduce((groups, event) => {
    const date = new Date(event.created_at).toLocaleDateString('es-VE');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as Record<string, TimelineEvent[]>);

  // Estadísticas del timeline
  const stats = {
    totalEvents: events.length,
    sales: events.filter(e => e.event_type === 'sale').length,
    payments: events.filter(e => e.event_type === 'payment').length,
    reminders: events.filter(e => e.event_type === 'reminder_sent').length,
    blocks: events.filter(e => e.event_type === 'credit_blocked').length,
  };

  return {
    events,
    groupedEvents,
    isLoading,
    addEvent,
    stats,
  };
}

// Hook para agregar eventos al timeline desde otras partes de la app
export function useTimelineRecorder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const recordEvent = async (input: TimelineEventInput) => {
    if (!user) return;

    try {
      const insertData = {
        user_id: user.id,
        customer_user_id: input.customer_user_id,
        customer_phone: input.customer_phone,
        event_type: input.event_type,
        event_data: (input.event_data || {}) as Json,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
      };

      await supabase
        .from('customer_timeline')
        .insert(insertData);

      queryClient.invalidateQueries({ queryKey: ['customer-timeline'] });
    } catch (error) {
      console.error('Error recording timeline event:', error);
    }
  };

  // Helpers para eventos comunes
  const recordSale = (customerPhone: string, saleId: string, amount: number, productName: string) => {
    return recordEvent({
      customer_phone: customerPhone,
      event_type: 'sale',
      event_data: { amount, product_name: productName },
      reference_type: 'sales',
      reference_id: saleId,
    });
  };

  const recordPayment = (customerUserId: string, creditId: string, amount: number) => {
    return recordEvent({
      customer_user_id: customerUserId,
      event_type: 'payment',
      event_data: { amount },
      reference_type: 'credits',
      reference_id: creditId,
    });
  };

  const recordCreditGranted = (customerPhone: string, creditId: string, limit: number) => {
    return recordEvent({
      customer_phone: customerPhone,
      event_type: 'credit_granted',
      event_data: { credit_limit: limit },
      reference_type: 'credits',
      reference_id: creditId,
    });
  };

  const recordBlock = (customerUserId: string, creditId: string, reason: string) => {
    return recordEvent({
      customer_user_id: customerUserId,
      event_type: 'credit_blocked',
      event_data: { reason },
      reference_type: 'credits',
      reference_id: creditId,
    });
  };

  const recordUnblock = (customerUserId: string, creditId: string) => {
    return recordEvent({
      customer_user_id: customerUserId,
      event_type: 'credit_unblocked',
      event_data: {},
      reference_type: 'credits',
      reference_id: creditId,
    });
  };

  const recordReminderSent = (customerPhone: string, creditId: string, channel: string, reminderType: string) => {
    return recordEvent({
      customer_phone: customerPhone,
      event_type: 'reminder_sent',
      event_data: { channel, reminder_type: reminderType },
      reference_type: 'credits',
      reference_id: creditId,
    });
  };

  const recordPromiseCreated = (customerUserId: string, promiseId: string, amount: number, date: string) => {
    return recordEvent({
      customer_user_id: customerUserId,
      event_type: 'promise_created',
      event_data: { amount, promised_date: date },
      reference_type: 'payment_promises',
      reference_id: promiseId,
    });
  };

  const recordPromiseFulfilled = (customerUserId: string, promiseId: string, amount: number) => {
    return recordEvent({
      customer_user_id: customerUserId,
      event_type: 'promise_fulfilled',
      event_data: { amount },
      reference_type: 'payment_promises',
      reference_id: promiseId,
    });
  };

  const recordPromiseBroken = (customerUserId: string, promiseId: string) => {
    return recordEvent({
      customer_user_id: customerUserId,
      event_type: 'promise_broken',
      event_data: {},
      reference_type: 'payment_promises',
      reference_id: promiseId,
    });
  };

  const recordTrustScoreChange = (customerUserId: string, creditId: string, oldScore: number, newScore: number, reason: string) => {
    return recordEvent({
      customer_user_id: customerUserId,
      event_type: 'trust_score_changed',
      event_data: { old_score: oldScore, new_score: newScore, reason },
      reference_type: 'credits',
      reference_id: creditId,
    });
  };

  return {
    recordEvent,
    recordSale,
    recordPayment,
    recordCreditGranted,
    recordBlock,
    recordUnblock,
    recordReminderSent,
    recordPromiseCreated,
    recordPromiseFulfilled,
    recordPromiseBroken,
    recordTrustScoreChange,
  };
}
