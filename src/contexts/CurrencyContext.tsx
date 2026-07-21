import React, { createContext, useContext, useEffect, useState } from 'react';

export type DisplayCurrency = 'USD' | 'VES' | 'EUR';

interface CurrencyContextType {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>(() => {
    const saved = localStorage.getItem('manojitos_display_currency');
    return (saved === 'USD' || saved === 'VES' || saved === 'EUR') ? saved : 'USD';
  });

  useEffect(() => {
    localStorage.setItem('manojitos_display_currency', displayCurrency);
  }, [displayCurrency]);

  return (
    <CurrencyContext.Provider value={{ displayCurrency, setDisplayCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
