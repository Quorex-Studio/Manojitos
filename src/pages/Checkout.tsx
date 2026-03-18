import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Check, CreditCard, Truck, Package,
  User, Mail, Phone, MapPin, Loader2, ShoppingBag, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { StoreLayout } from '@/components/store/StoreLayout';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useSales } from '@/hooks/useSales';
import { toast } from '@/hooks/use-toast';

// Métodos de pago disponibles
const paymentMethods = [
  { id: 'pago_movil', label: 'Pago Móvil', description: 'Pago instantáneo desde tu banco' },
  { id: 'zelle', label: 'Zelle', description: 'Transferencia en dólares' },
  { id: 'transferencia', label: 'Transferencia Bancaria', description: 'Transferencia nacional' },
  { id: 'efectivo_usd', label: 'Efectivo USD', description: 'Pago en dólares al entregar' },
  { id: 'efectivo_bs', label: 'Efectivo Bs', description: 'Pago en bolívares al entregar' },
];

// Página de checkout
export default function Checkout() {
  // --- STATE ---
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items, getSubtotal, clearCart } = useCart();
  const { rate, convertToBS } = useExchangeRate();
  const { processCheckout } = useSales();

  const [step, setStep] = useState<'auth' | 'shipping' | 'payment' | 'confirm'>('shipping');
  const [loading, setLoading] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  // Datos del formulario
  const [shippingData, setShippingData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    notes: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('pago_movil');

  // --- DERIVED / EFFECTS ---

  const subtotal = getSubtotal();
  const isEmpty = items.length === 0;

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/cliente/auth?redirect=/checkout');
    }
  }, [user, authLoading, navigate]);

  // Redirigir si carrito vacío (y no hay orden completa)
  useEffect(() => {
    if (isEmpty && !orderComplete) {
      navigate('/carrito');
    }
  }, [isEmpty, orderComplete, navigate]);

  // Manejar cambios en el formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setShippingData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // Validar datos de envío
  const isShippingValid = shippingData.fullName.trim() &&
    shippingData.phone.trim() &&
    shippingData.address.trim() &&
    shippingData.city.trim();

  // Procesar pedido con checkout transaccional
  const handleSubmitOrder = async () => {
    if (!user) return;

    setLoading(true);

    try {
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

      if (error) {
        throw error;
      }

      clearCart();
      setOrderComplete(true);
      setStep('confirm');

    } catch (error) {
      toast({
        title: 'Error',
        description: 'Hubo un problema al procesar tu pedido. Intenta de nuevo.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER ---
  if (authLoading) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </StoreLayout>
    );
  }

  // Pantalla de confirmación
  if (orderComplete) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-12 md:py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg mx-auto text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-10 w-10 text-primary" />
            </div>

            <h1 className="text-3xl font-serif font-bold text-foreground mb-4">
              ¡Pedido Confirmado!
            </h1>

            <p className="text-muted-foreground mb-8">
              Tu pedido ha sido registrado exitosamente. Nos pondremos en contacto contigo
              pronto para coordinar el pago y envío.
            </p>

            <div className="glass-card rounded-2xl p-6 mb-8 text-left">
              <h3 className="font-semibold text-foreground mb-4">Datos del Pedido</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Nombre:</span> {shippingData.fullName}</p>
                <p><span className="text-muted-foreground">Teléfono:</span> {shippingData.phone}</p>
                <p><span className="text-muted-foreground">Dirección:</span> {shippingData.address}, {shippingData.city}</p>
                <p><span className="text-muted-foreground">Método de Pago:</span> {paymentMethods.find(m => m.id === paymentMethod)?.label}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/tienda">
                <Button variant="outline">
                  Seguir Comprando
                </Button>
              </Link>
              <Link to="/">
                <Button className="btn-gold">
                  Volver al Inicio
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-foreground transition-colors">Inicio</Link>
          <span>/</span>
          <Link to="/carrito" className="hover:text-foreground transition-colors">Carrito</Link>
          <span>/</span>
          <span className="text-foreground font-medium">Checkout Seguro</span>
        </nav>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => navigate('/carrito')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground flex items-center gap-3">
                Finalizar Compra
                <span className="flex items-center gap-1 text-xs font-sans font-normal bg-secondary text-foreground px-3 py-1 rounded-full border border-border">
                  <Shield className="h-3 w-3" />
                  Encriptado SSL
                </span>
              </h1>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg text-foreground">Datos de Envío</h2>
                  <p className="text-sm text-muted-foreground">¿A dónde enviamos tu pedido?</p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="fullName" className="text-base">Nombre Completo <span className="text-destructive">*</span></Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    placeholder="Ej: María Pérez"
                    value={shippingData.fullName}
                    onChange={handleInputChange}
                    className="mt-2 h-11 bg-white/50"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-base">Teléfono <span className="text-destructive">*</span></Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="0412-123-4567"
                    value={shippingData.phone}
                    onChange={handleInputChange}
                    className="mt-2 h-11 bg-white/50"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-base">Email (opcional)</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={shippingData.email}
                    onChange={handleInputChange}
                    className="mt-2 h-11 bg-white/50"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address" className="text-base">Dirección Exacta <span className="text-destructive">*</span></Label>
                  <Input
                    id="address"
                    name="address"
                    placeholder="Calle, número, punto de referencia..."
                    value={shippingData.address}
                    onChange={handleInputChange}
                    className="mt-2 h-11 bg-white/50"
                  />
                </div>

                <div>
                  <Label htmlFor="city" className="text-base">Ciudad <span className="text-destructive">*</span></Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="Tu ciudad"
                    value={shippingData.city}
                    onChange={handleInputChange}
                    className="mt-2 h-11 bg-white/50"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="notes" className="text-base">Notas / Instrucciones</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Ej: Dejar en portería, llamar al llegar..."
                    value={shippingData.notes}
                    onChange={handleInputChange}
                    className="mt-2 bg-white/50"
                    rows={3}
                  />
                </div>
              </div>
            </motion.div>

            {/* Payment Method */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-2xl p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg text-foreground">Método de Pago</h2>
                  <p className="text-sm text-muted-foreground">Selecciona tu forma de pago preferida</p>
                </div>
              </div>

              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${paymentMethod === method.id
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                        : 'border-border bg-white/40 hover:bg-white/60'
                      }`}
                  >
                    <RadioGroupItem value={method.id} id={method.id} className="mt-1" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-base">{method.label}</p>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{method.description}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>

              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg justify-center">
                <Shield className="h-3 w-3" />
                Sus datos son tratados confidencialmente y encriptados.
              </div>
            </motion.div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="glass-card-gold rounded-2xl p-6 sticky top-24 shadow-2xl shadow-black/5">
              <h2 className="text-xl font-serif font-bold text-foreground mb-6 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-accent" />
                Resumen del Pedido
              </h2>

              {/* Items */}
              <div className="space-y-4 mb-6 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-border/50 flex-shrink-0 shadow-sm">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-secondary/20">
                          <Package className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">x{item.quantity} unidades</p>
                    </div>
                    <div className="flex flex-col justify-center text-right">
                      <p className="text-sm font-bold text-foreground">
                        ${(item.price_usd * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-6 bg-border/60" />

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-foreground">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Envío</span>
                  <span className="text-accent font-medium">Por coordinar</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-dashed border-border">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-lg font-bold text-foreground">Total a Pagar</span>
                  <span className="text-3xl font-serif font-bold text-accent">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                {rate > 0 && (
                  <p className="text-right text-muted-foreground text-sm">
                    ≈ Bs. {convertToBS(subtotal).toFixed(2)}
                  </p>
                )}
              </div>

              <Button
                size="lg"
                className="w-full btn-gold h-14 text-base mt-6 shadow-xl"
                disabled={!isShippingValid || loading}
                onClick={handleSubmitOrder}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Confirmar Pedido
                    <Check className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>

              {!isShippingValid && (
                <div className="mt-4 p-3 bg-destructive/10 text-destructive text-xs rounded-lg text-center flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                  Por favor completa los campos de envío requeridos
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
