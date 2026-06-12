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

// ================== MEMORIA PERSISTENTE ==================

interface CustomerMemory {
  viewedProducts: string[];
  askedQuestions: string[];
  recommendations: string[];
  preferredPayment?: string;
  purchaseFrequency?: string;
  lastInteraction?: string;
  interests?: string[];
}

async function loadCustomerMemory(supabase: ReturnType<typeof getSupabaseClient>, customerId: string): Promise<CustomerMemory> {
  try {
    const { data: memories } = await supabase
      .from('customer_memory')
      .select('memory_key, memory_value')
      .eq('customer_user_id', customerId)
      .is('expires_at', null)
      .or('expires_at.gt.now()');

    const memory: CustomerMemory = {
      viewedProducts: [],
      askedQuestions: [],
      recommendations: [],
    };

    if (memories) {
      for (const m of memories) {
        switch (m.memory_key) {
          case 'viewed_products':
            memory.viewedProducts = (m.memory_value as { products?: string[] }).products || [];
            break;
          case 'asked_questions':
            memory.askedQuestions = (m.memory_value as { questions?: string[] }).questions || [];
            break;
          case 'recommendations':
            memory.recommendations = (m.memory_value as { recommendations?: string[] }).recommendations || [];
            break;
          case 'preferences':
            const prefs = m.memory_value as { preferredPayment?: string; interests?: string[] };
            memory.preferredPayment = prefs.preferredPayment;
            memory.interests = prefs.interests;
            break;
          case 'behavior':
            const behavior = m.memory_value as { frequency?: string; lastInteraction?: string };
            memory.purchaseFrequency = behavior.frequency;
            memory.lastInteraction = behavior.lastInteraction;
            break;
        }
      }
    }

    return memory;
  } catch (error) {
    console.error('Error loading customer memory:', error);
    return { viewedProducts: [], askedQuestions: [], recommendations: [] };
  }
}

async function saveCustomerMemory(
  supabase: ReturnType<typeof getSupabaseClient>,
  customerId: string,
  adminUserId: string,
  memoryKey: string,
  memoryType: string,
  memoryValue: Record<string, unknown>
): Promise<void> {
  try {
    await supabase
      .from('customer_memory')
      .upsert({
        customer_user_id: customerId,
        user_id: adminUserId,
        memory_key: memoryKey,
        memory_type: memoryType,
        memory_value: memoryValue,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'customer_user_id,memory_key'
      });
  } catch (error) {
    console.error('Error saving customer memory:', error);
  }
}

async function updateCustomerMemoryFromConversation(
  supabase: ReturnType<typeof getSupabaseClient>,
  customerId: string,
  userMessage: string,
  assistantResponse: string,
  viewedProducts: string[],
  adminUserId: string
): Promise<void> {
  try {
    // Cargar memoria actual
    const currentMemory = await loadCustomerMemory(supabase, customerId);

    // Actualizar productos vistos
    const newProducts = [...new Set([...currentMemory.viewedProducts, ...viewedProducts])].slice(-20);
    await saveCustomerMemory(supabase, customerId, adminUserId, 'viewed_products', 'interaction', { products: newProducts });

    // Actualizar preguntas
    const newQuestions = [...currentMemory.askedQuestions, userMessage].slice(-10);
    await saveCustomerMemory(supabase, customerId, adminUserId, 'asked_questions', 'interaction', { questions: newQuestions });

    // Actualizar recomendaciones si aplica
    if (assistantResponse.toLowerCase().includes('recomiendo') || assistantResponse.toLowerCase().includes('sugiero')) {
      const newRecs = [...currentMemory.recommendations, assistantResponse.slice(0, 150)].slice(-5);
      await saveCustomerMemory(supabase, customerId, adminUserId, 'recommendations', 'interaction', { recommendations: newRecs });
    }

    // Actualizar comportamiento
    await saveCustomerMemory(supabase, customerId, adminUserId, 'behavior', 'analytics', {
      frequency: currentMemory.purchaseFrequency || 'regular',
      lastInteraction: new Date().toISOString(),
    });

    // Detectar intereses del mensaje
    const interests = detectInterests(userMessage);
    if (interests.length > 0) {
      const newInterests = [...new Set([...(currentMemory.interests || []), ...interests])].slice(-10);
      await saveCustomerMemory(supabase, customerId, adminUserId, 'preferences', 'analytics', {
        preferredPayment: currentMemory.preferredPayment,
        interests: newInterests,
      });
    }

  } catch (error) {
    console.error('Error updating customer memory:', error);
  }
}

function detectInterests(message: string): string[] {
  const msg = message.toLowerCase();
  const interests: string[] = [];
  
  if (msg.includes('crédito') || msg.includes('credito') || msg.includes('fiado')) interests.push('credit');
  if (msg.includes('oferta') || msg.includes('descuento') || msg.includes('promoción')) interests.push('discounts');
  if (msg.includes('envío') || msg.includes('delivery') || msg.includes('domicilio')) interests.push('delivery');
  if (msg.includes('mayoreo') || msg.includes('cantidad')) interests.push('wholesale');
  
  return interests;
}

function extractProductsFromResponse(response: string): string[] {
  const products: string[] = [];
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let match;
  while ((match = boldPattern.exec(response)) !== null) {
    const word = match[1];
    if (word.length > 2 && !['tu', 'el', 'la', 'los', 'las', 'un', 'una'].includes(word.toLowerCase())) {
      products.push(word);
    }
  }
  return products.slice(0, 5);
}

// ================== CONTEXT BUILDER AVANZADO ==================

interface BusinessContext {
  bcvRate: number;
  extraPercentage: number;
  topProducts: { name: string; price_usd: number; stock: number; category: string; sold_count: number }[];
  categories: string[];
  lowStockProducts: { name: string; stock: number }[];
  bestSellers: { name: string; sold_count: number }[];
  recentSales: number;
  pendingCredits: { client_name: string; current_balance: number }[];
  customerHistory?: {
    lastProducts: string[];
    preferredPayment: string;
    creditStatus: string;
    creditLimit: number;
    totalPurchases: number;
  };
  customerMemory?: CustomerMemory;
}

async function buildBusinessContext(supabase: ReturnType<typeof getSupabaseClient>, isAdmin: boolean, customerId?: string): Promise<BusinessContext> {
  // Obtener tasa BCV actual
  const { data: rateData } = await supabase
    .from('exchange_rates')
    .select('rate')
    .order('created_at', { ascending: false })
    .limit(1);
  
  const bcvRate = rateData?.[0]?.rate || 0;

  // Obtener productos top (disponibles)
  const { data: products } = await supabase
    .from('products')
    .select('name, price_usd, stock, category, sold_count')
    .gt('stock', 0)
    .order('sold_count', { ascending: false })
    .limit(15);

  // Categorías únicas
  const categories = [...new Set((products || []).map((p: any) => p.category).filter(Boolean))] as string[];

  // Productos con stock bajo
  const { data: lowStock } = await supabase
    .from('products')
    .select('name, stock, minimum_stock')
    .lt('stock', 10)
    .order('stock', { ascending: true })
    .limit(5);

  // Best sellers
  const bestSellers = (products || []).slice(0, 5).map((p: any) => ({ name: p.name, sold_count: p.sold_count }));

  // Ventas recientes (7 días)
  const { data: salesData } = await supabase
    .from('sales')
    .select('total_usd')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  
  const recentSales = (salesData || []).reduce((sum: number, s: any) => sum + Number(s.total_usd), 0);

  // Créditos pendientes (solo admin)
  let pendingCredits: { client_name: string; current_balance: number }[] = [];
  if (isAdmin) {
    const { data: credits } = await supabase
      .from('credits')
      .select('client_name, current_balance')
      .gt('current_balance', 0)
      .order('current_balance', { ascending: false })
      .limit(5);
    pendingCredits = credits || [];
  }

  // Historial del cliente + Memoria persistente (si hay customerId)
  let customerHistory;
  let customerMemory;
  if (customerId) {
    // Cargar memoria persistente
    customerMemory = await loadCustomerMemory(supabase, customerId);

    const { data: customerCredit } = await supabase
      .from('credits')
      .select('*')
      .eq('client_user_id', customerId)
      .maybeSingle();

    const { data: customerOrders } = await supabase
      .from('orders')
      .select('items, payment_method')
      .eq('customer_user_id', customerId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (customerCredit || customerOrders?.length) {
      const lastProducts: string[] = [];
      let preferredPayment = customerMemory.preferredPayment || 'efectivo';
      const paymentCounts: Record<string, number> = {};

      customerOrders?.forEach((order: any) => {
        if (order.payment_method) {
          paymentCounts[order.payment_method] = (paymentCounts[order.payment_method] || 0) + 1;
        }
        if (Array.isArray(order.items)) {
          order.items.forEach((item: { name?: string }) => {
            if (item.name && !lastProducts.includes(item.name)) {
              lastProducts.push(item.name);
            }
          });
        }
      });

      const maxPayment = Object.entries(paymentCounts).sort((a, b) => b[1] - a[1])[0];
      if (maxPayment) preferredPayment = maxPayment[0];

      customerHistory = {
        lastProducts: [...new Set([...lastProducts, ...customerMemory.viewedProducts])].slice(0, 10),
        preferredPayment,
        creditStatus: customerCredit?.status || 'Sin crédito',
        creditLimit: customerCredit?.credit_limit || 0,
        totalPurchases: customerCredit?.total_purchases || 0,
      };
    }
  }

  return {
    bcvRate,
    extraPercentage: 10.7, // Configurable en futuro
    topProducts: products || [],
    categories,
    lowStockProducts: lowStock || [],
    bestSellers,
    recentSales,
    pendingCredits,
    customerHistory,
    customerMemory,
  };
}

// ================== GENERADOR DE SUGERENCIAS PREDICTIVAS ==================

interface Suggestion {
  label: string;
  message: string;
  priority: number;
}

function generatePredictiveSuggestions(
  userMessage: string,
  context: BusinessContext,
  conversationHistory: { role: string; content: string }[],
  isAdmin: boolean
): Suggestion[] {
  const msg = userMessage.toLowerCase();
  const suggestions: Suggestion[] = [];
  const conversationLength = conversationHistory.length;

  // Detectar intención actual
  const isAskingPrice = msg.includes('precio') || msg.includes('cuánto') || msg.includes('costo');
  const isAskingStock = msg.includes('stock') || msg.includes('disponible') || msg.includes('hay');
  const isAskingCredit = msg.includes('crédito') || msg.includes('saldo') || msg.includes('deuda');
  const isAskingProduct = msg.includes('producto') || msg.includes('buscar') || msg.includes('recomienda');
  const isBuying = msg.includes('comprar') || msg.includes('agregar') || msg.includes('carrito');
  const isGreeting = msg.includes('hola') || msg.includes('buenos') || conversationLength <= 2;

  // Sugerencias basadas en memoria del cliente
  if (context.customerMemory?.viewedProducts?.length) {
    const lastViewed = context.customerMemory.viewedProducts.slice(-1)[0];
    suggestions.push({ label: `🔄 Ver ${lastViewed}`, message: `Quiero ver más sobre ${lastViewed}`, priority: 9 });
  }

  if (context.customerMemory?.interests?.includes('discounts')) {
    suggestions.push({ label: "🏷️ Ver ofertas", message: "¿Tienen ofertas o descuentos disponibles?", priority: 8 });
  }

  // Sugerencias base según intención
  if (isAskingPrice) {
    suggestions.push({ label: "💰 Calcular en Bs", message: "¿Cuánto sería eso en Bs con la tasa actual?", priority: 10 });
    suggestions.push({ label: "📊 Comparar USD vs Bs", message: "¿Me conviene pagar en USD o en Bs?", priority: 8 });
    if (context.customerHistory?.preferredPayment) {
      suggestions.push({ label: "💳 Pagar como siempre", message: `Quiero pagar en ${context.customerHistory.preferredPayment} como la última vez`, priority: 9 });
    }
  }

  if (isAskingStock || isAskingProduct) {
    suggestions.push({ label: "🔥 Más vendidos", message: "¿Cuáles son los productos más vendidos?", priority: 8 });
    suggestions.push({ label: "🏷️ Ver categorías", message: `¿Qué hay en las categorías: ${context.categories.slice(0, 3).join(', ')}?`, priority: 7 });
    if (context.customerHistory?.lastProducts?.length) {
      suggestions.push({ label: "🔄 Repetir pedido", message: `Quiero volver a pedir ${context.customerHistory.lastProducts[0]}`, priority: 9 });
    }
  }

  if (isAskingCredit) {
    suggestions.push({ label: "💳 Mi límite", message: "¿Cuál es mi límite de crédito disponible?", priority: 9 });
    suggestions.push({ label: "📅 Fecha de pago", message: "¿Cuándo vence mi próximo pago?", priority: 8 });
    suggestions.push({ label: "💵 Abonar", message: "Quiero hacer un abono a mi crédito", priority: 7 });
  }

  if (isBuying) {
    suggestions.push({ label: "🛒 Ver carrito", message: "¿Qué tengo en el carrito?", priority: 10 });
    suggestions.push({ label: "💳 Usar crédito", message: "¿Puedo pagar esto a crédito?", priority: 9 });
    suggestions.push({ label: "📦 Envío", message: "¿Hacen envíos a domicilio?", priority: 8 });
  }

  // Sugerencias contextuales siempre disponibles
  if (context.bcvRate > 0) {
    suggestions.push({ label: "💱 Tasa BCV", message: "¿Cuál es la tasa BCV de hoy?", priority: 6 });
  }

  // Sugerencia de atención humana (siempre al final)
  suggestions.push({ label: "🧑‍💼 Hablar con asesor", message: "Quiero hablar con un asesor humano", priority: 3 });

  // Sugerencias específicas para admin
  if (isAdmin) {
    if (context.lowStockProducts.length > 0) {
      suggestions.push({ label: "📉 Stock bajo", message: "¿Cuáles productos tienen stock bajo?", priority: 9 });
    }
    if (context.pendingCredits.length > 0) {
      suggestions.push({ label: "💳 Créditos pendientes", message: "¿Cuáles clientes tienen créditos pendientes?", priority: 8 });
    }
    suggestions.push({ label: "📊 Resumen ventas", message: "Dame un resumen de ventas de esta semana", priority: 7 });
    suggestions.push({ label: "🛒 Registrar venta", message: "Quiero registrar una venta rápida", priority: 6 });
  }

  // Sugerencias basadas en historial del cliente
  if (!isAdmin && context.customerHistory) {
    if (context.customerHistory.creditStatus === 'ACTIVO' && context.customerHistory.creditLimit > 0) {
      suggestions.push({ label: "💳 Crédito disponible", message: "¿Cuánto crédito tengo disponible?", priority: 8 });
    }
  }

  // Ordenar por prioridad y tomar los top 5
  suggestions.sort((a, b) => b.priority - a.priority);
  return suggestions.slice(0, 5);
}

// ================== ANÁLISIS DE CONVERSACIÓN ==================

interface ConversationAnalysis {
  intent: 'purchase' | 'inquiry' | 'support' | 'frustration' | 'greeting' | 'unknown';
  sentiment: 'positive' | 'neutral' | 'negative' | 'confused';
  needsHumanSupport: boolean;
  confidence: number;
}

function analyzeConversation(messages: { role: string; content: string }[]): ConversationAnalysis {
  const lastUserMessages = messages.filter(m => m.role === 'user').slice(-3);
  const allContent = lastUserMessages.map(m => m.content.toLowerCase()).join(' ');

  // Detectar frustración
  const frustrationWords = ['no entiendo', 'no funciona', 'error', 'problema', 'ayuda', 'molesto', 'mal', 'terrible', 'no me sirve'];
  const hasFrustration = frustrationWords.some(word => allContent.includes(word));

  // Detectar confusión
  const confusionWords = ['cómo', 'no sé', 'no entiendo', 'explica', 'ayuda', 'perdido', 'confundido'];
  const hasConfusion = confusionWords.some(word => allContent.includes(word));

  // Detectar intención de compra
  const purchaseWords = ['comprar', 'pedir', 'agregar', 'carrito', 'quiero', 'necesito', 'llevar'];
  const hasPurchaseIntent = purchaseWords.some(word => allContent.includes(word));

  // Detectar solicitud de soporte humano
  const humanSupportWords = ['humano', 'persona', 'vendedor', 'asesor', 'atención', 'hablar con'];
  const needsHumanSupport = humanSupportWords.some(word => allContent.includes(word));

  // Detectar saludo
  const greetingWords = ['hola', 'buenos', 'buenas', 'hey', 'saludos'];
  const isGreeting = greetingWords.some(word => allContent.includes(word)) && messages.length <= 2;

  let intent: ConversationAnalysis['intent'] = 'unknown';
  let sentiment: ConversationAnalysis['sentiment'] = 'neutral';
  let confidence = 0.5;

  if (isGreeting) {
    intent = 'greeting';
    sentiment = 'positive';
    confidence = 0.9;
  } else if (needsHumanSupport) {
    intent = 'support';
    sentiment = hasFrustration ? 'negative' : 'neutral';
    confidence = 0.95;
  } else if (hasFrustration) {
    intent = 'support';
    sentiment = 'negative';
    confidence = 0.8;
  } else if (hasConfusion) {
    intent = 'inquiry';
    sentiment = 'confused';
    confidence = 0.7;
  } else if (hasPurchaseIntent) {
    intent = 'purchase';
    sentiment = 'positive';
    confidence = 0.85;
  } else {
    intent = 'inquiry';
    sentiment = 'neutral';
    confidence = 0.6;
  }

  return {
    intent,
    sentiment,
    needsHumanSupport: needsHumanSupport || (hasFrustration && messages.length > 4),
    confidence,
  };
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
  
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price_usd, stock, sold_count')
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
  
  const { data: rateData } = await supabase
    .from('exchange_rates')
    .select('rate')
    .order('created_at', { ascending: false })
    .limit(1);
  
  const bcvRate = rateData?.[0]?.rate || 0;
  const totalBs = totalUsd * bcvRate;
  
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
  
  await supabase
    .from('products')
    .update({ 
      stock: product.stock - data.quantity,
      sold_count: (product.sold_count || 0) + data.quantity 
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
  
  const stockList = products.map((p: any) => `• ${p.name}: ${p.stock} unidades`).join('\n');
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const body = await req.json();
    const { messages, context, action, adminUserId, customerId: requestCustomerId } = body;
    
    // ================== AUTHENTICATION CHECK ==================
    const authHeader = req.headers.get('Authorization');
    let authenticatedUserId: string | null = null;
    let isAdminVerified = false;
    let customerId = requestCustomerId;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Create auth client with the user's token
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
      
      if (!userError && userData?.user) {
        authenticatedUserId = userData.user.id;
        isAdminVerified = userData.user.app_metadata?.is_super_admin === true;
        
        // Use authenticated user's ID if no customerId provided
        if (!customerId) {
          customerId = authenticatedUserId;
        }
        
        console.log('Authenticated user:', authenticatedUserId, 'isAdmin:', isAdminVerified);
      }
    }
    
    // Use verified admin status instead of trusting request body
    const isAdmin = isAdminVerified;
    
    // Si es una solicitud de acción directa, require authentication
    if (action) {
      if (!authenticatedUserId) {
        return new Response(
          JSON.stringify({ error: 'Authentication required for actions' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const result = await processAction(action.type, action.data, authenticatedUserId);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const HF_TOKEN = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY');

    const supabase = getSupabaseClient();

    // ================== CONTEXT BUILDER AVANZADO ==================
    console.log('Building business context... isAdmin:', isAdmin, 'customerId:', customerId);
    
    // Only build sensitive context for authenticated admin users
    const businessContext = await buildBusinessContext(supabase, isAdmin, customerId);

    // Analizar la conversación
    const conversationAnalysis = analyzeConversation(messages || []);
    console.log('Conversation analysis:', conversationAnalysis);

    // Generar sugerencias predictivas
    const lastUserMessage = messages?.[messages.length - 1]?.content || '';
    const suggestions = generatePredictiveSuggestions(lastUserMessage, businessContext, messages || [], isAdmin);
    console.log('Generated suggestions:', suggestions.length);

    // ================== CONSTRUIR PROMPT CONTEXTUALIZADO ==================
    let contextPrompt = `Eres Ángela, asistente inteligente de Manojitos (tienda en Venezuela).
Personalidad: cercana, clara, profesional, confiable. Usa español venezolano.
Tono: amable, seguro, sin exagerar emojis (máximo 2-3 por respuesta).

DATOS DEL NEGOCIO HOY:
- Tasa BCV: ${businessContext.bcvRate} Bs/$
- Porcentaje adicional: ${businessContext.extraPercentage}%
- Fórmula precio: Precio_BS = cantidad × precio_USD × tasa_BCV × (1 + ${businessContext.extraPercentage}/100)

PRODUCTOS DISPONIBLES (TOP):
${businessContext.topProducts.slice(0, 8).map(p => `• ${p.name}: $${p.price_usd} (${p.stock} unidades) - ${p.category || 'Sin categoría'}`).join('\n')}

CATEGORÍAS: ${businessContext.categories.join(', ')}

MÁS VENDIDOS: ${businessContext.bestSellers.map(p => p.name).join(', ')}
`;

    // Agregar memoria del cliente si existe
    if (businessContext.customerMemory && (businessContext.customerMemory.viewedProducts.length > 0 || businessContext.customerMemory.askedQuestions.length > 0)) {
      contextPrompt += `
MEMORIA DEL CLIENTE:
- Productos que ha visto antes: ${businessContext.customerMemory.viewedProducts.slice(-5).join(', ') || 'Ninguno'}
- Últimas preguntas: ${businessContext.customerMemory.askedQuestions.slice(-3).join(' | ') || 'Ninguna'}
- Intereses detectados: ${businessContext.customerMemory.interests?.join(', ') || 'No definidos'}
- Última interacción: ${businessContext.customerMemory.lastInteraction || 'Primera vez'}

💡 USA esta memoria para personalizar tu respuesta. Referencia cosas que el cliente ha visto o preguntado.
`;
    }

    // Agregar contexto de cliente si existe
    if (businessContext.customerHistory) {
      contextPrompt += `
HISTORIAL DEL CLIENTE:
- Productos anteriores: ${businessContext.customerHistory.lastProducts.join(', ') || 'Ninguno'}
- Forma de pago preferida: ${businessContext.customerHistory.preferredPayment}
- Estado de crédito: ${businessContext.customerHistory.creditStatus}
- Límite de crédito: $${businessContext.customerHistory.creditLimit}
- Compras totales: ${businessContext.customerHistory.totalPurchases}
`;
    }

    // Agregar contexto de admin si aplica
    if (isAdmin) {
      contextPrompt += `
DATOS ADMIN:
- Ventas últimos 7 días: $${businessContext.recentSales.toFixed(2)}
- Stock bajo: ${businessContext.lowStockProducts.map(p => `${p.name} (${p.stock})`).join(', ') || 'Ninguno'}
- Créditos pendientes: ${businessContext.pendingCredits.map(c => `${c.client_name}: $${c.current_balance}`).join(', ') || 'Ninguno'}
`;
    }

    // Agregar análisis de conversación
    if (conversationAnalysis.sentiment === 'negative' || conversationAnalysis.sentiment === 'confused') {
      contextPrompt += `
⚠️ ALERTA: El cliente parece ${conversationAnalysis.sentiment === 'negative' ? 'frustrado' : 'confundido'}. 
Simplifica tus respuestas y ofrece ayuda clara. Si persiste, ofrece atención humana.
`;
    }

    if (context) {
      contextPrompt += `\nCONTEXTO ADICIONAL: ${context}`;
    }

    contextPrompt += `
ROL: ${isAdmin ? 'Administrador' : 'Cliente'}
FECHA: ${new Date().toLocaleDateString('es-VE')}

Pregunta del usuario: ${lastUserMessage}

INSTRUCCIONES CLAVE:
- Si el usuario pregunta por precios, muestra siempre USD y Bs.
- Si el usuario pregunta sobre categorías específicas ("Ropa", "Ropa Interior", "Perfume", etc.), lista los productos de CADA categoría mencionada con nombre, precio USD, precio Bs y stock.
- Si el usuario pide ver productos de una categoría, busca en los PRODUCTOS DISPONIBLES de arriba y filtra por esa categoría.
- NO respondas con el saludo genérico si el usuario hace una pregunta concreta de productos o categorías.
- Si necesitas ejecutar una acción, indica: [ACCION: TIPO] con los datos necesarios.

Respuesta de Ángela:`;


    console.log('Calling Gemini Flash for Angela response...');

    let generatedText = '';

    if (GEMINI_KEY) {
      const modelsToTry = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      for (const model of modelsToTry) {
        try {
          console.log(`Trying Gemini model: ${model}`);
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: contextPrompt }] }],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 512,
                  topP: 0.9,
                },
              }),
            }
          );

          if (geminiResponse.ok) {
            const geminiResult = await geminiResponse.json();
            generatedText = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (generatedText && generatedText.length >= 10) {
              console.log(`Gemini response received from ${model}, length:`, generatedText.length);
              break; // Success! Exit loop
            } else {
              console.warn(`Gemini model ${model} returned empty/short response`);
            }
          } else {
            const errText = await geminiResponse.text();
            console.error(`Gemini API error for model ${model}:`, geminiResponse.status, errText);
          }
        } catch (geminiErr) {
          console.error(`Gemini fetch error for model ${model}:`, geminiErr);
        }
      }
      if (!generatedText || generatedText.length < 10) {
        console.error('All Gemini models failed. Falling back to rule-based response.');
      }
    } else {
      console.warn('No GEMINI_API_KEY configured, using fallback responses');
    }

    // Si no hay respuesta útil, generar respuesta contextual
    if (!generatedText || generatedText.length < 10) {
      generatedText = generateFallbackResponse(lastUserMessage, businessContext, isAdmin, conversationAnalysis);
    }

    // Limpiar respuesta de posibles artefactos
    generatedText = generatedText
      .replace(/^Respuesta de Ángela:\s*/i, '')
      .replace(/\[INST\].*?\[\/INST\]/gs, '')
      .trim();

    // Guardar en memoria persistente si hay customerId (background task para no bloquear respuesta)
    if (customerId && authenticatedUserId) {
      const viewedProducts = extractProductsFromResponse(generatedText);
      // Use authenticated admin or get first admin for memory storage
      let memoryAdminId: string = isAdmin ? authenticatedUserId : '';
      
      if (!memoryAdminId) {
        const { data: adminData } = await supabase.from('profiles').select('user_id').limit(1);
        memoryAdminId = adminData?.[0]?.user_id || customerId;
      }
      
      // Only proceed if we have a valid memoryAdminId
      if (memoryAdminId) {
        // Ejecutar en background sin bloquear la respuesta
        const memoryTask = updateCustomerMemoryFromConversation(
          supabase,
          customerId,
          lastUserMessage,
          generatedText,
          viewedProducts,
          memoryAdminId
        );
        
        // No esperamos - se ejecuta en paralelo
        memoryTask.catch(err => console.error('Memory save error:', err));
      }
    }

    return new Response(
      JSON.stringify({ 
        content: generatedText,
        suggestions: suggestions,
        analysis: conversationAnalysis,
      }),
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

// ================== RESPUESTA FALLBACK INTELIGENTE ==================

function generateFallbackResponse(
  userMessage: string, 
  context: BusinessContext, 
  isAdmin: boolean,
  analysis: ConversationAnalysis
): string {
  const msg = userMessage.toLowerCase();
  const bcvRate = context.bcvRate;
  
  // ── EMOCIONAL ──
  if (analysis.sentiment === 'negative') {
    return `🩷 Entiendo, quiero ayudarte. ¿Qué necesitas?\n\n• 💰 Precios y cálculos\n• 📦 Productos disponibles\n• 💳 Información de crédito\n• 🧑\u200D💼 Hablar con un asesor\n\nEstoy aquí para ti. ✨`;
  }
  if (analysis.sentiment === 'confused') {
    return `🩷 ¡Sin problema! Puedo ayudarte con:\n• 💰 Precios (tasa BCV: ${bcvRate} Bs/$)\n• 🛒 Buscar productos\n• 💳 Tu crédito\n\n¿Qué te gustaría hacer? ✨`;
  }

  // ── SALUDO ──
  if (msg.includes('hola') || msg.includes('buenas') || msg.includes('buenos') || msg.includes('hey')) {
    if (context.customerMemory?.viewedProducts?.length) {
      const last = context.customerMemory.viewedProducts.slice(-1)[0];
      return `🩷 ¡Hola de nuevo! 👋 La última vez te interesó **${last}**. ¿Quieres saber más o buscas algo nuevo?\n\nTasa BCV: ${bcvRate} Bs/$ ✨`;
    }
    if (context.customerHistory?.lastProducts?.length) {
      const last = context.customerHistory.lastProducts[0];
      return `🩷 ¡Hola de nuevo! 👋 La última vez pediste **${last}**. ¿Lo repites o buscas algo diferente?\n\nPuedo ayudarte con 🛒 productos, 💰 precios o 💳 tu crédito. ✨`;
    }
    if (isAdmin) {
      return `🩷 ¡Hola! Soy **Ángela**.\n\n📊 **Resumen rápido:**\n• Ventas 7 días: $${context.recentSales.toFixed(2)}\n• Stock bajo: ${context.lowStockProducts.length} productos\n• Créditos pendientes: ${context.pendingCredits.length}\n\n¿Qué necesitas? ✨`;
    }
    return `🩷 ¡Hola! Soy **Ángela**, tu asistente de Manojitos. 👋\n\nPuedo ayudarte con:\n• 🛒 Productos y recomendaciones\n• 💰 Precios y cálculos\n• 💳 Tu crédito\n\n¿En qué te puedo ayudar? ✨`;
  }

  // Detectar intención y responder apropiadamente
  if (msg.includes('tasa') || msg.includes('bcv') || msg.includes('dólar')) {
    const extraPercent = context.extraPercentage;
    return `🩷 **Tasa BCV actual: ${bcvRate} Bs/$**\n\nCon el ${extraPercent}% adicional, la tasa efectiva es: **${(bcvRate * (1 + extraPercent / 100)).toFixed(2)} Bs/$**\n\n¿Quieres calcular algún precio? ✨`;
  }
  
  if (msg.includes('calcul') || msg.includes('precio') || msg.includes('cuánto')) {
    const numbers = msg.match(/\d+(\.\d+)?/g);
    if (numbers && numbers.length >= 1 && bcvRate > 0) {
      const amount = parseFloat(numbers[0]);
      const extraPercent = context.extraPercentage;
      const totalBs = amount * bcvRate * (1 + extraPercent / 100);
      const totalBsWithout = amount * bcvRate;
      
      return `🩷 **Cálculo de precio:**\n\n• Monto: **$${amount}**\n• Tasa BCV: ${bcvRate} Bs/$\n• En Bs puro: ${totalBsWithout.toFixed(2)} Bs\n• Con ${extraPercent}%: **${totalBs.toFixed(2)} Bs**\n\n💡 *Si pagas en USD ahorras ${(totalBs - totalBsWithout).toFixed(2)} Bs* ✨`;
    }
    return `🩷 Para calcular un precio:\n\nDime el monto en USD y te lo convierto.\nTasa BCV: ${bcvRate} Bs/$ + ${context.extraPercentage}% adicional ✨`;
  }
  
  // Detectar consulta de categorías específicas
  const hasCategoryQuery = msg.includes('categor') || msg.includes('ropa') || msg.includes('perfume') || msg.includes('interior') ||
    context.categories.some(cat => msg.includes(cat.toLowerCase()));
  
  if (hasCategoryQuery) {
    // Identificar qué categorías mencionó el usuario
    const mentionedCategories = context.categories.filter(cat => msg.includes(cat.toLowerCase()));
    const targetCategories = mentionedCategories.length > 0 ? mentionedCategories : context.categories.slice(0, 3);
    
    let response = `🩷 Aquí tienes los productos por categoría:\n`;
    for (const cat of targetCategories) {
      const catProducts = context.topProducts.filter(p => p.category?.toLowerCase() === cat.toLowerCase());
      if (catProducts.length > 0) {
        response += `\n📦 **${cat}:**\n`;
        response += catProducts.map(p => `  • ${p.name}: $${p.price_usd} USD (${p.stock} disponibles)`).join('\n');
        response += '\n';
      } else {
        response += `\n📦 **${cat}:** Sin productos disponibles actualmente.\n`;
      }
    }
    response += `\n¿Alguno te interesa? ✨`;
    return response;
  }

  if (msg.includes('crédito') || msg.includes('credito') || msg.includes('saldo') || msg.includes('deuda') || msg.includes('fiado') || msg.includes('debo')) {
    if (context.customerHistory) {
      return `🩷 **Tu crédito en Manojitos:**\n\n• Estado: ${context.customerHistory.creditStatus}\n• Límite: $${context.customerHistory.creditLimit}\n• Compras totales: ${context.customerHistory.totalPurchases}\n\n¿Necesitas más detalles? ✨`;
    }
    if (isAdmin) return `🩷 ¿De qué cliente necesitas información de crédito? ✨`;
    return `🩷 Puedo mostrarte tu información de crédito. ¿Quieres ver tu saldo o límite disponible? ✨`;
  }

  if (msg.includes('stock') && isAdmin) {
    if (context.lowStockProducts.length > 0) {
      const list = context.lowStockProducts.map(p => `• ${p.name}: ${p.stock} unidades`).join('\n');
      return `🩷 **Productos con stock bajo:**\n\n${list}\n\n¿Hago un pedido al proveedor? ✨`;
    }
    return `🩷 ¡Todo el inventario está bien abastecido! 🎉`;
  }

  // ── MAPEO SEMÁNTICO de estilos / contexto / género ──
  const styleMap: Record<string, string[]> = {
    playero:   ['short', 'shorts', 'franela', 'franelilla', 'vestido'],
    playa:     ['short', 'shorts', 'franela', 'franelilla', 'vestido'],
    verano:    ['short', 'shorts', 'franela', 'franelilla', 'vestido'],
    calor:     ['short', 'shorts', 'franela', 'franelilla'],
    sport:     ['short', 'shorts', 'franela'],
    gym:       ['short', 'shorts', 'franela'],
    ejercicio: ['short', 'shorts', 'franela'],
    fiesta:    ['vestido', 'body', 'perfume', 'jean paul'],
    salir:     ['vestido', 'body', 'perfume'],
    noche:     ['vestido', 'body', 'perfume'],
    cita:      ['vestido', 'body', 'perfume'],
    'cómodo':  ['bragas', 'body'],
    comodo:    ['bragas', 'body'],
    hombre:    ['short', 'shorts hombre', 'franela', 'oversize'],
    caballero: ['short', 'shorts hombre', 'franela', 'oversize'],
    mujer:     ['vestido', 'body', 'bragas', 'short dama', 'franelilla'],
    dama:      ['vestido', 'body', 'bragas', 'short dama', 'franelilla'],
    barato:    [],
    'económico': [],
    economico: [],
    perfume:   ['perfume', 'jean paul', 'scandal'],
    fragancia: ['perfume', 'jean paul', 'scandal'],
    olor:      ['perfume', 'jean paul', 'scandal'],
  };

  const matchedKws = Object.keys(styleMap).filter(kw => msg.includes(kw));

  if (matchedKws.length > 0) {
    const searchTerms = [...new Set(matchedKws.flatMap(kw => styleMap[kw]))];
    let matched = context.topProducts.filter(p =>
      searchTerms.some(t => p.name.toLowerCase().includes(t))
    );
    // Si pide barato → ordenar por precio
    if (matchedKws.some(kw => ['barato', 'económico', 'economico'].includes(kw))) {
      matched = [...context.topProducts].sort((a, b) => a.price_usd - b.price_usd).slice(0, 4);
    }
    if (matched.length > 0) {
      const intent = matchedKws[0];
      const list = matched.map(p => `• **${p.name}**: $${p.price_usd} (${p.stock} disponibles)`).join('\n');
      return `🩷 Para algo **${intent}** te recomiendo:\n\n${list}\n\n¿Alguno te llama la atención? ✨`;
    }
  }

  // ── MÁS VENDIDOS EXPLÍCITO ──
  if (msg.includes('vendido') || msg.includes('popular') || msg.includes('top')) {
    const top = context.bestSellers.slice(0, 5).map(p => `• ${p.name}`).join('\n');
    return `🔥 **Nuestros más vendidos:**\n\n${top}\n\n¿Quieres ver precios de alguno? ✨`;
  }

  // ── RECOMENDACIÓN / BÚSQUEDA GENÉRICA ──
  if (msg.includes('recomienda') || msg.includes('sugieres') || msg.includes('sugiere') ||
      msg.includes('qué tienes') || msg.includes('que tienes') || msg.includes('busco') ||
      msg.includes('buscar') || msg.includes('product')) {
    const top = context.topProducts.slice(0, 4);
    if (top.length > 0) {
      const list = top.map(p => `• **${p.name}**: $${p.price_usd} (${p.stock} disponibles)`).join('\n');
      return `🩷 ¡Con gusto! Te muestro lo más destacado:\n\n${list}\n\n📂 Categorías: ${context.categories.join(', ')}\n\n¿Algo específico que estés buscando? ✨`;
    }
  }

  // ── CATCH-ALL: busca palabras del mensaje en catálogo ──
  const words = msg.split(/\s+/).filter(w => w.length > 3);
  const catalogMatches = context.topProducts.filter(p =>
    words.some(w => p.name.toLowerCase().includes(w) || (p.category || '').toLowerCase().includes(w))
  );
  if (catalogMatches.length > 0) {
    const list = catalogMatches.slice(0, 4).map(p => `• **${p.name}**: $${p.price_usd} (${p.stock} disponibles)`).join('\n');
    return `🩷 Encontré esto que podría interesarte:\n\n${list}\n\n¿Es lo que buscabas? ✨`;
  }

  // ── MENÚ FINAL ──
  const topProduct = context.topProducts[0];
  return `🩷 Puedo ayudarte con:\n\n• 🛒 Productos: ${context.categories.slice(0, 3).join(', ')}\n• 💰 Precios en USD y Bs (tasa: ${bcvRate} Bs/$)\n• 💳 Tu crédito disponible${topProduct ? `\n\n🔥 Destacado: **${topProduct.name}** - $${topProduct.price_usd}` : ''}\n\n¿Qué necesitas? ✨`;
}
