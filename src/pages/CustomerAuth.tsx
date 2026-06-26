import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Loader2, ArrowLeft, ShoppingBag, Phone, FileText, MapPin, Camera, Navigation, AlertCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { StoreLayout } from '@/components/store/StoreLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Página de autenticación para clientes (separada del admin)
export default function CustomerAuth() {
  // --- STATE ---
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    dni: '',
    address: '',
    locationCoords: ''
  });

  const [dniFile, setDniFile] = useState<File | null>(null);
  const [dniPreview, setDniPreview] = useState<string | null>(null);
  const dniFileInputRef = useRef<HTMLInputElement>(null);

  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const faceFileInputRef = useRef<HTMLInputElement>(null);

  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationPreview, setVerificationPreview] = useState<string | null>(null);
  const verificationFileInputRef = useRef<HTMLInputElement>(null);

  const [gettingGPS, setGettingGPS] = useState(false);

  const redirectTo = searchParams.get('redirect') || '/';

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (user) {
      navigate(redirectTo);
    }
  }, [user, navigate, redirectTo]);

  // --- HANDLERS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleKycFileChange = (type: 'dni' | 'face' | 'verification', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) { // límite de 2MB
        toast({
          title: 'Archivo muy grande',
          description: 'La foto debe ser menor a 2MB.',
          variant: 'destructive'
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'dni') {
          setDniFile(file);
          setDniPreview(reader.result as string);
        } else if (type === 'face') {
          setFaceFile(file);
          setFacePreview(reader.result as string);
        } else if (type === 'verification') {
          setVerificationFile(file);
          setVerificationPreview(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocalización no soportada',
        description: 'Tu navegador no permite capturar la ubicación por GPS.',
        variant: 'destructive'
      });
      return;
    }

    setGettingGPS(true);

    const successCallback = (position: any) => {
      const { latitude, longitude } = position.coords;
      const coordsStr = `${latitude},${longitude}`;
      setForm(prev => ({
        ...prev,
        locationCoords: coordsStr,
        address: prev.address || `Ubicación GPS: ${coordsStr}`
      }));
      setGettingGPS(false);
      toast({
        title: 'Ubicación obtenida',
        description: 'Coordenadas GPS registradas con éxito.'
      });
    };

    const getIPLocation = async () => {
      console.log('Starting IP geolocation fallbacks...');

      // 1. Intentar con ipwho.is (CORS y HTTPS gratuito)
      try {
        console.log('Querying ipwho.is...');
        const response = await fetch('https://ipwho.is/');
        if (response.ok) {
          const data = await response.json();
          if (data && data.success && data.latitude && data.longitude) {
            const coordsStr = `${data.latitude},${data.longitude}`;
            setForm(prev => ({
              ...prev,
              locationCoords: coordsStr,
              address: prev.address || `Ubicación estimada: ${data.city || ''}, ${data.region || ''}, ${data.country || ''}`.trim()
            }));
            setGettingGPS(false);
            toast({
              title: 'Ubicación aproximada obtenida',
              description: 'Se usó tu dirección de red para estimar tu ubicación.'
            });
            console.log('ipwho.is geolocation succeeded:', coordsStr);
            return;
          } else {
            console.log('ipwho.is returned success=false or missing coords:', data);
          }
        } else {
          console.log('ipwho.is response status:', response.status);
        }
      } catch (err) {
        console.log('ipwho.is query failed:', err);
      }

      // 2. Intentar con freeipapi.com (CORS y HTTPS gratuito)
      try {
        console.log('Querying freeipapi.com...');
        const response = await fetch('https://freeipapi.com/api/json');
        if (response.ok) {
          const data = await response.json();
          if (data && data.latitude && data.longitude) {
            const coordsStr = `${data.latitude},${data.longitude}`;
            setForm(prev => ({
              ...prev,
              locationCoords: coordsStr,
              address: prev.address || `Ubicación estimada: ${data.cityName || ''}, ${data.regionName || ''}, ${data.countryName || ''}`.trim()
            }));
            setGettingGPS(false);
            toast({
              title: 'Ubicación aproximada obtenida',
              description: 'Se usó tu dirección de red para estimar tu ubicación.'
            });
            console.log('freeipapi.com geolocation succeeded:', coordsStr);
            return;
          } else {
            console.log('freeipapi.com missing coordinates:', data);
          }
        } else {
          console.log('freeipapi.com response status:', response.status);
        }
      } catch (err) {
        console.log('freeipapi.com query failed:', err);
      }

      // 3. Intentar con ipapi.co (CORS y HTTPS gratuito)
      try {
        console.log('Querying ipapi.co...');
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          if (data && !data.error && data.latitude && data.longitude) {
            const coordsStr = `${data.latitude},${data.longitude}`;
            setForm(prev => ({
              ...prev,
              locationCoords: coordsStr,
              address: prev.address || `Ubicación estimada: ${data.city || ''}, ${data.region || ''}, ${data.country_name || ''}`.trim()
            }));
            setGettingGPS(false);
            toast({
              title: 'Ubicación aproximada obtenida',
              description: 'Se usó tu dirección de red para estimar tu ubicación.'
            });
            console.log('ipapi.co geolocation succeeded:', coordsStr);
            return;
          } else {
            console.log('ipapi.co returned error or missing coordinates:', data);
          }
        } else {
          console.log('ipapi.co response status:', response.status);
        }
      } catch (err) {
        console.log('ipapi.co query failed:', err);
      }

      // Si todo falla, mostrar error manual
      console.log('All IP geolocation fallbacks failed.');
      setGettingGPS(false);
      toast({
        title: 'Error de ubicación',
        description: 'No se pudo obtener la ubicación exacta. Por favor, escríbela o introduce las coordenadas manualmente.',
        variant: 'destructive'
      });
    };

    const errorCallbackLow = (error: any) => {
      console.error('Low accuracy geolocation failed:', error);
      // Intentar geolocalización por IP como recurso automático final
      getIPLocation();
    };

    const errorCallbackHigh = (error: any) => {
      if (error.code === 1) { // PERMISSION_DENIED
        setGettingGPS(false);
        toast({
          title: 'Permiso de ubicación denegado',
          description: 'No se pudo acceder al GPS porque los permisos están desactivados en tu navegador. Por favor, escribe tu dirección o introduce las coordenadas manualmente.',
          variant: 'destructive'
        });
        return;
      }

      console.warn('High accuracy geolocation failed, retrying with low accuracy...', error);
      navigator.geolocation.getCurrentPosition(
        successCallback,
        errorCallbackLow,
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    // Intentar primero con alta precisión y un timeout más corto (5s)
    navigator.geolocation.getCurrentPosition(
      successCallback,
      errorCallbackHigh,
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Iniciar sesión
        const { error } = await signIn(form.email, form.password);
        if (error) {
          toast({
            title: 'Error al iniciar sesión',
            description: error.message === 'Invalid login credentials'
              ? 'Email o contraseña incorrectos'
              : error.message,
            variant: 'destructive'
          });
        } else {
          toast({
            title: '¡Bienvenido!',
            description: 'Has iniciado sesión correctamente'
          });
          navigate(redirectTo);
        }
      } else {
        // Registrarse
        if (form.password.length < 6) {
          toast({
            title: 'Contraseña muy corta',
            description: 'La contraseña debe tener al menos 6 caracteres',
            variant: 'destructive'
          });
          setLoading(false);
          return;
        }

        // Verificar que se hayan cargado las 3 fotos obligatorias para el KYC
        if (!dniFile || !faceFile || !verificationFile) {
          toast({
            title: 'Fotos de verificación obligatorias',
            description: 'Para solicitar crédito debes cargar las 3 fotos: Cédula de identidad, Foto frontal de tu rostro y Foto sosteniendo tu cédula.',
            variant: 'destructive'
          });
          setLoading(false);
          return;
        }

        // Subir las 3 imágenes de verificación KYC
        let dniPhotoUrl = '';
        let facePhotoUrl = '';
        let verificationPhotoUrl = '';

        const uploadKycFile = async (file: File, prefix: string) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${prefix}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('customer-avatars')
            .upload(fileName, file);

          if (uploadError) {
            throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('customer-avatars')
            .getPublicUrl(fileName);

          return publicUrl;
        };

        try {
          dniPhotoUrl = await uploadKycFile(dniFile, 'dni');
          facePhotoUrl = await uploadKycFile(faceFile, 'face');
          verificationPhotoUrl = await uploadKycFile(verificationFile, 'verification');
        } catch (uploadErr: any) {
          console.error('Error uploading KYC documents:', uploadErr);
          toast({
            title: 'Error al subir documentos',
            description: 'No se pudieron subir las fotos de verificación. Por favor, verifica tu conexión e inténtalo de nuevo.',
            variant: 'destructive'
          });
          setLoading(false);
          return;
        }

        const { error } = await signUp(
          form.email, 
          form.password, 
          form.fullName, 
          form.phone,
          form.dni,
          facePhotoUrl, // avatarUrl para compatibilidad
          form.address,
          form.locationCoords,
          dniPhotoUrl,
          facePhotoUrl,
          verificationPhotoUrl
        );

        if (error) {
          let message = error.message;
          if (error.message.includes('already registered')) {
            message = 'Este email ya está registrado. Intenta iniciar sesión.';
          }
          toast({
            title: 'Error al registrarse',
            description: message,
            variant: 'destructive'
          });
        } else {
          toast({
            title: '¡Registro exitoso!',
            description: 'Cuenta creada y verificada automáticamente. Ya puedes iniciar sesión.'
          });
          // Limpiar formulario excepto el email para facilitar el login, y cambiar a vista de login
          setForm({
            email: form.email,
            password: '',
            fullName: '',
            phone: '',
            dni: '',
            address: '',
            locationCoords: ''
          });
          setDniFile(null);
          setDniPreview(null);
          setFaceFile(null);
          setFacePreview(null);
          setVerificationFile(null);
          setVerificationPreview(null);
          setIsLogin(true);
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER ---
  if (authLoading) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-md mx-auto">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6 md:p-8"
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                <ShoppingBag className="h-8 w-8 text-accent" />
              </div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
                {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </h1>
              <p className="text-muted-foreground mt-2">
                {isLogin 
                  ? 'Ingresa tus datos para continuar' 
                  : 'Regístrate para completar tu compra'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  {/* KYC Verification Upload (3 Photos) */}
                  <div className="flex flex-col space-y-4 mb-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                      <ShieldAlert className="h-5 w-5 text-accent" />
                      <div>
                        <Label className="text-sm font-semibold block text-foreground">Verificación de Identidad (KYC)</Label>
                        <span className="text-[11px] text-muted-foreground block">Obligatorio para solicitar financiamiento</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Tarjeta 1: Cédula */}
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-medium text-muted-foreground mb-1 text-center">1. Foto de Cédula</span>
                        <div 
                          onClick={() => dniFileInputRef.current?.click()}
                          className="relative w-full aspect-[4/3] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-accent flex items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden group bg-muted/20"
                        >
                          {dniPreview ? (
                            <img 
                              src={dniPreview} 
                              alt="Cédula" 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-2 text-muted-foreground group-hover:text-accent text-center">
                              <FileText className="h-6 w-6 mb-1 opacity-70" />
                              <span className="text-[10px] leading-tight">Subir documento</span>
                            </div>
                          )}
                          {dniPreview && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <Camera className="h-5 w-5 text-white" />
                            </div>
                          )}
                        </div>
                        <input 
                          type="file"
                          ref={dniFileInputRef}
                          onChange={(e) => handleKycFileChange('dni', e)}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>

                      {/* Tarjeta 2: Cara */}
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-medium text-muted-foreground mb-1 text-center">2. Foto de Rostro</span>
                        <div 
                          onClick={() => faceFileInputRef.current?.click()}
                          className="relative w-full aspect-[4/3] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-accent flex items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden group bg-muted/20"
                        >
                          {facePreview ? (
                            <img 
                              src={facePreview} 
                              alt="Rostro" 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-2 text-muted-foreground group-hover:text-accent text-center">
                              <User className="h-6 w-6 mb-1 opacity-70" />
                              <span className="text-[10px] leading-tight">Subir selfie</span>
                            </div>
                          )}
                          {facePreview && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <Camera className="h-5 w-5 text-white" />
                            </div>
                          )}
                        </div>
                        <input 
                          type="file"
                          ref={faceFileInputRef}
                          onChange={(e) => handleKycFileChange('face', e)}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>

                      {/* Tarjeta 3: Cara con Cédula */}
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-medium text-muted-foreground mb-1 text-center">3. Rostro + Cédula</span>
                        <div 
                          onClick={() => verificationFileInputRef.current?.click()}
                          className="relative w-full aspect-[4/3] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-accent flex items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden group bg-muted/20"
                        >
                          {verificationPreview ? (
                            <img 
                              src={verificationPreview} 
                              alt="Verificación" 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-2 text-muted-foreground group-hover:text-accent text-center">
                              <Camera className="h-6 w-6 mb-1 opacity-70" />
                              <span className="text-[10px] leading-tight">Sosteniendo DNI</span>
                            </div>
                          )}
                          {verificationPreview && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <Camera className="h-5 w-5 text-white" />
                            </div>
                          )}
                        </div>
                        <input 
                          type="file"
                          ref={verificationFileInputRef}
                          onChange={(e) => handleKycFileChange('verification', e)}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">Formatos: JPG, PNG. Máx 2MB por imagen. El rostro y la cédula deben ser legibles.</p>
                  </div>

                  <div>
                    <Label htmlFor="fullName">Nombre Completo</Label>
                    <div className="relative mt-1">
                      <Input
                        id="fullName"
                        name="fullName"
                        type="text"
                        placeholder="Tu nombre y apellido"
                        value={form.fullName}
                        onChange={handleInputChange}
                        className="pl-10"
                        required={!isLogin}
                      />
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Teléfono</Label>
                      <div className="relative mt-1">
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="+58 412 1234567"
                          value={form.phone}
                          onChange={handleInputChange}
                          className="pl-10"
                          required={!isLogin}
                        />
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="dni">Cédula de Identidad</Label>
                      <div className="relative mt-1">
                        <Input
                          id="dni"
                          name="dni"
                          type="text"
                          placeholder="V-12345678"
                          value={form.dni}
                          onChange={handleInputChange}
                          className="pl-10"
                          required={!isLogin}
                        />
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address">Ubicación / Dirección exacta</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="relative flex-1">
                        <Input
                          id="address"
                          name="address"
                          type="text"
                          placeholder="Calle, Urbanización, Local, Punto de referencia"
                          value={form.address}
                          onChange={handleInputChange}
                          className="pl-10 text-ellipsis"
                          required={!isLogin}
                        />
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGetLocation}
                        disabled={gettingGPS}
                        className="flex-shrink-0"
                        title="Obtener coordenadas GPS automáticamente"
                      >
                        {gettingGPS ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Navigation className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="locationCoords" className="text-xs text-muted-foreground">
                          Coordenadas GPS (Latitud, Longitud) <span className="text-[10px]">(Opcional)</span>
                        </Label>
                        <a
                          href="https://www.google.com/maps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-accent hover:underline flex items-center gap-0.5"
                        >
                          Buscar en Google Maps ↗
                        </a>
                      </div>
                      <Input
                        id="locationCoords"
                        name="locationCoords"
                        type="text"
                        placeholder="Ej: 10.4806,-66.9036"
                        value={form.locationCoords}
                        onChange={handleInputChange}
                        className="h-9 text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Si falla la obtención automática, puedes buscar tu ubicación en Google Maps, hacer clic derecho (o mantener pulsado en móvil) y copiar las coordenadas.
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-1">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={form.email}
                    onChange={handleInputChange}
                    className="pl-10"
                    required
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div>
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleInputChange}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                {!isLogin && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Mínimo 6 caracteres
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full btn-gold mt-6"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isLogin ? 'Iniciando sesión...' : 'Creando cuenta...'}
                  </>
                ) : (
                  isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'
                )}
              </Button>
            </form>

            <Separator className="my-6" />

            {/* Toggle */}
            <div className="text-center">
              <p className="text-muted-foreground text-sm">
                {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
              </p>
              <Button
                variant="link"
                className="text-accent font-medium"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? 'Crear una cuenta' : 'Iniciar sesión'}
              </Button>
            </div>
          </motion.div>

          {/* Info */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Al continuar, aceptas nuestros términos y condiciones.
          </p>
        </div>
      </div>
    </StoreLayout>
  );
}
