import { motion } from 'framer-motion';
import { Heart, ShoppingCart, Trash2, ArrowLeft, Loader2, HeartOff } from 'lucide-react';
import { Link } from 'react-router-dom';

import { StoreLayout } from '@/components/store/StoreLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWishlist } from '@/hooks/useWishlist';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function CustomerWishlist() {
  // --- DERIVED ---
  const { user } = useAuth();
  const { wishlist, isLoading, removeFromWishlist } = useWishlist();
  const { addItem } = useCart();

  // --- RENDER ---
  if (!user) {
    return (
      <StoreLayout>
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso requerido</h1>
          <p className="text-muted-foreground mb-6">Debes iniciar sesión para ver tu lista de deseos</p>
          <Link to="/cliente/auth">
            <Button>Iniciar Sesión</Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="container py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  const handleAddToCart = (item: typeof wishlist[0]) => {
    if (item.product) {
      addItem({
        id: item.product.id,
        name: item.product.name,
        price_usd: item.product.price_usd,
        image_url: item.product.image_url,
        quantity: 1,
        stock: item.product.stock,
      });
    }
  };

  return (
    <StoreLayout>
      <div className="container py-8 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link to="/cliente/perfil">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="page-header">Lista de Deseos</h1>
              <p className="text-muted-foreground">{wishlist.length} productos guardados</p>
            </div>
            <Heart className="h-8 w-8 text-rose-500" />
          </div>

          {wishlist.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <HeartOff className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Tu lista está vacía</h2>
                <p className="text-muted-foreground mb-6">
                  Guarda productos que te gusten para comprarlos después
                </p>
                <Link to="/tienda">
                  <Button>Explorar Tienda</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {wishlist.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="glass-card overflow-hidden group">
                    <CardContent className="p-0">
                      <div className="flex gap-4">
                        {/* Image */}
                        <Link 
                          to={`/producto/${item.product_id}`}
                          className="w-32 h-32 flex-shrink-0 overflow-hidden"
                        >
                          {item.product?.image_url ? (
                            <img
                              src={item.product.image_url}
                              alt={item.product?.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full bg-secondary flex items-center justify-center">
                              <Heart className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </Link>

                        {/* Info */}
                        <div className="flex-1 p-4 flex flex-col justify-between">
                          <div>
                            <Link to={`/producto/${item.product_id}`}>
                              <h3 className="font-semibold hover:text-primary transition-colors line-clamp-1">
                                {item.product?.name || 'Producto'}
                              </h3>
                            </Link>
                            {item.product?.category && (
                              <Badge variant="secondary" className="mt-1">
                                {item.product.category}
                              </Badge>
                            )}
                            <p className="text-lg font-bold mt-2">
                              ${item.product?.price_usd.toFixed(2) || '0.00'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {item.product && item.product.stock > 0 ? (
                              <Button 
                                size="sm" 
                                className="flex-1"
                                onClick={() => handleAddToCart(item)}
                              >
                                <ShoppingCart className="h-4 w-4 mr-1" />
                                Agregar
                              </Button>
                            ) : (
                              <Badge variant="destructive" className="flex-1 justify-center py-1.5">
                                Agotado
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeFromWishlist.mutate(item.product_id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </StoreLayout>
  );
}
