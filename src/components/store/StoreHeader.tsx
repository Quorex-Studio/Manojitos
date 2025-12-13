import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Search, Menu, X, Heart, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';

// Header de la tienda para clientes
export function StoreHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { getItemCount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const itemCount = getItemCount();

  // Manejar búsqueda
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/tienda?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4">
        {/* Top bar - Solo en desktop */}
        <div className="hidden md:flex items-center justify-end py-2 text-sm text-muted-foreground border-b border-border/30">
          <span>Envíos a toda Venezuela 🇻🇪</span>
        </div>

        {/* Main header */}
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center"
            >
              <span className="text-2xl md:text-3xl font-serif font-bold text-gradient-gold">
                Manojitos
              </span>
            </motion.div>
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              to="/" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium"
            >
              Inicio
            </Link>
            <Link 
              to="/tienda" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium"
            >
              Tienda
            </Link>
            <Link 
              to="/tienda?category=destacados" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium"
            >
              Destacados
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Search - Desktop */}
            <div className="hidden md:block relative">
              <form onSubmit={handleSearch} className="relative">
                <Input
                  type="text"
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-10 pr-4 h-10 bg-secondary/50 border-border/50 rounded-full"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </form>
            </div>

            {/* Search - Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* User */}
            <Link to={user ? "/checkout" : "/cliente/auth"}>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </Link>

            {/* Cart */}
            <Link to="/carrito" className="relative">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingBag className="h-5 w-5" />
                <AnimatePresence>
                  {itemCount > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1 -right-1"
                    >
                      <Badge 
                        variant="default" 
                        className="h-5 w-5 p-0 flex items-center justify-center text-xs bg-accent text-accent-foreground"
                      >
                        {itemCount > 99 ? '99+' : itemCount}
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </Link>

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
              className="md:hidden overflow-hidden"
            >
              <form onSubmit={handleSearch} className="py-3">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar productos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 h-12 bg-secondary/50 border-border/50 rounded-full"
                    autoFocus
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                </div>
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
              className="md:hidden overflow-hidden border-t border-border/30"
            >
              <div className="py-4 space-y-2">
                <Link 
                  to="/"
                  onClick={() => setIsMenuOpen(false)}
                  className="block py-3 px-4 text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                >
                  Inicio
                </Link>
                <Link 
                  to="/tienda"
                  onClick={() => setIsMenuOpen(false)}
                  className="block py-3 px-4 text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                >
                  Tienda
                </Link>
                <Link 
                  to="/tienda?category=destacados"
                  onClick={() => setIsMenuOpen(false)}
                  className="block py-3 px-4 text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                >
                  Destacados
                </Link>
                <Link 
                  to="/carrito"
                  onClick={() => setIsMenuOpen(false)}
                  className="block py-3 px-4 text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                >
                  Mi Carrito ({itemCount})
                </Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
