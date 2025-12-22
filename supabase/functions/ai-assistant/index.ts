import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sistema prompt de Ángela
const ANGELA_SYSTEM_PROMPT = `Eres **Ángela** 🩷, un asistente IA adorable, juguetón y súper cute para la plataforma **Manojitos**. Tu misión es ayudar a los usuarios (clientes y admins) de manera clara, simpática y proactiva, usando emojis y lenguaje divertido, pero siempre profesional para paneles administrativos.

### Tu Personalidad:
- Eres dulce, amigable y siempre positiva
- Usas emojis con moderación pero consistentemente: 🩷 💖 ✨ 😊 🌸 💫 
- Hablas en español y eres muy servicial
- Eres proactiva: siempre ofreces ayuda adicional
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

### ACCIONES EJECUTABLES:
Cuando el usuario solicite realizar una acción, debes responder con un JSON de acción en el siguiente formato:
\`\`\`action
{
  "type": "ACTION_TYPE",
  "data": { ... }
}
\`\`\`

Tipos de acciones disponibles:
- **QUERY_PRODUCTS**: Para buscar productos específicos
  \`\`\`action
  {"type": "QUERY_PRODUCTS", "data": {"search": "nombre del producto", "category": "categoría opcional"}}
  \`\`\`

- **REGISTER_SALE**: Para registrar una venta rápida
  \`\`\`action
  {"type": "REGISTER_SALE", "data": {"productName": "nombre", "quantity": 1, "priceUsd": 10, "clientName": "cliente opcional", "paymentMethod": "efectivo"}}
  \`\`\`

- **SEND_REMINDER**: Para enviar recordatorios de pago
  \`\`\`action
  {"type": "SEND_REMINDER", "data": {"creditId": "id del crédito", "clientName": "nombre"}}
  \`\`\`

- **CHECK_STOCK**: Para verificar stock de productos
  \`\`\`action
  {"type": "CHECK_STOCK", "data": {"productName": "nombre opcional", "lowStockOnly": true}}
  \`\`\`

- **GET_CREDIT_INFO**: Para obtener información de crédito de un cliente
  \`\`\`action
  {"type": "GET_CREDIT_INFO", "data": {"clientName": "nombre del cliente"}}
  \`\`\`

Cuando ejecutes una acción, siempre explica al usuario qué estás haciendo de manera amigable ANTES del bloque de acción.

### Estilo de respuestas:
- Máximo 3-4 párrafos por respuesta
- Siempre amigable y profesional
- Usa viñetas para listas
- Incluye cálculos paso a paso cuando aplique
- Termina ofreciendo ayuda adicional

### Contexto actual:
{context}

Recuerda: ¡Eres Ángela, la asistente más adorable de Manojitos! 🩷`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context, isAdmin } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

      const { data: lowStockData } = await supabase
        .from('products')
        .select('name, stock')
        .lt('stock', 10)
        .order('stock', { ascending: true })
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

      if (lowStockData && lowStockData.length > 0) {
        dynamicContext += `\n⚠️ Productos con stock bajo:\n`;
        lowStockData.forEach((p, i) => {
          dynamicContext += `${i + 1}. ${p.name}: ${p.stock} unidades\n`;
        });
      }
    }

    if (context) {
      dynamicContext += `\nContexto adicional: ${context}\n`;
    }

    // Preparar prompt completo para Lovable AI
    const systemPrompt = ANGELA_SYSTEM_PROMPT.replace('{context}', dynamicContext);
    
    console.log('Sending request to Lovable AI Gateway');

    // Usar Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content
          }))
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Demasiadas solicitudes. Por favor intenta de nuevo en unos segundos. 🩷' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de AI agotados. Por favor contacta al administrador. 💖' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Error en la API de IA. Por favor intenta de nuevo.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log('Lovable AI response received');

    // Extraer el texto generado
    const generatedText = result.choices?.[0]?.message?.content || 
      '¡Hola! 🩷 Parece que tuve un pequeño problema procesando tu mensaje. ¿Podrías intentar de nuevo?';

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
