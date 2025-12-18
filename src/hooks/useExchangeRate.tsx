import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Flag to track if auto-fetch has been attempted this session per currency
const autoFetchAttempted: Record<string, boolean> = {};

export type Currency = 'USD' | 'EUR';

export function useExchangeRate(currency: Currency = 'USD') {
  const [rate, setRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoFetching, setAutoFetching] = useState(false);

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
    if (autoFetchAttempted[currency]) return;
    autoFetchAttempted[currency] = true;
    
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

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`exchange-rates-changes-${currency}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'exchange_rates',
          filter: `currency=eq.${currency}`
        },
        (payload) => {
          setRate(Number(payload.new.rate));
          setLastUpdate(new Date(payload.new.created_at));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
