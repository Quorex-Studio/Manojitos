import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {Loader,  Settings, Lock, Bell, Shield, Logout, Refresh, ArrowLeft, Eye, EyeOff, Check, CreditCard } from 'reicon-react';
import { Link, useNavigate } from 'react-router-dom';

import { StoreLayout } from '@/components/store/StoreLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useCurrency, DisplayCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Mínimo 6 caracteres'),
  newPassword: z.string().min(6, 'Mínimo 6 caracteres'),
  confirmPassword: z.string().min(6, 'Mínimo 6 caracteres'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function CustomerSettings() {
  // --- STATE ---
  const { user, signOut, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { profile, updateNotificationPreferences, hasProfile, isLoading: profileLoading } = useCustomerProfile();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  
  const [notifPrefs, setNotifPrefs] = useState({
    email: true,
    sms: false,
    internal: true,
  });

  // --- DERIVED / EFFECTS ---

  // Update notification prefs when profile loads
  useEffect(() => {
    if (profile?.notification_preferences) {
      setNotifPrefs({
        email: profile.notification_preferences.email ?? true,
        sms: profile.notification_preferences.sms ?? false,
        internal: profile.notification_preferences.internal ?? true,
      });
    }
  }, [profile]);

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handlePasswordChange = async (data: PasswordFormData) => {
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Contraseña actualizada',
        description: 'Tu contraseña ha sido cambiada exitosamente',
      });
      passwordForm.reset();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo cambiar la contraseña',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleNotifChange = (key: 'email' | 'sms' | 'internal', value: boolean) => {
    const newPrefs = { ...notifPrefs, [key]: value };
    setNotifPrefs(newPrefs);
    if (hasProfile) {
      updateNotificationPreferences.mutate(newPrefs);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
    toast({
      title: 'Sesión cerrada',
      description: 'Has cerrado sesión correctamente',
    });
  };

  // --- RENDER ---
  if (authLoading) {
    return (
      <StoreLayout>
        <div className="container py-12 flex items-center justify-center">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  if (!user) {
    return (
      <StoreLayout>
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso requerido</h1>
          <p className="text-muted-foreground mb-6">Debes iniciar sesión para ver la configuración</p>
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
          <div className="flex items-center gap-4 mb-8">
            <Link to="/cliente/perfil">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="page-header flex items-center gap-2">
                <Settings className="h-6 w-6" />
                Configuración
              </h1>
              <p className="text-muted-foreground">Seguridad y preferencias de tu cuenta</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Cambiar Contraseña */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Cambiar Contraseña
                </CardTitle>
                <CardDescription>
                  Actualiza tu contraseña para mantener tu cuenta segura
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Contraseña actual</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...passwordForm.register('currentPassword')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-sm text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nueva contraseña</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...passwordForm.register('newPassword')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-sm text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      {...passwordForm.register('confirmPassword')}
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? (
                      <Loader className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Actualizar Contraseña
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Preferencia de Moneda de Visualización */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">💰</span>
                  Preferencia de Visualización
                </CardTitle>
                <CardDescription>
                  Elige la moneda principal en la que verás los precios (Afecta solo a este dispositivo)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as DisplayCurrency)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="USD">Dólar ($)</TabsTrigger>
                    <TabsTrigger value="VES">Bolívar (Bs.)</TabsTrigger>
                    <TabsTrigger value="EUR">Euro (€)</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {/* Preferencias de Notificación */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Notificaciones
                </CardTitle>
                <CardDescription>
                  Configura cómo quieres recibir avisos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/80">
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">
                      Recordatorios y actualizaciones por correo
                    </p>
                  </div>
                  <Switch
                    checked={notifPrefs.email}
                    onCheckedChange={(v) => handleNotifChange('email', v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/80">
                  <div>
                    <p className="font-medium">SMS</p>
                    <p className="text-sm text-muted-foreground">
                      Mensajes de texto importantes
                    </p>
                  </div>
                  <Switch
                    checked={notifPrefs.sms}
                    onCheckedChange={(v) => handleNotifChange('sms', v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/80">
                  <div>
                    <p className="font-medium">Notificaciones internas</p>
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

            {/* Accesos Rápidos */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Cuenta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to="/cliente/metodos-pago">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <CreditCard className="h-4 w-4" />
                    Métodos de Pago
                  </Button>
                </Link>

                <Separator />

                <Button 
                  variant="destructive" 
                  className="w-full justify-start gap-2"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesión
                </Button>
              </CardContent>
            </Card>

            {/* Info de cuenta */}
            <Card className="glass-card border-muted">
              <CardContent className="pt-6">
                <div className="text-center text-sm text-muted-foreground">
                  <p>Cuenta: {user.email}</p>
                  <p className="mt-1">
                    Miembro desde {new Date(user.created_at).toLocaleDateString('es-VE', { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </StoreLayout>
  );
}
