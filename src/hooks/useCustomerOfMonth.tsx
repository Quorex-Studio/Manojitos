// Hook para sistema de Cliente del Mes automático
import { useMemo } from 'react';
import { useCredits } from './useCredits';

export interface CustomerOfMonth {
  creditId: string;
  clientName: string;
  clientPhone?: string | null;
  score: number;
  badges: string[];
  reason: string;
  stats: {
    paymentRate: number;
    totalPurchases: number;
    avgPaymentDays: number;
    consecutiveOnTime: number;
  };
}

export function useCustomerOfMonth() {
  const { credits } = useCredits();
  
  const customerOfMonth = useMemo((): CustomerOfMonth | null => {
    if (credits.length === 0) return null;
    
    // Calcular score para cada cliente
    const scoredCredits = credits
      .filter(c => !c.is_blocked && (c.total_purchases || 0) >= 2)
      .map(credit => {
        const onTime = credit.total_paid_on_time || 0;
        const late = credit.total_paid_late || 0;
        const total = onTime + late;
        const paymentRate = total > 0 ? (onTime / total) * 100 : 100;
        const avgDays = credit.avg_payment_days || 0;
        const consecutiveLate = credit.consecutive_late_payments || 0;
        
        // Fórmula de scoring
        let score = 0;
        
        // Tasa de pago a tiempo (máx 40 puntos)
        score += (paymentRate / 100) * 40;
        
        // Días promedio de pago (máx 25 puntos) - menos días = más puntos
        score += Math.max(0, 25 - avgDays);
        
        // Sin pagos tardíos consecutivos (máx 20 puntos)
        score += consecutiveLate === 0 ? 20 : Math.max(0, 20 - consecutiveLate * 5);
        
        // Volumen de compras (máx 15 puntos)
        score += Math.min(15, (credit.total_purchases || 0) * 1.5);
        
        // Badges
        const badges: string[] = [];
        if (paymentRate === 100 && total >= 3) badges.push('🏆 Pago Perfecto');
        if (avgDays <= 3) badges.push('⚡ Súper Rápido');
        if ((credit.total_purchases || 0) >= 10) badges.push('💎 Cliente VIP');
        if (consecutiveLate === 0 && total >= 5) badges.push('🌟 Confiable');
        
        return {
          credit,
          score,
          paymentRate,
          badges
        };
      })
      .sort((a, b) => b.score - a.score);
    
    if (scoredCredits.length === 0) return null;
    
    const winner = scoredCredits[0];
    
    // Determinar razón del reconocimiento
    let reason = 'Excelente comportamiento crediticio';
    if (winner.paymentRate === 100) {
      reason = '¡100% de pagos a tiempo!';
    } else if (winner.score >= 90) {
      reason = 'Comportamiento ejemplar en créditos';
    } else if (winner.badges.includes('⚡ Súper Rápido')) {
      reason = 'Los pagos más rápidos del mes';
    }
    
    return {
      creditId: winner.credit.id,
      clientName: winner.credit.client_name,
      clientPhone: winner.credit.client_phone,
      score: Math.round(winner.score),
      badges: winner.badges,
      reason,
      stats: {
        paymentRate: winner.paymentRate,
        totalPurchases: winner.credit.total_purchases || 0,
        avgPaymentDays: winner.credit.avg_payment_days || 0,
        consecutiveOnTime: winner.credit.total_paid_on_time || 0
      }
    };
  }, [credits]);
  
  // Top 3 clientes
  const topCustomers = useMemo((): CustomerOfMonth[] => {
    if (credits.length === 0) return [];
    
    const scoredCredits = credits
      .filter(c => !c.is_blocked && (c.total_purchases || 0) >= 1)
      .map(credit => {
        const onTime = credit.total_paid_on_time || 0;
        const late = credit.total_paid_late || 0;
        const total = onTime + late;
        const paymentRate = total > 0 ? (onTime / total) * 100 : 100;
        const avgDays = credit.avg_payment_days || 0;
        const consecutiveLate = credit.consecutive_late_payments || 0;
        
        let score = 0;
        score += (paymentRate / 100) * 40;
        score += Math.max(0, 25 - avgDays);
        score += consecutiveLate === 0 ? 20 : Math.max(0, 20 - consecutiveLate * 5);
        score += Math.min(15, (credit.total_purchases || 0) * 1.5);
        
        const badges: string[] = [];
        if (paymentRate === 100 && total >= 3) badges.push('🏆');
        if (avgDays <= 3) badges.push('⚡');
        if ((credit.total_purchases || 0) >= 10) badges.push('💎');
        
        return {
          creditId: credit.id,
          clientName: credit.client_name,
          clientPhone: credit.client_phone,
          score: Math.round(score),
          badges,
          reason: paymentRate === 100 ? 'Pagos perfectos' : 'Buen historial',
          stats: {
            paymentRate,
            totalPurchases: credit.total_purchases || 0,
            avgPaymentDays: avgDays,
            consecutiveOnTime: onTime
          }
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    
    return scoredCredits;
  }, [credits]);
  
  return { customerOfMonth, topCustomers };
}
