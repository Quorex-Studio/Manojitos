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
  const [isForgotPassword, setIsForgotPassword] = useState(false);
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
    const { name, value } = e.target;
    let finalValue = value;
    
    // Auto-formateo en tiempo real
    if (name === 'fullName') {
      finalValue = finalValue.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    } else if (name === 'email') {
      finalValue = finalValue.replace(/[^a-zA-Z0-9@._\-+]/g, '');
    } else if (name === 'dni') {
      finalValue = finalValue.replace(/[^vVeEjJgGpP0-9\-]/g, '').toUpperCase().trim();
      // Sugerir guión si solo meten números después de la letra
      if (/^[VJEGP]\d/.test(finalValue)) {
        finalValue = finalValue.charAt(0) + '-' + finalValue.substring(1);
      }
    } else if (name === 'phone') {
      finalValue = finalValue.replace(/[^\+0-9\-\(\)]/g, '').trim();
      // Auto prefijo venezolano si empieza por 0
      if (finalValue.startsWith('0')) {
        finalValue = '+58' + finalValue.substring(1);
      } else if (finalValue.length > 0 && !finalValue.startsWith('+') && finalValue.startsWith('58')) {
        finalValue = '+' + finalValue;
      }
    }

    setForm(prev => ({
      ...prev,
      [name]: finalValue
    }));
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) {
      toast({
        title: 'Email requerido',
        description: 'Por favor, ingresa tu correo electrónico para recuperar tu contraseña.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}/cliente/recuperar`,
      });
      
      if (error) throw error;
      
      toast({
        title: 'Correo enviado',
        description: 'Revisa tu bandeja de entrada o spam para restablecer tu contraseña.'
      });
      setIsForgotPassword(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo enviar el correo de recuperación.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
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

        // Validación estricta DNI
        const dniRegex = /^[VJEGP]-\d{7,9}$/;
        if (!dniRegex.test(form.dni)) {
          toast({
            title: 'Formato de Cédula Inválido',
            description: 'Debe usar el formato V-12345678, E-12345678, J-123456789, G-12345678 o P-12345678',
            variant: 'destructive'
          });
          setLoading(false);
          return;
        }

        // Validación estricta Teléfono
        const phoneRegex = /^\+58(?:412|414|424|416|426|2\d{2})\d{7}$/;
        if (!phoneRegex.test(form.phone)) {
          toast({
            title: 'Formato de Teléfono Inválido',
            description: 'Debe usar el formato +58 seguido del operador y número (Ej: +584121234567)',
            variant: 'destructive'
          });
          setLoading(false);
          return;
        }

        // Validación estricta de Dirección
        if (form.address.trim().length < 10) {
          toast({
            title: 'Dirección muy corta',
            description: 'Por favor proporciona una dirección más específica (mínimo 10 caracteres)',
            variant: 'destructive'
          });
          setLoading(false);
          return;
        }

        // Validar unicidad antes de intentar registrar
        try {
          const { data, error: rpcError } = await supabase.rpc('check_unique_customer_data', {
            p_phone: form.phone,
            p_dni: form.dni,
            p_email: form.email
          });

          if (rpcError) {
            console.error('Error checking unique data:', rpcError);
          } else if (data) {
            const result = data as any;
            if (result.email_taken) {
              toast({ title: 'Error', description: 'El correo ya está registrado. Inicia sesión.', variant: 'destructive' });
              setLoading(false);
              return;
            }
            if (result.dni_taken) {
              toast({ title: 'Error', description: 'La cédula (DNI) ya está registrada.', variant: 'destructive' });
              setLoading(false);
              return;
            }
            if (result.phone_taken) {
              toast({ title: 'Error', description: 'El número de teléfono ya está registrado.', variant: 'destructive' });
              setLoading(false);
              return;
            }
          }
        } catch (checkError) {
          console.error('Error during validation:', checkError);
        }

        // Sanitización para XSS pre-registro
        const { sanitizeText } = await import('@/lib/validations');
        const safeName = sanitizeText(form.fullName);
        const safeAddress = sanitizeText(form.address);

        const { error } = await signUp(
          form.email, 
          form.password, 
          safeName, 
          form.phone,
          form.dni,
          undefined, // avatarUrl
          safeAddress,
          form.locationCoords
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
          toast({ title: '¡Registro exitoso!', description: 'Por favor, revisa tu bandeja de entrada (o carpeta de spam) y haz clic en el enlace para confirmar tu cuenta.', duration: 8000 }); setIsLogin(true);
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
                {isForgotPassword ? 'Recuperar Clave' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </h1>
              <p className="text-muted-foreground mt-2">
                {isForgotPassword 
                  ? 'Te enviaremos un enlace a tu correo'
                  : isLogin 
                  ? 'Ingresa tus datos para continuar' 
                  : 'Regístrate para completar tu compra'}
              </p>
            </div>

            {isForgotPassword ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative mt-1">
                    <Input
                      id="reset-email"
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

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full btn-gold mt-6"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar enlace de recuperación'
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <Label htmlFor="fullName">Nombre Completo <span className="text-destructive">*</span></Label>
                      <div className="relative mt-1">
                        <Input
                          id="fullName"
                          name="fullName"
                          type="text"
                          placeholder="Tu nombre y apellido"
                          value={form.fullName}
                          onChange={handleInputChange}
                          className="pl-10"
                          required
                        />
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone">Teléfono <span className="text-destructive">*</span></Label>
                        <div className="relative mt-1">
                          <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            placeholder="+584121234567"
                            value={form.phone}
                            onChange={handleInputChange}
                            className="pl-10"
                            required
                            pattern="^\+58(?:412|414|424|416|426|2\d{2})\d{7}$"
                            title="Formato: +584121234567"
                          />
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Formato: +584121234567
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="dni">Cédula o RIF <span className="text-destructive">*</span></Label>
                        <div className="relative mt-1">
                          <Input
                            id="dni"
                            name="dni"
                            type="text"
                            placeholder="V-12345678"
                            value={form.dni}
                            onChange={handleInputChange}
                            className="pl-10"
                            required
                            pattern="^[VJEGP]-\d{7,9}$"
                            title="Formato: V-12345678, J-123456789"
                          />
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Formato: V-12345678
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address">Ubicación / Dirección exacta <span className="text-destructive">*</span></Label>
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
                            required
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
                  <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
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
                  <Label htmlFor="password">Contraseña <span className="text-destructive">*</span></Label>
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

                {isLogin && (
                  <div className="flex justify-end mt-1">
                    <Button
                      type="button"
                      variant="link"
                      className="text-xs text-accent h-auto p-0"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsForgotPassword(true);
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </Button>
                  </div>
                )}

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
            )}

            <Separator className="my-6" />

            {/* Toggle */}
            <div className="text-center">
              {isForgotPassword ? (
                <Button
                  variant="link"
                  className="text-muted-foreground font-medium"
                  onClick={() => setIsForgotPassword(false)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a iniciar sesión
                </Button>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">
                    {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                  </p>
                  <Button
                    variant="link"
                    className="text-accent font-medium"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setIsForgotPassword(false);
                    }}
                  >
                    {isLogin ? 'Crear una cuenta' : 'Iniciar sesión'}
                  </Button>
                </>
              )}
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

