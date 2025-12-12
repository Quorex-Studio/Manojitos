import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

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
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las deudas', variant: 'destructive' });
    } else {
      setDebts(data || []);
    }
    setLoading(false);
  };

  const addDebt = async (debt: Omit<Debt, 'id' | 'user_id' | 'created_at' | 'paid_at'>) => {
    if (!user) return { error: new Error('No autenticado') };

    const { data, error } = await supabase
      .from('debts')
      .insert({ ...debt, user_id: user.id })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'No se pudo registrar la deuda', variant: 'destructive' });
    } else {
      toast({ title: 'Éxito', description: 'Deuda registrada correctamente' });
    }
    return { data, error };
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
    }
    return { error };
  };

  useEffect(() => {
    if (user) {
      fetchDebts();

      const channel = supabase
        .channel('debts-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'debts'
          },
          () => {
            fetchDebts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const pendingDebts = debts.filter(d => d.status === 'pending');
  const paidDebts = debts.filter(d => d.status === 'paid');

  return { debts, pendingDebts, paidDebts, loading, addDebt, markAsPaid, deleteDebt, refetch: fetchDebts };
}
