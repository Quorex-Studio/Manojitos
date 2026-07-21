import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Lock, User, Phone, ArrowRight, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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
    fullName: '',
    phone: ''
  });

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
        const { sanitizeText } = await import('@/lib/validations');
        const safeName = sanitizeText(form.fullName);
        const { error } = await signUp(form.email, form.password, safeName, form.phone);
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              className="inline-block mb-4 overflow-hidden rounded-full shadow-lg shadow-gold/20"
            >
              <img src={logoImage} alt="Manojitos Logo" className="w-auto h-20 md:h-24 object-cover" />
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
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-6">
              <div className="space-y-2 group/input">
                <Label htmlFor="email" className="text-foreground/70 ml-1 text-xs font-bold uppercase tracking-widest">Correo electrónico <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors duration-300" />
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
              </div>
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
                  <Loader2 className="h-6 w-6 animate-spin" />
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
