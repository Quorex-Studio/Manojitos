import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { ShoppingBag, Search, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { UserMenu } from '@/components/ui/user-menu';
import { useCart } from '@/contexts/CartContext';
import logoImage from '@/assets/logo.jpeg';

// Header de la tienda con animaciones premium
export function StoreHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const { getItemCount } = useCart();
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
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled 
          ? 'bg-background/98 backdrop-blur-xl shadow-lg border-b border-border/30' 
          : 'bg-background/95 backdrop-blur-md border-b border-border/50'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="container mx-auto px-4">
        {/* Top bar - Solo en desktop */}
        <AnimatePresence>
          {!isScrolled && (
            <motion.div 
              className="hidden md:flex items-center justify-end py-2 text-sm text-muted-foreground border-b border-border/30"
              initial={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <span>Envíos a toda Venezuela 🇻🇪</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main header */}
        <div className={`flex items-center justify-between transition-all duration-300 ${
          isScrolled ? 'h-14 md:h-16' : 'h-16 md:h-20'
        }`}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex items-center gap-2"
            >
              <img 
                src={logoImage} 
                alt="Manojitos" 
                className={`rounded-full object-cover transition-all duration-300 ${
                  isScrolled ? 'h-8 w-8 md:h-10 md:w-10' : 'h-10 w-10 md:h-12 md:w-12'
                }`}
              />
              <span className={`font-serif font-bold text-gradient-gold transition-all duration-300 ${
                isScrolled ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'
              }`}>
                Manojitos
              </span>
            </motion.div>
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link 
                key={link.to}
                to={link.to} 
                className="relative text-foreground/80 hover:text-foreground transition-colors font-medium group"
              >
                {link.label}
                <motion.span 
                  className="absolute -bottom-1 left-0 w-full h-0.5 bg-gold origin-left"
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.2 }}
                />
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-3">
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
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 lg:w-64 pl-10 pr-4 h-10 bg-secondary/50 border-border/50 rounded-full focus:w-72 transition-all duration-300"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </form>
            </motion.div>

            {/* Search - Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            >
              <motion.div
                animate={{ rotate: isSearchOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <Search className="h-5 w-5" />
              </motion.div>
            </Button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            <UserMenu />

            {/* Cart con badge animado premium */}
            <Link to="/carrito" className="relative">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingBag className="h-5 w-5" />
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
                        className="absolute -top-1 -right-1"
                      >
                        <Badge 
                          variant="default" 
                          className="h-5 min-w-5 p-0 px-1 flex items-center justify-center text-xs bg-gold text-white font-bold shadow-gold"
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
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <motion.div
                animate={{ rotate: isMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
                    className="w-full pl-10 pr-4 h-12 bg-secondary/50 border-border/50 rounded-full"
                    autoFocus
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
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
              className="md:hidden overflow-hidden border-t border-border/30"
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
                      className="block py-3 px-4 text-foreground hover:bg-secondary/50 rounded-xl transition-all duration-200 active:scale-[0.98]"
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
                    className="flex items-center justify-between py-3 px-4 text-foreground hover:bg-secondary/50 rounded-xl transition-all duration-200"
                  >
                    <span>Mi Carrito</span>
                    {itemCount > 0 && (
                      <Badge className="bg-gold text-white">{itemCount}</Badge>
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
