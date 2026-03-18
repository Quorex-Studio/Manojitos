/**
 * useFinancialProfile — Analytical hook to assess a customer's financial health.
 * Calculates: trust level, payment rate, credit utilization, and adjustment suggestions.
 * Analyzes: `useCredits` data.
 * Returns: { profile, clientName, isLoading }
 */
// Hook para calcular el perfil financiero del cliente
import { useMemo } from 'react';
import { useCredits } from './useCredits';

export interface FinancialProfile {
  // Nivel de confianza
  trustScore: number; // 0-100
  trustLevel: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'RIESGO' | 'CRITICO';
  trustEmoji: string;
  trustColor: string;
  
  // Comportamiento de pagos
  onTimePayments: number;
  latePayments: number;
  paymentRate: number; // % pagos a tiempo
  avgPaymentDays: number;
  
  // Límite y uso
  creditLimit: number;
  currentBalance: number;
  utilizationRate: number; // % del límite usado
  availableCredit: number;
  
  // Historial
  totalPurchases: number;
  consecutiveLatePayments: number;
  lastPaymentDate: string | null;
  
  // Recomendaciones
  recommendations: string[];
  adjustmentSuggestion: 'increase' | 'maintain' | 'decrease' | 'block';
  suggestedLimitChange: number; // porcentaje
}

interface CreditData {
  trust_score?: number;
  trust_level?: string;
  total_paid_on_time?: number;
  total_paid_late?: number;
  avg_payment_days?: number;
  credit_limit: number;
  current_balance: number;
  total_purchases?: number;
  consecutive_late_payments?: number;
  last_payment_date?: string | null;
  is_blocked?: boolean;
  client_name?: string;
}

export function calculateFinancialProfile(credit: CreditData): FinancialProfile {
  const trustScore = credit.trust_score || 100;
  const onTimePayments = credit.total_paid_on_time || 0;
  const latePayments = credit.total_paid_late || 0;
  const totalPayments = onTimePayments + latePayments;
  const paymentRate = totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 100;
  const utilizationRate = credit.credit_limit > 0 
    ? (credit.current_balance / credit.credit_limit) * 100 
    : 0;
  const availableCredit = Math.max(0, credit.credit_limit - credit.current_balance);
  
  // Determinar nivel de confianza
  let trustLevel: FinancialProfile['trustLevel'];
  let trustEmoji: string;
  let trustColor: string;
  
  if (trustScore >= 90) {
    trustLevel = 'EXCELENTE';
    trustEmoji = '⭐';
    trustColor = 'text-green-500';
  } else if (trustScore >= 75) {
    trustLevel = 'BUENO';
    trustEmoji = '✅';
    trustColor = 'text-blue-500';
  } else if (trustScore >= 50) {
    trustLevel = 'REGULAR';
    trustEmoji = '⚠️';
    trustColor = 'text-yellow-500';
  } else if (trustScore >= 25) {
    trustLevel = 'RIESGO';
    trustEmoji = '🔶';
    trustColor = 'text-orange-500';
  } else {
    trustLevel = 'CRITICO';
    trustEmoji = '🔴';
    trustColor = 'text-red-500';
  }
  
  // Generar recomendaciones
  const recommendations: string[] = [];
  let adjustmentSuggestion: FinancialProfile['adjustmentSuggestion'] = 'maintain';
  let suggestedLimitChange = 0;
  
  if (credit.is_blocked) {
    recommendations.push('Cliente bloqueado - requiere pago inmediato');
    adjustmentSuggestion = 'block';
  } else if (credit.consecutive_late_payments && credit.consecutive_late_payments >= 3) {
    recommendations.push('Patrón de mora detectado - considerar reducción de límite');
    adjustmentSuggestion = 'decrease';
    suggestedLimitChange = -25;
  } else if (paymentRate >= 95 && totalPayments >= 5) {
    recommendations.push('Excelente historial - considerar aumento de límite');
    adjustmentSuggestion = 'increase';
    suggestedLimitChange = 20;
  } else if (paymentRate >= 80 && totalPayments >= 10) {
    recommendations.push('Buen historial - evaluar aumento moderado');
    adjustmentSuggestion = 'increase';
    suggestedLimitChange = 10;
  } else if (paymentRate < 60) {
    recommendations.push('Historial de pagos bajo - monitorear de cerca');
    adjustmentSuggestion = 'decrease';
    suggestedLimitChange = -15;
  }
  
  if (utilizationRate > 90) {
    recommendations.push('Alto uso de crédito - riesgo de sobreendeudamiento');
  } else if (utilizationRate < 20 && totalPayments >= 3) {
    recommendations.push('Bajo uso de crédito - cliente conservador');
  }
  
  if ((credit.avg_payment_days || 0) > 15) {
    recommendations.push('Pagos lentos en promedio - reforzar recordatorios');
  }
  
  return {
    trustScore,
    trustLevel,
    trustEmoji,
    trustColor,
    onTimePayments,
    latePayments,
    paymentRate,
    avgPaymentDays: credit.avg_payment_days || 0,
    creditLimit: credit.credit_limit,
    currentBalance: credit.current_balance,
    utilizationRate,
    availableCredit,
    totalPurchases: credit.total_purchases || 0,
    consecutiveLatePayments: credit.consecutive_late_payments || 0,
    lastPaymentDate: credit.last_payment_date || null,
    recommendations,
    adjustmentSuggestion,
    suggestedLimitChange
  };
}

// Hook que acepta creditId y busca el crédito
export function useFinancialProfile(creditId: string) {
  const { credits, isLoading } = useCredits();
  
  const credit = useMemo(() => {
    return credits.find(c => c.id === creditId) || null;
  }, [credits, creditId]);
  
  const profile = useMemo(() => {
    if (!credit) return null;
    return calculateFinancialProfile(credit);
  }, [credit]);
  
  return {
    profile,
    clientName: credit?.client_name || '',
    isLoading
  };
}

// Hook que acepta el objeto credit directamente
export function useFinancialProfileFromCredit(credit: CreditData | null) {
  return useMemo(() => {
    if (!credit) return null;
    return calculateFinancialProfile(credit);
  }, [credit]);
}
