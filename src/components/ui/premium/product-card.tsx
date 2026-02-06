import { Link } from 'react-router-dom';
import { ShoppingCart, Eye, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImagePremium } from '@/components/ui/image-premium';
import { PublicProduct } from '@/hooks/usePublicProducts';
import { formatCurrency } from '@/lib/utils'; // Asumiendo que existe, si no, crearé uno simple o usaré Intl inline

interface ProductCardProps {
    product: PublicProduct;
}

export function ProductCard({ product }: ProductCardProps) {
    return (
        <div className="group relative rounded-2xl bg-card border border-border/50 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/20">

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

                {/* Badges (puedes agregar lógica para 'Nuevo', 'Oferta', etc.) */}
                {product.stock <= 5 && product.stock > 0 && (
                    <div className="absolute top-3 left-3 bg-red-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm backdrop-blur-md">
                        ¡Últimas unidades!
                    </div>
                )}

                {/* Hover Overlay Actions */}
                <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 flex justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent pb-6">
                    <Button size="icon" variant="secondary" className="rounded-full w-10 h-10 bg-white/90 hover:bg-white text-foreground hover:scale-110 transition-transform shadow-lg">
                        <ShoppingCart className="h-4 w-4" />
                    </Button>
                    <Link to={`/producto/${product.id}`}>
                        <Button size="icon" variant="secondary" className="rounded-full w-10 h-10 bg-white/90 hover:bg-white text-foreground hover:scale-110 transition-transform shadow-lg">
                            <Eye className="h-4 w-4" />
                        </Button>
                    </Link>
                    <Button size="icon" variant="ghost" className="rounded-full w-10 h-10 bg-white/90 hover:bg-white hover:text-red-500 hover:scale-110 transition-transform shadow-lg">
                        <Heart className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Info Content */}
            <div className="p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                    <Link to={`/producto/${product.id}`} className="flex-1">
                        <h3 className="font-serif font-semibold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                            {product.name}
                        </h3>
                    </Link>
                    <div className="text-right">
                        <span className="block font-bold text-lg text-primary">
                            ${product.price_usd}
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
