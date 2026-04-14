# Guía de Estudio: useProducts.tsx y useSales.tsx
## Hooks de TanStack Query (Data Fetching Profesional)

---

# useProducts.tsx

### ¿Qué es este hook?
Gestiona el catálogo de productos del panel de admin. Usa TanStack Query para caché, deduplicación y actualizaciones en tiempo real.

### Imports (líneas 1-14)

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
```
- `useQuery`: Hook para LEER datos del servidor (con caché automático)
- `useMutation`: Hook para ESCRIBIR datos (crear, actualizar, eliminar)
- `useQueryClient`: Acceso al cliente de queries para invalidar caché después de mutaciones
- **¿Por qué TanStack Query?** Evita fetchs duplicados, cachea datos, reintentos automáticos, deduplica requests

```tsx
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { productSchema, validateInput } from '@/lib/validations';
import { Product } from '@/types';
import { useEffect } from 'react';
```
- `supabase`: Cliente para queries a PostgreSQL
- `useAuth`: Para verificar que solo admins carguen productos
- `toast`: Notificaciones de éxito/error
- `productSchema, validateInput`: Validación con Zod antes de enviar a la BD
- `useEffect`: Para suscripción a cambios realtime

### useProducts Hook (líneas 16-34)

```tsx
export function useProducts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
```
- `user`: Solo carga productos si hay usuario logueado (admin)
- `queryClient`: Se usa para invalidar caché después de CRUD

```tsx
const { data: products = [], isLoading, refetch } = useQuery({
  queryKey: ['admin-products'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Product[];
  },
  enabled: !!user,
  staleTime: 1000 * 60 * 2,
  gcTime: 1000 * 60 * 10,
  refetchOnWindowFocus: false,
});
```

#### Desglose de useQuery:

- **`queryKey: ['admin-products']`**: Identificador único del caché. Si dos componentes usan esta key, COMPARTEN los datos
- **`queryFn`**: Función que hace el fetch real. DEBE lanzar error si falla (TanStack Query maneja reintentos)
- **`.from('products').select('*')`**: Query de Supabase — trae TODAS las columnas de la tabla `products`
- **`.order('created_at', { ascending: false })`**: Más recientes primero
- **`enabled: !!user`**: Solo ejecuta la query si hay usuario (`!!` convierte a booleano)
- **`staleTime: 2 minutos`**: Los datos son "frescos" por 2 min. En ese lapso, reusa el caché sin hacer fetch
- **`gcTime: 10 minutos`**: El caché se destruye después de 10 min sin uso (garbage collection)
- **`refetchOnWindowFocus: false`**: NO recarga cuando el usuario vuelve a la pestaña (evita requests innecesarios)
- **`data: products = []`**: Si `data` es undefined (primera carga), usa array vacío

### Mutaciones — addProduct (líneas 35-63)

```tsx
const addProduct = useMutation({
  mutationFn: async (product: Omit<Product, 'id' | 'user_id' | 'sold_count' | 'created_at' | 'updated_at'>) => {
    if (!user) throw new Error('No autenticado');
```
- `useMutation`: Para operaciones que MODIFICAN datos (POST, PUT, DELETE)
- `Omit<Product, ...>`: TypeScript — excluye campos que la BD genera automáticamente
- Si no hay usuario, lanza error (seguridad)

```tsx
    const validated = validateInput(productSchema, product);
```
- Valida los datos contra el esquema Zod antes de enviar a la BD
- Si hay campos inválidos, lanza error y NO hace la request

```tsx
    const { data, error } = await supabase
      .from('products')
      .insert([{
        name: validated.name,
        price_usd: validated.price_usd,
        stock: validated.stock,
        description: validated.description,
        category: validated.category,
        image_url: validated.image_url,
        user_id: user.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },
```
- `.insert([...])`: Inserta nuevo registro en Supabase
- `.select().single()`: Retorna el registro creado (para actualizar la UI)
- `throw error`: TanStack Query detecta el error y lo maneja en `onError`

```tsx
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    toast({ title: 'Éxito', description: 'Producto creado correctamente' });
  },
  onError: (error: Error) => {
    toast({ title: 'Error', description: error.message || 'No se pudo crear el producto', variant: 'destructive' });
  },
});
```
- **`onSuccess`**: Se ejecuta si la mutación fue exitosa
  - `invalidateQueries`: Marca el caché como "viejo" → TanStack Query hace un nuevo fetch automáticamente
  - `toast`: Notificación visual de éxito
- **`onError`**: Se ejecuta si hay error
  - Muestra el mensaje de error al usuario

### updateProduct (líneas 65-85)

```tsx
const updateProduct = useMutation({
  mutationFn: async ({ id, updates }: { id: string; updates: Partial<Product> }) => {
    const validated = productSchema.partial().parse(updates);
```
- `Partial<Product>`: TypeScript — todos los campos son opcionales (solo se envían los que cambian)
- `productSchema.partial().parse()`: Valida solo los campos que se están actualizando

```tsx
    const { data, error } = await supabase
      .from('products')
      .update(validated)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    toast({ title: 'Éxito', description: 'Producto actualizado' });
  },
  onError: (error: Error) => {
    toast({ title: 'Error', description: error.message || 'No se pudo actualizar el producto', variant: 'destructive' });
  },
});
```
- `.update(validated).eq('id', id)`: Actualiza SOLO el registro con ese ID
- Mismo patrón: invalidar caché en onSuccess

### deleteProduct (líneas 87-102)

```tsx
const deleteProduct = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    toast({ title: 'Éxito', description: 'Producto eliminado' });
  },
  onError: (error: Error) => {
    toast({ title: 'Error', description: error.message || 'No se pudo eliminar el producto', variant: 'destructive' });
  },
});
```
- `.delete().eq('id', id)`: Elimina el registro con ese ID
- No necesita `.select()` porque no retorna nada

### Suscripción Realtime (líneas 105-125)

```tsx
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel('products-changes')
    .on(
      'postgres_changes',
      {
        event: '*',        // Cualquier cambio: INSERT, UPDATE, DELETE
        schema: 'public',  // Esquema de PostgreSQL
        table: 'products'  // Tabla a monitorear
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user, queryClient]);
```
- **Suscripción en tiempo real**: Supabase notifica cuando CUALQUIER usuario cambia la tabla `products`
- `event: '*'`: Escucha INSERT, UPDATE y DELETE
- Cuando hay un cambio: invalida el caché → se hace un nuevo fetch → la UI se actualiza automáticamente
- `removeChannel(channel)`: Limpieza al desmontar — evita memory leaks
- **¿Por qué importa?** Si dos admins están editando productos simultáneamente, ambos ven los cambios del otro en tiempo real

### Return del Hook (líneas 127-136)

```tsx
return {
  products,
  loading: isLoading,
  addProduct: addProduct.mutateAsync,
  updateProduct: updateProduct.mutateAsync,
  deleteProduct: deleteProduct.mutateAsync,
  refetch,
};
```
- `mutateAsync`: Versión async de la mutación (retorna Promise) — permite usar `await`
- `refetch`: Función para forzar un re-fetch manual si se necesita

---

# useSales.tsx

### ¿Qué es este hook?
Gestiona ventas y checkout transaccional. Es más complejo porque incluye:
1. CRUD de ventas
2. Checkout transaccional (atómico con RPC de Supabase)
3. Validación de stock previa al checkout
4. Confirmación/cancelación de ventas pendientes

### Imports y Tipos (líneas 1-38)

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
```
- Mismo patrón que useProducts

```tsx
export interface StockValidationError {
  productId: string;
  productName: string;
  requested: number;
  available: number;
}
```
- **Tipo exportado**: Checkout.tsx lo importa para tipar los errores de stock
- Cada error indica: qué producto, cuántos pidió el cliente, cuántos quedan

```tsx
export interface Sale {
  id: string;
  user_id: string;
  product_id: string | null;    // Puede ser null (venta sin producto específico)
  product_name: string;
  quantity: number;
  unit_price_usd: number;
  total_usd: number;
  total_bs: number | null;       // Puede ser null si no se usó tasa BCV
  payment_method: string;
  client_name: string | null;
  client_phone: string | null;
  is_credit: boolean;            // ¿Es venta a crédito?
  notes: string | null;
  status: SaleStatus;            // 'pending' | 'confirmed' | 'cancelled'
  created_at: string;
}
```
- SaleStatus viene de validations.ts
- **`total_bs: number | null`**: Solo se calcula si el checkout proporciona la tasa BCV

### useSales Hook — Query de Ventas (líneas 40-64)

```tsx
export function useSales() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: sales = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(sale => ({
        ...sale,
        status: sale.status as SaleStatus  // Cast porque Supabase lo retorna como string
      })) as Sale[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
```
- Mismo patrón que useProducts
- `status as SaleStatus`: TypeScript no sabe que el string es uno de los valores válidos de SaleStatus
- `|| []`: Si data es null, usa array vacío

### invalidateSales Helper (líneas 66-68)

```tsx
const invalidateSales = () => {
  queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
};
```
- Función reutilizable para invalidar caché de ventas
- Se usa en onSuccess de todas las mutaciones y en la suscripción realtime

### validateStock (líneas 105-137)

```tsx
const validateStock = async (items: CheckoutItem[]): Promise<{ valid: boolean; errors: StockValidationError[] }> => {
  const errors: StockValidationError[] = [];

  for (const item of items) {
    const { data: product, error } = await supabase
      .from('products')
      .select('stock')
      .eq('id', item.id)
      .single();
```
- Verifica el stock de CADA item del carrito ANTES de procesar el checkout
- `.select('stock')`: Solo trae la columna stock (no toda la fila — optimización)

```tsx
    if (error || !product) {
      errors.push({
        productId: item.id,
        productName: item.name,
        requested: item.quantity,
        available: 0,  // Si no se encuentra el producto, asumimos 0 stock
      });
    } else if (product.stock < item.quantity) {
      errors.push({
        productId: item.id,
        productName: item.name,
        requested: item.quantity,
        available: product.stock,
      });
    }
  }

  return { valid: errors.length === 0, errors };
};
```
- Si hay error de query O el producto no existe: asume stock 0
- Si el stock es menor al solicitado: registra el error
- Retorna `{ valid: true/false, errors: [...] }` para que Checkout.tsx muestre los errores al usuario

### processCheckout (líneas 139-217)

```tsx
const processCheckout = async (items: CheckoutItem[], checkoutData: CheckoutData) => {
  if (!user) return { error: new Error('No autenticado'), saleIds: [] as string[] };
```
- `CheckoutItem` y `CheckoutData`: Interfaces locales definidas arriba
- Retorna `{ error, saleIds }` siempre — consistente para el llamador

```tsx
  try {
    // Validar stock antes de procesar
    const { valid, errors } = await validateStock(items);

    if (!valid) {
      const errorMessages = errors.map(
        e => `${e.productName}: solicitaste ${e.requested}, pero solo quedan ${e.available}`
      );
      const errorMessage = `Stock insuficiente:\n${errorMessages.join('\n')}`;

      toast({
        title: 'Stock no disponible',
        description: errorMessage,
        variant: 'destructive',
      });

      return { error: new Error(errorMessage), saleIds: [], stockErrors: errors };
    }
```
- **PASO 1**: Validar stock de todos los items
- Si hay errores: muestra toast detallado y ABORTA el checkout
- El usuario ve exactamente qué productos no tienen stock suficiente
- `stockErrors`: Se pasa para que Checkout.tsx los muestre en la UI

```tsx
    const { data, error } = await (supabase.rpc as unknown as (
      fn: 'process_checkout',
      args: { ... }
    ) => Promise<{ data: CheckoutResponse | null; error: Error | null }>)(
      'process_checkout',
      { items, payment_method: checkoutData.payment_method, ... }
    );
```
- **PASO 2**: Ejecutar el RPC transaccional de Supabase
- `supabase.rpc as unknown as ...`: Cast necesario porque el tipo compuesto `order_item_input[]` no está en los tipos autogenerados
- **¿Por qué RPC?** `process_checkout` es una función SQL que hace TODO en una transacción atómica:
  1. Crea registros en `sales`
  2. Decrementa stock en `products`
  3. Si algo falla, hace ROLLBACK de todo

```tsx
    if (data?.success) {
      toast({ title: 'Éxito', description: 'Pedido procesado correctamente' });
      invalidateSales();
      return { error: null, saleIds: data.sale_ids };
    } else {
      throw new Error('La transacción no se pudo completar');
    }
```
- Si el RPC retorna `success: true`: invalida caché y retorna los IDs de las ventas creadas
- Si retorna `success: false`: lanza error (probablemente stock insuficiente a nivel de BD)

### confirmSale (líneas 68-105)

```tsx
const confirmSale = async (saleId: string) => {
  // 1. Obtener la venta
  const { data: sale, error: fetchError } = await supabase
    .from('sales')
    .select('*')
    .eq('id', saleId)
    .single();

  if (fetchError || !sale) { /* venta no encontrada */ }
  if (sale.status !== 'pending') { /* ya fue procesada */ }
```
- Solo se pueden confirmar ventas en estado `pending`

```tsx
  // 2. Actualizar estado a confirmed
  await supabase.from('sales').update({ status: 'confirmed' }).eq('id', saleId);

  // 3. Actualizar stock del producto
  if (sale.product_id) {
    const { data: product } = await supabase
      .from('products')
      .select('stock, sold_count')
      .eq('id', sale.product_id)
      .single();

    await supabase.from('products').update({
      stock: Math.max(0, product.stock - sale.quantity),
      sold_count: product.sold_count + sale.quantity
    }).eq('id', sale.product_id);
  }
```
- **PASO 1**: Cambiar estado a `confirmed`
- **PASO 2**: Decrementar stock del producto (sin bajar de 0 con `Math.max`)
- **PASO 3**: Incrementar contador de vendidos
- **¿Diferencia con process_checkout?** Este es manual (un paso a la vez), process_checkout es transaccional

### deleteSale con useMutation (líneas 219-235)

```tsx
const deleteSale = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => {
    invalidateSales();
    toast({ title: 'Éxito', description: 'Venta eliminada' });
  },
  onError: (error: Error) => {
    toast({ title: 'Error', description: error.message || 'No se pudo eliminar la venta', variant: 'destructive' });
  },
});
```
- Mismo patrón que useProducts.deleteProduct

### Suscripción Realtime (líneas 238-252)

```tsx
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel('sales-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' },
      () => { invalidateSales(); }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [user, queryClient]);
```
- Mismo patrón que useProducts — escucha cambios en la tabla `sales`
- Cuando hay cambio: invalida caché → se refrescan las ventas automáticamente

### Return del Hook (líneas 254-265)

```tsx
return {
  sales,
  loading: isLoading,
  addSale,
  confirmSale,
  cancelSale,
  processCheckout,
  validateStock,
  deleteSale: deleteSale.mutateAsync,
  refetch,
};
```
- `addSale` y `confirmSale` son funciones async normales (no mutations de TanStack Query)
- `deleteSale.mutateAsync`: Es useMutation — retorna Promise

---

### Conceptos Clave para Defender

1. **TanStack Query vs fetch manual**:
   - Caché automático (evita requests duplicados)
   - Deduplicación (si 2 componentes piden los mismos datos, hace 1 request)
   - Reintentos automáticos en errores de red
   - Invalidación de caché (after mutations, refetch automático)

2. **useQuery vs useMutation**:
   - `useQuery`: Para leer datos (GET) — se ejecuta automáticamente
   - `useMutation`: Para modificar datos (POST/PUT/DELETE) — se ejecuta manualmente con `.mutate()` o `.mutateAsync()`

3. **queryKey**: Identificador del caché. Mismo key = mismos datos compartidos

4. **staleTime / gcTime**:
   - `staleTime`: Cuánto tiempo los datos son "frescos" (no se hace re-fetch)
   - `gcTime`: Cuánto tiempo se guarda el caché sin uso (garbage collection)

5. **invalidateQueries**: Marca datos como "viejos" → trigger re-fetch automático

6. **Supabase Realtime**: WebSocket que notifica cambios en tablas — permite UI colaborativa

7. **process_checkout (RPC atómico)**: Todo o nada. Si algo falla, rollback completo.

8. **validateStock (pre-checkout)**: Verificación client-side ANTES de llamar al RPC — feedback inmediato al usuario
