import { useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Eye, Heart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImagePremium } from '@/components/ui/image-premium';
import { PublicProduct } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ProductCardProps {
    product: PublicProduct;
}

export const ProductCard = memo(function ProductCard({ product }: ProductCardProps) {
    const { addItem, isInCart } = useCart();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const { user } = useAuth();
    const [isAdded, setIsAdded] = useState(false);

    const isProductInCart = isInCart(product.id);
    const isProductInWishlist = isInWishlist(product.id);

    const handleAddToCart = () => {
        addItem({
            id: product.id,
            name: product.name,
            price_usd: product.price_usd,
            quantity: 1,
            image_url: product.image_url,
            stock: product.stock
        });

        setIsAdded(true);
        setTimeout(() => setIsAdded(false), 600);
    };

    const handleToggleWishlist = () => {
        if (!user) {
            toast.error("Inicia sesión para guardar favoritos");
            return;
        }
        toggleWishlist(product.id);
    };

    return (
        <div className="group relative rounded-2xl bg-card backdrop-blur-sm border border-border/10 overflow-hidden transition-all duration-500 hover:shadow-[0_24px_60px_-12px_hsl(var(--rose)/0.2)] hover:-translate-y-2 hover:border-primary/15">

            {/* Imagen + Quick Actions Overlay — Portrait 3:4 */}
            <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                <Link to={`/producto/${product.id}`}>
                    <ImagePremium
                        src={product.image_url || '/placeholder.png'}
                        alt={product.name}
                        aspectRatio="portrait"
                        className="group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                </Link>

                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    {product.stock <= 5 && product.stock > 0 && (
                        <div className="bg-gold/90 text-white text-[9px] font-bold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md tracking-wider uppercase">
                            Últimas unidades
                        </div>
                    )}
                    {isProductInCart && (
                        <div className="bg-primary/80 text-primary-foreground text-[9px] font-bold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md tracking-wider uppercase">
                            En tu carrito
                        </div>
                    )}
                </div>

                {/* Hover Overlay — Slide-up with backdrop blur */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out flex items-end">
                    <div className="w-full p-4 pb-5 space-y-3">
                        {/* Name + Price in overlay */}
                        <div>
                            <h3 className="font-serif text-white text-sm md:text-base font-medium line-clamp-2 leading-snug">
                                {product.name}
                            </h3>
                            <span className="block font-bold text-lg text-gold mt-1">
                                ${product.price_usd.toFixed(2)}
                            </span>
                        </div>

                        <div className="flex justify-center gap-2">
                            <Button
                                size="icon"
                                className="rounded-full w-10 h-10 bg-gold/80 hover:bg-gold text-white border-0 hover:scale-110 transition-all duration-300 shadow-lg btn-shimmer"
                                onClick={handleAddToCart}
                            >
                                {isAdded ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                            </Button>
                            <Link to={`/producto/${product.id}`}>
                                <Button size="icon" className="rounded-full w-10 h-10 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border-0 hover:scale-110 transition-all duration-300 shadow-lg">
                                    <Eye className="h-4 w-4" />
                                </Button>
                            </Link>
                            <Button
                                size="icon"
                                className={`rounded-full w-10 h-10 bg-white/10 backdrop-blur-sm hover:bg-white/20 border-0 hover:scale-110 transition-all duration-300 shadow-lg ${isProductInWishlist ? 'text-primary' : 'text-white hover:text-primary'}`}
                                onClick={handleToggleWishlist}
                            >
                                <Heart className={`h-4 w-4 ${isProductInWishlist ? 'fill-current' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Minimal info — category + sold count */}
            <div className="p-3 flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground/50 tracking-[0.1em] uppercase">
                    {product.category || 'General'}
                </span>
                <span className="text-[10px] text-muted-foreground/40 tracking-wide">
                    {product.sold_count > 0 ? `${product.sold_count} vendidos` : 'Nuevo'}
                </span>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for ProductCard — only re-render if product ID or stock changes
    return prevProps.product.id === nextProps.product.id &&
        prevProps.product.stock === nextProps.product.stock &&
        prevProps.product.price_usd === nextProps.product.price_usd &&
        prevProps.product.name === nextProps.product.name;
});
