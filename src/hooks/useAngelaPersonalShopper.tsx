/**
 * useAngelaPersonalShopper — Hook for personalized product recommendations.
 * Analyzes: customer purchase history and credit status.
 * Tables: `orders`, `credits`, `products`
 * Returns: { recommendations, behavior, loading, refresh }
 */
// Hook para recomendaciones personalizadas de productos (Personal Shopper)
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ProductRecommendation {
  product: {
    id: string;
    name: string;
    price_usd: number;
    image_url?: string;
    category?: string;
  };
  reason: string;
  score: number;
}

export interface CustomerBehavior {
  favoriteCategory?: string;
  avgOrderValue?: number;
  purchaseFrequency?: string;
  preferredPaymentMethod?: string;
  hasCredit?: boolean;
  creditAvailable?: number;
  lastPurchaseDate?: string;
}

export function useAngelaPersonalShopper() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [behavior, setBehavior] = useState<CustomerBehavior>({});
  const [loading, setLoading] = useState(true);

  const analyzeBehavior = useCallback(async () => {
    if (!user) return;

    try {
      // Helper to get customer phone
      const getCustomerPhone = async (userId: string): Promise<string> => {
        const { data } = await supabase
          .from('customer_profiles')
          .select('phone')
          .eq('user_id', userId)
          .maybeSingle();
        return data?.phone ?? '';
      };

      // Replace orders query with sales query (using phone fallback)
      const customerPhone = await getCustomerPhone(user.id);
      const orFilter = customerPhone
        ? `customer_user_id.eq.${user.id},client_phone.eq.${customerPhone}`
        : `customer_user_id.eq.${user.id}`;

      const { data: salesHistory } = await supabase
        .from('sales')
        .select('product_name, product_id, total_usd, payment_method, created_at')
        .or(orFilter)
        .order('created_at', { ascending: false })
        .limit(20);

      // Obtener información de crédito
      const { data: credits } = await supabase
        .from('credits')
        .select('credit_limit, current_balance')
        .eq('client_user_id', user.id)
        .limit(1);

      // Analizar comportamiento
      const behaviorData: CustomerBehavior = {};

      if (salesHistory && salesHistory.length > 0) {
        // Calcular valor promedio de orden
        const totalValue = salesHistory.reduce((sum, s) => sum + Number(s.total_usd), 0);
        behaviorData.avgOrderValue = totalValue / salesHistory.length;

        // Método de pago preferido
        const paymentMethods: Record<string, number> = {};
        salesHistory.forEach(s => {
          if (s.payment_method) {
            paymentMethods[s.payment_method] = (paymentMethods[s.payment_method] || 0) + 1;
          }
        });
        const sortedMethods = Object.entries(paymentMethods).sort((a, b) => b[1] - a[1]);
        if (sortedMethods.length > 0) {
          behaviorData.preferredPaymentMethod = sortedMethods[0][0];
        }

        // Última compra
        behaviorData.lastPurchaseDate = salesHistory[0].created_at;

        // Frecuencia de compra
        if (salesHistory.length >= 5) {
          const firstDate = new Date(salesHistory[salesHistory.length - 1].created_at);
          const lastDate = new Date(salesHistory[0].created_at);
          const daysBetween = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
          const avgDays = daysBetween / (salesHistory.length - 1);
          
          if (avgDays < 7) behaviorData.purchaseFrequency = 'frecuente';
          else if (avgDays < 30) behaviorData.purchaseFrequency = 'regular';
          else behaviorData.purchaseFrequency = 'ocasional';
        }

        // Categoría favorita (analizar productos cruzados)
        const categories: Record<string, number> = {};
        const productIds = salesHistory
          .map(s => s.product_id)
          .filter((id): id is string => !!id);
        
        if (productIds.length > 0) {
          const { data: purchasedProducts } = await supabase
            .from('products')
            .select('id, category')
            .in('id', productIds);
          
          salesHistory.forEach(sale => {
            const product = purchasedProducts?.find(p => p.id === sale.product_id);
            if (product?.category) {
              categories[product.category] = (categories[product.category] || 0) + 1;
            }
          });
        }
        const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        if (sortedCategories.length > 0) {
          behaviorData.favoriteCategory = sortedCategories[0][0];
        }
      }

      // Información de crédito
      if (credits && credits.length > 0) {
        behaviorData.hasCredit = true;
        behaviorData.creditAvailable = credits[0].credit_limit - credits[0].current_balance;
      }

      setBehavior(behaviorData);
      return behaviorData;
    } catch (error) {
      console.error('Error analyzing behavior:', error);
      return {};
    }
  }, [user]);

  const generateRecommendations = useCallback(async (behaviorData: CustomerBehavior) => {
    try {
      // Obtener productos disponibles
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price_usd, image_url, category, sold_count, stock')
        .gt('stock', 0)
        .order('sold_count', { ascending: false })
        .limit(50);

      if (!products || products.length === 0) return;

      const recs: ProductRecommendation[] = [];

      // 1. Productos de categoría favorita
      if (behaviorData.favoriteCategory) {
        const categoryProducts = products.filter(p => p.category === behaviorData.favoriteCategory);
        categoryProducts.slice(0, 2).forEach(p => {
          recs.push({
            product: p,
            reason: `Te gusta "${behaviorData.favoriteCategory}" 💕`,
            score: 90
          });
        });
      }

      // 2. Productos populares (más vendidos)
      const popularProducts = products.filter(p => p.sold_count > 0);
      popularProducts.slice(0, 3).forEach(p => {
        if (!recs.find(r => r.product.id === p.id)) {
          recs.push({
            product: p,
            reason: '🔥 Producto popular',
            score: 80
          });
        }
      });

      // 3. Productos en rango de precio preferido
      if (behaviorData.avgOrderValue) {
        const priceRange = behaviorData.avgOrderValue * 0.5;
        const inRangeProducts = products.filter(
          p => p.price_usd >= behaviorData.avgOrderValue! - priceRange &&
               p.price_usd <= behaviorData.avgOrderValue! + priceRange
        );
        inRangeProducts.slice(0, 2).forEach(p => {
          if (!recs.find(r => r.product.id === p.id)) {
            recs.push({
              product: p,
              reason: 'En tu rango de precio 💰',
              score: 75
            });
          }
        });
      }

      // 4. Si tiene crédito disponible, sugerir productos premium
      if (behaviorData.creditAvailable && behaviorData.creditAvailable > 10) {
        const premiumProducts = products.filter(p => 
          p.price_usd > (behaviorData.avgOrderValue || 20) &&
          p.price_usd <= behaviorData.creditAvailable!
        );
        premiumProducts.slice(0, 1).forEach(p => {
          if (!recs.find(r => r.product.id === p.id)) {
            recs.push({
              product: p,
              reason: `¡Tienes crédito! 💳`,
              score: 85
            });
          }
        });
      }

      // 5. SIEMPRE añadir productos aleatorios si no hay suficientes recomendaciones
      if (recs.length < 6) {
        const remainingProducts = products.filter(p => !recs.find(r => r.product.id === p.id));
        const shuffled = remainingProducts.sort(() => Math.random() - 0.5);
        
        const suggestions = [
          'Recomendado para ti ✨',
          'Te puede interesar 🌸',
          'Podría gustarte 💖',
          'Descubre esto 🎀',
          'Sugerencia especial 💕'
        ];
        
        shuffled.slice(0, 6 - recs.length).forEach((p, i) => {
          recs.push({
            product: p,
            reason: suggestions[i % suggestions.length],
            score: 60 - i
          });
        });
      }

      // Ordenar por score y limitar
      recs.sort((a, b) => b.score - a.score);
      setRecommendations(recs.slice(0, 6));
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const behaviorData = await analyzeBehavior();
    if (behaviorData) {
      await generateRecommendations(behaviorData);
    }
    setLoading(false);
  }, [analyzeBehavior, generateRecommendations]);

  useEffect(() => {
    if (user) {
      refresh();
    }
  }, [user, refresh]);

  return {
    recommendations,
    behavior,
    loading,
    refresh
  };
}
