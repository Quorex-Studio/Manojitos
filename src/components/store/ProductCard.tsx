import { useState, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Eye, Check, Package, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from 'sonner';
import { PublicProduct } from '@/hooks/usePublicProducts';
import { AutoProductLabels } from '@/components/products/ProductLabelBadge';
import { PriceValidityBadge } from '@/components/store/PriceValidityBadge';

interface ProductCardProps {
  product: PublicProduct;
  index?: number;
  allProducts?: PublicProduct[];
}

// Tarjeta de producto editorial — portrait 3:4, overlay slide-up
export const ProductCard = memo(function ProductCard({ product, index = 0, allProducts }: ProductCardProps) {
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

            {/* Overlay slide-up con backdrop-blur */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-full p-4 space-y-3"
                initial={{ y: 30, opacity: 0 }}
                animate={{
                  y: isHovered ? 0 : 30,
                  opacity: isHovered ? 1 : 0
                }}
                transition={{ duration: 0.35, delay: 0.05 }}
              >
                {/* Product info in overlay */}
                <div>
                  <h3 className="font-serif text-white text-sm md:text-base font-medium line-clamp-2 leading-snug">
                    {product.name}
                  </h3>
                  <p className="text-gold font-bold text-lg mt-1">
                    ${product.price_usd.toFixed(2)}
                  </p>
                  {rate > 0 && (
                    <p className="text-white/60 text-xs mt-0.5">
                      Bs. {bsPrice.toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-gold/90 hover:bg-gold text-white border-0 rounded-full text-xs h-9 btn-shimmer"
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
                          className="flex items-center gap-1.5"
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          <span>{inCart ? 'Agregar más' : 'Agregar'}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Button>
                  <Button
                    size="icon"
                    className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border-0 rounded-full h-9 w-9"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Minimal info below image — only category + stock */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${product.stock > 5 ? 'bg-primary' : product.stock > 0 ? 'bg-gold animate-pulse' : 'bg-destructive'
                }`} />
              <span className="text-[11px] text-muted-foreground/60 tracking-wide">
                {product.category || 'General'}
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
                  <Badge variant="outline" className="text-[9px] border-gold/30 text-gold/80 h-5 px-1.5 rounded-full">
                    {cartQuantity} en carrito
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
});
