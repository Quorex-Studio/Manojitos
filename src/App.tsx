// App principal de Manojitos
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/contexts/CartContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";

// Admin Pages - Lazy loaded
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const Sales = lazy(() => import("./pages/Sales"));
const Providers = lazy(() => import("./pages/Providers"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const ImportProducts = lazy(() => import("./pages/ImportProducts"));
const Credits = lazy(() => import("./pages/Credits"));
const BusinessRules = lazy(() => import("./pages/BusinessRules"));
const Customers = lazy(() => import("./pages/Customers"));

// Customer Pages - Lazy loaded
const StoreFront = lazy(() => import("./pages/StoreFront"));
const StoreCatalog = lazy(() => import("./pages/StoreCatalog"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CustomerAuth = lazy(() => import("./pages/CustomerAuth"));
const CustomerProfile = lazy(() => import("./pages/CustomerProfile"));
const CustomerCredit = lazy(() => import("./pages/CustomerCredit"));
const CustomerOrders = lazy(() => import("./pages/CustomerOrders"));
const CustomerWishlist = lazy(() => import("./pages/CustomerWishlist"));
const CustomerNotifications = lazy(() => import("./pages/CustomerNotifications"));
const CustomerSettings = lazy(() => import("./pages/CustomerSettings"));
const CustomerPaymentMethods = lazy(() => import("./pages/CustomerPaymentMethods"));
const CustomerResetPassword = lazy(() => import("./pages/CustomerResetPassword"));

// Info Pages - Lazy loaded
const AboutUs = lazy(() => import("./pages/AboutUs"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const ShippingPolicy = lazy(() => import("./pages/ShippingPolicy"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Atencion = lazy(() => import("./pages/Atencion"));
const FAQ = lazy(() => import("./pages/FAQ"));

const NotFound = lazy(() => import("./pages/NotFound"));
import { Loader, Refresh } from 'reicon-react';


// ErrorBoundary — captura crashes de React y muestra mensaje en vez de pantalla negra
// También maneja el error "Failed to fetch dynamically imported module" que ocurre
// cuando Vercel hace un nuevo deploy y los hashes de los chunks cambian.
import React from "react";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    // Detectar el error de chunk dinámico (nuevo deploy de Vercel)
    const isChunkError =
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed') ||
      error.name === 'ChunkLoadError';

    if (isChunkError) {
      // Guardia anti-loop: solo recargamos UNA vez por sesión
      const reloadKey = 'chunk_reload_attempted';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
        return; // evita el render del error mientras recarga
      }
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8 text-center">
          <p className="text-foreground font-serif text-2xl mb-2">Algo salió mal</p>
          <p className="text-muted-foreground text-sm mb-4">{this.state.error?.message}</p>
          <button
            className="px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm"
            onClick={() => {
              sessionStorage.removeItem('chunk_reload_attempted');
              window.location.href = '/';
            }}
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


const queryClient = new QueryClient();

// Ruta protegida para el panel administrativo (solo admins)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Si no está autenticado, redirigir a login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Si está autenticado pero NO es admin, redirigir a tienda
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Ruta protegida para el portal de cliente (requiere autenticación de cliente)
function CustomerProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Si no está autenticado, redirigir al login de cliente con redirect
  if (!user) {
    const currentPath = window.location.pathname;
    return <Navigate to={`/cliente/auth?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  return <>{children}</>;
}


// Suspense wrapper for lazy routes
function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      {children}
    </Suspense>
  );
}

// Redirige al dashboard si el admin ya está autenticado
function AdminAuthRoute() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Auth />;
}

// Rutas de la aplicación
function AppRoutes() {
  // Solo las rutas protegidas usan loading — las rutas públicas no esperan.
  // Esto evita la pantalla de carga infinita en iOS Safari.
  return (
    <Routes>
      {/* ===== RUTAS PÚBLICAS (CLIENTE) ===== */}
      <Route path="/" element={<LazyPage><StoreFront /></LazyPage>} />
      <Route path="/tienda" element={<LazyPage><StoreCatalog /></LazyPage>} />
      <Route path="/producto/:id" element={<LazyPage><ProductDetail /></LazyPage>} />
      <Route path="/carrito" element={<LazyPage><Cart /></LazyPage>} />
      <Route path="/checkout" element={<LazyPage><Checkout /></LazyPage>} />
      <Route path="/cliente/auth" element={<LazyPage><CustomerAuth /></LazyPage>} />
      <Route path="/cliente/recuperar" element={<LazyPage><CustomerResetPassword /></LazyPage>} />
      <Route path="/cliente/perfil" element={<LazyPage><CustomerProtectedRoute><CustomerProfile /></CustomerProtectedRoute></LazyPage>} />
      <Route path="/cliente/credito" element={<LazyPage><CustomerProtectedRoute><CustomerCredit /></CustomerProtectedRoute></LazyPage>} />
      <Route path="/cliente/pedidos" element={<LazyPage><CustomerProtectedRoute><CustomerOrders /></CustomerProtectedRoute></LazyPage>} />
      <Route path="/cliente/favoritos" element={<LazyPage><CustomerProtectedRoute><CustomerWishlist /></CustomerProtectedRoute></LazyPage>} />
      <Route path="/cliente/notificaciones" element={<LazyPage><CustomerProtectedRoute><CustomerNotifications /></CustomerProtectedRoute></LazyPage>} />
      <Route path="/cliente/configuracion" element={<LazyPage><CustomerProtectedRoute><CustomerSettings /></CustomerProtectedRoute></LazyPage>} />
      <Route path="/cliente/metodos-pago" element={<LazyPage><CustomerProtectedRoute><CustomerPaymentMethods /></CustomerProtectedRoute></LazyPage>} />

      {/* ===== RUTAS INFORMATIVAS ===== */}
      <Route path="/atencion" element={<LazyPage><Atencion /></LazyPage>} />
      <Route path="/nosotros" element={<LazyPage><AboutUs /></LazyPage>} />
      <Route path="/terminos" element={<LazyPage><TermsAndConditions /></LazyPage>} />
      <Route path="/envios" element={<LazyPage><ShippingPolicy /></LazyPage>} />
      <Route path="/faq" element={<LazyPage><FAQ /></LazyPage>} />
      <Route path="/privacidad" element={<LazyPage><PrivacyPolicy /></LazyPage>} />

      {/* ===== RUTAS ADMIN ===== */}
      <Route path="/auth" element={<LazyPage><AdminAuthRoute /></LazyPage>} />
      <Route path="/dashboard" element={<LazyPage><ProtectedRoute><Dashboard /></ProtectedRoute></LazyPage>} />
      <Route path="/dashboard/clientes" element={<LazyPage><ProtectedRoute><Customers /></ProtectedRoute></LazyPage>} />
      <Route path="/products" element={<LazyPage><ProtectedRoute><Products /></ProtectedRoute></LazyPage>} />
      <Route path="/sales" element={<LazyPage><ProtectedRoute><Sales /></ProtectedRoute></LazyPage>} />
      <Route path="/credits" element={<LazyPage><ProtectedRoute><Credits /></ProtectedRoute></LazyPage>} />
      <Route path="/providers" element={<LazyPage><ProtectedRoute><Providers /></ProtectedRoute></LazyPage>} />
      <Route path="/reports" element={<LazyPage><ProtectedRoute><Reports /></ProtectedRoute></LazyPage>} />
      <Route path="/settings" element={<LazyPage><ProtectedRoute><Settings /></ProtectedRoute></LazyPage>} />
      <Route path="/import-products" element={<LazyPage><ProtectedRoute><ImportProducts /></ProtectedRoute></LazyPage>} />
      <Route path="/reglas" element={<LazyPage><ProtectedRoute><BusinessRules /></ProtectedRoute></LazyPage>} />

      {/* 404 */}
      <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
    </Routes>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CurrencyProvider>
          <BrowserRouter>
            <AuthProvider>
              <CartProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <AppRoutes />
                </TooltipProvider>
              </CartProvider>
            </AuthProvider>
          </BrowserRouter>
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);


export default App;
