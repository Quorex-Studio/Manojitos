import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// Tipos para créditos (basados en el esquema de la base de datos)
export interface Credit {
  id: string;
  user_id: string;
  client_user_id: string | null;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  credit_limit: number;
  current_balance: number;
  cut_off_day: number;
  grace_days: number;
  status: string;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_reason: string | null;
  next_due_date: string | null;
  last_payment_date: string | null;
  last_reminder_sent_at: string | null;
  reminders_sent: Json;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Tipo para crear/actualizar crédito (sin campos de solo lectura)
export interface CreditInput {
  client_name: string;
  client_phone?: string | null;
  client_email?: string | null;
  credit_limit?: number;
  cut_off_day?: number;
  grace_days?: number;
  notes?: string | null;
  next_due_date?: string | null;
}

export interface CreditTransaction {
  id: string;
  credit_id: string;
  user_id: string;
  type: 'CARGO' | 'ABONO';
  amount: number;
  previous_balance: number;
  new_balance: number;
  sale_id: string | null;
  description: string | null;
  created_at: string;
}

export interface CreditReminder {
  id: string;
  credit_id: string;
  reminder_type: string;
  channel: string;
  message: string;
  sent_at: string | null;
  delivered: boolean;
  created_at: string;
}

// Calcular estado del crédito en el frontend
export function calculateCreditStatus(
  nextDueDate: string | null,
  graceDays: number,
  isBlocked: boolean
): string {
  if (isBlocked) return 'BLOQUEADO';
  if (!nextDueDate) return 'ACTIVO';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(nextDueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + graceDays);
  
  const threeDaysBefore = new Date(dueDate);
  threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);

  if (today < dueDate && today >= threeDaysBefore) {
    return 'POR_VENCER';
  } else if (today >= dueDate && today <= graceEnd) {
    return 'EN_GRACIA';
  } else if (today > graceEnd) {
    return 'VENCIDO';
  }
  
  return 'ACTIVO';
}

// Hook principal para créditos
export function useCredits() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Obtener todos los créditos
  const { data: credits = [], isLoading, error, refetch } = useQuery({
    queryKey: ['credits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credits')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Calcular estado actualizado para cada crédito
      return (data || []).map(credit => ({
        ...credit,
        calculatedStatus: calculateCreditStatus(
          credit.next_due_date,
          credit.grace_days,
          credit.is_blocked
        )
      }));
    },
    enabled: !!user && isAdmin,
  });

  // Crear nuevo crédito
  const createCredit = useMutation({
    mutationFn: async (creditData: CreditInput) => {
      if (!user) throw new Error('No autenticado');

      const { data, error } = await supabase
        .from('credits')
        .insert({
          user_id: user.id,
          client_name: creditData.client_name,
          client_phone: creditData.client_phone || null,
          client_email: creditData.client_email || null,
          credit_limit: creditData.credit_limit || 0,
          cut_off_day: creditData.cut_off_day || 15,
          grace_days: creditData.grace_days || 3,
          notes: creditData.notes || null,
          next_due_date: creditData.next_due_date || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Crédito creado correctamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al crear crédito: ${error.message}`);
    },
  });

  // Actualizar crédito
  const updateCredit = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreditInput> }) => {
      const { data, error } = await supabase
        .from('credits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Crédito actualizado');
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Bloquear/desbloquear crédito
  const toggleBlock = useMutation({
    mutationFn: async ({ id, block, reason }: { id: string; block: boolean; reason?: string }) => {
      const { data, error } = await supabase
        .from('credits')
        .update({
          is_blocked: block,
          blocked_at: block ? new Date().toISOString() : null,
          blocked_reason: block ? (reason || 'Bloqueado por el administrador') : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success(variables.block ? 'Crédito bloqueado' : 'Crédito desbloqueado');
    },
  });

  // Registrar pago (abono)
  const registerPayment = useMutation({
    mutationFn: async ({ creditId, amount, description }: { 
      creditId: string; 
      amount: number; 
      description?: string 
    }) => {
      if (!user) throw new Error('No autenticado');

      // Obtener crédito actual
      const { data: credit, error: fetchError } = await supabase
        .from('credits')
        .select('current_balance')
        .eq('id', creditId)
        .single();

      if (fetchError) throw fetchError;

      const previousBalance = credit.current_balance;
      const newBalance = Math.max(0, previousBalance - amount);

      // Registrar transacción
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          credit_id: creditId,
          user_id: user.id,
          type: 'ABONO',
          amount,
          previous_balance: previousBalance,
          new_balance: newBalance,
          description: description || 'Pago registrado',
        });

      if (transactionError) throw transactionError;

      // Actualizar saldo del crédito
      const { data, error: updateError } = await supabase
        .from('credits')
        .update({
          current_balance: newBalance,
          last_payment_date: new Date().toISOString(),
          // Si el saldo es 0, desbloquear automáticamente
          is_blocked: newBalance > 0 ? undefined : false,
        })
        .eq('id', creditId)
        .select()
        .single();

      if (updateError) throw updateError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['credit-transactions'] });
      toast.success('Pago registrado correctamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al registrar pago: ${error.message}`);
    },
  });

  // Crear recordatorio
  const createReminder = useMutation({
    mutationFn: async ({ creditId, reminderType, message }: {
      creditId: string;
      reminderType: string;
      message: string;
    }) => {
      const { data, error } = await supabase
        .from('credit_reminders')
        .insert({
          credit_id: creditId,
          reminder_type: reminderType,
          channel: 'PENDING',
          message,
        })
        .select()
        .single();

      if (error) throw error;

      // Actualizar último recordatorio enviado
      await supabase
        .from('credits')
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .eq('id', creditId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['credit-reminders'] });
      toast.success('Recordatorio creado');
    },
  });

  return {
    credits,
    isLoading,
    error,
    refetch,
    createCredit,
    updateCredit,
    toggleBlock,
    registerPayment,
    createReminder,
  };
}

// Hook para transacciones de un crédito
export function useCreditTransactions(creditId: string) {
  return useQuery({
    queryKey: ['credit-transactions', creditId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('credit_id', creditId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CreditTransaction[];
    },
    enabled: !!creditId,
  });
}

// Hook para recordatorios de un crédito
export function useCreditReminders(creditId: string) {
  return useQuery({
    queryKey: ['credit-reminders', creditId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_reminders')
        .select('*')
        .eq('credit_id', creditId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CreditReminder[];
    },
    enabled: !!creditId,
  });
}
