import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Eye, Check, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from '@/hooks/use-toast';
import { PublicProduct } from '@/hooks/usePublicProducts';

interface ProductCardProps {
  product: PublicProduct;
}

// Tarjeta de producto para el catálogo
export function ProductCard({ product }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const { addItem, isInCart, getItemQuantity } = useCart();
  const { rate, convertToBS } = useExchangeRate();
  
  const inCart = isInCart(product.id);
  const cartQuantity = getItemQuantity(product.id);
  const remainingStock = product.stock - cartQuantity;
  const canAdd = remainingStock > 0;

  // Manejar agregar al carrito
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!canAdd) {
      toast({
        title: 'Sin stock disponible',
        description: 'Ya tienes el máximo disponible en tu carrito',
        variant: 'destructive'
      });
      return;
    }

    setIsAdding(true);
    
    const cartItem: CartItem = {
      id: product.id,
      name: product.name,
      price_usd: product.price_usd,
      quantity: 1,
      image_url: product.image_url,
      stock: product.stock
    };

    addItem(cartItem);
    
    toast({
      title: '¡Agregado al carrito!',
      description: `${product.name} se agregó correctamente`,
    });

    setTimeout(() => setIsAdding(false), 500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <Link 
        to={`/producto/${product.id}`}
        className="block group"
      >
        <div className="glass-card rounded-2xl overflow-hidden hover-lift">
          {/* Image Container */}
          <div className="relative aspect-square bg-secondary/30 overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-muted-foreground/30" />
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {product.stock <= 5 && product.stock > 0 && (
                <Badge variant="destructive" className="text-xs">
                  ¡Últimas unidades!
                </Badge>
              )}
              {product.category && (
                <Badge variant="secondary" className="text-xs bg-background/80 backdrop-blur-sm">
                  {product.category}
                </Badge>
              )}
            </div>

            {/* Quick Actions Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 bg-background/90 backdrop-blur-sm"
                  onClick={handleAddToCart}
                  disabled={!canAdd || isAdding}
                >
                  {isAdding ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <ShoppingBag className="h-4 w-4 mr-2" />
                  )}
                  {inCart ? 'Agregar más' : 'Agregar'}
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="bg-background/90 backdrop-blur-sm"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-2">
            {/* Name */}
            <h3 className="font-medium text-foreground line-clamp-2 min-h-[2.5rem] group-hover:text-accent transition-colors">
              {product.name}
            </h3>

            {/* Price */}
            <div className="space-y-0.5">
              <p className="text-lg font-bold text-accent">
                ${product.price_usd.toFixed(2)}
              </p>
              {rate > 0 && (
                <p className="text-sm text-muted-foreground">
                  Bs. {convertToBS(product.price_usd).toFixed(2)}
                </p>
              )}
            </div>

            {/* Stock */}
            <div className="flex items-center justify-between pt-1">
              <span className={`text-xs ${product.stock > 5 ? 'text-green-600' : 'text-orange-500'}`}>
                {product.stock > 5 
                  ? 'En stock' 
                  : product.stock > 0 
                    ? `Solo ${product.stock} disponibles` 
                    : 'Agotado'
                }
              </span>
              {inCart && (
                <Badge variant="outline" className="text-xs">
                  {cartQuantity} en carrito
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
