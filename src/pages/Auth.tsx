import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {Loader,  Refresh, Mailbox, Lock, User, Phone, ArrowRight, Sparkles, Location, UserId, Check, X } from 'reicon-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import logoImage from '@/assets/logo.jpeg';

export default function Auth() {
  // --- STATE ---
  const navigate = useNavigate();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    dni: '',
    address: ''
  });

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 0) {
      if (pass.length >= 8) score++;
      if (/[A-Z]/.test(pass)) score++;
      if (/[0-9]/.test(pass)) score++;
      if (/[^a-zA-Z0-9]/.test(pass)) score++;
    }
    return score;
  };
  
  const passwordScore = getPasswordStrength(form.password);

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  // --- HANDLERS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    let finalValue = value;
    
    // Auto-formateo en tiempo real
    if (id === 'fullName') {
      finalValue = finalValue.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    } else if (id === 'email') {
      finalValue = finalValue.replace(/[^a-zA-Z0-9@._\-+]/g, '');
    } else if (id === 'dni') {
      finalValue = finalValue.replace(/[^VEJGP0-9-]/gi, '').toUpperCase();
    } else if (id === 'phone') {
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
      [id]: finalValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(form.email, form.password);
        if (error) {
          toast({
            title: 'Error',
            description: error.message === 'Invalid login credentials' 
              ? 'Credenciales inválidas' 
              : error.message,
            variant: 'destructive'
          });
        }
      } else {
        if (form.password !== form.confirmPassword) {
          toast({ title: 'Error', description: 'Las contraseñas no coinciden', variant: 'destructive' });
          setLoading(false);
          return;
        }
        if (passwordScore < 3) {
          toast({ title: 'Contraseña débil', description: 'La contraseña debe tener al menos 8 caracteres, incluir números y mayúsculas.', variant: 'destructive' });
          setLoading(false);
          return;
        }

        // Validación de unicidad
        const { data: uniquenessCheck, error: rpcError } = await supabase.rpc('check_unique_customer_data', {
          p_phone: form.phone,
          p_dni: form.dni,
          p_email: form.email
        });
        
        if (rpcError) {
          toast({ title: 'Error de validación', description: 'Hubo un error verificando tus datos. Inténtalo de nuevo.', variant: 'destructive' });
          setLoading(false);
          return;
        }

        if (uniquenessCheck) {
          const check = uniquenessCheck as { email_taken: boolean, dni_taken: boolean, phone_taken: boolean };
          if (check.email_taken) {
            toast({ title: 'Error', description: 'El correo electrónico ya está registrado', variant: 'destructive' });
            setLoading(false);
            return;
          }
          if (check.dni_taken) {
            toast({ title: 'Error', description: 'El DNI o Cédula ya está registrado', variant: 'destructive' });
            setLoading(false);
            return;
          }
          if (check.phone_taken) {
            toast({ title: 'Error', description: 'El número de teléfono ya está registrado', variant: 'destructive' });
            setLoading(false);
            return;
          }
        }

        const { sanitizeText } = await import('@/lib/validations');
        const safeName = sanitizeText(form.fullName);
        const { error } = await signUp(form.email, form.password, safeName, form.phone, form.dni, undefined, form.address);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Error',
              description: 'Este correo ya está registrado',
              variant: 'destructive'
            });
          } else {
            toast({
              title: 'Error',
              description: error.message,
              variant: 'destructive'
            });
          }
        } else {
          toast({
            title: 'Cuenta creada',
            description: 'Revisa tu correo de confirmación o intenta iniciar sesión directamente.'
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER ---
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background orbs — GPU optimized */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-orb-1" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-accent/15 rounded-full blur-[140px] animate-orb-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-rose/5 rounded-full blur-[160px] animate-orb-3" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ 
          type: "spring",
          damping: 25,
          stiffness: 200,
          mass: 1
        }}
        className="w-full max-w-md z-10"
      >
        <div className="glass-card-editorial rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          
          {/* Logo / Header */}
          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className="inline-block mb-4 overflow-hidden rounded-2xl shadow-xl shadow-black/10 bg-transparent"
            >
              <img src={logoImage} alt="Manojitos Logo" className="w-auto h-28 md:h-36 object-contain" />
            </motion.div>
            <h1 className="font-serif text-5xl font-bold text-gradient-gold tracking-tight mb-2">
              Manojitos
            </h1>
            <AnimatePresence mode="wait">
              <motion.p
                key={isLogin ? 'login-sub' : 'signup-sub'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="text-muted-foreground/60 font-medium tracking-wide"
              >
                {isLogin ? 'Bienvenida de vuelta' : 'Crea tu cuenta exclusiva'}
              </motion.p>
            </AnimatePresence>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: 20 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="space-y-6"
                >
                  <div className="space-y-2 group/input">
                    <Label htmlFor="fullName" className="text-foreground/70 ml-1 text-xs font-bold uppercase tracking-widest">Nombre completo <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors duration-300" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Tu nombre"
                        value={form.fullName}
                        onChange={handleInputChange}
                        className="pl-12 h-14 bg-background/40 border-border/20 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all duration-300 placeholder:text-muted-foreground/20"
                        aria-required="true"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 group/input">
                    <Label htmlFor="phone" className="text-foreground/70 ml-1 text-xs font-bold uppercase tracking-widest">Teléfono <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors duration-300" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+58 412 1234567"
                        value={form.phone}
                        onChange={handleInputChange}
                        className="pl-12 h-14 bg-background/40 border-border/20 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all duration-300 placeholder:text-muted-foreground/20"
                        aria-required="true"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 group/input">
                    <Label htmlFor="dni" className="text-foreground/70 ml-1 text-xs font-bold uppercase tracking-widest">Cédula de Identidad <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <UserId className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors duration-300" />
                      <Input
                        id="dni"
                        type="text"
                        placeholder="V-12345678"
                        value={form.dni}
                        onChange={handleInputChange}
                        className="pl-12 h-14 bg-background/40 border-border/20 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all duration-300 placeholder:text-muted-foreground/20"
                        required={!isLogin}
                        aria-required="true"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 group/input">
                    <Label htmlFor="address" className="text-foreground/70 ml-1 text-xs font-bold uppercase tracking-widest">Ubicación / Dirección <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Location className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors duration-300" />
                      <Input
                        id="address"
                        type="text"
                        placeholder="Ej: Av. Principal, Edificio Central, Apt 4"
                        value={form.address}
                        onChange={handleInputChange}
                        className="pl-12 h-14 bg-background/40 border-border/20 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all duration-300 placeholder:text-muted-foreground/20"
                        required={!isLogin}
                        aria-required="true"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-6">
              <div className="space-y-2 group/input">
                <Label htmlFor="email" className="text-foreground/70 ml-1 text-xs font-bold uppercase tracking-widest">Correo electrónico <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Mailbox className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors duration-300" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={form.email}
                    onChange={handleInputChange}
                    className="pl-12 h-14 bg-background/40 border-border/20 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all duration-300 placeholder:text-muted-foreground/20"
                    required
                    aria-required="true"
                  />
                </div>
              </div>

              <div className="space-y-2 group/input">
                <Label htmlFor="password" className="text-foreground/70 ml-1 text-xs font-bold uppercase tracking-widest">Contraseña <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors duration-300" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleInputChange}
                    className="pl-12 h-14 bg-background/40 border-border/20 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all duration-300 placeholder:text-muted-foreground/20"
                    required
                    aria-required="true"
                    minLength={6}
                  />
                </div>
                {/* Medidor de seguridad de contraseña */}
                {!isLogin && form.password.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-1 h-1.5">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={cn(
                            "flex-1 rounded-full transition-colors duration-300",
                            passwordScore >= step
                              ? passwordScore <= 2
                                ? "bg-destructive/60"
                                : passwordScore === 3
                                ? "bg-yellow-500/80"
                                : "bg-green-500/80"
                              : "bg-border/20"
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground/70 uppercase font-bold tracking-wider">
                      <span>Nivel de seguridad</span>
                      <span>
                        {passwordScore <= 2 ? 'Débil' : passwordScore === 3 ? 'Aceptable' : 'Fuerte'}
                      </span>
                    </div>
                    <ul className="text-xs space-y-1 text-muted-foreground/60">
                      <li className={cn("flex items-center gap-1", form.password.length >= 8 ? "text-green-500" : "")}>
                        {form.password.length >= 8 ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 text-destructive/50" />} 8+ caracteres
                      </li>
                      <li className={cn("flex items-center gap-1", /[A-Z]/.test(form.password) ? "text-green-500" : "")}>
                        {/[A-Z]/.test(form.password) ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 text-destructive/50" />} Letra mayúscula
                      </li>
                      <li className={cn("flex items-center gap-1", /[0-9]/.test(form.password) ? "text-green-500" : "")}>
                        {/[0-9]/.test(form.password) ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 text-destructive/50" />} Número
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              <AnimatePresence mode="popLayout">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: 20 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="space-y-2 group/input overflow-hidden"
                  >
                    <Label htmlFor="confirmPassword" className="text-foreground/70 ml-1 text-xs font-bold uppercase tracking-widest">Confirmar Contraseña <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors duration-300" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={form.confirmPassword}
                        onChange={handleInputChange}
                        className={cn(
                          "pl-12 h-14 bg-background/40 rounded-2xl transition-all duration-300 placeholder:text-muted-foreground/20",
                          form.confirmPassword.length > 0 && form.password !== form.confirmPassword 
                            ? "border-destructive/50 focus:ring-destructive/20 focus:border-destructive" 
                            : "border-border/20 focus:ring-primary/20 focus:border-primary"
                        )}
                        required={!isLogin}
                        aria-required="true"
                        minLength={6}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="pt-2"
            >
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 btn-gold rounded-[1.25rem] text-lg font-bold group"
              >
                {loading ? (
                  <Loader className="h-6 w-6 animate-spin" />
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                )}
              </Button>
            </motion.div>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground/60 hover:text-foreground transition-all duration-300 text-sm font-medium"
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={isLogin ? 'no-acc' : 'has-acc'}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  {isLogin ? (
                    <>¿No tienes cuenta? <span className="text-primary font-bold hover:underline decoration-2 underline-offset-4 transition-all">Regístrate gratis</span></>
                  ) : (
                    <>¿Ya tienes cuenta? <span className="text-primary font-bold hover:underline decoration-2 underline-offset-4 transition-all">Inicia sesión aquí</span></>
                  )}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
