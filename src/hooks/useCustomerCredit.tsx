/**
 * useCustomerCredit — Hook for customers to view their own credit status.
 * Tables: `credits`, `credit_transactions`, `payment_promises`
 * Returns: { credit, transactions, promises, hasCredit, isLoading }
 */
// Hook para que los clientes vean su estado de crédito
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { calculateCreditStatus, type Credit, type CreditTransaction, type PaymentPromise } from './useCredits';

export function useCustomerCredit() {
  const { user } = useAuth();

  // Obtener el crédito del cliente actual
  const { data: credit, isLoading: loadingCredit } = useQuery({
    queryKey: ['customer-credit', user?.id, user?.email],
    queryFn: async () => {
      if (!user) return null;

      // 1. Intentar buscar por client_user_id
      let { data, error } = await supabase
        .from('credits')
        .select('*')
        .eq('client_user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // 2. Fallback: Si no se encuentra, buscar por email del usuario actual (si tiene)
      if (!data && user.email) {
        const { data: emailData, error: emailError } = await supabase
          .from('credits')
          .select('*')
          .eq('client_email', user.email)
          .maybeSingle();

        if (emailError) throw emailError;
        data = emailData;
      }

      // 3. Fallback adicional: Buscar por teléfono si está disponible en metadatos del usuario
      const phone = user.user_metadata?.phone || user.phone;
      if (!data && phone) {
        const { data: phoneData, error: phoneError } = await supabase
          .from('credits')
          .select('*')
          .eq('client_phone', phone)
          .maybeSingle();

        if (phoneError) throw phoneError;
        data = phoneData;
      }

      if (!data) return null;

      // Si se encontró por email o teléfono pero no tiene client_user_id, vincularlo ahora mismo de forma permanente.
      if (!data.client_user_id) {
        const { error: linkError } = await supabase
          .from('credits')
          .update({ client_user_id: user.id })
          .eq('id', data.id);
        if (!linkError) {
          data.client_user_id = user.id;
        }
      }

      // Calcular estado y días
      const { status, daysUntilDue, daysOverdue } = calculateCreditStatus(
        data.next_due_date,
        data.grace_days,
        data.is_blocked
      );

      return {
        ...data,
        trust_score: data.trust_score ?? 100,
        trust_level: data.trust_level ?? 'CONFIABLE',
        avg_payment_days: data.avg_payment_days ?? 0,
        total_purchases: data.total_purchases ?? 0,
        total_paid_on_time: data.total_paid_on_time ?? 0,
        total_paid_late: data.total_paid_late ?? 0,
        consecutive_late_payments: data.consecutive_late_payments ?? 0,
        restriction_level: data.restriction_level ?? 0,
        early_payment_discount: data.early_payment_discount ?? 0,
        auto_limit_adjustment: data.auto_limit_adjustment ?? true,
        calculatedStatus: status,
        daysUntilDue,
        daysOverdue,
      } as Credit;
    },
    enabled: !!user,
  });

  // Obtener transacciones del crédito
  const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ['customer-credit-transactions', credit?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('credit_id', credit!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as CreditTransaction[];
    },
    enabled: !!credit?.id,
  });

  // Obtener promesas de pago
  const { data: promises = [], isLoading: loadingPromises } = useQuery({
    queryKey: ['customer-payment-promises', credit?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_promises')
        .select('*')
        .eq('credit_id', credit!.id)
        .order('promised_date', { ascending: true });

      if (error) throw error;
      return data as PaymentPromise[];
    },
    enabled: !!credit?.id,
  });

  // Check if there are any pending payment verification orders
  const { data: pendingPayments = [], isLoading: loadingPendingPayments } = useQuery({
    queryKey: ['customer-pending-payments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_user_id', user.id)
        .like('notes', '[ABONO_CREDITO]%')
        .eq('status', 'pending');

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return {
    credit,
    transactions,
    promises,
    pendingPayments,
    hasPendingPayments: pendingPayments.length > 0,
    hasCredit: !!credit,
    isLoading: loadingCredit || loadingTransactions || loadingPromises || loadingPendingPayments,
  };
}
