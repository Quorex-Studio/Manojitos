import { useState } from 'react';
import { useCustomers, CustomerProfile } from '@/hooks/useCustomers';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { UserCheck, UserX, Refresh, Search, FileText, Image as ImageIcon, Users, Mailbox, Phone, Calendar, ShieldAlert, CheckCircle, Clock, XCircle, ChevronRight, ChevronLeft, Map, Key, Ban, Trash2, Unlock } from 'reicon-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// --- Customer History Component ---
function CustomerHistory({ userId, phone }: { userId: string, phone: string | null }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['admin-customer-history', userId],
    queryFn: async () => {
      // Fetch Orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, created_at, total_usd, status, items')
        .eq('customer_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch Sales (legacy/direct sales)
      let salesQuery = supabase
        .from('sales')
        .select('id, created_at, total_usd, status, product_name, quantity')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (phone) {
        salesQuery = salesQuery.or(`client_phone.eq.${phone},user_id.eq.${userId}`);
      } else {
        salesQuery = salesQuery.eq('user_id', userId);
      }
      const { data: sales } = await salesQuery;

      // Fetch Credit
      const { data: credits } = await supabase
        .from('credits')
        .select('*')
        .eq('client_user_id', userId)
        .maybeSingle();

      return { orders: orders || [], sales: sales || [], credit: credits };
    },
    enabled: !!userId
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Credit Section */}
      {history?.credit ? (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-3">
          <h4 className="font-semibold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Línea de Crédito Activa
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Límite</p>
              <p className="font-semibold">${history.credit.credit_limit}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance Actual</p>
              <p className="font-semibold">${history.credit.current_balance}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="font-semibold">{history.credit.trust_score}/100</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado</p>
              <Badge variant={history.credit.is_blocked ? "destructive" : "default"} className="mt-1 text-xs">
                {history.credit.is_blocked ? "BLOQUEADO" : history.credit.status}
              </Badge>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-muted/30 border border-border/50 rounded-xl p-5 text-center text-muted-foreground text-sm">
          El cliente no posee una línea de crédito activa.
        </div>
      )}

      {/* Orders Section */}
      <div>
        <h4 className="font-semibold text-foreground/90 flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary" /> Historial de Compras Recientes
        </h4>
        {(!history?.orders.length && !history?.sales.length) ? (
          <div className="bg-background/40 border border-border/50 rounded-xl p-8 text-center text-muted-foreground text-sm">
            No se encontraron compras recientes para este cliente.
          </div>
        ) : (
          <div className="space-y-3">
            {history?.orders.map(order => (
              <div key={order.id} className="bg-background/40 border border-border/50 rounded-xl p-4 flex flex-col md:flex-row justify-between md:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                      {order.id.split('-')[0]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(order.created_at), "dd MMM yyyy", { locale: es })}
                    </span>
                  </div>
                  <p className="text-sm font-medium">Pedido Web ({(order.items as any[])?.length || 0} items)</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="capitalize">{order.status}</Badge>
                  <p className="font-bold text-primary">${order.total_usd}</p>
                </div>
              </div>
            ))}
            
            {history?.sales.map(sale => (
              <div key={sale.id} className="bg-background/40 border border-border/50 rounded-xl p-4 flex flex-col md:flex-row justify-between md:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                      {sale.id.split('-')[0]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(sale.created_at), "dd MMM yyyy", { locale: es })}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{sale.product_name} (x{sale.quantity})</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="capitalize">{sale.status}</Badge>
                  <p className="font-bold text-primary">${sale.total_usd}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// ----------------------------------

export default function Customers() {
  const navigate = useNavigate();
  const { customers, isLoading, updateKycStatus } = useCustomers();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          customer.phone?.includes(searchTerm) ||
                          customer.dni?.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || customer.kyc_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = async (userId: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      await updateKycStatus.mutateAsync({ userId, status });
      toast({
        title: "Estado actualizado",
        description: `El estado KYC ha sido cambiado a ${status === 'approved' ? 'aprobado' : status === 'rejected' ? 'rechazado' : 'pendiente'}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Hubo un problema actualizando el estado.",
        variant: "destructive"
      });
    }
  };

  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const handleAdminAction = async (action: 'suspend' | 'restore' | 'delete' | 'change_password', userId: string) => {
    if (action === 'change_password' && (!adminPassword || adminPassword.length < 6)) {
      toast({ title: 'Contraseña inválida', description: 'La contraseña debe tener al menos 6 caracteres.', variant: 'destructive' });
      return;
    }

    if (action === 'delete') {
      if (!window.confirm('¿Estás seguro de ELIMINAR este cliente? Esta acción no se puede deshacer.')) return;
    }

    if (action === 'suspend') {
      if (!window.confirm('¿Estás seguro de SUSPENDER a este cliente? No podrá iniciar sesión.')) return;
    }

    setIsProcessingAction(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action,
          userId,
          newPassword: action === 'change_password' ? adminPassword : null
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Ocurrió un error al ejecutar la acción');
      }

      toast({
        title: 'Acción completada',
        description: `Se ejecutó la acción: ${action} exitosamente.`,
      });
      setAdminPassword('');
      if (action === 'delete') {
         setSelectedCustomer(null);
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error de Seguridad',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1 flex w-fit items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/> Aprobado</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 px-3 py-1 flex w-fit items-center gap-1.5"><XCircle className="w-3.5 h-3.5"/> Rechazado</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 px-3 py-1 flex w-fit items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Pendiente</Badge>;
      default:
        return <Badge variant="secondary" className="bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 border border-slate-500/20 px-3 py-1 flex w-fit items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5"/> No Iniciado</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="h-6 w-6 text-emerald-500" />;
      case 'rejected': return <XCircle className="h-6 w-6 text-red-500" />;
      case 'pending': return <Clock className="h-6 w-6 text-amber-500" />;
      default: return <ShieldAlert className="h-6 w-6 text-slate-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
          <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col gap-4">
            <Button 
              variant="ghost" 
              className="w-fit text-muted-foreground hover:text-foreground pl-0 group"
              onClick={() => navigate('/dashboard')}
            >
              <ChevronLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Volver al Panel General
            </Button>
            
            <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="page-header">
              Directorio de Clientes
            </h1>
            <p className="page-subtitle mt-1 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Gestiona identidades y niveles de acceso a crédito (KYC)
            </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-center glass-card p-5 rounded-2xl">
        <div className="relative flex-1 w-full group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <Input
            placeholder="Buscar por nombre, teléfono o cédula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-]/g, ''))}
            className="pl-11 h-12 input-glass rounded-xl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[220px] h-12 input-glass rounded-xl">
            <SelectValue placeholder="Filtrar por Estado KYC" />
          </SelectTrigger>
          <SelectContent className="rounded-xl glass-card border-border/50">
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendientes de revisión</SelectItem>
            <SelectItem value="approved">Aprobados</SelectItem>
            <SelectItem value="rejected">Rechazados</SelectItem>
            <SelectItem value="none">Sin solicitar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table Section */}
      <div className="glass-card rounded-2xl overflow-x-auto">
        <div>
          <Table>
            <TableHeader className="bg-muted/30 border-b border-border/30">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="font-semibold text-muted-foreground py-4 pl-6">Cliente</TableHead>
                <TableHead className="font-semibold text-muted-foreground py-4">Contacto</TableHead>
                <TableHead className="font-semibold text-muted-foreground py-4">Registro</TableHead>
                <TableHead className="font-semibold text-muted-foreground py-4">Estado KYC</TableHead>
                <TableHead className="font-semibold text-muted-foreground py-4 text-right pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-[300px] text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 text-muted-foreground">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
                        <Users className="h-8 w-8 text-white/20" />
                      </div>
                      <p className="text-lg font-medium text-foreground/60">No se encontraron clientes</p>
                      <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors group">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-border/50 shadow-lg group-hover:border-primary/50 transition-colors">
                          <AvatarImage src={customer.face_photo_url || ''} alt={customer.full_name} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                            {customer.full_name?.substring(0, 2).toUpperCase() || 'CL'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-foreground/90 group-hover:text-primary transition-colors">{customer.full_name}</div>
                          <div className="text-sm text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[9px]">ID</span>
                            {customer.dni || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="space-y-1.5">
                        <div className="text-sm text-foreground/80 flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          {customer.phone}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" />
                          {customer.email || 'Sin correo'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 opacity-50" />
                        {format(new Date(customer.created_at), "dd MMM, yyyy", { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {getStatusBadge(customer.kyc_status)}
                    </TableCell>
                    <TableCell className="text-right pr-6 py-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedCustomer(customer)}
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full px-4"
                          >
                            Evaluar
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[700px] glass-card text-foreground p-0 overflow-hidden shadow-2xl rounded-2xl border-border/50">
                          {selectedCustomer && (
                            <>
                              {/* Modal Header Profile */}
                              <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b border-white/5 p-8 pb-6">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-5">
                                    <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-xl shadow-primary/5">
                                      <AvatarImage src={selectedCustomer.face_photo_url || ''} alt={selectedCustomer.full_name} className="object-cover" />
                                      <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                                        {selectedCustomer.full_name?.substring(0, 2).toUpperCase() || 'CL'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <DialogTitle className="text-2xl font-bold text-foreground mb-1">{selectedCustomer.full_name}</DialogTitle>
                                      <DialogDescription className="text-base text-muted-foreground">
                                        Evaluación de Identidad y Riesgo
                                      </DialogDescription>
                                      <div className="mt-3">
                                        {getStatusBadge(selectedCustomer.kyc_status)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-3 bg-background/50 rounded-full border border-border/50 shadow-inner">
                                    {getStatusIcon(selectedCustomer.kyc_status)}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="p-0">
                                <Tabs defaultValue="perfil" className="w-full">
                                  <div className="px-8 pt-4 border-b border-border/30 bg-muted/10">
                                    <TabsList className="bg-transparent p-0 h-auto gap-4">
                                      <TabsTrigger value="perfil" className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/50 px-4 py-2 rounded-t-lg rounded-b-none data-[state=active]:text-primary transition-colors">
                                        <UserCheck className="w-4 h-4 mr-2" /> Perfil Completo
                                      </TabsTrigger>
                                      <TabsTrigger value="kyc" className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/50 px-4 py-2 rounded-t-lg rounded-b-none data-[state=active]:text-primary transition-colors">
                                        <ShieldAlert className="w-4 h-4 mr-2" /> KYC (Identidad)
                                      </TabsTrigger>
                                      <TabsTrigger value="historial" className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/50 px-4 py-2 rounded-t-lg rounded-b-none data-[state=active]:text-primary transition-colors">
                                        <FileText className="w-4 h-4 mr-2" /> Historial
                                      </TabsTrigger>
                                      <TabsTrigger value="acciones" className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/50 px-4 py-2 rounded-t-lg rounded-b-none data-[state=active]:text-primary transition-colors">
                                        <KeyRound className="w-4 h-4 mr-2" /> Acciones
                                      </TabsTrigger>
                                    </TabsList>
                                  </div>

                                  <TabsContent value="perfil" className="p-8 space-y-6 mt-0">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                      <FileText className="w-5 h-5 text-primary" /> Información de Contacto
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="bg-background/40 border border-border/50 rounded-xl p-4 flex items-center gap-4">
                                        <div className="bg-primary/10 p-3 rounded-lg text-primary">
                                          <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Documento C.I</p>
                                          <p className="font-semibold text-foreground font-mono mt-0.5">{selectedCustomer.dni || 'No provisto'}</p>
                                        </div>
                                      </div>
                                      <div className="bg-background/40 border border-border/50 rounded-xl p-4 flex items-center gap-4">
                                        <div className="bg-primary/10 p-3 rounded-lg text-primary">
                                          <Phone className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Teléfono</p>
                                          <p className="font-semibold text-foreground mt-0.5">{selectedCustomer.phone}</p>
                                        </div>
                                      </div>
                                      <div className="bg-background/40 border border-border/50 rounded-xl p-4 flex items-center gap-4 col-span-2">
                                        <div className="bg-primary/10 p-3 rounded-lg text-primary">
                                          <MapPin className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dirección de Envío</p>
                                          <p className="font-semibold text-foreground mt-0.5">{selectedCustomer.address || 'Sin dirección registrada'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </TabsContent>

                                  <TabsContent value="kyc" className="p-8 space-y-8 mt-0">
                                    {/* KYC Photos */}
                                    <div className="space-y-4">
                                      <h4 className="font-semibold flex items-center text-foreground/90">
                                        <ImageIcon className="h-5 w-5 mr-2 text-primary" />
                                        Evidencia de Verdad (KYC)
                                      </h4>
                                      
                                      {selectedCustomer.kyc_status === 'none' ? (
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                          <ShieldAlert className="w-8 h-8 text-amber-500 mb-3" />
                                          <p className="text-amber-500 font-medium">No hay documentos enviados</p>
                                          <p className="text-sm text-amber-500/70 mt-1">El cliente aún no ha iniciado el proceso de verificación KYC.</p>
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                          <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                              <p className="text-sm font-medium text-foreground/80">Cédula de Identidad</p>
                                            </div>
                                            {selectedCustomer.dni_photo_url ? (
                                              <a href={selectedCustomer.dni_photo_url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video rounded-xl overflow-hidden border border-border/50 bg-background/50 group shadow-lg">
                                                <img src={selectedCustomer.dni_photo_url} alt="Cédula" className="object-cover w-full h-full transition-all duration-500 group-hover:scale-110 group-hover:opacity-50" />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <span className="bg-background/80 backdrop-blur-sm text-foreground text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2">
                                                    <Search className="w-3.5 h-3.5" /> Ampliar
                                                  </span>
                                                </div>
                                              </a>
                                            ) : (
                                              <div className="aspect-video rounded-xl border border-dashed border-border/50 bg-background/20 flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <FileText className="w-6 h-6 opacity-20" />
                                                <span className="text-xs">Falta documento</span>
                                              </div>
                                            )}
                                          </div>
                                          
                                          <div className="space-y-3">
                                            <p className="text-sm font-medium text-foreground/80">Selfie con Documento</p>
                                            {selectedCustomer.verification_photo_url ? (
                                              <a href={selectedCustomer.verification_photo_url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video rounded-xl overflow-hidden border border-border/50 bg-background/50 group shadow-lg">
                                                <img src={selectedCustomer.verification_photo_url} alt="Verificación" className="object-cover w-full h-full transition-all duration-500 group-hover:scale-110 group-hover:opacity-50" />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <span className="bg-background/80 backdrop-blur-sm text-foreground text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2">
                                                    <Search className="w-3.5 h-3.5" /> Ampliar
                                                  </span>
                                                </div>
                                              </a>
                                            ) : (
                                              <div className="aspect-video rounded-xl border border-dashed border-border/50 bg-background/20 flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <ImageIcon className="w-6 h-6 opacity-20" />
                                                <span className="text-xs">Falta documento</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap gap-3 pt-6 border-t border-border/30">
                                      {selectedCustomer.kyc_status !== 'rejected' && (
                                        <Button 
                                          variant="outline" 
                                          className="flex-1 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 h-12"
                                          onClick={() => handleUpdateStatus(selectedCustomer.user_id, 'rejected')}
                                          disabled={updateKycStatus.isPending}
                                        >
                                          <XCircle className="h-4 w-4 mr-2" />
                                          Rechazar
                                        </Button>
                                      )}
                                      
                                      {selectedCustomer.kyc_status !== 'pending' && selectedCustomer.kyc_status !== 'none' && (
                                        <Button 
                                          variant="outline"
                                          className="flex-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 h-12"
                                          onClick={() => handleUpdateStatus(selectedCustomer.user_id, 'pending')}
                                          disabled={updateKycStatus.isPending}
                                        >
                                          <Clock className="h-4 w-4 mr-2" />
                                          Revisar de nuevo
                                        </Button>
                                      )}

                                      {selectedCustomer.kyc_status !== 'approved' && (
                                        <Button 
                                          className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 h-12"
                                          onClick={() => handleUpdateStatus(selectedCustomer.user_id, 'approved')}
                                          disabled={updateKycStatus.isPending}
                                        >
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          Aprobar Verificación
                                        </Button>
                                      )}
                                    </div>
                                  </TabsContent>

                                  <TabsContent value="historial" className="p-8 mt-0">
                                    <CustomerHistory userId={selectedCustomer.user_id} phone={selectedCustomer.phone} />
                                  </TabsContent>

                                  <TabsContent value="acciones" className="p-8 space-y-6 mt-0">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-red-400 mb-4">
                                      <ShieldAlert className="w-5 h-5" /> Panel de Seguridad y Peligro
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Contraseña */}
                                      <div className="bg-background/40 border border-border/50 rounded-xl p-5 space-y-4">
                                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                          <KeyRound className="w-4 h-4" /> Forzar Cambio de Clave
                                        </h4>
                                        <form 
                                          className="flex gap-2"
                                          onSubmit={(e) => {
                                            e.preventDefault();
                                            handleAdminAction('change_password', selectedCustomer.user_id);
                                          }}
                                        >
                                          {/* Hidden input to prevent autofill heuristics from targeting the search bar */}
                                          <input type="text" autoComplete="username" style={{ display: 'none' }} />
                                          <Input 
                                            placeholder="Nueva clave" 
                                            type="password" 
                                            autoComplete="new-password"
                                            value={adminPassword}
                                            onChange={(e) => setAdminPassword(e.target.value)}
                                            className="input-glass border-border/50"
                                          />
                                          <Button 
                                            type="submit"
                                            variant="secondary" 
                                            disabled={isProcessingAction}
                                          >
                                            Actualizar
                                          </Button>
                                        </form>
                                      </div>

                                      {/* Suspensión */}
                                      <div className="bg-background/40 border border-border/50 rounded-xl p-5 space-y-4">
                                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                          <Ban className="w-4 h-4" /> Estado de Acceso
                                        </h4>
                                        <div className="flex gap-2">
                                          <Button 
                                            variant="outline" 
                                            className="flex-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                                            onClick={() => handleAdminAction('suspend', selectedCustomer.user_id)}
                                            disabled={isProcessingAction}
                                          >
                                            <Ban className="w-4 h-4 mr-2" /> Suspender
                                          </Button>
                                          <Button 
                                            variant="outline" 
                                            className="flex-1 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                                            onClick={() => handleAdminAction('restore', selectedCustomer.user_id)}
                                            disabled={isProcessingAction}
                                          >
                                            <Unlock className="w-4 h-4 mr-2" /> Restaurar
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      {/* Eliminación */}
                                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 md:col-span-2 flex items-center justify-between">
                                        <div>
                                          <h4 className="font-semibold text-sm uppercase tracking-wider text-red-500/80 mb-1">
                                            Zona Roja
                                          </h4>
                                          <p className="text-sm text-muted-foreground">Elimina por completo la cuenta y todos sus datos. Esta acción es irreversible.</p>
                                        </div>
                                        <Button 
                                          variant="destructive"
                                          onClick={() => handleAdminAction('delete', selectedCustomer.user_id)}
                                          disabled={isProcessingAction}
                                          className="shadow-lg shadow-red-500/20"
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" /> Eliminar Cuenta
                                        </Button>
                                      </div>
                                    </div>
                                  </TabsContent>
                                </Tabs>
                              </div>
                            </>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
