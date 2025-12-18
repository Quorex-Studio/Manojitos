import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calculator, 
  Copy, 
  Download, 
  Plus, 
  Trash2, 
  RefreshCw,
  TrendingUp,
  DollarSign,
  Banknote,
  History,
  Check,
  AlertCircle,
  Hash,
  Euro
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useExchangeRate, Currency } from '@/hooks/useExchangeRate';
import { toast } from '@/hooks/use-toast';

// Tipos
interface BatchProduct {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalEfectivo: number;
  totalBS: number;
}

interface CalculationHistory {
  id: string;
  date: Date;
  quantity: number;
  unitPrice: number;
  totalEfectivo: number;
  totalBS: number;
  bcvRate: number;
  extraPercentage: number;
  currency: Currency;
}

export default function PriceCalculator() {
  // Get preferred currency from localStorage
  const preferredCurrency = (localStorage.getItem('preferredCurrency') as Currency) || 'USD';
  const { rate, loading: rateLoading, lastUpdate, refetch: refetchRate, autoFetching, currency } = useExchangeRate(preferredCurrency);

  const currencySymbol = currency === 'EUR' ? '€' : '$';
  const CurrencyIcon = currency === 'EUR' ? Euro : DollarSign;

  // Estado principal - Cálculo Simple
  const [quantity, setQuantity] = useState<string>('1');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [extraPercentage, setExtraPercentage] = useState<number>(10.7);

  // Estado para batch
  const [batchProducts, setBatchProducts] = useState<BatchProduct[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductQuantity, setNewProductQuantity] = useState('1');
  const [newProductUnitPrice, setNewProductUnitPrice] = useState('');

  // Historial
  const [history, setHistory] = useState<CalculationHistory[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Validaciones
  const quantityNumber = parseInt(quantity) || 0;
  const unitPriceNumber = parseFloat(unitPrice) || 0;
  const isValidQuantity = quantityNumber >= 1;
  const isValidUnitPrice = unitPriceNumber > 0;
  const isValidRate = rate > 0;
  const isValidPercentage = extraPercentage >= 0 && extraPercentage <= 100;
  const isValidInputs = isValidQuantity && isValidUnitPrice && isValidRate && isValidPercentage;

  // Cálculos según la fórmula especificada:
  // PrecioTotalEfectivo = Cantidad × PrecioUnitario
  // PrecioTotalBS = (Cantidad × PrecioUnitario × Tasa) × (1 + PorcentajeExtra/100)
  const totalEfectivo = useMemo(() => {
    if (!isValidQuantity || !isValidUnitPrice) return 0;
    return Math.round((quantityNumber * unitPriceNumber) * 100) / 100;
  }, [quantityNumber, unitPriceNumber, isValidQuantity, isValidUnitPrice]);

  const totalBS = useMemo(() => {
    if (!isValidInputs) return 0;
    const result = (quantityNumber * unitPriceNumber * rate) * (1 + extraPercentage / 100);
    return Math.round(result * 100) / 100;
  }, [quantityNumber, unitPriceNumber, rate, extraPercentage, isValidInputs]);

  // Tasa final con porcentaje aplicado
  const finalRate = useMemo(() => {
    if (!isValidRate) return 0;
    return Math.round((rate * (1 + extraPercentage / 100)) * 10000) / 10000;
  }, [rate, extraPercentage, isValidRate]);

  // Copiar al portapapeles
  const copyToClipboard = async (text: string, id?: string) => {
    await navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
    toast({ title: 'Copiado', description: 'Valor copiado al portapapeles' });
  };

  // Agregar al historial
  const addToHistory = () => {
    if (!isValidInputs) return;
    
    const entry: CalculationHistory = {
      id: crypto.randomUUID(),
      date: new Date(),
      quantity: quantityNumber,
      unitPrice: unitPriceNumber,
      totalEfectivo,
      totalBS,
      bcvRate: rate,
      extraPercentage,
      currency,
    };
    setHistory([entry, ...history.slice(0, 49)]);
    toast({ title: 'Guardado', description: 'Cálculo agregado al historial' });
  };

  // Agregar producto al batch
  const addToBatch = () => {
    const qty = parseInt(newProductQuantity) || 0;
    const price = parseFloat(newProductUnitPrice) || 0;
    
    if (qty < 1 || price <= 0) {
      toast({ title: 'Error', description: 'Cantidad ≥ 1 y precio > 0', variant: 'destructive' });
      return;
    }

    const totalEffectivo = Math.round((qty * price) * 100) / 100;
    const totalBs = Math.round(((qty * price * rate) * (1 + extraPercentage / 100)) * 100) / 100;

    const newProduct: BatchProduct = {
      id: crypto.randomUUID(),
      name: newProductName || `Producto ${batchProducts.length + 1}`,
      quantity: qty,
      unitPrice: price,
      totalEfectivo: totalEffectivo,
      totalBS: totalBs,
    };

    setBatchProducts([...batchProducts, newProduct]);
    setNewProductName('');
    setNewProductQuantity('1');
    setNewProductUnitPrice('');
  };

  // Remover del batch
  const removeFromBatch = (id: string) => {
    setBatchProducts(batchProducts.filter(p => p.id !== id));
  };

  // Exportar CSV
  const exportCSV = () => {
    const headers = ['Nombre', 'Cantidad', `Precio Unitario ${currency}`, `Total Efectivo ${currency}`, 'Total BS'];
    const rows = batchProducts.map(p => [
      p.name,
      p.quantity.toString(),
      p.unitPrice.toFixed(2),
      p.totalEfectivo.toFixed(2),
      p.totalBS.toFixed(2)
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
      tasaFinal: finalRate,
      porcentajeExtra: extraPercentage,
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

  // Totales del batch
  const batchTotals = useMemo(() => {
    return {
      totalEfectivo: batchProducts.reduce((sum, p) => sum + p.totalEfectivo, 0),
      totalBS: batchProducts.reduce((sum, p) => sum + p.totalBS, 0),
      totalItems: batchProducts.reduce((sum, p) => sum + p.quantity, 0),
    };
  }, [batchProducts]);

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
              Calcula precios totales en USD y Bolívares
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="single">Cálculo Simple</TabsTrigger>
            <TabsTrigger value="batch">Múltiples</TabsTrigger>
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
                  {/* Cantidad */}
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Cantidad</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {quantity && !isValidQuantity && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        La cantidad debe ser ≥ 1
                      </p>
                    )}
                  </div>

                  {/* Precio Unitario */}
                  <div className="space-y-2">
                    <Label htmlFor="unitPrice">Precio Unitario ({currency})</Label>
                    <div className="relative">
                      <CurrencyIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="unitPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {unitPrice && !isValidUnitPrice && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        El precio debe ser mayor a 0
                      </p>
                    )}
                  </div>

                  {/* Porcentaje Extra */}
                  <div className="space-y-3">
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
                    {!isValidPercentage && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        El porcentaje debe estar entre 0% y 100%
                      </p>
                    )}
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
                  {/* Precio Total Efectivo */}
                  <motion.div
                    key={`efectivo-${totalEfectivo}`}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 rounded-xl bg-green-500/10 border border-green-500/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Precio Total Efectivo ({currency})</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(totalEfectivo.toFixed(2), 'efectivo')}
                        disabled={!isValidInputs}
                      >
                        {copiedId === 'efectivo' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {currencySymbol}{totalEfectivo.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {quantityNumber} × {currencySymbol}{unitPriceNumber.toFixed(2)}
                    </p>
                  </motion.div>

                  {/* Precio Total BS */}
                  <motion.div
                    key={`bs-${totalBS}`}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Precio Total Bolívares</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(totalBS.toFixed(2), 'bs')}
                        disabled={!isValidInputs}
                      >
                        {copiedId === 'bs' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      Bs. {totalBS.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </p>
                    <div className="mt-2 pt-2 border-t border-blue-500/20 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Fórmula: ({quantityNumber} × ${unitPriceNumber.toFixed(2)} × {rate.toFixed(2)}) × (1 + {extraPercentage.toFixed(1)}%)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tasa final con {extraPercentage.toFixed(1)}%: <span className="font-semibold text-blue-600 dark:text-blue-400">Bs. {finalRate.toFixed(4)}</span>
                      </p>
                    </div>
                  </motion.div>

                  {/* Agregar al historial */}
                  <Button 
                    className="w-full"
                    onClick={addToHistory}
                    disabled={!isValidInputs}
                  >
                    <History className="h-4 w-4 mr-2" />
                    Guardar en Historial
                  </Button>
                </CardContent>
              </Card>
            </div>
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
                      <p className="font-bold text-blue-600 dark:text-blue-400">Bs. {finalRate.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ajustar % Extra</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[extraPercentage]}
                        onValueChange={([v]) => setExtraPercentage(v)}
                        min={0}
                        max={100}
                        step={0.1}
                        className="w-32"
                      />
                      <span className="text-sm font-medium w-12">{extraPercentage.toFixed(1)}%</span>
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
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="batchProductName">Nombre (opcional)</Label>
                    <Input
                      id="batchProductName"
                      placeholder="Ej: Camisa, Pantalón..."
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="batchQuantity">Cantidad</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="batchQuantity"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="1"
                        value={newProductQuantity}
                        onChange={(e) => setNewProductQuantity(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="batchUnitPrice">Precio Unitario USD</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="batchUnitPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={newProductUnitPrice}
                        onChange={(e) => setNewProductUnitPrice(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addToBatch} className="w-full">
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
                      Lista de Productos
                      <Badge variant="secondary">{batchProducts.length} productos</Badge>
                    </CardTitle>
                    <CardDescription>
                      {batchTotals.totalItems} unidades totales
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
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Totales */}
                  <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-xl bg-secondary/30">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Efectivo USD</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        ${batchTotals.totalEfectivo.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total BS</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        Bs. {batchTotals.totalBS.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Tabla de productos */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2">Producto</th>
                          <th className="text-center py-2 px-2">Cant.</th>
                          <th className="text-right py-2 px-2">Precio Unit.</th>
                          <th className="text-right py-2 px-2">Total USD</th>
                          <th className="text-right py-2 px-2">Total BS</th>
                          <th className="text-right py-2 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchProducts.map((product) => (
                          <motion.tr
                            key={product.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="border-b border-border/50 hover:bg-secondary/20"
                          >
                            <td className="py-2 px-2 font-medium">{product.name}</td>
                            <td className="py-2 px-2 text-center">{product.quantity}</td>
                            <td className="py-2 px-2 text-right">{currencySymbol}{product.unitPrice.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-green-600 dark:text-green-400 font-medium">
                              {currencySymbol}{product.totalEfectivo.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right text-blue-600 dark:text-blue-400 font-medium">
                              Bs. {product.totalBS.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(`${product.name}: ${currencySymbol}${product.totalEfectivo.toFixed(2)} / Bs. ${product.totalBS.toFixed(2)}`, product.id)}
                                >
                                  {copiedId === product.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
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
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Agrega productos para ver el cálculo por lotes
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Historial */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Historial de Cálculos
                </CardTitle>
                <CardDescription>
                  Últimos 50 cálculos realizados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      <AnimatePresence>
                        {history.map((entry, i) => (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-4 rounded-xl bg-secondary/30 border border-border/50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-muted-foreground">
                                {entry.date.toLocaleString()}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {entry.quantity} × {entry.currency === 'EUR' ? '€' : '$'}{entry.unitPrice.toFixed(2)}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Total {entry.currency}</p>
                                <p className="font-bold text-green-600 dark:text-green-400">
                                  {entry.currency === 'EUR' ? '€' : '$'}{entry.totalEfectivo.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Total BS</p>
                                <p className="font-bold text-blue-600 dark:text-blue-400">
                                  Bs. {entry.totalBS.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Tasa: {entry.bcvRate.toFixed(2)} | Extra: {entry.extraPercentage.toFixed(1)}%
                            </p>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="py-12 text-center">
                    <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      No hay cálculos en el historial
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
