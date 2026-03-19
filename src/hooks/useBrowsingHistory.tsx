/**
 * useBrowsingHistory — Hook to track recently viewed products in LocalStorage.
 * Capacity: 20 items.
 * Returns: { history, addToHistory, getRecentlyViewed, clearHistory }
 */
// Hook para historial de navegación del cliente
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { BrowsingHistoryItem } from '@/types';

const HISTORY_STORAGE_KEY = 'manojitos_browsing_history';
const MAX_HISTORY_ITEMS = 20;

const getHistoryKey = (userId: string | null) =>
  userId ? `${HISTORY_STORAGE_KEY}_${userId}` : `${HISTORY_STORAGE_KEY}_guest`;

export function useBrowsingHistory() {
  const [userId, setUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<BrowsingHistoryItem[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const id = session?.user?.id ?? null;
      setUserId(id);
      try {
        const stored = localStorage.getItem(getHistoryKey(id));
        setHistory(stored ? JSON.parse(stored) : []);
      } catch { setHistory([]); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id ?? null;
      setUserId(id);
      try {
        const stored = localStorage.getItem(getHistoryKey(id));
        setHistory(stored ? JSON.parse(stored) : []);
      } catch { setHistory([]); }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem(getHistoryKey(userId), JSON.stringify(history));
  }, [history, userId]);

  // Agregar producto visto
  const addToHistory = useCallback((product: {
    id: string;
    name: string;
    image_url: string | null;
    price_usd: number;
  }) => {
    setHistory(current => {
      // Remover si ya existe
      const filtered = current.filter(item => item.productId !== product.id);
      
      // Agregar al inicio
      const newItem: BrowsingHistoryItem = {
        productId: product.id,
        productName: product.name,
        imageUrl: product.image_url,
        priceUsd: product.price_usd,
        viewedAt: new Date().toISOString()
      };
      
      // Mantener solo los últimos N items
      return [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    });
  }, []);

  // Obtener últimos productos vistos (excluyendo el actual)
  const getRecentlyViewed = useCallback((excludeProductId?: string, limit = 6) => {
    return history
      .filter(item => item.productId !== excludeProductId)
      .slice(0, limit);
  }, [history]);

  // Limpiar historial
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    addToHistory,
    getRecentlyViewed,
    clearHistory
  };
}
