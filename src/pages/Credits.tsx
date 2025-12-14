import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  MessageSquare,
  Loader2,
  ChevronDown,
  X,
  Send,
  Lock,
  Unlock,
  Bell,
} from 'lucide-react';
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
import { useCredits, calculateCreditStatus } from '@/hooks/useCredits';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { NotificationCenter, CreditReminderHistoryPanel } from '@/components/notifications/NotificationCenter';

// Configuración de estados con colores
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVO: { label: 'Activo', color: 'bg-green-500', icon: <CheckCircle2 className="h-4 w-4" /> },
  POR_VENCER: { label: 'Por vencer', color: 'bg-yellow-500', icon: <Clock className="h-4 w-4" /> },
  EN_GRACIA: { label: 'En gracia', color: 'bg-orange-500', icon: <AlertCircle className="h-4 w-4" /> },
  VENCIDO: { label: 'Vencido', color: 'bg-red-500', icon: <AlertCircle className="h-4 w-4" /> },
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
  const { isAdmin } = useAuth();
  const { credits, isLoading, createCredit, updateCredit, toggleBlock, registerPayment, createReminder } = useCredits();
  const { sendManualNotification } = useNotifications();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<string | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [reminderType, setReminderType] = useState('3_DAYS_BEFORE');
  const [customMessage, setCustomMessage] = useState('');
  const [activeTab, setActiveTab] = useState('credits');
  
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

  // Filtrar créditos
  const filteredCredits = useMemo(() => {
    return credits.filter(credit => {
      const matchesSearch = 
        credit.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        credit.client_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        credit.client_email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const calculatedStatus = calculateCreditStatus(
        credit.next_due_date,
        credit.grace_days,
        credit.is_blocked
      );
      
      const matchesStatus = statusFilter === 'all' || calculatedStatus === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [credits, searchTerm, statusFilter]);

  // Estadísticas
  const stats = useMemo(() => {
    const byStatus = {
      ACTIVO: 0,
      POR_VENCER: 0,
      EN_GRACIA: 0,
      VENCIDO: 0,
      BLOQUEADO: 0,
    };
    let totalBalance = 0;

    credits.forEach(credit => {
      const status = calculateCreditStatus(
        credit.next_due_date,
        credit.grace_days,
        credit.is_blocked
      );
      byStatus[status as keyof typeof byStatus]++;
      totalBalance += credit.current_balance;
    });

    return { byStatus, totalBalance, total: credits.length };
  }, [credits]);

  // Manejar creación de crédito
  const handleCreateCredit = async () => {
    await createCredit.mutateAsync({
      client_name: newCredit.client_name,
      client_phone: newCredit.client_phone || null,
      client_email: newCredit.client_email || null,
      credit_limit: parseFloat(newCredit.credit_limit) || 0,
      cut_off_day: parseInt(newCredit.cut_off_day),
      notes: newCredit.notes || null,
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
  };

  // Manejar pago
  const handlePayment = async () => {
    if (!selectedCredit || !paymentAmount) return;
    
    await registerPayment.mutateAsync({
      creditId: selectedCredit,
      amount: parseFloat(paymentAmount),
      description: paymentDescription || undefined,
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

    const message = customMessage || generateReminderMessage(credit);
    
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
              Control de fiados y notificaciones automáticas
            </p>
          </div>
          
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo Crédito
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Crédito</DialogTitle>
                <DialogDescription>
                  Autoriza una línea de crédito para un cliente
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="client_name">Nombre del Cliente *</Label>
                  <Input
                    id="client_name"
                    value={newCredit.client_name}
                    onChange={e => setNewCredit(prev => ({ ...prev, client_name: e.target.value }))}
                    placeholder="Nombre completo"
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
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="credit_limit">Límite de Crédito ($)</Label>
                    <Input
                      id="credit_limit"
                      type="number"
                      value={newCredit.credit_limit}
                      onChange={e => setNewCredit(prev => ({ ...prev, credit_limit: e.target.value }))}
                      placeholder="100.00"
                    />
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
                  disabled={!newCredit.client_name || createCredit.isPending}
                >
                  {createCredit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear Crédito
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total clientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-green-600">{stats.byStatus.ACTIVO}</p>
              <p className="text-xs text-muted-foreground">Activos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-yellow-600">{stats.byStatus.POR_VENCER}</p>
              <p className="text-xs text-muted-foreground">Por vencer</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-orange-600">{stats.byStatus.EN_GRACIA}</p>
              <p className="text-xs text-muted-foreground">En gracia</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-red-600">{stats.byStatus.VENCIDO}</p>
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

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono o email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                const status = calculateCreditStatus(
                  credit.next_due_date,
                  credit.grace_days,
                  credit.is_blocked
                );
                const statusConfig = STATUS_CONFIG[status];

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
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{credit.client_name}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {statusConfig.icon}
                                  <span className="ml-1">{statusConfig.label}</span>
                                </Badge>
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
                                    <Mail className="h-3 w-3" />
                                    {credit.client_email}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Corte día {credit.cut_off_day}
                                </span>
                              </div>
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

        {/* Modal de pago */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pago</DialogTitle>
              <DialogDescription>
                Registra un abono al crédito del cliente
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="payment_amount">Monto del Pago ($)</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment_description">Descripción (opcional)</Label>
                <Input
                  id="payment_description"
                  value={paymentDescription}
                  onChange={e => setPaymentDescription(e.target.value)}
                  placeholder="Ej: Pago en efectivo"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handlePayment}
                disabled={!paymentAmount || registerPayment.isPending}
              >
                {registerPayment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar Pago
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de recordatorio */}
        <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
          <DialogContent className="max-w-lg">
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
                    <Mail className="h-4 w-4" />
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
                {sendManualNotification.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
