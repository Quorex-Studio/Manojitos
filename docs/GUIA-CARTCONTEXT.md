# Guía de Estudio: CartContext.tsx
## Gestión del Carrito de Compras

### ¿Qué es este archivo?
Es el "estado global" del carrito de compras. Cualquier componente puede leer el carrito y modificarlo.

---

### Imports (línea 1)

```tsx
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
```
- `createContext`: Crea un "contexto" de React (mecanismo para compartir datos sin pasar props)
- `useContext`: Hook para LEER un contexto desde un componente hijo
- `useState`: Hook para estado local (items del carrito, userId)
- `useEffect`: Hook para efectos secundarios (suscribirse a auth, guardar en localStorage)
- `ReactNode`: Tipo para `children` (cualquier hijo de React)
- `useCallback`: **OPTIMIZACIÓN** — memoiza funciones para que no cambien identidad en cada render
- `useMemo`: **OPTIMIZACIÓN** — memoiza valores calculados

```tsx
import { supabase } from '@/integrations/supabase/client';
```
- Cliente de Supabase — se usa para detectar cambios de autenticación

### Interfaces (líneas 4-25)

```tsx
export interface CartItem {
  id: string;           // ID único del producto (UUID de Supabase)
  name: string;         // Nombre del producto
  price_usd: number;    // Precio en dólares
  quantity: number;     // Cantidad en el carrito
  image_url: string | null;  // URL de imagen (puede ser null)
  stock: number;        // Stock disponible (para validar cantidad máxima)
}
```
- **¿Por qué `stock` en el item?** Para no permitir agregar más de lo que existe
- **`string | null`**: TypeScript exige declarar que `image_url` puede ser nulo

```tsx
interface CartContextType {
  items: CartItem[];                                    // Array de productos en carrito
  addItem: (product: CartItem) => void;                 // Agregar producto
  removeItem: (productId: string) => void;              // Eliminar por ID
  updateQuantity: (productId: string, quantity: number) => void;  // Cambiar cantidad
  clearCart: () => void;                                // Vaciar carrito
  getItemCount: () => number;                           // Total de unidades
  getSubtotal: () => number;                            // Total en USD
  isInCart: (productId: string) => boolean;             // ¿Producto está en carrito?
  getItemQuantity: (productId: string) => number;       // Cantidad de un producto
}
```
- Esta es la "forma" del contexto — lo que cualquier componente puede consumir

### Helpers de Storage (líneas 28-44)

```tsx
const getCartKey = (userId: string | null) =>
  userId ? `manojitos_cart_${userId}` : 'manojitos_cart_guest';
```
- Genera la clave de localStorage POR usuario
- Si el usuario está logueado: `manojitos_cart_uuid123`
- Si es invitado: `manojitos_cart_guest`
- **¿Por qué?** Cada usuario tiene su propio carrito separado

```tsx
const loadCart = (userId: string | null): CartItem[] => {
  if (typeof window === 'undefined') return [];  // SSR safety check
  try {
    const stored = localStorage.getItem(getCartKey(userId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];  // Si el JSON está corrupto, carrito vacío
  }
};
```
- `typeof window === 'undefined'`: Protege contra errores en server-side rendering
- `try/catch`: Si alguien manipuló localStorage manualmente, no crashea
- `JSON.parse`: Convierte string de localStorage a array de CartItem

```tsx
const saveCart = (userId: string | null, items: CartItem[]) => {
  localStorage.setItem(getCartKey(userId), JSON.stringify(items));
};
```
- `JSON.stringify`: Convierte array a string para guardar en localStorage

### Creación del Contexto (línea 47)

```tsx
const CartContext = createContext<CartContextType | undefined>(undefined);
```
- Crea el contexto con valor inicial `undefined`
- El `| undefined` es importante — permite detectar si un componente usa `useCart()` sin estar dentro del provider

### CartProvider (líneas 50-52)

```tsx
export function CartProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
```
- Componente que "provee" el contexto a todos sus hijos
- `userId`: Se actualiza cuando el usuario hace login/logout
- `items`: El estado actual del carrito

### Suscripción a Auth (líneas 55-69)

```tsx
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    const id = session?.user?.id ?? null;  // Obtener ID o null si no hay sesión
    setUserId(id);
    setItems(loadCart(id));  // Cargar carrito de ESE usuario
  });
```
- Al montar el provider, verifica si ya hay sesión activa
- Si hay usuario logueado, carga SU carrito desde localStorage
- `?? null`: Nullish coalescing — si es undefined, usa null

```tsx
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    const id = session?.user?.id ?? null;
    setUserId(id);
    setItems(loadCart(id));
  });
```
- Se suscribe a cambios de autenticación (login, logout, token refresh)
- Cuando cambia la sesión, recarga el carrito correspondiente

```tsx
  return () => subscription.unsubscribe();  // Cleanup al desmontar
}, []);  // Array vacío = solo se ejecuta una vez (al montar)
```
- El return del useEffect es la función de limpieza
- Previene memory leaks — cancela la suscripción cuando el provider se desmonta

### Persistencia en localStorage (líneas 72-74)

```tsx
useEffect(() => {
  saveCart(userId, items);
}, [items, userId]);  // Se ejecuta cada vez que items o userId cambian
```
- Cada vez que el carrito cambia, se guarda automáticamente en localStorage
- Así el carrito persiste si el usuario cierra el navegador

### addItem con useCallback (líneas 77-90)

```tsx
const addItem = useCallback((product: CartItem) => {
  setItems(currentItems => {
    const existingItem = currentItems.find(item => item.id === product.id);
```
- `useCallback`: La función mantiene la misma identidad entre renders
- Sin `useCallback`, cada render crearía una nueva función → todos los `useCart()` re-renderizarían
- `setItems(currentItems => ...)`: Forma funcional de setState — recibe el estado actual como parámetro

```tsx
    if (existingItem) {
      const newQuantity = Math.min(existingItem.quantity + product.quantity, product.stock);
      return currentItems.map(item =>
        item.id === product.id ? { ...item, quantity: newQuantity } : item
      );
    }
```
- Si el producto YA existe: incrementa cantidad pero SIN PASAR del stock
- `Math.min(a, b)`: Elige el menor — evita que quantity > stock
- `.map()`: Crea nuevo array (inmutabilidad de React) — modifica solo el item existente

```tsx
    return [...currentItems, { ...product, quantity: Math.min(product.quantity, product.stock) }];
  });
}, []);  // Sin dependencias — la función nunca cambia
```
- Si NO existe: agrega nuevo item al final
- También respeta el stock máximo
- `[]` vacío: Esta función no depende de nada externo

### removeItem (líneas 93-95)

```tsx
const removeItem = useCallback((productId: string) => {
  setItems(currentItems => currentItems.filter(item => item.id !== productId));
}, []);
```
- `.filter()`: Crea nuevo array excluyendo el item con ese ID
- Patrón inmutable — nunca modifica el array original

### updateQuantity (líneas 98-108)

```tsx
const updateQuantity = useCallback((productId: string, quantity: number) => {
  if (quantity <= 0) {
    setItems(currentItems => currentItems.filter(item => item.id !== productId));
    return;
  }
```
- Si la cantidad es 0 o negativa: elimina el producto (equivalente a removeItem)
- Esto permite usar updateQuantity para eliminar también

```tsx
  setItems(currentItems =>
    currentItems.map(item =>
      item.id === productId ? { ...item, quantity: Math.min(quantity, item.stock) } : item
    )
  );
}, []);
```
- Si cantidad > 0: actualiza respetando stock máximo
- Solo modifica el item con ese productId

### clearCart (líneas 111-113)

```tsx
const clearCart = useCallback(() => {
  setItems([]);
}, []);
```
- Vacía el carrito completamente
- Se usa después de un checkout exitoso

### getItemCount (líneas 116-118)

```tsx
const getItemCount = useCallback(() => {
  return items.reduce((total, item) => total + item.quantity, 0);
}, [items]);  // Depende de items — se recalcula cuando el carrito cambia
```
- `reduce()`: Acumula valores — suma todas las quantities
- `[items]` en dependencias: Se recalcula cuando items cambia (esto es intencional)

### getSubtotal (líneas 121-123)

```tsx
const getSubtotal = useCallback(() => {
  return items.reduce((total, item) => total + (item.price_usd * item.quantity), 0);
}, [items]);
```
- Calcula total: suma de (precio × cantidad) para cada item

### isInCart (líneas 126-128)

```tsx
const isInCart = useCallback((productId: string) => {
  return items.some(item => item.id === productId);
}, [items]);
```
- `.some()`: Retorna `true` si AL MENOS UNO cumple la condición
- Se usa en ProductCard para mostrar "Agregar más" vs "Agregar"

### getItemQuantity (líneas 131-134)

```tsx
const getItemQuantity = useCallback((productId: string) => {
  const item = items.find(item => item.id === productId);
  return item ? item.quantity : 0;  // 0 si no está en el carrito
}, [items]);
```
- `.find()`: Retorna el primer item que coincide, o undefined
- `item ? item.quantity : 0`: Operador ternario — si existe, retorna cantidad; si no, 0

### Memoización del Context Value (líneas 137-150)

```tsx
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
```
- `useMemo`: Crea un NUEVO objeto solo cuando alguna dependencia cambia
- Sin esto, cada render crearía `{ items, addItem, ... }` nuevo → TODOS los consumidores re-renderizarían
- **Este es el truco clave de rendimiento:** `useCallback` en las funciones + `useMemo` en el objeto

```tsx
return (
  <CartContext.Provider value={contextValue}>
    {children}
  </CartContext.Provider>
);
```
- Provee el valor memoizado a todos los hijos
- Los hijos que usan `useCart()` reciben este objeto

### useCart Hook (líneas 155-161)

```tsx
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart debe usarse dentro de un CartProvider');
  }
  return context;
}
```
- Hook personalizado para LEER el contexto fácilmente
- `useContext(CartContext)`: Obtiene el valor del provider más cercano
- Si es `undefined`: alguien olvidó envolver su componente en `<CartProvider>`
- El error es intencional — es mejor fallar rápido que tener bugs silenciosos

---

### Conceptos Clave para Defender

1. **Context API**: Patrón de React para estado global sin "prop drilling"
2. **useCallback**: Memoiza funciones para evitar re-renders innecesarios en consumidores
3. **useMemo**: Memoiza el objeto del context value — solo cambia cuando las dependencias cambian
4. **Inmutabilidad**: Nunca modificar items directamente — siempre crear nuevo array con map/filter/spread
5. **localStorage**: Persistencia del carrito entre sesiones del navegador
6. **Auth-aware**: El carrito cambia según quién está logueado
7. **Stock validation**: Nunca permite agregar más de lo que existe en inventario
