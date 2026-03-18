import { useState } from 'react';
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

export function ProductCard({ product }: ProductCardProps) {
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
        <div className="group relative rounded-2xl bg-card border border-border/60 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-gold/30">

            {/* Imagen + Quick Actions Overlay */}
            <div className="relative aspect-[4/5] overflow-hidden">
                <Link to={`/producto/${product.id}`}>
                    <ImagePremium
                        src={product.image_url || '/placeholder.png'}
                        alt={product.name}
                        aspectRatio="portrait"
                        className="group-hover:scale-105"
                    />
                </Link>

                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {product.stock <= 5 && product.stock > 0 && (
                        <div className="bg-destructive/90 text-destructive-foreground text-[10px] font-bold px-2 py-1 rounded-full shadow-sm backdrop-blur-md">
                            ¡Últimas unidades!
                        </div>
                    )}
                    {isProductInCart && (
                        <div className="bg-primary/90 text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-full shadow-sm backdrop-blur-md">
                            En tu carrito
                        </div>
                    )}
                </div>

                {/* Hover Overlay Actions */}
                <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 flex justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent pb-6">
                    <Button 
                        size="icon" 
                        variant="secondary" 
                        className="rounded-full w-10 h-10 bg-card/90 hover:bg-card text-foreground hover:scale-110 transition-transform shadow-lg"
                        onClick={handleAddToCart}
                    >
                        {isAdded ? <Check className="h-4 w-4 text-green-500" /> : <ShoppingCart className="h-4 w-4" />}
                    </Button>
                    <Link to={`/producto/${product.id}`}>
                        <Button size="icon" variant="secondary" className="rounded-full w-10 h-10 bg-card/90 hover:bg-card text-foreground hover:scale-110 transition-transform shadow-lg">
                            <Eye className="h-4 w-4" />
                        </Button>
                    </Link>
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className={`rounded-full w-10 h-10 bg-card/90 hover:bg-card hover:scale-110 transition-transform shadow-lg ${isProductInWishlist ? 'text-destructive' : 'text-foreground hover:text-destructive'}`}
                        onClick={handleToggleWishlist}
                    >
                        <Heart className={`h-4 w-4 ${isProductInWishlist ? 'fill-current' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Info Content */}
            <div className="p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                    <Link to={`/producto/${product.id}`} className="flex-1">
                        <h3 className="font-serif font-semibold text-base md:text-lg leading-tight group-hover:text-gold transition-colors line-clamp-2">
                            {product.name}
                        </h3>
                    </Link>
                    <div className="text-right">
                        <span className="block font-bold text-lg text-gold">
                            ${product.price_usd.toFixed(2)}
                        </span>
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span className="bg-secondary/50 px-2 py-1 rounded-md capitalize">
                        {product.category || 'General'}
                    </span>
                    <span>{product.sold_count > 0 ? `${product.sold_count} vendidos` : 'Nuevo'}</span>
                </div>
            </div>
        </div>
    );
}

