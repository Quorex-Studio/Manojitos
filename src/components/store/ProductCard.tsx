import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Eye, Check, Package, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from 'sonner';
import { PublicProduct } from '@/hooks/usePublicProducts';
import { ProductLabelBadge } from '@/components/products/ProductLabelBadge';
import { PriceValidityBadge } from '@/components/store/PriceValidityBadge';

interface ProductCardProps {
  product: PublicProduct;
  index?: number;
  allProducts?: PublicProduct[];
}

// Tarjeta de producto para el catálogo con microinteracciones premium
export function ProductCard({ product, index = 0, allProducts }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { addItem, isInCart, getItemQuantity } = useCart();
  const { rate, convertToBS } = useExchangeRate();
  
  const inCart = isInCart(product.id);
  const cartQuantity = getItemQuantity(product.id);
  const remainingStock = product.stock - cartQuantity;
  const canAdd = remainingStock > 0;

  // Manejar agregar al carrito con animación
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!canAdd) {
      toast.error('Sin stock disponible', {
        description: 'Ya tienes el máximo disponible en tu carrito'
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
    
    toast.success('¡Agregado al carrito!', {
      description: product.name,
      icon: <Sparkles className="h-4 w-4 text-gold" />
    });

    setTimeout(() => setIsAdding(false), 600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link 
        to={`/producto/${product.id}`}
        className="block group"
      >
        <motion.div 
          className="glass-card rounded-2xl overflow-hidden relative"
          whileHover={{ y: -6 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            boxShadow: isHovered 
              ? '0 20px 50px -10px hsl(var(--rose) / 0.25)' 
              : '0 8px 32px 0 hsl(var(--rose) / 0.1)'
          }}
        >
          {/* Image Container */}
          <div className="relative aspect-square bg-secondary/30 overflow-hidden">
            {product.image_url ? (
              <motion.img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
                animate={{ 
                  scale: isHovered ? 1.08 : 1 
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/50 to-secondary/20">
                <Package className="w-16 h-16 text-muted-foreground/30" />
              </div>
            )}

            {/* Etiquetas automáticas */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              <ProductLabelBadge 
                product={{
                  id: product.id,
                  sold_count: product.sold_count || 0,
                  stock: product.stock,
                  created_at: product.created_at,
                  price_usd: product.price_usd,
                  category: product.category
                }}
                allProducts={allProducts?.map(p => ({
                  id: p.id,
                  sold_count: p.sold_count || 0,
                  stock: p.stock,
                  created_at: p.created_at,
                  price_usd: p.price_usd,
                  category: p.category
                }))}
                maxLabels={2}
              />
              {product.category && (
                <Badge variant="secondary" className="text-xs bg-background/80 backdrop-blur-sm">
                  {product.category}
                </Badge>
              )}
            </div>

            {/* Quick Actions Overlay con mejor animación */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent flex items-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div 
                className="w-full p-4 flex gap-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ 
                  y: isHovered ? 0 : 20, 
                  opacity: isHovered ? 1 : 0 
                }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Button
                  variant="gold"
                  size="sm"
                  className="flex-1"
                  onClick={handleAddToCart}
                  disabled={!canAdd || isAdding}
                >
                  <AnimatePresence mode="wait">
                    {isAdding ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Check className="h-4 w-4" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="bag"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-2"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        <span>{inCart ? 'Agregar más' : 'Agregar'}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="bg-background/90 backdrop-blur-sm"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </motion.div>
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-2">
            {/* Name */}
            <h3 className="font-medium text-foreground line-clamp-2 min-h-[2.5rem] transition-colors duration-200 group-hover:text-gold">
              {product.name}
            </h3>

            {/* Price con animación de números */}
            <div className="space-y-0.5">
              <motion.p 
                className="text-lg font-bold text-gold"
                key={product.price_usd}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
              >
                ${product.price_usd.toFixed(2)}
              </motion.p>
              {rate > 0 && (
                <p className="text-sm text-muted-foreground">
                  Bs. {convertToBS(product.price_usd).toFixed(2)}
                </p>
              )}
              <PriceValidityBadge compact />
            </div>

            {/* Stock con indicador visual */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  product.stock > 5 ? 'bg-green-500' : product.stock > 0 ? 'bg-orange-500 animate-pulse' : 'bg-red-500'
                }`} />
                <span className={`text-xs ${product.stock > 5 ? 'text-green-600 dark:text-green-400' : 'text-orange-500'}`}>
                  {product.stock > 5 
                    ? 'En stock' 
                    : product.stock > 0 
                      ? `Solo ${product.stock} disponibles` 
                      : 'Agotado'
                  }
                </span>
              </div>
              <AnimatePresence>
                {inCart && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <Badge variant="outline" className="text-xs border-gold/50 text-gold">
                      {cartQuantity} en carrito
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
