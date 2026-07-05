import { useState } from 'react';
import { useCustomers, CustomerProfile } from '@/hooks/useCustomers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { UserCheck, UserX, Loader2, Search, FileText, Image as ImageIcon } from 'lucide-react';
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
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500 hover:bg-green-600">Aprobado</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rechazado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pendiente</Badge>;
      default:
        return <Badge variant="secondary">No Iniciado</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Clientes (KYC)</h1>
          <p className="text-muted-foreground">
            Gestiona la verificación de identidad para los créditos.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono o cédula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background/50 border-border/50 text-white placeholder:text-muted-foreground focus-visible:ring-primary/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-background/50 border-border/50">
            <SelectValue placeholder="Estado KYC" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="approved">Aprobados</SelectItem>
            <SelectItem value="rejected">Rechazados</SelectItem>
            <SelectItem value="none">Sin Solicitar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-muted-foreground">Contacto</TableHead>
                <TableHead className="font-medium text-muted-foreground">Registro</TableHead>
                <TableHead className="font-medium text-muted-foreground">Estado KYC</TableHead>
                <TableHead className="font-medium text-muted-foreground text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No se encontraron clientes.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="border-border">
                    <TableCell>
                      <div className="font-medium text-white">{customer.full_name}</div>
                      <div className="text-sm text-muted-foreground">C.I: {customer.dni || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-white">{customer.phone}</div>
                      <div className="text-sm text-muted-foreground">{customer.email || 'N/A'}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(customer.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(customer.kyc_status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedCustomer(customer)}
                            className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:text-primary"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Ver Detalles
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] bg-background border-border text-foreground">
                          <DialogHeader>
                            <DialogTitle>Detalles del Cliente: {selectedCustomer?.full_name}</DialogTitle>
                            <DialogDescription>
                              Revisa los documentos de identidad para habilitar Crédito Manojitos.
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedCustomer && (
                            <div className="space-y-6 mt-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-muted-foreground">Cédula</p>
                                  <p className="font-medium">{selectedCustomer.dni || 'No provisto'}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
                                  <p className="font-medium">{selectedCustomer.phone}</p>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <h4 className="font-medium flex items-center border-b border-border pb-2">
                                  <ImageIcon className="h-4 w-4 mr-2 text-primary" />
                                  Documentos KYC
                                </h4>
                                
                                {selectedCustomer.kyc_status === 'none' ? (
                                  <p className="text-sm text-muted-foreground italic">
                                    Este cliente no ha subido documentos.
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">Foto de Cédula</p>
                                      {selectedCustomer.dni_photo_url ? (
                                        <a href={selectedCustomer.dni_photo_url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video rounded-md overflow-hidden border border-border bg-muted group">
                                          <img src={selectedCustomer.dni_photo_url} alt="Cédula" className="object-cover w-full h-full transition-transform group-hover:scale-105" />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium">
                                            Abrir Imagen
                                          </div>
                                        </a>
                                      ) : (
                                        <div className="aspect-video rounded-md border border-dashed border-border bg-muted flex items-center justify-center text-sm text-muted-foreground">Sin documento</div>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">Foto del Rostro</p>
                                      {selectedCustomer.face_photo_url ? (
                                        <a href={selectedCustomer.face_photo_url} target="_blank" rel="noopener noreferrer" className="block relative aspect-square rounded-md overflow-hidden border border-border bg-muted group">
                                          <img src={selectedCustomer.face_photo_url} alt="Rostro" className="object-cover w-full h-full transition-transform group-hover:scale-105" />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium">
                                            Abrir Imagen
                                          </div>
                                        </a>
                                      ) : (
                                        <div className="aspect-square rounded-md border border-dashed border-border bg-muted flex items-center justify-center text-sm text-muted-foreground">Sin documento</div>
                                      )}
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                      <p className="text-sm font-medium">Foto de Verificación (Sosteniendo Cédula)</p>
                                      {selectedCustomer.verification_photo_url ? (
                                        <a href={selectedCustomer.verification_photo_url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video rounded-md overflow-hidden border border-border bg-muted group">
                                          <img src={selectedCustomer.verification_photo_url} alt="Verificación" className="object-cover w-full h-full transition-transform group-hover:scale-105" />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium">
                                            Abrir Imagen
                                          </div>
                                        </a>
                                      ) : (
                                        <div className="aspect-video rounded-md border border-dashed border-border bg-muted flex items-center justify-center text-sm text-muted-foreground">Sin documento</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-3 justify-end pt-4 border-t border-border">
                                {selectedCustomer.kyc_status !== 'rejected' && (
                                  <Button 
                                    variant="destructive" 
                                    onClick={() => handleUpdateStatus(selectedCustomer.user_id, 'rejected')}
                                    disabled={updateKycStatus.isPending}
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    Rechazar Documentos
                                  </Button>
                                )}
                                {selectedCustomer.kyc_status !== 'approved' && (
                                  <Button 
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => handleUpdateStatus(selectedCustomer.user_id, 'approved')}
                                    disabled={updateKycStatus.isPending}
                                  >
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Aprobar Cliente
                                  </Button>
                                )}
                                {selectedCustomer.kyc_status !== 'pending' && selectedCustomer.kyc_status !== 'none' && (
                                  <Button 
                                    variant="outline"
                                    onClick={() => handleUpdateStatus(selectedCustomer.user_id, 'pending')}
                                    disabled={updateKycStatus.isPending}
                                  >
                                    Marcar Pendiente
                                  </Button>
                                )}
                              </div>
                            </div>
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
