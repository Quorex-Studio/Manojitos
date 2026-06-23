import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ShoppingBag, Minus, Plus, Check, Package, 
  Truck, Shield, Share2, Heart, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { AutoProductLabels } from '@/components/products/ProductLabelBadge';
import { PriceValidityBadge } from '@/components/store/PriceValidityBadge';
import { usePublicProducts } from '@/hooks/usePublicProducts';
import type { PublicProduct } from '@/types';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useBrowsingHistory } from '@/hooks/useBrowsingHistory';
import { toast } from '@/hooks/use-toast';

// Helper function to resolve available sizes based on product name/category rules
const getAvailableSizes = (name: string, category: string): string[] => {
  const normName = name.toLowerCase();
  const normCategory = (category || '').toLowerCase();
  
  const isJeans = normName.includes('jean') || normCategory.includes('jean') || normCategory.includes('pantalones');
  const isShorts = normName.includes('short') || normCategory.includes('short');
  const isTrajeBano = normName.includes('baño') || normName.includes('bano') || normCategory.includes('baño') || normCategory.includes('bano') || normCategory.includes('playa');
  
  if (isJeans || isShorts || isTrajeBano) {
    return ['S', 'M', 'L', 'XL'];
  }
  
  const isSetPlayero = normName.includes('set playero') || normName.includes('sets playeros') || normName.includes('playero') || normCategory.includes('set playero') || normCategory.includes('playero');
  const isBody = normName.includes('body') || normName.includes('bodys') || normCategory.includes('body') || normCategory.includes('bodys');
  const isCaballero = normName.includes('caballero') || normCategory.includes('caballero');
  
  if (isSetPlayero || isBody || isCaballero) {
    return ['Única'];
  }
  
  return ['Única'];
};

// Página de detalle de producto — Split layout editorial
export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, getProductById, loading: productsLoading } = usePublicProducts();
  const { items, addItem, isInCart, getItemQuantity } = useCart();
  const { rate, convertToBS } = useExchangeRate();
  const { addToHistory, getRecentlyViewed } = useBrowsingHistory();
  
  // --- STATE ---
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [imageZoomed, setImageZoomed] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>('');

  // --- DERIVED / EFFECTS ---
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const loadProduct = async () => {
      setLoading(true);
      const data = await getProductById(id);
      if (cancelled) return;
      setProduct(data);
      setLoading(false);
      
      if (data) {
        addToHistory({
          id: data.id,
          name: data.name,
          image_url: data.image_url,
          price_usd: data.price_usd
        });
      }
    };

    loadProduct();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const availableSizes = product ? getAvailableSizes(product.name, product.category || '') : [];
  const isSizeRequired = availableSizes.length > 0 && availableSizes[0] !== 'Única';

  // Initialize/reset selected size when product changes
  useEffect(() => {
    if (product) {
      const sizes = getAvailableSizes(product.name, product.category || '');
      if (sizes.length === 1 && sizes[0] === 'Única') {
        setSelectedSize('Única');
      } else {
        setSelectedSize('');
      }
    }
  }, [product]);

  const recentlyViewed = getRecentlyViewed(id, 4);

  const totalInCart = product ? items
    .filter(item => item.id === product.id)
    .reduce((sum, item) => sum + item.quantity, 0) : 0;
    
  const availableStock = product ? product.stock - totalInCart : 0;
  const maxQuantity = Math.max(0, availableStock);

  const inCart = product && selectedSize ? isInCart(product.id, selectedSize) : false;
  const cartQuantity = product && selectedSize ? getItemQuantity(product.id, selectedSize) : 0;

  const relatedProducts = product 
    ? products
        .filter(p => p.id !== product.id && p.category === product.category)
        .slice(0, 4)
    : [];

  // --- HANDLERS ---
  const decrementQuantity = () => {
    if (quantity > 1) setQuantity(q => q - 1);
  };

  const incrementQuantity = () => {
    if (quantity < maxQuantity) setQuantity(q => q + 1);
  };

  const handleAddToCart = () => {
    if (!product || quantity <= 0 || quantity > maxQuantity) return;
    
    if (isSizeRequired && !selectedSize) {
      toast({
        title: 'Selecciona una talla',
        description: 'Por favor, selecciona una talla antes de agregar al carrito.',
        variant: 'destructive',
      });
      return;
    }

    setIsAdding(true);

    const cartItem: CartItem = {
      id: product.id,
      name: product.name,
      price_usd: product.price_usd,
      quantity: quantity,
      image_url: product.image_url,
      stock: product.stock,
      size: selectedSize
    };

    addItem(cartItem);

    toast({
      title: '¡Agregado al carrito!',
      description: `${quantity} x ${product.name} ${selectedSize ? `(Talla: ${selectedSize})` : ''}`,
    });

    setTimeout(() => {
      setIsAdding(false);
      setQuantity(1);
    }, 500);
  };

  const handleShare = async () => {
    if (navigator.share && product) {
      try {
        await navigator.share({
          title: product.name,
          text: product.description || 'Mira este producto',
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Enlace copiado', description: 'El enlace del producto ha sido copiado' });
    }
  };

  // --- RENDER ---
  if (loading) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-[55%_45%] gap-8 lg:gap-14">
            <div className="aspect-[3/4] rounded-2xl skeleton-shimmer" />
            <div className="space-y-5 py-4">
              <div className="h-3 w-1/3 rounded-full skeleton-shimmer" />
              <div className="h-10 w-3/4 rounded-full skeleton-shimmer" />
              <div className="h-8 w-1/4 rounded-full skeleton-shimmer" />
              <div className="h-px bg-border/10 my-6" />
              <div className="h-24 w-full rounded-xl skeleton-shimmer" />
              <div className="h-14 w-full rounded-full skeleton-shimmer" />
            </div>
          </div>
        </div>
      </StoreLayout>
    );
  }

  if (!product) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-24 text-center">
          <Package className="h-20 w-20 mx-auto text-muted-foreground/15 mb-4" />
          <h1 className="text-2xl font-serif font-medium text-foreground mb-2 tracking-tight">
            Producto no encontrado
          </h1>
          <p className="text-muted-foreground/50 mb-6 text-sm tracking-wide">
            El producto que buscas no existe o no está disponible
          </p>
          <Link to="/tienda">
            <Button className="rounded-full btn-gold px-8">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a la tienda
            </Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-6 md:py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-muted-foreground/40 mb-6 tracking-wide">
          <Link to="/" className="hover:text-foreground transition-colors">Inicio</Link>
          <span>/</span>
          <Link to="/tienda" className="hover:text-foreground transition-colors">Tienda</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link 
                to={`/tienda?category=${encodeURIComponent(product.category)}`}
                className="hover:text-foreground transition-colors"
              >
                {product.category}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground/70 truncate max-w-[150px]">{product.name}</span>
        </nav>

        {/* Back button - Mobile */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4 md:hidden text-muted-foreground/50"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        {/* Product Section — Split layout 55% / 45% */}
        <div className="grid md:grid-cols-[55%_45%] gap-8 lg:gap-14">
          {/* Image — with zoom on hover */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative"
          >
            <div 
              className="aspect-[3/4] rounded-2xl overflow-hidden bg-secondary cursor-zoom-in group"
              onMouseEnter={() => setImageZoomed(true)}
              onMouseLeave={() => setImageZoomed(false)}
            >
              {product.image_url ? (
                <motion.img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-contain p-4"
                  animate={{ scale: imageZoomed ? 1.08 : 1 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/20 to-secondary/5">
                  <Package className="w-24 h-24 text-muted-foreground/15" />
                </div>
              )}
            </div>

            {/* Auto Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              <AutoProductLabels 
                product={{
                  id: product.id,
                  sold_count: product.sold_count || 0,
                  stock: product.stock,
                  created_at: product.created_at,
                  price_usd: product.price_usd,
                  category: product.category
                }}
                allProducts={(products as any[]).map(p => ({
                  id: p.id,
                  sold_count: p.sold_count || 0,
                  stock: p.stock,
                  created_at: p.created_at,
                  price_usd: p.price_usd,
                  category: p.category
                }))}
                maxLabels={3}
              />
            </div>

            {/* Share + Fav */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="bg-background/80 backdrop-blur-md rounded-full border border-border/10 hover:bg-background/80"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="space-y-6 py-0 md:py-4"
          >
            {/* Category tag */}
            {product.category && (
              <span className="text-[10px] text-muted-foreground/40 tracking-[0.15em] uppercase">{product.category}</span>
            )}

            {/* Name */}
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif font-medium text-foreground tracking-tight leading-[1.1]">
              {product.name}
            </h1>

            {/* Price — large golden */}
            <div className="space-y-1">
              <span className="text-3xl md:text-4xl font-bold text-gradient-gold font-serif">
                ${product.price_usd.toFixed(2)}
              </span>
              {rate > 0 && (
                <p className="text-sm text-muted-foreground/40 tracking-wide">
                  Bs. {convertToBS(product.price_usd).toFixed(2)}
                </p>
              )}
              <PriceValidityBadge />
            </div>

            {/* Stock Status — pulsing dot */}
            <div className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full ${
                product.stock > 5 ? 'bg-primary' : product.stock > 0 ? 'bg-gold animate-pulse' : 'bg-destructive'
              }`} />
              <span className={`text-sm ${
                product.stock > 5 ? 'text-primary/80' : product.stock > 0 ? 'text-gold/80' : 'text-destructive/80'
              }`}>
                {product.stock > 5 
                  ? `En stock (${product.stock} disponibles)`
                  : product.stock > 0 
                    ? `¡Solo quedan ${product.stock}!` 
                    : 'Agotado'
                }
              </span>
            </div>

            {totalInCart > 0 && (
              <Badge variant="outline" className="border-gold/20 text-gold/80 bg-gold/5 rounded-full text-xs">
                Tienes {totalInCart} en tu carrito {selectedSize && selectedSize !== 'Única' ? `(Talla ${selectedSize}: ${cartQuantity})` : ''}
              </Badge>
            )}

            <div className="h-px bg-border/10" />

            {/* Description */}
            {product.description && (
              <div>
                <h3 className="font-serif text-sm text-foreground/80 mb-2 tracking-wide">Descripción</h3>
                <p className="text-muted-foreground/50 leading-relaxed text-sm tracking-wide">
                  {product.description}
                </p>
              </div>
            )}

            {/* Tallas Selector */}
            {product.stock > 0 && availableSizes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-muted-foreground/40 tracking-[0.1em] uppercase block">
                    Tallas disponibles
                  </label>
                  {isSizeRequired && !selectedSize && (
                    <span className="text-[10px] text-gold/80 tracking-wide animate-pulse">
                      * Selección obligatoria
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => {
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 text-xs font-medium tracking-wide rounded-full border transition-all duration-300 ${
                          isSelected
                            ? 'bg-gold border-gold text-black shadow-md shadow-gold/25'
                            : 'border-border/15 hover:border-gold/50 text-foreground/80 hover:text-foreground bg-card/40'
                        }`}
                      >
                        {size === 'Única' ? 'Talla Única' : size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="h-px bg-border/10" />

            {/* Quantity & Add to Cart */}
            {product.stock > 0 && maxQuantity > 0 && (
              <div className="space-y-4">
                {/* Quantity Selector — Pill */}
                <div>
                  <label className="text-[10px] text-muted-foreground/40 mb-2 block tracking-[0.1em] uppercase">
                    Cantidad
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-border/15 rounded-full bg-card/80 backdrop-blur-sm overflow-hidden">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={decrementQuantity}
                        disabled={quantity <= 1}
                        className="rounded-none h-10 w-10"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-10 text-center font-medium text-sm">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={incrementQuantity}
                        disabled={quantity >= maxQuantity}
                        className="rounded-none h-10 w-10"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground/30 tracking-wide">
                      Máximo: {maxQuantity}
                    </span>
                  </div>
                </div>

                {/* Add to Cart Button — Full-width gold gradient */}
                <Button
                  size="lg"
                  className="w-full btn-gold btn-shimmer rounded-full text-base h-14"
                  onClick={handleAddToCart}
                  disabled={isAdding || quantity <= 0}
                >
                  <AnimatePresence mode="wait">
                    {isAdding ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="flex items-center"
                      >
                        <Check className="h-5 w-5 mr-2" />
                        ¡Agregado!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="bag"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center"
                      >
                        <ShoppingBag className="h-5 w-5 mr-2" />
                        Agregar al Carrito — ${(product.price_usd * quantity).toFixed(2)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            )}

            {product.stock === 0 && (
              <Button size="lg" className="w-full rounded-full h-14" disabled>
                Producto Agotado
              </Button>
            )}

            <div className="h-px bg-border/10" />

            {/* Benefits */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card/80 backdrop-blur-sm border border-border/10">
                <Truck className="h-4 w-4 text-gold/70 flex-shrink-0" />
                <span className="text-xs text-foreground/60 tracking-wide">Envío nacional</span>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card/80 backdrop-blur-sm border border-border/10">
                <Shield className="h-4 w-4 text-gold/70 flex-shrink-0" />
                <span className="text-xs text-foreground/60 tracking-wide">Compra segura</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-20 md:mt-28">
            <div className="flex items-end justify-between mb-8">
              <h2 className="text-3xl md:text-4xl font-serif font-medium text-foreground tracking-tight">
                Productos Relacionados
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} allProducts={products} />
              ))}
            </div>
          </section>
        )}

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <section className="mt-20 md:mt-28">
            <h2 className="text-3xl md:text-4xl font-serif font-medium text-foreground mb-8 tracking-tight">
              Vistos Recientemente
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
              {recentlyViewed.map((item) => {
                const fullProduct = products.find(p => p.id === item.productId);
                if (!fullProduct) return null;
                return <ProductCard key={item.productId} product={fullProduct} allProducts={products} />;
              })}
            </div>
          </section>
        )}
      </div>
    </StoreLayout>
  );
}
