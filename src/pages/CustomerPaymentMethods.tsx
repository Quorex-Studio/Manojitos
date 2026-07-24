import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Plus, Trash2, Star, Refresh, ArrowLeft, Phone, Mailbox, Building2, Wallet, CheckCircle } from 'reicon-react';
import { Link } from 'react-router-dom';

import { StoreLayout } from '@/components/store/StoreLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerPaymentMethods, PAYMENT_METHOD_TYPES, PaymentMethodInput, PaymentMethodType } from '@/hooks/useCustomerPaymentMethods';
import { sanitizeText } from '@/lib/validations';

const paymentMethodFormSchema = z.object({
  method_type: z.enum(['efectivo_usd', 'efectivo_bs', 'zelle', 'pago_movil', 'transferencia']),
  alias: z.string().max(50).optional().transform(val => val ? sanitizeText(val) : val),
  bank_name: z.string().max(100).optional().transform(val => val ? sanitizeText(val) : val),
  phone_number: z.string().regex(/^\+58(?:412|414|424|416|426|2\d{2})\d{7}$/, 'Formato inválido. Ej: +584121234567').optional().or(z.literal('')).transform(val => val ? sanitizeText(val) : val),
  email: z.string().email().optional().or(z.literal('')),
  last_four: z.string().max(4).optional().transform(val => val ? sanitizeText(val) : val),
});

type PaymentMethodFormData = z.infer<typeof paymentMethodFormSchema>;

const methodIcons: Record<PaymentMethodType, React.ReactNode> = {
  efectivo_usd: <Wallet className="h-5 w-5 text-primary" />,
  efectivo_bs: <Wallet className="h-5 w-5 text-primary/70" />,
  zelle: <Mail className="h-5 w-5 text-primary" />,
  pago_movil: <Phone className="h-5 w-5 text-gold" />,
  transferencia: <Building2 className="h-5 w-5 text-cyan-500" />,
};

export default function CustomerPaymentMethods() {
  // --- STATE ---
  const { user } = useAuth();
  const { methods, isLoading, addMethod, setPreferred, deleteMethod, preferredMethod } = useCustomerPaymentMethods();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<PaymentMethodType | ''>('');

  const form = useForm<PaymentMethodFormData>({
    resolver: zodResolver(paymentMethodFormSchema),
    defaultValues: {
      method_type: undefined,
      alias: '',
      bank_name: '',
      phone_number: '',
      email: '',
      last_four: '',
    },
  });

  // --- HANDLERS ---

  const onSubmit = (data: PaymentMethodFormData) => {
    const input: PaymentMethodInput = {
      method_type: data.method_type,
      alias: data.alias || null,
      details: {
        bank_name: data.bank_name || undefined,
        phone_number: data.phone_number || undefined,
        email: data.email || undefined,
        last_four: data.last_four || undefined,
      },
      is_preferred: methods.length === 0, // Primero es preferido automáticamente
    };

    addMethod.mutate(input, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
        setSelectedType('');
      },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar este método de pago?')) {
      deleteMethod.mutate(id);
    }
  };

  const handleSetPreferred = (id: string) => {
    setPreferred.mutate(id);
  };

  // --- RENDER ---
  if (!user) {
    return (
      <StoreLayout>
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso requerido</h1>
          <p className="text-muted-foreground mb-6">Debes iniciar sesión para ver tus métodos de pago</p>
          <Link to="/cliente/auth">
            <Button>Iniciar Sesión</Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="container py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link to="/cliente/configuracion">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="page-header flex items-center gap-2">
                  <CreditCard className="h-6 w-6" />
                  Métodos de Pago
                </h1>
                <p className="text-muted-foreground">Gestiona tus métodos de pago preferidos</p>
              </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Agregar Método de Pago</DialogTitle>
                  <DialogDescription>
                    Guarda tu método de pago preferido para futuras compras
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de método</Label>
                    <Select 
                      value={selectedType}
                      onValueChange={(value: PaymentMethodType) => {
                        setSelectedType(value);
                        form.setValue('method_type', value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHOD_TYPES.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center gap-2">
                              {methodIcons[type.id]}
                              <span>{type.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.method_type && (
                      <p className="text-sm text-destructive">{form.formState.errors.method_type.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alias">Alias (opcional)</Label>
                    <Input
                      id="alias"
                      placeholder="Ej: Mi Zelle personal"
                      {...form.register('alias')}
                    />
                  </div>

                  {/* Campos dinámicos según el tipo */}
                  {(selectedType === 'zelle') && (
                    <div className="space-y-2">
                      <Label htmlFor="email">Email de Zelle</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        {...form.register('email')}
                      />
                    </div>
                  )}

                  {(selectedType === 'pago_movil' || selectedType === 'transferencia') && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="bank_name">Banco</Label>
                        <Input
                          id="bank_name"
                          placeholder="Nombre del banco"
                          {...form.register('bank_name')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone_number">Teléfono asociado</Label>
                        <Input
                          id="phone_number"
                          placeholder="+58 412 1234567"
                          {...form.register('phone_number')}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^\d+]/g, '');
                            if (val && !val.startsWith('+')) val = '+' + val;
                            if (val.length > 13) val = val.substring(0, 13);
                            form.setValue('phone_number', val, { shouldValidate: true });
                          }}
                          pattern="^\+58(?:412|414|424|416|426|2\d{2})\d{7}$"
                          title="Debe ser un celular venezolano o teléfono fijo válido con +58"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_four">Últimos 4 dígitos de cédula</Label>
                        <Input
                          id="last_four"
                          placeholder="1234"
                          maxLength={4}
                          {...form.register('last_four')}
                        />
                      </div>
                    </>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={addMethod.isPending || !selectedType}
                  >
                    {addMethod.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Guardar Método
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Lista de métodos */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : methods.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Sin métodos guardados</h3>
                <p className="text-muted-foreground mb-4">
                  Agrega un método de pago para agilizar tus compras
                </p>
                <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar Método
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {methods.map((method) => {
                  const typeInfo = PAYMENT_METHOD_TYPES.find(t => t.id === method.method_type);
                  const isPreferred = method.id === preferredMethod?.id;

                  return (
                    <motion.div
                      key={method.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <Card className={`glass-card ${isPreferred ? 'border-primary' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-secondary">
                                {methodIcons[method.method_type]}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">
                                    {method.alias || typeInfo?.label}
                                  </p>
                                  {isPreferred && (
                                    <Badge variant="secondary" className="text-xs gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Preferido
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {typeInfo?.description}
                                </p>
                                {method.details?.bank_name && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {method.details.bank_name}
                                    {method.details.last_four && ` •••• ${method.details.last_four}`}
                                  </p>
                                )}
                                {method.details?.email && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {method.details.email}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {!isPreferred && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSetPreferred(method.id)}
                                  title="Marcar como preferido"
                                >
                                  <Star className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(method.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
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

          {/* Info */}
          <Card className="glass-card mt-6 border-muted">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                🔒 No almacenamos información sensible como números de cuenta completos. 
                Solo guardamos referencias para tu comodidad.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </StoreLayout>
  );
}
