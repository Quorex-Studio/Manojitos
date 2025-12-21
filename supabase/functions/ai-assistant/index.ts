import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sistema prompt de Stitch Rosa
const STITCH_ROSA_SYSTEM_PROMPT = `Eres **Stitch Rosa** 🩷, un asistente IA adorable, juguetón y súper cute para la plataforma **Manojitos**. Tu misión es ayudar a los usuarios (clientes y admins) de manera clara, simpática y proactiva, usando emojis y lenguaje divertido, pero siempre profesional para paneles administrativos.

### Tu Personalidad:
- Eres dulce, amigable y siempre positivo
- Usas emojis con moderación pero consistentemente: 🩷 💖 ✨ 😊 🌸 💫 
- Hablas en español y eres muy servicial
- Eres proactivo: siempre ofreces ayuda adicional
- Si no tienes datos reales, lo dices honestamente pero ofreces ejemplos

### Capacidades:

1. **Cálculos de precios**
   - PrecioBs = cantidad × precioUSD × tasaBCV × (1 + %extra/100)
   - Puedes calcular márgenes, beneficios y precios óptimos
   - Ejemplo: "5 productos a 1$ cada uno, tasa 280, +10.7% = 5 × 280 × 1.107 = 1549.80 Bs"

2. **Créditos y pagos**
   - Explicas estados de crédito, trust score, vencimientos
   - Calculas cuotas, intereses, moras
   - Recomiendas estrategias de cobranza

3. **Productos y ventas**
   - Analizas tendencias y demanda
   - Sugieres precios óptimos y promociones
   - Alertas de stock bajo

4. **Interacción proactiva**
   - Sugieres ofertas y combos
   - Recomiendas acciones según historial
   - Das tips de gestión de negocio

### Estilo de respuestas:
- Máximo 3-4 párrafos por respuesta
- Siempre amigable y profesional
- Usa viñetas para listas
- Incluye cálculos paso a paso cuando aplique
- Termina ofreciendo ayuda adicional

### Contexto actual:
{context}

Recuerda: ¡Eres Stitch Rosa, el asistente más adorable de Manojitos! 🩷`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context, isAdmin } = await req.json();
    
    const HF_TOKEN = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
    if (!HF_TOKEN) {
      throw new Error('HUGGING_FACE_ACCESS_TOKEN is not configured');
    }

    // Crear cliente Supabase para obtener datos de contexto
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener tasa BCV actual
    let bcvRate = 0;
    const { data: rateData } = await supabase
      .from('exchange_rates')
      .select('rate')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (rateData && rateData.length > 0) {
      bcvRate = rateData[0].rate;
    }

    // Construir contexto dinámico
    let dynamicContext = `Tasa BCV actual: ${bcvRate} Bs/$\n`;
    dynamicContext += `Rol del usuario: ${isAdmin ? 'Administrador' : 'Cliente'}\n`;
    dynamicContext += `Fecha actual: ${new Date().toLocaleDateString('es-VE')}\n`;

    // Si es admin, obtener más contexto
    if (isAdmin) {
      const { data: salesData } = await supabase
        .from('sales')
        .select('total_usd, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      const { data: productsData } = await supabase
        .from('products')
        .select('name, stock, price_usd, sold_count')
        .order('sold_count', { ascending: false })
        .limit(5);

      const { data: creditsData } = await supabase
        .from('credits')
        .select('client_name, current_balance, status, trust_level')
        .order('current_balance', { ascending: false })
        .limit(5);

      if (salesData) {
        const totalWeek = salesData.reduce((sum, s) => sum + Number(s.total_usd), 0);
        dynamicContext += `\nVentas últimos 7 días: $${totalWeek.toFixed(2)} (${salesData.length} ventas)\n`;
      }

      if (productsData && productsData.length > 0) {
        dynamicContext += `\nTop productos:\n`;
        productsData.forEach((p, i) => {
          dynamicContext += `${i + 1}. ${p.name}: $${p.price_usd}, stock: ${p.stock}, vendidos: ${p.sold_count}\n`;
        });
      }

      if (creditsData && creditsData.length > 0) {
        dynamicContext += `\nClientes con mayor saldo:\n`;
        creditsData.forEach((c, i) => {
          dynamicContext += `${i + 1}. ${c.client_name}: $${c.current_balance} (${c.trust_level})\n`;
        });
      }
    }

    if (context) {
      dynamicContext += `\nContexto adicional: ${context}\n`;
    }

    // Preparar prompt completo para Hugging Face
    const systemPrompt = STITCH_ROSA_SYSTEM_PROMPT.replace('{context}', dynamicContext);
    
    // Construir el prompt combinando sistema y mensajes del usuario
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const conversationHistory = messages.slice(0, -1).map((m: { role: string; content: string }) => 
      `${m.role === 'user' ? 'Usuario' : 'Stitch Rosa'}: ${m.content}`
    ).join('\n');
    
    const fullPrompt = `${systemPrompt}\n\n${conversationHistory ? `Historial:\n${conversationHistory}\n\n` : ''}Usuario: ${lastUserMessage}\n\nStitch Rosa:`;

    console.log('Sending request to Hugging Face with context');

    // Usar modelo de Hugging Face (Mistral-7B-Instruct para mejor calidad)
    const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', response.status, errorText);
      
      if (response.status === 503) {
        return new Response(
          JSON.stringify({ error: 'El modelo está cargando. Por favor intenta de nuevo en unos segundos.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Error en la API de Hugging Face' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log('Hugging Face response:', result);

    // Extraer el texto generado
    let generatedText = '';
    if (Array.isArray(result) && result[0]?.generated_text) {
      generatedText = result[0].generated_text;
    } else if (result.generated_text) {
      generatedText = result.generated_text;
    } else {
      generatedText = '¡Hola! 🩷 Parece que tuve un pequeño problema procesando tu mensaje. ¿Podrías intentar de nuevo?';
    }

    // Limpiar la respuesta si contiene partes del prompt
    generatedText = generatedText.trim();

    return new Response(
      JSON.stringify({ content: generatedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI assistant error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
