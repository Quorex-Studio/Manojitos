# Guía de Estudio: Checkout.tsx
## Flujo de Compra — Finalizar Compra

### ¿Qué es este archivo?
Es la página donde el cliente completa su pedido: ingresa datos de envío, selecciona método de pago y confirma la compra.

---

### Imports (líneas 1-22)

```tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
```
- `useState`: Para estado local (datos del formulario, loading, errores)
- `useEffect`: Para efectos (redirecciones si no hay auth o carrito vacío)
- `Link`: Navegación declarativa (renderiza `<a>`)
- `useNavigate`: Hook para navegar programáticamente (`navigate('/ruta')`)
- `motion`: Componentes animados de Framer Motion
- `AnimatePresence`: Permite animaciones de "exit" cuando un elemento se elimina del DOM

```tsx
import {
  ArrowLeft, Check, CreditCard, Truck, Package,
  User, Mail, Phone, MapPin, Loader2, ShoppingBag, Shield
} from 'lucide-react';
```
- Iconos de Lucide — librería de iconos SVG optimizados

```tsx
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useSales } from '@/hooks/useSales';
import type { StockValidationError } from '@/hooks/useSales';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, X } from 'lucide-react';
```
- `useCart`: Para obtener items del carrito y vaciarlo tras checkout exitoso
- `useAuth`: Para verificar autenticación
- `useExchangeRate`: Para mostrar precios en Bs.
- `useSales`: Para `processCheckout` y `validateStock`
- `StockValidationError`: Tipo importado para tipar los errores de stock
- `Alert, AlertDescription, AlertTitle`: Componentes shadcn/ui para la alerta de errores de stock

### Datos de Pago (líneas 24-30)

```tsx
const paymentMethods = [
  { id: 'pago_movil', label: 'Pago Móvil', description: 'Pago instantáneo desde tu banco' },
  { id: 'zelle', label: 'Zelle', description: 'Transferencia en dólares' },
  { id: 'transferencia', label: 'Transferencia Bancaria', description: 'Transferencia nacional' },
  { id: 'efectivo_usd', label: 'Efectivo USD', description: 'Pago en dólares al entregar' },
  { id: 'efectivo_bs', label: 'Efectivo Bs', description: 'Pago en bolívares al entregar' },
];
```
- Array estático de métodos de pago disponibles en Venezuela
- Cada objeto tiene: `id` (valor del radio button), `label` (texto visible), `description` (explicación)

### Componente Checkout (líneas 32-41)

```tsx
export default function Checkout() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items, getSubtotal, clearCart } = useCart();
  const { rate, convertToBS } = useExchangeRate();
  const { processCheckout, validateStock } = useSales();
  const { toast } = useToast();
```
- `navigate`: Para redirigir tras completar la compra
- `user, authLoading`: Verificar si está autenticado
- `items, getSubtotal, clearCart`: Items del carrito, total, y función para vaciar
- `rate, convertToBS`: Tasa BCV para conversión USD→Bs.
- `processCheckout, validateStock`: Funciones del hook de ventas
- `toast`: Para notificaciones de error

### Estado Local (líneas 42-53)

```tsx
const [step, setStep] = useState<'auth' | 'shipping' | 'payment' | 'confirm'>('shipping');
const [loading, setLoading] = useState(false);
const [orderComplete, setOrderComplete] = useState(false);
const [stockErrors, setStockErrors] = useState<StockValidationError[]>([]);
```
- `step`: Paso actual del checkout (actualmente solo 'shipping' y 'confirm' se usan)
- `loading`: Mientras se procesa el pedido (deshabilita botón, muestra spinner)
- `orderComplete`: Si el pedido ya se completó (muestra pantalla de confirmación)
- `stockErrors`: Errores de stock de `validateStock` — se muestran en alerta visual

### Datos del Formulario (líneas 55-63)

```tsx
const [shippingData, setShippingData] = useState({
  fullName: '',     // Nombre completo del cliente
  phone: '',        // Teléfono de contacto
  email: '',        // Email (opcional)
  address: '',      // Dirección exacta
  city: '',         // Ciudad
  notes: ''         // Notas adicionales (referencia, instrucciones)
});
const [paymentMethod, setPaymentMethod] = useState('pago_movil');
```
- `shippingData`: Objeto con todos los campos del formulario de envío
- `paymentMethod`: Método de pago seleccionado (default: Pago Móvil)

### Valores Derivados (líneas 66-68)

```tsx
const subtotal = getSubtotal();
const isEmpty = items.length === 0;
```
- `subtotal`: Total en USD del carrito (se calcula automáticamente)
- `isEmpty`: Si el carrito está vacío → redirigir

### Efectos de Redirección (líneas 71-81)

```tsx
useEffect(() => {
  if (!authLoading && !user) {
    navigate('/cliente/auth?redirect=/checkout');
  }
}, [user, authLoading, navigate]);
```
- Si no está autenticado Y ya terminó de cargar → redirigir al login de cliente
- `redirect=/checkout`: Después del login, vuelve al checkout

```tsx
useEffect(() => {
  if (isEmpty && !orderComplete) {
    navigate('/carrito');
  }
}, [isEmpty, orderComplete, navigate]);
```
- Si el carrito está vacío Y no hay orden completa → redirigir al carrito
- `!orderComplete`: Evita redirigir cuando se muestra la pantalla de confirmación

### Handlers del Formulario (líneas 84-95)

```tsx
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  setShippingData(prev => ({
    ...prev,
    [e.target.name]: e.target.value
  }));
};
```
- Handler genérico para TODOS los inputs del formulario
- `[e.target.name]`: "Computed property name" — usa el nombre del input como clave del objeto
- `...prev`: Spread — copia los campos existentes y solo actualiza el que cambió

```tsx
const isShippingValid = shippingData.fullName.trim() &&
  shippingData.phone.trim() &&
  shippingData.address.trim() &&
  shippingData.city.trim();
```
- Validación simple: los 4 campos obligatorios deben tener contenido (después de quitar espacios)
- `email` y `notes` son opcionales
- Este valor se usa para habilitar/deshabilitar el botón "Confirmar Pedido"

### handleSubmitOrder — EL NÚCLEO (líneas 98-148)

```tsx
const handleSubmitOrder = async () => {
  if (!user) return;

  setLoading(true);
  setStockErrors([]);  // Limpiar errores anteriores
```
- Solo procede si hay usuario autenticado
- Activa loading state (deshabilita botón, muestra spinner)
- Limpia errores de stock previos

```tsx
  try {
    // PASO 1: Validar stock ANTES de enviar
    const { valid, errors } = await validateStock(
      items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price_usd: item.price_usd
      }))
    );
```
- Convierte los `CartItem` del carrito al formato `CheckoutItem` que espera `validateStock`
- `.map()`: Transforma cada item — solo pasa los campos necesarios (no image_url ni stock)

```tsx
    if (!valid) {
      setStockErrors(errors);  // Guardar errores para mostrar en la UI
      setLoading(false);        // Desactivar loading
      return;                   // ABORTAR — no procesar checkout
    }
```
- Si hay errores de stock: los guarda en estado y SALE de la función
- La UI muestra la alerta con los productos sin stock suficiente

```tsx
    // PASO 2: Procesar checkout transaccional
    const { error, saleIds } = await processCheckout(
      items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price_usd: item.price_usd
      })),
      {
        payment_method: paymentMethod,
        client_name: shippingData.fullName,
        client_phone: shippingData.phone,
        notes: `Dirección: ${shippingData.address}, ${shippingData.city}. ${shippingData.notes || ''}`,
        total_bs_rate: rate > 0 ? rate : undefined
      }
    );
```
- Llama al RPC `process_checkout` de Supabase
- `notes`: Concatena dirección + ciudad + notas opcionales
- `total_bs_rate`: Solo envía la tasa si es mayor a 0 (undefined no se envía)
- **Transaccional**: Todo o nada. Si algo falla, rollback automático

```tsx
    if (error) {
      throw error;  // Salta al catch
    }

    clearCart();           // Vaciar carrito
    setOrderComplete(true); // Mostrar confirmación
    setStep('confirm');     // Cambiar paso
```
- Si no hay error: éxito
- `clearCart()`: Elimina todos los items del carrito (y de localStorage)
- `setOrderComplete(true)`: Activa la pantalla de "¡Pedido Confirmado!"

```tsx
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Hubo un problema al procesar tu pedido. Intenta de nuevo.',
      variant: 'destructive'
    });
  } finally {
    setLoading(false);  // Siempre desactivar loading (éxito o error)
  }
};
```
- `catch`: Muestra toast genérico de error
- `finally`: Se ejecuta SIEMPRE — asegura que loading se desactive

### Render — Pantalla de Carga (líneas 151-158)

```tsx
if (authLoading) {
  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    </StoreLayout>
  );
}
```
- Mientras verifica autenticación: muestra spinner dentro del layout de la tienda

### Render — Confirmación de Pedido (líneas 161-210)

```tsx
if (orderComplete) {
  return (
    <StoreLayout>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <h1>¡Pedido Confirmado!</h1>
        ...
      </motion.div>
    </StoreLayout>
  );
}
```
- Pantalla de éxito con animación de entrada (fade + scale)
- Muestra datos del pedido: nombre, teléfono, dirección, método de pago
- Dos botones: "Seguir Comprando" (va a /tienda) y "Volver al Inicio" (va a /)

### Render — Formulario Principal (líneas 212-250)

```tsx
return (
  <StoreLayout>
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Breadcrumb — navegación jerárquica */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link to="/">Inicio</Link> <span>/</span>
        <Link to="/carrito">Carrito</Link> <span>/</span>
        <span>Checkout Seguro</span>
      </nav>
```
- Breadcrumb: muestra la ruta que el usuario siguió
- Permite volver atrás con un clic

```tsx
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-10">
        <Button onClick={() => navigate('/carrito')}>
          <ArrowLeft />
        </Button>
        <h1>Finalizar Compra <Shield /> Encriptado SSL</h1>
      </div>
```
- Header con botón de "volver al carrito" y badge de seguridad

### Alerta de Errores de Stock (líneas 248-286)

```tsx
<AnimatePresence>
  {stockErrors.length > 0 && (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Stock no disponible</AlertTitle>
        <AlertDescription>
          <ul>
            {stockErrors.map((err) => (
              <li key={err.productId}>
                <span>{err.productName}</span>
                <span>Solicitaste {err.requested}, pero solo quedan {err.available}</span>
              </li>
            ))}
          </ul>
          <p>Ajusta las cantidades en tu carrito o elimina los productos sin stock.</p>
        </AlertDescription>
        <button onClick={() => setStockErrors([])}><X /></button>
      </Alert>
    </motion.div>
  )}
</AnimatePresence>
```
- Solo se muestra si hay errores de stock
- `AnimatePresence`: Permite animación de "exit" cuando se cierra
- Lista cada producto con el problema
- Botón X para cerrar la alerta
- Mensaje guía: el usuario debe ajustar su carrito

### Layout de Dos Columnas (líneas 288-300)

```tsx
<div className="grid lg:grid-cols-3 gap-8 items-start">
  {/* Columna izquierda (2/3) — Formularios */}
  <div className="lg:col-span-2 space-y-6">
    {/* Shipping Info */}
    {/* Payment Method */}
  </div>

  {/* Columna derecha (1/3) — Resumen */}
  <div className="lg:col-span-1">
    {/* Order Summary — sticky */}
  </div>
</div>
```
- Grid de 3 columnas: formulario ocupa 2, resumen ocupa 1
- En móvil (< lg): todo en una columna

### Formulario de Envío (líneas 301-360)

```tsx
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
  <div className="flex items-center gap-3 mb-6 pb-4 border-b">
    <Truck icon />
    <h2>Datos de Envío</h2>
  </div>

  <div className="grid gap-5 md:grid-cols-2">
    <div className="md:col-span-2">
      <Label>Nombre Completo *</Label>
      <Input name="fullName" value={shippingData.fullName} onChange={handleInputChange} />
    </div>
    ...
  </div>
</motion.div>
```
- Animación de entrada (fade + slide up)
- Grid de 2 columnas: campos normales ocupan 1, campos largos (nombre, dirección) ocupan 2
- Cada input usa `name` que coincide con la clave en `shippingData`

### Selector de Método de Pago (líneas 362-400)

```tsx
<RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
  {paymentMethods.map((method) => (
    <label key={method.id} className={`...${paymentMethod === method.id ? 'selected' : 'normal'}`}>
      <RadioGroupItem value={method.id} id={method.id} />
      <div>
        <p>{method.label}</p>
        <p>{method.description}</p>
      </div>
    </label>
  ))}
</RadioGroup>
```
- `RadioGroup`: Componente de shadcn/ui para radio buttons
- `value={paymentMethod}`: Controlado por React
- `onValueChange={setPaymentMethod}`: Actualiza el estado cuando se selecciona otro
- El estilo del label cambia según si está seleccionado o no

### Resumen del Pedido — Sidebar Derecho (líneas 402-460)

```tsx
<div className="glass-card-gold rounded-2xl p-6 sticky top-24 shadow-2xl">
  <h2><ShoppingBag /> Resumen del Pedido</h2>

  {/* Items del carrito */}
  <div className="space-y-4 max-h-80 overflow-y-auto">
    {items.map((item) => (
      <div key={item.id} className="flex gap-4">
        <img src={item.image_url} alt={item.name} />
        <p>{item.name}</p>
        <p>x{item.quantity}</p>
        <p>${(item.price_usd * item.quantity).toFixed(2)}</p>
      </div>
    ))}
  </div>
```
- `sticky top-24`: El resumen se queda fijo al hacer scroll
- `max-h-80 overflow-y-auto`: Si hay muchos items, el área de items tiene scroll interno
- Cada item muestra: imagen, nombre, cantidad, subtotal

```tsx
  <div className="flex justify-between">
    <span>Subtotal</span>
    <span>${subtotal.toFixed(2)}</span>
  </div>
  <div className="flex justify-between">
    <span>Envío</span>
    <span>Por coordinar</span>
  </div>

  <div className="flex justify-between">
    <span>Total a Pagar</span>
    <span>${subtotal.toFixed(2)}</span>
  </div>
  {rate > 0 && <p>≈ Bs. {convertToBS(subtotal).toFixed(2)}</p>}
```
- Desglose del total: subtotal + envío (por coordinar)
- Muestra equivalente en Bs. si la tasa está disponible

### Botón de Confirmar (líneas 462-478)

```tsx
<Button
  size="lg"
  className="w-full btn-gold h-14 text-base mt-6 shadow-xl"
  disabled={!isShippingValid || loading}
  onClick={handleSubmitOrder}
>
  {loading ? (
    <><Loader2 className="animate-spin" /> Procesando...</>
  ) : (
    <>Confirmar Pedido <Check /></>
  )}
</Button>

{!isShippingValid && (
  <div className="bg-destructive/10 text-destructive">
    Por favor completa los campos de envío requeridos
  </div>
)}
```
- `disabled`: Se desactiva si el formulario no es válido O si está procesando
- `btn-gold`: Clase CSS personalizada con gradiente dorado
- Si está loading: muestra spinner + "Procesando..."
- Si no está loading: muestra "Confirmar Pedido"
- Mensaje de advertencia si los campos no están completos

---

### Conceptos Clave para Defender

1. **Validación en dos capas**:
   - Client-side: `validateStock()` antes de enviar — feedback inmediato
   - Server-side: `process_checkout` RPC — transacción atómica con verificación final

2. **UX de errores**: No solo un toast — una alerta visual con lista detallada de productos sin stock

3. **Formulario controlado**: Cada input actualiza un estado de objeto — un solo `handleInputChange` para todos

4. **Sticky sidebar**: El resumen del pedido se queda visible mientras el usuario llena el formulario

5. **Redirecciones defensivas**: Si no hay auth o carrito vacío, redirige automáticamente

6. **clearCart post-checkout**: El carrito se vacía SOLO después de confirmar que el pedido se procesó

7. **Dual pricing**: Siempre muestra USD principal + Bs. equivalente (tasa BCV)
