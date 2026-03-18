/**
 * useProviders — Hook to manage product suppliers and wholesale purchases.
 * Tables: `providers`, `purchases`
 * Validations: `providerSchema`, `purchaseSchema` via Zod.
 * Returns: { providers, purchases, loading, addProvider, deleteProvider, addPurchase, markPurchaseAsPaid }
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { providerSchema, purchaseSchema, validateInput } from '@/lib/validations';

export interface Provider {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  provider_id: string | null;
  provider_name: string;
  amount_usd: number;
  amount_bs: number | null;
  status: string;
  notes: string | null;
  purchase_date: string;
  created_at: string;
  paid_at: string | null;
}

export function useProviders() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .order('name', { ascending: true });

    if (!error) {
      setProviders(data || []);
    }
  };

  const fetchPurchases = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) {
      setPurchases(data || []);
    }
    setLoading(false);
  };

  const addProvider = async (provider: Omit<Provider, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return { error: new Error('No autenticado') };

    // Validate input before database operation
    try {
      const validated = validateInput(providerSchema, provider);

      const { data, error } = await supabase
        .from('providers')
        .insert([{
          name: validated.name,
          phone: validated.phone,
          email: validated.email || null,
          notes: validated.notes,
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

      const { data, error } = await supabase
        .from('purchases')
        .insert([{
          provider_id: validated.provider_id,
          provider_name: validated.provider_name,
          amount_usd: validated.amount_usd,
          amount_bs: validated.amount_bs,
          purchase_date: validated.purchase_date,
          status: validated.status,
          notes: validated.notes,
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
  }, [user]);

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
