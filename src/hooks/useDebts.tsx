/**
 * useDebts — Simple hook for managing general customer debts.
 * Tables: `debts`
 * Returns: { debts, pendingDebts, paidDebts, loading, addDebt, markAsPaid, deleteDebt }
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { debtSchema, validateInput } from '@/lib/validations';

export interface Debt {
  id: string;
  user_id: string;
  sale_id: string | null;
  client_name: string;
  client_phone: string | null;
  amount_usd: number;
  amount_bs: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
}

export function useDebts() {
  const { user } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDebts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      toast.error('No se pudieron cargar las deudas');
    } else {
      setDebts(data || []);
    }
    setLoading(false);
  };

  const addDebt = async (debt: Omit<Debt, 'id' | 'user_id' | 'created_at' | 'paid_at'>) => {
    if (!user) return { error: new Error('No autenticado') };

    // Validate input before database operation
    try {
      const validated = validateInput(debtSchema, debt);

      const { data, error } = await supabase
        .from('debts')
        .insert([{
          client_name: validated.client_name,
          client_phone: validated.client_phone,
          amount_usd: validated.amount_usd,
          amount_bs: validated.amount_bs,
          status: validated.status,
          notes: validated.notes,
          sale_id: validated.sale_id,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) {
        toast.error('No se pudo registrar la deuda');
      } else {
        toast.success('Deuda registrada correctamente');
        fetchDebts();
      }
      return { data, error };
    } catch (validationError) {
      const errorMessage = validationError instanceof Error ? validationError.message : 'Datos inválidos';
      toast.error('Error de validación: ' + errorMessage);
      return { error: new Error(errorMessage) };
    }
  };

  const markAsPaid = async (id: string) => {
    const { error } = await supabase
      .from('debts')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('No se pudo actualizar la deuda');
    } else {
      toast.success('Deuda marcada como pagada 🩷');
      fetchDebts();
    }
    return { error };
  };

  const registerAbono = async (id: string, amount: number, notes?: string, rate?: number) => {
    const debt = debts.find(d => d.id === id);
    if (!debt) return { error: new Error('Deuda no encontrada') };

    const newAmountUsd = Math.max(0, Number(debt.amount_usd) - amount);
    let newAmountBs = debt.amount_bs;
    if (rate && newAmountBs) {
      newAmountBs = Math.max(0, Number(debt.amount_bs) - (amount * rate));
    } else if (rate) {
      newAmountBs = newAmountUsd * rate;
    }

    const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const abonoLog = `\n[Abono: $${amount.toFixed(2)} - ${notes || 'Sin referencia'} - ${dateStr}]`;
    const newNotes = debt.notes ? `${debt.notes}${abonoLog}` : abonoLog.trim();

    const isPaid = newAmountUsd <= 0;
    const updateData: any = {
      amount_usd: newAmountUsd,
      amount_bs: newAmountBs,
      notes: newNotes,
    };

    if (isPaid) {
      updateData.status = 'paid';
      updateData.paid_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('debts')
      .update(updateData)
      .eq('id', id);

    if (error) {
      toast.error('No se pudo registrar el abono');
    } else {
      toast.success(isPaid ? 'Abono registrado. Deuda totalmente pagada! 🩷' : `Abono de $${amount.toFixed(2)} registrado.`);
      fetchDebts();
    }
    return { error };
  };

  const deleteDebt = async (id: string) => {
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('No se pudo eliminar la deuda');
    } else {
      toast.success('Deuda eliminada 🩷');
      fetchDebts();
    }
    return { error };
  };

  useEffect(() => {
    if (user) {
      fetchDebts();
    }
  }, [user]);

  const pendingDebts = debts.filter(d => d.status === 'pending');
  const paidDebts = debts.filter(d => d.status === 'paid');

  return { debts, pendingDebts, paidDebts, loading, addDebt, markAsPaid, registerAbono, deleteDebt, refetch: fetchDebts };
}
