import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import { usePublicProducts, PublicProduct } from '@/hooks/usePublicProducts';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from '@/hooks/use-toast';

// Página de detalle de producto
export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, getProductById, loading: productsLoading } = usePublicProducts();
  const { addItem, isInCart, getItemQuantity } = useCart();
  const { rate, convertToBS } = useExchangeRate();
  
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // Cargar producto
  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;
      setLoading(true);
      const data = await getProductById(id);
      setProduct(data);
      setLoading(false);
    };
    loadProduct();
  }, [id]);

  // Calcular cantidades
  const inCart = product ? isInCart(product.id) : false;
  const cartQuantity = product ? getItemQuantity(product.id) : 0;
  const availableStock = product ? product.stock - cartQuantity : 0;
  const maxQuantity = Math.max(0, availableStock);

  // Productos relacionados (misma categoría)
  const relatedProducts = product 
    ? products
        .filter(p => p.id !== product.id && p.category === product.category)
        .slice(0, 4)
    : [];

  // Manejar cantidad
  const decrementQuantity = () => {
    if (quantity > 1) setQuantity(q => q - 1);
  };

  const incrementQuantity = () => {
    if (quantity < maxQuantity) setQuantity(q => q + 1);
  };

  // Agregar al carrito
  const handleAddToCart = () => {
    if (!product || quantity <= 0 || quantity > maxQuantity) return;

    setIsAdding(true);

    const cartItem: CartItem = {
      id: product.id,
      name: product.name,
      price_usd: product.price_usd,
      quantity: quantity,
      image_url: product.image_url,
      stock: product.stock
    };

    addItem(cartItem);

    toast({
      title: '¡Agregado al carrito!',
      description: `${quantity} x ${product.name}`,
    });

    setTimeout(() => {
      setIsAdding(false);
      setQuantity(1);
    }, 500);
  };

  // Compartir
  const handleShare = async () => {
    if (navigator.share && product) {
      try {
        await navigator.share({
          title: product.name,
          text: product.description || 'Mira este producto',
          url: window.location.href,
        });
      } catch (err) {
        // Usuario canceló o error
      }
    } else {
      // Copiar URL
      navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Enlace copiado', description: 'El enlace del producto ha sido copiado' });
    }
  };

  if (loading) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </StoreLayout>
    );
  }

  if (!product) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <Package className="h-20 w-20 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Producto no encontrado
          </h1>
          <p className="text-muted-foreground mb-6">
            El producto que buscas no existe o no está disponible
          </p>
          <Link to="/tienda">
            <Button>
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
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
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
          <span className="text-foreground truncate max-w-[150px]">{product.name}</span>
        </nav>

        {/* Back button - Mobile */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4 md:hidden"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        {/* Product Section */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <div className="aspect-square rounded-2xl overflow-hidden bg-secondary/30 glass-card">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-24 h-24 text-muted-foreground/30" />
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {product.stock <= 5 && product.stock > 0 && (
                <Badge variant="destructive">
                  ¡Últimas {product.stock} unidades!
                </Badge>
              )}
              {product.category && (
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                  {product.category}
                </Badge>
              )}
            </div>

            {/* Share & Favorite */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="bg-background/80 backdrop-blur-sm rounded-full"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Name */}
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-foreground">
                {product.name}
              </h1>
            </div>

            {/* Price */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl md:text-4xl font-bold text-accent">
                  ${product.price_usd.toFixed(2)}
                </span>
              </div>
              {rate > 0 && (
                <p className="text-lg text-muted-foreground">
                  Bs. {convertToBS(product.price_usd).toFixed(2)}
                </p>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${product.stock > 5 ? 'bg-green-500' : product.stock > 0 ? 'bg-orange-500' : 'bg-red-500'}`} />
              <span className={`text-sm font-medium ${product.stock > 5 ? 'text-green-600' : product.stock > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                {product.stock > 5 
                  ? `En stock (${product.stock} disponibles)`
                  : product.stock > 0 
                    ? `¡Solo quedan ${product.stock}!` 
                    : 'Agotado'
                }
              </span>
            </div>

            {inCart && (
              <Badge variant="outline" className="bg-accent/10">
                Tienes {cartQuantity} en tu carrito
              </Badge>
            )}

            <Separator />

            {/* Description */}
            {product.description && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Descripción</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Quantity & Add to Cart */}
            {product.stock > 0 && maxQuantity > 0 && (
              <div className="space-y-4">
                {/* Quantity Selector */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Cantidad
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-border rounded-xl overflow-hidden">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={decrementQuantity}
                        disabled={quantity <= 1}
                        className="rounded-none"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={incrementQuantity}
                        disabled={quantity >= maxQuantity}
                        className="rounded-none"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Máximo: {maxQuantity}
                    </span>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <Button
                  size="lg"
                  className="w-full btn-gold text-base py-6"
                  onClick={handleAddToCart}
                  disabled={isAdding || quantity <= 0}
                >
                  {isAdding ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      ¡Agregado!
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-5 w-5 mr-2" />
                      Agregar al Carrito - ${(product.price_usd * quantity).toFixed(2)}
                    </>
                  )}
                </Button>
              </div>
            )}

            {product.stock === 0 && (
              <Button size="lg" className="w-full" disabled>
                Producto Agotado
              </Button>
            )}

            <Separator />

            {/* Benefits */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                <Truck className="h-5 w-5 text-accent flex-shrink-0" />
                <span className="text-sm text-foreground">Envío a todo el país</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                <Shield className="h-5 w-5 text-accent flex-shrink-0" />
                <span className="text-sm text-foreground">Compra segura</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 md:mt-24">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-6">
              Productos Relacionados
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </StoreLayout>
  );
}
