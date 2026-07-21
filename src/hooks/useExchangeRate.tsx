/**
 * useExchangeRate — Hook to manage currency exchange rates (USD/BS).
 * Uses TanStack Query for shared caching — all components see the same rate.
 * Tables: `exchange_rates`
 * Edge Function: `get-bcv-rate`
 * Returns: { rate, loading, lastUpdate, updateRate, convertToBS, convertFromBS, autoFetching, refetch }
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Currency = 'USD' | 'EUR' | 'VES';

const EXCHANGE_RATE_QUERY_KEY = ['exchange-rates-all'];

async function fetchRates() {
  const { data: usdData, error: usdError } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('currency', 'USD')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: eurData, error: eurError } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('currency', 'EUR')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (usdError) throw usdError;
  // No lanzamos error si no hay EUR, puede que aún no se haya insertado nunca

  return {
    USD: usdData ? { rate: Number(usdData.rate), lastUpdate: new Date(usdData.created_at) } : null,
    EUR: eurData ? { rate: Number(eurData.rate), lastUpdate: new Date(eurData.created_at) } : null,
  };
}

export function useExchangeRate(requestedCurrency: 'USD' | 'EUR' = 'USD') {
  const queryClient = useQueryClient();
  const autoFetchAttempted = useRef<Record<string, boolean>>({});
  const [autoFetching, setAutoFetching] = useState(false);

  const { data: rates, isLoading, refetch } = useQuery({
    queryKey: EXCHANGE_RATE_QUERY_KEY,
    queryFn: fetchRates,
    staleTime: 1000 * 60 * 5, // 5 min
    gcTime: 1000 * 60 * 30,   // 30 min
    refetchOnWindowFocus: false,
  });

  const rateInfo = requestedCurrency === 'EUR' ? rates?.EUR : rates?.USD;
  const rate = rateInfo?.rate ?? 0;
  const lastUpdate = rateInfo?.lastUpdate ?? null;

  // Auto-fetch from BCV API if rate is outdated (>24h)
  const autoFetchBCV = async () => {
    if (autoFetchAttempted.current[requestedCurrency]) return;
    autoFetchAttempted.current[requestedCurrency] = true;

    setAutoFetching(true);
    try {
      const currentData = rateInfo;
      const shouldFetch = () => {
        if (!currentData) return true;
        const hoursSince = (Date.now() - currentData.lastUpdate.getTime()) / (1000 * 60 * 60);
        return hoursSince >= 24;
      };

      if (shouldFetch()) {
        const { data: result, error } = await supabase.functions.invoke('get-bcv-rate', {
          body: { currency: requestedCurrency }
        });
        if (!error && result?.saved) {
          // Invalidate to refetch from DB
          queryClient.invalidateQueries({ queryKey: EXCHANGE_RATE_QUERY_KEY });
        }
      }
    } catch {
      // Silent fail — user can manually refetch
    } finally {
      setAutoFetching(false);
    }
  };

  // Trigger auto-fetch on mount if needed
  useEffect(() => {
    if (isLoading) return;

    if (!autoFetchAttempted.current[requestedCurrency]) {
      if (!rateInfo || !rateInfo.rate) {
        autoFetchBCV();
      } else {
        const hoursSince = (Date.now() - rateInfo.lastUpdate.getTime()) / (1000 * 60 * 60);
        if (hoursSince >= 24) {
          autoFetchBCV();
        }
      }
    }
  }, [rates, isLoading, requestedCurrency]);

  const convertToBS = (amount: number) => rate ? amount * rate : 0;
  const convertFromBS = (bs: number) => rate ? bs / rate : 0;
  
  // Para PriceDisplay.tsx (calcula todas las monedas de un solo tiro desde el precio base en USD)
  const calculateAllCurrencies = (amountUsd: number) => {
    const usdRate = rates?.USD?.rate || 0;
    const eurRate = rates?.EUR?.rate || 0;
    
    const ves = amountUsd * usdRate;
    const eur = (usdRate > 0 && eurRate > 0) ? ves / eurRate : 0;
    
    return {
      USD: amountUsd,
      VES: ves,
      EUR: eur
    };
  };

  return {
    rate,
    loading: isLoading,
    lastUpdate,
    updateRate: async () => {
      await autoFetchBCV();
      await refetch();
    },
    convertToBS,
    convertFromBS,
    refetch,
    autoFetching,
    currency,
  };
}
