import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Interfaz del item en el carrito
export interface CartItem {
  id: string;
  name: string;
  price_usd: number;
  quantity: number;
  image_url: string | null;
  stock: number;
}

// Interfaz del contexto del carrito
interface CartContextType {
  items: CartItem[];
  addItem: (product: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  isInCart: (productId: string) => boolean;
  getItemQuantity: (productId: string) => number;
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
  const addItem = (product: CartItem) => {
    setItems(currentItems => {
      const existingItem = currentItems.find(item => item.id === product.id);
      
      if (existingItem) {
        // Si ya existe, incrementar cantidad (respetando stock)
        const newQuantity = Math.min(existingItem.quantity + product.quantity, product.stock);
        return currentItems.map(item =>
          item.id === product.id ? { ...item, quantity: newQuantity } : item
        );
      }
      
      // Si no existe, agregar nuevo item
      return [...currentItems, { ...product, quantity: Math.min(product.quantity, product.stock) }];
    });
  };

  // Eliminar producto del carrito
  const removeItem = (productId: string) => {
    setItems(currentItems => currentItems.filter(item => item.id !== productId));
  };

  // Actualizar cantidad de un producto
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    
    setItems(currentItems =>
      currentItems.map(item =>
        item.id === productId ? { ...item, quantity: Math.min(quantity, item.stock) } : item
      )
    );
  };

  // Vaciar el carrito
  const clearCart = () => {
    setItems([]);
  };

  // Obtener número total de items
  const getItemCount = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  // Obtener subtotal en USD
  const getSubtotal = () => {
    return items.reduce((total, item) => total + (item.price_usd * item.quantity), 0);
  };

  // Verificar si un producto está en el carrito
  const isInCart = (productId: string) => {
    return items.some(item => item.id === productId);
  };

  // Obtener cantidad de un producto en el carrito
  const getItemQuantity = (productId: string) => {
    const item = items.find(item => item.id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getItemCount,
      getSubtotal,
      isInCart,
      getItemQuantity
    }}>
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
