import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Phone, Mail, MapPin, Save, Loader2, ArrowLeft, Camera, ShieldCheck, Upload, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

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
import { sanitizeText } from '@/lib/validations';

const profileSchema = z.object({
  dni: z.string().min(4, 'DNI muy corto').max(20).optional().nullable().transform(val => val ? sanitizeText(val) : val),
  full_name: z.string().min(2, 'Nombre muy corto').max(100).optional().transform(val => val ? sanitizeText(val) : val),
  phone: z.string().regex(/^\+58(?:412|414|424|416|426|2\d{2})\d{7}$/, 'Formato inválido. Ej: +584121234567').transform(sanitizeText),
  email: z.string().email('Email inválido').optional().nullable(),
  address: z.string().max(200).optional().nullable().transform(val => val ? sanitizeText(val) : val),
  city: z.string().max(100).optional().nullable().transform(val => val ? sanitizeText(val) : val),
  state: z.string().max(100).optional().nullable().transform(val => val ? sanitizeText(val) : val),
  zip_code: z.string().max(20).optional().nullable().transform(val => val ? sanitizeText(val) : val),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Perfil del cliente — editorial luxury
export default function CustomerProfile() {
  // --- STATE ---
  const { user } = useAuth();
  const { profile, isLoading, upsertProfile, hasProfile, updateKycDocuments } = useCustomerProfile();
  const { purchases, totalSpent, totalPurchases, isLoading: purchasesLoading } = useCustomerPurchaseHistory();
  const { toast } = useToast();

  // --- KYC STATE ---
  const [kycFiles, setKycFiles] = useState<{
    dni: File | null;
    face: File | null;
    verification: File | null;
  }>({ dni: null, face: null, verification: null });
  
  const [kycPreviews, setKycPreviews] = useState<{
    dni: string | null;
    face: string | null;
    verification: string | null;
  }>({
    dni: null,
    face: null,
    verification: null
  });
  const [kycUploading, setKycUploading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      dni: '',
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
        dni: profile.dni || '',
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        email: profile.email || '',
        address: profile.address || '',
        city: profile.city || '',
        state: profile.state || '',
        zip_code: profile.zip_code || '',
      });
      setKycPreviews({
        dni: profile.dni_photo_url || null,
        face: profile.face_photo_url || null,
        verification: profile.verification_photo_url || null
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

  const handleKycFileChange = (type: 'dni' | 'face' | 'verification', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Límite de 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'El tamaño máximo permitido es de 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setKycFiles(prev => ({ ...prev, [type]: file }));
    
    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setKycPreviews(prev => ({ ...prev, [type]: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'El tamaño máximo permitido es de 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_avatar.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('customer-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('customer-avatars')
        .getPublicUrl(filePath);

      // Update the profile with the new avatar_url
      await supabase
        .from('customer_profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      // Refresh data
      upsertProfile.mutate({
        ...form.getValues(),
        // Trigger a refetch indirectly or rely on queryClient invalidate in upsertProfile
      });
      
      toast({
        title: 'Foto actualizada',
        description: 'Tu foto de perfil se ha guardado correctamente.',
      });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Error',
        description: 'No se pudo subir la foto de perfil.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleKycSubmit = async () => {
    if (!user) return;
    
    if (!kycPreviews.dni || !kycPreviews.face || !kycPreviews.verification) {
      toast({
        title: 'Faltan documentos',
        description: 'Debes subir los 3 documentos para la verificación KYC.',
        variant: 'destructive'
      });
      return;
    }

    setKycUploading(true);
    try {
      const urlsToSave = {
        dni_photo_url: profile?.dni_photo_url || '',
        face_photo_url: profile?.face_photo_url || '',
        verification_photo_url: profile?.verification_photo_url || '',
      };

      const uploadTasks = [];

      for (const [type, file] of Object.entries(kycFiles) as [keyof typeof kycFiles, File | null][]) {
        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${type}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          uploadTasks.push(
            supabase.storage
              .from('customer-avatars')
              .upload(filePath, file, { upsert: true })
              .then(({ data, error }) => {
                if (error) throw error;
                const { data: { publicUrl } } = supabase.storage
                  .from('customer-avatars')
                  .getPublicUrl(filePath);
                urlsToSave[`${type}_photo_url` as keyof typeof urlsToSave] = publicUrl;
              })
          );
        }
      }

      await Promise.all(uploadTasks);

      await updateKycDocuments.mutateAsync(urlsToSave);
      
      // Limpiar archivos una vez subidos
      setKycFiles({ dni: null, face: null, verification: null });

    } catch (error: any) {
      console.error('Error uploading KYC:', error);
      toast({
        title: 'Error de subida',
        description: error.message || 'No se pudieron subir los documentos. Intenta de nuevo.',
        variant: 'destructive'
      });
    } finally {
      setKycUploading(false);
    }
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
              <div className="relative group">
                <Avatar className="h-16 w-16 border-2 border-primary/20 ring-2 ring-primary/10 ring-offset-2 ring-offset-background">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-lg bg-primary/10 text-primary font-serif">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-background/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => document.getElementById('avatarUpload')?.click()}>
                  {isUploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Camera className="h-5 w-5 text-primary" />
                  )}
                </div>
                <Input 
                  id="avatarUpload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarUpload}
                  disabled={isUploadingAvatar}
                />
                <Button 
                  size="icon" 
                  variant="secondary" 
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-card border border-border/20 pointer-events-none"
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
            <TabsList className="grid w-full grid-cols-4 p-1 bg-card/80 backdrop-blur-sm border border-border/10 rounded-full h-11">
              <TabsTrigger value="dashboard" className="rounded-full text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Inicio</TabsTrigger>
              <TabsTrigger value="profile" className="rounded-full text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Perfil</TabsTrigger>
              <TabsTrigger value="kyc" className="rounded-full text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex gap-1 items-center">
                KYC
                {profile?.dni_photo_url && profile?.face_photo_url && profile?.verification_photo_url && (
                  <CheckCircle2 className="w-3 h-3 text-green-500 ml-1" />
                )}
              </TabsTrigger>
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
                        <Label htmlFor="dni" className="text-xs tracking-wide text-muted-foreground/85 dark:text-muted-foreground/60">DNI / Cédula</Label>
                        <Input
                          id="dni"
                          placeholder="Ej: V-12345678"
                          className="bg-card/80 border-border/15 focus:border-primary/30 uppercase"
                          {...form.register('dni')}
                          onChange={(e) => {
                            // Permite V/E al inicio, luego solo dígitos
                            const raw = e.target.value.toUpperCase();
                            const val = raw.replace(/^([VE]-)?(.*)/,  (_, prefix, rest) =>
                              (prefix || '') + rest.replace(/[^0-9]/g, '')
                            ).slice(0, 12);
                            form.setValue('dni', val, { shouldValidate: true });
                          }}
                        />
                        {form.formState.errors.dni && (
                          <p className="text-sm text-destructive">{form.formState.errors.dni.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-xs tracking-wide text-muted-foreground/85 dark:text-muted-foreground/60">Nombre completo</Label>
                        <Input
                          id="full_name"
                          placeholder="Tu nombre"
                          className="bg-card/80 border-border/15 focus:border-primary/30"
                          {...form.register('full_name')}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^A-Za-zÁ-Úá-úñÑ\s]/g, '').slice(0, 100);
                            form.setValue('full_name', val, { shouldValidate: true });
                          }}
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
                            onChange={(e) => {
                              let val = e.target.value.replace(/[^\d+]/g, '');
                              if (val && !val.startsWith('+')) val = '+' + val;
                              if (val.length > 13) val = val.substring(0, 13);
                              form.setValue('phone', val, { shouldValidate: true });
                            }}
                            pattern="^\+58(?:412|414|424|416|426|2\d{2})\d{7}$"
                            title="Debe ser un celular venezolano o teléfono fijo válido con +58"
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
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^a-zA-Z0-9@._-]/g, '').slice(0, 100);
                              form.setValue('email', val, { shouldValidate: true });
                            }}
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
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^A-Za-zÁ-Úá-úñÑ\s]/g, '').slice(0, 100);
                            form.setValue('city', val, { shouldValidate: true });
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="state" className="text-xs tracking-wide text-muted-foreground/85 dark:text-muted-foreground/60">Estado</Label>
                        <Input
                          id="state"
                          placeholder="Tu estado"
                          className="bg-card/80 border-border/15 focus:border-primary/30"
                          {...form.register('state')}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^A-Za-zÁ-Úá-úñÑ\s]/g, '').slice(0, 100);
                            form.setValue('state', val, { shouldValidate: true });
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="zip_code" className="text-xs tracking-wide text-muted-foreground/85 dark:text-muted-foreground/60">Código Postal</Label>
                        <Input
                          id="zip_code"
                          placeholder="1234"
                          className="bg-card/80 border-border/15 focus:border-primary/30"
                          {...form.register('zip_code')}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                            form.setValue('zip_code', val, { shouldValidate: true });
                          }}
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
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^A-Za-z0-9Á-Úá-úñÑ\s.,#-]/g, '').slice(0, 200);
                            form.setValue('address', val, { shouldValidate: true });
                          }}
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

            {/* Tab: Verificación KYC */}
            <TabsContent value="kyc">
              <Card className="bg-card/80 backdrop-blur-sm border border-border/10 shadow-[0_8px_32px_hsl(var(--rose)/0.06)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif tracking-tight">
                    <ShieldCheck className="h-4.5 w-4.5 text-primary/70" />
                    Verificación de Identidad (KYC)
                  </CardTitle>
                  <CardDescription className="text-muted-foreground/75 dark:text-muted-foreground/40 text-sm tracking-wide">
                    Sube tus documentos para poder realizar compras en nuestra plataforma. El tamaño máximo por archivo es de 5MB.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {!profile?.dni && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">Falta DNI en tu Perfil</p>
                        <p className="text-xs opacity-90">Por favor, guarda tu DNI / Cédula en la pestaña "Perfil" antes de subir tus documentos KYC para poder vincularlos correctamente.</p>
                      </div>
                    </div>
                  )}

                  {/* Banner de Estado KYC */}
                  {profile?.kyc_status === 'approved' && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 p-4 rounded-lg flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">¡Documentos Aprobados!</p>
                        <p className="text-xs opacity-90">Tu verificación de identidad ha sido completada exitosamente. Ya puedes solicitar créditos.</p>
                      </div>
                    </div>
                  )}

                  {profile?.kyc_status === 'pending' && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 p-4 rounded-lg flex items-center gap-3">
                      <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
                      <div>
                        <p className="font-medium text-sm">En Revisión</p>
                        <p className="text-xs opacity-90">Tus documentos están siendo revisados por nuestro equipo. Te notificaremos pronto.</p>
                      </div>
                    </div>
                  )}

                  {profile?.kyc_status === 'rejected' && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-center gap-3">
                      <User className="h-5 w-5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">Documentos Rechazados</p>
                        <p className="text-xs opacity-90">Por favor, vuelve a subir los documentos asegurándote de que sean legibles y cumplan con los requisitos.</p>
                      </div>
                    </div>
                  )}

                  {/* DNI */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Cédula de Identidad (Frente)</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-24 w-32 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center bg-muted/20 overflow-hidden relative">
                        {kycPreviews.dni ? (
                          <img src={kycPreviews.dni} alt="Cédula" className="object-cover w-full h-full" />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          onChange={(e) => handleKycFileChange('dni', e)}
                          disabled={profile?.kyc_status === 'pending' || profile?.kyc_status === 'approved'}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-xs text-muted-foreground">Sube una foto clara de tu cédula por el frente.</p>
                        {kycFiles.dni && <p className="text-xs text-primary font-medium">Archivo seleccionado: {kycFiles.dni.name}</p>}
                        {profile?.dni_photo_url && !kycFiles.dni && <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Documento actual</p>}
                      </div>
                    </div>
                  </div>

                  {/* Rostro */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Foto de tu rostro (Selfie)</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-24 w-24 rounded-full border-2 border-dashed border-border/50 flex items-center justify-center bg-muted/20 overflow-hidden relative">
                        {kycPreviews.face ? (
                          <img src={kycPreviews.face} alt="Selfie" className="object-cover w-full h-full" />
                        ) : (
                          <User className="h-8 w-8 text-muted-foreground/40" />
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          onChange={(e) => handleKycFileChange('face', e)}
                          disabled={profile?.kyc_status === 'pending' || profile?.kyc_status === 'approved'}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-xs text-muted-foreground">Sube una selfie donde tu rostro se vea claramente.</p>
                        {kycFiles.face && <p className="text-xs text-primary font-medium">Archivo seleccionado: {kycFiles.face.name}</p>}
                        {profile?.face_photo_url && !kycFiles.face && <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Documento actual</p>}
                      </div>
                    </div>
                  </div>

                  {/* Verificación */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Sosteniendo tu cédula</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-24 w-32 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center bg-muted/20 overflow-hidden relative">
                        {kycPreviews.verification ? (
                          <img src={kycPreviews.verification} alt="Verificación" className="object-cover w-full h-full" />
                        ) : (
                          <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          onChange={(e) => handleKycFileChange('verification', e)}
                          disabled={profile?.kyc_status === 'pending' || profile?.kyc_status === 'approved'}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-xs text-muted-foreground">Sube una foto tuya sosteniendo tu cédula cerca de tu rostro.</p>
                        {kycFiles.verification && <p className="text-xs text-primary font-medium">Archivo seleccionado: {kycFiles.verification.name}</p>}
                        {profile?.verification_photo_url && !kycFiles.verification && <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Documento actual</p>}
                      </div>
                    </div>
                  </div>

                  {profile?.kyc_status !== 'pending' && profile?.kyc_status !== 'approved' && (
                    <Button 
                      onClick={handleKycSubmit}
                      disabled={kycUploading || (!kycFiles.dni && !kycFiles.face && !kycFiles.verification) || !profile?.dni}
                      className="w-full btn-gold rounded-full h-12 mt-4"
                    >
                      {kycUploading ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Subiendo...</>
                      ) : (
                        <><Upload className="h-4 w-4 mr-2" /> Enviar Documentos KYC</>
                      )}
                    </Button>
                  )}
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
