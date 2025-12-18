import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Phone, Mail, MapPin, Bell, Save, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { StoreLayout } from '@/components/store/StoreLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCustomerProfile, CustomerProfileInput } from '@/hooks/useCustomerProfile';
import { useCustomerPurchaseHistory } from '@/hooks/useCustomerProfile';
import { useAuth } from '@/hooks/useAuth';
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

export default function CustomerProfile() {
  const { user } = useAuth();
  const { profile, isLoading, upsertProfile, updateNotificationPreferences, hasProfile } = useCustomerProfile();
  const { purchases, totalSpent, totalPurchases, isLoading: purchasesLoading } = useCustomerPurchaseHistory();
  
  const [notifPrefs, setNotifPrefs] = useState({
    email: profile?.notification_preferences?.email ?? true,
    sms: profile?.notification_preferences?.sms ?? false,
    internal: profile?.notification_preferences?.internal ?? true,
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      email: profile?.email || '',
      address: profile?.address || '',
      city: profile?.city || '',
      state: profile?.state || '',
      zip_code: profile?.zip_code || '',
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    upsertProfile.mutate({
      ...data,
      notification_preferences: notifPrefs,
    } as CustomerProfileInput);
  };

  const handleNotifChange = (key: 'email' | 'sms' | 'internal', value: boolean) => {
    const newPrefs = { ...notifPrefs, [key]: value };
    setNotifPrefs(newPrefs);
    if (hasProfile) {
      updateNotificationPreferences.mutate(newPrefs);
    }
  };

  if (!user) {
    return (
      <StoreLayout>
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso requerido</h1>
          <p className="text-muted-foreground mb-6">Debes iniciar sesión para ver tu perfil</p>
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

  return (
    <StoreLayout>
      <div className="container py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="page-header">Mi Perfil</h1>
              <p className="text-muted-foreground">Gestiona tu información personal</p>
            </div>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="purchases">Compras</TabsTrigger>
              <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
            </TabsList>

            {/* Tab: Perfil */}
            <TabsContent value="profile">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Información Personal
                  </CardTitle>
                  <CardDescription>
                    Actualiza tus datos de contacto y dirección
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Nombre completo</Label>
                        <Input
                          id="full_name"
                          placeholder="Tu nombre"
                          {...form.register('full_name')}
                        />
                        {form.formState.errors.full_name && (
                          <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono *</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            placeholder="+58 412 1234567"
                            className="pl-10"
                            {...form.register('phone')}
                          />
                        </div>
                        {form.formState.errors.phone && (
                          <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="tu@email.com"
                            className="pl-10"
                            {...form.register('email')}
                          />
                        </div>
                        {form.formState.errors.email && (
                          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city">Ciudad</Label>
                        <Input
                          id="city"
                          placeholder="Tu ciudad"
                          {...form.register('city')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="state">Estado</Label>
                        <Input
                          id="state"
                          placeholder="Tu estado"
                          {...form.register('state')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="zip_code">Código Postal</Label>
                        <Input
                          id="zip_code"
                          placeholder="1234"
                          {...form.register('zip_code')}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Dirección completa</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Textarea
                          id="address"
                          placeholder="Calle, número, urbanización..."
                          className="pl-10 min-h-[80px]"
                          {...form.register('address')}
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full btn-gold"
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
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Historial de Compras</CardTitle>
                  <CardDescription>
                    Total gastado: ${totalSpent.toFixed(2)} USD en {totalPurchases} compras
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {purchasesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : purchases.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No tienes compras registradas</p>
                      <Link to="/tienda">
                        <Button variant="outline" className="mt-4">
                          Explorar Tienda
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {purchases.slice(0, 10).map((purchase) => (
                        <div 
                          key={purchase.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-secondary/50"
                        >
                          <div>
                            <p className="font-medium">{purchase.product_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(purchase.created_at), 'PPP', { locale: es })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">${purchase.total_usd.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">
                              x{purchase.quantity}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Notificaciones */}
            <TabsContent value="notifications">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Preferencias de Notificación
                  </CardTitle>
                  <CardDescription>
                    Elige cómo quieres recibir avisos sobre tus compras y créditos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                    <div>
                      <p className="font-medium">Notificaciones por Email</p>
                      <p className="text-sm text-muted-foreground">
                        Recibe recordatorios y actualizaciones por correo
                      </p>
                    </div>
                    <Switch
                      checked={notifPrefs.email}
                      onCheckedChange={(v) => handleNotifChange('email', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                    <div>
                      <p className="font-medium">Notificaciones por SMS</p>
                      <p className="text-sm text-muted-foreground">
                        Recibe mensajes de texto con recordatorios importantes
                      </p>
                    </div>
                    <Switch
                      checked={notifPrefs.sms}
                      onCheckedChange={(v) => handleNotifChange('sms', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                    <div>
                      <p className="font-medium">Notificaciones Internas</p>
                      <p className="text-sm text-muted-foreground">
                        Avisos dentro de la plataforma
                      </p>
                    </div>
                    <Switch
                      checked={notifPrefs.internal}
                      onCheckedChange={(v) => handleNotifChange('internal', v)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </StoreLayout>
  );
}
