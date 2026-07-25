import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChartSuccess, TickCircle, Loader, CreditCard, Plus, Search, Filter, Phone, Mailbox, Calendar, DollarSign, InfoCircle, CheckCircle, Clock, Ban, MessageSquare, Refresh, ChevronDown, X, Send, Lock, Unlock, Bell, ArrowDown, ArrowUp, Receipt } from 'reicon-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useCredits, calculateCreditStatus, useCreditTransactions, useAllCreditTransactions } from '@/hooks/useCredits';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { useAllCustomerProfiles } from '@/hooks/useCustomerProfile';
import { useProducts } from '@/hooks/useProducts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { cn } from '@/lib/utils';
import { formatBS } from '@/lib/utils';
import { NotificationCenter, CreditReminderHistoryPanel } from '@/components/notifications/NotificationCenter';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeText } from '@/lib/validations';

// Configuración de estados con colores
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVO: { label: 'Activo', color: 'bg-primary/80', icon: <TickCircle className="h-4 w-4" /> },
  POR_VENCER: { label: 'Por vencer', color: 'bg-gold/80', icon: <Clock className="h-4 w-4" /> },
  EN_GRACIA: { label: 'En gracia', color: 'bg-gold/60', icon: <InfoCircle className="h-4 w-4" /> },
  VENCIDO: { label: 'Vencido', color: 'bg-destructive/80', icon: <InfoCircle className="h-4 w-4" /> },
  BLOQUEADO: { label: 'Bloqueado', color: 'bg-gray-500', icon: <Ban className="h-4 w-4" /> },
};

// Mensajes de recordatorio predefinidos
const REMINDER_TEMPLATES = {
  '3_DAYS_BEFORE': `Estimado/a {cliente}, le recordamos que su próximo pago vence el {fecha}. El monto pendiente es de ${'{monto}'}. Agradecemos su puntualidad. - Manojitos`,
  'DUE_DATE': `Estimado/a {cliente}, hoy es la fecha de vencimiento de su pago. El monto pendiente es de ${'{monto}'}. Por favor, realice su pago lo antes posible. - Manojitos`,
  '1_DAY_AFTER': `Estimado/a {cliente}, su pago venció ayer. El monto pendiente es de ${'{monto}'}. Le invitamos a ponerse al día para evitar inconvenientes. - Manojitos`,
  '3_DAYS_AFTER': `Estimado/a {cliente}, su pago tiene 3 días de atraso. El monto pendiente es de ${'{monto}'}. Por favor, comuníquese con nosotros para regularizar su situación. Este es un aviso final antes de suspender el crédito. - Manojitos`,
};

export default function Credits() {
  // --- STATE ---
  const { isAdmin } = useAuth();
  const { credits, isLoading, createCredit, updateCredit, toggleBlock, registerPayment, createReminder, stats } = useCredits();
  const { sendManualNotification } = useNotifications();
  const { data: customerProfiles = [], isLoading: isLoadingProfiles } = useAllCustomerProfiles();
  const { data: allTransactions = [], isLoading: loadingTransactions } = useAllCreditTransactions();
  const { rate } = useExchangeRate();
  
  const queryClient = useQueryClient();

  // Obtener todos los abonos reportados pendientes (órdenes con prefijo [ABONO_CREDITO])
  const { data: reportedAbonos = [], isLoading: loadingReportedAbonos } = useQuery({
    queryKey: ['admin-reported-abonos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .like('notes', '[ABONO_CREDITO]%')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const { data: reportedRequests = [], isLoading: loadingReportedRequests } = useQuery({
    queryKey: ['admin-reported-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .like('notes', '[SOLICITUD_CREDITO]%')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const handleApproveRequest = async (requestOrder: any) => {
    try {
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('user_id')
        .eq('user_id', requestOrder.customer_user_id)
        .maybeSingle();
      
      if (profiles) {
        setSelectedProfileId(profiles.user_id);
        setCreationMode('registered');
      } else {
        setCreationMode('manual');
        setNewCredit(prev => ({
          ...prev,
          client_name: requestOrder.customer_name || '',
          client_phone: requestOrder.customer_phone || '',
          client_email: requestOrder.customer_email || ''
        }));
      }
      setIsCreateOpen(true);
      
      await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', requestOrder.id);
        
      queryClient.invalidateQueries({ queryKey: ['admin-reported-requests'] });
    } catch (e: any) {
      toast.error('Error al procesar solicitud');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', requestId);
      toast.success('Solicitud rechazada');
      queryClient.invalidateQueries({ queryKey: ['admin-reported-requests'] });
    } catch (e: any) {
      toast.error('Error al rechazar solicitud');
    }
  };

  const handleApproveReportedAbono = async (abonoOrder: any) => {
    try {
      // 1. Encontrar la cuenta de crédito correspondiente al cliente
      let { data: targetCredit, error: creditError } = await supabase
        .from('credits')
        .select('*')
        .eq('client_user_id', abonoOrder.customer_user_id)
        .maybeSingle();

      if (creditError) throw creditError;

      // Fallback por email o teléfono si no tiene client_user_id
      if (!targetCredit) {
        if (abonoOrder.customer_email) {
          const { data: emailData } = await supabase
            .from('credits')
            .select('*')
            .eq('client_email', abonoOrder.customer_email)
            .maybeSingle();
          targetCredit = emailData;
        }
        if (!targetCredit && abonoOrder.customer_phone) {
          const { data: phoneData } = await supabase
            .from('credits')
            .select('*')
            .eq('client_phone', abonoOrder.customer_phone)
            .maybeSingle();
          targetCredit = phoneData;
        }
      }

      if (!targetCredit) {
        toast.error('No se encontró una cuenta de crédito activa para este cliente.');
        return;
      }

      // 2. Registrar el abono en el crédito
      await registerPayment.mutateAsync({
        creditId: targetCredit.id,
        amount: abonoOrder.total_usd,
        description: `Abono reportado (Ref: ${abonoOrder.notes || 'N/A'})`,
      });

      // 3. Confirmar la orden de abono
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          payment_status: 'paid'
        })
        .eq('id', abonoOrder.id);

      if (orderError) throw orderError;

      toast.success('Abono aprobado y aplicado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['admin-reported-abonos'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    } catch (e: any) {
      toast.error(`Error al aprobar abono: ${e.message}`);
    }
  };

  const handleRejectReportedAbono = async (abonoOrderId: string) => {
    try {
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          payment_status: 'failed'
        })
        .eq('id', abonoOrderId);

      if (orderError) throw orderError;
      
      toast.success('Abono rechazado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['admin-reported-abonos'] });
    } catch (e: any) {
      toast.error(`Error al rechazar abono: ${e.message}`);
    }
  };

  const { products } = useProducts();
  const totalInventoryValue = useMemo(() => {
    return products?.reduce((acc, p) => acc + (Number(p.price_usd) * Number(p.stock)), 0) || 0;
  }, [products]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<'manual' | 'registered'>('manual');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [selectedCredit, setSelectedCredit] = useState<string | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [reminderType, setReminderType] = useState('3_DAYS_BEFORE');
  const [customMessage, setCustomMessage] = useState('');
  const [activeTab, setActiveTab] = useState('credits');

  // --- Historial de abonos (todas las transacciones) ---
  const [abonosSearch, setAbonosSearch] = useState('');
  const [abonosTipoFilter, setAbonosTipoFilter] = useState('all');
  
  // Canales de notificación seleccionados
  const [selectedChannels, setSelectedChannels] = useState<('internal' | 'email' | 'sms')[]>(['internal', 'email']);

  // Formulario de nuevo crédito
  const [newCredit, setNewCredit] = useState({
    client_name: '',
    client_phone: '',
    client_email: '',
    credit_limit: '',
    cut_off_day: '15',
    notes: '',
  });

  // --- DERIVED ---

  // Filtrar créditos
  const filteredCredits = useMemo(() => {
    return credits.filter(credit => {
      const matchesSearch = 
        credit.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        credit.client_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        credit.client_email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || credit.calculatedStatus === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [credits, searchTerm, statusFilter]);

  // Filtrar abonos
  const filteredAbonos = useMemo(() => {
    return allTransactions.filter(tx => {
      const matchesSearch = tx.client_name.toLowerCase().includes(abonosSearch.toLowerCase()) ||
        (tx.description || '').toLowerCase().includes(abonosSearch.toLowerCase());
      const matchesTipo = abonosTipoFilter === 'all' || tx.type === abonosTipoFilter;
      return matchesSearch && matchesTipo;
    });
  }, [allTransactions, abonosSearch, abonosTipoFilter]);

  // Total de abonos filtrados
  const totalAbonos = filteredAbonos
    .filter(tx => tx.type === 'ABONO')
    .reduce((sum, tx) => sum + tx.amount, 0);


  // Manejar creación de crédito
  const handleCreateCredit = async () => {
    await createCredit.mutateAsync({
      client_name: sanitizeText(newCredit.client_name),
      client_phone: newCredit.client_phone ? sanitizeText(newCredit.client_phone) : null,
      client_email: newCredit.client_email ? sanitizeText(newCredit.client_email) : null,
      client_user_id: creationMode === 'registered' ? selectedProfileId || null : null,
      credit_limit: parseFloat(newCredit.credit_limit) || 0,
      cut_off_day: parseInt(newCredit.cut_off_day),
      notes: newCredit.notes ? sanitizeText(newCredit.notes) : null,
    });
    setIsCreateOpen(false);
    setNewCredit({
      client_name: '',
      client_phone: '',
      client_email: '',
      credit_limit: '',
      cut_off_day: '15',
      notes: '',
    });
    setSelectedProfileId('');
    setCreationMode('manual');
  };

  // Manejar pago — incluye tasa y equivalente Bs en la description
  const handlePayment = async () => {
    if (!selectedCredit || !paymentAmount) return;
    
    const amount = parseFloat(paymentAmount);
    const credit = credits.find(c => c.id === selectedCredit);
    
    // Construir descripción enriquecida con tasa
    let description = paymentDescription ? sanitizeText(paymentDescription) : 'Pago registrado';
    if (rate > 0) {
      const amountBs = amount * rate;
      description += ` — ${formatBS(amountBs)} @ Tasa: Bs. ${rate.toFixed(2)}`;
    }
    // Marcar sobrante si el abono supera el saldo
    if (credit && amount > credit.current_balance && credit.current_balance > 0) {
      const surplus = amount - credit.current_balance;
      description += ` [Sobrante: $${surplus.toFixed(2)}]`;
    }
    
    await registerPayment.mutateAsync({
      creditId: selectedCredit,
      amount,
      description,
    });
    
    setIsPaymentOpen(false);
    setPaymentAmount('');
    setPaymentDescription('');
    setSelectedCredit(null);
  };

  // Generar mensaje de recordatorio
  const generateReminderMessage = (credit: typeof credits[0]) => {
    const template = REMINDER_TEMPLATES[reminderType as keyof typeof REMINDER_TEMPLATES];
    return template
      .replace('{cliente}', credit.client_name)
      .replace('{fecha}', credit.next_due_date ? format(new Date(credit.next_due_date), 'dd/MM/yyyy') : 'N/A')
      .replace('{monto}', `$${credit.current_balance.toFixed(2)}`);
  };

  // Manejar envío de recordatorio por múltiples canales
  const handleSendReminder = async () => {
    if (!selectedCredit || selectedChannels.length === 0) return;
    
    const credit = credits.find(c => c.id === selectedCredit);
    if (!credit) return;

    const message = customMessage ? sanitizeText(customMessage) : generateReminderMessage(credit);
    
    // Enviar a través del edge function
    await sendManualNotification.mutateAsync({
      creditId: selectedCredit,
      channels: selectedChannels,
      reminderType,
      message,
    });
    
    setIsReminderOpen(false);
    setCustomMessage('');
    setSelectedCredit(null);
    setSelectedChannels(['internal', 'email']);
  };
  
  // Toggle canal de notificación
  const toggleChannel = (channel: 'internal' | 'email' | 'sms') => {
    setSelectedChannels(prev => 
      prev.includes(channel) 
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };

  // Si no es admin, mostrar acceso denegado
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Ban className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Acceso Denegado</h2>
              <p className="text-muted-foreground">
                Esta funcionalidad es exclusiva para administradores.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // --- RENDER ---
  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gradient-gold">Gestión de Créditos</h1>
            <p className="text-muted-foreground mt-1">
              Control de créditos y notificaciones automáticas
            </p>
          </div>
          
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) {
                setCreationMode('manual');
                setNewCredit({
                  client_name: '',
                  client_phone: '',
                  client_email: '',
                  credit_limit: '',
                  cut_off_day: '15',
                  notes: '',
                });
                setSelectedProfileId('');
              }
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo Crédito
                </Button>
              </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Crédito</DialogTitle>
                <DialogDescription>
                  Autoriza una línea de crédito para un cliente
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <Tabs value={creationMode} onValueChange={(value) => {
                  setCreationMode(value as 'manual' | 'registered');
                  setNewCredit({
                    client_name: '',
                    client_phone: '',
                    client_email: '',
                    credit_limit: '',
                    cut_off_day: '15',
                    notes: '',
                  });
                  setSelectedProfileId('');
                }} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="manual">Creación Manual</TabsTrigger>
                    <TabsTrigger value="registered">Cliente Registrado</TabsTrigger>
                  </TabsList>
                  
                  {creationMode === 'registered' && (
                    <div className="space-y-2 mb-4">
                      <Label htmlFor="customer_select">Seleccionar Cliente Registrado *</Label>
                      {isLoadingProfiles ? (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground py-2">
                          <Loader className="h-4 w-4 animate-spin text-primary" />
                          <span>Cargando clientes...</span>
                        </div>
                      ) : (
                        <Select
                          value={selectedProfileId}
                          onValueChange={(value) => {
                            setSelectedProfileId(value);
                            const selected = customerProfiles.find(p => p.user_id === value);
                            if (selected) {
                              setNewCredit(prev => ({
                                ...prev,
                                client_name: selected.full_name || '',
                                client_phone: selected.phone || '',
                                client_email: selected.email || '',
                              }));
                            }
                          }}
                        >
                          <SelectTrigger id="customer_select" className="w-full">
                            <SelectValue placeholder="Seleccione un cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {customerProfiles.map(profile => (
                              <SelectItem key={profile.id} value={profile.user_id}>
                                {profile.full_name} ({profile.email || 'Sin correo'})
                              </SelectItem>
                            ))}
                            {customerProfiles.length === 0 && (
                              <SelectItem value="none" disabled>No hay clientes registrados</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </Tabs>

                <div className="space-y-2">
                  <Label htmlFor="client_name">Nombre del Cliente <span className="text-destructive">*</span></Label>
                  <Input
                    id="client_name"
                    value={newCredit.client_name}
                    onChange={e => setNewCredit(prev => ({ ...prev, client_name: e.target.value }))}
                    placeholder="Nombre completo"
                    disabled={creationMode === 'registered'}
                    aria-required="true"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_phone">Teléfono</Label>
                    <Input
                      id="client_phone"
                      value={newCredit.client_phone}
                      onChange={e => setNewCredit(prev => ({ ...prev, client_phone: e.target.value }))}
                      placeholder="+58 412..."
                      disabled={creationMode === 'registered'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_email">Email</Label>
                    <Input
                      id="client_email"
                      type="email"
                      value={newCredit.client_email}
                      onChange={e => setNewCredit(prev => ({ ...prev, client_email: e.target.value }))}
                      placeholder="correo@ejemplo.com"
                      disabled={creationMode === 'registered'}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="credit_limit">Límite de Crédito ($) <span className="text-destructive">*</span></Label>
                    <Input
                      id="credit_limit"
                      type="number"
                      value={newCredit.credit_limit}
                      onChange={e => setNewCredit(prev => ({ ...prev, credit_limit: e.target.value }))}
                      placeholder="100.00"
                      aria-required="true"
                      className={cn(Number(newCredit.credit_limit) > totalInventoryValue && "border-destructive focus-visible:ring-destructive")}
                    />
                    {Number(newCredit.credit_limit) > totalInventoryValue && (
                      <p className="text-[10px] text-destructive flex items-center gap-1">
                        <InfoCircle className="h-3 w-3" />
                        El límite no puede superar el valor del inventario (${totalInventoryValue.toFixed(2)})
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cut_off_day">Día de Corte</Label>
                    <Select
                      value={newCredit.cut_off_day}
                      onValueChange={value => setNewCredit(prev => ({ ...prev, cut_off_day: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">Día 15</SelectItem>
                        <SelectItem value="30">Día 30</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={newCredit.notes}
                    onChange={e => setNewCredit(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Observaciones adicionales..."
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateCredit}
                  disabled={!newCredit.client_name || createCredit.isPending || Number(newCredit.credit_limit) > totalInventoryValue}
                >
                  {createCredit.isPending && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                  Crear Crédito
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total clientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-primary">{stats.byStatus.ACTIVO}</p>
              <p className="text-xs text-muted-foreground">Activos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-gold">{stats.byStatus.POR_VENCER}</p>
              <p className="text-xs text-muted-foreground">Por vencer</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-gold">{stats.byStatus.EN_GRACIA}</p>
              <p className="text-xs text-muted-foreground">En gracia</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-destructive">{stats.byStatus.VENCIDO}</p>
              <p className="text-xs text-muted-foreground">Vencidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">${stats.totalBalance.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Saldo total</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Créditos | Abonos */}
        <Tabs defaultValue="creditos" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto w-full max-w-3xl justify-start">
            <TabsTrigger value="creditos">
              <CreditCard className="h-4 w-4 mr-2" />
              Créditos
            </TabsTrigger>
            <TabsTrigger value="abonos">
              <Receipt className="h-4 w-4 mr-2" />
              Historial de Abonos
            </TabsTrigger>
            <TabsTrigger value="reportados" className="relative">
              <Clock className="h-4 w-4 mr-2" />
              Abonos Reportados
              {reportedAbonos.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white animate-pulse">
                  {reportedAbonos.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="solicitudes" className="relative">
              <Plus className="h-4 w-4 mr-2" />
              Solicitudes
              {reportedRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-white animate-pulse">
                  {reportedRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ====== TAB CRÉDITOS ====== */}
          <TabsContent value="creditos" className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono o email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s@.+\-]/g, ''))}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ACTIVO">Activos</SelectItem>
              <SelectItem value="POR_VENCER">Por vencer</SelectItem>
              <SelectItem value="EN_GRACIA">En gracia</SelectItem>
              <SelectItem value="VENCIDO">Vencidos</SelectItem>
              <SelectItem value="BLOQUEADO">Bloqueados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de créditos */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredCredits.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No hay créditos</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No se encontraron créditos con los filtros aplicados'
                  : 'Crea un nuevo crédito para empezar'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {filteredCredits.map((credit, index) => {
                const status = credit.calculatedStatus || 'ACTIVO';
                const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.ACTIVO;

                const matchingProfile = !credit.client_user_id
                  ? customerProfiles.find(profile => 
                      (credit.client_email && profile.email?.toLowerCase() === credit.client_email.toLowerCase()) ||
                      (credit.client_phone && profile.phone === credit.client_phone)
                    )
                  : null;

                return (
                  <motion.div
                    key={credit.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className={cn(
                      "transition-all hover:shadow-md",
                      status === 'VENCIDO' && "border-red-500/50",
                      status === 'BLOQUEADO' && "opacity-75"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Info del cliente */}
                          <div className="flex items-start gap-4">
                            {/* Semáforo */}
                            <div className={cn(
                              "w-3 h-3 rounded-full mt-1.5 flex-shrink-0",
                              statusConfig.color
                            )} />
                            
                            <div className="space-y-1">
                              <div className="flex items-center flex-wrap gap-2">
                                <h3 className="font-semibold">{credit.client_name}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {statusConfig.icon}
                                  <span className="ml-1">{statusConfig.label}</span>
                                </Badge>
                                {credit.client_user_id ? (
                                  <Badge variant="outline" className="text-xs border-green-500/30 text-green-500 bg-green-500/5">
                                    Vinculado
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-500 bg-amber-500/5">
                                    No Vinculado
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                {credit.client_phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {credit.client_phone}
                                  </span>
                                )}
                                {credit.client_email && (
                                  <span className="flex items-center gap-1">
                                    <Mailbox className="h-3 w-3" />
                                    {credit.client_email}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Corte día {credit.cut_off_day}
                                </span>
                              </div>
                              {matchingProfile && (
                                <div className="mt-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-xs bg-gold/10 hover:bg-gold/20 text-gold border-gold/30 flex items-center gap-1 py-0.5 px-2 h-auto"
                                    onClick={async () => {
                                      try {
                                        await updateCredit.mutateAsync({
                                          id: credit.id,
                                          updates: { client_user_id: matchingProfile.user_id }
                                        });
                                        toast.success(`Crédito vinculado exitosamente al usuario ${matchingProfile.full_name || matchingProfile.email}`);
                                      } catch (e) {
                                        toast.error("Error al vincular el crédito");
                                      }
                                    }}
                                  >
                                    <Plus className="h-3 w-3" />
                                    Vincular a {matchingProfile.full_name || matchingProfile.email}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Montos */}
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-2xl font-bold">${credit.current_balance.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-medium text-muted-foreground">${credit.credit_limit.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">Límite</p>
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCredit(credit.id);
                                setIsPaymentOpen(true);
                              }}
                              disabled={credit.current_balance === 0}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Pago
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCredit(credit.id);
                                setCustomMessage(generateReminderMessage(credit));
                                setIsReminderOpen(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Recordatorio
                            </Button>
                            
                            <Button
                              variant={credit.is_blocked ? "default" : "destructive"}
                              size="sm"
                              onClick={() => toggleBlock.mutate({
                                id: credit.id,
                                block: !credit.is_blocked,
                                reason: 'Acción manual del administrador'
                              })}
                            >
                              {credit.is_blocked ? (
                                <>
                                  <Unlock className="h-4 w-4 mr-1" />
                                  Desbloquear
                                </>
                              ) : (
                                <>
                                  <Lock className="h-4 w-4 mr-1" />
                                  Bloquear
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </TabsContent>

          {/* ====== TAB ABONOS ====== */}
          <TabsContent value="abonos" className="space-y-4">
            {/* Filtros abonos */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente o descripción..."
                  value={abonosSearch}
                  onChange={e => setAbonosSearch(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s@.+\-]/g, ''))}
                  className="pl-10"
                />
              </div>
              <Select value={abonosTipoFilter} onValueChange={setAbonosTipoFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ABONO">Abonos</SelectItem>
                  <SelectItem value="CARGO">Cargos</SelectItem>
                  <SelectItem value="COMPRA">Compras</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Resumen rápido */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold">{filteredAbonos.length}</p>
                  <p className="text-xs text-muted-foreground">Movimientos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-primary">${totalAbonos.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Total abonado</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold">
                    {filteredAbonos.filter(tx => tx.type === 'ABONO').length}
                  </p>
                  <p className="text-xs text-muted-foreground">N° de abonos</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabla de transacciones */}
            {loadingTransactions ? (
              <div className="flex justify-center py-12">
                <Loader className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredAbonos.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No hay movimientos</h3>
                  <p className="text-muted-foreground">
                    {abonosSearch || abonosTipoFilter !== 'all'
                      ? 'No se encontraron movimientos con los filtros aplicados'
                      : 'Los abonos aparecerán aquí cuando se registren'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Historial de Movimientos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y divide-border">
                      {filteredAbonos.map(tx => {
                        // Parsear la descripción para extraer Bs, tasa y referencia
                        const desc = tx.description || tx.type;
                        const bsMatch = desc.match(/Bs\.\s*([\d,.]+)/);
                        const tasaMatch = desc.match(/Tasa:\s*Bs\.\s*([\d.]+)/);
                        const surplusMatch = desc.match(/\[Sobrante:\s*\$([\d.]+)\]/);
                        // Descripción limpia sin las notas técnicas
                        const cleanDesc = desc
                          .replace(/\s*—\s*Bs\.\s*[\d,.]+\s*@\s*Tasa:\s*Bs\.\s*[\d.]+/g, '')
                          .replace(/\s*\[Sobrante:[^\]]*\]/g, '')
                          .trim();
                        const bsAmount = bsMatch ? bsMatch[1] : null;
                        const tasaVal = tasaMatch ? tasaMatch[1] : null;
                        const surplusVal = surplusMatch ? surplusMatch[1] : null;
                        const isPaid = tx.new_balance === 0 && tx.type === 'ABONO';

                        return (
                          <div
                            key={tx.id}
                            className="flex items-start justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                                tx.type === 'ABONO' ? 'bg-primary/10' : 'bg-destructive/10'
                              )}>
                                {tx.type === 'ABONO' ? (
                                  <ArrowDown className="h-4 w-4 text-primary" />
                                ) : (
                                  <ChartSuccess className="h-4 w-4 text-destructive" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm">{tx.client_name}</p>
                                  {isPaid && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                      PAGADO
                                    </span>
                                  )}
                                  {surplusVal && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                      +${surplusVal} sobrante
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {cleanDesc}
                                </p>
                                {(bsAmount || tasaVal) && (
                                  <p className="text-xs text-muted-foreground/80 mt-0.5">
                                    {bsAmount && <span>Bs. {bsAmount}</span>}
                                    {tasaVal && <span className="ml-2">· Tasa: {tasaVal}</span>}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground/60 mt-0.5">
                                  {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className={cn(
                                'font-bold',
                                tx.type === 'ABONO' ? 'text-primary' : 'text-destructive'
                              )}>
                                {tx.type === 'ABONO' ? '-' : '+'}${tx.amount.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Saldo: ${tx.new_balance.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="reportados" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gold animate-pulse" />
                  Abonos Reportados por Clientes
                </CardTitle>
                <CardDescription>
                  Revisa y aprueba o rechaza los reportes de abono realizados por los clientes desde sus perfiles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingReportedAbonos ? (
                  <div className="flex justify-center py-12">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : reportedAbonos.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No hay reportes de abonos pendientes de verificación.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reportedAbonos.map(abono => {
                      const matchRef = abono.notes?.match(/Referencia:\s*([^\.]+)/i);
                      const matchMethod = abono.notes?.match(/Método:\s*([^\.]+)/i);
                      const refText = matchRef ? matchRef[1] : 'N/A';
                      const methodText = matchMethod ? matchMethod[1] : (abono.payment_method || 'N/A');

                      return (
                        <div
                          key={abono.id}
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-border bg-secondary/30 gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-foreground">
                                {abono.customer_name}
                              </h4>
                              <Badge className="bg-gold/10 text-gold border border-gold/30 hover:bg-gold/15 text-[10px] px-2 py-0.5">
                                Pendiente
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Monto Reportado: <span className="font-bold text-foreground">${abono.total_usd.toFixed(2)}</span>
                            </p>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                              <span>Método: <strong>{methodText.toUpperCase()}</strong></span>
                              <span>Ref: <strong>{refText}</strong></span>
                              <span>Fecha: <strong>{format(new Date(abono.created_at), "dd MMM yyyy, HH:mm", { locale: es })}</strong></span>
                            </div>
                            {abono.customer_email && (
                              <p className="text-[11px] text-muted-foreground">
                                Email de contacto: {abono.customer_email} {abono.customer_phone && `• Tel: ${abono.customer_phone}`}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 self-end md:self-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs border-destructive/30 hover:bg-destructive/10 text-destructive hover:text-destructive"
                              onClick={() => handleRejectReportedAbono(abono.id)}
                            >
                              Rechazar
                            </Button>
                            <Button
                              size="sm"
                              className="text-xs bg-primary text-white hover:bg-primary/95"
                              onClick={() => handleApproveReportedAbono(abono)}
                            >
                              Aprobar y Aplicar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="solicitudes" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-gold" />
                  Solicitudes de Crédito
                </CardTitle>
                <CardDescription>
                  Revisa y procesa las solicitudes de crédito enviadas por los clientes que han completado su KYC.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingReportedRequests ? (
                  <div className="flex justify-center py-12">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : reportedRequests.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No hay solicitudes de crédito pendientes.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reportedRequests.map(request => {
                      const matchNotes = request.notes?.replace('[SOLICITUD_CREDITO] ', '');

                      return (
                        <div
                          key={request.id}
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-border bg-secondary/30 gap-4"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-foreground">
                                {request.customer_name}
                              </h4>
                              <Badge className="bg-gold/10 text-gold border border-gold/30 hover:bg-gold/15 text-[10px] px-2 py-0.5">
                                Nueva Solicitud
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                              <span>Fecha: <strong>{format(new Date(request.created_at), "dd MMM yyyy", { locale: es })}</strong></span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {matchNotes}
                            </p>
                            {request.customer_email && (
                              <p className="text-[11px] text-muted-foreground mt-2">
                                Email: {request.customer_email} {request.customer_phone && `• Tel: ${request.customer_phone}`}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 self-end md:self-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs border-destructive/30 hover:bg-destructive/10 text-destructive hover:text-destructive"
                              onClick={() => handleRejectRequest(request.id)}
                            >
                              Rechazar
                            </Button>
                            <Button
                              size="sm"
                              className="text-xs bg-gold hover:bg-gold/90 text-white"
                              onClick={() => handleApproveRequest(request)}
                            >
                              Procesar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de pago */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Pago</DialogTitle>
              <DialogDescription>
                {(() => {
                  const credit = credits.find(c => c.id === selectedCredit);
                  return credit ? `Saldo actual: $${credit.current_balance.toFixed(2)}` : 'Registra un abono al crédito del cliente';
                })()}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="payment_amount">Monto del Pago (USD)</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
                {/* Equivalente en Bs con tasa */}
                {paymentAmount && parseFloat(paymentAmount) > 0 && rate > 0 && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Equivalente:{' '}
                      <span className="font-bold text-primary">
                        {formatBS(parseFloat(paymentAmount) * rate)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tasa del día: Bs. {rate.toFixed(2)} / $
                    </p>
                    {/* Advertencia si el abono supera el saldo */}
                    {(() => {
                      const credit = credits.find(c => c.id === selectedCredit);
                      const amount = parseFloat(paymentAmount);
                      if (credit && amount > credit.current_balance && credit.current_balance > 0) {
                        return (
                          <p className="text-xs text-amber-500 flex items-center gap-1">
                            <InfoCircle className="h-3 w-3" />
                            Sobrante de ${(amount - credit.current_balance).toFixed(2)} (pago excede el saldo)
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment_description">Referencia / Descripción (opcional)</Label>
                <Input
                  id="payment_description"
                  value={paymentDescription}
                  onChange={e => setPaymentDescription(e.target.value)}
                  placeholder="Ej: Ref. 12345678 / Efectivo"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handlePayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || registerPayment.isPending}
              >
                {registerPayment.isPending && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                Registrar Pago
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de recordatorio */}
        <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg">
            <DialogHeader>
              <DialogTitle>Enviar Recordatorio</DialogTitle>
              <DialogDescription>
                Crea un recordatorio de pago para el cliente
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Recordatorio</Label>
                <Select value={reminderType} onValueChange={value => {
                  setReminderType(value);
                  const credit = credits.find(c => c.id === selectedCredit);
                  if (credit) {
                    setCustomMessage(REMINDER_TEMPLATES[value as keyof typeof REMINDER_TEMPLATES]
                      .replace('{cliente}', credit.client_name)
                      .replace('{fecha}', credit.next_due_date ? format(new Date(credit.next_due_date), 'dd/MM/yyyy') : 'N/A')
                      .replace('{monto}', `$${credit.current_balance.toFixed(2)}`));
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3_DAYS_BEFORE">3 días antes del vencimiento</SelectItem>
                    <SelectItem value="DUE_DATE">Día del vencimiento</SelectItem>
                    <SelectItem value="1_DAY_AFTER">1 día de atraso</SelectItem>
                    <SelectItem value="3_DAYS_AFTER">3 días de atraso (aviso final)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Canales de Envío</Label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={selectedChannels.includes('internal')} onCheckedChange={() => toggleChannel('internal')} />
                    <Bell className="h-4 w-4" />
                    <span className="text-sm">Interno</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={selectedChannels.includes('email')} onCheckedChange={() => toggleChannel('email')} />
                    <Mailbox className="h-4 w-4" />
                    <span className="text-sm">Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={selectedChannels.includes('sms')} onCheckedChange={() => toggleChannel('sms')} />
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">SMS</span>
                  </label>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="custom_message">Mensaje</Label>
                <Textarea
                  id="custom_message"
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  rows={5}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReminderOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSendReminder}
                disabled={!customMessage || selectedChannels.length === 0 || sendManualNotification.isPending}
              >
                {sendManualNotification.isPending && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" />
                Enviar Recordatorio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
