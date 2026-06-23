import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Package, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreLayout } from '@/components/store/StoreLayout';
import { useCart } from '@/contexts/CartContext';
import { useExchangeRate } from '@/hooks/useExchangeRate';

// Carrito de compras — Luxury receipt layout
export default function Cart() {
  const { items, removeItem, updateQuantity, getSubtotal, getItemCount, clearCart } = useCart();
  const { rate, convertToBS } = useExchangeRate();

  const total = getSubtotal();
  const itemCount = getItemCount();

  if (items.length === 0) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-24">
          <div className="max-w-md mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-5"
            >
              <div className="w-20 h-20 rounded-full bg-card border border-border/20 flex items-center justify-center mx-auto">
                <ShoppingBag className="h-10 w-10 text-muted-foreground/20" />
              </div>
              <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">
                Tu carrito está vacío
              </h1>
              <p className="text-muted-foreground/40 text-sm tracking-wide">
                Descubre nuestra colección exclusiva y encuentra algo especial.
              </p>
              <Link to="/tienda">
                <Button size="lg" className="btn-gold rounded-full h-13 px-10 text-sm mt-4">
                  Explorar Tienda
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-10">
          <nav className="flex items-center gap-2 text-xs text-muted-foreground/40 mb-5 tracking-wide">
            <Link to="/" className="hover:text-foreground transition-colors">Inicio</Link>
            <span>/</span>
            <span className="text-foreground/70">Carrito</span>
          </nav>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground tracking-tight">
                Tu Carrito
              </h1>
              <p className="text-muted-foreground/40 mt-2 text-sm tracking-wide">
                {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-10">
          {/* Items */}
          <div className="space-y-0">
            <AnimatePresence mode="popLayout">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100, transition: { duration: 0.3 } }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-5 py-6 border-b border-border/10 group"
                >
                  {/* Thumbnail */}
                  <Link to={`/producto/${item.id}`} className="flex-shrink-0">
                    <div className="w-20 h-24 md:w-24 md:h-28 rounded-xl overflow-hidden bg-secondary flex-shrink-0 group-hover:shadow-lg transition-shadow duration-300">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-1" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-muted-foreground/20" />
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Info & Subtotal Container */}
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Product Info & Controls */}
                    <div className="min-w-0 space-y-2">
                      <div>
                        <Link to={`/producto/${item.id}`}>
                          <h3 className="font-serif text-foreground/90 text-sm md:text-base font-medium truncate hover:text-primary transition-colors">
                            {item.name}
                          </h3>
                        </Link>
                        {item.size && (
                          <span className="inline-block mt-1 text-[10px] bg-secondary/40 text-muted-foreground/60 border border-border/10 rounded-full px-2.5 py-0.5">
                            Talla: {item.size === 'Única' ? 'Única' : item.size}
                          </span>
                        )}
                        <p className="text-gold text-xs md:text-sm font-semibold mt-1.5">${item.price_usd.toFixed(2)}</p>
                      </div>
                      
                      {/* Quantity controls — pill */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-border/15 rounded-full bg-card/80 backdrop-blur-sm overflow-hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-none hover:text-primary"
                            onClick={() => item.quantity <= 1 ? removeItem(item.id, item.size) : updateQuantity(item.id, item.quantity - 1, item.size)}
                          >
                            {item.quantity <= 1 ? <Trash2 className="h-3.5 w-3.5 text-destructive/60" /> : <Minus className="h-3 w-3" />}
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-none"
                            onClick={() => updateQuantity(item.id, item.quantity + 1, item.size)}
                            disabled={item.quantity >= item.stock}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground/30 hover:text-destructive text-xs h-8 px-2"
                          onClick={() => removeItem(item.id, item.size)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-start pt-2.5 sm:pt-0 border-t border-border/5 sm:border-t-0">
                      <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider sm:hidden">Subtotal</span>
                      <div className="text-right">
                        <p className="font-serif text-base md:text-lg font-semibold text-gradient-gold">
                          ${(item.price_usd * item.quantity).toFixed(2)}
                        </p>
                        {rate > 0 && (
                          <p className="text-[10px] text-muted-foreground/35 mt-0.5">
                            Bs. {convertToBS(item.price_usd * item.quantity).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Summary Card — Glassmorphism with gold border */}
          <div className="lg:sticky lg:top-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl p-6 bg-card/80 backdrop-blur-xl border border-gold/15 shadow-[0_16px_48px_hsl(var(--gold)/0.08)]"
            >
              <h3 className="font-serif text-foreground/80 text-sm tracking-wide mb-6">Resumen del pedido</h3>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground/50">Subtotal ({itemCount} productos)</span>
                  <span className="text-foreground/80">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground/50">Envío</span>
                  <span className="text-gold/80 text-xs tracking-wide">Calculado al pagar</span>
                </div>

                <div className="h-px bg-border/10 my-2" />

                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground/60">Total</span>
                  <div className="text-right">
                    <span className="text-3xl font-bold font-serif text-gradient-gold">
                      ${total.toFixed(2)}
                    </span>
                    {rate > 0 && (
                      <p className="text-xs text-muted-foreground/30 mt-1">
                        Bs. {convertToBS(total).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Link to="/checkout" className="block mt-8">
                <Button size="lg" className="w-full btn-gold btn-shimmer rounded-full h-13 text-base">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Proceder al Pago
                </Button>
              </Link>

              <Link to="/tienda" className="block mt-3">
                <Button variant="ghost" className="w-full text-muted-foreground/40 hover:text-foreground rounded-full text-sm h-10">
                  <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                  Seguir comprando
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
