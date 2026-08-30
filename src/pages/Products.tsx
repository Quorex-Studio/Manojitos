import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gallery, Plus, Search, Package, Edit2, Trash2, AlertTriangle, Calculator, DollarSign, TrendUp, ArrowRight } from 'reicon-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProducts, Product } from '@/hooks/useProducts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { usePricingConfig } from '@/hooks/usePricingConfig';
import { useClientPagination } from '@/hooks/useClientPagination';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatBS } from '@/lib/utils';

// ── Pricing helper ──
function eurToUsd(eur: number, usdRate: number, eurRate: number): number {
  if (!usdRate || !eurRate) return 0;
  const bs = eur * eurRate;
  return Math.round((bs / usdRate) * 100) / 100;
}

export default function Products() {
  // --- STATE ---
  const { products, loading, addProduct, updateProduct, deleteProduct } = useProducts();
  const { rate: usdRate, rates, convertToBS } = useExchangeRate();
  const eurRate = rates?.EUR?.rate ?? 0;
  const { config: pricingConfig, calculatePrices } = usePricingConfig();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Basic product form fields
  const [form, setForm] = useState({
    name: '',
    description: '',
    price_usd: '',
    stock: '',
    category: '',
    image_url: '',
    sizes: [] as string[],
  });

  // Cost calculator fields
  const [costCalc, setCostCalc] = useState({
    purchaseUnits: '',
    purchaseTotalUsd: '',
    addToStock: true,
  });

  // Calculated prices (derived from cost calculator or manual)
  const [calculatedPrices, setCalculatedPrices] = useState({
    costPerUnit: 0,
    costRounded: 0,
    priceWholesaleEur: 0,
    priceRetailEur: 0,
    priceCreditEur: 0,
  });

  const [showCalculator, setShowCalculator] = useState(false);

  // --- Recalculate prices when cost fields change ---
  useEffect(() => {
    const units = parseInt(costCalc.purchaseUnits) || 0;
    const total = parseFloat(costCalc.purchaseTotalUsd) || 0;

    if (units > 0 && total > 0) {
      const prices = calculatePrices(units, total);
      setCalculatedPrices(prices);

      // Auto-set price_usd from retail EUR → USD conversion
      if (eurRate > 0 && usdRate > 0) {
        const priceUsd = eurToUsd(prices.priceRetailEur, usdRate, eurRate);
        setForm(prev => ({ ...prev, price_usd: priceUsd.toFixed(2) }));
      }

      // Auto-add stock if enabled
      if (costCalc.addToStock && !editingProduct) {
        setForm(prev => ({ ...prev, stock: String(units) }));
      }
    } else {
      setCalculatedPrices({ costPerUnit: 0, costRounded: 0, priceWholesaleEur: 0, priceRetailEur: 0, priceCreditEur: 0 });
    }
  }, [costCalc.purchaseUnits, costCalc.purchaseTotalUsd, pricingConfig, eurRate, usdRate]);

  // --- DERIVED ---
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    switch (sortBy) {
      case 'name_asc': return a.name.localeCompare(b.name);
      case 'name_desc': return b.name.localeCompare(a.name);
      case 'stock_asc': return a.stock - b.stock;
      case 'stock_desc': return b.stock - a.stock;
      case 'price_asc': return Number(a.price_usd) - Number(b.price_usd);
      case 'price_desc': return Number(b.price_usd) - Number(a.price_usd);
      case 'sales_desc': return (b.sold_count || 0) - (a.sold_count || 0);
      default: return 0;
    }
  });

  const existingCategories = [...new Set(
    products
      .map(p => p.category)
      .filter((c): c is string => c !== null && c.trim() !== '')
  )];

  // Paginación
  const {
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    paginatedData: paginatedProducts,
    setCurrentPage,
    setPageSize,
  } = useClientPagination(filteredProducts, { pageSize: 10 });

  // --- HANDLERS ---
  const resetForm = () => {
    setForm({ name: '', description: '', price_usd: '', stock: '', category: '', image_url: '', sizes: [] });
    setCostCalc({ purchaseUnits: '', purchaseTotalUsd: '', addToStock: true });
    setCalculatedPrices({ costPerUnit: 0, costRounded: 0, priceWholesaleEur: 0, priceRetailEur: 0, priceCreditEur: 0 });
    setShowCalculator(false);
    setEditingProduct(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      price_usd: String(product.price_usd),
      stock: String(product.stock),
      category: product.category || '',
      image_url: product.image_url || '',
      sizes: product.sizes || []
    });

    // If product has cost data, populate the calculator
    if (product.cost_usd && product.cost_usd > 0) {
      setShowCalculator(true);
      setCalculatedPrices({
        costPerUnit: product.cost_usd,
        costRounded: Math.ceil(product.cost_usd),
        priceWholesaleEur: product.price_wholesale_eur || 0,
        priceRetailEur: product.price_retail_eur || 0,
        priceCreditEur: product.price_retail_eur
          ? Math.round(product.price_retail_eur * (1 + (pricingConfig?.credit_surcharge_pct || 10) / 100) * 100) / 100
          : 0,
      });
    }

    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { sanitizeText } = await import('@/lib/validations');
    const productData = {
      name: sanitizeText(form.name),
      description: form.description ? sanitizeText(form.description) : null,
      price_usd: Number(form.price_usd),
      cost_usd: calculatedPrices.costRounded || calculatedPrices.costPerUnit || 0,
      price_wholesale_eur: calculatedPrices.priceWholesaleEur || 0,
      price_retail_eur: calculatedPrices.priceRetailEur || 0,
      stock: Number(form.stock),
      category: form.category ? sanitizeText(form.category) : null,
      image_url: form.image_url ? sanitizeText(form.image_url) : null,
      sizes: form.sizes.length > 0 ? form.sizes : null
    };

    if (editingProduct) {
      // If editing and addToStock is true and there are new units, add them
      if (costCalc.addToStock && costCalc.purchaseUnits && parseInt(costCalc.purchaseUnits) > 0) {
        productData.stock = editingProduct.stock + parseInt(costCalc.purchaseUnits);
      }
      await updateProduct({ id: editingProduct.id, updates: productData });
    } else {
      await addProduct(productData);
    }

    handleOpenChange(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás segura de eliminar este producto?')) {
      await deleteProduct(id);
    }
  };

  // --- Price display helpers ---
  const formatEur = (n: number) => `€${n.toFixed(2)}`;
  const formatUsd = (n: number) => `$${n.toFixed(2)}`;

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-header">Productos</h1>
            <p className="page-subtitle">{products.length} productos registrados</p>
          </div>

          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button className="btn-gold rounded-xl gap-2">
                <Plus className="h-5 w-5" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto glass-card border-border/50 max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                {/* ── DATOS BÁSICOS ── */}
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]/g, '').slice(0, 100) })}
                    placeholder="Nombre del producto"
                    className="input-glass rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s.,()-]/g, '').slice(0, 255) })}
                    placeholder="Descripción opcional"
                    className="input-glass rounded-xl resize-none"
                    rows={2}
                  />
                </div>

                {/* ── CALCULADOR DE COSTOS ── */}
                <div className="border border-primary/30 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowCalculator(!showCalculator)}
                    className="w-full flex items-center justify-between p-3 bg-primary/5 hover:bg-primary/10 transition-colors"
                  >
                    <span className="flex items-center gap-2 font-semibold text-primary text-sm">
                      <Calculator className="h-4 w-4" />
                      Calculador de Costos y Precios
                    </span>
                    <motion.span
                      animate={{ rotate: showCalculator ? 180 : 0 }}
                      className="text-primary"
                    >
                      ▼
                    </motion.span>
                  </button>

                  <AnimatePresence>
                    {showCalculator && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-4 border-t border-primary/20">
                          {/* Datos de Compra */}
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                              Datos de la Factura al Mayor
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Unidades compradas</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={costCalc.purchaseUnits}
                                  onChange={e => setCostCalc(prev => ({ ...prev, purchaseUnits: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) }))}
                                  placeholder="Ej: 12"
                                  className="input-glass rounded-lg text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Total pagado (USD)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={costCalc.purchaseTotalUsd}
                                  onChange={e => setCostCalc(prev => ({ ...prev, purchaseTotalUsd: e.target.value.replace(/[^0-9.]/g, '').slice(0, 10) }))}
                                  placeholder="Ej: 36.00"
                                  className="input-glass rounded-lg text-sm"
                                />
                              </div>
                            </div>

                            {editingProduct && (
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={costCalc.addToStock}
                                  onChange={e => setCostCalc(prev => ({ ...prev, addToStock: e.target.checked }))}
                                  className="rounded border-border"
                                />
                                <span className="text-muted-foreground">Sumar unidades al stock actual ({editingProduct.stock} uds)</span>
                              </label>
                            )}
                          </div>

                          {/* Resultado de cálculos */}
                          {calculatedPrices.costPerUnit > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-3"
                            >
                              {/* Desglose de cálculo */}
                              <div className="bg-secondary/60 rounded-lg p-3 space-y-2">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                  Desglose del Cálculo
                                </p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                  <span className="text-muted-foreground">Costo unitario real:</span>
                                  <span className="font-medium text-right">{formatUsd(calculatedPrices.costPerUnit)}</span>

                                  <span className="text-muted-foreground">Costo redondeado ({pricingConfig.rounding_mode}):</span>
                                  <span className="font-bold text-right text-primary">{formatUsd(calculatedPrices.costRounded)}</span>

                                  <span className="text-muted-foreground">× {pricingConfig.usd_to_eur_multiplier} (factor EUR):</span>
                                  <span className="font-medium text-right">{formatEur(calculatedPrices.priceWholesaleEur)}</span>

                                  <span className="text-muted-foreground">+ {pricingConfig.retail_markup_pct}% detal:</span>
                                  <span className="font-medium text-right">{formatEur(calculatedPrices.priceRetailEur)}</span>
                                </div>
                              </div>

                              {/* Tabla de precios de venta */}
                              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-3 space-y-2">
                                <p className="text-xs text-primary font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                  <TrendUp className="h-3.5 w-3.5" />
                                  Precios de Venta Calculados
                                </p>

                                <div className="space-y-1.5">
                                  {/* Mayor */}
                                  <div className="flex items-center justify-between py-1.5 border-b border-border/20">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Precio Mayor</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="font-bold text-primary">{formatEur(calculatedPrices.priceWholesaleEur)}</span>
                                      {usdRate > 0 && eurRate > 0 && (
                                        <>
                                          <span className="text-muted-foreground">≈ {formatUsd(eurToUsd(calculatedPrices.priceWholesaleEur, usdRate, eurRate))}</span>
                                          <span className="text-muted-foreground text-xs">{formatBS(calculatedPrices.priceWholesaleEur * eurRate)}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Detal */}
                                  <div className="flex items-center justify-between py-1.5 border-b border-border/20">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Precio Detal</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="font-bold text-gradient-gold">{formatEur(calculatedPrices.priceRetailEur)}</span>
                                      {usdRate > 0 && eurRate > 0 && (
                                        <>
                                          <span className="text-muted-foreground">≈ {formatUsd(eurToUsd(calculatedPrices.priceRetailEur, usdRate, eurRate))}</span>
                                          <span className="text-muted-foreground text-xs">{formatBS(calculatedPrices.priceRetailEur * eurRate)}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Crédito */}
                                  <div className="flex items-center justify-between py-1.5">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Precio Crédito (+{pricingConfig.credit_surcharge_pct}%)</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="font-bold text-amber-500">{formatEur(calculatedPrices.priceCreditEur)}</span>
                                      {usdRate > 0 && eurRate > 0 && (
                                        <>
                                          <span className="text-muted-foreground">≈ {formatUsd(eurToUsd(calculatedPrices.priceCreditEur, usdRate, eurRate))}</span>
                                          <span className="text-muted-foreground text-xs">{formatBS(calculatedPrices.priceCreditEur * eurRate)}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Costo real */}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 rounded-lg p-2 border border-border/30">
                                <DollarSign className="h-3.5 w-3.5" />
                                <span>Costo real por producto: <strong className="text-foreground">{formatUsd(calculatedPrices.costPerUnit)}</strong></span>
                                {usdRate > 0 && (
                                  <span className="ml-auto">{formatBS(calculatedPrices.costPerUnit * usdRate)}</span>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── PRECIO Y STOCK ── */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Precio Venta (USD) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price_usd}
                      onChange={(e) => setForm({ ...form, price_usd: e.target.value.replace(/[^0-9.]/g, '').slice(0, 10) })}
                      placeholder="0.00"
                      className="input-glass rounded-xl"
                      required
                    />
                    {showCalculator && calculatedPrices.priceRetailEur > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Auto-calculado desde Detal EUR
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Stock *</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })}
                      placeholder="0"
                      className="input-glass rounded-xl"
                      required
                    />
                    {showCalculator && costCalc.addToStock && editingProduct && costCalc.purchaseUnits && (
                      <p className="text-xs text-muted-foreground">
                        Se sumarán +{costCalc.purchaseUnits} al stock actual
                      </p>
                    )}
                  </div>
                </div>

                {/* ── CATEGORÍA, IMAGEN, TALLAS ── */}
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Input
                    list="categories-list"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').slice(0, 50) })}
                    placeholder="Ej: Accesorios, Ropa..."
                    className="input-glass rounded-xl"
                  />
                  <datalist id="categories-list">
                    {existingCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>URL de imagen</Label>
                  <Input
                    type="url"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://..."
                    className="input-glass rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tallas disponibles</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['Única', 'S', 'M', 'L', 'XL'] as const).map((size) => {
                      const isUnique = size === 'Única';
                      const hasOtherSizes = form.sizes.some(s => s !== 'Única');
                      const isSelected = form.sizes.includes(size);
                      const isDisabled = isUnique ? hasOtherSizes : form.sizes.includes('Única');
                      return (
                        <button
                          key={size}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            if (isSelected) {
                              setForm({ ...form, sizes: form.sizes.filter(s => s !== size) });
                            } else {
                              const newSizes = isUnique ? ['Única'] : form.sizes.filter(s => s !== 'Única').concat(size);
                              setForm({ ...form, sizes: newSizes });
                            }
                          }}
                          className={[
                            'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card/80 border-border/40 text-muted-foreground hover:border-primary/50',
                            isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                          ].join(' ')}
                        >
                          {size === 'Única' ? 'Talla Única' : size}
                        </button>
                      );
                    })}
                  </div>
                  {form.sizes.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin tallas (aplica para todos)</p>
                  )}
                </div>

                <Button type="submit" className="w-full btn-gold rounded-xl">
                  {editingProduct ? 'Actualizar' : 'Crear Producto'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar productos..."
              className="pl-10 input-glass rounded-xl"
            />
          </div>
          
          <Select 
            value={search} 
            onValueChange={(val) => setSearch(val === 'all' ? '' : val)}
          >
            <SelectTrigger className="w-full sm:w-48 input-glass rounded-xl">
              <SelectValue placeholder="Filtrar por categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {existingCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={sortBy} 
            onValueChange={setSortBy}
          >
            <SelectTrigger className="w-full sm:w-48 input-glass rounded-xl">
              <SelectValue placeholder="Ordenar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">A - Z</SelectItem>
              <SelectItem value="name_desc">Z - A</SelectItem>
              <SelectItem value="stock_asc">Menor Stock</SelectItem>
              <SelectItem value="stock_desc">Mayor Stock</SelectItem>
              <SelectItem value="price_asc">Menor Precio</SelectItem>
              <SelectItem value="price_desc">Mayor Precio</SelectItem>
              <SelectItem value="sales_desc">Más Vendidos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {paginatedProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                layout
              >
                <Card className="glass-card border-border/50 overflow-hidden hover-lift group">
                  {/* Image */}
                  <div className="aspect-square bg-secondary relative overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gallery className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
                    {product.stock <= 5 && (
                      <Badge
                        variant="destructive"
                        className="absolute top-2 right-2 gap-1"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Stock bajo
                      </Badge>
                    )}
                    {/* Actions overlay */}
                    <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => handleEdit(product)}
                        className="rounded-full"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDelete(product.id)}
                        className="rounded-full"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {product.category && (
                        <Badge variant="secondary" className="text-xs">
                          {product.category}
                        </Badge>
                      )}
                      <h3 className="font-semibold text-foreground line-clamp-1">{product.name}</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-gradient-gold">
                            ${Number(product.price_usd).toFixed(2)}
                          </p>
                          {/* Show EUR prices if available */}
                          {product.price_retail_eur > 0 && (
                            <p className="text-xs text-primary font-medium">
                              €{product.price_retail_eur.toFixed(2)} detal
                            </p>
                          )}
                          {product.price_wholesale_eur > 0 && (
                            <p className="text-xs text-muted-foreground">
                              €{product.price_wholesale_eur.toFixed(2)} mayor
                            </p>
                          )}
                          {usdRate > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {formatBS(convertToBS(Number(product.price_usd)))}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{product.stock} uds</p>
                          <p className="text-xs text-muted-foreground">{product.sold_count} vendidos</p>
                          {product.cost_usd > 0 && (
                            <p className="text-xs text-muted-foreground/70">
                              Costo: ${product.cost_usd.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {paginatedProducts.length === 0 && !loading && (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No hay productos que mostrar</p>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          className="mt-6"
        />
      </div>
    </AppLayout>
  );
}
