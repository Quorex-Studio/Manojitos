/**
 * useExchangeRate — Hook to manage currency exchange rates (USD/BS).
 * Uses TanStack Query for shared caching — all components see the same rate.
 * Tables: `exchange_rates`
 * Edge Function: `get-bcv-rate`
 * Returns: { rate, loading, lastUpdate, updateRate, convertToBS, convertFromBS, autoFetching, refetch }
 */
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Currency = 'USD' | 'BS';

const EXCHANGE_RATE_QUERY_KEY = ['exchange-rate'];

async function fetchRate(currency: string = 'USD') {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('currency', currency)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    rate: Number(data.rate),
    lastUpdate: new Date(data.created_at),
    currency: data.currency,
  };
}

export function useExchangeRate(currency: Currency = 'USD') {
  const queryClient = useQueryClient();
  const autoFetchAttempted = useRef<Record<string, boolean>>({});
  const [autoFetching, setAutoFetching] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [...EXCHANGE_RATE_QUERY_KEY, currency],
    queryFn: () => fetchRate(currency),
    staleTime: 1000 * 60 * 5, // 5 min — evita lecturas innecesarias
    gcTime: 1000 * 60 * 30,   // 30 min
    refetchOnWindowFocus: false,
  });

  const rate = data?.rate ?? 0;
  const lastUpdate = data?.lastUpdate ?? null;

  // Auto-fetch from BCV API if rate is outdated (>24h)
  const autoFetchBCV = async () => {
    if (autoFetchAttempted.current[currency]) return;
    autoFetchAttempted.current[currency] = true;

    setAutoFetching(true);
    try {
      const currentData = data;
      const shouldFetch = () => {
        if (!currentData) return true;
        const hoursSince = (Date.now() - currentData.lastUpdate.getTime()) / (1000 * 60 * 60);
        return hoursSince >= 24;
      };

      if (shouldFetch()) {
        const { data: result, error } = await supabase.functions.invoke('get-bcv-rate', {
          body: { currency }
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
  if (data && !autoFetchAttempted.current[currency]) {
    const hoursSince = (Date.now() - data.lastUpdate.getTime()) / (1000 * 60 * 60);
    if (hoursSince >= 24 || !data.rate) {
      autoFetchBCV();
    }
  }

  const convertToBS = (amount: number) => rate ? amount * rate : 0;
  const convertFromBS = (bs: number) => rate ? bs / rate : 0;

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
