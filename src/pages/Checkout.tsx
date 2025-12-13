import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Check, CreditCard, Truck, Package, 
  User, Mail, Phone, MapPin, Loader2, ShoppingBag 
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
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items, getSubtotal, clearCart } = useCart();
  const { rate, convertToBS } = useExchangeRate();
  const { addSale } = useSales();
  
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

  // Procesar pedido
  const handleSubmitOrder = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Crear una venta por cada item del carrito
      for (const item of items) {
        await addSale({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price_usd: item.price_usd,
          total_usd: item.price_usd * item.quantity,
          total_bs: rate > 0 ? convertToBS(item.price_usd * item.quantity) : null,
          payment_method: paymentMethod,
          client_name: shippingData.fullName,
          client_phone: shippingData.phone,
          is_credit: false,
          notes: `Dirección: ${shippingData.address}, ${shippingData.city}. ${shippingData.notes || ''}`
        });
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
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-10 w-10 text-green-600" />
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
      <div className="container mx-auto px-4 py-6 md:py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-colors">Inicio</Link>
          <span>/</span>
          <Link to="/carrito" className="hover:text-foreground transition-colors">Carrito</Link>
          <span>/</span>
          <span className="text-foreground">Checkout</span>
        </nav>

        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/carrito')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
            Finalizar Compra
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-8">
            {/* Shipping Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Datos de Envío</h2>
                  <p className="text-sm text-muted-foreground">¿A dónde enviamos tu pedido?</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="fullName">Nombre Completo *</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    placeholder="Tu nombre completo"
                    value={shippingData.fullName}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="0412-123-4567"
                    value={shippingData.phone}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email (opcional)</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={shippingData.email}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address">Dirección *</Label>
                  <Input
                    id="address"
                    name="address"
                    placeholder="Calle, número, urbanización..."
                    value={shippingData.address}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="city">Ciudad *</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="Tu ciudad"
                    value={shippingData.city}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="notes">Notas adicionales</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Instrucciones especiales de entrega..."
                    value={shippingData.notes}
                    onChange={handleInputChange}
                    className="mt-1"
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
              className="glass-card rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Método de Pago</h2>
                  <p className="text-sm text-muted-foreground">¿Cómo deseas pagar?</p>
                </div>
              </div>

              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === method.id 
                        ? 'border-accent bg-accent/5' 
                        : 'border-border hover:border-border/80'
                    }`}
                  >
                    <RadioGroupItem value={method.id} id={method.id} />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{method.label}</p>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </motion.div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-2xl p-6 sticky top-24">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Tu Pedido
              </h2>

              {/* Items */}
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary/30 flex-shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Cant: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      ${(item.price_usd * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Envío</span>
                  <span className="text-muted-foreground">Por coordinar</span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-semibold text-foreground">Total</span>
                <span className="text-2xl font-bold text-accent">
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              {rate > 0 && (
                <p className="text-right text-muted-foreground text-sm mb-6">
                  Bs. {convertToBS(subtotal).toFixed(2)}
                </p>
              )}

              <Button 
                size="lg" 
                className="w-full btn-gold"
                disabled={!isShippingValid || loading}
                onClick={handleSubmitOrder}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Confirmar Pedido
                  </>
                )}
              </Button>

              {!isShippingValid && (
                <p className="text-xs text-destructive text-center mt-2">
                  Completa todos los campos requeridos (*)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
