import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Phone, Mail, MapPin, Save, Loader2, ArrowLeft, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';

import { StoreLayout } from '@/components/store/StoreLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCustomerProfile, CustomerProfileInput } from '@/hooks/useCustomerProfile';
import { useCustomerPurchaseHistory } from '@/hooks/useCustomerProfile';
import { useAuth } from '@/hooks/useAuth';
import { CustomerDashboard } from '@/components/customer/CustomerDashboard';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Nombre muy corto').max(100).optional(),
  phone: z.string().min(10, 'Teléfono inválido').max(20),
  email: z.string().email('Email inválido').optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zip_code: z.string().max(20).optional().nullable(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Perfil del cliente — editorial luxury
export default function CustomerProfile() {
  // --- STATE ---
  const { user } = useAuth();
  const { profile, isLoading, upsertProfile, hasProfile } = useCustomerProfile();
  const { purchases, totalSpent, totalPurchases, isLoading: purchasesLoading } = useCustomerPurchaseHistory();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
    },
  });

  // --- DERIVED / EFFECTS ---
  useEffect(() => {
    if (profile) {
      form.reset({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        email: profile.email || '',
        address: profile.address || '',
        city: profile.city || '',
        state: profile.state || '',
        zip_code: profile.zip_code || '',
      });
    }
  }, [profile, form]);

  const onSubmit = (data: ProfileFormData) => {
    upsertProfile.mutate(data as CustomerProfileInput);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // --- RENDER ---
  if (!user) {
    return (
      <StoreLayout>
        <div className="container py-24 text-center">
          <h1 className="text-3xl font-serif font-medium mb-3 tracking-tight">Acceso requerido</h1>
          <p className="text-muted-foreground/80 dark:text-muted-foreground/50 mb-6 text-sm tracking-wide">Debes iniciar sesión para ver tu perfil</p>
          <Link to="/cliente/auth">
            <Button className="btn-gold rounded-full px-8">Iniciar Sesión</Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="container py-24 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="container py-8 md:py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Header — editorial hero with gradient */}
          <div className="flex items-center gap-4 mb-10">
            <Link to="/">
              <Button variant="ghost" size="icon" className="text-muted-foreground/75 dark:text-muted-foreground/40">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-5">
              <div className="relative">
                <Avatar className="h-16 w-16 border-2 border-primary/20 ring-2 ring-primary/10 ring-offset-2 ring-offset-background">
                  <AvatarImage src={undefined} />
                  <AvatarFallback className="text-lg bg-primary/10 text-primary font-serif">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <Button 
                  size="icon" 
                  variant="secondary" 
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-card border border-border/20"
                >
                  <Camera className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground tracking-tight">
                  {profile?.full_name || 'Mi Cuenta'}
                </h1>
                <p className="text-muted-foreground/75 dark:text-muted-foreground/40 text-sm tracking-wide">{user.email}</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="dashboard" className="space-y-8">
            <TabsList className="grid w-full grid-cols-3 p-1 bg-card/80 backdrop-blur-sm border border-border/10 rounded-full h-11">
              <TabsTrigger value="dashboard" className="rounded-full text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Inicio</TabsTrigger>
              <TabsTrigger value="profile" className="rounded-full text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Perfil</TabsTrigger>
              <TabsTrigger value="purchases" className="rounded-full text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Compras</TabsTrigger>
            </TabsList>

            {/* Tab: Dashboard */}
            <TabsContent value="dashboard">
              <CustomerDashboard />
            </TabsContent>

            {/* Tab: Perfil */}
            <TabsContent value="profile">
              <Card className="bg-card/80 backdrop-blur-sm border border-border/10 shadow-[0_8px_32px_hsl(var(--rose)/0.06)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif tracking-tight">
                    <User className="h-4.5 w-4.5 text-primary/70" />
                    Información Personal
                  </CardTitle>
                  <CardDescription className="text-muted-foreground/75 dark:text-muted-foreground/40 text-sm tracking-wide">
                    Actualiza tus datos de contacto y dirección de envío
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-xs tracking-wide text-muted-foreground/85 dark:text-muted-foreground/60">Nombre completo</Label>
                        <Input
                          id="full_name"
                          placeholder="Tu nombre"
                          className="bg-card/80 border-border/15 focus:border-primary/30"
                          {...form.register('full_name')}
                        />
                        {form.formState.errors.full_name && (
                          <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-xs tracking-wide text-muted-foreground/85 dark:text-muted-foreground/60">Teléfono *</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 dark:text-muted-foreground/30" />
                          <Input
                            id="phone"
                            placeholder="+58 412 1234567"
                            className="pl-10 bg-card/80 border-border/15 focus:border-primary/30"
                            {...form.register('phone')}
                          />
                        </div>
                        {form.formState.errors.phone && (
                          <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs tracking-wide text-muted-foreground/85 dark:text-muted-foreground/60">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 dark:text-muted-foreground/30" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="tu@email.com"
                            className="pl-10 bg-card/80 border-border/15 focus:border-primary/30"
                            {...form.register('email')}
                          />
                        </div>
                        {form.formState.errors.email && (
                          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-xs tracking-wide text-muted-foreground/85 dark:text-muted-foreground/60">Ciudad</Label>
                        <Input
                          id="city"
                          placeholder="Tu ciudad"
                          className="bg-card/80 border-border/15 focus:border-primary/30"
                          {...form.register('city')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="state" className="text-xs tracking-wide text-muted-foreground/85 dark:text-muted-foreground/60">Estado</Label>
                        <Input
                          id="state"
                          placeholder="Tu estado"
                          className="bg-card/80 border-border/15 focus:border-primary/30"
                          {...form.register('state')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="zip_code" className="text-xs tracking-wide text-muted-foreground/85 dark:text-muted-foreground/60">Código Postal</Label>
                        <Input
                          id="zip_code"
                          placeholder="1234"
                          className="bg-card/80 border-border/15 focus:border-primary/30"
                          {...form.register('zip_code')}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-xs tracking-wide text-muted-foreground/85 dark:text-muted-foreground/60">Dirección completa</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60 dark:text-muted-foreground/30" />
                        <Textarea
                          id="address"
                          placeholder="Calle, número, urbanización, punto de referencia..."
                          className="pl-10 min-h-[80px] bg-card/80 border-border/15 focus:border-primary/30"
                          {...form.register('address')}
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full btn-gold btn-shimmer rounded-full h-12"
                      disabled={upsertProfile.isPending}
                    >
                      {upsertProfile.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Guardar Cambios
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Compras */}
            <TabsContent value="purchases">
              <Card className="bg-card/80 backdrop-blur-sm border border-border/10 shadow-[0_8px_32px_hsl(var(--rose)/0.06)]">
                <CardHeader>
                  <CardTitle className="font-serif tracking-tight">Historial de Compras</CardTitle>
                  <CardDescription className="text-muted-foreground/75 dark:text-muted-foreground/40 text-sm tracking-wide">
                    Total gastado: <span className="text-gradient-gold font-semibold">${totalSpent.toFixed(2)} USD</span> en {totalPurchases} compras
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {purchasesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
                    </div>
                  ) : purchases.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground/75 dark:text-muted-foreground/40">
                      <p className="text-sm tracking-wide">No tienes compras registradas</p>
                      <Link to="/tienda">
                        <Button variant="outline" className="mt-4 rounded-full border-border/20">
                          Explorar Tienda
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {purchases.slice(0, 10).map((purchase) => (
                        <div 
                          key={purchase.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-card/80 hover:bg-card/80 transition-colors duration-300"
                        >
                          <div>
                            <p className="font-medium text-sm">{purchase.product_name}</p>
                            <p className="text-xs text-muted-foreground/40 tracking-wide">
                              {format(new Date(purchase.created_at), 'PPP', { locale: es })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm text-gradient-gold">${purchase.total_usd.toFixed(2)}</p>
                            <p className="text-[10px] text-muted-foreground/30 tracking-wide">
                              x{purchase.quantity}
                            </p>
                          </div>
                        </div>
                      ))}
                      {purchases.length > 10 && (
                        <Link to="/cliente/pedidos">
                          <Button variant="outline" className="w-full mt-3 rounded-full border-border/15 text-sm">
                            Ver todas las compras
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </StoreLayout>
  );
}
