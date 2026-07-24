import { useState, useMemo, memo, forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Eye, Check, Package, Sparkles } from 'reicon-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from 'sonner';
import { PublicProduct } from '@/hooks/usePublicProducts';
import { AutoProductLabels } from '@/components/products/ProductLabelBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { formatBS } from '@/lib/utils';
interface ProductCardProps {
  product: PublicProduct;
  index?: number;
  allProducts?: PublicProduct[];
}

// Tarjeta de producto editorial — portrait 3:4, overlay slide-up
export const ProductCard = memo(forwardRef<HTMLDivElement, ProductCardProps>(function ProductCard({ product, index = 0, allProducts }, ref) {
  const [isAdding, setIsAdding] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { addItem, isInCart, getItemQuantity } = useCart();
  const { rate, convertToBS } = useExchangeRate();

  const inCart = isInCart(product.id);
  const cartQuantity = getItemQuantity(product.id);
  const remainingStock = product.stock - cartQuantity;
  const canAdd = remainingStock > 0;

  const bsPrice = useMemo(() => convertToBS(product.price_usd), [product.price_usd, rate]);

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
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
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
          className="rounded-2xl overflow-hidden relative bg-card backdrop-blur-sm border border-border/10"
          whileHover={{ y: -8 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            boxShadow: isHovered
              ? '0 24px 60px -12px hsl(var(--rose) / 0.2), 0 0 0 1px hsl(var(--rose) / 0.1)'
              : '0 4px 24px 0 hsl(var(--rose) / 0.06)'
          }}
        >
          {/* Image Container — Portrait 3:4 */}
          <div className="relative aspect-[3/4] bg-secondary overflow-hidden">
            {product.image_url ? (
              <motion.img
                src={product.image_url}
                alt={product.name}
                loading="lazy"
                className="w-full h-full object-contain p-2"
                animate={{
                  scale: isHovered ? 1.05 : 1
                }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/30 to-secondary/10">
                <Package className="w-16 h-16 text-muted-foreground/20" />
              </div>
            )}

            {/* Etiquetas automáticas */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              <AutoProductLabels
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
            </div>

            {/* Eye overlay on Desktop Hover */}
            <div className="absolute inset-0 bg-black/10 opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full shadow-lg bg-background/95 hover:bg-background backdrop-blur-sm border-0 text-xs scale-90 md:group-hover:scale-100 transition-all duration-300 pointer-events-auto"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                <span>Ver Detalle</span>
              </Button>
            </div>
          </div>

          {/* Product details below image */}
          <div className="p-3.5 space-y-2">
            {/* Category + Stock status */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/60 tracking-wider uppercase font-medium">
                {product.category || 'General'}
              </span>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  product.stock > 5 ? 'bg-primary' : product.stock > 0 ? 'bg-gold animate-pulse' : 'bg-destructive'
                }`} />
                <span className="text-[10px] text-muted-foreground/50">
                  {product.stock > 5 ? 'Disponible' : product.stock > 0 ? 'Poco stock' : 'Agotado'}
                </span>
              </div>
            </div>

            {/* Product Name */}
            <h3 className="font-serif text-foreground/90 text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors duration-300">
              {product.name}
            </h3>

            {/* Prices & Cart Indicator */}
            <div className="flex items-baseline justify-between flex-wrap gap-1">
              <PriceDisplay 
                amountUsd={product.price_usd}
                primaryClassName="text-base font-semibold text-foreground tabular-nums tracking-tight"
                secondaryClassName="text-[11px] text-muted-foreground ml-1.5 tabular-nums"
              />
              
              {/* In Cart Indicator */}
              <AnimatePresence>
                {inCart && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <Badge variant="outline" className="text-[9px] border-gold/30 text-gold/80 h-5 px-1.5 rounded-full">
                      {cartQuantity} en carrito
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CTA Button — Clean and always visible */}
            <div className="pt-1.5">
              <Button
                size="sm"
                className="w-full bg-gold/90 hover:bg-gold text-white border-0 rounded-full text-xs h-8.5 btn-shimmer"
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
                      className="flex items-center justify-center"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="bag"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center justify-center gap-1.5"
                    >
                      <ShoppingBag className="h-3 w-3" />
                      <span>{inCart ? 'Agregar más' : 'Agregar'}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}));
