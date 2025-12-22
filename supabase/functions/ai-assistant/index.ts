import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Crear cliente Supabase
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseKey);
}

// ================== HANDLERS DE ACCIONES ==================

async function handleQueryProducts(data: { search?: string; category?: string }) {
  const supabase = getSupabaseClient();
  let query = supabase.from('products').select('id, name, price_usd, stock, category, description');
  
  if (data.search) {
    query = query.ilike('name', `%${data.search}%`);
  }
  if (data.category) {
    query = query.eq('category', data.category);
  }
  
  const { data: products, error } = await query.limit(10);
  
  if (error) throw error;
  return { success: true, message: `Encontré ${products?.length || 0} productos`, data: products };
}

async function handleRegisterSale(data: { 
  productName: string; 
  quantity: number; 
  priceUsd: number; 
  clientName?: string; 
  paymentMethod: string;
  adminUserId: string;
}) {
  const supabase = getSupabaseClient();
  
  // Buscar producto por nombre
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price_usd, stock')
    .ilike('name', `%${data.productName}%`)
    .limit(1);
  
  const product = products?.[0];
  
  if (!product) {
    return { success: false, message: `No encontré el producto "${data.productName}"` };
  }
  
  if (product.stock < data.quantity) {
    return { success: false, message: `Stock insuficiente. Solo hay ${product.stock} unidades de ${product.name}` };
  }
  
  const totalUsd = data.quantity * (data.priceUsd || product.price_usd);
  
  // Obtener tasa BCV
  const { data: rateData } = await supabase
    .from('exchange_rates')
    .select('rate')
    .order('created_at', { ascending: false })
    .limit(1);
  
  const bcvRate = rateData?.[0]?.rate || 0;
  const totalBs = totalUsd * bcvRate;
  
  // Insertar venta
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      product_id: product.id,
      product_name: product.name,
      quantity: data.quantity,
      unit_price_usd: data.priceUsd || product.price_usd,
      total_usd: totalUsd,
      total_bs: totalBs,
      payment_method: data.paymentMethod,
      client_name: data.clientName || null,
      user_id: data.adminUserId,
      status: 'confirmed'
    })
    .select()
    .single();
  
  if (saleError) throw saleError;
  
  // Actualizar stock
  await supabase
    .from('products')
    .update({ 
      stock: product.stock - data.quantity,
      sold_count: product.stock + data.quantity 
    })
    .eq('id', product.id);
  
  return { 
    success: true, 
    message: `✅ Venta registrada: ${data.quantity}x ${product.name} por $${totalUsd.toFixed(2)} (${totalBs.toFixed(2)} Bs)`,
    data: sale
  };
}

async function handleSendReminder(data: { creditId?: string; clientName?: string }) {
  const supabase = getSupabaseClient();
  
  let creditQuery = supabase
    .from('credits')
    .select('id, client_name, client_phone, current_balance, next_due_date, status');
  
  if (data.creditId) {
    creditQuery = creditQuery.eq('id', data.creditId);
  } else if (data.clientName) {
    creditQuery = creditQuery.ilike('client_name', `%${data.clientName}%`);
  }
  
  const { data: credits, error } = await creditQuery.limit(1);
  
  if (error) throw error;
  if (!credits?.length) {
    return { success: false, message: 'No encontré el crédito especificado' };
  }
  
  const credit = credits[0];
  
  // Crear recordatorio
  const message = `Hola ${credit.client_name}, te recordamos que tienes un saldo pendiente de $${credit.current_balance}. Fecha de vencimiento: ${credit.next_due_date || 'Por definir'}. ¡Gracias por tu preferencia! - Manojitos 🩷`;
  
  const { error: reminderError } = await supabase
    .from('credit_reminders')
    .insert({
      credit_id: credit.id,
      reminder_type: 'MANUAL',
      message: message,
      channel: 'INTERNAL',
      delivery_status: 'pending'
    });
  
  if (reminderError) throw reminderError;
  
  return { 
    success: true, 
    message: `📧 Recordatorio enviado a ${credit.client_name}` 
  };
}

async function handleCheckStock(data: { productName?: string; lowStockOnly?: boolean }) {
  const supabase = getSupabaseClient();
  
  let query = supabase.from('products').select('name, stock, price_usd, category');
  
  if (data.productName) {
    query = query.ilike('name', `%${data.productName}%`);
  }
  
  if (data.lowStockOnly) {
    query = query.lt('stock', 10);
  }
  
  const { data: products, error } = await query.order('stock', { ascending: true }).limit(10);
  
  if (error) throw error;
  
  if (!products?.length) {
    return { success: true, message: 'No hay productos con stock bajo 🎉', data: [] };
  }
  
  const stockList = products.map(p => `• ${p.name}: ${p.stock} unidades`).join('\n');
  return { 
    success: true, 
    message: `📦 Estado de stock:\n${stockList}`,
    data: products 
  };
}

async function handleGetCreditInfo(data: { clientName: string }) {
  const supabase = getSupabaseClient();
  
  const { data: credits, error } = await supabase
    .from('credits')
    .select('*')
    .ilike('client_name', `%${data.clientName}%`)
    .limit(1);
  
  if (error) throw error;
  if (!credits?.length) {
    return { success: false, message: `No encontré créditos para "${data.clientName}"` };
  }
  
  const credit = credits[0];
  const info = `💳 **Crédito de ${credit.client_name}**
• Límite: $${credit.credit_limit}
• Saldo actual: $${credit.current_balance}
• Disponible: $${credit.credit_limit - credit.current_balance}
• Estado: ${credit.status}
• Nivel de confianza: ${credit.trust_level} (${credit.trust_score}/100)
• Próximo vencimiento: ${credit.next_due_date || 'Sin fecha'}
• Bloqueado: ${credit.is_blocked ? '⛔ Sí' : '✅ No'}`;

  return { success: true, message: info, data: credit };
}

// ================== PROCESAR ACCIÓN ==================

async function processAction(actionType: string, actionData: Record<string, unknown>, adminUserId?: string) {
  try {
    switch (actionType) {
      case 'QUERY_PRODUCTS':
        return await handleQueryProducts(actionData as { search?: string; category?: string });
      
      case 'REGISTER_SALE':
        if (!adminUserId) {
          return { success: false, message: 'Se requiere autenticación de admin para registrar ventas' };
        }
        return await handleRegisterSale({ ...actionData, adminUserId } as any);
      
      case 'SEND_REMINDER':
        return await handleSendReminder(actionData as { creditId?: string; clientName?: string });
      
      case 'CHECK_STOCK':
        return await handleCheckStock(actionData as { productName?: string; lowStockOnly?: boolean });
      
      case 'GET_CREDIT_INFO':
        return await handleGetCreditInfo(actionData as { clientName: string });
      
      default:
        return { success: false, message: `Acción desconocida: ${actionType}` };
    }
  } catch (error) {
    console.error('Action error:', error);
    return { success: false, message: `Error ejecutando acción: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// ================== MAIN HANDLER ==================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context, isAdmin, action, adminUserId } = await req.json();
    
    // Si es una solicitud de acción directa
    if (action) {
      const result = await processAction(action.type, action.data, adminUserId);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const HF_TOKEN = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
    if (!HF_TOKEN) {
      throw new Error('HUGGING_FACE_ACCESS_TOKEN is not configured');
    }

    const supabase = getSupabaseClient();

    // Obtener tasa BCV actual
    let bcvRate = 0;
    const { data: rateData } = await supabase
      .from('exchange_rates')
      .select('rate')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (rateData?.length) {
      bcvRate = rateData[0].rate;
    }

    // Construir contexto dinámico
    let dynamicContext = `Tasa BCV actual: ${bcvRate} Bs/$. `;
    dynamicContext += `Rol: ${isAdmin ? 'Administrador' : 'Cliente'}. `;
    dynamicContext += `Fecha: ${new Date().toLocaleDateString('es-VE')}. `;

    // Si es admin, obtener más contexto
    if (isAdmin) {
      const { data: salesData } = await supabase
        .from('sales')
        .select('total_usd')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      const { data: lowStockData } = await supabase
        .from('products')
        .select('name, stock')
        .lt('stock', 10)
        .limit(5);

      const { data: creditsData } = await supabase
        .from('credits')
        .select('client_name, current_balance')
        .gt('current_balance', 0)
        .limit(3);

      if (salesData?.length) {
        const totalWeek = salesData.reduce((sum, s) => sum + Number(s.total_usd), 0);
        dynamicContext += `Ventas 7 días: $${totalWeek.toFixed(2)}. `;
      }

      if (lowStockData?.length) {
        dynamicContext += `Stock bajo: ${lowStockData.map(p => p.name).join(', ')}. `;
      }

      if (creditsData?.length) {
        dynamicContext += `Créditos pendientes: ${creditsData.map(c => `${c.client_name}: $${c.current_balance}`).join(', ')}. `;
      }
    }

    if (context) {
      dynamicContext += context;
    }

    // Preparar prompt para Hugging Face
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    
    const prompt = `Eres Ángela, asistente de Manojitos. Contexto: ${dynamicContext}

Fórmula de precio: Precio_BS = cantidad × precio_USD × tasa_BCV × (1 + %extra/100)

Pregunta del usuario: ${lastUserMessage}

Responde de forma clara, amigable y profesional en español. Si necesitas ejecutar una acción, indica: [ACCION: TIPO] con los datos necesarios.

Respuesta de Ángela:`;

    console.log('Sending request to Hugging Face');

    // Usar Hugging Face Inference API
    const response = await fetch('https://api-inference.huggingface.co/models/google/flan-t5-base', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 300,
          temperature: 0.7,
          do_sample: true,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', response.status, errorText);
      
      if (response.status === 503) {
        // Modelo cargando - dar respuesta inteligente basada en contexto
        return new Response(
          JSON.stringify({ 
            content: generateFallbackResponse(lastUserMessage, dynamicContext, bcvRate, isAdmin)
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Hugging Face response:', result);

    let generatedText = '';
    if (Array.isArray(result) && result[0]?.generated_text) {
      generatedText = result[0].generated_text;
    } else if (result.generated_text) {
      generatedText = result.generated_text;
    } else if (Array.isArray(result) && result[0]) {
      generatedText = result[0];
    }

    // Si no hay respuesta útil, generar respuesta contextual
    if (!generatedText || generatedText.length < 10) {
      generatedText = generateFallbackResponse(lastUserMessage, dynamicContext, bcvRate, isAdmin);
    }

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

// Generar respuesta inteligente cuando el modelo no está disponible
function generateFallbackResponse(userMessage: string, context: string, bcvRate: number, isAdmin: boolean): string {
  const msg = userMessage.toLowerCase();
  
  // Detectar intención y responder apropiadamente
  if (msg.includes('tasa') || msg.includes('bcv') || msg.includes('dólar')) {
    return `🩷 ¡Hola! La tasa BCV actual es **${bcvRate} Bs/$**. ¿Necesitas calcular algún precio? Solo dime la cantidad y el precio en dólares. ✨`;
  }
  
  if (msg.includes('calcul') || msg.includes('precio') || msg.includes('cuánto')) {
    // Intentar extraer números del mensaje
    const numbers = msg.match(/\d+(\.\d+)?/g);
    if (numbers && numbers.length >= 2 && bcvRate > 0) {
      const qty = parseFloat(numbers[0]);
      const price = parseFloat(numbers[1]);
      const extra = numbers[2] ? parseFloat(numbers[2]) : 0;
      const total = qty * price * bcvRate * (1 + extra / 100);
      return `🩷 **Cálculo de precio:**\n• ${qty} unidades × $${price} × ${bcvRate} Bs/$ ${extra > 0 ? `× (1 + ${extra}%)` : ''}\n• **Total: ${total.toFixed(2)} Bs** ✨`;
    }
    return `🩷 Para calcular un precio, necesito:\n• Cantidad de productos\n• Precio unitario en USD\n• Porcentaje extra (opcional)\n\nLa tasa BCV actual es ${bcvRate} Bs/$. ✨`;
  }
  
  if (msg.includes('venta') || msg.includes('registrar')) {
    if (isAdmin) {
      return `🩷 ¡Perfecto! Para registrar una venta rápida, dime:\n• Nombre del producto\n• Cantidad\n• Método de pago\n\n¡Y yo me encargo del resto! ✨`;
    }
    return `🩷 Las ventas solo pueden ser registradas por administradores. ¿Puedo ayudarte con algo más? ✨`;
  }
  
  if (msg.includes('stock') || msg.includes('inventario')) {
    return `🩷 Puedo verificar el stock por ti. ¿Quieres ver:\n• Productos con stock bajo\n• Stock de un producto específico\n\nSolo dime cuál prefieres. ✨`;
  }
  
  if (msg.includes('crédito') || msg.includes('deuda') || msg.includes('saldo')) {
    if (isAdmin) {
      return `🩷 Puedo consultar información de créditos. ¿De qué cliente necesitas información? Dame el nombre y te muestro todos los detalles. ✨`;
    }
    return `🩷 Puedo mostrarte tu información de crédito. ¿Quieres ver tu saldo actual, límite disponible o historial de pagos? ✨`;
  }
  
  if (msg.includes('pedido') || msg.includes('orden')) {
    return `🩷 Puedo ayudarte con tus pedidos. ¿Quieres:\n• Ver el estado de un pedido\n• Consultar tu historial\n• Información de envío\n\n¡Dime qué necesitas! ✨`;
  }
  
  if (msg.includes('producto') || msg.includes('buscar') || msg.includes('recomienda')) {
    return `🩷 ¡Con gusto te ayudo a encontrar productos! Dime qué estás buscando o qué categoría te interesa y te muestro las mejores opciones. ✨`;
  }
  
  if (msg.includes('hola') || msg.includes('buenas') || msg.includes('buenos')) {
    const greeting = isAdmin 
      ? `🩷 ¡Hola! Soy **Ángela**, tu asistente de Manojitos. Como admin, puedo ayudarte con:\n• 📊 Resumen de ventas\n• 📦 Control de stock\n• 💳 Gestión de créditos\n• 💰 Cálculos de precios\n\n¿Qué necesitas hoy? ✨`
      : `🩷 ¡Hola! Soy **Ángela**, tu asistente de Manojitos. Puedo ayudarte con:\n• 🛒 Buscar productos\n• 📦 Estado de pedidos\n• 💳 Tu crédito\n• 💰 Calcular precios\n\n¿En qué te puedo ayudar? ✨`;
    return greeting;
  }
  
  // Respuesta genérica inteligente
  return `🩷 ¡Hola! Soy **Ángela**, tu asistente de Manojitos. ${isAdmin ? 'Como administrador, ' : ''}puedo ayudarte con:\n\n• 💰 Cálculos de precios (tasa BCV: ${bcvRate} Bs/$)\n• ${isAdmin ? '📊 Ventas y stock' : '🛒 Productos y pedidos'}\n• 💳 Créditos y pagos\n\n¿Qué necesitas? ✨`;
}
