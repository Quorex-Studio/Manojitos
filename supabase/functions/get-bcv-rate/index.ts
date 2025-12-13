import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    // Parse request body to check for manual rate input
    let manualRate: number | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.rate && typeof body.rate === 'number' && body.rate > 0) {
          manualRate = body.rate;
        }
      } catch {
        // No body or invalid JSON, continue with BCV fetch
      }
    }

    let rate: number | null = manualRate;
    let source = manualRate ? 'manual' : 'BCV';

    // Only fetch from BCV API if no manual rate provided
    if (!manualRate) {
      console.log('Fetching BCV rate...');
      
      // Try to fetch the BCV rate from a known API
      const response = await fetch('https://pydolarve.org/api/v1/dollar?page=bcv');
      
      if (!response.ok) {
        console.error('Failed to fetch from primary API, status:', response.status);
        throw new Error('Failed to fetch exchange rate');
      }

      const data = await response.json();
      console.log('API Response:', JSON.stringify(data));

      // Extract the BCV rate from the response
      if (data && data.monitors && data.monitors.usd) {
        rate = data.monitors.usd.price;
      } else if (data && data.price) {
        rate = data.price;
      }

      if (!rate) {
        // Fallback: try alternative API
        console.log('Trying alternative API...');
        const altResponse = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        
        if (altResponse.ok) {
          const altData = await altResponse.json();
          console.log('Alternative API Response:', JSON.stringify(altData));
          if (altData && altData.promedio) {
            rate = altData.promedio;
          }
        }
      }
    }

    if (!rate) {
      throw new Error('Could not extract rate from API response');
    }

    console.log('Rate to save:', rate, 'Source:', source);

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert the rate into the database using service role (bypasses RLS)
    const { error: insertError } = await supabase
      .from('exchange_rates')
      .insert({ 
        rate: Number(rate), 
        source: source 
      });

    if (insertError) {
      console.error('Error inserting rate:', insertError);
      throw new Error('Failed to save exchange rate');
    }

    console.log('Rate saved successfully');

    return new Response(
      JSON.stringify({ 
        rate: Number(rate),
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch BCV rate';
    console.error('Error in get-bcv-rate function:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Could not retrieve the exchange rate. Please try again or enter manually.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
