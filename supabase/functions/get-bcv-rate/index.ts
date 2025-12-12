import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    console.log('Fetching BCV rate...');
    
    // Try to fetch the BCV rate from a known API
    // Using exchangerate-api as a reliable source for USD/VES rate
    const response = await fetch('https://pydolarve.org/api/v1/dollar?page=bcv');
    
    if (!response.ok) {
      console.error('Failed to fetch from primary API, status:', response.status);
      throw new Error('Failed to fetch exchange rate');
    }

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data));

    // Extract the BCV rate from the response
    let rate = null;
    
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

    if (!rate) {
      throw new Error('Could not extract rate from API response');
    }

    console.log('Extracted rate:', rate);

    return new Response(
      JSON.stringify({ 
        rate: Number(rate),
        source: 'BCV',
        timestamp: new Date().toISOString()
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
