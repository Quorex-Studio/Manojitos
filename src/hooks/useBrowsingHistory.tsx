/**
 * useBrowsingHistory — Hook to track recently viewed products in LocalStorage.
 * Capacity: 20 items.
 * Returns: { history, addToHistory, getRecentlyViewed, clearHistory }
 */
// Hook para historial de navegación del cliente
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const HISTORY_STORAGE_KEY = 'manojitos_browsing_history';
const MAX_HISTORY_ITEMS = 20;

export interface BrowsingHistoryItem {
  productId: string;
  productName: string;
  imageUrl: string | null;
  priceUsd: number;
  viewedAt: string;
}

export function useBrowsingHistory() {
  const { user } = useAuth();
  const storageKey = user ? `${HISTORY_STORAGE_KEY}_${user.id}` : HISTORY_STORAGE_KEY;

  const [history, setHistory] = useState<BrowsingHistoryItem[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  // Persistir cambios
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(history));
  }, [history, storageKey]);

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
