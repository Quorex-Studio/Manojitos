import React from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useExchangeRate } from '@/hooks/useExchangeRate';

interface PriceDisplayProps {
  amountUsd: number;
  className?: string;     // Clase para el contenedor
  primaryClassName?: string; // Clase para la moneda principal
  secondaryClassName?: string; // Clase para la moneda secundaria
  showSecondary?: boolean; // Si queremos mostrar las monedas secundarias o no
}

export function PriceDisplay({ 
  amountUsd, 
  className = "flex flex-col", 
  primaryClassName = "text-xl font-bold", 
  secondaryClassName = "text-sm text-muted-foreground",
  showSecondary = true
}: PriceDisplayProps) {
  const { displayCurrency } = useCurrency();
  const { calculateAllCurrencies } = useExchangeRate(displayCurrency === 'EUR' ? 'EUR' : 'USD'); 

  const { USD, VES, EUR } = calculateAllCurrencies(amountUsd);

  // Funciones de formateo rápido
  const formatUSD = (val: number) => `$${val.toFixed(2)}`;
  const formatVES = (val: number) => `Bs. ${val.toFixed(2)}`;
  const formatEUR = (val: number) => `€${val.toFixed(2)}`;

  let PrimaryComponent = null;
  let SecondaryComponent = null;

  switch (displayCurrency) {
    case 'VES':
      PrimaryComponent = <span className={primaryClassName}>{formatVES(VES)}</span>;
      if (showSecondary) {
        SecondaryComponent = (
          <div className="flex gap-2">
            <span className={secondaryClassName}>({formatUSD(USD)})</span>
            {EUR > 0 && <span className={secondaryClassName}>({formatEUR(EUR)})</span>}
          </div>
        );
      }
      break;
    
    case 'EUR':
      PrimaryComponent = <span className={primaryClassName}>{EUR > 0 ? formatEUR(EUR) : 'Cargando...'}</span>;
      if (showSecondary) {
        SecondaryComponent = (
          <div className="flex gap-2">
            <span className={secondaryClassName}>({formatUSD(USD)})</span>
            <span className={secondaryClassName}>({formatVES(VES)})</span>
          </div>
        );
      }
      break;

    case 'USD':
    default:
      PrimaryComponent = <span className={primaryClassName}>{formatUSD(USD)}</span>;
      if (showSecondary) {
        SecondaryComponent = (
          <div className="flex gap-2">
            <span className={secondaryClassName}>({formatVES(VES)})</span>
            {EUR > 0 && <span className={secondaryClassName}>({formatEUR(EUR)})</span>}
          </div>
        );
      }
      break;
  }

  return (
    <div className={className}>
      {PrimaryComponent}
      {SecondaryComponent}
    </div>
  );
}
