# Guía de Estudio: Arquitectura Completa de Manojitos
## Visión General del Proyecto

---

# Stack Tecnológico

### Frontend
| Tecnología | Versión | ¿Para qué se usa? |
|-----------|---------|-------------------|
| **React** | 18.3 | Framework UI — componentes declarativos |
| **TypeScript** | 5.8 | Tipado estático — previene errores en runtime |
| **Vite** | 5.4 | Build tool — bundling, dev server, optimización |
| **Tailwind CSS** | 3.4 | Estilos utility-first — clases directamente en HTML |
| **shadcn/ui** | latest | Componentes UI reutilizables (botones, dialogs, etc.) |
| **Framer Motion** | 12 | Animaciones declarativas — transiciones y efectos |
| **React Router DOM** | 6.30 | Routing — navegación entre páginas |

### Backend y Data
| Tecnología | ¿Para qué se usa? |
|-----------|-------------------|
| **Supabase** | Backend as a Service — PostgreSQL, Auth, Realtime, Edge Functions |
| **TanStack React Query** | Data fetching — caché, deduplicación, re-fetch automático |
| **Zod** | Validación de datos — esquemas tipados para formularios y APIs |

### UI/UX Extras
| Librería | Uso |
|----------|-----|
| **Recharts** | Gráficos del dashboard (ventas, productos top) |
| **React Hook Form** | Formularios con validación |
| **Sonner** | Notificaciones toast modernas |
| **Lucide React** | Iconos SVG optimizados |
| **Embla Carousel** | Carruseles de productos |
| **canvas-confetti** | Efecto de confetti en celebraciones |
| **DOMPurify** | Sanitización XSS en el chat de Angela AI |
| **next-themes** | Gestión de tema claro/oscuro |
| **date-fns** | Manipulación de fechas |
| **xlsx** | Import/export de Excel |

---

# Estructura del Proyecto

```
src/
├── App.tsx                    # Routing principal + providers
├── main.tsx                   # Punto de entrada (renderiza App en #root)
├── index.css                  # Estilos globales + design tokens + animaciones CSS
├── App.css                    # Estilos específicos de la app
│
├── pages/                     # Páginas (rutas)
│   ├── StoreFront.tsx         # Homepage
│   ├── StoreCatalog.tsx       # Catálogo con filtros
│   ├── ProductDetail.tsx      # Detalle de producto
│   ├── Cart.tsx               # Carrito de compras
│   ├── Checkout.tsx           # Finalizar compra
│   ├── Dashboard.tsx          # Panel de admin
│   ├── Products.tsx           # CRUD de productos (admin)
│   ├── Sales.tsx              # Gestión de ventas (admin)
│   ├── Credits.tsx            # Gestión de créditos (admin)
│   ├── CustomerAuth.tsx       # Login de clientes
│   └── ...                    # Más páginas
│
├── components/
│   ├── ui/                    # Componentes base de shadcn/ui
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── pagination.tsx     # Componente de paginación (nuevo)
│   │   └── ...
│   ├── store/                 # Componentes del storefront
│   │   ├── StoreLayout.tsx    # Layout de la tienda
│   │   ├── ProductCard.tsx    # Tarjeta de producto
│   │   └── StoreHeader.tsx    # Header con carrito
│   ├── ai/                    # Componentes de Angela AI
│   │   ├── AngelaChat.tsx     # Chat flotante de IA
│   │   └── AngelaPersonalShopper.tsx
│   ├── layout/                # Layouts
│   │   ├── AppLayout.tsx      # Layout del admin
│   │   └── AppSidebar.tsx     # Sidebar del admin
│   └── products/              # Componentes de producto
│       └── ProductLabelBadge.tsx
│
├── hooks/                     # Hooks personalizados
│   ├── useAuth.tsx            # Autenticación
│   ├── usePublicProducts.tsx  # Productos públicos (TanStack Query)
│   ├── useProducts.tsx        # Productos admin (TanStack Query)
│   ├── useSales.tsx           # Ventas + checkout (TanStack Query)
│   ├── useCredits.tsx         # Créditos (TanStack Query)
│   ├── useExchangeRate.tsx    # Tasa BCV
│   ├── useClientPagination.ts # Paginación cliente (nuevo)
│   └── ...
│
├── contexts/                  # Context providers
│   ├── CartContext.tsx        # Carrito de compras
│   └── ThemeContext.tsx       # Tema claro/oscuro
│
├── lib/                       # Utilidades
│   ├── utils.ts               # Funciones helper (cn para classNames)
│   └── validations.ts         # Esquemas Zod + validaciones
│
├── types/                     # Tipos TypeScript
│   └── index.ts               # Tipos compartidos
│
└── integrations/
    └── supabase/
        ├── client.ts          # Cliente de Supabase configurado
        └── types.ts           # Tipos autogenerados de la BD
```

---

# Arquitectura de Datos

## Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.tsx                                  │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ QueryClient│  │ AuthProvider │  │     CartProvider         │  │
│  │  (caché)   │  │  (sesión)    │  │   (localStorage + state) │  │
│  └─────┬─────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│        │               │                        │                │
│        ▼               ▼                        ▼                │
│  ┌──────────────┐ ┌──────────┐  ┌──────────────────────────┐    │
│  │ TanStack     │ │ useAuth  │  │     useCart()             │    │
│  │ Query hooks  │ │ context  │  │     addItem               │    │
│  │              │ │ isAdmin  │  │     removeItem            │    │
│  │ useProducts  │ │ signIn   │  │     getSubtotal           │    │
│  │ useSales     │ │ signOut  │  │     ...                   │    │
│  │ useCredits   │ └──────────┘  └──────────────────────────┘    │
│  └──────┬───────┘                              │                │
│         │                                       │                │
│         ▼                                       │                │
│  ┌──────────────┐                               │                │
│  │   Supabase    │◄──────────────────────────────┘                │
│  │   (PostgreSQL)│  Supabase client se usa directamente           │
│  │   Realtime    │  en los hooks para queries y mutations         │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Capas de Estado

### 1. Server State (TanStack Query)
- **Qué gestiona**: Datos que vienen del servidor (productos, ventas, créditos)
- **Cómo funciona**: Caché automático + invalidación después de mutaciones
- **Hooks**: `usePublicProducts`, `useProducts`, `useSales`, `useCredits`
- **Ventaja**: Deduplica requests, evita fetchs duplicados, reintentos automáticos

### 2. Client State (Context API)
- **Qué gestiona**: Datos locales del cliente (carrito, tema)
- **Cómo funciona**: Contexto de React + localStorage para persistencia
- **Contexts**: `CartProvider`, `ThemeProvider`
- **Ventaja**: Acceso global sin prop drilling

### 3. Auth State (Supabase Auth)
- **Qué gestiona**: Sesión de usuario, roles (admin vs cliente)
- **Cómo funciona**: Supabase Auth con persistencia en localStorage
- **Hook**: `useAuth` lee `app_metadata.is_super_admin` para determinar si es admin

---

# Patrones de Diseño Utilizados

## 1. Provider Pattern
```tsx
<QueryClientProvider>
  <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
</QueryClientProvider>
```
Cada provider "inyecta" funcionalidad a todos sus hijos.

## 2. Container/Presentational (implícito)
- **Container**: Hooks como `useProducts` — gestionan data fetching
- **Presentational**: Componentes como `ProductCard` — solo renderizan con props

## 3. Protected Routes
```tsx
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```
Composición de componentes para proteger rutas.

## 4. Custom Hooks
```tsx
// Lógica reutilizable extraída a hooks
const { products, loading, addProduct } = useProducts();
const { items, addItem, getSubtotal } = useCart();
```

## 5. Lazy Loading + Suspense
```tsx
const StoreFront = lazy(() => import("./pages/StoreFront"));
<Route path="/" element={
  <Suspense fallback={<Loader />}>
    <StoreFront />
  </Suspense>
} />
```
Carga diferida de código — solo se descarga la página cuando se navega a ella.

---

# Flujo de Checkout (Transaccional)

```
1. Usuario agrega productos al carrito (CartContext)
   ↓
2. Navega a /checkout
   ↓
3. Si no está autenticado → redirige a /cliente/auth
   ↓
4. Llena datos de envío y selecciona método de pago
   ↓
5. Clic en "Confirmar Pedido"
   ↓
6. validateStock() verifica stock de cada item (client-side)
   │
   ├─ Si hay errores → muestra alerta con lista de productos sin stock
   └─ Si todo OK → continúa
   ↓
7. process_checkout() llama al RPC de Supabase (server-side)
   │
   ├─ Transacción atómica:
   │  a. Crea registros en `sales`
   │  b. Decrementa stock en `products`
   │  c. Si algo falla → ROLLBACK de todo
   │
   └─ Retorna { success, sale_ids }
   ↓
8. Si éxito → clearCart() + muestra confirmación
   Si error → muestra toast de error
```

---

# Sistema de Créditos

```
┌─────────────────────────────────────────────────────┐
│                  Credit System                       │
│                                                      │
│  Credit (cliente)                                    │
│  ├── trust_score: 0-100 (calculado por RPC)         │
│  ├── trust_level: CONFIABLE | RIESGO | CRITICO      │
│  ├── restriction_level: 0-3                         │
│  ├── credit_limit: monto máximo                     │
│  ├── current_balance: deuda actual                  │
│  └── grace_days: días de gracia después del venc.   │
│                                                      │
│  PaymentPromise                                      │
│  ├── promised_amount: monto prometido               │
│  ├── promised_date: fecha prometida                 │
│  ├── status: PENDIENTE | CUMPLIDA | INCUMPLIDA      │
│  └── client_accepted: ¿cliente aceptó?              │
│                                                      │
│  CreditTransaction                                   │
│  ├── type: CARGO | ABONO                            │
│  ├── amount: monto                                  │
│  ├── previous_balance                               │
│  └── new_balance                                    │
└─────────────────────────────────────────────────────┘
```

**Trust Score** se calcula basado en:
- Pagos a tiempo → +5 puntos
- Pagos tarde → -10 - (pagos tarde consecutivos × 5)
- Promesa cumplida → recalcula con RPC
- Promesa incumplida → -15 puntos

**Restricciones progresivas**:
- Nivel 0: Sin restricciones
- Nivel 1: Crédito limitado
- Nivel 2: Solo pago contado
- Nivel 3: Bloqueado

---

# Optimizaciones de Performance Implementadas

| Optimización | Archivo | Impacto |
|-------------|---------|---------|
| **Code Splitting** | App.tsx | 60-80% menos JS inicial |
| **React.memo** | ProductCard.tsx | Elimina re-renders en cascade |
| **useCallback** | CartContext.tsx | Estabiliza funciones del contexto |
| **useMemo** | CartContext, ProductCard | Memoiza valores calculados |
| **Debounce** | StoreCatalog.tsx | Elimina jank al buscar |
| **CSS animations** | StoreFront.tsx, index.css | GPU-composited en vez de JS |
| **TanStack Query cache** | useProducts, useSales | Evita fetchs duplicados |
| **Vite manualChunks** | vite.config.ts | Vendor bundles separados |
| **StaleTime/GcTime** | Hooks de query | Caché inteligente |

---

# Variables de Entorno

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu-clave-publica
```

- Se usan en `src/integrations/supabase/client.ts`
- **NUNCA** hardcodear la URL de Supabase (como estaba en AngelaChat antes)

---

# Conceptos para Defender en Examen

## React
1. **Virtual DOM**: React compara el DOM virtual antes y después del cambio, solo aplica diferencias mínimas al DOM real.
2. **Re-render triggers**: Un componente se re-renderiza cuando su estado cambia, sus props cambian, o su padre se re-renderiza.
3. **Memoización**: `React.memo` evita re-renders si los props no cambian. `useMemo` memoiza valores. `useCallback` memoiza funciones.
4. **Context API**: Mecanismo para compartir estado global sin pasar props por cada nivel.

## TypeScript
5. **Tipado estricto**: `strict: true` habilita null checks, implicit any checks, etc.
6. **Union types**: `string | null` significa "puede ser string O null".
7. **Generics**: `<T>` permite funciones/hooks que trabajan con cualquier tipo.

## TanStack Query
8. **queryKey**: Identificador del caché. Mismo key = mismos datos.
9. **staleTime**: Tiempo antes de considerar datos "viejos".
10. **invalidateQueries**: Marca datos como viejos → trigger re-fetch.
11. **useQuery vs useMutation**: Query para leer (auto), Mutation para escribir (manual).

## Supabase
12. **Realtime**: WebSocket que notifica cambios en tablas.
13. **RPC**: Funciones SQL del lado del servidor — atómicas y seguras.
14. **RLS (Row Level Security)**: Políticas que restringen quién ve qué datos.

## Performance
15. **Code Splitting**: Dividir el bundle en chunks que se cargan bajo demanda.
16. **Debouncing**: Retrasar ejecución hasta que el usuario deje de interactuar.
17. **GPU Composition**: Animaciones CSS con `transform` y `opacity` son más eficientes que animar propiedades que trigger layout.
