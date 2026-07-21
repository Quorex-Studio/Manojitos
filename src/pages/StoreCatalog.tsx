import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, X, Package, SlidersHorizontal, Grid3X3, LayoutList, ChevronDown } from 'lucide-react';
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

// Página del catálogo — Editorial luxury
export default function StoreCatalog() {
  // --- STATE ---
  const [searchParams, setSearchParams] = useSearchParams();
  const { products, loading, categories } = usePublicProducts();

  // Estado de filtros
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const cat = searchParams.get('category');
    return cat ? [cat] : [];
  });
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12); // Paginación simple

  // --- DERIVED / EFFECTS ---

  // Calcular rango de precios máximo
  const maxPrice = useMemo(() => {
    if (products.length === 0) return 1000;
    return Math.ceil(Math.max(...products.map(p => p.price_usd)) / 10) * 10;
  }, [products]);

  // Actualizar priceRange cuando cambien los productos
  useEffect(() => {
    setPriceRange([0, maxPrice]);
  }, [maxPrice]);

  // Sincronizar URL con los cambios de búsqueda o categoría (debounced)
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch.trim()) {
      params.search = debouncedSearch;
    }
    if (selectedCategories.length > 0) {
      params.category = selectedCategories[0];
    }
    
    const currentSearch = searchParams.get('search') || '';
    const currentCat = searchParams.get('category') || '';
    if (currentSearch !== (params.search || '') || currentCat !== (params.category || '')) {
      setSearchParams(params, { replace: true });
    }
  }, [debouncedSearch, selectedCategories, setSearchParams, searchParams]);

  // Sincronizar estado local cuando la URL cambia (ej: navegación del header o breadcrumb)
  useEffect(() => {
    const search = searchParams.get('search') || '';
    const cat = searchParams.get('category');
    const catArray = cat ? [cat] : [];

    if (search !== searchQuery) {
      setSearchQuery(search);
    }
    if (JSON.stringify(catArray) !== JSON.stringify(selectedCategories)) {
      setSelectedCategories(catArray);
    }
  }, [searchParams]);

  // Filtrar y ordenar productos
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filtrar por búsqueda
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description?.toLowerCase().includes(query)) ||
        (p.category?.toLowerCase().includes(query))
      );
    }

    // Filtrar por categorías
    if (selectedCategories.length > 0) {
      result = result.filter(p =>
        p.category && selectedCategories.includes(p.category)
      );
    }

    // Filtrar por rango de precio
    result = result.filter(p =>
      p.price_usd >= priceRange[0] && p.price_usd <= priceRange[1]
    );

    // Ordenar
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price_usd - b.price_usd);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price_usd - a.price_usd);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
      default:
        // Ya están ordenados por fecha de creación
        break;
    }

    return result;
  }, [products, debouncedSearch, selectedCategories, priceRange, sortBy]);

  // --- HANDLERS ---
  // Manejar cambio de categoría
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setPriceRange([0, maxPrice]);
    setSortBy('newest');
    setSearchParams({});
    setVisibleCount(12);
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 12);
  };

  const hasActiveFilters = searchQuery || selectedCategories.length > 0 || priceRange[0] > 0 || priceRange[1] < maxPrice;

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
                className="text-sm cursor-pointer text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                {category}
              </Label>
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
          <div className="flex items-center justify-between text-xs text-muted-foreground/50 tracking-wide">
            <span>${priceRange[0]}</span>
            <span>${priceRange[1]}</span>
          </div>
        </div>
      </div>

      {/* Limpiar filtros */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          className="w-full rounded-full border-border/20 hover:border-primary/30 text-sm"
          onClick={clearFilters}
        >
          <X className="h-3.5 w-3.5 mr-2" />
          Limpiar Filtros
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
          <nav className="flex items-center gap-2 text-xs text-muted-foreground/40 mb-5 tracking-wide">
            <Link to="/" className="hover:text-foreground transition-colors">Inicio</Link>
            <span>/</span>
            <span className="text-foreground/70">Tienda</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground tracking-tight">
                Nuestra Tienda
              </h1>
              <p className="text-muted-foreground/40 mt-2 text-sm tracking-wide">
                {loading ? 'Cargando...' : `${filteredProducts.length} productos encontrados`}
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
              onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, ''))}
              className="pl-10 h-11 bg-card/80 backdrop-blur-sm border-border/15 rounded-full text-sm focus:border-primary/30 transition-all duration-300"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          </div>

          <div className="flex items-center gap-2">
            {/* Filter button - Mobile */}
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden relative rounded-full border-border/20 h-11">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filtros
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gold rounded-full shadow-gold" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 bg-background/95 backdrop-blur-2xl border-border/10">
                <SheetHeader>
                  <SheetTitle className="font-serif tracking-tight">Filtros</SheetTitle>
                </SheetHeader>
                <div className="mt-8">
                  <FiltersContent />
                </div>
              </SheetContent>
            </Sheet>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px] h-11 bg-card/80 backdrop-blur-sm border-border/15 rounded-full text-sm">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Más recientes</SelectItem>
                <SelectItem value="price-asc">Precio: Menor a Mayor</SelectItem>
                <SelectItem value="price-desc">Precio: Mayor a Menor</SelectItem>
                <SelectItem value="name">Nombre A-Z</SelectItem>
              </SelectContent>
            </Select>

            {/* View mode - Desktop */}
            <div className="hidden md:flex items-center border border-border/15 rounded-full overflow-hidden bg-card/80 backdrop-blur-sm">
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-none h-11 w-11 ${viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground/40'}`}
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-none h-11 w-11 ${viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground/40'}`}
                onClick={() => setViewMode('list')}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Category Chips (Quick Filter) */}
        {!loading && categories.length > 0 && (
          <div className="flex overflow-x-auto pb-2 mb-6 gap-2 scrollbar-hide">
            <Button
              variant={selectedCategories.length === 0 ? "default" : "outline"}
              size="sm"
              className={`rounded-full whitespace-nowrap ${selectedCategories.length === 0 ? 'bg-primary text-primary-foreground' : 'bg-card/80 border-border/15'}`}
              onClick={() => setSelectedCategories([])}
            >
              Todos
            </Button>
            {categories.map(cat => (
              <Button
                key={cat}
                variant={selectedCategories.includes(cat) ? "default" : "outline"}
                size="sm"
                className={`rounded-full whitespace-nowrap ${selectedCategories.includes(cat) ? 'bg-primary text-primary-foreground' : 'bg-card/80 border-border/15'}`}
                onClick={() => toggleCategory(cat)}
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
                <button onClick={() => setSearchQuery('')} className="ml-2 text-muted-foreground/40 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedCategories.map(cat => (
              <Badge key={cat} variant="secondary" className="px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border-border/15 text-xs tracking-wide">
                {cat}
                <button onClick={() => toggleCategory(cat)} className="ml-2 text-muted-foreground/40 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
              <Badge variant="secondary" className="px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border-border/15 text-xs tracking-wide">
                ${priceRange[0]} - ${priceRange[1]}
                <button onClick={() => setPriceRange([0, maxPrice])} className="ml-2 text-muted-foreground/40 hover:text-foreground">
                  <X className="h-3 w-3" />
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
                  <Filter className="h-4 w-4 text-gold/60" />
                  Filtros
                </h3>
                <FiltersContent />
              </div>

            </div>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {loading ? (
              <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
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
                <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
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
                      className="rounded-full px-8 border-border/20 hover:border-primary/50 text-sm tracking-wide"
                      onClick={handleLoadMore}
                    >
                      Cargar más productos
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
                <Package className="h-20 w-20 text-muted-foreground/15 mb-4" />
                <h3 className="text-xl font-serif text-foreground/80 mb-2 tracking-tight">
                  No encontramos productos
                </h3>
                <p className="text-muted-foreground/40 mb-6 max-w-md text-sm tracking-wide">
                  Intenta con otros filtros o términos de búsqueda
                </p>
                <Button onClick={clearFilters} className="rounded-full btn-gold px-8">
                  Limpiar Filtros
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
