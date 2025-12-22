// Componente de recomendaciones personalizadas de Ángela (Personal Shopper)
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  ShoppingBag, 
  RefreshCw,
  CreditCard,
  Heart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAngelaPersonalShopper } from '@/hooks/useAngelaPersonalShopper';
import { useCart } from '@/contexts/CartContext';
import { cn } from '@/lib/utils';
import stitchRosaMascot from '@/assets/stitch-rosa-mascot.png';

export function AngelaPersonalShopper() {
  const { recommendations, behavior, loading, refresh } = useAngelaPersonalShopper();
  const { addItem } = useCart();

  const handleAddToCart = (product: { id: string; name: string; price_usd: number; image_url?: string }) => {
    addItem({
      id: product.id,
      name: product.name,
      price_usd: product.price_usd,
      image_url: product.image_url,
      quantity: 1,
      stock: 999 // Default stock for recommendations
    });
  };

  return (
    <Card className="border-pink-200 dark:border-pink-800 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-pink-500 to-rose-500 text-white pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30">
              <img src={stitchRosaMascot} alt="Ángela" className="w-full h-full object-cover" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Para ti
              </CardTitle>
              <p className="text-xs text-white/80">
                Ángela te recomienda
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={loading}
            className="text-white hover:bg-white/20"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        {/* Insights del cliente */}
        {(behavior.preferredPaymentMethod || behavior.creditAvailable) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {behavior.preferredPaymentMethod && (
              <Badge variant="secondary" className="text-xs">
                💳 Pagas en {behavior.preferredPaymentMethod}
              </Badge>
            )}
            {behavior.creditAvailable && behavior.creditAvailable > 0 && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <CreditCard className="h-3 w-3 mr-1" />
                ${behavior.creditAvailable.toFixed(0)} disponible
              </Badge>
            )}
            {behavior.purchaseFrequency && (
              <Badge variant="secondary" className="text-xs">
                Cliente {behavior.purchaseFrequency}
              </Badge>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-6">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-pink-500" />
            <p className="text-sm text-muted-foreground">Analizando tus gustos...</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-6">
            <Heart className="h-8 w-8 mx-auto mb-2 text-pink-300" />
            <p className="text-sm text-muted-foreground">
              ¡Explora nuestros productos para recibir recomendaciones personalizadas!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recommendations.map((rec, index) => (
              <motion.div
                key={rec.product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group relative"
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                  {rec.product.image_url ? (
                    <img 
                      src={rec.product.image_url} 
                      alt={rec.product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                
                <p className="text-xs font-medium line-clamp-1">{rec.product.name}</p>
                <p className="text-sm font-bold text-pink-600 dark:text-pink-400">
                  ${rec.product.price_usd.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                  {rec.reason}
                </p>
                
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 h-7 text-xs"
                  onClick={() => handleAddToCart(rec.product)}
                >
                  Agregar
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
