import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useExchangeRate() {
  const [rate, setRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchRate = async () => {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && !error) {
      setRate(Number(data.rate));
      setLastUpdate(new Date(data.created_at));
    }
    setLoading(false);
  };

  const updateRate = async (newRate: number) => {
    const { error } = await supabase
      .from('exchange_rates')
      .insert({ rate: newRate, source: 'manual' });

    if (!error) {
      setRate(newRate);
      setLastUpdate(new Date());
    }
    return { error };
  };

  useEffect(() => {
    fetchRate();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('exchange-rates-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'exchange_rates'
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
  }, []);

  const convertToBS = (usd: number) => rate ? usd * rate : 0;
  const convertToUSD = (bs: number) => rate ? bs / rate : 0;

  return { rate, loading, lastUpdate, updateRate, convertToBS, convertToUSD, refetch: fetchRate };
}
