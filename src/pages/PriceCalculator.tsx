import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calculator, 
  Copy, 
  Download, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw,
  TrendingUp,
  DollarSign,
  Banknote,
  History,
  Settings2,
  Check,
  AlertCircle,
  Clipboard,
  LineChart
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Tipos
interface ProductCalculation {
  id: string;
  name: string;
  costUSD: number;
  priceEfectivo: number;
  priceBS: number;
  profitEfectivo: number;
  profitBS: number;
}

interface CalculationHistory {
  id: string;
  date: Date;
  costUSD: number;
  paymentType: 'efectivo' | 'bs';
  extraPercentage: number;
  bcvRate: number;
  finalPrice: number;
}

interface Preset {
  id: string;
  name: string;
  extraPercentage: number;
  efectivoMultiplier: number;
  bsMultiplier: number;
}

// Presets por defecto
const DEFAULT_PRESETS: Preset[] = [
  { id: '1', name: 'Estándar', extraPercentage: 10.7, efectivoMultiplier: 3, bsMultiplier: 5 },
  { id: '2', name: 'Margen Alto', extraPercentage: 15, efectivoMultiplier: 3.5, bsMultiplier: 5.5 },
  { id: '3', name: 'Competitivo', extraPercentage: 8, efectivoMultiplier: 2.5, bsMultiplier: 4.5 },
];

export default function PriceCalculator() {
  const { rate, loading: rateLoading, lastUpdate, refetch: refetchRate, autoFetching } = useExchangeRate();
  const { products, updateProduct } = useProducts();
  const { isAdmin } = useAuth();

  // Estado principal
  const [costUSD, setCostUSD] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'efectivo' | 'bs'>('efectivo');
  const [extraPercentage, setExtraPercentage] = useState<number>(10.7);
  const [efectivoMultiplier, setEfectivoMultiplier] = useState<number>(3);
  const [bsMultiplier, setBsMultiplier] = useState<number>(5);

  // Estado para batch
  const [batchProducts, setBatchProducts] = useState<ProductCalculation[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCost, setNewProductCost] = useState('');

  // Historial y presets
  const [history, setHistory] = useState<CalculationHistory[]>([]);
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [selectedPreset, setSelectedPreset] = useState<string>('1');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Simulación de escenarios
  const [showScenarios, setShowScenarios] = useState(false);
  const [minRate, setMinRate] = useState<number>(0);
  const [maxRate, setMaxRate] = useState<number>(0);

  // Validaciones
  const costNumber = parseFloat(costUSD) || 0;
  const isValidCost = costNumber > 0;
  const isValidRate = rate > 0;
  const isValidPercentage = extraPercentage >= 0 && extraPercentage <= 100;

  // Cálculos
  const priceEfectivo = useMemo(() => {
    if (!isValidCost) return 0;
    return costNumber * efectivoMultiplier;
  }, [costNumber, efectivoMultiplier, isValidCost]);

  const priceBS = useMemo(() => {
    if (!isValidCost || !isValidRate) return 0;
    return (costNumber * bsMultiplier * rate) * (1 + extraPercentage / 100);
  }, [costNumber, bsMultiplier, rate, extraPercentage, isValidCost, isValidRate]);

  const profitEfectivo = useMemo(() => {
    if (!isValidCost) return 0;
    return priceEfectivo - costNumber;
  }, [priceEfectivo, costNumber, isValidCost]);

  const profitBS = useMemo(() => {
    if (!isValidCost || !isValidRate) return 0;
    return (priceBS / rate) - costNumber;
  }, [priceBS, rate, costNumber, isValidCost, isValidRate]);

  const profitMarginEfectivo = useMemo(() => {
    if (!isValidCost || priceEfectivo === 0) return 0;
    return ((profitEfectivo / costNumber) * 100);
  }, [profitEfectivo, costNumber, priceEfectivo, isValidCost]);

  const profitMarginBS = useMemo(() => {
    if (!isValidCost || !isValidRate) return 0;
    return ((profitBS / costNumber) * 100);
  }, [profitBS, costNumber, isValidCost, isValidRate]);

  // Cargar preset
  useEffect(() => {
    const preset = presets.find(p => p.id === selectedPreset);
    if (preset) {
      setExtraPercentage(preset.extraPercentage);
      setEfectivoMultiplier(preset.efectivoMultiplier);
      setBsMultiplier(preset.bsMultiplier);
    }
  }, [selectedPreset, presets]);

  // Escenarios de tasa
  useEffect(() => {
    if (rate > 0) {
      setMinRate(rate * 0.95);
      setMaxRate(rate * 1.05);
    }
  }, [rate]);

  // Agregar producto al batch
  const addToBatch = () => {
    if (!newProductCost || parseFloat(newProductCost) <= 0) {
      toast({ title: 'Error', description: 'Ingresa un costo válido', variant: 'destructive' });
      return;
    }

    const cost = parseFloat(newProductCost);
    const newProduct: ProductCalculation = {
      id: crypto.randomUUID(),
      name: newProductName || `Producto ${batchProducts.length + 1}`,
      costUSD: cost,
      priceEfectivo: cost * efectivoMultiplier,
      priceBS: (cost * bsMultiplier * rate) * (1 + extraPercentage / 100),
      profitEfectivo: (cost * efectivoMultiplier) - cost,
      profitBS: ((cost * bsMultiplier * rate) * (1 + extraPercentage / 100) / rate) - cost,
    };

    setBatchProducts([...batchProducts, newProduct]);
    setNewProductName('');
    setNewProductCost('');
    
    // Agregar al historial
    addToHistory(cost, paymentType);
  };

  // Remover del batch
  const removeFromBatch = (id: string) => {
    setBatchProducts(batchProducts.filter(p => p.id !== id));
  };

  // Agregar al historial
  const addToHistory = (cost: number, type: 'efectivo' | 'bs') => {
    const entry: CalculationHistory = {
      id: crypto.randomUUID(),
      date: new Date(),
      costUSD: cost,
      paymentType: type,
      extraPercentage,
      bcvRate: rate,
      finalPrice: type === 'efectivo' ? cost * efectivoMultiplier : (cost * bsMultiplier * rate) * (1 + extraPercentage / 100),
    };
    setHistory([entry, ...history.slice(0, 49)]);
  };

  // Copiar al portapapeles
  const copyToClipboard = async (text: string, id?: string) => {
    await navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
    toast({ title: 'Copiado', description: 'Precio copiado al portapapeles' });
  };

  // Exportar CSV
  const exportCSV = () => {
    const headers = ['Nombre', 'Costo USD', 'Precio Efectivo', 'Precio BS', 'Ganancia Efectivo', 'Ganancia BS'];
    const rows = batchProducts.map(p => [
      p.name,
      p.costUSD.toFixed(2),
      p.priceEfectivo.toFixed(2),
      p.priceBS.toFixed(2),
      p.profitEfectivo.toFixed(2),
      p.profitBS.toFixed(2)
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `precios-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'Exportado', description: 'Archivo CSV descargado' });
  };

  // Exportar JSON
  const exportJSON = () => {
    const data = {
      fecha: new Date().toISOString(),
      tasaBCV: rate,
      configuracion: { extraPercentage, efectivoMultiplier, bsMultiplier },
      productos: batchProducts,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `precios-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'Exportado', description: 'Archivo JSON descargado' });
  };

  // Actualizar productos en Supabase
  const updateProductPrices = async () => {
    if (!isAdmin) {
      toast({ title: 'Sin permisos', description: 'Solo administradores pueden actualizar precios', variant: 'destructive' });
      return;
    }

    let updated = 0;
    for (const calc of batchProducts) {
      const product = products.find(p => p.name.toLowerCase() === calc.name.toLowerCase());
      if (product) {
        const { error } = await updateProduct(product.id, { price_usd: calc.priceEfectivo });
        if (!error) updated++;
      }
    }

    toast({ 
      title: 'Actualizado', 
      description: `${updated} productos actualizados en la base de datos` 
    });
  };

  // Calcular escenarios
  const scenarios = useMemo(() => {
    if (!isValidCost) return [];
    return [
      { label: 'Mínimo', rate: minRate, price: (costNumber * bsMultiplier * minRate) * (1 + extraPercentage / 100) },
      { label: 'Actual', rate: rate, price: priceBS },
      { label: 'Máximo', rate: maxRate, price: (costNumber * bsMultiplier * maxRate) * (1 + extraPercentage / 100) },
    ];
  }, [costNumber, minRate, maxRate, rate, bsMultiplier, extraPercentage, priceBS, isValidCost]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
              <Calculator className="h-8 w-8 text-primary" />
              Calculadora de Precios
            </h1>
            <p className="text-muted-foreground mt-1">
              Calcula precios en efectivo y bolívares con tasa BCV
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={rate > 0 ? 'default' : 'destructive'} className="text-sm">
              <Banknote className="h-3 w-3 mr-1" />
              Bs. {rate.toFixed(2)}
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refetchRate}
              disabled={autoFetching}
            >
              <RefreshCw className={`h-4 w-4 ${autoFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Tasa BCV Info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tasa BCV Actual</p>
                  <p className="text-2xl font-bold text-foreground">
                    Bs. {rate.toFixed(4)}
                  </p>
                </div>
              </div>
              {lastUpdate && (
                <p className="text-xs text-muted-foreground">
                  Actualizado: {lastUpdate.toLocaleString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="single" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="single">Cálculo Simple</TabsTrigger>
            <TabsTrigger value="batch">Batch/Múltiples</TabsTrigger>
            <TabsTrigger value="config">Configuración</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          {/* Cálculo Simple */}
          <TabsContent value="single" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Input Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Datos del Producto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Costo USD */}
                  <div className="space-y-2">
                    <Label htmlFor="costUSD">Costo Base (USD)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="costUSD"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={costUSD}
                        onChange={(e) => setCostUSD(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {costUSD && !isValidCost && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        El costo debe ser mayor a 0
                      </p>
                    )}
                  </div>

                  {/* Tipo de Pago */}
                  <div className="space-y-2">
                    <Label>Tipo de Pago</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={paymentType === 'efectivo' ? 'default' : 'outline'}
                        onClick={() => setPaymentType('efectivo')}
                        className="w-full"
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Efectivo
                      </Button>
                      <Button
                        type="button"
                        variant={paymentType === 'bs' ? 'default' : 'outline'}
                        onClick={() => setPaymentType('bs')}
                        className="w-full"
                      >
                        <Banknote className="h-4 w-4 mr-2" />
                        Bolívares
                      </Button>
                    </div>
                  </div>

                  {/* Porcentaje Extra (solo BS) */}
                  <AnimatePresence>
                    {paymentType === 'bs' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <Label>Porcentaje Extra</Label>
                          <span className="text-sm font-medium text-primary">{extraPercentage.toFixed(1)}%</span>
                        </div>
                        <Slider
                          value={[extraPercentage]}
                          onValueChange={([v]) => setExtraPercentage(v)}
                          min={0}
                          max={100}
                          step={0.1}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Preset selector */}
                  <div className="space-y-2">
                    <Label>Preset</Label>
                    <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar preset" />
                      </SelectTrigger>
                      <SelectContent>
                        {presets.map(preset => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name} ({preset.extraPercentage}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Results Panel */}
              <Card className="bg-gradient-to-br from-primary/5 to-accent/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Resultados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Precio Efectivo */}
                  <motion.div
                    key={priceEfectivo}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 rounded-xl bg-green-500/10 border border-green-500/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Precio Efectivo</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(priceEfectivo.toFixed(2), 'efectivo')}
                      >
                        {copiedId === 'efectivo' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      ${priceEfectivo.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ganancia: ${profitEfectivo.toFixed(2)} ({profitMarginEfectivo.toFixed(1)}%)
                    </p>
                  </motion.div>

                  {/* Precio BS */}
                  <motion.div
                    key={priceBS}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Precio Bolívares</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(priceBS.toFixed(2), 'bs')}
                      >
                        {copiedId === 'bs' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      Bs. {priceBS.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ganancia: ${profitBS.toFixed(2)} ({profitMarginBS.toFixed(1)}%)
                    </p>
                    <div className="mt-2 pt-2 border-t border-blue-500/20">
                      <p className="text-xs text-muted-foreground">
                        Tasa final con {extraPercentage.toFixed(1)}%: <span className="font-semibold text-blue-600 dark:text-blue-400">Bs. {(rate * (1 + extraPercentage / 100)).toFixed(4)}</span>
                      </p>
                    </div>
                  </motion.div>

                  {/* Comparativa */}
                  <div className="p-4 rounded-xl bg-secondary/50">
                    <p className="text-sm font-medium mb-2">Diferencia</p>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">BS vs Efectivo</span>
                      <Badge variant={priceBS > priceEfectivo * rate ? 'default' : 'secondary'}>
                        {isValidRate && isValidCost 
                          ? `${(((priceBS / rate) / priceEfectivo - 1) * 100).toFixed(1)}%`
                          : '-'}
                      </Badge>
                    </div>
                  </div>

                  {/* Agregar al historial */}
                  <Button 
                    className="w-full"
                    onClick={() => isValidCost && addToHistory(costNumber, paymentType)}
                    disabled={!isValidCost}
                  >
                    <History className="h-4 w-4 mr-2" />
                    Guardar en Historial
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Escenarios */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Escenarios de Tasa
                </CardTitle>
                <Switch
                  checked={showScenarios}
                  onCheckedChange={setShowScenarios}
                />
              </CardHeader>
              <AnimatePresence>
                {showScenarios && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-4">
                        {scenarios.map((s, i) => (
                          <motion.div
                            key={s.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`p-4 rounded-xl border ${
                              s.label === 'Actual' 
                                ? 'border-primary bg-primary/5' 
                                : 'border-border bg-secondary/30'
                            }`}
                          >
                            <p className="text-sm text-muted-foreground">{s.label}</p>
                            <p className="text-lg font-bold">Bs. {s.rate.toFixed(2)}</p>
                            <p className="text-xl font-bold text-primary mt-2">
                              Bs. {s.price.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </TabsContent>

          {/* Batch/Múltiples */}
          <TabsContent value="batch" className="space-y-6">
            {/* Resumen de configuración actual */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Tasa BCV</p>
                      <p className="font-bold">Bs. {rate.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">% Extra</p>
                      <p className="font-bold text-primary">{extraPercentage.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tasa Final</p>
                      <p className="font-bold text-blue-600">Bs. {(rate * (1 + extraPercentage / 100)).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Agregar producto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Agregar Producto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label htmlFor="productName">Nombre (opcional)</Label>
                    <Input
                      id="productName"
                      placeholder="Ej: Camisa, Pantalón..."
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <Label htmlFor="productCost">Costo USD</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="productCost"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={newProductCost}
                        onChange={(e) => setNewProductCost(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addToBatch} className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de productos */}
            {batchProducts.length > 0 ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Simulación por Lotes
                      <Badge variant="secondary">{batchProducts.length} productos</Badge>
                    </CardTitle>
                    <CardDescription>
                      Total: ${batchProducts.reduce((sum, p) => sum + p.costUSD, 0).toFixed(2)} USD en costos
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={exportCSV}>
                      <Download className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportJSON}>
                      <Download className="h-4 w-4 mr-2" />
                      JSON
                    </Button>
                    {isAdmin && (
                      <Button size="sm" onClick={updateProductPrices}>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar en DB
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Totales */}
                  <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-secondary/30">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Costos</p>
                      <p className="text-lg font-bold">${batchProducts.reduce((sum, p) => sum + p.costUSD, 0).toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Efectivo</p>
                      <p className="text-lg font-bold text-green-600">${batchProducts.reduce((sum, p) => sum + p.priceEfectivo, 0).toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Bolívares</p>
                      <p className="text-lg font-bold text-blue-600">Bs. {batchProducts.reduce((sum, p) => sum + p.priceBS, 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {/* Tabla de productos */}
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Producto</th>
                          <th className="text-right p-3 font-medium">Costo USD</th>
                          <th className="text-right p-3 font-medium text-green-600">Efectivo</th>
                          <th className="text-right p-3 font-medium text-blue-600">Bolívares</th>
                          <th className="text-right p-3 font-medium">Ganancia</th>
                          <th className="p-3 w-20"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {batchProducts.map((product, index) => (
                          <motion.tr
                            key={product.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-3 font-medium">{product.name}</td>
                            <td className="p-3 text-right">${product.costUSD.toFixed(2)}</td>
                            <td className="p-3 text-right font-medium text-green-600">${product.priceEfectivo.toFixed(2)}</td>
                            <td className="p-3 text-right font-medium text-blue-600">Bs. {product.priceBS.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right">
                              <span className="text-green-600">${product.profitEfectivo.toFixed(2)}</span>
                              <span className="text-muted-foreground mx-1">/</span>
                              <span className="text-blue-600">${product.profitBS.toFixed(2)}</span>
                            </td>
                            <td className="p-3">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(`${product.name}: $${product.priceEfectivo.toFixed(2)} / Bs. ${product.priceBS.toFixed(2)}`)}
                                >
                                  <Clipboard className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFromBatch(product.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Limpiar todo */}
                  <div className="mt-4 flex justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setBatchProducts([])}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Limpiar Todo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Agrega productos para calcular precios en lote</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Configuración */}
          <TabsContent value="config" className="space-y-6">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Porcentaje de Ganancia
                </CardTitle>
                <CardDescription>
                  Ajusta el porcentaje extra que se aplica al precio en Bolívares
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base">Porcentaje Extra BS</Label>
                    <span className="text-2xl font-bold text-primary">{extraPercentage.toFixed(1)}%</span>
                  </div>
                  <Slider
                    value={[extraPercentage]}
                    onValueChange={([v]) => setExtraPercentage(v)}
                    min={0}
                    max={50}
                    step={0.1}
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                </div>

                <Separator />

                <div className="p-4 rounded-xl bg-secondary/50">
                  <p className="text-sm font-medium mb-2">Fórmula aplicada:</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Precio BS = (Costo × {bsMultiplier} × Tasa BCV) × (1 + {extraPercentage.toFixed(1)}%)
                  </p>
                  {isValidRate && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Tasa final: <span className="font-semibold">Bs. {(rate * (1 + extraPercentage / 100)).toFixed(4)}</span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Historial */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Historial de Cálculos
                </CardTitle>
                <CardDescription>Últimos 50 cálculos realizados</CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No hay cálculos en el historial</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {history.map((entry, index) => (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="p-3 rounded-lg border border-border bg-card flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <Badge variant={entry.paymentType === 'efectivo' ? 'default' : 'secondary'}>
                              {entry.paymentType === 'efectivo' ? 'USD' : 'BS'}
                            </Badge>
                            <div>
                              <p className="font-medium">${entry.costUSD.toFixed(2)} → {entry.paymentType === 'efectivo' ? '$' : 'Bs.'}{entry.finalPrice.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">
                                Tasa: {entry.bcvRate.toFixed(2)} | Extra: {entry.extraPercentage}%
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {entry.date.toLocaleString()}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
