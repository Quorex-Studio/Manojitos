/**
 * useLedger — Financial auditing hook for real-time transaction tracking.
 * STRICT RULE: No deletions allowed, only reversals for audit integrity.
 * Tables: `ledger_entries`
 * RPCs: `create_ledger_entry`
 * Returns: { entries, isLoading, createEntry, reverseEntry, currentBalance, stats }
 */
// Hook para el Ledger Financiero - Auditoría real
// No permite eliminación, solo reversos

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Json } from '@/integrations/supabase/types';
import type { LedgerEntry, LedgerEntryInput } from '@/types';


// Hook principal del ledger
export function useLedger() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch ledger entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['ledger-entries', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as LedgerEntry[];
    },
    enabled: !!user,
  });

  // Crear entrada de ledger usando la función de la base de datos
  const createEntry = useMutation({
    mutationFn: async (input: LedgerEntryInput) => {
      if (!user) throw new Error('No autenticado');

      // Usar la función de la BD para mantener consistencia
      const { data, error } = await supabase.rpc('create_ledger_entry', {
        p_user_id: user.id,
        p_entry_type: input.entry_type,
        p_amount_usd: input.amount_usd,
        p_amount_bs: input.amount_bs || 0,
        p_reference_type: input.reference_type,
        p_reference_id: input.reference_id || '',
        p_description: input.description || '',
        p_metadata: (input.metadata || {}) as Json,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'No se pudo crear la entrada de ledger',
        variant: 'destructive',
      });
    },
  });

  // Reversar una entrada (NO eliminar)
  const reverseEntry = useMutation({
    mutationFn: async ({ entryId, reason }: { entryId: string; reason: string }) => {
      if (!user || !isAdmin) throw new Error('No autorizado');

      // Buscar la entrada original
      const { data: original, error: fetchError } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      if (fetchError || !original) throw new Error('Entrada no encontrada');
      if (original.is_reversal) throw new Error('No se puede reversar un reverso');
      if (original.reversed_by_id) throw new Error('Esta entrada ya fue reversada');

      // Crear entrada de reverso (tipo opuesto)
      const reversalType = original.entry_type === 'debit' ? 'credit' : 'debit';

      const { data: reversalId, error: createError } = await supabase.rpc('create_ledger_entry', {
        p_user_id: user.id,
        p_entry_type: reversalType,
        p_amount_usd: original.amount_usd,
        p_amount_bs: original.amount_bs ?? 0,
        p_reference_type: 'reversal',
        p_reference_id: original.reference_id ?? '',
        p_description: `Reverso: ${reason}`,
        p_metadata: { reversed_entry_id: entryId, reason },
      });

      if (createError) throw createError;

      // Actualizar la entrada original para marcar que fue reversada
      const { error: updateError } = await supabase
        .from('ledger_entries')
        .update({
          reversed_by_id: reversalId,
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      // Actualizar el reverso para marcarlo como tal
      const { error: updateReversalError } = await supabase
        .from('ledger_entries')
        .update({
          is_reversal: true,
          reversal_of_id: entryId,
        })
        .eq('id', reversalId);

      if (updateReversalError) throw updateReversalError;

      return reversalId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      toast({
        title: 'Éxito',
        description: 'Entrada reversada correctamente',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo reversar la entrada',
        variant: 'destructive',
      });
    },
  });

  // Calcular balance actual
  const currentBalance = entries.length > 0
    ? { usd: entries[0].balance_after_usd, bs: entries[0].balance_after_bs }
    : { usd: 0, bs: 0 };

  // Estadísticas del ledger
  const stats = {
    totalEntries: entries.length,
    totalDebits: entries.filter(e => e.entry_type === 'debit').reduce((sum, e) => sum + e.amount_usd, 0),
    totalCredits: entries.filter(e => e.entry_type === 'credit').reduce((sum, e) => sum + e.amount_usd, 0),
    reversals: entries.filter(e => e.is_reversal).length,
    currentBalanceUsd: currentBalance.usd,
    currentBalanceBs: currentBalance.bs,
  };

  // Las mutaciones ya invalidan el caché automáticamente.
  // No se necesita suscripción realtime.

  return {
    entries,
    isLoading,
    createEntry,
    reverseEntry,
    currentBalance,
    stats,
  };
}

// Hook para registrar ventas en el ledger
export function useSaleLedger() {
  const { createEntry } = useLedger();

  const recordSale = async (saleId: string, amountUsd: number, amountBs: number | null) => {
    await createEntry.mutateAsync({
      entry_type: 'credit',
      amount_usd: amountUsd,
      amount_bs: amountBs,
      reference_type: 'sale',
      reference_id: saleId,
      description: 'Venta registrada',
    });
  };

  const recordRefund = async (saleId: string, amountUsd: number, amountBs: number | null, reason: string) => {
    await createEntry.mutateAsync({
      entry_type: 'debit',
      amount_usd: amountUsd,
      amount_bs: amountBs,
      reference_type: 'refund',
      reference_id: saleId,
      description: `Reembolso: ${reason}`,
    });
  };

  return { recordSale, recordRefund };
}

// Hook para pagos de crédito en el ledger
export function useCreditPaymentLedger() {
  const { createEntry } = useLedger();

  const recordCreditPayment = async (creditId: string, amountUsd: number, amountBs: number | null) => {
    await createEntry.mutateAsync({
      entry_type: 'credit',
      amount_usd: amountUsd,
      amount_bs: amountBs,
      reference_type: 'credit_payment',
      reference_id: creditId,
      description: 'Pago de crédito recibido',
    });
  };

  return { recordCreditPayment };
}
