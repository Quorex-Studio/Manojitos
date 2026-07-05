import { useState } from 'react';
import { useCustomers, CustomerProfile } from '@/hooks/useCustomers';
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { UserCheck, UserX, Loader2, Search, FileText, Image as ImageIcon, Users, Mail, Phone, Calendar, ShieldAlert, CheckCircle2, Clock, XCircle, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

export default function Customers() {
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              Directorio de Clientes
            </h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Gestiona identidades y niveles de acceso a crédito (KYC)
            </p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card/40 backdrop-blur-md p-5 rounded-2xl border border-white/5 shadow-xl">
        <div className="relative flex-1 w-full group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <Input
            placeholder="Buscar por nombre, teléfono o cédula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-12 bg-black/20 border-white/10 text-white placeholder:text-muted-foreground focus-visible:ring-primary/50 focus-visible:border-primary/50 rounded-xl transition-all"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[220px] h-12 bg-black/20 border-white/10 rounded-xl focus:ring-primary/50">
            <SelectValue placeholder="Filtrar por Estado KYC" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-white/10 bg-zinc-950/95 backdrop-blur-xl">
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendientes de revisión</SelectItem>
            <SelectItem value="approved">Aprobados</SelectItem>
            <SelectItem value="rejected">Rechazados</SelectItem>
            <SelectItem value="none">Sin solicitar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table Section */}
      <div className="rounded-2xl border border-white/5 bg-card/20 backdrop-blur-sm overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-black/40 border-b border-white/5">
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
                      <p className="text-lg font-medium text-white/60">No se encontraron clientes</p>
                      <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-white/10 shadow-lg group-hover:border-primary/50 transition-colors">
                          <AvatarImage src={customer.face_photo_url || ''} alt={customer.full_name} className="object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-zinc-800 to-zinc-900 text-primary font-semibold text-lg">
                            {customer.full_name?.substring(0, 2).toUpperCase() || 'CL'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-white/90 group-hover:text-primary transition-colors">{customer.full_name}</div>
                          <div className="text-sm text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px]">ID</span>
                            {customer.dni || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="space-y-1.5">
                        <div className="text-sm text-white/80 flex items-center gap-2">
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
                            className="text-white/60 hover:text-primary hover:bg-primary/10 rounded-full px-4"
                          >
                            Evaluar
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[700px] bg-zinc-950/95 backdrop-blur-2xl border-white/10 text-foreground p-0 overflow-hidden shadow-2xl rounded-2xl">
                          {selectedCustomer && (
                            <>
                              {/* Modal Header Profile */}
                              <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b border-white/5 p-8 pb-6">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-5">
                                    <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-xl shadow-primary/5">
                                      <AvatarImage src={selectedCustomer.face_photo_url || ''} alt={selectedCustomer.full_name} className="object-cover" />
                                      <AvatarFallback className="bg-zinc-900 text-primary text-2xl font-bold">
                                        {selectedCustomer.full_name?.substring(0, 2).toUpperCase() || 'CL'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <DialogTitle className="text-2xl font-bold text-white mb-1">{selectedCustomer.full_name}</DialogTitle>
                                      <DialogDescription className="text-base text-white/60">
                                        Evaluación de Identidad y Riesgo
                                      </DialogDescription>
                                      <div className="mt-3">
                                        {getStatusBadge(selectedCustomer.kyc_status)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-3 bg-white/5 rounded-full border border-white/10 shadow-inner">
                                    {getStatusIcon(selectedCustomer.kyc_status)}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="p-8 space-y-8">
                                {/* Contact Info Cards */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center gap-4">
                                    <div className="bg-white/5 p-3 rounded-lg text-primary">
                                      <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Documento C.I</p>
                                      <p className="font-semibold text-white font-mono mt-0.5">{selectedCustomer.dni || 'No provisto'}</p>
                                    </div>
                                  </div>
                                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center gap-4">
                                    <div className="bg-white/5 p-3 rounded-lg text-primary">
                                      <Phone className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Teléfono</p>
                                      <p className="font-semibold text-white mt-0.5">{selectedCustomer.phone}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* KYC Photos */}
                                <div className="space-y-4">
                                  <h4 className="font-semibold flex items-center text-white/90">
                                    <ImageIcon className="h-5 w-5 mr-2 text-primary" />
                                    Evidencia de Veridad (KYC)
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
                                          <p className="text-sm font-medium text-white/80">Cédula de Identidad</p>
                                        </div>
                                        {selectedCustomer.dni_photo_url ? (
                                          <a href={selectedCustomer.dni_photo_url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/50 group shadow-lg">
                                            <img src={selectedCustomer.dni_photo_url} alt="Cédula" className="object-cover w-full h-full transition-all duration-500 group-hover:scale-110 group-hover:opacity-50" />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                              <span className="bg-black/80 backdrop-blur-sm text-white text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2">
                                                <Search className="w-3.5 h-3.5" /> Ampliar
                                              </span>
                                            </div>
                                          </a>
                                        ) : (
                                          <div className="aspect-video rounded-xl border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-muted-foreground gap-2">
                                            <FileText className="w-6 h-6 opacity-20" />
                                            <span className="text-xs">Falta documento</span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div className="space-y-3">
                                        <p className="text-sm font-medium text-white/80">Selfie con Documento</p>
                                        {selectedCustomer.verification_photo_url ? (
                                          <a href={selectedCustomer.verification_photo_url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/50 group shadow-lg">
                                            <img src={selectedCustomer.verification_photo_url} alt="Verificación" className="object-cover w-full h-full transition-all duration-500 group-hover:scale-110 group-hover:opacity-50" />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                              <span className="bg-black/80 backdrop-blur-sm text-white text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2">
                                                <Search className="w-3.5 h-3.5" /> Ampliar
                                              </span>
                                            </div>
                                          </a>
                                        ) : (
                                          <div className="aspect-video rounded-xl border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-muted-foreground gap-2">
                                            <ImageIcon className="w-6 h-6 opacity-20" />
                                            <span className="text-xs">Falta documento</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-3 pt-6 border-t border-white/5">
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
  );
}
