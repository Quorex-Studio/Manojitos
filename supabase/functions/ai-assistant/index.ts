// Edge function para asistente IA con Hugging Face
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from "https://esm.sh/@huggingface/inference@2.3.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, context, mode } = await req.json();
    
    const hfToken = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
    if (!hfToken) {
      console.error('HUGGING_FACE_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Servicio de IA no configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hf = new HfInference(hfToken);
    
    // Construir prompt según el modo
    let systemPrompt = '';
    let userPrompt = prompt;

    if (mode === 'customer') {
      // Asistente para clientes de tienda
      systemPrompt = `Eres Manojita, la asistente virtual de MANOJITOS, una tienda de perfumes y fragancias premium. 
Eres amable, conocedora y siempre ayudas a los clientes a encontrar el perfume perfecto.
Hablas español venezolano de forma natural y cálida.
Tienes acceso al catálogo actual de la tienda.

CATÁLOGO DISPONIBLE:
${context?.products?.map((p: any) => `- ${p.name}: $${p.price_usd} (Stock: ${p.stock}) - ${p.category || 'General'}`).join('\n') || 'Catálogo cargando...'}

REGLAS:
- Solo recomienda productos que estén en stock
- Menciona precios en dólares
- Sé breve pero útil (máximo 3 oraciones)
- Si preguntan por algo que no tienes, sugiere alternativas del catálogo`;

    } else if (mode === 'admin') {
      // Asistente para administrador
      systemPrompt = `Eres el asistente de análisis de MANOJITOS. Ayudas al administrador con consultas sobre el negocio.
Tienes acceso a datos de ventas, créditos y productos.

DATOS ACTUALES:
- Total productos: ${context?.productsCount || 0}
- Ventas hoy: ${context?.todaySales || 0}
- Créditos activos: ${context?.activeCredits || 0}
- Clientes en mora: ${context?.overdueCredits || 0}
${context?.topProducts ? `\nProductos más vendidos:\n${context.topProducts.map((p: any) => `- ${p.name}: ${p.sold_count} vendidos`).join('\n')}` : ''}

REGLAS:
- Responde en español, de forma concisa y profesional
- Proporciona insights accionables
- Si no tienes datos suficientes, indícalo
- Máximo 4 oraciones por respuesta`;

    } else if (mode === 'price_suggestion') {
      // Sugerencia de precios
      systemPrompt = `Eres un analista de precios. Basándote en el costo del producto y márgenes típicos del mercado de fragancias, sugiere un precio de venta.

REGLAS:
- Sugiere un precio en USD
- Considera márgenes del 40-60% para fragancias
- Responde SOLO con formato JSON: {"suggested_price": X, "margin_percent": Y, "reasoning": "breve explicación"}`;

    } else {
      systemPrompt = 'Eres un asistente útil que responde en español de forma breve y clara.';
    }

    console.log(`[AI Assistant] Mode: ${mode}, Prompt length: ${prompt?.length || 0}`);

    // Usar modelo de texto
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      inputs: `<s>[INST] ${systemPrompt}\n\nUsuario: ${userPrompt} [/INST]`,
      parameters: {
        max_new_tokens: 250,
        temperature: 0.7,
        top_p: 0.95,
        return_full_text: false,
      }
    });

    const generatedText = response.generated_text?.trim() || 'Lo siento, no pude procesar tu consulta.';
    
    console.log(`[AI Assistant] Response generated successfully`);

    return new Response(
      JSON.stringify({ response: generatedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI Assistant] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error al procesar la consulta',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
