import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isOutOfStock, needsRestock } from '@/lib/stock';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Gallery, Plus, Search, Package, Edit2, Trash2, Calculator, DollarSign, TrendUp, ArrowRight } from 'reicon-react';
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
  const [searchParams, setSearchParams] = useSearchParams();
  // Filtros en la URL: el KPI "Stock bajo" del panel enlaza a /products?stock=bajo
  const categoryFilter = searchParams.get('categoria') || 'all';
  const stockFilter = (searchParams.get('stock') || 'todos') as 'todos' | 'bajo' | 'agotado';
  const setParam = (key: string, value: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  };
  const [sortBy, setSortBy] = useState('name_asc');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Basic product form fields
  const [form, setForm] = useState({
    name: '',
    description: '',
    price_usd: '',
    price_eur: '',
    price_bs_usd: '',
    stock: '',
    category: '',
    image_url: '',
    sizes: [] as string[],
  });

  // Cost calculator fields
  const [costCalc, setCostCalc] = useState({
    purchaseMerchUsd: '',
    purchaseShippingUsd: '',
    purchaseUnits: '',
    bsSurchargePct: '15',
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
    const merch = parseFloat(costCalc.purchaseMerchUsd) || 0;
    const shipping = parseFloat(costCalc.purchaseShippingUsd) || 0;
    const units = parseInt(costCalc.purchaseUnits) || 0;
    const surchargePct = parseFloat(costCalc.bsSurchargePct) || 15;
    
    const total = merch + shipping;

    if (units > 0 && total > 0) {
      const prices = calculatePrices(units, total);
      setCalculatedPrices(prices);

      // Auto-set price_usd from retail EUR → USD conversion, and calculate protected Bs price
      if (eurRate > 0 && usdRate > 0) {
        const priceUsd = eurToUsd(prices.priceWholesaleEur, usdRate, eurRate);
        const priceBsUsd = priceUsd * (1 + surchargePct / 100);
        // Only auto-fill form if they are empty, OR if we are actively using the calculator to drive prices
        // Since this runs when costCalc changes, we assume the user WANTS the calculator to drive prices.
        setForm(prev => ({ 
          ...prev, 
          price_usd: priceUsd.toFixed(2),
          price_eur: prices.priceWholesaleEur.toFixed(2),
          price_bs_usd: priceBsUsd.toFixed(2) 
        }));
      }

      // Auto-add stock if enabled
      if (costCalc.addToStock && !editingProduct) {
        setForm(prev => ({ ...prev, stock: String(units) }));
      }
    } else {
      setCalculatedPrices({ costPerUnit: 0, costRounded: 0, priceWholesaleEur: 0, priceRetailEur: 0, priceCreditEur: 0 });
    }
  }, [costCalc.purchaseMerchUsd, costCalc.purchaseShippingUsd, costCalc.purchaseUnits, costCalc.bsSurchargePct, pricingConfig, eurRate, usdRate, calculatePrices, costCalc.addToStock, editingProduct]);

  // --- DERIVED ---
  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = products.filter(p =>
    (!normalizedSearch ||
      p.name.toLowerCase().includes(normalizedSearch) ||
      p.category?.toLowerCase().includes(normalizedSearch)) &&
    (categoryFilter === 'all' || p.category === categoryFilter) &&
    (stockFilter === 'todos' || (stockFilter === 'agotado' ? isOutOfStock(p) : needsRestock(p)))
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
  const handlePriceUsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '').slice(0, 10);
    setForm(prev => ({ ...prev, price_usd: val }));
  };

  const handlePriceEurChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '').slice(0, 10);
    setForm(prev => ({ ...prev, price_eur: val }));
  };

  // --- REVERSE CALCULATE ON BLUR TO AVOID INFINITE LOOPS ---
  const handlePriceUsdBlur = useCallback(() => {
    if (showCalculator && usdRate > 0 && eurRate > 0) {
      const usdPrice = parseFloat(form.price_usd) || 0;
      if (usdPrice > 0) {
        const eurPrice = (usdPrice * usdRate) / eurRate;
        const multiplier = pricingConfig?.usd_to_eur_multiplier || 2;
        const targetCost = eurPrice / multiplier;
        
        const units = parseInt(costCalc.purchaseUnits) || 1;
        const shipping = parseFloat(costCalc.purchaseShippingUsd) || 0;
        const merch = (targetCost * units) - shipping;
        
        if (merch >= 0) {
          setCostCalc(prev => ({
            ...prev,
            purchaseUnits: String(units),
            purchaseMerchUsd: merch.toFixed(2),
          }));
        }
      }
    } else {
      // If calculator is closed, auto-fill EUR if it's empty
      const usdPrice = parseFloat(form.price_usd) || 0;
      if (usdPrice > 0 && !form.price_eur && usdRate > 0 && eurRate > 0) {
        const eurPrice = (usdPrice * usdRate) / eurRate;
        setForm(prev => ({ ...prev, price_eur: eurPrice.toFixed(2) }));
      }
    }
  }, [showCalculator, usdRate, eurRate, form.price_usd, form.price_eur, pricingConfig, costCalc.purchaseUnits, costCalc.purchaseShippingUsd]);

  const handlePriceEurBlur = useCallback(() => {
    if (showCalculator && usdRate > 0 && eurRate > 0) {
      const eurPrice = parseFloat(form.price_eur) || 0;
      if (eurPrice > 0) {
        const multiplier = pricingConfig?.usd_to_eur_multiplier || 2;
        const targetCost = eurPrice / multiplier;
        
        const units = parseInt(costCalc.purchaseUnits) || 1;
        const shipping = parseFloat(costCalc.purchaseShippingUsd) || 0;
        const merch = (targetCost * units) - shipping;
        
        if (merch >= 0) {
          setCostCalc(prev => ({
            ...prev,
            purchaseUnits: String(units),
            purchaseMerchUsd: merch.toFixed(2),
          }));
        }
      }
    } else {
      // If calculator is closed, auto-fill USD if it's empty
      const eurPrice = parseFloat(form.price_eur) || 0;
      if (eurPrice > 0 && !form.price_usd && eurRate > 0 && usdRate > 0) {
        const usdPrice = eurToUsd(eurPrice, usdRate, eurRate);
        setForm(prev => ({ ...prev, price_usd: usdPrice.toFixed(2) }));
      }
    }
  }, [showCalculator, usdRate, eurRate, form.price_eur, form.price_usd, pricingConfig, costCalc.purchaseUnits, costCalc.purchaseShippingUsd]);

  const handlePriceBsUsdBlur = () => {
    if (showCalculator && form.price_usd && form.price_bs_usd) {
      const usdPrice = parseFloat(form.price_usd);
      const bsUsdPrice = parseFloat(form.price_bs_usd);
      if (usdPrice > 0 && bsUsdPrice >= usdPrice) {
        const derivedSurcharge = Math.round(((bsUsdPrice / usdPrice) - 1) * 100);
        setCostCalc(prev => ({
          ...prev,
          bsSurchargePct: derivedSurcharge.toString()
        }));
      }
    }
  };

  // --- REVERSE CALCULATE ONCE WHEN CALCULATOR OPENS ---
  const hasReversed = useRef(false);
  useEffect(() => {
    if (showCalculator && !hasReversed.current && usdRate > 0 && eurRate > 0) {
      hasReversed.current = true;
      const usdPrice = parseFloat(form.price_usd) || 0;
      const eurPrice = parseFloat(form.price_eur) || 0;
      const merchStr = costCalc.purchaseMerchUsd.trim();
      if ((usdPrice > 0 || eurPrice > 0) && merchStr === '') {
        if (eurPrice > 0) {
          handlePriceEurBlur();
        } else {
          handlePriceUsdBlur();
        }
      }
    }
    if (!showCalculator) {
      hasReversed.current = false;
    }
  }, [showCalculator, costCalc.purchaseMerchUsd, eurRate, form.price_eur, form.price_usd, handlePriceEurBlur, handlePriceUsdBlur, usdRate]);

  const resetForm = () => {
    setForm({ name: '', description: '', price_usd: '', price_eur: '', price_bs_usd: '', stock: '', category: '', image_url: '', sizes: [] });
    setCostCalc({ purchaseMerchUsd: '', purchaseShippingUsd: '', purchaseUnits: '', bsSurchargePct: '15', addToStock: true });
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
      price_eur: product.price_wholesale_eur ? String(product.price_wholesale_eur) : (eurRate > 0 && usdRate > 0 ? String(((product.price_usd * usdRate) / eurRate).toFixed(2)) : ''),
      price_bs_usd: product.price_bs_usd !== null && product.price_bs_usd !== undefined ? String(product.price_bs_usd) : '',
      stock: String(product.stock),
      category: product.category || '',
      image_url: product.image_url || '',
      sizes: product.sizes || []
    });

    // If product has cost data, populate the calculator
    if (product.cost_usd && product.cost_usd > 0) {
      setShowCalculator(true);
      
      let derivedSurcharge = '15';
      if (product.price_bs_usd && product.price_usd && product.price_usd > 0) {
        derivedSurcharge = Math.round(((product.price_bs_usd / product.price_usd) - 1) * 100).toString();
      }
      
      setCostCalc(prev => ({
        ...prev,
        purchaseUnits: String(product.stock), // Estimate based on current stock
        bsSurchargePct: derivedSurcharge
      }));

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
      price_bs_usd: form.price_bs_usd ? Number(form.price_bs_usd) : null,
      cost_usd: calculatedPrices.costRounded || calculatedPrices.costPerUnit || 0,
      price_wholesale_eur: Number(form.price_eur) || calculatedPrices.priceWholesaleEur || 0,
      price_retail_eur: Number(form.price_eur) 
        ? Number(form.price_eur) * (1 + (pricingConfig?.retail_markup_pct ?? 15) / 100) 
        : (calculatedPrices.priceRetailEur || 0),
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

  const handleDelete = (product: Product) => setDeleteTarget(product);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteProduct(deleteTarget.id);
    setDeleteTarget(null);
  };
  const restockCount = products.filter(needsRestock).length;
  const outCount = products.filter(isOutOfStock).length;

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
              <Button className="h-11 w-full gap-2 rounded-full sm:w-auto">
                <Plus className="h-5 w-5" />
                Nuevo producto
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
                    onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s&%+.,'/()-]/g, '').slice(0, 100) })}
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
                                <Label className="text-xs">Costo Mercancía ($)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={costCalc.purchaseMerchUsd}
                                  onChange={e => setCostCalc(prev => ({ ...prev, purchaseMerchUsd: e.target.value.replace(/[^0-9.]/g, '').slice(0, 10) }))}
                                  placeholder="Ej: 200"
                                  className="input-glass rounded-lg text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Costo Envío ($)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={costCalc.purchaseShippingUsd}
                                  onChange={e => setCostCalc(prev => ({ ...prev, purchaseShippingUsd: e.target.value.replace(/[^0-9.]/g, '').slice(0, 10) }))}
                                  placeholder="Ej: 33"
                                  className="input-glass rounded-lg text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Unidades compradas</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={costCalc.purchaseUnits}
                                  onChange={e => setCostCalc(prev => ({ ...prev, purchaseUnits: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) }))}
                                  placeholder="Ej: 50"
                                  className="input-glass rounded-lg text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Margen extra pago Bs (%)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={costCalc.bsSurchargePct}
                                  onChange={e => setCostCalc(prev => ({ ...prev, bsSurchargePct: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) }))}
                                  placeholder="Ej: 15"
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
                                  <span className="text-muted-foreground">Costo de Mercancía + Envío:</span>
                                  <span className="font-medium text-right">{formatUsd((parseFloat(costCalc.purchaseMerchUsd) || 0) + (parseFloat(costCalc.purchaseShippingUsd) || 0))}</span>

                                  <span className="text-muted-foreground">Costo unitario real:</span>
                                  <span className="font-medium text-right">{formatUsd(calculatedPrices.costPerUnit)}</span>

                                  <span className="text-muted-foreground">Costo redondeado ({pricingConfig.rounding_mode}):</span>
                                  <span className="font-bold text-right text-primary">{formatUsd(calculatedPrices.costRounded)}</span>

                                  <span className="text-muted-foreground">× {pricingConfig.usd_to_eur_multiplier} (factor EUR):</span>
                                  <span className="font-medium text-right">{formatEur(calculatedPrices.priceWholesaleEur)}</span>

                                </div>
                              </div>

                              {/* Tabla de precios de venta */}
                              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-3 space-y-2">
                                <p className="text-xs text-primary font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                  <TrendUp className="h-3.5 w-3.5" />
                                  Precios de Venta Calculados
                                </p>

                                <div className="space-y-1.5">
                                  {/* Base */}
                                  <div className="flex items-center justify-between py-1.5 border-b border-border/20">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Precio Venta (Base)</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="font-bold text-gradient-gold">{formatEur(calculatedPrices.priceWholesaleEur)}</span>
                                      {usdRate > 0 && eurRate > 0 && (
                                        <>
                                          <span className="text-muted-foreground">≈ {formatUsd(eurToUsd(calculatedPrices.priceWholesaleEur, usdRate, eurRate))}</span>
                                          <span className="text-muted-foreground text-xs">{formatBS(calculatedPrices.priceWholesaleEur * eurRate)}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Equivalente en Bs (Precio Protegido) */}
                                  {usdRate > 0 && eurRate > 0 && (
                                    <div className="flex items-center justify-between py-1.5 border-b border-border/20 bg-primary/10 rounded px-2 -mx-2">
                                      <div>
                                        <p className="text-xs font-semibold text-primary">Si pagan en Bs</p>
                                        <p className="text-[10px] text-muted-foreground">Base USD protegida (+{costCalc.bsSurchargePct}%)</p>
                                      </div>
                                      <div className="flex items-center gap-3 text-sm">
                                        <span className="font-bold text-primary">
                                          {formatUsd(eurToUsd(calculatedPrices.priceWholesaleEur, usdRate, eurRate) * (1 + (parseFloat(costCalc.bsSurchargePct) || 15) / 100))}
                                        </span>
                                      </div>
                                    </div>
                                  )}

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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Precio Venta (USD) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price_usd}
                      onChange={handlePriceUsdChange}
                      onBlur={handlePriceUsdBlur}
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
                    <Label>Precio Venta (EUR)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price_eur}
                      onChange={handlePriceEurChange}
                      onBlur={handlePriceEurBlur}
                      placeholder="0.00"
                      className="input-glass rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Precio Bolívares (USD)*</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price_bs_usd}
                      onChange={(e) => setForm({ ...form, price_bs_usd: e.target.value.replace(/[^0-9.]/g, '').slice(0, 10) })}
                      onBlur={handlePriceBsUsdBlur}
                      placeholder="Ej: 13.00"
                      className="input-glass rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">
                      Monto base en USD al pagar en Bs (Opcional)
                    </p>
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

                {/* ── DESGLOSE (MANUAL O SI CALCULADORA NO TIENE COSTOS) ── */}
                {(!showCalculator || calculatedPrices.costPerUnit === 0) && (Number(form.price_usd) > 0 || Number(form.price_bs_usd) > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-3 space-y-2"
                  >
                    <p className="text-xs text-primary font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <TrendUp className="h-3.5 w-3.5" />
                      Precios de Venta Calculados (Manual)
                    </p>

                    <div className="space-y-1.5">
                      {/* Base */}
                      {Number(form.price_usd) > 0 && (
                        <div className="flex items-center justify-between py-1.5 border-b border-border/20">
                          <div>
                            <p className="text-xs text-muted-foreground">Precio Venta (Base)</p>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            {usdRate > 0 && eurRate > 0 && (
                              <>
                                <span className="font-bold text-gradient-gold">
                                  {formatEur((Number(form.price_usd) * usdRate) / eurRate)}
                                </span>
                                <span className="text-muted-foreground">≈ {formatUsd(Number(form.price_usd))}</span>
                                <span className="text-muted-foreground text-xs">{formatBS(Number(form.price_usd) * usdRate)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Equivalente en Bs (Precio Protegido) */}
                      {Number(form.price_bs_usd) > 0 && (
                        <div className="flex items-center justify-between py-1.5 border-b border-border/20 bg-primary/10 rounded px-2 -mx-2">
                          <div>
                            <p className="text-xs font-semibold text-primary">Si pagan en Bs</p>
                            {Number(form.price_usd) > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                Margen manual: {Math.round((Number(form.price_bs_usd) / Number(form.price_usd) - 1) * 100)}%
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-bold text-primary">
                              {formatUsd(Number(form.price_bs_usd))}
                            </span>
                            {usdRate > 0 && (
                              <span className="text-muted-foreground text-xs">{formatBS(Number(form.price_bs_usd) * usdRate)}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Crédito */}
                      {Number(form.price_usd) > 0 && (
                        <div className="flex items-center justify-between py-1.5">
                          <div>
                            <p className="text-xs text-muted-foreground">Precio Crédito (+{pricingConfig.credit_surcharge_pct}%)</p>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            {usdRate > 0 && eurRate > 0 && (
                              <>
                                <span className="font-bold text-amber-500">
                                  {formatEur(((Number(form.price_usd) * usdRate) / eurRate) * (1 + pricingConfig.credit_surcharge_pct / 100))}
                                </span>
                                <span className="text-muted-foreground">≈ {formatUsd(Number(form.price_usd) * (1 + pricingConfig.credit_surcharge_pct / 100))}</span>
                                <span className="text-muted-foreground text-xs">
                                  {formatBS(Number(form.price_usd) * (1 + pricingConfig.credit_surcharge_pct / 100) * usdRate)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

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

        {/* Filtros: búsqueda, estado de stock (chips), categoría y orden */}
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o categoría"
                aria-label="Buscar productos"
                className="h-11 rounded-full pl-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Select value={categoryFilter} onValueChange={(val) => setParam('categoria', val === 'all' ? null : val)}>
                <SelectTrigger aria-label="Categoría" className="h-11 rounded-full sm:w-48">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {existingCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger aria-label="Ordenar" className="h-11 rounded-full sm:w-48">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name_asc">Nombre A-Z</SelectItem>
                  <SelectItem value="name_desc">Nombre Z-A</SelectItem>
                  <SelectItem value="stock_asc">Menos stock</SelectItem>
                  <SelectItem value="stock_desc">Más stock</SelectItem>
                  <SelectItem value="price_asc">Menor precio</SelectItem>
                  <SelectItem value="price_desc">Mayor precio</SelectItem>
                  <SelectItem value="sales_desc">Más vendidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:px-0" role="group" aria-label="Filtrar por stock">
            {([
              { value: 'todos', label: `Todos (${products.length})` },
              { value: 'bajo', label: `Por reponer (${restockCount})` },
              { value: 'agotado', label: `Agotados (${outCount})` },
            ] as const).map(chip => (
              <button
                key={chip.value}
                type="button"
                onClick={() => setParam('stock', chip.value === 'todos' ? null : chip.value)}
                aria-pressed={stockFilter === chip.value}
                className={`h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
                  stockFilter === chip.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary/50'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista: filas compactas en móvil, tarjetas en escritorio. Acciones siempre visibles (no hover). */}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4">
          {paginatedProducts.map((product) => {
            const out = isOutOfStock(product);
            const low = !out && needsRestock(product);
            const retail = Number(product.price_retail_eur || 0);
            const wholesale = Number(product.price_wholesale_eur || 0);
            const cost = Number(product.cost_usd || 0);
            return (
              <li
                key={product.id}
                className="flex gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-col sm:gap-0 sm:overflow-hidden sm:p-0"
              >
                <button
                  type="button"
                  onClick={() => handleEdit(product)}
                  aria-label={`Editar ${product.name}`}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-studio sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none"
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <Gallery className="h-8 w-8 text-muted-foreground/40" />
                    </span>
                  )}
                  {(out || low) && (
                    <span className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:left-3 sm:top-3 sm:text-xs ${out ? 'bg-sale text-white' : 'bg-background text-sale'}`}>
                      {out ? 'Agotado' : 'Por reponer'}
                    </span>
                  )}
                </button>

                <div className="flex min-w-0 flex-1 flex-col sm:p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{product.category || 'Sin categoría'}</p>
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">{product.name}</h3>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-base font-bold tabular-nums text-foreground">${Number(product.price_usd).toFixed(2)}</span>
                    {usdRate > 0 && <span className="text-xs tabular-nums text-muted-foreground">{formatBS(convertToBS(Number(product.price_usd)))}</span>}
                  </div>
                  {(retail > 0 || wholesale > 0) && (
                    <p className="text-xs text-muted-foreground">
                      {retail > 0 && <>€{retail.toFixed(2)} detal</>}
                      {retail > 0 && wholesale > 0 && ' · '}
                      {wholesale > 0 && <>€{wholesale.toFixed(2)} mayor</>}
                    </p>
                  )}
                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <p className="text-xs text-muted-foreground">
                      <span className={`font-semibold ${out || low ? 'text-sale' : 'text-foreground'}`}>{product.stock} uds</span>
                      {' · '}{product.sold_count || 0} vendidos
                      {cost > 0 && <span className="hidden sm:inline"> · costo ${cost.toFixed(2)}</span>}
                    </p>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(product)} aria-label={`Editar ${product.name}`} className="h-9 w-9 rounded-full">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(product)} aria-label={`Eliminar ${product.name}`} className="h-9 w-9 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {paginatedProducts.length === 0 && !loading && (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-border py-14 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-studio">
              <Package className="h-7 w-7 text-muted-foreground" />
            </span>
            <p className="font-serif text-lg text-foreground">
              {products.length === 0 ? 'Aún no hay productos' : 'Ningún producto coincide'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length === 0 ? 'Crea el primero o impórtalos desde Excel.' : 'Prueba con otra búsqueda o quita los filtros.'}
            </p>
            {products.length > 0 && (search || categoryFilter !== 'all' || stockFilter !== 'todos') && (
              <Button variant="outline" className="mt-4 rounded-full" onClick={() => { setSearch(''); setSearchParams({}, { replace: true }); }}>
                Quitar filtros
              </Button>
            )}
          </div>
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este producto?</AlertDialogTitle>
              <AlertDialogDescription>
                «{deleteTarget?.name}» dejará de verse en la tienda. Las ventas ya registradas no se modifican.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
