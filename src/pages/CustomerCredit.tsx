import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  CreditCard, 
  Wallet, 
  Calendar, 
  TrendingDown, 
  TrendingUp,
  Shield,
  ShieldAlert,
  ShieldX,
  Clock,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Award,
  History,
  DollarSign,
  Plus
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { sanitizeText } from '@/lib/validations';

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

export default function CustomerCredit() {
  // --- DERIVED ---
  const { user } = useAuth();
  const { credit, transactions, promises, hasCredit, hasPendingPayments, isLoading } = useCustomerCredit();
  const queryClient = useQueryClient();
  const { rate } = useExchangeRate();

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pago_movil');
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Mutación para enviar el reporte de abono
  const reportPayment = useMutation({
    mutationFn: async () => {
      if (!credit || !user) throw new Error('No hay sesión o cuenta activa');
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('El monto ingresado debe ser mayor a cero');
      }
      if (!reference && paymentMethod !== 'efectivo') {
        throw new Error('La referencia es obligatoria para este método de pago');
      }

      // Crear la orden especial
      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: credit.user_id || '00000000-0000-0000-0000-000000000000', // Asignar al administrador del local
          customer_user_id: user.id,
          customer_name: credit.client_name || user.email || 'Cliente',
          customer_phone: credit.client_phone || '',
          customer_email: user.email || '',
          items: [
            {
              id: 'credit_payment',
              name: 'Abono a Crédito',
              quantity: 1,
              price: amountNum,
              price_usd: amountNum
            }
          ],
          subtotal: amountNum,
          discount: 0,
          total_usd: amountNum,
          total_bs: amountNum * (rate || 1),
          status: 'pending',
          payment_method: paymentMethod,
          payment_status: 'pending',
          notes: `[ABONO_CREDITO] Referencia: ${reference ? sanitizeText(reference) : 'Efectivo'}. Método: ${paymentMethod.toUpperCase()}. Fecha: ${paymentDate}. Notas: ${notes ? sanitizeText(notes) : ''}`
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Abono reportado correctamente. En espera de verificación.');
      setIsReportModalOpen(false);
      // Limpiar campos
      setAmount('');
      setReference('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['customer-pending-abonos'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al reportar abono');
    }
  });

  // Query para obtener los abonos pendientes
  const { data: pendingAbonos = [] } = useQuery({
    queryKey: ['customer-pending-abonos', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_user_id', user.id)
        .like('notes', '[ABONO_CREDITO]%')
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

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="container py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  if (!hasCredit) {
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
          <Card className="glass-card text-center py-12">
            <CardContent>
              <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No tienes línea de crédito</h2>
              <p className="text-muted-foreground mb-6">
                Aún no tienes una línea de crédito habilitada. Contacta con la tienda para solicitar una.
              </p>
              <Link to="/tienda">
                <Button>Explorar Tienda</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </StoreLayout>
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
          fechaVencimiento: new Date(new Date(fechaCompra).getTime() + 15 * 24 * 60 * 60 * 1000),
          estado: 'PENDIENTE',
        },
        {
          numero: 3,
          monto: montoCuota,
          fechaVencimiento: new Date(new Date(fechaCompra).getTime() + 30 * 24 * 60 * 60 * 1000),
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
                  <AlertOctagon className="h-6 w-6 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-base text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    ⚠️ CUOTA VENCIDA DETECTADA
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tienes cuotas vencidas (Retraso de {credit.daysOverdue} días). Por favor, realiza el abono correspondiente lo antes posible para mantener tu línea de crédito activa.
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setIsReportModalOpen(true)}
                className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-md flex-shrink-0"
              >
                <DollarSign className="h-4 w-4" />
                Reportar Abono Ahora
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
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-base text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    ⏳ PAGO EN VERIFICACIÓN
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
                Pagar Cuota
              </Button>
            </motion.div>
          )}

          {/* Tarjeta principal */}
          <Card className="glass-card mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-6">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
                  <p className="text-4xl font-bold">${credit.current_balance.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    de ${credit.credit_limit.toFixed(2)} disponibles
                  </p>
                </div>
                <div className="flex flex-col gap-3 items-start md:items-end justify-between">
                  <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full md:w-auto bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/75 text-white shadow-lg flex items-center gap-2 hover:scale-[1.02] transition-transform">
                        <Plus className="h-4 w-4" />
                        Reportar Abono
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-card max-w-md bg-background/95 backdrop-blur-md border border-border dark:border-white/10 text-foreground">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                          <DollarSign className="h-5 w-5 text-primary animate-pulse" />
                          Reportar Abono a Crédito
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                          Registra un pago para amortizar tu saldo de crédito pendiente.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="amount">Monto del Abono (USD)</Label>
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
                            <p className="text-xs text-muted-foreground mt-1">
                              Equivalente a: <span className="font-semibold text-primary">Bs. {formatBS(parseFloat(amount) * rate)}</span> (Tasa: {rate} Bs/$)
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

                        {paymentMethod !== 'efectivo' && (
                          <div className="space-y-2">
                            <Label htmlFor="reference">Número de Referencia</Label>
                            <Input
                              id="reference"
                              placeholder="Ej: 12345678"
                              value={reference}
                              onChange={(e) => setReference(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                              className="bg-background/50"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="payment-date">Fecha de Pago</Label>
                          <Input
                            id="payment-date"
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="bg-background/50"
                          />
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
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            'Enviar Reporte'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

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
                  <p className="font-semibold text-primary">Descuento por Pago Puntual</p>
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
                  {/* Abonos pendientes de verificación */}
                  {pendingAbonos.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gold flex items-center gap-2">
                        <Clock className="h-4 w-4 animate-spin text-gold" />
                        Abonos Pendientes de Verificación ({pendingAbonos.length})
                      </h3>
                      <div className="space-y-2 border-l-2 border-gold pl-3">
                        {pendingAbonos.map(abono => {
                          const matchRef = abono.notes?.match(/Referencia:\s*([^\.]+)/i);
                          const matchMethod = abono.notes?.match(/Método:\s*([^\.]+)/i);
                          const refText = matchRef ? matchRef[1] : 'N/A';
                          const methodText = matchMethod ? matchMethod[1] : abono.payment_method;

                          return (
                            <div key={abono.id} className="flex justify-between items-center p-3 rounded-lg bg-gold/5 border border-gold/10">
                              <div>
                                <p className="font-medium text-sm">Abono a Crédito (Reportado)</p>
                                <p className="text-xs text-muted-foreground">
                                  Ref: {refText} • Método: {methodText.toUpperCase()}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(new Date(abono.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                                </p>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <span className="font-bold text-gold">${abono.total_usd.toFixed(2)}</span>
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
                                <TrendingDown className="h-5 w-5 text-primary" />
                              ) : (
                                <TrendingUp className="h-5 w-5 text-destructive" />
                              )}
                              <div>
                                <p className="font-medium">{
                                  (() => {
                                    const desc = tx.description || tx.type;
                                    // Strip raw [ABONO_CREDITO] notes string from stored orders notes
                                    if (desc.startsWith('[ABONO_CREDITO]')) {
                                      const refMatch = desc.match(/Referencia:\s*([^\.\n]+)/);
                                      const ref = refMatch ? refMatch[1].trim() : '';
                                      return ref ? `Abono reportado — Ref: ${ref}` : 'Abono reportado';
                                    }
                                    return desc;
                                  })()
                                }</p>
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
                                <span className="font-bold text-primary">${compra.totalPedido.toFixed(2)}</span>
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
                                      <p className="text-lg font-bold">${cuota.monto.toFixed(2)}</p>
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
                  <CardTitle>Compromisos de Pago</CardTitle>
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
                                {promise.status === 'CUMPLIDA' && <CheckCircle2 className="h-4 w-4 text-primary" />}
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
