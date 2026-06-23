import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Interfaz del item en el carrito
export interface CartItem {
  id: string;
  name: string;
  price_usd: number;
  quantity: number;
  image_url: string | null;
  stock: number;
  size?: string;
}

// Interfaz del contexto del carrito
interface CartContextType {
  items: CartItem[];
  addItem: (product: CartItem) => void;
  removeItem: (productId: string, size?: string) => void;
  updateQuantity: (productId: string, quantity: number, size?: string) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  isInCart: (productId: string, size?: string) => boolean;
  getItemQuantity: (productId: string, size?: string) => number;
}

// Helper para obtener la clave de almacenamiento por usuario
const getCartKey = (userId: string | null) =>
  userId ? `manojitos_cart_${userId}` : 'manojitos_cart_guest';

// Helper para cargar el carrito
const loadCart = (userId: string | null): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(getCartKey(userId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Helper para guardar el carrito
const saveCart = (userId: string | null, items: CartItem[]) => {
  localStorage.setItem(getCartKey(userId), JSON.stringify(items));
};

// Crear el contexto
const CartContext = createContext<CartContextType | undefined>(undefined);

// Provider del carrito
export function CartProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  // Suscribirse a cambios de autenticación para cargar el carrito correcto
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const id = session?.user?.id ?? null;
      setUserId(id);
      setItems(loadCart(id));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id ?? null;
      setUserId(id);
      setItems(loadCart(id));
    });

    return () => subscription.unsubscribe();
  }, []);

  // Persistir cambios en localStorage cada vez que items o userId cambien
  useEffect(() => {
    saveCart(userId, items);
  }, [items, userId]);

  // Agregar producto al carrito
  const addItem = useCallback((product: CartItem) => {
    setItems(currentItems => {
      const existingItem = currentItems.find(
        item => item.id === product.id && item.size === product.size
      );

      if (existingItem) {
        const newQuantity = Math.min(existingItem.quantity + product.quantity, product.stock);
        return currentItems.map(item =>
          (item.id === product.id && item.size === product.size)
            ? { ...item, quantity: newQuantity }
            : item
        );
      }

      return [...currentItems, { ...product, quantity: Math.min(product.quantity, product.stock) }];
    });
  }, []);

  // Eliminar producto del carrito
  const removeItem = useCallback((productId: string, size?: string) => {
    setItems(currentItems => currentItems.filter(item => !(item.id === productId && item.size === size)));
  }, []);

  // Actualizar cantidad de un producto
  const updateQuantity = useCallback((productId: string, quantity: number, size?: string) => {
    if (quantity <= 0) {
      setItems(currentItems => currentItems.filter(item => !(item.id === productId && item.size === size)));
      return;
    }

    setItems(currentItems =>
      currentItems.map(item =>
        (item.id === productId && item.size === size) ? { ...item, quantity: Math.min(quantity, item.stock) } : item
      )
    );
  }, []);

  // Vaciar el carrito
  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // Obtener número total de items
  const getItemCount = useCallback(() => {
    return items.reduce((total, item) => total + item.quantity, 0);
  }, [items]);

  // Obtener subtotal en USD
  const getSubtotal = useCallback(() => {
    return items.reduce((total, item) => total + (item.price_usd * item.quantity), 0);
  }, [items]);

  // Verificar si un producto está en el carrito
  const isInCart = useCallback((productId: string, size?: string) => {
    return items.some(item => item.id === productId && (!size || item.size === size));
  }, [items]);

  // Obtener cantidad de un producto en el carrito
  const getItemQuantity = useCallback((productId: string, size?: string) => {
    const item = items.find(item => item.id === productId && (!size || item.size === size));
    return item ? item.quantity : 0;
  }, [items]);

  // Memoizar el valor del contexto para evitar re-renders innecesarios
  const contextValue = useMemo(() => ({
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getItemCount,
    getSubtotal,
    isInCart,
    getItemQuantity
  }), [items, addItem, removeItem, updateQuantity, clearCart, getItemCount, getSubtotal, isInCart, getItemQuantity]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

// Hook para usar el carrito
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart debe usarse dentro de un CartProvider');
  }
  return context;
}
