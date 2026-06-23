import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { ShoppingBag, Search, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { UserMenu } from '@/components/ui/user-menu';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerNotifications } from '@/hooks/useCustomerNotifications';
import logoImage from '@/assets/logo.jpeg';
import { Bell } from 'lucide-react';

// Header de la tienda — Editorial luxury frosted glass
export function StoreHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const { getItemCount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const itemCount = getItemCount();

  // Detectar scroll para cambiar estilo del header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cerrar menú al cambiar de ruta
  useEffect(() => {
    setIsMenuOpen(false);
    setIsSearchOpen(false);
  }, [location.pathname]);

  // Manejar búsqueda
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/tienda?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  // Links de navegación
  const navLinks = [
    { to: '/', label: 'Inicio' },
    { to: '/tienda', label: 'Tienda' },
    { to: '/tienda?category=destacados', label: 'Destacados' },
  ];

  return (
    <motion.header 
      className={`sticky top-0 z-50 w-full transition-all duration-500 ${
        isScrolled 
          ? 'bg-background/80 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.06)] border-b border-border/20' 
          : 'bg-background/80 backdrop-blur-xl border-b border-border/10'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="container mx-auto px-4">
        {/* Main header */}
        <div className={`flex items-center justify-between transition-all duration-500 ${
          isScrolled ? 'h-14 md:h-16' : 'h-16 md:h-20'
        }`}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex items-center gap-2 min-w-0"
            >
              <img 
                src={logoImage} 
                alt="Manojitos" 
                className={`rounded-full object-cover flex-shrink-0 transition-all duration-500 ring-1 ring-gold/20 ${
                  isScrolled ? 'h-7 w-7 md:h-9 md:w-9' : 'h-8 w-8 md:h-11 md:w-11'
                }`}
              />
              <span className={`font-serif font-bold text-gradient-gold transition-all duration-500 ${
                isScrolled ? 'text-lg md:text-2xl' : 'text-xl md:text-3xl'
              }`}>
                Manojitos
              </span>
            </motion.div>
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <Link 
                key={link.to}
                to={link.to} 
                className="relative text-foreground/60 hover:text-foreground transition-colors duration-300 text-sm font-medium tracking-wide group"
              >
                {link.label}
                <motion.span 
                  className="absolute -bottom-1 left-0 w-full h-px bg-gold origin-left"
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-0.5 md:gap-2">
            {/* Search - Desktop */}
            <motion.div 
              className="hidden md:block relative"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <form onSubmit={handleSearch} className="relative">
                <Input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-44 lg:w-56 pl-9 pr-4 h-9 bg-card/80 backdrop-blur-sm border-border/30 rounded-full text-sm focus:w-64 focus:border-primary/30 transition-all duration-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              </form>
            </motion.div>

            {/* Search - Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            >
              <motion.div
                animate={{ rotate: isSearchOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <Search className="h-4.5 w-4.5" />
              </motion.div>
            </Button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notification Bell — solo para clientes autenticados */}
            {user && <CustomerNotificationBell />}

            {/* User Menu */}
            <UserMenu />

            {/* Cart con badge animado premium */}
            <Link to="/carrito" className="relative">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                  <ShoppingBag className="h-4.5 w-4.5" />
                  <AnimatePresence mode="wait">
                    {itemCount > 0 && (
                      <motion.div
                        key={itemCount}
                        initial={{ scale: 0, y: 10 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0, y: -10 }}
                        transition={{ 
                          type: 'spring', 
                          stiffness: 500, 
                          damping: 25 
                        }}
                        className="absolute -top-0.5 -right-0.5"
                      >
                        <Badge 
                          variant="default" 
                          className="h-4.5 min-w-4.5 p-0 px-1 flex items-center justify-center text-[10px] bg-gold text-white font-bold shadow-gold rounded-full"
                        >
                          {itemCount > 99 ? '99+' : itemCount}
                        </Badge>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </Link>

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <motion.div
                animate={{ rotate: isMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {isMenuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
              </motion.div>
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="md:hidden overflow-hidden"
            >
              <form onSubmit={handleSearch} className="py-3">
                <motion.div 
                  className="relative"
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <Input
                    type="text"
                    placeholder="Buscar productos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 h-11 bg-card/80 backdrop-blur-sm border-border/30 rounded-full"
                    autoFocus
                  />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                </motion.div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="md:hidden overflow-hidden border-t border-border/10"
            >
              <div className="py-4 space-y-1">
                {navLinks.map((link, index) => (
                  <motion.div
                    key={link.to}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.08 }}
                  >
                    <Link 
                      to={link.to}
                      onClick={() => setIsMenuOpen(false)}
                      className="block py-3 px-4 text-foreground/80 hover:text-foreground hover:bg-card/80 rounded-xl transition-all duration-300 active:scale-[0.98] text-sm tracking-wide"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: navLinks.length * 0.08 }}
                >
                  <Link 
                    to="/carrito"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-between py-3 px-4 text-foreground/80 hover:text-foreground hover:bg-card/80 rounded-xl transition-all duration-300 text-sm tracking-wide"
                  >
                    <span>Mi Carrito</span>
                    {itemCount > 0 && (
                      <Badge className="bg-gold text-white text-[10px] rounded-full">{itemCount}</Badge>
                    )}
                  </Link>
                </motion.div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}

// Campanita de notificaciones para clientes en el StoreHeader
function CustomerNotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useCustomerNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const recent = notifications.slice(0, 5);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen(v => !v)}
        aria-label="Notificaciones"
      >
        <Bell className="h-4.5 w-4.5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5"
            >
              <Badge className="h-4.5 min-w-4.5 p-0 px-1 flex items-center justify-center text-[10px] bg-destructive text-white font-bold rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 z-50 bg-card/95 backdrop-blur-xl border border-border/20 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-border/10">
                <h4 className="font-semibold text-sm">Notificaciones</h4>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => markAllAsRead.mutate()}
                    disabled={markAllAsRead.isPending}
                    className="text-xs h-7 text-primary"
                  >
                    Marcar todas
                  </Button>
                )}
              </div>
              <div className="divide-y divide-border/10 max-h-72 overflow-y-auto">
                {recent.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Sin notificaciones</p>
                  </div>
                ) : recent.map(n => (
                  <div
                    key={n.id}
                    onClick={() => { if (!n.is_read) markAsRead.mutate(n.id); }}
                    className={`p-3 cursor-pointer hover:bg-muted/40 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        n.type === 'warning' ? 'bg-yellow-500' :
                        n.type === 'error' ? 'bg-destructive' :
                        n.type === 'success' ? 'bg-green-500' : 'bg-primary'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${!n.is_read ? 'text-primary' : ''}`}>{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-border/10">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => { setOpen(false); navigate('/cliente/notificaciones'); }}
                >
                  Ver todas las notificaciones
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
