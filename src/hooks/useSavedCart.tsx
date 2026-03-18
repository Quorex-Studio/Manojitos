/**
 * useSavedCart — Hook to persist multiple carts in LocalStorage.
 * Capacity: Up to 5 most recent carts.
 * Persistence: LocalStorage (namespaced by user ID if authenticated).
 * Returns: { savedCarts, saveCart, deleteSavedCart, getSavedCart, hasSavedCarts }
 */
// Hook para guardar carritos para después
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { CartItem } from '@/contexts/CartContext';

const SAVED_CART_KEY = 'manojitos_saved_cart';

export interface SavedCart {
  id: string;
  name: string;
  items: CartItem[];
  savedAt: string;
  totalUsd: number;
}

export function useSavedCart() {
  const { user } = useAuth();
  const storageKey = user ? `${SAVED_CART_KEY}_${user.id}` : SAVED_CART_KEY;

  const [savedCarts, setSavedCarts] = useState<SavedCart[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  // Persistir cambios
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(savedCarts));
  }, [savedCarts, storageKey]);

  // Guardar carrito actual
  const saveCart = useCallback((items: CartItem[], name?: string) => {
    const totalUsd = items.reduce((sum, item) => sum + item.price_usd * item.quantity, 0);
    
    const newCart: SavedCart = {
      id: `cart_${Date.now()}`,
      name: name || `Carrito ${new Date().toLocaleDateString('es-VE')}`,
      items,
      savedAt: new Date().toISOString(),
      totalUsd
    };
    
    setSavedCarts(current => [newCart, ...current].slice(0, 5)); // Máximo 5 carritos guardados
    return newCart;
  }, []);

  // Eliminar carrito guardado
  const deleteSavedCart = useCallback((cartId: string) => {
    setSavedCarts(current => current.filter(cart => cart.id !== cartId));
  }, []);

  // Obtener un carrito específico
  const getSavedCart = useCallback((cartId: string) => {
    return savedCarts.find(cart => cart.id === cartId);
  }, [savedCarts]);

  return {
    savedCarts,
    saveCart,
    deleteSavedCart,
    getSavedCart,
    hasSavedCarts: savedCarts.length > 0
  };
}
