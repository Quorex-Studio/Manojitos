import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Check, CreditCard, Truck, Package, Store,
  User, Mail, Phone, MapPin, Loader2, ShoppingBag, Shield,
  Copy, Smartphone, Landmark, Wallet, AlertTriangle, Edit3, Plus
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
import { supabase } from '@/integrations/supabase/client';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useSales } from '@/hooks/useSales';
import type { StockValidationError } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, X } from 'lucide-react';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import { useCustomerPaymentMethods } from '@/hooks/useCustomerPaymentMethods';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { sanitizeText } from '@/lib/validations';
import { formatBS } from '@/lib/utils';

// Métodos de pago base (sin crédito — se agrega dinámicamente)
const BASE_PAYMENT_METHODS = [
  { id: 'pago_movil', label: 'Pago Móvil', description: 'Pago instantáneo desde tu banco' },
  { id: 'zelle', label: 'Zelle', description: 'Transferencia en dólares' },
  { id: 'transferencia', label: 'Transferencia Bancaria', description: 'Transferencia nacional' },
  { id: 'efectivo_usd', label: 'Efectivo USD', description: 'Pago en dólares al entregar' },
  { id: 'efectivo_bs', label: 'Efectivo Bs', description: 'Pago en bolívares al entregar' },
];

// Datos de pago de Manojitos
const PAYMENT_INFO = {
  pagoMovil: {
    ci: '30785117',
    bank: 'Bancamiga',
    phone: '04248780607',
    name: 'Josmaris De Los Ángeles',
  },
  transferencia: {
    bank: 'Banco de Venezuela',
    accountNumber: '01020512310000243896',
    ci: 'V-30785117',
    name: 'Josmaris De Los Ángeles',
  },
  contacto: '+58 426 3863042',
};

// Componente interno: Panel con datos de pago
const PaymentInfoPanel = memo(function PaymentInfoPanel({ method }: { method: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1800);
  };

  if (method !== 'pago_movil' && method !== 'transferencia') return null;

  return (
    <motion.div
      key={method}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="mt-5 rounded-xl border border-accent/30 bg-accent/5 p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        {method === 'pago_movil' ? (
          <Smartphone className="h-4 w-4 text-accent" />
        ) : (
          <Landmark className="h-4 w-4 text-accent" />
        )}
        <p className="text-sm font-bold text-accent uppercase tracking-wide">
          {method === 'pago_movil' ? 'Datos para Pago Móvil' : 'Datos para Transferencia'}
        </p>
      </div>

      {method === 'pago_movil' ? (
        <div className="space-y-2.5">
          {[
            { label: 'Banco', value: PAYMENT_INFO.pagoMovil.bank },
            { label: 'Teléfono', value: PAYMENT_INFO.pagoMovil.phone },
            { label: 'C.I.', value: PAYMENT_INFO.pagoMovil.ci },
            { label: 'Nombre', value: PAYMENT_INFO.pagoMovil.name },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground min-w-[60px]">{label}</span>
              <span className="text-sm font-semibold text-foreground flex-1">{value}</span>
              <button
                onClick={() => copy(value, label)}
                className="text-muted-foreground hover:text-accent transition-colors"
                title="Copiar"
              >
                {copied === label ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {[
            { label: 'Banco', value: PAYMENT_INFO.transferencia.bank },
            { label: 'N° Cuenta', value: PAYMENT_INFO.transferencia.accountNumber },
            { label: 'C.I.', value: PAYMENT_INFO.transferencia.ci },
            { label: 'Nombre', value: PAYMENT_INFO.transferencia.name },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground min-w-[70px]">{label}</span>
              <span className="text-sm font-semibold text-foreground flex-1 break-all">{value}</span>
              <button
                onClick={() => copy(value, label)}
                className="text-muted-foreground hover:text-accent transition-colors"
                title="Copiar"
              >
                {copied === label ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-accent/20 flex items-center gap-2">
        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Contacto:</span>
        <span className="text-xs font-semibold text-foreground">{PAYMENT_INFO.contacto}</span>
        <button
          onClick={() => copy(PAYMENT_INFO.contacto, 'contacto')}
          className="ml-auto text-muted-foreground hover:text-accent transition-colors"
        >
          {copied === 'contacto' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </motion.div>
  );
});

// Página de checkout
export default function Checkout() {
  // --- STATE ---
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items, getSubtotal, clearCart } = useCart();
  const { rate, convertToBS } = useExchangeRate();
  const { processCheckout, validateStock } = useSales();
  const { toast } = useToast();
  const { credit, hasCredit, hasPendingPayments, isLoading: creditLoading } = useCustomerCredit();
  const { preferredMethod, hasPaymentMethods, isLoading: methodsLoading } = useCustomerPaymentMethods();

  const [step, setStep] = useState<'auth' | 'shipping' | 'payment' | 'confirm'>('shipping');
  const [loading, setLoading] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [stockErrors, setStockErrors] = useState<StockValidationError[]>([]);
  const [kycCompleted, setKycCompleted] = useState(false);

  const subtotal = getSubtotal();
  const isEmpty = items.length === 0;

  const [casheaMethod, setCasheaMethod] = useState('pago_movil');
  const [casheaRef, setCasheaRef] = useState('');

  // Estados de pago móvil (método regular)
  const [bancoOrigen, setBancoOrigen] = useState('');
  const [numeroReferencia, setNumeroReferencia] = useState('');

  // Financiamiento Manojitos
  const montoFinanciado = subtotal * 0.50;
  const montoCuota = montoFinanciado / 3;
  const montoInicialTotal = (subtotal * 0.50) + montoCuota;

  const isCreditBlocked = hasCredit && credit && (credit.calculatedStatus === 'VENCIDO' || credit.is_blocked || hasPendingPayments);

  // Crédito disponible — calcular si puede usar crédito (se financia el 50%)
  const creditAvailable = useMemo(() => hasCredit &&
    credit &&
    !credit.is_blocked &&
    !hasPendingPayments &&
    credit.calculatedStatus !== 'BLOQUEADO' &&
    credit.calculatedStatus !== 'VENCIDO' &&
    (credit.credit_limit - credit.current_balance) >= montoFinanciado, [hasCredit, credit, hasPendingPayments, montoFinanciado]);

  // Lista de métodos de pago (con crédito si el usuario posee una cuenta)
  const paymentMethods = useMemo(() => hasCredit
    ? [
        ...BASE_PAYMENT_METHODS,
        {
          id: 'credito',
          label: 'Crédito Manojitos (Pago en partes)',
          description: `Crédito financia el 50%. Paga la Inicial + Cuota 1 hoy ($${montoInicialTotal.toFixed(2)}). Resto en 2 cuotas quincenales.`,
          disabled: !creditAvailable,
        },
      ]
    : BASE_PAYMENT_METHODS, [hasCredit, creditAvailable, montoInicialTotal]);

  // Datos del formulario
  const [shippingData, setShippingData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    notes: ''
  });
  const [newAddress, setNewAddress] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    notes: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('pago_movil');
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [isEditingShipping, setIsEditingShipping] = useState(true);
  const [isSelectingShipping, setIsSelectingShipping] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');

  // --- DERIVED / EFFECTS ---

  // Setear método de pago preferido
  useEffect(() => {
    if (!methodsLoading && hasPaymentMethods && preferredMethod) {
      setPaymentMethod(preferredMethod.method_type);
      setIsEditingPayment(false);
    }
  }, [methodsLoading, hasPaymentMethods, preferredMethod]);

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/cliente/auth?redirect=/checkout');
    }
  }, [user, authLoading, navigate]);

  // Redirigir si está bloqueado por mora
  useEffect(() => {
    if (!creditLoading && isCreditBlocked) {
      toast({
        title: "Acción bloqueada",
        description: hasPendingPayments 
          ? "Tienes un pago en verificación. No puedes realizar nuevas compras hasta que se apruebe." 
          : "Tienes cuotas vencidas. No puedes realizar nuevas compras.",
        variant: "destructive"
      });
      navigate('/carrito');
    }
  }, [creditLoading, isCreditBlocked, hasPendingPayments, navigate, toast]);

  // Cargar perfil del cliente si existe
  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data && !error) {
        setShippingData(prev => ({
          ...prev,
          fullName: prev.fullName || data.full_name || '',
          phone: prev.phone || data.phone || '',
          email: prev.email || data.email || '',
          address: prev.address || data.address || '',
          city: prev.city || data.city || ''
        }));
        
        if (data.dni_photo_url && data.face_photo_url && data.verification_photo_url) {
          setKycCompleted(true);
        } else {
          setKycCompleted(false);
        }
        
        // Iniciar en modo lectura si los datos básicos están
        if (data.full_name && data.phone) {
          setIsEditingShipping(false);
        }
      }
    }
    loadProfile();
  }, [user]);

  // Redirigir si carrito vacío (y no hay orden completa)
  useEffect(() => {
    if (isEmpty && !orderComplete) {
      navigate('/carrito');
    }
  }, [isEmpty, orderComplete, navigate]);

  // Manejar cambios en el formulario
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = sanitizeText(e.target.value);
      
    setShippingData(prev => ({
      ...prev,
      [e.target.name]: value
    }));
  }, []);

  // Validar datos de envío
  const isShippingValid = shippingData.fullName.trim() &&
    shippingData.phone.trim() &&
    (deliveryMethod === 'pickup' || (shippingData.address.trim() && shippingData.city.trim()));

  // Procesar pedido con checkout transaccional
  const handleSubmitOrder = async () => {
    if (!user) return;

    if (isCreditBlocked) {
      toast({
        title: 'Acción Bloqueada',
        description: hasPendingPayments ? 'Tienes un pago en verificación. No puedes realizar nuevas compras hasta que se apruebe.' : 'No puedes realizar nuevas compras mientras tengas cuotas vencidas.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setStockErrors([]);

    try {
      // Validar stock antes de enviar
      const { valid, errors } = await validateStock(
        items.map(item => ({
          id: item.id,
          name: item.size ? `${item.name} (Talla: ${item.size})` : item.name,
          quantity: item.quantity,
          price_usd: item.price_usd
        }))
      );

      if (!valid) {
        setStockErrors(errors);
        setLoading(false);
        return;
      }

      // Validar campos de pago móvil regular
      if (paymentMethod === 'pago_movil') {
        if (!bancoOrigen.trim() || !numeroReferencia.trim()) {
          toast({
            title: 'Datos incompletos',
            description: 'Debe ingresar el banco de origen y número de referencia para procesar el pago móvil.',
            variant: 'destructive'
          });
          setLoading(false);
          return;
        }
        if (!/^\d+$/.test(numeroReferencia.trim())) {
          toast({
            title: 'Referencia inválida',
            description: 'El número de referencia debe contener solo dígitos.',
            variant: 'destructive'
          });
          setLoading(false);
          return;
        }
      }

      // Upsert a customer_profiles con los datos de envío
      if (user) {
        await supabase.from('customer_profiles').upsert({
          user_id: user.id,
          full_name: shippingData.fullName,
          phone: shippingData.phone,
          email: shippingData.email,
          address: shippingData.address,
          city: shippingData.city,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      }

      const notesPrefix = paymentMethod === 'credito'
        ? `[Inicial Crédito Manojitos: $${montoInicialTotal.toFixed(2)} - Método: ${sanitizeText(casheaMethod)} - Ref: ${casheaRef ? sanitizeText(casheaRef) : 'N/A'}] `
        : '';

      const { error, saleIds } = await processCheckout(
        items.map(item => ({
          id: item.id,
          name: item.size ? `${item.name} (Talla: ${item.size})` : item.name,
          quantity: item.quantity,
          price_usd: item.price_usd
        })),
        {
          payment_method: sanitizeText(paymentMethod),
          client_name: shippingData.fullName,
          client_phone: shippingData.phone,
          notes: `${notesPrefix}[${deliveryMethod === 'pickup' ? 'RETIRO EN TIENDA' : 'DELIVERY'}] ${deliveryMethod === 'delivery' ? `Dirección: ${shippingData.address}, ${shippingData.city}. ` : ''}${shippingData.notes || ''}`,
          total_bs_rate: rate > 0 ? rate : undefined,
          banco_origen: paymentMethod === 'pago_movil' ? sanitizeText(bancoOrigen) : undefined,
          numero_referencia: paymentMethod === 'pago_movil' ? sanitizeText(numeroReferencia) : undefined
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
              ¡Gracias por tu compra!
            </h1>

            <p className="text-muted-foreground mb-8">
              Tu pedido ha sido registrado exitosamente. Hemos recibido tu solicitud.
            </p>

            <div className="glass-card rounded-2xl p-6 mb-6 text-left shadow-sm border border-border/60 bg-gradient-to-br from-background to-secondary/20">
              <h3 className="font-semibold text-lg text-foreground mb-4 border-b border-border/50 pb-2 flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Resumen del Pedido
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-muted-foreground">Nombre:</span>
                  <span className="font-medium text-foreground">{shippingData.fullName}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-muted-foreground">Teléfono:</span>
                  <span className="font-medium text-foreground">{shippingData.phone}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-muted-foreground">Tipo de Entrega:</span>
                  <span className="font-medium text-foreground">
                    {deliveryMethod === 'pickup' ? 'Retiro en Tienda' : 'Delivery'}
                  </span>
                </div>
                {deliveryMethod === 'delivery' && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-muted-foreground">Dirección:</span>
                    <span className="font-medium text-foreground text-right">{shippingData.address}, {shippingData.city}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-muted-foreground">Método de Pago:</span>
                  <span className="font-medium text-foreground">{paymentMethods.find(m => m.id === paymentMethod)?.label}</span>
                </div>
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

        {/* Alerta de errores de stock */}
        <AnimatePresence>
          {stockErrors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="text-lg font-semibold">Stock no disponible</AlertTitle>
                <AlertDescription className="mt-3">
                  <p className="text-sm mb-3">Algunos productos no tienen suficiente stock:</p>
                  <ul className="space-y-2">
                    {stockErrors.map((err) => (
                      <li key={err.productId} className="flex items-center justify-between text-sm bg-destructive/10 rounded-lg p-3">
                        <span className="font-medium">{err.productName}</span>
                        <span className="text-destructive">
                          Solicitaste {err.requested}, pero solo quedan {err.available}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs mt-3 text-muted-foreground">
                    Ajusta las cantidades en tu carrito o elimina los productos sin stock.
                  </p>
                </AlertDescription>
                <button
                  onClick={() => setStockErrors([])}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

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
                  <h2 className="font-semibold text-lg text-foreground">Opciones de Entrega</h2>
                  <p className="text-sm text-muted-foreground">¿Cómo deseas recibir tu pedido?</p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-white/40 dark:bg-white/5 relative">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-foreground text-sm">
                      {deliveryMethod === 'delivery' ? 'Entrega para ' : 'Retiro para '}{shippingData.fullName || 'Nuevo Cliente'}
                    </p>
                    <Dialog open={isSelectingShipping} onOpenChange={setIsSelectingShipping}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-auto p-0 text-primary hover:text-primary/80 transition-colors font-medium text-xs"
                        >
                          Cambiar
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto rounded-2xl p-0">
                        <div className="bg-muted/30 px-6 py-4 border-b border-border/40 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
                          <DialogTitle className="text-xl font-medium tracking-tight">Opciones de Entrega</DialogTitle>
                        </div>
                        <div className="p-6">
                          {/* Selector Retiro / Delivery */}
                          <RadioGroup
                            value={deliveryMethod}
                            onValueChange={(val: 'delivery' | 'pickup') => setDeliveryMethod(val)}
                            className="grid grid-cols-2 gap-4 mb-6"
                          >
                            <label
                              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all cursor-pointer ${
                                deliveryMethod === 'delivery'
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                  : 'border-border bg-white/40 hover:bg-white/60 dark:bg-white/5 dark:hover:bg-white/10'
                              }`}
                            >
                              <RadioGroupItem value="delivery" className="sr-only" />
                              <Truck className={`h-6 w-6 ${deliveryMethod === 'delivery' ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className={`font-medium ${deliveryMethod === 'delivery' ? 'text-primary' : 'text-foreground'}`}>Delivery</span>
                            </label>

                            <label
                              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all cursor-pointer ${
                                deliveryMethod === 'pickup'
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                  : 'border-border bg-white/40 hover:bg-white/60 dark:bg-white/5 dark:hover:bg-white/10'
                              }`}
                            >
                              <RadioGroupItem value="pickup" className="sr-only" />
                              <Store className={`h-6 w-6 ${deliveryMethod === 'pickup' ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className={`font-medium ${deliveryMethod === 'pickup' ? 'text-primary' : 'text-foreground'}`}>Retiro en Tienda</span>
                            </label>
                          </RadioGroup>

                          {/* Formularios de datos integrados en el modal */}
                          <div className="space-y-4">
                            <h3 className="font-medium text-foreground mb-3">
                              {deliveryMethod === 'delivery' ? 'Ingresa tus datos de envío' : 'Ingresa tus datos de retiro'}
                            </h3>
                            
                            <div className="grid gap-4">
                              <div>
                                <Label htmlFor="modal-fullName" className="text-sm">Nombre Completo <span className="text-destructive">*</span></Label>
                                <Input
                                  id="modal-fullName"
                                  placeholder="Ej: María Pérez"
                                  value={shippingData.fullName}
                                  onChange={(e) => setShippingData(prev => ({...prev, fullName: e.target.value.replace(/[^A-Za-zÁ-Úá-úñÑ\s]/g, '').slice(0, 50)}))}
                                  name="fullName"
                                  className="mt-1"
                                />
                              </div>

                              <div>
                                <Label htmlFor="modal-phone" className="text-sm">Teléfono <span className="text-destructive">*</span></Label>
                                <Input
                                  id="modal-phone"
                                  type="tel"
                                  placeholder="0412-123-4567"
                                  value={shippingData.phone}
                                  onChange={(e) => setShippingData(prev => ({...prev, phone: e.target.value.replace(/[^0-9+-\s()]/g, '').slice(0, 20)}))}
                                  name="phone"
                                  className="mt-1"
                                />
                              </div>

                              <AnimatePresence mode="popLayout">
                                {deliveryMethod === 'delivery' && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="grid gap-4 overflow-hidden"
                                  >
                                    <div>
                                      <Label htmlFor="modal-address" className="text-sm">Dirección Exacta <span className="text-destructive">*</span></Label>
                                      <Input
                                        id="modal-address"
                                        placeholder="Calle, número, punto de referencia..."
                                        value={shippingData.address}
                                        onChange={(e) => setShippingData(prev => ({...prev, address: e.target.value.replace(/[^A-Za-z0-9Á-Úá-úñÑ\s.,#-]/g, '').slice(0, 100)}))}
                                        name="address"
                                        className="mt-1"
                                      />
                                    </div>

                                    <div>
                                      <Label htmlFor="modal-city" className="text-sm">Ciudad <span className="text-destructive">*</span></Label>
                                      <Input
                                        id="modal-city"
                                        placeholder="Tu ciudad"
                                        value={shippingData.city}
                                        onChange={(e) => setShippingData(prev => ({...prev, city: e.target.value.replace(/[^A-Za-zÁ-Úá-úñÑ\s]/g, '').slice(0, 50)}))}
                                        name="city"
                                        className="mt-1"
                                      />
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <div>
                                <Label htmlFor="modal-notes" className="text-sm">Notas / Instrucciones</Label>
                                <Textarea
                                  id="modal-notes"
                                  placeholder="Ej: Dejar en portería..."
                                  value={shippingData.notes}
                                  onChange={(e) => setShippingData(prev => ({...prev, notes: e.target.value.replace(/[^A-Za-z0-9Á-Úá-úñÑ\s.,()!-]/g, '').slice(0, 200)}))}
                                  name="notes"
                                  className="mt-1"
                                  rows={2}
                                />
                              </div>
                            </div>
                            
                            <Button 
                              className="w-full mt-4 h-11 bg-[#FFD814] hover:bg-[#F7CA00] text-black font-medium"
                              onClick={() => setIsSelectingShipping(false)}
                            >
                              Guardar y continuar
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="text-sm text-muted-foreground pr-10">
                    {deliveryMethod === 'delivery' && shippingData.address ? (
                      <p className="leading-relaxed">{shippingData.address}{shippingData.city ? `, ${shippingData.city}` : ''}</p>
                    ) : (
                      <p className="leading-relaxed">Retiro en Tienda - {shippingData.phone || 'Sin número'}</p>
                    )}
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

              {!preferredMethod ? (
                <div className="bg-primary/5 rounded-xl border border-primary/20 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-primary">Forma de Pago</span>
                    <div className="h-3.5 w-3.5 rounded-full border-[3px] border-primary bg-background"></div>
                  </div>
                  <div className="ml-7 space-y-1">
                    <p className="font-semibold text-foreground text-sm">
                      {paymentMethods.find(m => m.id === paymentMethod)?.label || 'Pago Móvil'}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {paymentMethods.find(m => m.id === paymentMethod)?.description}
                    </p>
                  </div>
                  
                  <div className="mt-4 flex flex-col gap-2">
                    <Dialog open={isEditingPayment} onOpenChange={setIsEditingPayment}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Cambiar método de pago
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto rounded-2xl bg-background border border-border/40 shadow-2xl p-0">
                        <div className="bg-muted/30 px-6 py-4 border-b border-border/40 flex justify-between items-center">
                          <DialogTitle className="text-xl font-medium tracking-tight">Método de Pago</DialogTitle>
                        </div>
                        <div className="p-6">
                          <p className="text-sm text-muted-foreground mb-4">Selecciona tu forma de pago preferida</p>
                          <RadioGroup value={paymentMethod} onValueChange={(val) => {
                            setPaymentMethod(val);
                            setIsEditingPayment(false);
                          }} className="space-y-3">
                            {paymentMethods.map((method) => {
                              const isCreditMethod = method.id === 'credito';
                              const isDisabled = (method as any).disabled;
                              
                              return (
                                <label
                                  key={method.id}
                                  className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                                    isDisabled
                                      ? 'opacity-60 cursor-not-allowed border-dashed bg-secondary/5'
                                      : 'cursor-pointer hover:shadow-md bg-white/40 hover:bg-white/60 dark:bg-white/5 dark:hover:bg-white/10'
                                  } ${
                                    paymentMethod === method.id && !isDisabled
                                      ? isCreditMethod
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                        : 'border-accent bg-accent/5 ring-1 ring-accent/30'
                                      : isDisabled ? '' : 'border-border'
                                  }`}
                                >
                                  <RadioGroupItem 
                                    value={method.id} 
                                    id={method.id} 
                                    className="mt-1" 
                                    disabled={isDisabled}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      {isCreditMethod && <Wallet className="h-4 w-4 text-primary" />}
                                      <p className="font-medium text-foreground text-base">{method.label}</p>
                                      {isCreditMethod && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                          isDisabled 
                                            ? 'bg-destructive/10 text-destructive' 
                                            : 'bg-primary/10 text-primary'
                                        }`}>
                                          {isDisabled ? 'No Disponible' : 'Autorizado'}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{method.description}</p>
                                    
                                    {isCreditMethod && credit && (
                                      <div className="mt-2 flex flex-col gap-1 text-xs">
                                        <div className="flex gap-4">
                                          <span className="text-muted-foreground">Usado: <strong>${credit.current_balance.toFixed(2)}</strong></span>
                                          <span className="text-muted-foreground">Límite: <strong>${credit.credit_limit.toFixed(2)}</strong></span>
                                          <span className="text-muted-foreground">Disponible: <strong>${(credit.credit_limit - credit.current_balance).toFixed(2)}</strong></span>
                                        </div>
                                        {isDisabled && (
                                          <p className="text-destructive font-semibold mt-1">
                                            {credit.is_blocked || credit.calculatedStatus === 'BLOQUEADO'
                                              ? '⚠️ Tu crédito está bloqueado temporalmente.'
                                              : credit.calculatedStatus === 'VENCIDO'
                                              ? '⚠️ Tienes cuotas vencidas. Pon al día tu cuenta.'
                                              : `⚠️ El monto financiado ($${montoFinanciado.toFixed(2)}) supera tu saldo disponible ($${(credit.credit_limit - credit.current_balance).toFixed(2)}).`}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </RadioGroup>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ) : (
                <div className="p-4 mt-2 rounded-xl border border-border bg-white/40 dark:bg-white/5 relative">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-2 right-2 h-8 px-3 text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setIsEditingPayment(true)}
                  >
                    <Edit3 className="h-4 w-4 mr-1.5" />
                    Cambiar
                  </Button>
                  <div className="space-y-2 pr-20">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-primary shrink-0" />
                      <p className="font-medium text-foreground">
                        {preferredMethod.alias || paymentMethods.find(m => m.id === preferredMethod.method_type)?.label || 'Método Guardado'}
                      </p>
                    </div>
                    {preferredMethod.details?.bank_name && (
                      <p className="text-sm text-muted-foreground ml-7 flex items-center gap-1">
                        {preferredMethod.details.bank_name} 
                        {preferredMethod.details.last_four && <span className="text-xs px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground font-medium">•••• {preferredMethod.details.last_four}</span>}
                      </p>
                    )}
                    {preferredMethod.details?.email && (
                      <p className="text-sm text-muted-foreground ml-7">{preferredMethod.details.email}</p>
                    )}
                    {preferredMethod.details?.phone_number && (
                      <p className="text-sm text-muted-foreground ml-7">{preferredMethod.details.phone_number}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Panel de instrucciones de pago */}
              <AnimatePresence mode="wait">
                <PaymentInfoPanel method={paymentMethod} />

                {paymentMethod === 'pago_movil' && (
                  <motion.div
                    key="pago_movil_form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-5 rounded-xl border border-accent/20 bg-background/50 space-y-4"
                  >
                    <h4 className="text-sm font-semibold text-foreground">Confirmación de Pago</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bancoOrigen" className="text-sm">Banco de Origen <span className="text-destructive">*</span></Label>
                        <select
                          id="bancoOrigen"
                          value={bancoOrigen}
                          onChange={(e) => setBancoOrigen(e.target.value)}
                          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900 dark:text-foreground"
                        >
                          <option value="" className="dark:bg-zinc-900">Selecciona un banco</option>
                          <option value="Banesco" className="dark:bg-zinc-900">Banesco</option>
                          <option value="Banco de Venezuela" className="dark:bg-zinc-900">Banco de Venezuela</option>
                          <option value="Banco Mercantil" className="dark:bg-zinc-900">Banco Mercantil</option>
                          <option value="Banco Provincial" className="dark:bg-zinc-900">Banco Provincial</option>
                          <option value="Bancamiga" className="dark:bg-zinc-900">Bancamiga</option>
                          <option value="BNC" className="dark:bg-zinc-900">BNC (Banco Nacional de Crédito)</option>
                          <option value="Bancaribe" className="dark:bg-zinc-900">Bancaribe</option>
                          <option value="Banco del Tesoro" className="dark:bg-zinc-900">Banco del Tesoro</option>
                          <option value="Banco Bicentenario" className="dark:bg-zinc-900">Banco Bicentenario</option>
                          <option value="Banco Exterior" className="dark:bg-zinc-900">Banco Exterior</option>
                          <option value="Banplus" className="dark:bg-zinc-900">Banplus</option>
                          <option value="Banco Plaza" className="dark:bg-zinc-900">Banco Plaza</option>
                          <option value="Banco Activo" className="dark:bg-zinc-900">Banco Activo</option>
                          <option value="100% Banco" className="dark:bg-zinc-900">100% Banco</option>
                          <option value="Banco Caroní" className="dark:bg-zinc-900">Banco Caroní</option>
                          <option value="Banco Sofitasa" className="dark:bg-zinc-900">Banco Sofitasa</option>
                          <option value="Banco Venezolano de Crédito" className="dark:bg-zinc-900">Banco Venezolano de Crédito</option>
                          <option value="Mi Banco" className="dark:bg-zinc-900">Mi Banco</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="numeroReferencia" className="text-sm">N° de Referencia (Completa o últimos 6 dígitos) <span className="text-destructive">*</span></Label>
                        <Input
                          id="numeroReferencia"
                          placeholder="Ej: 123456"
                          value={numeroReferencia}
                          onChange={(e) => setNumeroReferencia(e.target.value.replace(/[^0-9]/g, '').slice(0, 20))}
                          className="mt-1 bg-white/50 dark:bg-white/5 dark:border-white/10"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {paymentMethod === 'credito' && credit && (
                  <motion.div
                    key="credito-panel"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="mt-5 rounded-xl border border-primary/40 bg-primary/5 p-5 space-y-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                      <Wallet className="h-5 w-5 text-primary" />
                      <p className="text-sm font-bold text-primary uppercase tracking-wide">Compra a Crédito Manojitos</p>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="bg-background/80 rounded-xl p-3 border border-primary/20 space-y-2">
                        <div className="flex justify-between font-bold text-foreground">
                          <span>Pago Inicial Hoy (50% + Cuota 1):</span>
                          <span className="text-primary text-base">${montoInicialTotal.toFixed(2)}</span>
                        </div>
                        {rate > 0 && (
                          <div className="text-right text-xs text-muted-foreground font-medium">
                            ≈ Bs. {formatBS(convertToBS(montoInicialTotal))}
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground leading-normal mt-1 border-t border-border/40 pt-1.5">
                          Para completar tu compra debes transferir o pagar la inicial hoy. El 50% restante (${montoFinanciado.toFixed(2)}) se cargará a tu línea de crédito en 3 cuotas.
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-background/50 rounded-lg p-2 text-center border border-border/50">
                          <p className="text-xs text-muted-foreground">Cuota 1 (Hoy)</p>
                          <p className="font-semibold text-foreground text-xs mt-0.5">${montoCuota.toFixed(2)}</p>
                          <span className="text-[10px] text-green-600 bg-green-50 px-1 rounded font-medium">Pagas hoy</span>
                        </div>
                        <div className="bg-background/50 rounded-lg p-2 text-center border border-border/50">
                          <p className="text-xs text-muted-foreground">Cuota 2 (15d)</p>
                          <p className="font-semibold text-foreground text-xs mt-0.5">${montoCuota.toFixed(2)}</p>
                          <span className="text-[10px] text-muted-foreground">Pendiente</span>
                        </div>
                        <div className="bg-background/50 rounded-lg p-2 text-center border border-border/50">
                          <p className="text-xs text-muted-foreground">Cuota 3 (30d)</p>
                          <p className="font-semibold text-foreground text-xs mt-0.5">${montoCuota.toFixed(2)}</p>
                          <span className="text-[10px] text-muted-foreground">Pendiente</span>
                        </div>
                      </div>

                      <div className="border-t border-border/50 pt-3 space-y-3">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Reportar Pago de la Inicial</h4>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="casheaMethod" className="text-xs">Método de Pago</Label>
                            <select
                              id="casheaMethod"
                              value={casheaMethod}
                              onChange={(e) => setCasheaMethod(e.target.value)}
                              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="pago_movil">Pago Móvil</option>
                              <option value="zelle">Zelle</option>
                              <option value="transferencia">Transferencia Bs</option>
                              <option value="efectivo_usd">Efectivo USD</option>
                              <option value="efectivo_bs">Efectivo Bs</option>
                            </select>
                          </div>

                          {casheaMethod !== 'efectivo_usd' && casheaMethod !== 'efectivo_bs' && (
                            <div>
                              <Label htmlFor="casheaRef" className="text-xs">Referencia / Teléfono</Label>
                              <Input
                                id="casheaRef"
                                placeholder="Ej: 123456"
                                value={casheaRef}
                                onChange={(e) => setCasheaRef(e.target.value.replace(/[^A-Za-z0-9+-\s()]/g, '').slice(0, 20))}
                                className="mt-1 h-9 text-xs"
                              />
                            </div>
                          )}
                        </div>

                        {casheaMethod === 'pago_movil' && (
                          <div className="text-[11px] bg-accent/5 p-2.5 rounded-lg border border-accent/20 text-muted-foreground space-y-1">
                            <p className="font-semibold text-accent">Datos Pago Móvil:</p>
                            <p>Banco: {PAYMENT_INFO.pagoMovil.bank} | Tlf: {PAYMENT_INFO.pagoMovil.phone}</p>
                            <p>C.I: {PAYMENT_INFO.pagoMovil.ci} | {PAYMENT_INFO.pagoMovil.name}</p>
                          </div>
                        )}

                        {casheaMethod === 'zelle' && (
                          <div className="text-[11px] bg-accent/5 p-2.5 rounded-lg border border-accent/20 text-muted-foreground">
                            <p className="font-semibold text-accent">Datos Zelle:</p>
                            <p>Email: zelle@manojitos.com (Ejemplo - reportar por WhatsApp)</p>
                            <p>Contacto de soporte: {PAYMENT_INFO.contacto}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground bg-secondary/80 p-3 rounded-lg justify-center">
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
                  <div key={`${item.id}-${item.size || ''}`} className="flex gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-border/50 flex-shrink-0 shadow-sm">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-secondary/80">
                          <Package className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">{item.name}</p>
                      {item.size && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Talla: {item.size === 'Única' ? 'Única' : item.size}</p>
                      )}
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
                    ≈ Bs. {formatBS(convertToBS(subtotal))}
                  </p>
                )}
              </div>

              {/* Validación de pago inicial de crédito y KYC */}
              {(() => {
                const isCasheaValid = paymentMethod !== 'credito' || 
                  casheaMethod === 'efectivo_usd' || 
                  casheaMethod === 'efectivo_bs' || 
                  casheaRef.trim() !== '';

                const isKycValid = paymentMethod !== 'credito' || kycCompleted;

                return (
                  <>
                    {isCreditBlocked && (
                      <div className={`mt-4 mb-2 p-3 border text-sm rounded-xl flex items-center justify-center gap-2 text-center font-medium ${hasPendingPayments ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'}`}>
                        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                        {hasPendingPayments ? 'Tienes un pago en verificación. No puedes realizar nuevas compras hasta que se apruebe.' : 'Tienes cuotas vencidas. Por favor regulariza tu pago.'}
                      </div>
                    )}
                    <Button
                      size="lg"
                      className="w-full btn-gold h-14 text-base mt-2 shadow-xl"
                      disabled={!isShippingValid || !isCasheaValid || !isKycValid || isCreditBlocked || creditLoading || loading}
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

                    {!isKycValid && (
                      <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-sm rounded-xl flex flex-col items-center justify-center gap-2 text-center">
                        <div className="flex items-center gap-2 font-medium">
                          <Shield className="h-4 w-4" />
                          Verificación KYC Requerida
                        </div>
                        <p className="text-xs opacity-90">Por seguridad, debes completar tu verificación de identidad para poder realizar compras.</p>
                        <Link to="/cliente/perfil">
                          <Button variant="outline" size="sm" className="mt-2 text-xs border-orange-500/30 hover:bg-orange-500/10">
                            Completar Verificación
                          </Button>
                        </Link>
                      </div>
                    )}

                    {!isShippingValid && (
                      <div className="mt-4 p-3 bg-destructive/10 text-destructive text-xs rounded-lg text-center flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                        Por favor completa los campos de envío requeridos
                      </div>
                    )}

                    {isShippingValid && !isCasheaValid && (
                      <div className="mt-4 p-3 bg-destructive/10 text-destructive text-xs rounded-lg text-center flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                        Por favor ingresa la referencia o teléfono del pago de la inicial
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
