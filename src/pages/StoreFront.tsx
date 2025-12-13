import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Truck, Shield, CreditCard, Star, Package, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { usePublicProducts } from '@/hooks/usePublicProducts';
import { Skeleton } from '@/components/ui/skeleton';

// Página principal de la tienda (Home)
export default function StoreFront() {
  const { products, loading, categories } = usePublicProducts();
  
  // Obtener productos destacados (los primeros 8 con stock)
  const featuredProducts = products.slice(0, 8);

  // Beneficios de la tienda
  const benefits = [
    {
      icon: Truck,
      title: 'Envío a Todo el País',
      description: 'Llegamos a toda Venezuela con envíos rápidos y seguros'
    },
    {
      icon: Shield,
      title: 'Compra Segura',
      description: 'Tus datos siempre protegidos con la mejor seguridad'
    },
    {
      icon: CreditCard,
      title: 'Múltiples Pagos',
      description: 'Pago móvil, Zelle, transferencia y efectivo'
    },
    {
      icon: Star,
      title: 'Calidad Garantizada',
      description: 'Productos seleccionados con los más altos estándares'
    }
  ];

  return (
    <StoreLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/30" />
        
        {/* Decorative elements */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 py-16 md:py-24 lg:py-32 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
                <Sparkles className="h-4 w-4" />
                Bienvenido a nuestra tienda
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground leading-tight"
            >
              Descubre los mejores{' '}
              <span className="text-gradient-gold">productos</span>{' '}
              para ti
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
            >
              Calidad, variedad y los mejores precios. Tu tienda de confianza con todo lo que necesitas.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
            >
              <Link to="/tienda">
                <Button size="lg" className="btn-gold text-base px-8 py-6">
                  Ver Productos
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/tienda?category=destacados">
                <Button size="lg" variant="outline" className="text-base px-8 py-6 border-2">
                  Ver Destacados
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      {categories.length > 0 && (
        <section className="py-12 md:py-16 bg-secondary/20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
                Explora por Categoría
              </h2>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((category, index) => (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/tienda?category=${encodeURIComponent(category)}`}>
                    <Button 
                      variant="outline" 
                      className="rounded-full px-6 hover:bg-primary/10 hover:border-primary/50 transition-all"
                    >
                      {category}
                    </Button>
                  </Link>
                </motion.div>
              ))}
              <Link to="/tienda">
                <Button variant="ghost" className="rounded-full px-6 text-accent hover:text-accent/80">
                  Ver Todos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
                Productos Destacados
              </h2>
              <p className="text-muted-foreground mt-1">
                Los favoritos de nuestros clientes
              </p>
            </div>
            <Link to="/tienda" className="hidden md:block">
              <Button variant="ghost" className="text-accent hover:text-accent/80">
                Ver Todos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-2xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                </div>
              ))}
            </div>
          ) : featuredProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <div className="mt-8 text-center md:hidden">
                <Link to="/tienda">
                  <Button className="btn-gold">
                    Ver Todos los Productos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                Próximamente agregaremos productos increíbles
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 md:py-20 bg-gradient-to-b from-background to-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
              ¿Por qué elegirnos?
            </h2>
            <p className="text-muted-foreground mt-2">
              Nos esforzamos por brindarte la mejor experiencia de compra
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card rounded-2xl p-6 text-center group hover-lift"
              >
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <benefit.icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl glass-card-gold p-8 md:p-12">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
            
            <div className="relative max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
                ¿Listo para comprar?
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                Explora nuestra colección completa y encuentra exactamente lo que buscas. 
                ¡No necesitas crear cuenta para ver productos!
              </p>
              <Link to="/tienda">
                <Button size="lg" className="btn-gold text-base">
                  Ir a la Tienda
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </StoreLayout>
  );
}
