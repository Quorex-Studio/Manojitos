import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Truck, Shield, CreditCard, Star, Sparkles, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ProductCard } from '@/components/ui/premium/product-card';
import { usePublicProducts } from '@/hooks/usePublicProducts';
import { Skeleton } from '@/components/ui/skeleton';

// Variantes para animaciones escalonadas (stagger)
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 50 } }
};

// Página principal de la tienda (Home)
export default function StoreFront() {
  // --- DERIVED ---
  const { products, loading, categories } = usePublicProducts();

  // Obtener productos destacados (los primeros 8 con stock)
  // Nota: React Query ya cachea esto, así que es eficiente filtrar aquí.
  const featuredProducts = products.slice(0, 8);

  // Beneficios de la tienda
  const benefits = [
    {
      icon: Truck,
      title: 'Envío Nacional',
      description: 'Envíos rápidos y asegurados a toda Venezuela.'
    },
    {
      icon: Shield,
      title: 'Compra Protegida',
      description: 'Tu seguridad es nuestra prioridad en cada transacción.'
    },
    {
      icon: CreditCard,
      title: 'Pagos Flexibles',
      description: 'Pago Móvil, Zelle, Binance y Transferencias.'
    },
    {
      icon: Star,
      title: 'Calidad Premium',
      description: 'Curaduría exclusiva de productos de alta gama.'
    }
  ];

  // --- RENDER ---
  return (
    <StoreLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[80vh] flex items-center justify-center">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-light via-background to-background" />

        {/* Decorative orbs */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute top-20 right-10 w-96 h-96 bg-primary/15 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-gold/10 rounded-full blur-[120px]"
        />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <span className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-card/60 backdrop-blur-md border border-border text-muted-foreground text-sm font-medium tracking-wide shadow-sm mb-6">
                <Sparkles className="h-4 w-4 text-gold" />
                Nueva Colección Disponible
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl md:text-7xl lg:text-8xl font-serif font-semibold text-foreground leading-[0.95] tracking-tight"
            >
              Elegancia que <br />
              <span className="italic text-primary">Inspira</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed"
            >
              Descubre una selección exclusiva diseñada para resaltar tu esencia única. Calidad, estilo y distinción en cada detalle.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-8"
            >
              <Link to="/tienda">
                <Button size="lg" className="h-14 px-10 rounded-full text-lg font-medium shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all duration-300">
                  Explorar Tienda
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/tienda?category=destacados">
                <Button size="lg" variant="outline" className="h-14 px-10 rounded-full text-lg border-border hover:bg-secondary transition-all">
                  Ver Destacados
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Categories Section - Horizontal Scroll elegante en móvil, Grid en desktop */}
      {categories.length > 0 && (
        <section className="py-20 bg-secondary/30 backdrop-blur-3xl border-y border-border/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-medium text-foreground mb-4">
                Colecciones
              </h2>
              <div className="h-1 w-20 bg-primary/30 mx-auto rounded-full" />
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
              className="flex flex-wrap justify-center gap-4"
            >
              {categories.map((category) => (
                <motion.div variants={itemVariants} key={category}>
                  <Link to={`/tienda?category=${encodeURIComponent(category)}`}>
                    <Button
                      variant="ghost"
                      className="h-auto py-3 px-8 text-lg font-normal rounded-full border border-transparent hover:border-primary/20 hover:bg-white/80 transition-all duration-300"
                    >
                      {category}
                    </Button>
                  </Link>
                </motion.div>
              ))}
              <motion.div variants={itemVariants}>
                <Link to="/tienda">
                  <Button variant="link" className="text-primary text-lg decoration-primary/30 hover:decoration-primary">
                    Ver todo el catálogo <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Featured Products Grid */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-2">
                Tendencias
              </h2>
              <p className="text-muted-foreground text-lg">
                Los favoritos de nuestra comunidad
              </p>
            </div>
            <Link to="/tienda" className="hidden md:flex items-center text-primary font-medium hover:underline decoration-primary/30 underline-offset-4 transition-all">
              Ver colección completa <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <div className="min-h-[400px]">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-4">
                    <Skeleton className="aspect-[4/5] rounded-2xl bg-secondary/50" />
                    <Skeleton className="h-4 w-3/4 bg-secondary/50" />
                    <Skeleton className="h-6 w-1/4 bg-secondary/50" />
                  </div>
                ))}
              </div>
            ) : featuredProducts.length > 0 ? (
              <>
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-50px" }}
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8"
                >
                  {featuredProducts.map((product) => (
                    <motion.div variants={itemVariants} key={product.id}>
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </motion.div>

                <div className="mt-12 text-center md:hidden">
                  <Link to="/tienda">
                    <Button variant="outline" size="lg" className="w-full rounded-full">
                      Ver colección completa
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-secondary/20 rounded-3xl border border-dashed border-border">
                <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-xl text-muted-foreground font-light">
                  Estamos reponiendo nuestro inventario exclusivo.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Benefits Section - Glassmorphism UI */}
      <section className="py-24 bg-gradient-to-t from-secondary/50 to-background relative overflow-hidden">
        <div className="container mx-auto px-4 relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group p-8 rounded-2xl bg-card/60 backdrop-blur-md border border-border flex flex-col items-center text-center hover:bg-card hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <benefit.icon className="h-7 w-7 text-gold" />
                </div>
                <h3 className="font-serif font-semibold text-xl text-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 container mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden bg-foreground text-background text-center py-24 px-6">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-15 mix-blend-screen" />
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-4xl md:text-5xl font-serif">
              Tu estilo, redefinido.
            </h2>
            <p className="text-background/60 text-lg md:text-xl font-light">
              Únete a miles de clientes satisfechos que han encontrado su esencia con nosotros.
            </p>
            <Link to="/tienda">
              <Button size="lg" className="bg-background text-foreground hover:bg-background/90 rounded-full h-14 px-12 text-lg font-medium shadow-2xl mt-4">
                Comenzar a Comprar
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </StoreLayout>
  );
}
