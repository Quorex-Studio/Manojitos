# Guía de Estudio: App.tsx
## Routing y Arquitectura Principal de Manojitos

### ¿Qué es este archivo?
Este es el corazón de la aplicación. Define TODAS las rutas (URLs) disponibles y cómo se organiza la app a nivel macro.

---

### Importaciones (líneas 1-51)

```tsx
import { Suspense, lazy } from "react";
```
- `Suspense`: Componente de React que muestra un "fallback" (carga) mientras un componente hijo se carga
- `lazy`: Función que permite cargar un componente solo cuando se necesita (code splitting)
- **¿Por qué importa?** Sin esto, TODAS las páginas se cargarían de una vez = app lenta

```tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
```
- Dos sistemas de notificaciones/toasts
- `Toaster`: Sistema nativo de shadcn/ui (para mensajes de formulario)
- `Sonner`: Sistema de notificaciones más moderno (usado por Angela AI)
- El `as Sonner` es necesario porque ambos se llaman `Toaster` — hay que renombrar uno

```tsx
import { TooltipProvider } from "@/components/ui/tooltip";
```
- Proveedor de tooltips (texto que aparece al pasar el mouse sobre elementos)
- Envuelve toda la app para que los tooltips funcionen en cualquier lado

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
```
- `QueryClient`: El "cerebro" de TanStack Query — maneja caché de datos del servidor
- `QueryClientProvider`: Proveedor que hace el cliente disponible en toda la app
- **¿Por qué importa?** Sin esto, los hooks como `useQuery` no funcionarían

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
```
- `BrowserRouter`: Envuelve la app para usar URLs del navegador (no hash routing)
- `Routes`: Contenedor de rutas (solo una coincide a la vez)
- `Route`: Define una ruta individual (path + componente)
- `Navigate`: Redirige a otra ruta programáticamente

```tsx
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/contexts/CartContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
```
- Los 3 "context providers" globales de la app:
  - `AuthProvider`: Gestión sesión de usuario (login/logout/verificar admin)
  - `CartProvider`: Gestión del carrito de compras
  - `ThemeProvider`: Gestión del tema claro/oscuro

### Lazy Loading de Páginas (líneas 13-46)

```tsx
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
// ... etc para cada página
```
- Cada página se importa con `lazy(() => import(...))`
- **¿Qué significa?** El código de cada página se descarga SOLO cuando el usuario navega a esa URL
- **Ejemplo:** Si un usuario nunca va a `/dashboard`, nunca descarga el código del Dashboard
- **Beneficio:** Bundle inicial 60-80% más pequeño

### ErrorBoundary (líneas 52-79)

```tsx
class ErrorBoundary extends React.Component<...> {
```
- Componente de clase (necesario porque `getDerivedStateFromError` solo funciona en clases)
- **¿Qué hace?** Captura errores de React que ocurren en cualquier hijo
- Sin esto, un error dejaría la pantalla en blanco
- Con esto, muestra un mensaje amigable: "Algo salió mal" + botón para volver al inicio

```tsx
static getDerivedStateFromError(error: Error) {
  return { hasError: true, error };
}
```
- Método estático que React llama automáticamente cuando un hijo lanza un error
- Actualiza el estado para activar el render de "algo salió mal"

### QueryClient (línea 82)

```tsx
const queryClient = new QueryClient();
```
- Crea UNA instancia del cliente de TanStack Query
- Esta instancia vive durante toda la vida de la app
- Caché datos de productos, ventas, créditos, etc.

### ProtectedRoute (líneas 85-107)

```tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
```
- Componente que protege rutas de ADMIN
- Verifica 3 cosas del contexto de autenticación:
  1. `loading`: ¿Todavía está verificando sesión? → muestra spinner
  2. `user`: ¿Está autenticado? Si no → redirige a `/auth`
  3. `isAdmin`: ¿Es admin? Si no → redirige a `/` (tienda)

```tsx
if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
```
- Mientras carga la autenticación, muestra spinner centrado
- `min-h-screen`: Altura mínima = toda la pantalla
- `animate-spin`: Animación de rotación de Tailwind

### CustomerProtectedRoute (líneas 109-128)

```tsx
function CustomerProtectedRoute({ children }: { children: React.ReactNode }) {
```
- Similar a `ProtectedRoute` pero para CLIENTES (no admins)
- Solo verifica que el usuario esté autenticado
- Si no está autenticado, redirige a `/cliente/auth` con la ruta original como parámetro `redirect`

```tsx
const currentPath = window.location.pathname;
return <Navigate to={`/cliente/auth?redirect=${encodeURIComponent(currentPath)}`} replace />;
```
- Guarda la URL actual para redirigir después del login
- `encodeURIComponent`: Escapa caracteres especiales en la URL
- `replace`: Reemplaza la entrada en historial (el botón "atrás" no vuelve aquí)

### LazyPage Wrapper (líneas 132-143)

```tsx
function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      {children}
    </Suspense>
  );
}
```
- Envoltorio reutilizable para todas las rutas lazy-loaded
- Muestra spinner mientras la página se carga dinámicamente
- **Patrón:** Evita repetir `<Suspense>` en cada ruta

### AppRoutes - Definición de Rutas (líneas 146-200)

#### Rutas Públicas (líneas 152-157)
```tsx
<Route path="/" element={<LazyPage><StoreFront /></LazyPage>} />
<Route path="/tienda" element={<LazyPage><StoreCatalog /></LazyPage>} />
<Route path="/producto/:id" element={<LazyPage><ProductDetail /></LazyPage>} />
<Route path="/carrito" element={<LazyPage><Cart /></LazyPage>} />
<Route path="/checkout" element={<LazyPage><Checkout /></LazyPage>} />
```
- `/`: Homepage (hero, productos destacados, categorías)
- `/tienda`: Catálogo completo con filtros
- `/producto/:id`: Detalle de un producto (`:id` es parámetro dinámico)
- `/carrito`: Resumen del carrito
- `/checkout`: Finalizar compra (protegido internamente)

#### Rutas de Cliente (líneas 158-164)
```tsx
<Route path="/cliente/auth" element={<LazyPage><CustomerAuth /></LazyPage>} />
<Route path="/cliente/perfil" element={<LazyPage><CustomerProtectedRoute><CustomerProfile /></CustomerProtectedRoute></LazyPage>} />
```
- `/cliente/auth`: Login/registro de clientes (pública)
- Las demás están envueltas en `CustomerProtectedRoute` → requieren login

#### Rutas Informativas (líneas 167-170)
```tsx
<Route path="/nosotros" element={<LazyPage><AboutUs /></LazyPage>} />
<Route path="/terminos" element={<LazyPage><TermsAndConditions /></LazyPage>} />
```
- Páginas estáticas de contenido legal e institucional

#### Rutas de Admin (líneas 173-187)
```tsx
<Route path="/auth" element={<LazyPage>{user ? <Navigate to="/dashboard" replace /> : <Auth />}</LazyPage>} />
<Route path="/dashboard" element={<LazyPage><ProtectedRoute><Dashboard /></ProtectedRoute></LazyPage>} />
```
- `/auth`: Login de admin — si ya está logueado, redirige al dashboard
- Todas las demás envueltas en `ProtectedRoute` → solo admins

#### 404 (línea 190)
```tsx
<Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
```
- `*` captura cualquier URL no definida → muestra página "No encontrado"

### Componente App Principal (líneas 194-210)

```tsx
const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <AppRoutes />
                <AngelaChat />
              </TooltipProvider>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);
```

### Jerarquía de Providers (de afuera hacia adentro):

1. **ErrorBoundary** — Captura errores en cualquier hijo
2. **QueryClientProvider** — Hace TanStack Query disponible
3. **ThemeProvider** — Gestión de tema claro/oscuro
4. **BrowserRouter** — Habilita routing con URLs del navegador
5. **AuthProvider** — Gestión de autenticación
6. **CartProvider** — Gestión del carrito
7. **TooltipProvider** — Habilita tooltips
8. **Toaster + Sonner** — Sistemas de notificaciones
9. **AppRoutes** — Definición de rutas
10. **AngelaChat** — Chat de IA (siempre visible)

### ¿Por qué este orden?
- Los providers de dentro necesitan acceder a los de afuera
- `AuthProvider` debe estar dentro de `BrowserRouter` para poder usar `Navigate`
- `CartProvider` necesita `AuthProvider` para saber el userId
- `AngelaChat` está fuera de Routes para que persista entre navegaciones

---

### Conceptos Clave para Defender

1. **Code Splitting**: La app divide el código en chunks. Cada página es un chunk separado.
2. **Suspense**: Muestra fallback mientras un chunk se descarga.
3. **Protected Routes**: Patrón de composición — el wrapper decide si renderizar hijos o redirigir.
4. **Provider Tree**: Jerarquía de contextos de React, cada provider envuelve a los de abajo.
5. **Error Boundary**: Único mecanismo de React para capturar errores de renderizado.
