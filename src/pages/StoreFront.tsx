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
      staggerChildren: 0.12
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 50, damping: 20 } }
};

// Variante para la aparición palabra por palabra del headline
const wordVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

// Página principal de la tienda (Home) — Editorial luxury
export default function StoreFront() {
  // --- DERIVED ---
  const { products, loading, categories } = usePublicProducts();

  // Obtener productos destacados (los primeros 8 con stock)
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
      {/* ========================
          HERO SECTION — Full viewport, editorial
          ======================== */}
      <section className="relative overflow-hidden min-h-screen flex items-center justify-center grain-overlay isolate">
        {/* Dynamic background using theme tokens */}
        <div className="absolute inset-0 bg-background transition-colors duration-500" />

        {/* Floating decorative orbs — subtle opacity adjustments for light/dark */}
        <div className="absolute top-20 right-10 w-[500px] h-[500px] bg-primary/20 dark:bg-primary/20 rounded-full blur-[150px] animate-orb-1 opacity-60 dark:opacity-100" />
        <div className="absolute bottom-20 left-10 w-[600px] h-[600px] bg-gold/15 dark:bg-gold/15 rounded-full blur-[180px] animate-orb-2 opacity-50 dark:opacity-100" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-rose-dark/10 dark:bg-rose-dark/10 rounded-full blur-[120px] animate-orb-3 opacity-40 dark:opacity-100" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center space-y-10">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-card/40 dark:bg-white/5 backdrop-blur-md border border-border/20 dark:border-white/10 text-foreground/60 dark:text-[#F5EDE8]/60 text-xs font-medium tracking-[0.15em] uppercase">
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                Nueva Colección Disponible
              </span>
            </motion.div>

            {/* Giant headline — stagger word entrance */}
            <div className="overflow-hidden">
              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-semibold leading-[0.9] tracking-tighter break-words hyphens-auto"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                <motion.span
                  variants={wordVariants}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="block text-foreground dark:text-[#F5EDE8]"
                >
                  Elegancia que
                </motion.span>
                <motion.span
                  variants={wordVariants}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="block italic text-primary text-glow-rosa drop-shadow-[0_0_20px_rgba(255,105,180,0.3)]"
                >
                  Inspira
                </motion.span>
              </motion.h1>
            </div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="text-base md:text-lg text-muted-foreground/80 dark:text-[#F5EDE8]/35 max-w-2xl mx-auto font-light leading-relaxed tracking-[0.05em]"
            >
              Descubre una selección exclusiva diseñada para resaltar tu esencia única. Calidad, estilo y distinción en cada detalle.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4"
            >
              <Link to="/tienda">
                <Button size="lg" className="h-14 px-12 rounded-full text-base font-medium border border-primary/50 bg-primary/10 text-foreground dark:text-[#F5EDE8] hover:bg-primary/20 hover:border-primary/70 transition-all duration-500 btn-shimmer-rosa backdrop-blur-sm">
                  Explorar Tienda
                  <ArrowRight className="ml-2 h-4.5 w-4.5" />
                </Button>
              </Link>
              <Link to="/tienda?category=destacados">
                <Button size="lg" variant="ghost" className="h-14 px-12 rounded-full text-base text-muted-foreground dark:text-[#F5EDE8]/50 border border-border dark:border-[#F5EDE8]/10 hover:text-foreground dark:hover:text-[#F5EDE8]/80 hover:border-border/40 dark:hover:border-[#F5EDE8]/20 transition-all duration-500 backdrop-blur-sm">
                  Ver Destacados
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========================
          CATEGORIES — Glassmorphism pills
          ======================== */}
      {categories.length > 0 && (
        <section className="py-24 relative">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-serif font-medium text-foreground mb-4 tracking-tight">
                Colecciones
              </h2>
              <div className="h-px w-16 bg-gold/30 mx-auto" />
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.1 }}
              className="flex flex-wrap justify-center gap-3"
            >
              {categories.map((category) => (
                <motion.div variants={itemVariants} key={category}>
                  <Link to={`/tienda?category=${encodeURIComponent(category)}`}>
                    <Button
                      variant="ghost"
                      className="h-auto py-3 px-7 text-sm font-normal rounded-full bg-card/80 backdrop-blur-md border border-primary/10 text-foreground/70 hover:text-foreground hover:border-primary/30 hover:shadow-[0_0_20px_hsl(var(--rose)/0.15)] transition-all duration-400 tracking-wide"
                    >
                      {category}
                    </Button>
                  </Link>
                </motion.div>
              ))}
              <motion.div variants={itemVariants}>
                <Link to="/tienda">
                  <Button variant="link" className="text-gold text-sm tracking-wide">
                    Ver todo el catálogo <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ========================
          FEATURED PRODUCTS — Editorial grid
          ======================== */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-14">
            <div>
              <h2 className="text-4xl md:text-6xl font-serif font-medium text-foreground mb-3 tracking-tight">
                Tendencias
              </h2>
              <p className="text-muted-foreground/60 text-sm tracking-wide">
                Los favoritos de nuestra comunidad
              </p>
            </div>
            <Link to="/tienda" className="hidden md:flex items-center text-gold text-sm tracking-wide hover:underline decoration-gold/30 underline-offset-4 transition-all">
              Ver colección completa <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="min-h-[400px]">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="aspect-[3/4] rounded-2xl skeleton-shimmer" />
                    <div className="h-3 w-3/4 rounded-full skeleton-shimmer" />
                    <div className="h-4 w-1/4 rounded-full skeleton-shimmer" />
                  </div>
                ))}
              </div>
            ) : featuredProducts.length > 0 ? (
              <>
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.05 }}
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6"
                >
                  {featuredProducts.map((product) => (
                    <motion.div variants={itemVariants} key={product.id}>
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </motion.div>

                <div className="mt-14 text-center md:hidden">
                  <Link to="/tienda">
                    <Button variant="outline" size="lg" className="w-full rounded-full border-border/20 hover:border-primary/30 transition-all duration-300">
                      Ver colección completa
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 rounded-3xl border border-dashed border-border/20">
                <Package className="h-16 w-16 text-muted-foreground/15 mb-4" />
                <p className="text-lg text-muted-foreground/40 font-light tracking-wide">
                  Estamos reponiendo nuestro inventario exclusivo.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================
          BENEFITS — Glassmorphism with gold borders
          ======================== */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4 relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group p-8 rounded-2xl bg-card/80 backdrop-blur-md border border-gold/10 flex flex-col items-center text-center hover:border-gold/25 hover:shadow-[0_16px_48px_hsl(var(--gold)/0.1)] transition-all duration-500"
              >
                <div className="w-14 h-14 rounded-full bg-gold/8 border border-gold/15 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-gold/12 transition-all duration-300">
                  <benefit.icon className="h-6 w-6 text-gold" />
                </div>
                <h3 className="font-serif font-semibold text-lg text-foreground mb-2 tracking-tight">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground/70 text-sm leading-relaxed tracking-wide">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================
          CTA FINAL — Editorial full-width
          ======================== */}
      <section className="py-12 container mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden text-center py-16 px-6 grain-overlay">
          {/* Dynamic background using theme tokens */}
          <div className="absolute inset-0 bg-background transition-colors duration-500" />
          {/* Fashion editorial photo at 10% opacity */}
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-[0.05] dark:opacity-[0.08] mix-blend-multiply dark:mix-blend-screen" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-8">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-serif text-foreground dark:text-[#F5EDE8] tracking-tight"
            >
              Tu estilo, redefinido.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground/80 dark:text-[#F5EDE8]/30 text-base md:text-lg font-light tracking-wide"
            >
              Únete a miles de clientes satisfechos que han encontrado su esencia con nosotros.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Link to="/tienda">
                <Button size="lg" className="btn-gold rounded-full h-14 px-14 text-base font-medium animate-glow-pulse-gold">
                  Comenzar a Comprar
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
    </StoreLayout>
  );
}
