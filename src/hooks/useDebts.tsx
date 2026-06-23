/**
 * useDebts — Simple hook for managing general customer debts.
 * Tables: `debts`
 * Returns: { debts, pendingDebts, paidDebts, loading, addDebt, markAsPaid, deleteDebt }
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
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
      toast({ title: 'Error', description: 'No se pudieron cargar las deudas', variant: 'destructive' });
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
        toast({ title: 'Error', description: 'No se pudo registrar la deuda', variant: 'destructive' });
      } else {
        toast({ title: 'Éxito', description: 'Deuda registrada correctamente' });
        fetchDebts();
      }
      return { data, error };
    } catch (validationError) {
      const errorMessage = validationError instanceof Error ? validationError.message : 'Datos inválidos';
      toast({ title: 'Error de validación', description: errorMessage, variant: 'destructive' });
      return { error: new Error(errorMessage) };
    }
  };

  const markAsPaid = async (id: string) => {
    const { error } = await supabase
      .from('debts')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la deuda', variant: 'destructive' });
    } else {
      toast({ title: 'Éxito', description: 'Deuda marcada como pagada' });
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
      toast({ title: 'Error', description: 'No se pudo eliminar la deuda', variant: 'destructive' });
    } else {
      toast({ title: 'Éxito', description: 'Deuda eliminada' });
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

  return { debts, pendingDebts, paidDebts, loading, addDebt, markAsPaid, deleteDebt, refetch: fetchDebts };
}
