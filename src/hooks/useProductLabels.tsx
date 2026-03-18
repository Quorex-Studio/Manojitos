/**
 * useProductLabels — Pure logic hook to calculate automatic badges for products.
 * Labels: New (7 days), Bestseller (top 20% sales), Low Stock (<=3), Premium (top 25% price).
 * Returns: ProductLabel[]
 */
// Hook para calcular etiquetas automáticas de productos
import { useMemo } from 'react';

export interface ProductLabel {
  type: 'bestseller' | 'new' | 'low_stock' | 'best_margin' | 'trending';
  text: string;
  icon: string;
  color: string;
}

interface ProductForLabels {
  id: string;
  sold_count: number;
  stock: number;
  created_at: string;
  price_usd: number;
  category?: string | null;
}

export function calculateProductLabels(product: ProductForLabels, allProducts?: ProductForLabels[]): ProductLabel[] {
  const labels: ProductLabel[] = [];
  const now = new Date();
  const createdAt = new Date(product.created_at);
  const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // 🆕 Nuevo - productos de menos de 7 días
  if (daysSinceCreation <= 7) {
    labels.push({
      type: 'new',
      text: 'Nuevo',
      icon: '🆕',
      color: 'bg-primary text-primary-foreground'
    });
  }

  // 🔥 Más vendido - si tiene más de 10 ventas o está en top 20%
  if (allProducts && allProducts.length > 0) {
    const sortedBySales = [...allProducts].sort((a, b) => b.sold_count - a.sold_count);
    const topPercentile = Math.ceil(allProducts.length * 0.2);
    const isTopSeller = sortedBySales.slice(0, topPercentile).some(p => p.id === product.id);
    
    if (isTopSeller && product.sold_count >= 5) {
      labels.push({
        type: 'bestseller',
        text: 'Más vendido',
        icon: '🔥',
        color: 'bg-gold text-white'
      });
    }
  } else if (product.sold_count >= 10) {
    labels.push({
      type: 'bestseller',
      text: 'Más vendido',
      icon: '🔥',
      color: 'bg-orange-500 text-white'
    });
  }

  // ⏳ Últimas unidades - stock bajo (3 o menos)
  if (product.stock > 0 && product.stock <= 3) {
    labels.push({
      type: 'low_stock',
      text: `¡Solo ${product.stock}!`,
      icon: '⏳',
      color: 'bg-destructive text-destructive-foreground'
    });
  }

  // 💰 Mejor margen - productos con precio alto (top 25%)
  if (allProducts && allProducts.length > 0) {
    const sortedByPrice = [...allProducts].sort((a, b) => b.price_usd - a.price_usd);
    const topQuartile = Math.ceil(allProducts.length * 0.25);
    const isHighMargin = sortedByPrice.slice(0, topQuartile).some(p => p.id === product.id);
    
    if (isHighMargin && product.price_usd >= 20) {
      labels.push({
        type: 'best_margin',
        text: 'Premium',
        icon: '💎',
        color: 'bg-rose-dark text-white'
      });
    }
  }

  return labels;
}

export function useProductLabels(product: ProductForLabels, allProducts?: ProductForLabels[]) {
  return useMemo(() => calculateProductLabels(product, allProducts), [product, allProducts]);
}
