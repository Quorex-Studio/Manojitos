import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

/**
 * Compras con productos (alimentan el inventario), sus pagos, gastos y sus categorías.
 * Tablas: purchases, purchase_items, purchase_payments, expenses, expense_categories.
 * RPC: register_purchase (compra + líneas + stock + pago inicial, atómico) y pay_purchase.
 */
export interface PurchaseItemRow {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  quantity: number;
  unit_cost_usd: number;
  landed_unit_cost_usd: number;
}
export interface PurchasePaymentRow { id: string; amount_usd: number; amount_bs: number | null; payment_method: string; notes: string | null; paid_at: string }
export interface PurchaseRow {
  id: string;
  provider_id: string | null;
  provider_name: string;
  amount_usd: number;
  amount_bs: number | null;
  amount_paid: number;
  subtotal_usd: number | null;
  tax_pct: number;
  tax_usd: number;
  shipping_usd: number;
  payment_method: string | null;
  status: string;
  due_date: string | null;
  notes: string | null;
  purchase_date: string;
  created_at: string;
  paid_at: string | null;
  purchase_items: PurchaseItemRow[];
  purchase_payments: PurchasePaymentRow[];
}
export interface ExpenseCategory { id: string; name: string; sort_order: number }
export interface ExpenseRow {
  id: string;
  category_id: string | null;
  description: string;
  amount_usd: number;
  amount_bs: number | null;
  payment_method: string | null;
  expense_date: string;
  status: 'paid' | 'pending';
  due_date: string | null;
  paid_at: string | null;
  provider_id: string | null;
  created_at: string;
}

export interface NewPurchaseItem {
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  quantity: number;
  unit_cost_usd: number;
}
export interface NewPurchase {
  provider_id: string | null;
  provider_name: string;
  purchase_date: string;
  tax_pct: number;
  shipping_usd: number;
  payment_method: string | null;
  amount_paid: number;
  due_date: string | null;
  notes: string | null;
  rate: number | null;
}

/** Totales de una compra: igual que register_purchase en la base (impuesto sobre el neto, más envío). */
export function purchaseTotals(items: { quantity: number; unit_cost_usd: number }[], taxPct: number, shipping: number) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_cost_usd) || 0), 0);
  const tax = round2(subtotal * Math.max(0, taxPct) / 100);
  const total = round2(subtotal + tax + Math.max(0, shipping));
  const factor = subtotal > 0 ? total / subtotal : 1;
  return { subtotal: round2(subtotal), tax, shipping: round2(Math.max(0, shipping)), total, landed: (unitCost: number) => Math.round(unitCost * factor * 10000) / 10000 };
}

/** Mensaje claro cuando la base todavía no tiene la migración de compras y gastos. */
export const missingMigration = (e: unknown) => {
  const m = (e as { message?: string; code?: string })?.message ?? '';
  return /purchase_items|purchase_payments|expense|register_purchase|pay_purchase|schema cache|does not exist/i.test(m);
};

export function usePurchasesDetail() {
  return useQuery({
    queryKey: ['purchases-detail'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchases')
        .select('*, purchase_items(*), purchase_payments(*)')
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) {
        // Sin la migración: compras sin líneas ni pagos (las viejas siguen viéndose)
        if (missingMigration(error)) {
          const { data: plain, error: e2 } = await supabase.from('purchases').select('*').order('purchase_date', { ascending: false }).limit(500);
          if (e2) throw e2;
          return {
            rows: (plain || []).map(p => ({
              ...p,
              amount_paid: p.amount_paid ?? (p.status === 'paid' ? p.amount_usd : 0),
              tax_pct: p.tax_pct ?? 0, tax_usd: p.tax_usd ?? 0, shipping_usd: p.shipping_usd ?? 0,
              subtotal_usd: p.subtotal_usd ?? null, payment_method: p.payment_method ?? null, due_date: p.due_date ?? null,
              purchase_items: [], purchase_payments: [],
            })) as unknown as PurchaseRow[],
            migrated: false,
          };
        }
        throw error;
      }
      return { rows: (data || []) as unknown as PurchaseRow[], migrated: true };
    },
  });
}

export function useExpenses() {
  const categories = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_categories').select('id, name, sort_order').order('sort_order').order('name');
      if (error) throw error;
      return (data || []) as ExpenseCategory[];
    },
    retry: false,
  });
  const expenses = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false }).limit(2000);
      if (error) throw error;
      return (data || []) as ExpenseRow[];
    },
    retry: false,
  });
  return { categories, expenses, migrated: !(categories.error && missingMigration(categories.error)) };
}

export function usePurchasingActions() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['purchases-detail'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['expense-categories'] });
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['admin-products'] });
  };

  const registerPurchase = useMutation({
    mutationFn: async ({ purchase, items }: { purchase: NewPurchase; items: NewPurchaseItem[] }) => {
      const { data, error } = await supabase.rpc('register_purchase', { p_purchase: purchase as unknown as Json, p_items: items as unknown as Json });
      if (error) throw error;
      return data as { id: string; total_usd: number; paid_usd: number; units: number };
    },
    onSuccess: refresh,
  });

  const payPurchase = useMutation({
    mutationFn: async (v: { purchaseId: string; amountUsd: number; amountBs: number | null; method: string; notes?: string }) => {
      const { error } = await supabase.rpc('pay_purchase', { p_purchase_id: v.purchaseId, p_amount_usd: v.amountUsd, p_amount_bs: v.amountBs, p_payment_method: v.method, p_notes: v.notes ?? null });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  /** Borra la compra y descuenta del inventario las unidades que había sumado (sin migración: borrado simple). */
  const deletePurchase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_purchase', { p_purchase_id: id });
      if (error && missingMigration(error)) {
        const { error: e2 } = await supabase.from('purchases').delete().eq('id', id);
        if (e2) throw e2;
        return;
      }
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const saveExpense = useMutation({
    mutationFn: async (e: Omit<ExpenseRow, 'id' | 'created_at' | 'paid_at'> & { id?: string }) => {
      const row = { ...e, paid_at: e.status === 'paid' ? new Date().toISOString() : null };
      const { error } = e.id
        ? await supabase.from('expenses').update(row).eq('id', e.id)
        : await supabase.from('expenses').insert(row);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const payExpense = useMutation({
    mutationFn: async ({ id, method }: { id: string; method: string }) => {
      const { error } = await supabase.from('expenses').update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: method }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const saveCategory = useMutation({
    mutationFn: async ({ id, name, sort_order }: { id?: string; name: string; sort_order?: number }) => {
      const { error } = id
        ? await supabase.from('expense_categories').update({ name }).eq('id', id)
        : await supabase.from('expense_categories').insert({ name, sort_order: sort_order ?? 50 });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return { registerPurchase, payPurchase, deletePurchase, saveExpense, payExpense, deleteExpense, saveCategory, deleteCategory };
}
