/**
 * useCustomerSemaphore — Pure logic hook to calculate customer trust levels (green/yellow/red).
 * Analyzes: trust_score, consecutive_late_payments, and blocked status.
 * Returns: { level, label, icon, color, bgColor, description, canBuyOnCredit }
 */
// Hook para calcular semáforo de clientes (confianza)
import { useMemo } from 'react';

export type SemaphoreLevel = 'green' | 'yellow' | 'red';

// NOTE: icon field contains semantic indicator strings used as data labels,
// not rendered directly as UI icons. Components consuming this should
// render them only in non-visual contexts (aria-labels, tooltips, exports).
// For visual display, use the color/bgColor fields with Lucide icons instead.
export interface CustomerSemaphore {
  level: SemaphoreLevel;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  canBuyOnCredit: boolean;
}

interface CustomerData {
  trust_score?: number | null;
  trust_level?: string | null;
  consecutive_late_payments?: number | null;
  total_paid_on_time?: number | null;
  total_paid_late?: number | null;
  is_blocked?: boolean;
  avg_payment_days?: number | null;
}

export function calculateSemaphore(customer: CustomerData): CustomerSemaphore {
  // Si está bloqueado, siempre rojo
  if (customer.is_blocked) {
    return {
      level: 'red',
      label: 'Bloqueado',
      icon: '🔴',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      description: 'Cliente con acceso restringido',
      canBuyOnCredit: false
    };
  }

  const trustScore = customer.trust_score ?? 100;
  const consecutiveLate = customer.consecutive_late_payments ?? 0;

  // 🔴 Alto riesgo
  if (trustScore < 40 || consecutiveLate >= 3) {
    return {
      level: 'red',
      label: 'Alto riesgo',
      icon: '🔴',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      description: 'Historial de pagos preocupante',
      canBuyOnCredit: false
    };
  }

  // 🟡 Riesgo medio
  if (trustScore < 70 || consecutiveLate >= 1) {
    return {
      level: 'yellow',
      label: 'Riesgo medio',
      icon: '🟡',
      color: 'text-gold',
      bgColor: 'bg-gold/10',
      description: 'Algunos pagos tardíos',
      canBuyOnCredit: true
    };
  }

  // 🟢 Buen pagador
  return {
    level: 'green',
    label: 'Excelente',
    icon: '🟢',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    description: 'Cliente confiable',
    canBuyOnCredit: true
  };
}

export function useCustomerSemaphore(customer: CustomerData | null | undefined) {
  return useMemo(() => {
    if (!customer) {
      return {
        level: 'green' as SemaphoreLevel,
        label: 'Nuevo',
        icon: '⚪',
        color: 'text-muted-foreground',
        bgColor: 'bg-secondary',
        description: 'Sin historial',
        canBuyOnCredit: true
      };
    }
    return calculateSemaphore(customer);
  }, [customer]);
}
