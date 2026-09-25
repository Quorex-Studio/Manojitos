import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Minus, Plus, Check, Package, Truck, Shield, Heart, ChevronLeft, ChevronRight } from 'reicon-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { FavoriteButton } from '@/components/store/FavoriteButton';
import { AutoProductLabels } from '@/components/products/ProductLabelBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { usePublicProducts } from '@/hooks/usePublicProducts';
import type { PublicProduct } from '@/types';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useBrowsingHistory } from '@/hooks/useBrowsingHistory';
import { toast } from 'sonner';
import { formatBS } from '@/lib/utils';
import { productVariants, variantLabel } from '@/lib/productCategories';
import { useProductCategories } from '@/hooks/useProductCategories';


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
  // Barra de compra fija en móvil cuando el botón principal sale de pantalla
  const mainCtaRef = useRef<HTMLDivElement>(null);
  const mainCtaVisible = useInView(mainCtaRef, { amount: 0.1 });

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

  // Tallas o tonos cargados en el producto; la categoría dice cómo se llaman
  const { byName } = useProductCategories();
  const availableSizes = product ? productVariants(product.sizes) : [];
  const optionName = variantLabel(byName(product?.category)?.detail_kind);
  const isSizeRequired = availableSizes.length > 1;

  // Con una sola opción se elige sola; con varias, la clienta debe escoger
  useEffect(() => {
    if (product) {
      const variants = productVariants(product.sizes);
      setSelectedSize(variants.length === 1 ? variants[0] : '');
    }
  }, [product]);

  const recentlyViewed = getRecentlyViewed(id, 4);

  const totalInCart = product ? items
    .filter(item => item.id === product.id)
    .reduce((sum, item) => sum + item.quantity, 0) : 0;
    
  const availableStock = product ? product.stock - totalInCart : 0;
  const maxQuantity = Math.max(0, availableStock);

  const inCart = product && (selectedSize || !isSizeRequired) ? isInCart(product.id, selectedSize || undefined) : false;
  const cartQuantity = product && (selectedSize || !isSizeRequired) ? getItemQuantity(product.id, selectedSize || undefined) : 0;

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
      toast.error(`Elige ${optionName.toLowerCase()}`, {
        description: `Selecciona ${optionName.toLowerCase()} antes de agregar al carrito.`,
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
      size: selectedSize || undefined,
      size_label: selectedSize ? optionName : undefined,
    };

    addItem(cartItem);

    toast.success('¡Agregado al carrito!', {
      description: `${quantity} x ${product.name}${selectedSize ? ` (${optionName}: ${selectedSize})` : ''}`,
      icon: <Check className="h-4 w-4 text-green-500" />
    });

    setTimeout(() => {
      setIsAdding(false);
      setQuantity(1);
    }, 500);
  };

  // --- RENDER ---
  if (loading) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-[5.5fr_4.5fr] gap-8 lg:gap-14 [&>*]:min-w-0">
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
          <p className="text-muted-foreground mb-6 text-sm tracking-wide">
            El producto que buscas no existe o no está disponible
          </p>
          <Link to="/tienda">
            <Button className="rounded-full px-8">
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
        <nav className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-6 tracking-wide">
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
          className="mb-4 md:hidden text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        {/* Product Section — Split layout 55% / 45% */}
        <div className="grid grid-cols-1 md:grid-cols-[5.5fr_4.5fr] gap-8 lg:gap-14 [&>*]:min-w-0">
          {/* Image — with zoom on hover */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative"
          >
            <div 
              className="aspect-[4/5] rounded-2xl overflow-hidden bg-studio cursor-zoom-in group"
              onMouseEnter={() => setImageZoomed(true)}
              onMouseLeave={() => setImageZoomed(false)}
            >
              {product.image_url ? (
                <motion.img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
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
                allProducts={(products as PublicProduct[]).map(p => ({
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
              <span className="text-[10px] text-muted-foreground tracking-[0.15em] uppercase">{product.category}</span>
            )}

            {/* Name */}
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif font-medium text-foreground tracking-tight leading-[1.1]">
              {product.name}
            </h1>
            {product.presentation && (
              <p className="-mt-3 text-sm text-muted-foreground">{product.presentation}</p>
            )}

            {/* Price */}
            <PriceDisplay 
              amountUsd={product.price_usd}
              className="space-y-1"
              primaryClassName="text-3xl md:text-4xl font-semibold text-foreground tabular-nums tracking-tight"
              secondaryClassName="text-sm text-muted-foreground tabular-nums tracking-wide"
            />

            {/* Stock Status — pulsing dot */}
            <div className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full ${
                product.stock > 5 ? 'bg-success' : product.stock > 0 ? 'bg-sale' : 'bg-sale'
              }`} />
              <span className={`text-sm ${
                product.stock > 5 ? 'text-success' : 'text-sale'
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
                Tienes {totalInCart} en tu carrito{availableSizes.length > 1 && selectedSize ? ` (${optionName} ${selectedSize}: ${cartQuantity})` : ''}
              </Badge>
            )}

            <div className="h-px bg-border/10" />

            {/* Description */}
            {product.description && (
              <div>
                <h3 className="font-serif text-sm text-foreground/80 mb-2 tracking-wide">Descripción</h3>
                <p className="text-muted-foreground leading-relaxed text-sm tracking-wide">
                  {product.description}
                </p>
              </div>
            )}

            {/* Talla o tono (según la categoría) */}
            {product.stock > 0 && availableSizes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-muted-foreground tracking-[0.1em] uppercase block">
                    {optionName === 'Tono' ? 'Tonos disponibles' : optionName === 'Talla' ? 'Tallas disponibles' : 'Opciones'}
                  </label>
                  {isSizeRequired && !selectedSize && (
                    <span className="text-[11px] text-sale tracking-wide">
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
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 text-xs font-medium tracking-wide rounded-full border transition-all duration-300 ${
                          isSelected
                            ? 'bg-foreground border-foreground text-background'
                            : 'border-border hover:border-foreground text-foreground bg-card'
                        }`}
                      >
                        {size}
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
                  <label className="text-[10px] text-muted-foreground mb-2 block tracking-[0.1em] uppercase">
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
                    <span className="text-xs text-muted-foreground tracking-wide">
                      Máximo: {maxQuantity}
                    </span>
                  </div>
                </div>

                {/* Botón principal (DESIGN.md: pill de marca, una acción por vista) */}
                <div ref={mainCtaRef} className="flex gap-3">
                <Button
                  size="lg"
                  className="min-w-0 flex-1 rounded-full text-base font-semibold h-14"
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
                        <span className="flex items-center gap-1"><span className="sm:hidden">Agregar —</span><span className="hidden sm:inline">Agregar al Carrito —</span> <PriceDisplay amountUsd={product.price_usd * quantity} showSecondary={false} primaryClassName="font-medium" className="inline-flex" /></span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
                <FavoriteButton productId={product.id} productName={product.name} variant="outline" />
                </div>
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
                <Truck className="h-4 w-4 text-foreground flex-shrink-0" />
                <span className="text-xs text-foreground/60 tracking-wide">Envío nacional</span>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card/80 backdrop-blur-sm border border-border/10">
                <Shield className="h-4 w-4 text-foreground flex-shrink-0" />
                <span className="text-xs text-foreground/60 tracking-wide">Compra segura</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Barra de compra fija (móvil), sobre la navegación inferior */}
        <AnimatePresence>
          {product.stock > 0 && !mainCtaVisible && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-xl md:hidden"
              style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
            >
              <div className="mx-auto flex max-w-md items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                  <PriceDisplay amountUsd={product.price_usd} showSecondary={false} primaryClassName="text-sm font-bold tabular-nums text-foreground" />
                </div>
                <Button
                  className="h-11 shrink-0 rounded-full px-5 font-semibold"
                  onClick={() => {
                    if (isSizeRequired && !selectedSize) {
                      mainCtaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    handleAddToCart();
                  }}
                  disabled={isAdding}
                >
                  {isAdding ? <Check className="mr-1.5 h-4 w-4" /> : <ShoppingBag className="mr-1.5 h-4 w-4" />}
                  {isAdding ? 'Agregado' : 'Agregar'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
