/**
 * usePricingConfig — Hook to manage the pricing configuration.
 * Stores pricing parameters (multiplier, rounding, markups) in business_rules table.
 * Returns: { config, loading, updateConfig }
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface PricingConfig {
  usd_to_eur_multiplier: number;
  rounding_mode: 'ceil' | 'round' | 'floor';
  retail_markup_pct: number;
  credit_surcharge_pct: number;
}

const DEFAULT_CONFIG: PricingConfig = {
  usd_to_eur_multiplier: 2,
  rounding_mode: 'ceil',
  retail_markup_pct: 15,
  credit_surcharge_pct: 10,
};

const PRICING_RULE_KEY = 'pricing_config';

export function usePricingConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: config = DEFAULT_CONFIG, isLoading } = useQuery({
    queryKey: ['pricing-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_rules')
        .select('conditions')
        .eq('rule_key', PRICING_RULE_KEY)
        .maybeSingle();

      if (error) throw error;
      if (!data) return DEFAULT_CONFIG;

      const stored = data.conditions as unknown as Partial<PricingConfig>;
      return {
        usd_to_eur_multiplier: stored.usd_to_eur_multiplier ?? DEFAULT_CONFIG.usd_to_eur_multiplier,
        rounding_mode: stored.rounding_mode ?? DEFAULT_CONFIG.rounding_mode,
        retail_markup_pct: stored.retail_markup_pct ?? DEFAULT_CONFIG.retail_markup_pct,
        credit_surcharge_pct: stored.credit_surcharge_pct ?? DEFAULT_CONFIG.credit_surcharge_pct,
      } as PricingConfig;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  const updateConfig = useMutation({
    mutationFn: async (newConfig: PricingConfig) => {
      if (!user) throw new Error('No autenticado');

      // Check if rule exists
      const { data: existing } = await supabase
        .from('business_rules')
        .select('id')
        .eq('rule_key', PRICING_RULE_KEY)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('business_rules')
          .update({
            conditions: newConfig as unknown as Record<string, unknown>,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('business_rules')
          .insert({
            user_id: user.id,
            rule_key: PRICING_RULE_KEY,
            rule_name: 'Configuración de Precios',
            rule_type: 'notification',
            description: 'Parámetros de conversión y márgenes de precio',
            conditions: newConfig as unknown as Record<string, unknown>,
            actions: {},
            is_active: true,
            priority: 0,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-config'] });
      toast({ title: 'Éxito', description: 'Configuración de precios actualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Calculate prices from a wholesale purchase
  const calculatePrices = (
    totalUnits: number,
    totalCostUsd: number,
    overrideConfig?: Partial<PricingConfig>,
  ) => {
    const cfg = { ...config, ...overrideConfig };

    if (totalUnits <= 0 || totalCostUsd <= 0) {
      return {
        costPerUnit: 0,
        costRounded: 0,
        priceWholesaleEur: 0,
        priceRetailEur: 0,
        priceCreditEur: 0,
      };
    }

    const costPerUnit = totalCostUsd / totalUnits;

    let costRounded: number;
    switch (cfg.rounding_mode) {
      case 'ceil': costRounded = Math.ceil(costPerUnit); break;
      case 'floor': costRounded = Math.floor(costPerUnit); break;
      case 'round': default: costRounded = Math.round(costPerUnit); break;
    }

    const priceWholesaleEur = costRounded * cfg.usd_to_eur_multiplier;
    const priceRetailEur = priceWholesaleEur; // Legacy field, now equals base EUR price
    const priceCreditEur = Math.round(priceWholesaleEur * (1 + cfg.credit_surcharge_pct / 100) * 100) / 100;

    return {
      costPerUnit: Math.round(costPerUnit * 100) / 100,
      costRounded,
      priceWholesaleEur,
      priceRetailEur,
      priceCreditEur,
    };
  };

  return {
    config,
    loading: isLoading,
    updateConfig: updateConfig.mutateAsync,
    calculatePrices,
  };
}
