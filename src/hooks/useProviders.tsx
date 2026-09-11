/**
 * useProviders — Hook to manage product suppliers and wholesale purchases.
 * Tables: `providers`, `purchases`
 * Validations: `providerSchema`, `purchaseSchema` via Zod.
 * Returns: { providers, purchases, loading, addProvider, deleteProvider, addPurchase, markPurchaseAsPaid }
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { providerSchema, purchaseSchema, validateInput } from '@/lib/validations';
import type { Provider, Purchase } from '@/types';


export function useProviders() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .order('name', { ascending: true })
      .limit(100);

    if (!error) {
      setProviders(data || []);
    }
  }, [user]);

  const fetchPurchases = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error) {
      setPurchases(data || []);
    }
    setLoading(false);
  }, [user]);

  const addProvider = async (provider: Omit<Provider, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return { error: new Error('No autenticado') };

    // Validate input before database operation
    try {
      const validated = validateInput(providerSchema, provider);

      const valProvider = validated as Omit<Provider, 'id' | 'user_id' | 'created_at'>;
      const { data, error } = await supabase
        .from('providers')
        .insert([{
          name: valProvider.name,
          phone: valProvider.phone,
          email: valProvider.email || null,
          notes: valProvider.notes,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: 'No se pudo crear el proveedor', variant: 'destructive' });
      } else {
        toast({ title: 'Éxito', description: 'Proveedor creado correctamente' });
      }
      return { data, error };
    } catch (validationError) {
      const errorMessage = validationError instanceof Error ? validationError.message : 'Datos inválidos';
      toast({ title: 'Error de validación', description: errorMessage, variant: 'destructive' });
      return { error: new Error(errorMessage) };
    }
  };

  const deleteProvider = async (id: string) => {
    const { error } = await supabase
      .from('providers')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el proveedor', variant: 'destructive' });
    } else {
      toast({ title: 'Éxito', description: 'Proveedor eliminado' });
    }
    return { error };
  };

  const addPurchase = async (purchase: Omit<Purchase, 'id' | 'user_id' | 'created_at' | 'paid_at'>) => {
    if (!user) return { error: new Error('No autenticado') };

    // Validate input before database operation
    try {
      const validated = validateInput(purchaseSchema, purchase);

      const valPurchase = validated as Omit<Purchase, 'id' | 'user_id' | 'created_at' | 'paid_at'>;
      const { data, error } = await supabase
        .from('purchases')
        .insert([{
          provider_id: valPurchase.provider_id,
          provider_name: valPurchase.provider_name,
          amount_usd: valPurchase.amount_usd,
          amount_bs: valPurchase.amount_bs,
          purchase_date: valPurchase.purchase_date,
          status: valPurchase.status,
          notes: valPurchase.notes,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: 'No se pudo registrar la compra', variant: 'destructive' });
      } else {
        toast({ title: 'Éxito', description: 'Compra registrada correctamente' });
      }
      return { data, error };
    } catch (validationError) {
      const errorMessage = validationError instanceof Error ? validationError.message : 'Datos inválidos';
      toast({ title: 'Error de validación', description: errorMessage, variant: 'destructive' });
      return { error: new Error(errorMessage) };
    }
  };

  const markPurchaseAsPaid = async (id: string) => {
    const { error } = await supabase
      .from('purchases')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la compra', variant: 'destructive' });
    } else {
      toast({ title: 'Éxito', description: 'Compra marcada como pagada' });
    }
    return { error };
  };

  useEffect(() => {
    if (user) {
      fetchProviders();
      fetchPurchases();
    }
  }, [user, fetchProviders, fetchPurchases]);

  return {
    providers,
    purchases,
    loading,
    addProvider,
    deleteProvider,
    addPurchase,
    markPurchaseAsPaid,
    refetch: () => { fetchProviders(); fetchPurchases(); }
  };
}
