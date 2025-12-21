// Hook para mostrar validez del precio según tasa BCV
import { useState, useEffect, useMemo } from 'react';
import { useExchangeRate } from './useExchangeRate';

const PRICE_VALIDITY_MINUTES = 30; // Precio válido por 30 minutos

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
    let message = `Precio válido por ${minutesRemaining} min`;
    
    if (minutesRemaining <= 5) {
      urgency = 'urgent';
      message = `¡Precio válido por ${minutesRemaining} min!`;
    } else if (minutesRemaining <= 10) {
      urgency = 'warning';
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
