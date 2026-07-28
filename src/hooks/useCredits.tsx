/**
 * useCredits — Comprehensive hook for professional credit management.
 * Includes: trust score calculation, payment promises, and progressive restrictions.
 * Tables: `credits`, `credit_transactions`, `credit_reminders`, `payment_promises`
 * RPC: `calculate_trust_score`
 * Returns: { credits, isLoading, error, refetch, stats, createCredit, updateCredit, adjustCreditLimit, toggleBlock, registerPayment, createReminder }
 */
// Hook actualizado para gestión profesional de créditos
// Incluye trust score, promesas de pago y restricciones progresivas
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { 
  Credit, 
  CreditInput, 
  CreditTransaction, 
  CreditReminder, 
  PaymentPromise 
} from '@/types';
import { creditSchema, paymentPromiseSchema, validateInput, sanitizeText } from '@/lib/validations';


// Calcular estado del crédito y días de mora
export function calculateCreditStatus(
  nextDueDate: string | null,
  graceDays: number,
  isBlocked: boolean
): { status: string; daysUntilDue: number; daysOverdue: number } {
  if (isBlocked) return { status: 'BLOQUEADO', daysUntilDue: 0, daysOverdue: 0 };
  if (!nextDueDate) return { status: 'ACTIVO', daysUntilDue: 0, daysOverdue: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(nextDueDate);
  dueDate.setHours(0, 0, 0, 0);

  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + graceDays);

  const threeDaysBefore = new Date(dueDate);
  threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const daysUntilDue = diffDays > 0 ? diffDays : 0;
  const daysOverdue = diffDays < 0 ? Math.abs(diffDays) : 0;

  let status = 'ACTIVO';
  if (today < dueDate && today >= threeDaysBefore) {
    status = 'POR_VENCER';
  } else if (today >= dueDate && today <= graceEnd) {
    status = 'EN_GRACIA';
  } else if (today > graceEnd) {
    status = 'VENCIDO';
  }

  return { status, daysUntilDue, daysOverdue };
}

// Obtener color del semáforo de confianza
export const getTrustLevelColor = (level: string) => {
  switch (level) {
    case 'CONFIABLE': return 'text-primary';
    case 'RIESGO': return 'text-gold';
    case 'CRITICO': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
};

// Obtener etiqueta de restricción
export function getRestrictionLabel(level: number): string {
  switch (level) {
    case 0: return 'Sin restricciones';
    case 1: return 'Crédito limitado';
    case 2: return 'Solo pago contado';
    case 3: return 'Bloqueado';
    default: return 'Desconocido';
  }
}

// Hook principal para créditos
export function useCredits() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Obtener todos los créditos con datos calculados
  const { data: credits = [], isLoading, error, refetch } = useQuery({
    queryKey: ['credits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Calcular estado y días para cada crédito
      return (data || []).map(credit => {
        const { status, daysUntilDue, daysOverdue } = calculateCreditStatus(
          credit.next_due_date,
          credit.grace_days,
          credit.is_blocked
        );
        return {
          ...credit,
          trust_score: credit.trust_score ?? 100,
          trust_level: credit.trust_level ?? 'CONFIABLE',
          avg_payment_days: credit.avg_payment_days ?? 0,
          total_purchases: credit.total_purchases ?? 0,
          total_paid_on_time: credit.total_paid_on_time ?? 0,
          total_paid_late: credit.total_paid_late ?? 0,
          consecutive_late_payments: credit.consecutive_late_payments ?? 0,
          restriction_level: credit.restriction_level ?? 0,
          early_payment_discount: credit.early_payment_discount ?? 0,
          auto_limit_adjustment: credit.auto_limit_adjustment ?? true,
          calculatedStatus: status,
          daysUntilDue,
          daysOverdue,
        } as Credit;
      });
    },
    enabled: !!user && isAdmin,
  });

  // Crear nuevo crédito
  const createCredit = useMutation({
    mutationFn: async (creditData: CreditInput) => {
      if (!user) throw new Error('No autenticado');

      // Validate input before database operation
      const validated = validateInput(creditSchema, {
        client_name: creditData.client_name,
        client_email: creditData.client_email,
        client_phone: creditData.client_phone,
        client_user_id: creditData.client_user_id,
        credit_limit: creditData.credit_limit || 0,
        current_balance: 0,
        cut_off_day: creditData.cut_off_day || 15,
        grace_days: creditData.grace_days || 3,
        notes: creditData.notes,
      });

      const { data, error } = await supabase
        .from('credits')
        .insert([{
          user_id: user.id,
          client_name: validated.client_name,
          client_phone: validated.client_phone || null,
          client_email: validated.client_email || null,
          client_user_id: validated.client_user_id || null,
          credit_limit: validated.credit_limit,
          cut_off_day: validated.cut_off_day,
          grace_days: validated.grace_days,
          notes: validated.notes || null,
          next_due_date: creditData.next_due_date || null,
          early_payment_discount: creditData.early_payment_discount || 0,
          auto_limit_adjustment: creditData.auto_limit_adjustment ?? true,
        }])
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

  // Ajustar límite de crédito
  const adjustCreditLimit = useMutation({
    mutationFn: async ({ id, newLimit, reason }: { id: string; newLimit: number; reason?: string }) => {
      const { data, error } = await supabase
        .from('credits')
        .update({
          credit_limit: newLimit,
          notes: reason ? `Límite ajustado: ${sanitizeText(reason)}` : undefined,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Límite de crédito ajustado');
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
          blocked_reason: block ? (reason ? sanitizeText(reason) : 'Bloqueado por el administrador') : null,
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

  // Registrar pago con actualización de score
  const registerPayment = useMutation({
    mutationFn: async ({ creditId, amount, description, isOnTime }: {
      creditId: string;
      amount: number;
      description?: string;
      isOnTime?: boolean;
    }) => {
      if (!user) throw new Error('No autenticado');

      // Obtener crédito actual
      const { data: credit, error: fetchError } = await supabase
        .from('credits')
        .select('*')
        .eq('id', creditId)
        .single();

      if (fetchError) throw fetchError;

      // Calcular si el pago es puntual
      const paymentIsOnTime = isOnTime ?? (credit.next_due_date
        ? new Date() <= new Date(credit.next_due_date)
        : true);

      // Usar RPC atómico para evitar double-spending
      const { data, error } = await supabase.rpc('rpc_register_credit_payment', {
        p_credit_id: creditId,
        p_user_id: user.id,
        p_amount: amount,
        p_description: description || 'Pago registrado',
        p_is_on_time: paymentIsOnTime
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['credit-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['payment-promises'] });
      toast.success('Pago registrado correctamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al registrar pago: ${error.message}`);
    },
  });

  // Registrar cargo a crédito (compra)
  const registerCharge = useMutation({
    mutationFn: async ({ creditId, amount, description, saleId }: {
      creditId: string;
      amount: number;
      description?: string;
      saleId?: string;
    }) => {
      if (!user) throw new Error('No autenticado');

      // Usar RPC atómico para evitar double-spending
      const { data, error } = await supabase.rpc('rpc_register_credit_charge', {
        p_credit_id: creditId,
        p_user_id: user.id,
        p_amount: amount,
        p_description: description || 'Compra a crédito autorizada',
        p_sale_id: saleId || null
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['credit-transactions'] });
      toast.success('Cargo a crédito registrado');
    },
    onError: (error: Error) => {
      toast.error(`Error al registrar cargo: ${error.message}`);
    },
  });

  // Crear recordatorio (legacy - usar useNotifications para nuevo sistema)
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

  // Estadísticas calculadas
  const stats = {
    total: credits.length,
    byTrustLevel: {
      CONFIABLE: credits.filter(c => c.trust_level === 'CONFIABLE').length,
      RIESGO: credits.filter(c => c.trust_level === 'RIESGO').length,
      CRITICO: credits.filter(c => c.trust_level === 'CRITICO').length,
    },
    byStatus: {
      ACTIVO: credits.filter(c => c.calculatedStatus === 'ACTIVO').length,
      POR_VENCER: credits.filter(c => c.calculatedStatus === 'POR_VENCER').length,
      EN_GRACIA: credits.filter(c => c.calculatedStatus === 'EN_GRACIA').length,
      VENCIDO: credits.filter(c => c.calculatedStatus === 'VENCIDO').length,
      BLOQUEADO: credits.filter(c => c.calculatedStatus === 'BLOQUEADO').length,
    },
    totalBalance: credits.reduce((sum, c) => sum + c.current_balance, 0),
    totalCreditLimit: credits.reduce((sum, c) => sum + c.credit_limit, 0),
    dueToday: credits.filter(c => c.daysUntilDue === 0 && c.current_balance > 0).length,
    overdue: credits.filter(c => c.daysOverdue > 0).length,
  };

  return {
    credits,
    isLoading,
    error,
    refetch,
    stats,
    createCredit,
    updateCredit,
    adjustCreditLimit,
    toggleBlock,
    registerPayment,
    registerCharge,
    createReminder,
  };
}

// Hook para promesas de pago
export function usePaymentPromises(creditId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: promises = [], isLoading } = useQuery({
    queryKey: ['payment-promises', creditId],
    queryFn: async () => {
      let query = supabase
        .from('payment_promises')
        .select('*')
        .order('promised_date', { ascending: true });

      if (creditId) {
        query = query.eq('credit_id', creditId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PaymentPromise[];
    },
    enabled: !!user,
  });

  // Crear promesa de pago
  const createPromise = useMutation({
    mutationFn: async (promise: {
      creditId: string;
      promisedAmount: number;
      promisedDate: string;
      notes?: string;
    }) => {
      if (!user) throw new Error('No autenticado');

      const { data, error } = await supabase
        .from('payment_promises')
        .insert({
          credit_id: promise.creditId,
          user_id: user.id,
          promised_amount: promise.promisedAmount,
          promised_date: promise.promisedDate,
          notes: promise.notes ? sanitizeText(promise.notes) : undefined,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-promises'] });
      toast.success('Compromiso de pago registrado');
    },
  });

  // Marcar promesa como cumplida
  const fulfillPromise = useMutation({
    mutationFn: async ({ promiseId, amountPaid }: { promiseId: string; amountPaid: number }) => {
      const { data: promise, error: fetchError } = await supabase
        .from('payment_promises')
        .select('*')
        .eq('id', promiseId)
        .single();

      if (fetchError) throw fetchError;

      const status = amountPaid >= promise.promised_amount ? 'CUMPLIDA' : 'PARCIAL';

      const { data, error } = await supabase
        .from('payment_promises')
        .update({
          status,
          actual_payment_date: new Date().toISOString().split('T')[0],
          actual_amount_paid: amountPaid,
        })
        .eq('id', promiseId)
        .select()
        .single();

      if (error) throw error;

      // Actualizar score del crédito basado en cumplimiento
      if (promise.credit_id) {
        const { data: credit } = await supabase
          .from('credits')
          .select('trust_score, total_purchases, total_paid_on_time, total_paid_late, consecutive_late_payments')
          .eq('id', promise.credit_id)
          .single();

        if (credit) {
          // Calcular nuevo score usando la función RPC
          const { data: newScore } = await supabase.rpc('calculate_trust_score', {
            p_total_purchases: (credit.total_purchases || 0) + 1,
            p_total_paid_on_time: status === 'CUMPLIDA' ? (credit.total_paid_on_time || 0) + 1 : (credit.total_paid_on_time || 0),
            p_total_paid_late: credit.total_paid_late || 0,
            p_consecutive_late: 0, // Se reinicia si cumple
            p_current_score: credit.trust_score || 100,
          });

          // Actualizar el crédito con el nuevo score
          await supabase
            .from('credits')
            .update({
              trust_score: newScore || credit.trust_score,
              total_purchases: (credit.total_purchases || 0) + 1,
              total_paid_on_time: status === 'CUMPLIDA' ? (credit.total_paid_on_time || 0) + 1 : credit.total_paid_on_time,
              consecutive_late_payments: 0,
              last_payment_date: new Date().toISOString(),
            })
            .eq('id', promise.credit_id);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-promises'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Promesa marcada como cumplida');
    },
  });

  // Marcar promesa como incumplida
  const breakPromise = useMutation({
    mutationFn: async (promiseId: string) => {
      const { data, error } = await supabase
        .from('payment_promises')
        .update({
          status: 'INCUMPLIDA',
        })
        .eq('id', promiseId)
        .select()
        .single();

      if (error) throw error;

      // Penalizar score del crédito
      if (data.credit_id) {
        const { data: credit } = await supabase
          .from('credits')
          .select('trust_score, consecutive_late_payments')
          .eq('id', data.credit_id)
          .single();

        if (credit) {
          await supabase
            .from('credits')
            .update({
              trust_score: Math.max(0, (credit.trust_score || 100) - 15),
              consecutive_late_payments: (credit.consecutive_late_payments || 0) + 1,
            })
            .eq('id', data.credit_id);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-promises'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.error('Promesa marcada como incumplida');
    },
  });

  // Aceptación del cliente
  const acceptPromise = useMutation({
    mutationFn: async (promiseId: string) => {
      const { data, error } = await supabase
        .from('payment_promises')
        .update({
          client_accepted: true,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', promiseId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-promises'] });
      toast.success('Cliente aceptó el compromiso');
    },
  });

  return {
    promises,
    isLoading,
    createPromise,
    fulfillPromise,
    breakPromise,
    acceptPromise,
  };
}

/**
 * useCustomerCredit — Hook for customers to view their own credit status.
 * Tables: `credits`, `credit_transactions`, `payment_promises`
 * Returns: { credit, transactions, promises, hasCredit, isLoading }
 */
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

/**
 * useCustomerOrders — Hook to manage and track customer orders.
 * Tables: `orders`
 * Returns: { orders, isLoading, refetch, stats }
 */
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

/**
 * useAllCreditTransactions — Hook to fetch all credit transactions for admin view.
 * Joins with credits table to include client_name.
 * Returns: { transactions, isLoading }
 */
export interface CreditTransactionWithClient extends CreditTransaction {
  client_name: string;
}

export function useAllCreditTransactions() {
  const { user, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['all-credit-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*, credits(client_name)')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      return (data || []).map(tx => ({
        ...tx,
        client_name: (tx.credits as any)?.client_name || 'Desconocido',
      })) as CreditTransactionWithClient[];
    },
    enabled: !!user && isAdmin,
  });
}
