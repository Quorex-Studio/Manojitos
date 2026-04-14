/**
 * useExchangeRate — Hook to manage currency exchange rates (USD/BS).
 * Includes auto-fetch from BCV API via Edge Function.
 * Tables: `exchange_rates`
 * Edge Function: `get-bcv-rate`
 * Returns: { rate, loading, lastUpdate, updateRate, convertToBS, convertFromBS, autoFetching }
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useExchangeRate(currency: Currency = 'USD') {
  const [rate, setRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoFetching, setAutoFetching] = useState(false);
  const autoFetchAttempted = useRef<Record<string, boolean>>({});

  const fetchRate = async () => {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('currency', currency)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && !error) {
      setRate(Number(data.rate));
      setLastUpdate(new Date(data.created_at));
    } else {
      setRate(0);
      setLastUpdate(null);
    }
    setLoading(false);
    return data;
  };

  // Auto-fetch from BCV API if rate is missing or outdated
  const autoFetchBCV = async () => {
    if (autoFetchAttempted.current[currency]) return;
    autoFetchAttempted.current[currency] = true;

    setAutoFetching(true);
    try {
      console.log(`Auto-fetching ${currency} rate...`);
      const { data, error } = await supabase.functions.invoke('get-bcv-rate', {
        body: { currency }
      });

      if (!error && data?.saved) {
        console.log(`${currency} rate auto-updated:`, data.rate);
        await fetchRate();
      }
    } catch (error) {
      console.log('Auto-fetch failed, will use existing rate or manual input');
    } finally {
      setAutoFetching(false);
    }
  };

  // Note: Direct inserts are blocked by RLS. Use the get-bcv-rate edge function instead.
  const updateRate = async (newRate: number) => {
    console.warn('Direct rate updates are deprecated. Use the get-bcv-rate edge function.');
    const { error } = await supabase
      .from('exchange_rates')
      .insert({ rate: newRate, source: 'manual', currency });

    if (!error) {
      setRate(newRate);
      setLastUpdate(new Date());
    }
    return { error };
  };

  useEffect(() => {
    const initializeRate = async () => {
      setLoading(true);
      const currentData = await fetchRate();

      // Auto-fetch if no rate exists or rate is older than 24 hours
      const shouldAutoFetch = () => {
        if (!currentData) return true;

        const lastUpdateTime = new Date(currentData.created_at);
        const hoursSinceUpdate = (Date.now() - lastUpdateTime.getTime()) / (1000 * 60 * 60);
        return hoursSinceUpdate >= 24;
      };

      if (shouldAutoFetch()) {
        autoFetchBCV();
      }
    };

    initializeRate();

    // Polling cada 60s en lugar de realtime para evitar conflictos de canal
    const interval = setInterval(fetchRate, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [currency]);

  const convertToBS = (amount: number) => rate ? amount * rate : 0;
  const convertFromBS = (bs: number) => rate ? bs / rate : 0;

  return {
    rate,
    loading,
    lastUpdate,
    updateRate,
    convertToBS,
    convertFromBS,
    refetch: fetchRate,
    autoFetching,
    currency
  };
}
