// Hook para calcular semáforo de clientes (confianza)
import { useMemo } from 'react';

export type SemaphoreLevel = 'green' | 'yellow' | 'red';

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
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
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
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
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
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      description: 'Algunos pagos tardíos',
      canBuyOnCredit: true
    };
  }

  // 🟢 Buen pagador
  return {
    level: 'green',
    label: 'Excelente',
    icon: '🟢',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
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
        color: 'text-gray-600',
        bgColor: 'bg-gray-100 dark:bg-gray-900/30',
        description: 'Sin historial',
        canBuyOnCredit: true
      };
    }
    return calculateSemaphore(customer);
  }, [customer]);
}
