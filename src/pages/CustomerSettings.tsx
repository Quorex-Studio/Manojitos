import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Loader, Lock, Bell, Logout, ArrowLeft, Eye, EyeOff, Check, CreditCard, User, ChevronRight, DollarSign, Sparkles } from 'reicon-react';
import { AssistantMemoryCard } from '@/components/assistant/AssistantMemoryCard';
import { BRAND } from '@/config/brand';
import { Link, useNavigate } from 'react-router-dom';

import { StoreLayout } from '@/components/store/StoreLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useCurrency, DisplayCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual'),
  newPassword: z.string().min(8, 'Usa al menos 8 caracteres'),
  confirmPassword: z.string().min(1, 'Repite la nueva contraseña'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
}).refine((data) => data.newPassword !== data.currentPassword, {
  message: 'La nueva contraseña debe ser distinta de la actual',
  path: ['newPassword'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

const CURRENCIES: { value: DisplayCurrency; label: string; hint: string }[] = [
  { value: 'USD', label: 'Dólar', hint: '$' },
  { value: 'VES', label: 'Bolívar', hint: 'Bs' },
  { value: 'EUR', label: 'Euro', hint: '€' },
];

/** Sección con título pequeño y tarjeta, igual que en Mi cuenta. */
function Section({ title, icon: Icon, children, description }: { title: string; icon: typeof Lock; description?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
        {description && <p className="mb-4 text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
    </section>
  );
}

function PasswordField({ id, label, show, error, autoComplete, ...rest }: { id: string; label: string; show: boolean; error?: string; autoComplete: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} aria-invalid={!!error} {...rest} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function CustomerSettings() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { profile, updateNotificationPreferences, hasProfile } = useCustomerProfile();
  const { displayCurrency, setDisplayCurrency } = useCurrency();

  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ email: true, sms: false, internal: true });

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
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const errors = passwordForm.formState.errors;

  const handlePasswordChange = async (data: PasswordFormData) => {
    if (!user?.email) return;
    setIsChangingPassword(true);
    try {
      // Primero se comprueba la contraseña actual: si no, cualquiera con la sesión abierta
      // en un teléfono prestado podría cambiarla.
      const { error: checkError } = await supabase.auth.signInWithPassword({ email: user.email, password: data.currentPassword });
      if (checkError) {
        passwordForm.setError('currentPassword', { message: 'La contraseña actual no es correcta' });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: data.newPassword });
      if (error) throw error;
      toast({ title: 'Contraseña actualizada', description: 'Úsala la próxima vez que inicies sesión.' });
      passwordForm.reset();
      setShowPasswords(false);
    } catch (error) {
      toast({
        title: 'No se pudo cambiar la contraseña',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos minutos.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleNotifChange = (key: 'email' | 'internal', value: boolean) => {
    const previous = notifPrefs;
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    updateNotificationPreferences.mutate(next, {
      onError: () => {
        setNotifPrefs(previous);
        toast({ title: 'No se pudo guardar', description: 'Revisa tu conexión e inténtalo de nuevo.', variant: 'destructive' });
      },
    });
  };

  const [resetSent, setResetSent] = useState(false);
  const handleSendReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/cliente/recuperar`,
    });
    if (error) {
      toast({ title: 'No se pudo enviar el enlace', description: 'Inténtalo de nuevo en unos minutos.', variant: 'destructive' });
      return;
    }
    setResetSent(true);
    toast({ title: 'Revisa tu correo', description: `Enviamos un enlace a ${user.email} para crear una contraseña nueva.` });
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
    toast({ title: 'Sesión cerrada', description: '¡Te esperamos pronto!' });
  };

  if (authLoading) {
    return (
      <StoreLayout>
        <div className="container flex items-center justify-center py-12">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  if (!user) {
    return (
      <StoreLayout>
        <div className="container py-12 text-center">
          <h1 className="store-page-title justify-center">Inicia sesión</h1>
          <p className="mb-6 mt-2 text-muted-foreground">Entra a tu cuenta para ver tu configuración.</p>
          <Link to="/cliente/auth?redirect=/cliente/configuracion">
            <Button className="rounded-full">Iniciar sesión</Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  const memberSince = new Date(user.created_at).toLocaleDateString('es-VE', { year: 'numeric', month: 'long' });

  return (
    <StoreLayout>
      <div className="container max-w-2xl py-6 md:py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center gap-3">
            <Link to="/cliente/perfil" aria-label="Volver a mi cuenta">
              <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="store-page-title">Configuración</h1>
              <p className="text-sm text-muted-foreground">Moneda, avisos y seguridad de tu cuenta</p>
            </div>
          </div>

          {/* Moneda: afecta cómo se muestran los precios en toda la tienda */}
          <Section title="Ver precios en" icon={DollarSign} description="Elige en qué moneda quieres ver los precios. Solo cambia en este dispositivo; el pago se acuerda en el checkout.">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Moneda de los precios">
              {CURRENCIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={displayCurrency === c.value}
                  onClick={() => setDisplayCurrency(c.value)}
                  className={cn(
                    'flex h-16 flex-col items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                    displayCurrency === c.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:border-primary/40'
                  )}
                >
                  <span className="font-serif text-lg leading-none">{c.hint}</span>
                  <span className="mt-1 text-xs">{c.label}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Avisos */}
          <Section title="Avisos" icon={Bell}>
            {!hasProfile && (
              <div className="mb-4 rounded-xl bg-secondary p-3 text-sm">
                Completa tus datos para poder guardar tus preferencias de avisos.{' '}
                <Link to="/cliente/perfil?tab=profile" className="font-medium text-primary underline-offset-2 hover:underline">Completar datos</Link>
              </div>
            )}
            <div className="divide-y divide-border">
              {([
                ['email', 'Correo', `Pedidos, pagos y recordatorios en ${user.email}`],
                ['internal', 'En la tienda', 'Avisos en la campana de notificaciones'],
              ] as ['email' | 'internal', string, string][]).map(([key, label, hint]) => (
                <label key={key} htmlFor={`notif-${key}`} className="flex cursor-pointer items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block font-medium">{label}</span>
                    <span className="block text-sm text-muted-foreground">{hint}</span>
                  </span>
                  <Switch
                    id={`notif-${key}`}
                    checked={notifPrefs[key]}
                    disabled={!hasProfile || updateNotificationPreferences.isPending}
                    onCheckedChange={(v) => handleNotifChange(key, v)}
                  />
                </label>
              ))}
              <Link to="/cliente/notificaciones" className="flex items-center justify-between gap-4 pt-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">En el teléfono</span>
                  <span className="block text-muted-foreground">Actívalos desde tus notificaciones</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </div>
          </Section>

          {/* Seguridad */}
          <Section title="Contraseña" icon={Lock} description="Para cambiarla necesitas tu contraseña actual.">
            <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4" noValidate>
              <PasswordField id="currentPassword" label="Contraseña actual" show={showPasswords} autoComplete="current-password" error={errors.currentPassword?.message} {...passwordForm.register('currentPassword')} />
              <PasswordField id="newPassword" label="Nueva contraseña" show={showPasswords} autoComplete="new-password" error={errors.newPassword?.message} {...passwordForm.register('newPassword')} />
              <PasswordField id="confirmPassword" label="Repite la nueva contraseña" show={showPasswords} autoComplete="new-password" error={errors.confirmPassword?.message} {...passwordForm.register('confirmPassword')} />
              <button type="button" onClick={() => setShowPasswords(s => !s)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
              </button>
              <Button type="submit" className="w-full rounded-full" disabled={isChangingPassword}>
                {isChangingPassword ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Cambiar contraseña
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                ¿La olvidaste?{' '}
                <button type="button" onClick={handleSendReset} disabled={resetSent} className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">
                  {resetSent ? 'Te enviamos el enlace a tu correo' : 'Recupérala por correo'}
                </button>
              </p>
            </form>
          </Section>

          {/* Cuenta */}
          <Section title={`Lo que ${BRAND.assistantName} recuerda`} icon={Sparkles}>
            <AssistantMemoryCard />
          </Section>

          <Section title="Cuenta" icon={User}>
            <div className="divide-y divide-border">
              <div className="pb-3 text-sm">
                <p className="font-medium">{profile?.full_name || user.email}</p>
                <p className="text-muted-foreground">{user.email} · desde {memberSince}</p>
              </div>
              {([
                ['/cliente/perfil?tab=profile', User, 'Datos personales', 'Nombre, teléfono, cédula y dirección'],
                ['/cliente/metodos-pago', CreditCard, 'Métodos de pago', 'Tus datos para pagar más rápido'],
              ] as [string, typeof User, string, string][]).map(([to, Icon, label, hint]) => (
                <Link key={to} to={to} className="flex items-center gap-3 py-3">
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-medium">{label}</span>
                    <span className="block text-muted-foreground">{hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
              <div className="pt-3">
                <Button variant="outline" className="w-full rounded-full" onClick={handleLogout}>
                  <Logout className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </Section>
        </motion.div>
      </div>
    </StoreLayout>
  );
}
