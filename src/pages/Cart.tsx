import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Trash2, Minus, Plus, ArrowRight, ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { StoreLayout } from '@/components/store/StoreLayout';
import { useCart } from '@/contexts/CartContext';
import { useExchangeRate } from '@/hooks/useExchangeRate';

// Página del carrito de compras
export default function Cart() {
  const { items, removeItem, updateQuantity, getSubtotal, clearCart } = useCart();
  const { rate, convertToBS } = useExchangeRate();
  
  const subtotal = getSubtotal();
  const isEmpty = items.length === 0;

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-6 md:py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-colors">Inicio</Link>
          <span>/</span>
          <span className="text-foreground">Mi Carrito</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
              Mi Carrito
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEmpty ? 'Tu carrito está vacío' : `${items.length} producto${items.length > 1 ? 's' : ''}`}
            </p>
          </div>
          {!isEmpty && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive/80"
              onClick={clearCart}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Vaciar
            </Button>
          )}
        </div>

        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center mb-6">
              <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Tu carrito está vacío
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              ¡Explora nuestra tienda y encuentra productos increíbles!
            </p>
            <Link to="/tienda">
              <Button className="btn-gold">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Ir a la Tienda
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="glass-card rounded-2xl p-4 md:p-6"
                  >
                    <div className="flex gap-4">
                      {/* Image */}
                      <Link to={`/producto/${item.id}`} className="flex-shrink-0">
                        <div className="w-20 h-20 md:w-28 md:h-28 rounded-xl overflow-hidden bg-secondary/30">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                      </Link>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2">
                          <Link to={`/producto/${item.id}`}>
                            <h3 className="font-medium text-foreground hover:text-accent transition-colors line-clamp-2">
                              {item.name}
                            </h3>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-2 space-y-1">
                          <p className="text-accent font-semibold">
                            ${item.price_usd.toFixed(2)}
                          </p>
                          {rate > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Bs. {convertToBS(item.price_usd).toFixed(2)}
                            </p>
                          )}
                        </div>

                        {/* Quantity & Subtotal */}
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center border border-border rounded-lg overflow-hidden">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-10 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= item.stock}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="font-semibold text-foreground">
                            ${(item.price_usd * item.quantity).toFixed(2)}
                          </p>
                        </div>

                        {/* Stock warning */}
                        {item.quantity >= item.stock && (
                          <p className="text-xs text-orange-500 mt-2">
                            Máximo disponible: {item.stock}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Continue Shopping */}
              <Link to="/tienda">
                <Button variant="ghost" className="w-full mt-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Seguir Comprando
                </Button>
              </Link>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="glass-card rounded-2xl p-6 sticky top-24">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  Resumen del Pedido
                </h2>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Envío</span>
                    <span className="text-muted-foreground">Calculado al pagar</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-semibold text-foreground">Total</span>
                  <span className="text-2xl font-bold text-accent">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                {rate > 0 && (
                  <p className="text-right text-muted-foreground text-sm mb-6">
                    Bs. {convertToBS(subtotal).toFixed(2)}
                  </p>
                )}

                <Link to="/checkout">
                  <Button size="lg" className="w-full btn-gold">
                    Proceder al Pago
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Los precios están en USD. Se requerirá registro al momento de pagar.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
