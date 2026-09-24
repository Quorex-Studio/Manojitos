import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Setting, Search, Filter, CloseSquare, Package } from 'reicon-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { usePublicProducts } from '@/hooks/usePublicProducts';


// Hook personalizado para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Normaliza texto para buscar sin importar mayúsculas ni acentos
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const SORT_OPTIONS = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'popular', label: 'Más vendidos' },
  { value: 'price-asc', label: 'Precio: menor a mayor' },
  { value: 'price-desc', label: 'Precio: mayor a menor' },
  { value: 'name', label: 'Nombre A-Z' },
] as const;
type SortValue = typeof SORT_OPTIONS[number]['value'];

const PAGE_SIZE = 12;

// Catálogo: la URL es la única fuente de verdad (?search=&category=a,b&sort=), así
// los enlaces del header, el botón atrás y compartir el link muestran lo mismo.
export default function StoreCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { products, loading, categories } = usePublicProducts();

  const urlSearch = searchParams.get('search') || '';
  const selectedCategories = useMemo(
    () => (searchParams.get('category') || '').split(',').map(c => c.trim()).filter(Boolean),
    [searchParams]
  );
  const sortParam = searchParams.get('sort') as SortValue | null;
  const sortBy: SortValue = SORT_OPTIONS.some(o => o.value === sortParam) ? (sortParam as SortValue) : 'newest';

  // El input se escribe localmente y se sincroniza con la URL con debounce
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const updateParams = useCallback((changes: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([key, value]) => {
        if (value) next.set(key, value); else next.delete(key);
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Input -> URL
  useEffect(() => {
    const value = debouncedSearch.trim();
    if (value !== urlSearch) updateParams({ search: value || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // URL -> input (cuando la búsqueda llega desde el header o el botón atrás)
  useEffect(() => {
    if (urlSearch !== debouncedSearch.trim()) setSearchQuery(urlSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

  const maxPrice = useMemo(() => {
    if (products.length === 0) return 1000;
    return Math.ceil(Math.max(...products.map(p => p.price_usd)) / 10) * 10;
  }, [products]);

  useEffect(() => {
    setPriceRange([0, maxPrice]);
  }, [maxPrice]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (debouncedSearch.trim()) {
      const terms = normalize(debouncedSearch.trim()).split(/\s+/);
      result = result.filter(p => {
        const haystack = normalize(`${p.name} ${p.description || ''} ${p.category || ''}`);
        return terms.every(t => haystack.includes(t));
      });
    }

    if (selectedCategories.length > 0) {
      result = result.filter(p => p.category && selectedCategories.includes(p.category));
    }

    result = result.filter(p => p.price_usd >= priceRange[0] && p.price_usd <= priceRange[1]);

    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price_usd - b.price_usd);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price_usd - a.price_usd);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        break;
      case 'popular':
        result.sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return result;
  }, [products, debouncedSearch, selectedCategories, priceRange, sortBy]);

  // Al cambiar cualquier filtro se vuelve a la primera página
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearch, selectedCategories, priceRange, sortBy]);

  const setCategories = (next: string[]) => updateParams({ category: next.length ? next.join(',') : null });

  const toggleCategory = (category: string) => {
    setCategories(
      selectedCategories.includes(category)
        ? selectedCategories.filter(c => c !== category)
        : [...selectedCategories, category]
    );
  };

  const setSortBy = (value: string) => updateParams({ sort: value === 'newest' ? null : value });

  const clearFilters = () => {
    setSearchQuery('');
    setPriceRange([0, maxPrice]);
    setSearchParams({}, { replace: true });
  };

  const handleLoadMore = () => setVisibleCount(prev => prev + PAGE_SIZE);

  const priceFiltered = priceRange[0] > 0 || priceRange[1] < maxPrice;
  const activeFilterCount = (searchQuery ? 1 : 0) + selectedCategories.length + (priceFiltered ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  // Componente de filtros
  const FiltersContent = () => (
    <div className="space-y-8">
      {/* Categorías */}
      <div>
        <h4 className="font-serif text-sm text-foreground/80 mb-4 tracking-wide">Categorías</h4>
        <div className="space-y-3">
          {categories.map(category => (
            <div key={category} className="flex items-center gap-3">
              <Checkbox
                id={`cat-${category}`}
                checked={selectedCategories.includes(category)}
                onCheckedChange={() => toggleCategory(category)}
                className="border-border/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label
                htmlFor={`cat-${category}`}
                className="flex-1 text-sm cursor-pointer text-foreground/80 hover:text-foreground transition-colors"
              >
                {category}
              </Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {products.filter(p => p.category === category).length}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Rango de precio */}
      <div>
        <h4 className="font-serif text-sm text-foreground/80 mb-4 tracking-wide">Precio (USD)</h4>
        <div className="px-1">
          <Slider
            value={priceRange}
            onValueChange={(value) => setPriceRange(value as [number, number])}
            min={0}
            max={maxPrice}
            step={5}
            className="mb-4"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground tracking-wide">
            <span>${priceRange[0]}</span>
            <span>${priceRange[1]}</span>
          </div>
        </div>
      </div>

      {/* Limpiar filtros */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          className="w-full rounded-full border-border text-sm"
          onClick={clearFilters}
        >
          <CloseSquare className="h-3.5 w-3.5 mr-2" />
          Limpiar filtros
        </Button>
      )}
    </div>
  );

  // --- RENDER ---
  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-10">
          <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-5 tracking-wide">
            <Link to="/" className="hover:text-foreground transition-colors">Inicio</Link>
            <span>/</span>
            <span className="text-foreground/70">Tienda</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground tracking-tight">
                Nuestra Tienda
              </h1>
              <p className="text-muted-foreground mt-2 text-sm tracking-wide">
                {loading ? 'Cargando...' : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'producto' : 'productos'}`}
              </p>
            </div>
          </div>
        </div>

        {/* Search and Controls Bar */}
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          {/* Search */}
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.slice(0, 60))}
              aria-label="Buscar productos"
              enterKeyHint="search"
              className="pl-10 pr-10 h-11 bg-card/80 backdrop-blur-sm border-border/15 rounded-full text-sm focus:border-primary/30 transition-all duration-300"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Borrar búsqueda"
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <CloseSquare className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Filter button - Mobile */}
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden relative rounded-full border-border/20 h-11">
                  <Setting className="h-4 w-4 mr-2" />
                  Filtros
                  {hasActiveFilters && (
                    <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto bg-background border-border">
                <SheetHeader>
                  <SheetTitle className="font-serif tracking-tight">Filtros</SheetTitle>
                </SheetHeader>
                <div className="mt-8">
                  <FiltersContent />
                </div>
                <Button className="mt-8 h-12 w-full rounded-full font-semibold" onClick={() => setShowFilters(false)}>
                  Ver {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}
                </Button>
              </SheetContent>
            </Sheet>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger aria-label="Ordenar por" className="flex-1 md:w-[200px] md:flex-none h-11 bg-card border-border rounded-full text-sm">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

          </div>
        </div>

        {/* Category Chips (Quick Filter) */}
        {!loading && categories.length > 0 && (
          <div className="-mx-4 flex overflow-x-auto px-4 pb-2 mb-6 gap-2 scrollbar-hide md:mx-0 md:px-0">
            <Button
              variant={selectedCategories.length === 0 ? "default" : "outline"}
              size="sm"
              className={`h-10 rounded-full px-4 whitespace-nowrap ${selectedCategories.length === 0 ? 'bg-primary text-primary-foreground' : 'bg-card/80 border-border/15'}`}
              onClick={() => setCategories([])}
              aria-pressed={selectedCategories.length === 0}
            >
              Todos
            </Button>
            {categories.map(cat => (
              <Button
                key={cat}
                variant={selectedCategories.includes(cat) ? "default" : "outline"}
                size="sm"
                className={`h-10 rounded-full px-4 whitespace-nowrap ${selectedCategories.includes(cat) ? 'bg-primary text-primary-foreground' : 'bg-card/80 border-border/15'}`}
                onClick={() => toggleCategory(cat)}
                aria-pressed={selectedCategories.includes(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-6">
            {searchQuery && (
              <Badge variant="secondary" className="px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border-border/15 text-xs tracking-wide">
                Búsqueda: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} aria-label="Quitar búsqueda" className="ml-2 text-muted-foreground hover:text-foreground">
                  <CloseSquare className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedCategories.map(cat => (
              <Badge key={cat} variant="secondary" className="px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border-border/15 text-xs tracking-wide">
                {cat}
                <button onClick={() => toggleCategory(cat)} aria-label={`Quitar ${cat}`} className="ml-2 text-muted-foreground hover:text-foreground">
                  <CloseSquare className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
              <Badge variant="secondary" className="px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border-border/15 text-xs tracking-wide">
                ${priceRange[0]} - ${priceRange[1]}
                <button onClick={() => setPriceRange([0, maxPrice])} aria-label="Quitar filtro de precio" className="ml-2 text-muted-foreground hover:text-foreground">
                  <CloseSquare className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}



        <div className="flex gap-10">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/10">
                <h3 className="font-serif text-foreground/80 mb-6 flex items-center gap-2 text-sm tracking-wide">
                  <Filter className="h-4 w-4 text-primary" />
                  Filtros
                </h3>
                <FiltersContent />
              </div>

            </div>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {loading ? (
              <div className={`grid gap-5 grid-cols-2 lg:grid-cols-3`}>
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="aspect-[3/4] rounded-2xl skeleton-shimmer" />
                    <div className="h-3 w-3/4 rounded-full skeleton-shimmer" />
                    <div className="h-4 w-1/2 rounded-full skeleton-shimmer" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <>
                <div className={`grid gap-5 grid-cols-2 lg:grid-cols-3`}>
                  <AnimatePresence mode="popLayout">
                    {filteredProducts.slice(0, visibleCount).map((product, index) => (
                      <ProductCard key={product.id} product={product} index={index} allProducts={products} />
                    ))}
                  </AnimatePresence>
                </div>
                
                {visibleCount < filteredProducts.length && (
                  <div className="flex justify-center mt-12 mb-8">
                    <Button
                      variant="outline"
                      className="h-12 rounded-full px-8 border-border text-sm"
                      onClick={handleLoadMore}
                    >
                      Ver más ({filteredProducts.length - visibleCount} restantes)
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                <Package className="h-16 w-16 text-muted-foreground/40 mb-4" />
                <h3 className="text-xl font-serif text-foreground/80 mb-2 tracking-tight">
                  No encontramos productos
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md text-sm tracking-wide">
                  {debouncedSearch ? `Nada coincide con "${debouncedSearch}". ` : ''}Prueba con otra palabra o quita algún filtro.
                </p>
                <Button onClick={clearFilters} className="h-12 rounded-full px-8">
                  Ver todos los productos
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
