// App principal de Manojitos - Ángela AI Assistant
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/contexts/CartContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

// Admin Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Debts from "./pages/Debts";
import Providers from "./pages/Providers";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import ImportProducts from "./pages/ImportProducts";
import Credits from "./pages/Credits";
import PriceCalculator from "./pages/PriceCalculator";
import BusinessRules from "./pages/BusinessRules";

// Customer Pages
import StoreFront from "./pages/StoreFront";
import StoreCatalog from "./pages/StoreCatalog";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import CustomerAuth from "./pages/CustomerAuth";
import CustomerProfile from "./pages/CustomerProfile";
import CustomerCredit from "./pages/CustomerCredit";
import CustomerOrders from "./pages/CustomerOrders";
import CustomerWishlist from "./pages/CustomerWishlist";
import CustomerNotifications from "./pages/CustomerNotifications";
import CustomerSettings from "./pages/CustomerSettings";
import CustomerPaymentMethods from "./pages/CustomerPaymentMethods";

// Info Pages
import AboutUs from "./pages/AboutUs";
import TermsAndConditions from "./pages/TermsAndConditions";
import ShippingPolicy from "./pages/ShippingPolicy";
import PrivacyPolicy from "./pages/PrivacyPolicy";

import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import { AngelaChat } from "@/components/ai/AngelaChat";

// ErrorBoundary — captura crashes de React y muestra mensaje en vez de pantalla negra
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
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8 text-center">
          <p className="text-foreground font-serif text-2xl mb-2">Algo salió mal</p>
          <p className="text-muted-foreground text-sm mb-4">{this.state.error?.message}</p>
          <button
            className="px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm"
            onClick={() => window.location.href = '/'}
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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


// Rutas de la aplicación
function AppRoutes() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      {/* ===== RUTAS PÚBLICAS (CLIENTE) ===== */}
      <Route path="/" element={<StoreFront />} />
      <Route path="/tienda" element={<StoreCatalog />} />
      <Route path="/producto/:id" element={<ProductDetail />} />
      <Route path="/carrito" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/cliente/auth" element={<CustomerAuth />} />
      <Route path="/cliente/perfil" element={<CustomerProfile />} />
      <Route path="/cliente/credito" element={<CustomerCredit />} />
      <Route path="/cliente/pedidos" element={<CustomerOrders />} />
      <Route path="/cliente/favoritos" element={<CustomerWishlist />} />
      <Route path="/cliente/notificaciones" element={<CustomerNotifications />} />
      <Route path="/cliente/configuracion" element={<CustomerSettings />} />
      <Route path="/cliente/metodos-pago" element={<CustomerPaymentMethods />} />
      
      {/* ===== RUTAS INFORMATIVAS ===== */}
      <Route path="/nosotros" element={<AboutUs />} />
      <Route path="/terminos" element={<TermsAndConditions />} />
      <Route path="/envios" element={<ShippingPolicy />} />
      <Route path="/privacidad" element={<PrivacyPolicy />} />

      {/* ===== RUTAS ADMIN ===== */}
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
      <Route path="/debts" element={<ProtectedRoute><Debts /></ProtectedRoute>} />
      <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
      <Route path="/providers" element={<ProtectedRoute><Providers /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/import-products" element={<ProtectedRoute><ImportProducts /></ProtectedRoute>} />
      <Route path="/calculadora" element={<ProtectedRoute><PriceCalculator /></ProtectedRoute>} />
      <Route path="/reglas" element={<ProtectedRoute><BusinessRules /></ProtectedRoute>} />
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

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


export default App;
