// Calculadora Inteligente de Precios con análisis de Ángela
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Percent,
  Lightbulb,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { cn } from '@/lib/utils';
import stitchRosaMascot from '@/assets/stitch-rosa-mascot.png';

interface PriceAnalysis {
  priceUsd: number;
  priceBs: number;
  margin: number;
  marginPercent: number;
  recommendation: string;
  insight: string;
}

interface AngelaSmartCalculatorProps {
  costUsd?: number;
  className?: string;
}

export function AngelaSmartCalculator({ costUsd = 0, className }: AngelaSmartCalculatorProps) {
  const { rate, loading: rateLoading } = useExchangeRate();
  
  const [quantity, setQuantity] = useState(1);
  const [unitPriceUsd, setUnitPriceUsd] = useState(10);
  const [extraPercent, setExtraPercent] = useState(10.7);
  const [productCost, setProductCost] = useState(costUsd);

  useEffect(() => {
    if (costUsd > 0) {
      setProductCost(costUsd);
      // Sugerir precio con 40% de margen
      setUnitPriceUsd(costUsd * 1.4);
    }
  }, [costUsd]);

  const analysis = useMemo((): PriceAnalysis => {
    const baseTotal = quantity * unitPriceUsd;
    const priceBs = baseTotal * rate * (1 + extraPercent / 100);
    const priceUsd = baseTotal;
    
    const totalCost = quantity * productCost;
    const margin = priceUsd - totalCost;
    const marginPercent = totalCost > 0 ? (margin / totalCost) * 100 : 0;

    let recommendation = '';
    let insight = '';

    // Análisis de margen
    if (marginPercent < 20) {
      recommendation = '⚠️ Margen bajo - considera aumentar el precio';
      insight = `Con un margen del ${marginPercent.toFixed(0)}%, podrías tener problemas de rentabilidad. Sugiero aumentar al menos 10% el precio.`;
    } else if (marginPercent >= 20 && marginPercent < 40) {
      recommendation = '✅ Margen saludable';
      insight = `Buen equilibrio entre competitividad y ganancia. El margen de ${marginPercent.toFixed(0)}% es adecuado para la mayoría de productos.`;
    } else if (marginPercent >= 40 && marginPercent < 60) {
      recommendation = '💰 Excelente margen';
      insight = `Margen alto de ${marginPercent.toFixed(0)}%. Podrías considerar promociones sin afectar rentabilidad.`;
    } else {
      recommendation = '🔥 Margen muy alto';
      insight = `Margen de ${marginPercent.toFixed(0)}%. Evalúa si el precio es competitivo en el mercado.`;
    }

    // Análisis de tasa
    if (rate > 0) {
      const rateInsight = extraPercent > 15 
        ? `Con +${extraPercent}% sobre BCV, el precio en Bs es ${((1 + extraPercent/100) * 100 - 100).toFixed(1)}% mayor que la tasa oficial.`
        : `El porcentaje extra de ${extraPercent}% es moderado y competitivo.`;
      insight += ` ${rateInsight}`;
    }

    return { priceUsd, priceBs, margin, marginPercent, recommendation, insight };
  }, [quantity, unitPriceUsd, rate, extraPercent, productCost]);

  const getMarginColor = (percent: number) => {
    if (percent < 20) return 'text-red-500';
    if (percent < 40) return 'text-green-500';
    if (percent < 60) return 'text-emerald-500';
    return 'text-amber-500';
  };

  return (
    <Card className={cn("border-pink-200 dark:border-pink-800", className)}>
      <CardHeader className="bg-gradient-to-r from-pink-500 to-rose-500 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30">
            <img src={stitchRosaMascot} alt="Ángela" className="w-full h-full object-cover" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Calculadora Inteligente
            </CardTitle>
            <p className="text-xs text-white/80">
              Ángela analiza tu precio
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Cantidad</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Precio Unitario ($)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={unitPriceUsd}
              onChange={(e) => setUnitPriceUsd(parseFloat(e.target.value) || 0)}
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Costo del producto ($)</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={productCost}
            onChange={(e) => setProductCost(parseFloat(e.target.value) || 0)}
            className="h-9"
            placeholder="Para calcular margen"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs">% Extra sobre BCV</Label>
            <span className="text-xs font-medium">{extraPercent}%</span>
          </div>
          <Slider
            value={[extraPercent]}
            onValueChange={(v) => setExtraPercent(v[0])}
            min={0}
            max={30}
            step={0.5}
            className="py-2"
          />
        </div>

        {/* Resultados */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <motion.div 
            className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-700 dark:text-green-300">Precio USD</span>
            </div>
            <p className="text-xl font-bold text-green-700 dark:text-green-300">
              ${analysis.priceUsd.toFixed(2)}
            </p>
          </motion.div>

          <motion.div 
            className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-blue-600">Bs</span>
              <span className="text-xs text-blue-700 dark:text-blue-300">Precio Bs</span>
            </div>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {rateLoading ? '...' : analysis.priceBs.toFixed(2)}
            </p>
            <p className="text-[10px] text-blue-600/70">
              Tasa: {rate.toFixed(2)} Bs/$
            </p>
          </motion.div>
        </div>

        {/* Margen */}
        {productCost > 0 && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Margen de ganancia</span>
              <div className="flex items-center gap-2">
                {analysis.marginPercent > 0 ? (
                  <TrendingUp className={cn("h-4 w-4", getMarginColor(analysis.marginPercent))} />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={cn("font-bold", getMarginColor(analysis.marginPercent))}>
                  {analysis.marginPercent.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Costo: ${(quantity * productCost).toFixed(2)}</span>
              <span>Ganancia: ${analysis.margin.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Recomendación de Ángela */}
        <motion.div 
          className="p-3 rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-pink-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-pink-700 dark:text-pink-300">
                {analysis.recommendation}
              </p>
              <p className="text-xs text-pink-600/80 dark:text-pink-400/80 mt-1">
                {analysis.insight}
              </p>
            </div>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
