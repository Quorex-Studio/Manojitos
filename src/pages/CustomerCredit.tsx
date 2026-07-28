import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChartSuccess, Danger, TickCircle, Loader, CreditCard, Wallet, Calendar, ArrowDown, ArrowUp, Shield, ShieldAlert, ShieldX, Clock, ArrowLeft, Refresh, AlertTriangle, Alert, CheckCircle, Award, History, DollarSign, Plus } from 'reicon-react';
import { Link } from 'react-router-dom';

import { StoreLayout } from '@/components/store/StoreLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditFinancialProfile } from '@/components/credits/CreditFinancialProfile';
import { CustomerTimeline } from '@/components/credits/CustomerTimeline';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import { useAuth } from '@/hooks/useAuth';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBS } from '@/lib/utils';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { cn } from '@/lib/utils';
import { sanitizeText } from '@/lib/validations';
import { PriceDisplay } from '@/components/ui/PriceDisplay';

function getNextQuincenas(baseDate: Date, numQuincenas: number): Date[] {
  const dates: Date[] = [];
  let currentDate = new Date(baseDate);
  
  for (let i = 0; i < numQuincenas; i++) {
    const nextDate = new Date(currentDate);
    const day = currentDate.getDate();
    
    if (day < 15) {
      nextDate.setDate(15);
    } else if (day < 30) {
      const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
      nextDate.setDate(Math.min(30, lastDayOfMonth));
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(15);
    }
    dates.push(new Date(nextDate));
    // Avanzamos un día para calcular la siguiente quincena
    currentDate = new Date(nextDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
}

const TRUST_CONFIG = {
  CONFIABLE: { icon: Shield, color: 'text-primary', bg: 'bg-primary/10', label: 'Confiable' },
  RIESGO: { icon: ShieldAlert, color: 'text-gold', bg: 'bg-gold/10', label: 'En Riesgo' },
  CRITICO: { icon: ShieldX, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Crítico' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVO: { label: 'Activo', color: 'bg-primary' },
  POR_VENCER: { label: 'Por Vencer', color: 'bg-gold/80' },
  EN_GRACIA: { label: 'En Período de Gracia', color: 'bg-gold/60' },
  VENCIDO: { label: 'Vencido', color: 'bg-destructive/80' },
  BLOQUEADO: { label: 'Bloqueado', color: 'bg-gray-500' },
};

// Sub-componente: vista cuando el cliente no tiene crédito aún
function CreditRequestView({ user, profile, rate, hasPendingRequest }: { user: any; profile: any; rate: number; hasPendingRequest: boolean }) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleRequest = async () => {
    if (!user) return;
    if (!acceptTerms) {
      toast.error('Debes aceptar los Términos y Condiciones para continuar.');
      return;
    }
    setIsSending(true);
    try {
      const { error } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          customer_user_id: user.id,
          customer_name: profile?.full_name || user.email || 'Cliente',
          customer_phone: profile?.phone || '',
          customer_email: user.email || '',
          items: [{ id: 'credit_request', name: 'Solicitud de Crédito', quantity: 1, price_usd: 0 }],
          subtotal: 0,
          discount: 0,
          total_usd: 0,
          total_bs: 0,
          status: 'pending',
          payment_method: 'credito',
          payment_status: 'pending',
          notes: `[SOLICITUD_CREDITO] ${message ? sanitizeText(message) : 'Cliente solicita una línea de crédito.'} DNI: ${profile?.dni || 'N/A'}. Tel: ${profile?.phone || 'N/A'}.`
        });
      if (error) throw error;
      toast.success('Solicitud enviada correctamente. Te contactaremos pronto.');
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customer-pending-credit-requests'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar solicitud');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <StoreLayout>
      <div className="container py-12 max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/cliente/perfil">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="page-header">Mi Crédito</h1>
        </div>

        <Card className="glass-card overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <CreditCard className="h-10 w-10 text-primary/70" />
            </div>
            <h2 className="text-2xl font-serif font-medium mb-2">Sin línea de crédito activa</h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-8">
              Solicita tu línea de crédito personalizada. El equipo evaluará tu perfil y se comunicará contigo.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-8 text-center">
              <div className="p-3 rounded-xl bg-card/60 border border-border/10">
                <p className="text-xs text-muted-foreground">Paso 1</p>
                <p className="text-sm font-medium mt-1">Completa tu perfil KYC</p>
              </div>
              <div className="p-3 rounded-xl bg-card/60 border border-border/10">
                <p className="text-xs text-muted-foreground">Paso 2</p>
                <p className="text-sm font-medium mt-1">Solicita tu crédito</p>
              </div>
              <div className="p-3 rounded-xl bg-card/60 border border-border/10">
                <p className="text-xs text-muted-foreground">Paso 3</p>
                <p className="text-sm font-medium mt-1">Recibe aprobación</p>
              </div>
            </div>

            {hasPendingRequest ? (
              <div className="bg-gold/10 border border-gold/20 p-6 rounded-xl text-center space-y-3 mt-4">
                <Clock className="w-12 h-12 text-gold mx-auto animate-pulse" />
                <h3 className="text-xl font-medium text-gold">Solicitud en Proceso</h3>
                <p className="text-sm text-gold/80 max-w-sm mx-auto">
                  Su solicitud ha sido procesada exitosamente. Se le dará respuesta en un máximo de 10 días.
                </p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="btn-gold btn-shimmer rounded-full px-8 h-12">
                      <Plus className="h-4 w-4 mr-2" />
                      Solicitar Crédito
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] overflow-y-auto glass-card max-w-md bg-background/95 backdrop-blur-md border border-border dark:border-white/10">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-xl">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Solicitud de Línea de Crédito
                      </DialogTitle>
                      <DialogDescription>
                        Tu solicitud será revisada por nuestro equipo. Te contactaremos a la brevedad.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/10">
                          <p className="text-muted-foreground text-xs">Nombre</p>
                          <p className="font-medium">{profile?.full_name || 'N/A'}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/10">
                          <p className="text-muted-foreground text-xs">Teléfono</p>
                          <p className="font-medium">{profile?.phone || 'N/A'}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/10">
                          <p className="text-muted-foreground text-xs">DNI / Cédula</p>
                          <p className="font-medium">{profile?.dni || 'Pendiente'}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/10">
                          <p className="text-muted-foreground text-xs">KYC</p>
                          <p className="font-medium capitalize">{profile?.kyc_status || 'none'}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="credit-message">Mensaje adicional (opcional)</Label>
                        <Textarea
                          id="credit-message"
                          placeholder="Cuéntanos sobre tu necesidad de crédito..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s.,()-]/g, '').slice(0, 300))}
                          rows={3}
                          className="bg-background/50"
                        />
                      </div>
                      <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <Checkbox
                          id="terms"
                          checked={acceptTerms}
                          onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                        />
                        <div className="space-y-1 leading-none">
                          <Label htmlFor="terms" className="text-sm font-medium">Acepto los Términos y Condiciones</Label>
                          <p className="text-xs text-muted-foreground">Al solicitar esta línea de crédito, confirmas que los datos proporcionados son reales y verificables, y te comprometes a cumplir con las fechas de corte establecidas.</p>
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                      <Button
                        className="btn-gold rounded-full"
                        onClick={handleRequest}
                        disabled={isSending || !acceptTerms}
                      >
                        {isSending ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        Enviar Solicitud
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Link to="/cliente/perfil?tab=kyc">
                  <Button variant="outline" className="rounded-full px-6 h-12 border-border/20">
                    Ver mi Perfil KYC
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </Card>
      </div>
    </StoreLayout>
  );
}

export default function CustomerCredit() {
  // --- DERIVED ---
  const { user } = useAuth();
  const { credit, transactions, promises, hasCredit, hasPendingPayments, isLoading } = useCustomerCredit();
  const { profile, isLoading: isProfileLoading } = useCustomerProfile();
  const queryClient = useQueryClient();
  const { rate } = useExchangeRate();

  const isKycComplete = profile?.dni && profile?.address && profile?.phone && profile?.kyc_status === 'approved';
  const isKycPending = profile?.kyc_status === 'pending' && (profile?.dni_photo_url || profile?.face_photo_url || profile?.verification_photo_url);
  const isKycRejected = profile?.kyc_status === 'rejected';

  // Query para saber si ya solicitó crédito
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['customer-pending-credit-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_user_id', user.id)
        .like('notes', '[SOLICITUD_CREDITO]%')
        .eq('status', 'pending');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
  
  const hasPendingRequest = pendingRequests.length > 0;

  // Fecha de hoy como tope máximo (se recalcula cada render, no se queda fija)
  const todayStr = new Date().toISOString().split('T')[0];

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pago_movil');
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [notes, setNotes] = useState('');

  // ... (useMutation y useQuery sin cambios) ...
  const reportPayment = useMutation({
    mutationFn: async () => {
      if (!credit || !user) throw new Error('No hay sesión o cuenta activa');
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('El monto ingresado debe ser mayor a cero');
      }
      const today = new Date().toISOString().split('T')[0];
      if (paymentDate > today) {
        throw new Error('La fecha de pago no puede ser una fecha futura');
      }
      if (!reference && paymentMethod !== 'efectivo') {
        throw new Error('La referencia es obligatoria para este método de pago');
      }

      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: credit.user_id || '00000000-0000-0000-0000-000000000000',
          customer_user_id: user.id,
          customer_name: credit.client_name || user.email || 'Cliente',
          customer_phone: credit.client_phone || '',
          customer_email: user.email || '',
          items: [{ id: 'credit_payment', name: 'pago a Crédito', quantity: 1, price: amountNum, price_usd: amountNum }],
          subtotal: amountNum,
          discount: 0,
          total_usd: amountNum,
          total_bs: amountNum * (rate || 1),
          status: 'pending',
          payment_method: paymentMethod,
          payment_status: 'pending',
          notes: `[pago_CREDITO] Referencia: ${reference ? sanitizeText(reference) : 'Efectivo'}. Método: ${paymentMethod.toUpperCase()}. Fecha: ${paymentDate}. Notas: ${notes ? sanitizeText(notes) : ''}`
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('pago reportado correctamente. En espera de verificación.');
      setIsReportModalOpen(false);
      setAmount('');
      setReference('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['customer-pending-abonos'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al reportar pago');
    }
  });

  const { data: pendingpagos = [] } = useQuery({
    queryKey: ['customer-pending-abonos', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_user_id', user.id)
        .like('notes', '[pago_CREDITO]%')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // --- RENDER ---

  if (!user) {
    return (
      <StoreLayout>
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso requerido</h1>
          <p className="text-muted-foreground mb-6">Debes iniciar sesión para ver tu crédito</p>
          <Link to="/cliente/auth">
            <Button>Iniciar Sesión</Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  if (isLoading || isProfileLoading) {
    return (
      <StoreLayout>
        <div className="container py-12 flex items-center justify-center">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  if (!hasCredit) {
    if (isKycRejected) {
      return (
        <StoreLayout>
          <div className="container py-12 max-w-2xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
              <ShieldX className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">Verificación KYC Rechazada</h1>
            <p className="text-muted-foreground">
              Tus documentos de identidad fueron rechazados. Por favor, revisa las fotos y vuelve a enviarlas para poder solicitar un crédito.
            </p>
            <Link to="/cliente/perfil?tab=kyc">
              <Button className="btn-gold rounded-full px-8">Reenviar Documentos KYC</Button>
            </Link>
          </div>
        </StoreLayout>
      );
    }

    if (isKycPending) {
      return (
        <StoreLayout>
          <div className="container py-12 max-w-2xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-gold/10 text-gold rounded-full flex items-center justify-center">
              <Clock className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">Verificación KYC en Proceso</h1>
            <p className="text-muted-foreground">
              Tus documentos están siendo revisados por nuestro equipo. Te notificaremos en cuanto tu identidad sea aprobada para que puedas solicitar tu crédito.
            </p>
            <Link to="/cliente/perfil?tab=kyc">
              <Button variant="outline" className="rounded-full px-8">Ver Estado de mi KYC</Button>
            </Link>
          </div>
        </StoreLayout>
      );
    }

    if (profile?.kyc_status !== 'approved') {
      return (
        <StoreLayout>
          <div className="container py-12 max-w-2xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">Verificación de Identidad Requerida</h1>
            <p className="text-muted-foreground">
              Para acceder al módulo de crédito, necesitas completar tu perfil KYC (Cédula, Dirección, Teléfono, y fotos).
            </p>
            <Link to="/cliente/perfil?tab=kyc">
              <Button className="btn-gold rounded-full px-8">Completar Mi Perfil KYC</Button>
            </Link>
          </div>
        </StoreLayout>
      );
    }

    return (
      <CreditRequestView
        user={user}
        profile={profile}
        rate={rate}
        hasPendingRequest={hasPendingRequest}
      />
    );
  }

  const trustConfig = TRUST_CONFIG[credit.trust_level as keyof typeof TRUST_CONFIG] || TRUST_CONFIG.CONFIABLE;
  const TrustIcon = trustConfig.icon;
  const statusConfig = STATUS_CONFIG[credit.calculatedStatus || 'ACTIVO'];
  const usagePercent = credit.credit_limit > 0 ? (credit.current_balance / credit.credit_limit) * 100 : 0;

  // Calcular las cuotas a partir de los cargos de financiamiento registrados
  const cuotasFinanciadas = transactions
    .filter(tx => tx.type === 'CARGO' && (tx.description?.includes('Cargo Financiamiento') || tx.description?.toLowerCase().includes('pedido')))
    .map(tx => {
      const isFinanciamiento = tx.description?.includes('Cargo Financiamiento');
      const montoFinanciado = tx.amount;
      const totalPedido = isFinanciamiento ? montoFinanciado * 2 : montoFinanciado;
      const montoCuota = montoFinanciado / (isFinanciamiento ? 3 : 1);
      const fechaCompra = new Date(tx.created_at);

      // Cuotas
      const fechasCorte = getNextQuincenas(fechaCompra, 2);
      
      const cuotas = [
        {
          numero: 1,
          monto: montoCuota,
          fechaVencimiento: fechaCompra,
          estado: 'PAGADA', // Se paga de inmediato
        },
        {
          numero: 2,
          monto: montoCuota,
          fechaVencimiento: fechasCorte[0],
          estado: 'PENDIENTE',
        },
        {
          numero: 3,
          monto: montoCuota,
          fechaVencimiento: fechasCorte[1],
          estado: 'PENDIENTE',
        }
      ];

      return {
        id: tx.id,
        descripcion: tx.description,
        totalPedido,
        montoFinanciado,
        cuotas,
        fechaCompra
      };
    });

  const hasOverdue = (credit.daysOverdue ?? 0) > 0;
  const hasUpcoming = credit.daysUntilDue !== null && credit.daysUntilDue !== undefined && credit.daysUntilDue >= 0 && credit.daysUntilDue <= 3 && credit.current_balance > 0;

  return (
    <StoreLayout>
      <div className="container py-8 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link to="/cliente/perfil">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="page-header">Mi Crédito</h1>
              <p className="text-muted-foreground">Estado de tu línea de crédito</p>
            </div>
            <div className={cn("px-4 py-2 rounded-full flex items-center gap-2", trustConfig.bg)}>
              <TrustIcon className={cn("h-5 w-5", trustConfig.color)} />
              <span className={cn("font-semibold", trustConfig.color)}>{trustConfig.label}</span>
            </div>
          </div>

          {/* Banners de Notificación Llamativos */}
          {hasOverdue && !hasPendingPayments && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-red-500/20 text-red-600 dark:text-red-400">
                  <Danger className="h-6 w-6 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-base text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    ⚠️ CUOTA VENCIDA DETECTADA
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tienes cuotas vencidas (Retraso de {credit.daysOverdue} días). Por favor, realiza el pago correspondiente lo antes posible para mantener tu línea de crédito activa.
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setIsReportModalOpen(true)}
                className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-md flex-shrink-0"
              >
                <DollarSign className="h-4 w-4" />
                Reportar pago Ahora
              </Button>
            </motion.div>
          )}

          {hasOverdue && hasPendingPayments && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6 p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-950 dark:text-blue-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
                  <TickCircle className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-base text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    ⏳ pago EN VERIFICACIÓN
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hemos recibido tu reporte de pago y estamos verificándolo. Tu estado de mora se actualizará pronto.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {hasUpcoming && !hasOverdue && !hasPendingPayments && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-base text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    📅 CUOTA PRÓXIMA A VENCER
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tienes una cuota que vence en {credit.daysUntilDue === 0 ? 'hoy' : `${credit.daysUntilDue} días`}. Evita la suspensión de tu financiamiento.
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setIsReportModalOpen(true)}
                className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-md flex-shrink-0"
              >
                <DollarSign className="h-4 w-4" />
                pagar Cuota
              </Button>
            </motion.div>
          )}

          {/* Tarjeta principal */}
          <Card className="glass-card mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-6">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
                  <PriceDisplay 
                    amountUsd={credit.current_balance} 
                    primaryClassName="text-4xl font-bold"
                    showSecondary={false} 
                  />
                  <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                    <span>de</span>
                    <PriceDisplay amountUsd={credit.credit_limit} primaryClassName="text-sm" showSecondary={false} />
                    <span>disponibles</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 items-start md:items-end justify-between">
                  {credit.current_balance > 0 && (
                    <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full md:w-auto bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/75 text-white shadow-lg flex items-center gap-2 hover:scale-[1.02] transition-transform">
                          <Plus className="h-4 w-4" />
                          Reportar pago
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[85vh] overflow-y-auto glass-card max-w-md bg-background/95 backdrop-blur-md border border-border dark:border-white/10 text-foreground">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                            <DollarSign className="h-5 w-5 text-primary animate-pulse" />
                            Reportar pago a Crédito
                          </DialogTitle>
                          <DialogDescription className="text-muted-foreground">
                            Registra un pago para amortizar tu saldo de crédito pendiente.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="amount">Monto del pago (USD)</Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="amount"
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => {
                                  let val = e.target.value.replace(/[^0-9.]/g, '');
                                  const parts = val.split('.');
                                  if (parts.length > 2) {
                                    val = parts[0] + '.' + parts.slice(1).join('');
                                  }
                                  setAmount(val);
                                }}
                                className="pl-9 bg-background/50"
                              />
                            </div>
                            {amount && rate && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Equivalente a: <span className="font-extrabold text-lg text-primary">{formatBS(parseFloat(amount) * rate)}</span> <span className="text-xs">(Tasa: {rate} Bs/$)</span>
                              </p>
                            )}
                          </div>
  
                          <div className="space-y-2">
                            <Label htmlFor="payment-method">Método de Pago</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                              <SelectTrigger className="bg-background/50">
                                <SelectValue placeholder="Selecciona un método" />
                              </SelectTrigger>
                              <SelectContent className="bg-background/95 border-border dark:border-white/10">
                                <SelectItem value="pago_movil">Pago Móvil</SelectItem>
                                <SelectItem value="zelle">Zelle</SelectItem>
                                <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                                <SelectItem value="efectivo">Efectivo en Tienda</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
  
                          {paymentMethod === 'pago_movil' && (
                            <div className="text-xs bg-gold/10 p-3.5 rounded-xl border border-gold/30 text-foreground space-y-1">
                              <p className="font-bold text-gold uppercase text-[11px] tracking-wider">Datos para Pago Móvil:</p>
                              <p className="font-semibold text-sm">Banco: Bancamiga • Tlf: 04248780607</p>
                              <p className="text-xs text-muted-foreground">C.I: 30785117 • Josmaris De Los Ángeles</p>
                            </div>
                          )}

                          {paymentMethod !== 'efectivo' && (
                            <div className="space-y-3">
                              {paymentMethod === 'pago_movil' && (
                                <div className="space-y-1.5">
                                  <Label htmlFor="issuer-phone" className="text-xs font-medium">Teléfono Emisor</Label>
                                  <Input
                                    id="issuer-phone"
                                    placeholder="Ej: 04241234567"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                                    className="bg-background/50 text-xs"
                                  />
                                </div>
                              )}
                              <div className="space-y-1.5">
                                <Label htmlFor="reference" className="text-xs font-medium">Número de Referencia</Label>
                                <Input
                                  id="reference"
                                  placeholder="Ej: 12345678"
                                  value={reference}
                                  onChange={(e) => setReference(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                                  className="bg-background/50 text-xs"
                                />
                              </div>
                            </div>
                          )}
  
                          <div className="space-y-2">
                            <Label htmlFor="payment-date">Fecha de pago</Label>
                            <Input
                              id="payment-date"
                              type="date"
                              value={paymentDate}
                              max={todayStr}
                              onChange={(e) => {
                                // Doble protección: ignorar si el valor supera hoy
                                if (e.target.value <= todayStr) {
                                  setPaymentDate(e.target.value);
                                }
                              }}
                              className="bg-background/50"
                            />
                            {paymentDate > todayStr && (
                              <p className="text-xs text-destructive">
                                La fecha de pago no puede ser una fecha futura.
                              </p>
                            )}
                          </div>
  
                          <div className="space-y-2">
                            <Label htmlFor="notes">Notas o Comentarios (Opcional)</Label>
                            <Textarea
                              id="notes"
                              placeholder="Detalles adicionales del pago..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s.,()-]/g, ''))}
                              rows={3}
                              className="bg-background/50"
                            />
                          </div>
                        </div>
                        <DialogFooter className="gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => setIsReportModalOpen(false)}
                            disabled={reportPayment.isPending}
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={() => reportPayment.mutate()}
                            disabled={reportPayment.isPending}
                            className="bg-primary text-white hover:bg-primary/90"
                          >
                            {reportPayment.isPending ? (
                              <>
                                <Loader className="mr-2 h-4 w-4 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              'Enviar Reporte'
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}

                  <div className="text-left md:text-right">
                    <Badge className={cn(statusConfig.color, "text-white mb-2")}>
                      {statusConfig.label}
                    </Badge>
                    {credit.next_due_date && (
                      <p className="text-sm text-muted-foreground flex items-center justify-end gap-1">
                        <Calendar className="h-4 w-4" />
                        Vence: {format(new Date(credit.next_due_date), "dd MMM yyyy", { locale: es })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Uso del crédito</span>
                  <span>{usagePercent.toFixed(0)}%</span>
                </div>
                <Progress value={usagePercent} className="h-2" />
              </div>
            </div>
          </Card>

          {/* Alertas */}
          {credit.is_blocked && (
            <Card className="mb-6 border-destructive bg-destructive/10">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Crédito Bloqueado</p>
                  <p className="text-sm text-muted-foreground">{credit.blocked_reason || 'Contacta con la tienda'}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {credit.early_payment_discount > 0 && credit.trust_level === 'CONFIABLE' && (
            <Card className="mb-6 border-primary/30 bg-primary/10">
              <CardContent className="p-4 flex items-center gap-3">
                <Award className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-semibold text-primary">Descuento por pago Puntual</p>
                  <p className="text-sm text-muted-foreground">
                    Obtén un {credit.early_payment_discount}% de descuento al pagar antes del vencimiento
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contador de días */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className={cn(credit.daysUntilDue && credit.daysUntilDue > 0 ? "border-green-500/30" : "")}>
              <CardContent className="p-4 text-center">
                <Clock className="h-5 w-5 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold text-primary">{credit.daysUntilDue || 0}</p>
                <p className="text-xs text-muted-foreground">Días para pagar</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold">{credit.grace_days}</p>
                <p className="text-xs text-muted-foreground">Días de gracia</p>
              </CardContent>
            </Card>
            <Card className={cn(credit.daysOverdue && credit.daysOverdue > 0 ? "border-red-500/30" : "")}>
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-5 w-5 mx-auto text-destructive mb-2" />
                <p className="text-2xl font-bold text-destructive">{credit.daysOverdue || 0}</p>
                <p className="text-xs text-muted-foreground">Días vencido</p>
              </CardContent>
            </Card>
          </div>

          {/* Perfil Financiero */}
          <CreditFinancialProfile creditData={credit} />

          {/* Tabs */}
          <Tabs defaultValue="transactions" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="transactions">Movimientos</TabsTrigger>
              <TabsTrigger value="cuotas">Mis Cuotas</TabsTrigger>
              <TabsTrigger value="promises">Compromisos</TabsTrigger>
              <TabsTrigger value="timeline">
                <History className="h-4 w-4 mr-1" />
                Historial
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transactions">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Historial de Movimientos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* pagos pendientes de verificación */}
                  {pendingpagos.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gold flex items-center gap-2">
                        <Clock className="h-4 w-4 animate-spin text-gold" />
                        pagos Pendientes de Verificación ({pendingpagos.length})
                      </h3>
                      <div className="space-y-2 border-l-2 border-gold pl-3">
                        {pendingpagos.map(pago => {
                          const matchRef = pago.notes?.match(/Referencia:\s*([^\.]+)/i);
                          const matchMethod = pago.notes?.match(/Método:\s*([^\.]+)/i);
                          const refText = matchRef ? matchRef[1] : 'N/A';
                          const methodText = matchMethod ? matchMethod[1] : pago.payment_method;

                          return (
                            <div key={pago.id} className="flex justify-between items-center p-3 rounded-lg bg-gold/5 border border-gold/10">
                              <div>
                                <p className="font-medium text-sm">pago a Crédito (Reportado)</p>
                                <p className="text-xs text-muted-foreground">
                                  Ref: {refText} • Método: {methodText.toUpperCase()}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(new Date(pago.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                                </p>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <span className="font-bold text-gold">${pago.total_usd.toFixed(2)}</span>
                                <Badge variant="outline" className="text-gold border-gold/30 bg-gold/5 text-[10px] px-1.5 py-0.5">
                                  Pendiente
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {transactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay movimientos registrados
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">Historial de Transacciones</h3>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-3">
                        {transactions.map(tx => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/80"
                          >
                            <div className="flex items-center gap-3">
                              {tx.type === 'ABONO' ? (
                                <ArrowDown className="h-5 w-5 text-primary" />
                              ) : (
                                <ChartSuccess className="h-5 w-5 text-destructive" />
                              )}
                              <div>
                                <div className="font-medium text-sm">{
                                  (() => {
                                    const desc = tx.description || tx.type;
                                    // Strip raw [pago_CREDITO] notes string from stored orders notes
                                    if (desc.startsWith('[pago_CREDITO]')) {
                                      const refMatch = desc.match(/Referencia:\s*([^\.]+)/);
                                      const methodMatch = desc.match(/Método:\s*([^\.]+)/);
                                      const noteMatch = desc.match(/Notas:\s*(.*)/);
                                      
                                      const ref = refMatch ? refMatch[1].trim() : 'N/A';
                                      const method = methodMatch ? methodMatch[1].trim().replace(/_/g, ' ') : '';
                                      const note = noteMatch ? noteMatch[1].trim() : '';

                                      return (
                                        <div className="flex flex-col">
                                          <span className="capitalize">pago {method}</span>
                                          <span className="text-xs text-muted-foreground font-normal">Ref: {ref}</span>
                                          {note && <span className="text-[10px] text-muted-foreground/70 italic max-w-[220px] truncate">"{note}"</span>}
                                        </div>
                                      );
                                    }
                                    return desc;
                                  })()
                                }</div>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                "font-bold",
                                tx.type === 'ABONO' ? "text-primary" : "text-destructive"
                              )}>
                                {tx.type === 'ABONO' ? '-' : '+'}${tx.amount.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Saldo: ${tx.new_balance.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cuotas">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Cronograma de Cuotas (Financiamiento Manojitos)
                  </CardTitle>
                  <CardDescription>
                    Visualiza el estado de tus cuotas quincenales para cada compra financiada.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {cuotasFinanciadas.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No tienes compras financiadas registradas.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {cuotasFinanciadas.map(compra => {
                        return (
                          <div key={compra.id} className="p-4 rounded-xl border border-border dark:border-white/10 bg-secondary/30 space-y-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold text-foreground text-sm md:text-base">
                                  {compra.descripcion || 'Compra Financiada'}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  Comprado el {format(compra.fechaCompra, "dd MMM yyyy", { locale: es })}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-muted-foreground block">Total Pedido</span>
                                <PriceDisplay amountUsd={compra.totalPedido} primaryClassName="font-bold text-primary" showSecondary={false} />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {compra.cuotas.map((cuota) => {
                                // Determinar estado de la cuota:
                                // La cuota 1 siempre es pagada al inicio.
                                // La cuota 2 y 3 dependen de si el saldo total de la línea de crédito ha sido amortizado.
                                let isPaid = false;
                                if (cuota.numero === 1) {
                                  isPaid = true;
                                } else if (cuota.numero === 2) {
                                  // Si el saldo deudor es menor al costo de la última cuota (cuota 3), significa que la cuota 2 está pagada
                                  isPaid = credit.current_balance <= cuota.monto;
                                } else if (cuota.numero === 3) {
                                  // Si el saldo deudor es cero, la cuota 3 está pagada
                                  isPaid = credit.current_balance <= 0.01;
                                }

                                return (
                                  <div 
                                    key={cuota.numero} 
                                    className={cn(
                                      "p-3 rounded-lg border flex flex-col justify-between space-y-2",
                                      isPaid 
                                        ? "bg-primary/5 border-primary/20" 
                                        : "bg-background/40 border-border dark:border-white/5"
                                    )}
                                  >
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-semibold text-muted-foreground">
                                        Cuota {cuota.numero}/3
                                      </span>
                                      <Badge 
                                        variant={isPaid ? "default" : "outline"} 
                                        className={cn(
                                          "text-[10px] px-1.5 py-0.5",
                                          isPaid ? "bg-primary/20 text-primary border-primary/30" : "text-muted-foreground"
                                        )}
                                      >
                                        {isPaid ? 'PAGADA' : 'PENDIENTE'}
                                      </Badge>
                                    </div>
                                    <div>
                                      <PriceDisplay amountUsd={cuota.monto} primaryClassName="text-lg font-bold" showSecondary={false} />
                                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Vence: {format(cuota.fechaVencimiento, "dd MMM yyyy", { locale: es })}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="promises">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Compromisos de pago</CardTitle>
                  <CardDescription>
                    Acuerdos de pago programados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {promises.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay compromisos registrados
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {promises.map(promise => (
                        <div
                          key={promise.id}
                          className={cn(
                            "p-4 rounded-lg border",
                            promise.status === 'CUMPLIDA' && "border-primary/30 bg-primary/5",
                            promise.status === 'INCUMPLIDA' && "border-destructive/30 bg-destructive/5",
                            promise.status === 'PENDIENTE' && "border-gold/30 bg-gold/5"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                {promise.status === 'CUMPLIDA' && <TickCircle className="h-4 w-4 text-primary" />}
                                {promise.status === 'INCUMPLIDA' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                {promise.status === 'PENDIENTE' && <Clock className="h-4 w-4 text-gold" />}
                                <span className="font-medium">${promise.promised_amount.toFixed(2)}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Fecha: {format(new Date(promise.promised_date), "dd MMM yyyy", { locale: es })}
                              </p>
                            </div>
                            <Badge variant={
                              promise.status === 'CUMPLIDA' ? 'default' :
                              promise.status === 'INCUMPLIDA' ? 'destructive' : 'secondary'
                            }>
                              {promise.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline">
              <CustomerTimeline customerPhone={credit.client_phone || undefined} limit={20} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </StoreLayout>
  );
}
