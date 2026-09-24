import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Truck, CreditCard, Package, Sparkles, MessageSquare, Instagram } from 'reicon-react';
import { Button } from '@/components/ui/button';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { usePublicProducts, PublicProduct } from '@/hooks/usePublicProducts';
import { BRAND, BRAND_NAME, BRAND_INSTAGRAM_URL } from '@/config/brand';
import { BRAND_STAR, BRAND_STAR_WINE } from '@/config/brand-assets';

const BENEFITS = [
  { icon: Sparkles, title: 'Productos importados', description: 'Maquillaje y skincare originales.' },
  { icon: MessageSquare, title: 'Asesoría personalizada', description: 'Te ayudamos a elegir tu tono y rutina.' },
  { icon: Truck, title: 'Envíos a toda Venezuela', description: 'Delivery en Margarita y agencias nacionales.' },
  { icon: CreditCard, title: 'Paga como prefieras', description: 'Pago Móvil, transferencia, Zelle o efectivo.' },
];

// Foto de producto o bloque "estudio" mientras carga / si no hay imagen
function HeroImage({ product, className }: { product?: PublicProduct; className: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-studio ${className}`}>
      {product?.image_url ? (
        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Package className="h-10 w-10 text-muted-foreground/25" />
        </div>
      )}
    </div>
  );
}

// Página principal de la tienda (ver DESIGN.md: "la foto manda")
export default function StoreFront() {
  const { products, loading, categories } = usePublicProducts();
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.2 }, transition: { duration: 0.3 } };

  const featuredProducts = products.slice(0, 8);
  const heroProducts = products.filter(p => p.image_url).slice(0, 3);
  // Portada de cada categoría: su producto más vendido con foto
  const categoryCovers = categories.map(category => ({
    category,
    cover: [...products]
      .filter(p => p.category === category && p.image_url)
      .sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0))[0],
    count: products.filter(p => p.category === category).length,
  }));

  return (
    <StoreLayout>
      {/* ===== HERO: texto + collage de productos reales ===== */}
      <section className="container mx-auto px-4 pb-10 pt-6 md:pb-16 md:pt-12">
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
          <div className="order-2 space-y-6 md:order-1">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <img src={BRAND_STAR_WINE} alt="" aria-hidden="true" className="h-4 w-auto dark:hidden" />
              <img src={BRAND_STAR} alt="" aria-hidden="true" className="hidden h-4 w-auto dark:block" />
              Maquillaje &amp; Belleza
            </p>
            <h1 className="font-serif text-4xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Tu belleza, <span className="italic text-primary">a tu manera</span>
            </h1>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
              {BRAND.tagline} Precios en dólares y bolívares y envíos a toda Venezuela.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-12 rounded-full px-8 text-base font-semibold">
                <Link to="/tienda">
                  Ver la tienda
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-border bg-card px-8 text-base">
                <a href={BRAND_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                  <Instagram className="mr-2 h-4 w-4" />
                  @{BRAND.instagram}
                </a>
              </Button>
            </div>
          </div>

          <div className="order-1 grid aspect-[5/4] grid-cols-5 grid-rows-2 gap-3 md:order-2 md:gap-4">
            <HeroImage product={heroProducts[0]} className="col-span-3 row-span-2" />
            <HeroImage product={heroProducts[1]} className="col-span-2" />
            <HeroImage product={heroProducts[2]} className="col-span-2" />
          </div>
        </div>
      </section>

      {/* ===== BENEFICIOS (franja compacta) ===== */}
      <section className="border-y border-border/70 bg-card">
        <div className="container mx-auto grid grid-cols-2 gap-x-4 gap-y-6 px-4 py-6 md:grid-cols-4 md:py-8">
          {BENEFITS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-studio">
                <Icon className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-xs leading-snug text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CATEGORÍAS con foto ===== */}
      {categoryCovers.length > 0 && (
        <section className="container mx-auto px-4 py-10 md:py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground md:text-3xl">
              Compra por categoría
            </h2>
            <Link to="/tienda" className="text-sm font-semibold text-foreground underline-offset-4 hover:underline">
              Ver todo
            </Link>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0">
            {categoryCovers.map(({ category, cover, count }) => (
              <Link
                key={category}
                to={`/tienda?category=${encodeURIComponent(category)}`}
                className="group w-40 shrink-0 snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:w-auto rounded-2xl"
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-studio">
                  {cover?.image_url ? (
                    <img
                      src={cover.image_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-10 w-10 text-muted-foreground/25" />
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2 px-0.5">
                  <span className="font-semibold text-foreground group-hover:text-primary">{category}</span>
                  <span className="text-xs text-muted-foreground">{count} {count === 1 ? 'producto' : 'productos'}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ===== TENDENCIAS ===== */}
      <section className="container mx-auto px-4 py-10 md:py-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground md:text-3xl">
              Lo más nuevo
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Recién llegado a {BRAND_NAME}</p>
          </div>
          <Link to="/tienda" className="hidden items-center text-sm font-semibold text-foreground underline-offset-4 hover:underline md:flex">
            Ver toda la tienda <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[4/5] animate-pulse rounded-2xl bg-studio" />
                <div className="h-3 w-1/3 animate-pulse rounded-full bg-studio" />
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-studio" />
              </div>
            ))}
          </div>
        ) : featuredProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {featuredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} allProducts={products} />
              ))}
            </div>
            <div className="mt-10 text-center md:hidden">
              <Button asChild variant="outline" size="lg" className="h-12 w-full rounded-full bg-card">
                <Link to="/tienda">Ver toda la tienda</Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-studio">
              <Package className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="font-serif text-xl text-foreground">Muy pronto, nuevos productos</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Estamos preparando los productos. Vuelve en unos días o escríbenos para apartar lo que buscas.
            </p>
          </div>
        )}
      </section>

      {/* ===== CRÉDITO (diferenciador) ===== */}
      <motion.section {...fadeUp} className="container mx-auto px-4 pb-16 md:pb-24">
        <div className="relative grid items-center gap-6 overflow-hidden rounded-3xl bg-wine px-6 py-10 text-cream md:grid-cols-[1.4fr_1fr] md:px-12 md:py-14">
          <img src={BRAND_STAR} alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-6 -right-8 w-56 opacity-20 md:w-80" />
          <div className="relative space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-nude">Crédito {BRAND_NAME}</p>
            <h2 className="font-serif text-3xl font-medium leading-tight md:text-4xl">
              Llévalo hoy y paga en partes
            </h2>
            <p className="max-w-lg text-sm leading-relaxed text-cream/80 md:text-base">
              Regístrate, verifica tu identidad una sola vez y compra pagando una inicial. El resto lo pagas en cuotas quincenales, sin sorpresas.
            </p>
          </div>
          <div className="relative flex flex-col gap-3 sm:flex-row md:flex-col md:items-end">
            <Button asChild size="lg" className="h-12 rounded-full bg-cream px-8 text-base font-semibold text-wine hover:bg-cream/90">
              <Link to="/cliente/auth">Crear mi cuenta</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-12 rounded-full px-8 text-base text-cream hover:bg-cream/10 hover:text-cream">
              <Link to="/faq">Ver preguntas frecuentes</Link>
            </Button>
          </div>
        </div>
      </motion.section>
    </StoreLayout>
  );
}
