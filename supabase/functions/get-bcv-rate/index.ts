import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body to check for manual rate input and currency
    let manualRate: number | null = null;
    let currency = 'USD'; // Default to USD
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.rate && typeof body.rate === 'number' && body.rate > 0) {
          manualRate = body.rate;
        }
        if (body.currency && (body.currency === 'USD' || body.currency === 'EUR')) {
          currency = body.currency;
        }
      } catch {
        // No body or invalid JSON, continue with BCV fetch
      }
    }

    let rate: number | null = manualRate;
    let source = manualRate ? 'manual' : 'BCV';

    // Only fetch from BCV API if no manual rate provided
    if (!manualRate) {
      console.log(`Fetching ${currency} rate from APIs...`);
      
      // Try multiple API sources with timeout
      const fetchWithTimeout = async (url: string, timeoutMs = 5000) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
          return response;
        } catch (e) {
          clearTimeout(timeout);
          throw e;
        }
      };

      // Try exchangerate-api.com as primary (more reliable)
      try {
        console.log(`Trying exchangerate-api.com for ${currency}...`);
        const response = await fetchWithTimeout(`https://v6.exchangerate-api.com/v6/latest/${currency}`);
        if (response.ok) {
          const data = await response.json();
          if (data.conversion_rates?.VES) {
            rate = data.conversion_rates.VES;
            console.log(`Got ${currency} rate from exchangerate-api:`, rate);
          }
        }
      } catch (e) {
        console.log('exchangerate-api failed:', e);
      }

      // Try alternative if first failed
      if (!rate) {
        try {
          console.log(`Trying alternative API for ${currency}...`);
          const response = await fetchWithTimeout(`https://open.er-api.com/v6/latest/${currency}`);
          if (response.ok) {
            const data = await response.json();
            if (data.rates?.VES) {
              rate = data.rates.VES;
              console.log(`Got ${currency} rate from open.er-api:`, rate);
            }
          }
        } catch (e) {
          console.log('open.er-api failed:', e);
        }
      }

      // If all APIs fail, return error asking for manual input
      if (!rate) {
        return new Response(
          JSON.stringify({ 
            error: 'No se pudo obtener la tasa automáticamente',
            details: 'Por favor, ingresa la tasa manualmente.',
            requiresManualInput: true
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 503 
          }
        );
      }
    }

    console.log('Rate to save:', rate, 'Currency:', currency, 'Source:', source);

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert the rate into the database using service role (bypasses RLS)
    const { error: insertError } = await supabase
      .from('exchange_rates')
      .insert({ 
        rate: Number(rate), 
        source: source,
        currency: currency
      });

    if (insertError) {
      console.error('Error inserting rate:', insertError);
      throw new Error('Failed to save exchange rate');
    }

    console.log('Rate saved successfully');

    return new Response(
      JSON.stringify({ 
        rate: Number(rate),
        currency: currency,
        source: source,
        timestamp: new Date().toISOString(),
        saved: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process exchange rate';
    console.error('Error in get-bcv-rate function:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Por favor, ingresa la tasa manualmente.',
        requiresManualInput: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
