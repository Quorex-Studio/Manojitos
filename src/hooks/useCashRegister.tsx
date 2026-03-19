/**
 * useCashRegister — Hook to manage daily cash register sessions and summaries.
 * Persistence: LocalStorage
 * Analyzes: `sales` (via hook)
 * Returns: { session, isOpen, openRegister, closeRegister, dailySummary, getHistory }
 */
// Hook para Modo Caja del Día
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useSales } from './useSales';
import { useCredits } from './useCredits';

const CASH_REGISTER_KEY = 'manojitos_cash_register';

export interface CashRegisterSession {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number | null;
  notes: string;
  isOpen: boolean;
}

export interface DailySummary {
  totalSales: number;
  totalCash: number;
  totalCredit: number;
  totalTransfer: number;
  totalMobile: number;
  transactionCount: number;
  creditSalesCount: number;
  cashSalesCount: number;
  averageTicket: number;
  topProducts: Array<{ name: string; quantity: number; total: number }>;
}

const getCashKey = (userId: string | null) =>
  userId ? `${CASH_REGISTER_KEY}_${userId}` : `${CASH_REGISTER_KEY}_guest`;

export function useCashRegister() {
  const [userId, setUserId] = useState<string | null>(null);
  const { sales } = useSales();
  const [session, setSession] = useState<CashRegisterSession | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      const id = authSession?.user?.id ?? null;
      setUserId(id);
      try {
        const stored = localStorage.getItem(getCashKey(id));
        setSession(stored ? JSON.parse(stored) : null);
      } catch { setSession(null); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
      const id = authSession?.user?.id ?? null;
      setUserId(id);
      try {
        const stored = localStorage.getItem(getCashKey(id));
        setSession(stored ? JSON.parse(stored) : null);
      } catch { setSession(null); }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem(getCashKey(userId), JSON.stringify(session));
    } else {
      localStorage.removeItem(getCashKey(userId));
    }
  }, [session, userId]);

  // Abrir caja
  const openRegister = useCallback((openingBalance: number, notes = '') => {
    const newSession: CashRegisterSession = {
      id: `session_${Date.now()}`,
      openedAt: new Date().toISOString(),
      closedAt: null,
      openingBalance,
      closingBalance: null,
      notes,
      isOpen: true
    };
    setSession(newSession);
    return newSession;
  }, []);

  // Calcular resumen del día
  const dailySummary = useMemo((): DailySummary => {
    if (!session?.isOpen) {
      return {
        totalSales: 0,
        totalCash: 0,
        totalCredit: 0,
        totalTransfer: 0,
        totalMobile: 0,
        transactionCount: 0,
        creditSalesCount: 0,
        cashSalesCount: 0,
        averageTicket: 0,
        topProducts: []
      };
    }

    const sessionStart = new Date(session.openedAt);
    const todaySales = sales.filter(s => {
      const saleDate = new Date(s.created_at);
      return saleDate >= sessionStart && s.status === 'confirmed';
    });

    const totalSales = todaySales.reduce((sum, s) => sum + s.total_usd, 0);
    const totalCash = todaySales
      .filter(s => s.payment_method === 'efectivo_usd' || s.payment_method === 'efectivo_bs')
      .reduce((sum, s) => sum + s.total_usd, 0);
    const totalCredit = todaySales
      .filter(s => s.is_credit)
      .reduce((sum, s) => sum + s.total_usd, 0);
    const totalTransfer = todaySales
      .filter(s => s.payment_method === 'transferencia')
      .reduce((sum, s) => sum + s.total_usd, 0);
    const totalMobile = todaySales
      .filter(s => s.payment_method === 'pago_movil')
      .reduce((sum, s) => sum + s.total_usd, 0);

    // Top productos
    const productMap = new Map<string, { name: string; quantity: number; total: number }>();
    todaySales.forEach(sale => {
      const existing = productMap.get(sale.product_name) || { name: sale.product_name, quantity: 0, total: 0 };
      existing.quantity += sale.quantity;
      existing.total += sale.total_usd;
      productMap.set(sale.product_name, existing);
    });
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      totalSales,
      totalCash,
      totalCredit,
      totalTransfer,
      totalMobile,
      transactionCount: todaySales.length,
      creditSalesCount: todaySales.filter(s => s.is_credit).length,
      cashSalesCount: todaySales.filter(s => !s.is_credit).length,
      averageTicket: todaySales.length > 0 ? totalSales / todaySales.length : 0,
      topProducts
    };
  }, [session, sales]);

  // Cerrar caja
  const closeRegister = useCallback((closingBalance: number, notes = '') => {
    if (!session) return null;

    const closedSession: CashRegisterSession = {
      ...session,
      closedAt: new Date().toISOString(),
      closingBalance,
      notes: session.notes + (notes ? `\n${notes}` : ''),
      isOpen: false
    };
    
    // Guardar en historial
    const historyKey = `${getCashKey(userId)}_history`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    history.unshift({ ...closedSession, summary: dailySummary });
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 30))); // Últimos 30 días
    
    setSession(null);
    return { session: closedSession, summary: dailySummary };
  }, [session, dailySummary, userId]);

  // Obtener historial
  const getHistory = useCallback(() => {
    const historyKey = `${getCashKey(userId)}_history`;
    return JSON.parse(localStorage.getItem(historyKey) || '[]');
  }, [userId]);

  return {
    session,
    isOpen: session?.isOpen ?? false,
    openRegister,
    closeRegister,
    dailySummary,
    getHistory
  };
}
