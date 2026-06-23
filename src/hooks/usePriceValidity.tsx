/**
 * usePriceValidity — UI helper hook to determine price validity based on BCV rate age.
 * Standard validity: 30 minutes.
 * Returns: { rate, loading, lastUpdated, validity: { isValid, minutesRemaining, message, urgency } }
 */
// Hook para mostrar validez del precio según tasa BCV
import { useState, useEffect, useMemo } from 'react';
import { useExchangeRate } from './useExchangeRate';

const PRICE_VALIDITY_MINUTES = 1440; // Precio válido por 24 horas (tasa de cambio diaria)

export function usePriceValidity() {
  const { rate, loading, lastUpdate } = useExchangeRate();
  const [now, setNow] = useState(new Date());

  // Actualizar tiempo cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const validity = useMemo(() => {
    const lastUpdated = lastUpdate;
    if (!lastUpdated) {
      return {
        isValid: true,
        minutesRemaining: PRICE_VALIDITY_MINUTES,
        message: 'Calculando...',
        urgency: 'normal' as const
      };
    }

    const updatedAt = new Date(lastUpdated);
    const diffMinutes = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60));
    const minutesRemaining = Math.max(0, PRICE_VALIDITY_MINUTES - diffMinutes);
    
    let urgency: 'normal' | 'warning' | 'urgent' = 'normal';
    let message = '';
    
    if (minutesRemaining <= 10) {
      urgency = 'urgent';
      message = `¡Tasa por expirar! (${minutesRemaining} min)`;
    } else if (minutesRemaining <= 60) {
      urgency = 'warning';
      message = `Tasa expira en ${minutesRemaining} min`;
    } else {
      const hours = Math.floor(minutesRemaining / 60);
      const mins = minutesRemaining % 60;
      message = `Tasa válida por ${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
    }

    return {
      isValid: minutesRemaining > 0,
      minutesRemaining,
      message,
      urgency
    };
  }, [lastUpdate, now]);

  return {
    rate,
    loading,
    lastUpdated: lastUpdate,
    validity,
    formattedRate: rate ? `${rate.toFixed(2)} Bs/$` : 'Cargando...'
  };
}
