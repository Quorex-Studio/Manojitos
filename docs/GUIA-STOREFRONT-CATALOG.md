# Guía de Estudio: StoreFront.tsx y StoreCatalog.tsx
## Páginas Principales del Storefront

---

# StoreFront.tsx — Homepage

### ¿Qué es este archivo?
La página principal de la tienda. Muestra: hero editorial, productos destacados, categorías, beneficios y CTA.

### Estructura General

```tsx
export default function StoreFront() {
  const { products, loading } = usePublicProducts();
  const { cartCount } = useCart();  // Solo si se usa

  const featuredProducts = products.slice(0, 8);  // Top 8 productos con stock
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];  // Categorías únicas
```
- `usePublicProducts()`: Hook que trae productos con stock > 0 (usando TanStack Query)
- `featuredProducts`: Primeras 8 productos — se muestran en el homepage
- `categories`: Extrae categorías únicas con `Set` (elimina duplicados)

### Hero Section

```tsx
<section className="relative overflow-hidden min-h-screen flex items-center justify-center grain-overlay isolate">
  <div className="absolute inset-0 bg-[#120A0C]" />  // Fondo negro cálido
```
- `min-h-screen`: Altura mínima = viewport completo
- `grain-overlay`: Clase CSS con textura de ruido (efecto de película)
- `isolate`: Crea un nuevo stacking context (evita que los hijos se mezclen con z-index de fuera)
- `bg-[#120A0C]`: Color personalizado (negro cálido, no negro puro)

### Orbs Decorativos (OPTIMIZADOS)

```tsx
<div className="absolute top-20 right-10 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[150px] animate-orb-1" />
<div className="absolute bottom-20 left-10 w-[600px] h-[600px] bg-gold/15 rounded-full blur-[180px] animate-orb-2" />
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-rose-dark/10 rounded-full blur-[120px] animate-orb-3" />
```
- **ANTES**: Eran `motion.div` con framer-motion en loop infinito — costoso para la GPU
- **AHORA**: Son `<div>` normales con animaciones CSS (`animate-orb-1`, etc.)
- Las animaciones CSS usan `will-change: transform, opacity` — el navegador las delega al compositor GPU
- `blur-[150px]`: Desenfoque masivo — crea el efecto de "orbe de luz" difusa

### Headline con Staggered Animation

```tsx
<motion.h1 variants={containerVariants} initial="hidden" animate="show">
  <motion.span variants={wordVariants}>Elegancia que</motion.span>
  <motion.span variants={wordVariants}>inspira</motion.span>
  <motion.span variants={wordVariants}>a toda Venezuela</motion.span>
</motion.h1>
```
- `variants`: Objetos que definen estados de animación
- `containerVariants`: Coordina las animaciones de los hijos
- `wordVariants`: Cada línea aparece con un delay — efecto cascada
- **Resultado**: El título aparece línea por línea, no todo de golpe

### CTA Section con Imagen de Fondo

```tsx
<section className="relative bg-[url(...)] bg-cover bg-center">
  <div className="absolute inset-0 bg-black/50" />  // Overlay oscuro para legibilidad
  <div className="relative z-10">
    <h2>Descubre Nuestra Colección</h2>
    <Link to="/tienda"><Button>Explorar Tienda</Button></Link>
  </div>
</section>
```
- Imagen de fondo con overlay semitransparente
- `z-10`: El contenido está POR ENCIMA del overlay (que tiene z-index implícito de apilamiento)

---

# StoreCatalog.tsx — Catálogo Completo

### ¿Qué es este archivo?
El catálogo completo con búsqueda, filtros por categoría, rango de precios, ordenamiento y cambio de vista.

### useDebounce Hook (líneas 19-32)

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => { clearTimeout(handler); };
  }, [value, delay]);

  return debouncedValue;
}
```
- **Qué hace**: Retorna una versión "retrasada" del valor
- **Cómo funciona**: Cada vez que `value` cambia, programa un timeout. Si `value` cambia de nuevo antes del timeout, cancela el anterior y programa uno nuevo
- **Resultado**: Solo actualiza `debouncedValue` cuando el usuario deja de escribir por `delay` milisegundos
- **Tipo genérico `<T>`**: Funciona con cualquier tipo (string, number, object)

### Estado de Filtros (líneas 35-50)

```tsx
const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
const debouncedSearch = useDebounce(searchQuery, 300);
const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
  const cat = searchParams.get('category');
  return cat ? [cat] : [];
});
const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
const [sortBy, setSortBy] = useState('newest');
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
```
- `searchParams.get('search')`: Lee el parámetro URL — permite compartir búsquedas
- `debouncedSearch`: Valor con 300ms de retraso — se usa para filtrar (no searchQuery directamente)
- `useState(() => ...)`: "Lazy initializer" — solo calcula la primera vez, no en cada render
- `viewMode`: 'grid' (tarjetas) o 'list' (lista vertical)

### Cálculo de maxPrice (líneas 53-60)

```tsx
const maxPrice = useMemo(() => {
  if (products.length === 0) return 1000;
  return Math.ceil(Math.max(...products.map(p => p.price_usd)) / 10) * 10;
}, [products]);
```
- `Math.max(...products.map(...))`: Encuentra el precio más alto
- `Math.ceil(.../ 10) * 10`: Redondea hacia arriba al múltiplo de 10 más cercano
- **Ejemplo**: Si el más caro es $87 → maxPrice = 90
- `useMemo`: Solo recalcula cuando products cambia

### filteredProducts — Lógica Central (líneas 63-95)

```tsx
const filteredProducts = useMemo(() => {
  let result = [...products];  // Copia del array original (inmutabilidad)
```
- `[...products]`: Spread — crea nueva copia para no mutar el original

```tsx
  if (debouncedSearch.trim()) {
    const query = debouncedSearch.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    );
  }
```
- **Búsqueda**: Filtra por nombre, descripción o categoría
- `.toLowerCase()`: Búsqueda case-insensitive
- `?.`: Optional chaining — si description o category son null, no crashea

```tsx
  if (selectedCategories.length > 0) {
    result = result.filter(p => p.category && selectedCategories.includes(p.category));
  }
```
- **Filtro por categorías**: Solo productos en las categorías seleccionadas
- `.includes()`: Verifica si la categoría del producto está en el array de seleccionadas

```tsx
  result = result.filter(p => p.price_usd >= priceRange[0] && p.price_usd <= priceRange[1]);
```
- **Filtro por precio**: Solo productos dentro del rango seleccionado

```tsx
  switch (sortBy) {
    case 'newest': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    case 'price_asc': result.sort((a, b) => a.price_usd - b.price_usd); break;
    case 'price_desc': result.sort((a, b) => b.price_usd - a.price_usd); break;
    case 'name': result.sort((a, b) => a.name.localeCompare(b.name)); break;
  }
```
- **Ordenamiento**:
  - `newest`: Más reciente primero (compara timestamps)
  - `price_asc`: Menor a mayor precio
  - `price_desc`: Mayor a menor precio
  - `name`: Alfabético (`localeCompare` maneja acentos y ñ correctamente)

```tsx
  return result;
}, [products, debouncedSearch, selectedCategories, priceRange, sortBy]);
```
- **Dependencias**: Se recalcula cuando CUALQUIERA de estos cambia
- Nota: usa `debouncedSearch`, NO `searchQuery` — esto evita recalcular en cada keystroke

### Render — Filtros (Desktop Sidebar + Mobile Sheet)

```tsx
{/* Desktop: Sidebar lateral */}
<div className="hidden lg:block w-64 shrink-0">
  <FiltersContent ... />
</div>

{/* Mobile: Sheet deslizable */}
<Sheet open={showFilters} onOpenChange={setShowFilters}>
  <SheetContent side="left">
    <FiltersContent ... />
  </SheetContent>
</Sheet>
```
- **Desktop**: Sidebar fija de 256px (`w-64`)
- **Mobile**: Sheet (panel deslizante) que se abre con un botón
- `FiltersContent`: Mismo componente reutilizado en ambos lugares

### Render — Grid de Productos

```tsx
<div className={`grid gap-6 ${viewMode === 'grid'
  ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  : 'grid-cols-1'
}`}>
  <AnimatePresence mode="popLayout">
    {filteredProducts.map((product, index) => (
      <ProductCard key={product.id} product={product} index={index} allProducts={products} />
    ))}
  </AnimatePresence>
</div>
```
- `viewMode === 'grid'`: 2-3-4 columnas responsive
- `viewMode === 'list'`: 1 columna (lista vertical)
- `AnimatePresence mode="popLayout"`: Cuando los productos cambian (filtro), los que salen se animan fuera y los nuevos entran
- `key={product.id}: La clave es el ID (no el índice) — React usa esto para identificar qué items cambiaron realmente

### Skeleton Loading

```tsx
{loading ? (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
    {Array.from({ length: 8 }).map((_, i) => (
      <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
    ))}
  </div>
) : (
  /* Productos reales */
)}
```
- Mientras carga: muestra 8 skeletons en la misma disposición del grid
- `aspect-[3/4]`: Misma proporción que las tarjetas reales — evita layout shift

---

### Conceptos Clave para Defender

1. **Debounce**: Retrasa la ejecución del filtro hasta que el usuario deja de escribir. Sin esto, cada keystroke causaría un re-filter de todos los productos — perceptible como lag al escribir rápido.

2. **useMemo con dependencias correctas**: `filteredProducts` solo se recalcula cuando cambian las dependencias reales. Si usáramos `searchQuery` en vez de `debouncedSearch`, se recalcularía 4 veces por segundo mientras el usuario escribe.

3. **Inmutabilidad en filtros**: `[...products]` crea copia nueva. `filter()` y `sort()` retornan nuevos arrays. Nunca se modifica el original.

4. **AnimatePresence mode="popLayout"**: Cuando se filtra, los productos que desaparecen se animan fuera y los nuevos aparecen en su lugar — sin "saltos" visuales.

5. **Lazy initializer en useState**: `useState(() => expensiveComputation())` solo ejecuta la computación una vez. Sin `() =>`, se ejecutaría en cada render.

6. **Set para categorías únicas**: `new Set(...)` elimina duplicados automáticamente. `Set` es una colección de valores únicos en JavaScript.

7. **CSS animations vs Framer Motion**: Los orbs decorativos usan CSS `@keyframes` en vez de framer-motion porque las animaciones CSS son manejadas por el compositor GPU (más eficiente para loops infinitos con blur).
