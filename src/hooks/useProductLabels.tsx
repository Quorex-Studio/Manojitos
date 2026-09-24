/**
 * useProductLabels — Pure logic hook to calculate automatic badges for products.
 * Labels: Bestseller (top 20% sales), New (14 days), Low Stock (<=3).
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

// Etiquetas en orden de prioridad (la tarjeta muestra solo la primera):
// Más vendido > Nuevo > Últimas unidades. Sin emojis (DESIGN.md: una etiqueta sobria).
export function calculateProductLabels(product: ProductForLabels, allProducts?: ProductForLabels[]): ProductLabel[] {
  const labels: ProductLabel[] = [];
  const daysSinceCreation = Math.floor((Date.now() - new Date(product.created_at).getTime()) / 86_400_000);

  // Más vendido: top 20% en ventas con al menos 5 unidades vendidas
  let isTopSeller = false;
  if (allProducts && allProducts.length > 0) {
    const sortedBySales = [...allProducts].sort((a, b) => b.sold_count - a.sold_count);
    const topCount = Math.ceil(allProducts.length * 0.2);
    isTopSeller = sortedBySales.slice(0, topCount).some(p => p.id === product.id) && product.sold_count >= 5;
  } else {
    isTopSeller = product.sold_count >= 10;
  }
  if (isTopSeller) {
    labels.push({ type: 'bestseller', text: 'Más vendido', icon: '', color: 'bg-foreground text-background' });
  }

  // Nuevo: menos de 14 días en la tienda
  if (daysSinceCreation <= 14) {
    labels.push({ type: 'new', text: 'Nuevo', icon: '', color: 'bg-primary text-primary-foreground' });
  }

  // Últimas unidades
  if (product.stock > 0 && product.stock <= 3) {
    labels.push({
      type: 'low_stock',
      text: product.stock === 1 ? 'Última unidad' : `Últimas ${product.stock}`,
      icon: '',
      color: 'bg-background text-sale',
    });
  }

  return labels;
}

export function useProductLabels(product: ProductForLabels, allProducts?: ProductForLabels[]) {
  return useMemo(() => calculateProductLabels(product, allProducts), [product, allProducts]);
}
