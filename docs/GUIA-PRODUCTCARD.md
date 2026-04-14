# Guía de Estudio: ProductCard.tsx
## Tarjeta de Producto — Componente de Alto Rendimiento

### ¿Qué es este archivo?
Es la tarjeta que representa cada producto en el storefront y catálogo. Es un componente **memoizado** para evitar re-renders innecesarios.

---

### Imports (líneas 1-13)

```tsx
import { useState, useMemo, memo } from 'react';
```
- `useState`: Para estado local (isAdding, isHovered)
- `useMemo`: **OPTIMIZACIÓN** — memoiza el cálculo del precio en Bs.
- `memo`: **OPTIMIZACIÓN** — envuelve el componente para que solo re-renderice si sus props cambian

```tsx
import { motion, AnimatePresence } from 'framer-motion';
```
- `motion`: Componentes animados (entrada de la tarjeta, hover effects)
- `AnimatePresence`: Para animar la transición del badge "en carrito"

```tsx
import { ShoppingBag, Eye, Check, Package, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from 'sonner';
import { PublicProduct } from '@/hooks/usePublicProducts';
import { AutoProductLabels } from '@/components/products/ProductLabelBadge';
```
- `AutoProductLabels`: Etiquetas automáticas (Bestseller, Low Stock, New)
- `toast` de `sonner`: Sistema de notificaciones (diferente del `use-toast` nativo)

### Props del Componente (líneas 15-20)

```tsx
interface ProductCardProps {
  product: PublicProduct;     // Datos del producto a mostrar
  index?: number;             // Índice en la lista (para delay de animación)
  allProducts?: PublicProduct[];  // Todos los productos (para calcular etiquetas relativas)
}
```
- `allProducts` se usa para calcular si un producto es "bestseller" relativo a los demás

### Declaración Memoizada (líneas 22-33)

```tsx
export const ProductCard = memo(function ProductCard({ product, index = 0, allProducts }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { addItem, isInCart, getItemQuantity } = useCart();
  const { rate, convertToBS } = useExchangeRate();
```
- `memo(...)`: Solo re-renderiza si `product`, `index` o `allProducts` cambian
- Sin `memo`, cada vez que el padre re-renderiza (ej: agregar otro producto al carrito), TODAS las tarjetas se re-renderizan
- `isAdding`: Estado temporal para la animación de "check" al agregar al carrito
- `isHovered`: Controla si el mouse está sobre la tarjeta (para mostrar overlay)

```tsx
  const inCart = isInCart(product.id);
  const cartQuantity = getItemQuantity(product.id);
  const remainingStock = product.stock - cartQuantity;
  const canAdd = remainingStock > 0;
```
- `inCart`: ¿Este producto ya está en el carrito?
- `cartQuantity`: ¿Cuántas unidades hay en el carrito?
- `remainingStock`: Stock restante después de lo que ya está en el carrito
- `canAdd`: ¿Se puede agregar al menos 1 más?

```tsx
  const bsPrice = useMemo(() => convertToBS(product.price_usd), [product.price_usd, rate]);
```
- **Memoización clave**: El cálculo de precio en Bs. solo se ejecuta si:
  1. El precio del producto cambia, O
  2. La tasa de cambio BCV se actualiza
- Sin `useMemo`, se calcularía en CADA render (aunque el precio no haya cambiado)

### handleAddToCart (líneas 35-62)

```tsx
const handleAddToCart = (e: React.MouseEvent) => {
  e.preventDefault();    // Previene comportamiento default del button
  e.stopPropagation();   // Previene que el clic burbujee al Link (no navegar al producto)
```
- **`stopPropagation` es CRÍTICO**: Sin esto, al hacer clic en "Agregar", también navegaría al detalle del producto
- El botón está dentro de un `<Link>` — el clic se propagaría al padre

```tsx
  if (!canAdd) {
    toast.error('Sin stock disponible', {
      description: 'Ya tienes el máximo disponible en tu carrito'
    });
    return;
  }
```
- Si no hay stock restante: muestra error y SALE — no agrega al carrito

```tsx
  setIsAdding(true);  // Activa animación de "check"

  const cartItem: CartItem = {
    id: product.id,
    name: product.name,
    price_usd: product.price_usd,
    quantity: 1,
    image_url: product.image_url,
    stock: product.stock
  };

  addItem(cartItem);  // Agrega al contexto del carrito
```
- Construye el `CartItem` con los campos que espera CartContext
- Solo agrega cantidad 1 (el usuario puede ajustar en el carrito)

```tsx
  toast.success('¡Agregado al carrito!', {
    description: product.name,
    icon: <Sparkles className="h-4 w-4 text-gold" />
  });

  setTimeout(() => setIsAdding(false), 600);  // Desactiva animación después de 600ms
};
```
- Notificación de éxito con icono de Sparkles (estrella)
- `setTimeout`: Después de 600ms, vuelve al estado normal (el botón muestra "Agregar más")

### Render — Motion Wrapper Exterior (líneas 64-76)

```tsx
return (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{
      duration: 0.5,
      delay: index * 0.08,  // Stagger: cada tarjeta aparece 80ms después de la anterior
      ease: [0.25, 0.46, 0.45, 0.94]  // Curva de animación personalizada (ease-out suave)
    }}
    onMouseEnter={() => setIsHovered(true)}
    onMouseLeave={() => setIsHovered(false)}
  >
```
- Entrada: fade in + slide up desde 30px abajo
- `delay: index * 0.08`: La tarjeta 0 aparece inmediatamente, la 1 a los 80ms, la 2 a los 160ms, etc.
- `ease: [0.25, 0.46, 0.45, 0.94]`: Curva Bézier personalizada — entrada suave y natural

### Link y Motion Wrapper Interior (líneas 77-93)

```tsx
<Link to={`/producto/${product.id}`} className="block group">
  <motion.div
    className="rounded-2xl overflow-hidden relative bg-card backdrop-blur-sm border border-border/10"
    whileHover={{ y: -8 }}  // Al hacer hover, sube 8px
    transition={{ duration: 0.35, ease: 'easeOut' }}
    style={{
      boxShadow: isHovered
        ? '0 24px 60px -12px hsl(var(--rose) / 0.2), 0 0 0 1px hsl(var(--rose) / 0.1)'
        : '0 4px 24px 0 hsl(var(--rose) / 0.06)'
    }}
  >
```
- `whileHover={{ y: -8 }}`: Framer Motion mueve la tarjeta hacia arriba en hover
- `style={{ boxShadow }}`: Sombra dinámica — más pronunciada en hover con borde rose
- **Nota**: El inline style de boxShadow fuerza a React a recalcular en cada evento de mouse. Funciona pero no es óptimo para performance extrema.

### Imagen del Producto (líneas 95-108)

```tsx
<div className="relative aspect-[3/4] bg-secondary overflow-hidden">
  {product.image_url ? (
    <motion.img
      src={product.image_url}
      alt={product.name}
      className="w-full h-full object-contain p-2"
      animate={{ scale: isHovered ? 1.05 : 1 }}  // Zoom sutil en hover
      transition={{ duration: 0.6, ease: 'easeOut' }}
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center">
      <Package className="w-16 h-16 text-muted-foreground/20" />
    </div>
  )}
```
- `aspect-[3/4]`: Proporción portrait (más alto que ancho)
- `object-contain`: La imagen se ajusta sin recortar
- En hover: la imagen hace zoom a 105% (sutil, no exagerado)
- Si no hay imagen: muestra icono de Package como placeholder

### Etiquetas Automáticas (líneas 110-128)

```tsx
<div className="absolute top-3 left-3 flex flex-col gap-1.5">
  <AutoProductLabels
    product={{
      id: product.id,
      sold_count: product.sold_count || 0,
      stock: product.stock,
      created_at: product.created_at,
      price_usd: product.price_usd,
      category: product.category
    }}
    allProducts={allProducts?.map(p => ({ ... }))}
    maxLabels={2}
  />
</div>
```
- Posición absoluta en la esquina superior izquierda de la imagen
- `AutoProductLabels`: Componente que decide qué etiquetas mostrar:
  - **"Bestseller"**: Si tiene muchas ventas relativas
  - **"Low Stock"**: Si stock ≤ 5
  - **"New"**: Si fue creado recientemente
- `maxLabels={2}`: Máximo 2 etiquetas para no saturar

### Overlay al Hover (líneas 130-180)

```tsx
<motion.div
  className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
  initial={{ opacity: 0 }}
  animate={{ opacity: isHovered ? 1 : 0 }}
  transition={{ duration: 0.3 }}
>
```
- Overlay oscuro que aparece en hover — hace legible el texto blanco sobre la imagen
- Gradiente: más oscuro abajo (donde está el contenido), transparente arriba

```tsx
  <motion.div
    className="w-full p-4 space-y-3"
    initial={{ y: 30, opacity: 0 }}
    animate={{ y: isHovered ? 0 : 30, opacity: isHovered ? 1 : 0 }}
    transition={{ duration: 0.35, delay: 0.05 }}
  >
    <h3 className="font-serif text-white">{product.name}</h3>
    <p className="text-gold font-bold">${product.price_usd.toFixed(2)}</p>
    {rate > 0 && <p className="text-white/60 text-xs">Bs. {bsPrice.toFixed(2)}</p>}
```
- Contenido del overlay: nombre del producto + precio
- Animación: slide up desde 30px abajo + fade in
- `delay: 0.05`: Aparece 50ms después del overlay (efecto escalonado)
- `bsPrice`: Usa el valor memoizado — no recalcula

### Botones del Overlay (líneas 182-210)

```tsx
<div className="flex gap-2">
  <Button
    size="sm"
    className="bg-gold/90 hover:bg-gold text-white rounded-full text-xs h-9 btn-shimmer"
    onClick={handleAddToCart}
    disabled={!canAdd || isAdding}
  >
    <AnimatePresence mode="wait">
      {isAdding ? (
        <motion.div key="check" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
          <Check className="h-4 w-4" />
        </motion.div>
      ) : (
        <motion.div key="bag" initial={{ scale: 0 }} animate={{ scale: 1 }}>
          <ShoppingBag className="h-3.5 w-3.5" />
          <span>{inCart ? 'Agregar más' : 'Agregar'}</span>
        </motion.div>
      )}
    </AnimatePresence>
  </Button>
```
- `AnimatePresence mode="wait"`: La animación de "exit" termina antes de que empiece la de "enter"
- Cuando `isAdding` es true: muestra Check con animación de scale + rotate
- Cuando `isAdding` es false: muestra ShoppingBag + texto
- Texto cambia: "Agregar" si no está en carrito, "Agregar más" si ya está
- `btn-shimmer`: Clase CSS con efecto de brillo que barre el botón

```tsx
  <Button
    size="icon"
    className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-full h-9 w-9"
  >
    <Eye className="h-3.5 w-3.5" />
  </Button>
</div>
```
- Botón de "ver detalle" (ojo) — complementario al de agregar al carrito
- Fondo semitransparente con backdrop-blur

### Footer de la Tarjeta (líneas 212-235)

```tsx
<div className="p-3 flex items-center justify-between">
  <div className="flex items-center gap-2">
    <div className={`w-1.5 h-1.5 rounded-full ${
      product.stock > 5 ? 'bg-primary' : product.stock > 0 ? 'bg-gold animate-pulse' : 'bg-destructive'
    }`} />
    <span className="text-[11px] text-muted-foreground/60">
      {product.category || 'General'}
    </span>
  </div>
```
- Indicador de stock con código de color:
  - **Verde (primary)**: Stock saludable (> 5)
  - **Dorado con pulso**: Stock bajo (1-5) — `animate-pulse` llama la atención
  - **Rojo (destructive)**: Sin stock (0)
- Categoría del producto en texto pequeño

```tsx
  <AnimatePresence>
    {inCart && (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        <Badge variant="outline" className="border-gold/30 text-gold/80">
          {cartQuantity} en carrito
        </Badge>
      </motion.div>
    )}
  </AnimatePresence>
```
- Badge que muestra cuántas unidades hay en el carrito
- Solo aparece si `inCart` es true
- Animación spring: rebote elástico (más natural que ease)
- `stiffness: 500, damping: 30`: Parámetros del spring — rápido con rebote sutil

### Cierre del Componente

```tsx
  );
});
```
- El `});` cierra el `memo()` que envuelve toda la función

---

### Conceptos Clave para Defender

1. **React.memo**: Envuelve el componente para que solo re-renderice si los props cambian. Sin esto, agregar un producto al carrito causaría que TODAS las tarjetas se re-rendericen (porque el contexto del carrito cambia).

2. **useMemo para bsPrice**: Evita recalcular la conversión USD→Bs. en cada render. Solo recalcula si el precio o la tasa cambian.

3. **stopPropagation**: El botón "Agregar" está dentro de un `<Link>`. Sin `e.stopPropagation()`, el clic burbujearía al Link y navegaría al producto en lugar de agregar al carrito.

4. **AnimatePresence mode="wait"**: Asegura que la animación de salida del icono anterior termine antes de que entre el nuevo — evita que ambos se muestren simultáneamente.

5. **Stagger animation**: `delay: index * 0.08` crea un efecto cascada — cada tarjeta aparece ligeramente después de la anterior.

6. **Stock-aware cart**: `remainingStock = product.stock - cartQuantity` — no permite agregar más de lo que existe, considerando lo que ya está en el carrito.

7. **Overlay pattern**: El overlay con info aparece solo en hover — mantiene la tarjeta limpia en estado normal, revela info adicional en interacción.
