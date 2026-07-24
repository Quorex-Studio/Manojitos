import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Logout, Settings, Layout, ChevronDown } from 'reicon-react';
import { Button } from './button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Menú de usuario con estados autenticado/no autenticado
export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Manejar cierre de sesión
  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Sesión cerrada correctamente');
      setIsOpen(false);
      navigate('/');
    } catch (error) {
      toast.error('Error al cerrar sesión');
    }
  };

  // Obtener nombre del usuario
  const getUserName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Usuario';
  };

  // Obtener iniciales para el avatar
  const getInitials = () => {
    const name = getUserName();
    return name.charAt(0).toUpperCase();
  };

  // Si no está autenticado, mostrar botón de login
  if (!user) {
    return (
      <Link 
        to="/cliente/auth" 
        state={{ from: location.pathname }}
      >
        <Button 
          variant="outline" 
          size="sm"
          className="hidden sm:flex items-center gap-2 border-primary/30 hover:bg-primary/10"
        >
          <User className="h-4 w-4" />
          <span>Iniciar sesión</span>
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          className="sm:hidden"
        >
          <User className="h-5 w-5" />
        </Button>
      </Link>
    );
  }

  // Usuario autenticado - mostrar menú desplegable
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2"
      >
        {/* Avatar */}
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
          {getInitials()}
        </div>
        <span className="hidden md:inline text-sm font-medium max-w-24 truncate">
          {getUserName()}
        </span>
        <ChevronDown 
          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </Button>

      {/* Menú desplegable */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay para cerrar al hacer click afuera */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden"
            >
              {/* Header del menú */}
              <div className="p-4 border-b border-border/50 bg-muted/30">
                <p className="font-medium text-sm truncate">{getUserName()}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>

              {/* Opciones del menú */}
              <div className="p-2">
                {/* Enlace al panel admin (solo si es admin) */}
                {isAdmin && (
                  <Link
                    to="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                  >
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    <span>Panel Admin</span>
                  </Link>
                )}

                {/* Mi Perfil - siempre visible para usuarios logueados */}
                <Link
                  to="/cliente/perfil"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Mi Perfil</span>
                </Link>

                {/* Configuración - va a la página correcta según el tipo de usuario */}
                <Link
                  to={isAdmin ? "/settings" : "/cliente/configuracion"}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Configuración</span>
                </Link>

                <hr className="my-2 border-border/50" />

                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive w-full transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
