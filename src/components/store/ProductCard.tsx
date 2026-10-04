import { useState, memo, forwardRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ShoppingBag, Check, Package, Sparkles } from 'reicon-react';
import { useCart, CartItem } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { PublicProduct } from '@/hooks/usePublicProducts';
import { AutoProductLabels } from '@/components/products/ProductLabelBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { FavoriteButton } from './FavoriteButton';
import { productVariants, sortedVariants, variantLabel, variantPrice } from '@/lib/productCategories';
import { useProductCategories } from '@/hooks/useProductCategories';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: PublicProduct;
  index?: number;
  allProducts?: PublicProduct[];
}

// Tarjeta de producto "la foto manda" (ver DESIGN.md): imagen 4:5 a sangre sobre el
// estudio neutro, nombre y precio siempre visibles, acción rápida en un botón circular.
export const ProductCard = memo(forwardRef<HTMLDivElement, ProductCardProps>(function ProductCard({ product, index = 0, allProducts }, ref) {
  const [isAdding, setIsAdding] = useState(false);
  const { addItem, getItemQuantity } = useCart();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const cartQuantity = getItemQuantity(product.id);
  const canAdd = product.stock - cartQuantity > 0;
  const soldOut = product.stock <= 0;
  // Con varias tallas o tonos la clienta elige en la ficha; con una sola, se agrega directo
  const { byName } = useProductCategories();
  const variantRows = sortedVariants(product.product_variants);
  const variants = variantRows.length ? variantRows.map(v => v.label) : productVariants(product.sizes);
  const requiresSize = variants.length > 1;
  const only = variantRows.length === 1 ? variantRows[0] : null;
  const prices = variantRows.map(v => variantPrice(product.price_usd, v));
  const fromPrice = prices.length > 1 && Math.max(...prices) !== Math.min(...prices) ? Math.min(...prices) : null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (requiresSize) {
      navigate(`/producto/${product.id}`);
      return;
    }

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
      price_usd: variantPrice(product.price_usd, only),
      quantity: 1,
      image_url: product.image_url,
      stock: only ? only.stock : product.stock,
      size: variants.length === 1 ? variants[0] : undefined,
      variant_id: only?.id,
      size_label: variants.length === 1 ? variantLabel(byName(product.category)?.detail_kind) : undefined,
    };

    addItem(cartItem);

    toast.success('Agregado al carrito', {
      description: product.name,
      icon: <Sparkles className="h-4 w-4 text-primary" />
    });

    setTimeout(() => setIsAdding(false), 900);
  };

  const actionLabel = requiresSize
    ? `Elegir opción de ${product.name}`
    : `Agregar ${product.name} al carrito`;

  return (
    <motion.div
      ref={ref}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04, ease: 'easeOut' }}
    >
      <Link
        to={`/producto/${product.id}`}
        className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {/* Imagen 4:5 sobre el "estudio" */}
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-studio">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className={cn(
                'h-full w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]',
                soldOut && 'opacity-60 grayscale'
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}

          {/* Una sola etiqueta, arriba a la izquierda */}
          <div className="absolute left-3 top-3">
            {soldOut ? (
              <span className="rounded-full bg-background/95 px-2.5 py-1 text-[11px] font-semibold text-sale">
                Agotado
              </span>
            ) : (
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
                maxLabels={1}
                exclude={['low_stock']}
              />
            )}
          </div>

          <FavoriteButton productId={product.id} productName={product.name} className="absolute right-3 top-3" />

          {/* Acción rápida: agregar / elegir talla */}
          {!soldOut && (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isAdding || (!requiresSize && !canAdd)}
              aria-label={actionLabel}
              title={requiresSize ? 'Elegir opción' : 'Agregar al carrito'}
              className={cn(
                'absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full shadow-sm transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isAdding
                  ? 'bg-success text-white'
                  : 'bg-background/95 text-foreground hover:bg-primary hover:text-primary-foreground',
                'disabled:cursor-not-allowed disabled:opacity-60'
              )}
            >
              {isAdding ? <Check className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
            </button>
          )}

          {cartQuantity > 0 && !isAdding && (
            <span className="absolute bottom-3 left-3 rounded-full bg-foreground/85 px-2.5 py-1 text-[11px] font-semibold text-background">
              {cartQuantity} en tu carrito
            </span>
          )}
        </div>

        {/* Datos siempre visibles */}
        <div className="space-y-1 px-0.5 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {product.category || 'General'}
            {product.stock > 0 && product.stock <= 3 && (
              <span className="ml-2 normal-case tracking-normal text-sale">· Quedan {product.stock}</span>
            )}
          </p>
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {product.name}
          </h3>
          {product.presentation && <p className="text-xs text-muted-foreground">{product.presentation}</p>}
          {fromPrice != null && <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Desde</p>}
          <PriceDisplay
            amountUsd={fromPrice ?? variantPrice(product.price_usd, only)}
            className="flex flex-col"
            primaryClassName="text-base font-bold tabular-nums text-foreground"
            secondaryClassName="text-xs tabular-nums text-muted-foreground"
          />
        </div>
      </Link>
    </motion.div>
  );
}));
