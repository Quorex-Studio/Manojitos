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
  pendingReceivables: {
    clientName: string;
    products: string;
    total: number;
    paid: number;
    balance: number;
    groupId: string;
    isPartial: boolean;
  }[];
  totalReceivable: number;
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

  // Cuentas por cobrar REALES: ventas fiadas con saldo pendiente (solo admin).
  // Viven en `sales`, NO en `credits` (libro de créditos, hoy sin saldos). Se
  // agrupan por coalesce(sale_group_id, id) porque hay ventas sin grupo, y el
  // total/abonado se calculan sobre TODAS las lineas fiadas del grupo (incluidas
  // las ya pagadas) para que el saldo del grupo sea el real. total_usd es el
  // total financiero acordado de la linea: nunca se recalcula.
  let pendingReceivables: BusinessContext['pendingReceivables'] = [];
  let totalReceivable = 0;
  if (isAdmin) {
    const { data: fiadoSales } = await supabase
      .from('sales')
      .select('id, sale_group_id, client_name, product_name, quantity, total_usd, amount_paid, payment_status')
      .eq('sale_modality', 'fiado')
      .limit(500);

    const groups = new Map<string, {
      clientName: string;
      items: Map<string, number>;
      total: number;
      paid: number;
      isPartial: boolean;
    }>();

    for (const row of (fiadoSales || []) as any[]) {
      const key: string = row.sale_group_id || row.id;
      const group = groups.get(key) || {
        clientName: '',
        items: new Map<string, number>(),
        total: 0,
        paid: 0,
        isPartial: false,
      };

      group.total += Number(row.total_usd) || 0;
      group.paid += Number(row.amount_paid) || 0;
      if (row.payment_status === 'partial') group.isPartial = true;
      if (!group.clientName && row.client_name) group.clientName = row.client_name;
      if (row.product_name) {
        group.items.set(row.product_name, (group.items.get(row.product_name) || 0) + (Number(row.quantity) || 0));
      }

      groups.set(key, group);
    }

    for (const [groupId, group] of groups) {
      const balance = Math.round((group.total - group.paid) * 100) / 100;
      if (balance > 0) {
        pendingReceivables.push({
          clientName: group.clientName || 'Sin nombre',
          products: [...group.items.entries()]
            .map(([name, qty]) => (qty > 1 ? `${name} x${qty}` : name))
            .join(', '),
          total: Math.round(group.total * 100) / 100,
          paid: Math.round(group.paid * 100) / 100,
          balance,
          groupId,
          isPartial: group.isPartial,
        });
      }
    }

    pendingReceivables.sort((a, b) => b.balance - a.balance);
    totalReceivable = Math.round(pendingReceivables.reduce((sum, r) => sum + r.balance, 0) * 100) / 100;
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
    pendingReceivables,
    totalReceivable,
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

// A-05: REGISTER_SALE is now a single transactional, admin-only, stock-safe
// DB operation. This handler no longer writes to sales/sale_payments/products
// directly; it delegates to the angela_register_sale RPC, invoked with the
// CALLER'S JWT context (not service_role) so auth.uid()/is_admin() are enforced
// server-side inside PostgreSQL. Atomicity, locking (FOR UPDATE), the
// sale_group_id, the sale_payments history and stock update all live in the DB.
async function handleRegisterSale(
  data: {
    productName: string;
    quantity: number;
    priceUsd?: number;
    clientName?: string;
    paymentMethod: string;
  },
  authCtx: { authHeader: string; supabaseUrl: string; supabaseAnonKey: string }
) {
  const supabase = createClient(authCtx.supabaseUrl, authCtx.supabaseAnonKey, {
    global: { headers: { Authorization: authCtx.authHeader } }
  });

  const { data: result, error } = await supabase.rpc('angela_register_sale', {
    p_product_name: data.productName,
    p_quantity: data.quantity,
    p_unit_price_usd: data.priceUsd ?? null,
    p_payment_method: data.paymentMethod,
    p_client_name: data.clientName ?? null,
  });

  if (error) {
    return { success: false, message: `No se pudo registrar la venta: ${error.message}` };
  }

  return result;
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

async function processAction(
  actionType: string,
  actionData: Record<string, unknown>,
  authCtx?: { adminUserId?: string; authHeader?: string; supabaseUrl?: string; supabaseAnonKey?: string }
) {
  try {
    switch (actionType) {
      case 'QUERY_PRODUCTS':
        return await handleQueryProducts(actionData as { search?: string; category?: string });

      case 'REGISTER_SALE':
        if (!authCtx?.adminUserId || !authCtx.authHeader || !authCtx.supabaseUrl || !authCtx.supabaseAnonKey) {
          return { success: false, message: 'Se requiere autenticación de admin para registrar ventas' };
        }
        return await handleRegisterSale(
          actionData as { productName: string; quantity: number; priceUsd?: number; clientName?: string; paymentMethod: string },
          { authHeader: authCtx.authHeader, supabaseUrl: authCtx.supabaseUrl, supabaseAnonKey: authCtx.supabaseAnonKey }
        );

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

// ================== HERRAMIENTAS READ-ONLY DE ÁNGELA (FASE 2) ==================
// Gemini SOLO decide qué herramienta pedir (function calling nativo); NO accede a
// Supabase ni recibe credenciales, IDs ni permisos. Cada herramienta se ejecuta
// AQUÍ, revalida el rol verificado server-side (getUser(token) -> isAdmin), acota
// al usuario autenticado cuando es cliente, y SOLO LEE (.select()). Ninguna
// herramienta hace INSERT/UPDATE/DELETE ni invoca RPC de escritura.

interface ToolContext {
  supabase: ReturnType<typeof getSupabaseClient>;
  isAdmin: boolean;
  authenticatedUserId: string;
  bcvRate: number;
}

// Declaraciones en el formato real de Gemini v1beta (functionDeclarations).
// Los tipos van en mayúsculas (subconjunto OpenAPI) como exige la API.
const READONLY_TOOL_DECLARATIONS = [
  { name: 'buscar_producto', description: 'Busca productos del catálogo por nombre y/o categoría. Devuelve nombre, precio USD, stock y categoría.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'texto a buscar en el nombre' }, category: { type: 'STRING', description: 'categoría (opcional)' } } } },
  { name: 'consultar_precio', description: 'Precio de un producto en USD y su equivalente en Bs a la tasa BCV actual.',
    parameters: { type: 'OBJECT', properties: { product: { type: 'STRING' } }, required: ['product'] } },
  { name: 'consultar_stock', description: 'Existencias (stock) de un producto, o el listado de productos con bajo stock si low_stock_only=true.',
    parameters: { type: 'OBJECT', properties: { product: { type: 'STRING' }, low_stock_only: { type: 'BOOLEAN' } } } },
  { name: 'consultar_categorias', description: 'Lista las categorías de productos disponibles.',
    parameters: { type: 'OBJECT', properties: {} } },
  { name: 'listar_cxc', description: 'SOLO ADMIN. Cuentas por cobrar reales: ventas fiadas con saldo pendiente, agrupadas por venta, más el total por cobrar. Es distinto de los créditos del sistema.',
    parameters: { type: 'OBJECT', properties: {} } },
  { name: 'consultar_deuda_cliente', description: 'Deuda por ventas fiadas de un cliente (total acordado, abonado y saldo por grupo de venta). El admin puede consultar cualquier cliente; un cliente solo la suya.',
    parameters: { type: 'OBJECT', properties: { client_name: { type: 'STRING' } } } },
  { name: 'consultar_venta', description: 'Detalle de las ventas/grupos de un cliente (productos, cantidades, total acordado, abonado, saldo, modalidad, fecha). Filtra opcionalmente por fecha YYYY-MM-DD. Admin: cualquier cliente; cliente: solo las suyas.',
    parameters: { type: 'OBJECT', properties: { client_name: { type: 'STRING' }, date: { type: 'STRING', description: 'fecha YYYY-MM-DD (opcional)' } } } },
  { name: 'historial_abonos', description: 'Historial de abonos (pagos válidos) de un cliente: monto USD, Bs, tasa, método y fecha. Admin: cualquier cliente; cliente: los suyos.',
    parameters: { type: 'OBJECT', properties: { client_name: { type: 'STRING' } } } },
  { name: 'resumen_ventas', description: 'SOLO ADMIN. Total y número de ventas de los últimos N días (por defecto 7).',
    parameters: { type: 'OBJECT', properties: { days: { type: 'NUMBER' } } } },
  { name: 'deudores_por_producto', description: 'SOLO ADMIN. Compradores de un producto agrupados por venta. Con solo_deuda=true, únicamente los grupos con saldo pendiente.',
    parameters: { type: 'OBJECT', properties: { product: { type: 'STRING' }, solo_deuda: { type: 'BOOLEAN' } }, required: ['product'] } },
  { name: 'consultar_credito_cliente', description: 'Crédito del SISTEMA DE CRÉDITOS de un cliente (límite, saldo, estado). Distinto de las cuentas por cobrar por ventas fiadas. Admin: cualquiera; cliente: el suyo.',
    parameters: { type: 'OBJECT', properties: { client_name: { type: 'STRING' } } } },
];

const ADMIN_ONLY_TOOLS = new Set(['listar_cxc', 'resumen_ventas', 'deudores_por_producto']);

function toolMeta(tool: string, extra: Record<string, unknown> = {}) {
  return { tool, source: 'supabase', ts: new Date().toISOString(), ...extra };
}

// Resolución de entidad: nunca deja que el modelo invente un cliente. Devuelve
// coincidencia única, lista para desambiguar, o "none".
async function resolveClientName(
  supabase: ReturnType<typeof getSupabaseClient>,
  name: string,
): Promise<{ status: 'unique' | 'ambiguous' | 'none'; match?: string; options?: string[] }> {
  const term = (name || '').trim();
  if (!term) return { status: 'none' };
  const { data } = await supabase
    .from('sales').select('client_name')
    .ilike('client_name', `%${term}%`).not('client_name', 'is', null).limit(300);
  const distinct = [...new Set(((data || []) as any[]).map((r) => r.client_name).filter(Boolean))] as string[];
  if (distinct.length === 0) return { status: 'none' };
  if (distinct.length === 1) return { status: 'unique', match: distinct[0] };
  const exact = distinct.filter((d) => d.toLowerCase() === term.toLowerCase());
  if (exact.length === 1) return { status: 'unique', match: exact[0] };
  return { status: 'ambiguous', options: distinct.slice(0, 10) };
}

// Carga grupos de venta (coalesce(sale_group_id, id)) con total/abonado/saldo
// reales del grupo. total_usd es el total acordado: NUNCA se recalcula.
async function loadSaleGroups(
  supabase: ReturnType<typeof getSupabaseClient>,
  opts: { clientName?: string; customerUserId?: string; date?: string; fiadoOnly?: boolean },
) {
  let q = supabase.from('sales')
    .select('id, sale_group_id, client_name, product_name, quantity, total_usd, amount_paid, payment_status, sale_modality, created_at, customer_user_id')
    .limit(1000);
  if (opts.fiadoOnly) q = q.eq('sale_modality', 'fiado');
  if (opts.clientName) q = q.eq('client_name', opts.clientName);
  if (opts.customerUserId) q = q.eq('customer_user_id', opts.customerUserId);
  if (opts.date) q = q.gte('created_at', `${opts.date}T00:00:00`).lte('created_at', `${opts.date}T23:59:59`);
  const { data } = await q;
  const groups = new Map<string, any>();
  for (const row of (data || []) as any[]) {
    const key: string = row.sale_group_id || row.id;
    const g = groups.get(key) || { groupId: key, clientName: '', items: new Map<string, number>(), total: 0, paid: 0, modality: row.sale_modality, isPartial: false, createdAt: row.created_at };
    g.total += Number(row.total_usd) || 0;
    g.paid += Number(row.amount_paid) || 0;
    if (row.payment_status === 'partial') g.isPartial = true;
    if (!g.clientName && row.client_name) g.clientName = row.client_name;
    if (row.product_name) g.items.set(row.product_name, (g.items.get(row.product_name) || 0) + (Number(row.quantity) || 0));
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({
    groupId: g.groupId,
    clientName: g.clientName || 'Sin nombre',
    modality: g.modality,
    products: [...g.items.entries()].map(([n, qn]) => (qn > 1 ? `${n} x${qn}` : n)).join(', '),
    total_usd: Math.round(g.total * 100) / 100,
    paid_usd: Math.round(g.paid * 100) / 100,
    balance_usd: Math.round((g.total - g.paid) * 100) / 100,
    isPartial: g.isPartial,
    createdAt: g.createdAt,
  }));
}

async function executeReadOnlyTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<Record<string, unknown>> {
  const supabase = ctx.supabase;
  try {
    if (ADMIN_ONLY_TOOLS.has(name) && !ctx.isAdmin) {
      return { error: 'forbidden', message: 'Esta información solo está disponible para administradores.', _meta: toolMeta(name) };
    }

    switch (name) {
      case 'consultar_categorias': {
        const { data } = await supabase.from('products').select('category').not('category', 'is', null).gt('stock', 0).limit(500);
        const cats = [...new Set(((data || []) as any[]).map((r) => r.category).filter(Boolean))];
        return { categories: cats, _meta: toolMeta(name) };
      }
      case 'buscar_producto': {
        let q = supabase.from('products').select('name, price_usd, price_bs_usd, stock, category').limit(15);
        if (args.query) q = q.ilike('name', `%${String(args.query)}%`);
        if (args.category) q = q.eq('category', String(args.category));
        const { data } = await q;
        return { products: (data || []).map((p: any) => ({ name: p.name, price_usd: Number(p.price_usd), price_bs: ctx.bcvRate ? Math.round(Number(p.price_usd) * ctx.bcvRate * 100) / 100 : null, stock: p.stock, category: p.category })), bcvRate: ctx.bcvRate, _meta: toolMeta(name) };
      }
      case 'consultar_precio': {
        const { data } = await supabase.from('products').select('name, price_usd, stock, category').ilike('name', `%${String(args.product || '')}%`).limit(5);
        return { products: (data || []).map((p: any) => ({ name: p.name, price_usd: Number(p.price_usd), price_bs: ctx.bcvRate ? Math.round(Number(p.price_usd) * ctx.bcvRate * 100) / 100 : null, stock: p.stock })), bcvRate: ctx.bcvRate, _meta: toolMeta(name) };
      }
      case 'consultar_stock': {
        let q = supabase.from('products').select('name, stock, category').order('stock', { ascending: true }).limit(15);
        if (args.product) q = q.ilike('name', `%${String(args.product)}%`);
        if (args.low_stock_only) q = q.lt('stock', 10);
        const { data } = await q;
        return { products: data || [], _meta: toolMeta(name) };
      }
      case 'listar_cxc': {
        const groups = (await loadSaleGroups(supabase, { fiadoOnly: true })).filter((g) => g.balance_usd > 0.001).sort((a, b) => b.balance_usd - a.balance_usd);
        const total = Math.round(groups.reduce((s, g) => s + g.balance_usd, 0) * 100) / 100;
        return { source_note: 'Cuentas por cobrar por VENTAS FIADAS (no son los créditos del sistema).', accounts: groups.map((g) => ({ client: g.clientName, products: g.products, total_usd: g.total_usd, paid_usd: g.paid_usd, balance_usd: g.balance_usd })), total_por_cobrar_usd: total, count: groups.length, _meta: toolMeta(name) };
      }
      case 'consultar_deuda_cliente': {
        let groups;
        if (ctx.isAdmin) {
          const r = await resolveClientName(supabase, String(args.client_name || ''));
          if (r.status === 'none') return { status: 'no_encontrado', message: `No encontré ventas de "${args.client_name || ''}".`, _meta: toolMeta(name) };
          if (r.status === 'ambiguous') return { status: 'ambiguo', options: r.options, message: 'Hay varios clientes con ese nombre; pide al usuario que elija.', _meta: toolMeta(name) };
          groups = (await loadSaleGroups(supabase, { clientName: r.match, fiadoOnly: true })).filter((g) => g.balance_usd > 0.001);
        } else {
          groups = (await loadSaleGroups(supabase, { customerUserId: ctx.authenticatedUserId, fiadoOnly: true })).filter((g) => g.balance_usd > 0.001);
        }
        const total = Math.round(groups.reduce((s, g) => s + g.balance_usd, 0) * 100) / 100;
        return { accounts: groups.map((g) => ({ client: g.clientName, products: g.products, total_usd: g.total_usd, paid_usd: g.paid_usd, balance_usd: g.balance_usd })), total_saldo_usd: total, _meta: toolMeta(name) };
      }
      case 'consultar_venta': {
        let groups;
        if (ctx.isAdmin) {
          const opts: any = { date: args.date ? String(args.date) : undefined };
          if (args.client_name) {
            const r = await resolveClientName(supabase, String(args.client_name));
            if (r.status === 'none') return { status: 'no_encontrado', message: `No encontré ventas de "${args.client_name}".`, _meta: toolMeta(name) };
            if (r.status === 'ambiguous') return { status: 'ambiguo', options: r.options, _meta: toolMeta(name) };
            opts.clientName = r.match;
          }
          groups = await loadSaleGroups(supabase, opts);
        } else {
          groups = await loadSaleGroups(supabase, { customerUserId: ctx.authenticatedUserId, date: args.date ? String(args.date) : undefined });
        }
        return { sales: groups.map((g) => ({ client: g.clientName, products: g.products, modality: g.modality, total_usd: g.total_usd, paid_usd: g.paid_usd, balance_usd: g.balance_usd, date: g.createdAt })), count: groups.length, _meta: toolMeta(name) };
      }
      case 'historial_abonos': {
        let groupIds: string[];
        let label = '';
        if (ctx.isAdmin) {
          const r = await resolveClientName(supabase, String(args.client_name || ''));
          if (r.status === 'none') return { status: 'no_encontrado', message: `No encontré ventas de "${args.client_name || ''}".`, _meta: toolMeta(name) };
          if (r.status === 'ambiguous') return { status: 'ambiguo', options: r.options, _meta: toolMeta(name) };
          label = r.match!;
          const groups = await loadSaleGroups(supabase, { clientName: r.match });
          groupIds = groups.map((g) => g.groupId);
        } else {
          const groups = await loadSaleGroups(supabase, { customerUserId: ctx.authenticatedUserId });
          groupIds = groups.map((g) => g.groupId);
        }
        if (groupIds.length === 0) return { payments: [], _meta: toolMeta(name) };
        const { data } = await supabase.from('sale_payments')
          .select('amount_usd, amount_bs, exchange_rate, payment_method, created_at, status, sale_group_id, sale_id')
          .eq('status', 'valid').or(`sale_group_id.in.(${groupIds.join(',')}),sale_id.in.(${groupIds.join(',')})`)
          .order('created_at', { ascending: false }).limit(100);
        return { client: label || 'tú', payments: (data || []).map((p: any) => ({ amount_usd: Number(p.amount_usd), amount_bs: p.amount_bs != null ? Number(p.amount_bs) : null, exchange_rate: p.exchange_rate != null ? Number(p.exchange_rate) : null, payment_method: p.payment_method, date: p.created_at })), _meta: toolMeta(name) };
      }
      case 'resumen_ventas': {
        const days = Math.max(1, Math.min(365, Number(args.days) || 7));
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase.from('sales').select('total_usd').gte('created_at', since);
        const total = ((data || []) as any[]).reduce((s, r) => s + (Number(r.total_usd) || 0), 0);
        return { days, total_usd: Math.round(total * 100) / 100, count: (data || []).length, _meta: toolMeta(name) };
      }
      case 'deudores_por_producto': {
        const term = String(args.product || '').trim();
        if (!term) return { status: 'no_encontrado', message: 'Indica el producto.', _meta: toolMeta(name) };
        const { data: matches } = await supabase.from('sales').select('sale_group_id, id').ilike('product_name', `%${term}%`).limit(1000);
        const groupIds = [...new Set(((matches || []) as any[]).map((r) => r.sale_group_id || r.id))];
        if (groupIds.length === 0) return { buyers: [], message: `Nadie ha comprado "${term}".`, _meta: toolMeta(name) };
        // Reconstruir el saldo real de cada grupo (todas sus líneas)
        const all = await loadSaleGroups(supabase, {});
        let buyers = all.filter((g) => groupIds.includes(g.groupId));
        if (args.solo_deuda) buyers = buyers.filter((g) => g.balance_usd > 0.001);
        return { product: term, solo_deuda: !!args.solo_deuda, buyers: buyers.map((g) => ({ client: g.clientName, products: g.products, total_usd: g.total_usd, paid_usd: g.paid_usd, balance_usd: g.balance_usd, date: g.createdAt })), count: buyers.length, _meta: toolMeta(name) };
      }
      case 'consultar_credito_cliente': {
        let q = supabase.from('credits').select('client_name, credit_limit, current_balance, status, trust_level, next_due_date, is_blocked').limit(5);
        if (ctx.isAdmin) {
          q = q.ilike('client_name', `%${String(args.client_name || '')}%`);
        } else {
          q = q.eq('client_user_id', ctx.authenticatedUserId);
        }
        const { data } = await q;
        if (!data || data.length === 0) return { status: 'no_encontrado', message: 'No encontré una línea de crédito.', _meta: toolMeta(name) };
        return { source_note: 'Crédito del SISTEMA DE CRÉDITOS (distinto de las cuentas por cobrar por ventas fiadas).', credits: data.map((c: any) => ({ client: c.client_name, limit_usd: Number(c.credit_limit), balance_usd: Number(c.current_balance), available_usd: Number(c.credit_limit) - Number(c.current_balance), status: c.status, trust_level: c.trust_level, blocked: c.is_blocked })), _meta: toolMeta(name) };
      }
      default:
        return { error: 'unknown_tool', message: `Herramienta desconocida: ${name}`, _meta: toolMeta(name) };
    }
  } catch (err) {
    console.error(`Tool ${name} error:`, err);
    return { error: 'tool_error', message: 'No pude obtener esa información en este momento.', _meta: toolMeta(name) };
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
    const { messages, context, action, customerId: requestCustomerId } = body;

    // ================== AUTHENTICATION CHECK ==================
    const authHeader = req.headers.get('Authorization');
    let authenticatedUserId: string | null = null;
    let isAdminVerified = false;
    let customerId: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Validate the caller's token explicitly (same pattern as admin-actions):
      // getUser(token) resolves the user reliably, whereas the no-argument
      // getUser() relying on a global Authorization header does not resolve it
      // with this supabase-js build — which is why every authenticated request
      // was returning 401 at the A-01 gate.
      const token = authHeader.replace('Bearer ', '');
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

      const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

      if (!userError && userData?.user) {
        authenticatedUserId = userData.user.id;
        isAdminVerified = userData.user.app_metadata?.is_super_admin === true;
        console.log('Authenticated user:', authenticatedUserId, 'isAdmin:', isAdminVerified);
      }
    }

    // Use verified admin status instead of trusting request body
    const isAdmin = isAdminVerified;

    // ================== AUTHENTICATION GATE (A-01) ==================
    // Every request (chat or action) requires a valid authenticated user.
    // Unauthenticated chat is blocked.
    if (!authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ================== OWNERSHIP RESOLUTION (A-01) ==================
    // customerId is derived server-side. A non-admin can only ever operate on
    // their own id; any mismatching customerId from the body is rejected.
    // Only a verified admin may target another customerId.
    if (isAdminVerified) {
      customerId = requestCustomerId || authenticatedUserId;
    } else {
      if (requestCustomerId && requestCustomerId !== authenticatedUserId) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: cannot access another customer' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      customerId = authenticatedUserId;
    }

    // ================== ACTION AUTHORIZATION (A-02, A-03) ==================
    // Administrative actions must be executed only by a verified admin. This is
    // enforced server-side and never trusts the frontend, body, or Gemini.
    if (action) {
      const ADMIN_ACTIONS = ['REGISTER_SALE', 'SEND_REMINDER', 'GET_CREDIT_INFO', 'CHECK_STOCK'];
      if (ADMIN_ACTIONS.includes(action.type) && !isAdminVerified) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const result = await processAction(action.type, action.data, {
        adminUserId: authenticatedUserId,
        authHeader: authHeader ?? undefined,
        supabaseUrl,
        supabaseAnonKey,
      });
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
      const receivablesList = businessContext.pendingReceivables
        .slice(0, 25)
        .map(r => `• ${r.clientName}: ${r.products || 'Sin detalle'} — total $${r.total.toFixed(2)}, abonado $${r.paid.toFixed(2)}, saldo $${r.balance.toFixed(2)}${r.isPartial ? ' (abono parcial)' : ''}`)
        .join('\n');
      const moreReceivables = businessContext.pendingReceivables.length > 25
        ? `\n(+${businessContext.pendingReceivables.length - 25} cuentas más)`
        : '';

      contextPrompt += `
DATOS ADMIN:
- Ventas últimos 7 días: $${businessContext.recentSales.toFixed(2)}
- Stock bajo: ${businessContext.lowStockProducts.map(p => `${p.name} (${p.stock})`).join(', ') || 'Ninguno'}

CRÉDITOS PENDIENTES (sistema de créditos):
${businessContext.pendingCredits.map(c => `• ${c.client_name}: $${c.current_balance}`).join('\n') || '• Ninguno'}

CUENTAS POR COBRAR — VENTAS FIADAS (deuda real por ventas):
${receivablesList || '• Ninguna'}${moreReceivables}
TOTAL POR COBRAR — VENTAS FIADAS: $${businessContext.totalReceivable.toFixed(2)}

NOTA: "CRÉDITOS PENDIENTES" y "CUENTAS POR COBRAR — VENTAS FIADAS" son dos fuentes distintas. Para responder a quién hay que cobrar, qué debe cada quien o qué ventas están pendientes, usa las VENTAS FIADAS (cliente, productos, total, abonado y saldo) y no las presentes como créditos.
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

    // Memoria de sesión: turnos recientes para resolver referencias como "ella"
    // o "esa venta". NO otorga permisos: cada herramienta revalida rol/entidad.
    const recentTurns = (messages || [])
      .slice(-7, -1)
      .map((m: any) => `${m.role === 'user' ? 'Usuario' : 'Ángela'}: ${String(m.content || '').slice(0, 300)}`)
      .join('\n');
    if (recentTurns) {
      contextPrompt += `
CONVERSACIÓN RECIENTE (para entender referencias como "ella"/"esa venta"; no cambia permisos):
${recentTurns}
`;
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
- Para datos concretos (deudas, cuentas por cobrar, ventas, pagos, stock, precios, créditos, resúmenes), USA las herramientas disponibles y responde SOLO con lo que devuelvan. NUNCA inventes clientes, montos, saldos, IDs ni fechas.
- "Cuentas por cobrar" o "a quién cobrar" = ventas fiadas (herramientas de CxC/deuda), NO los créditos del sistema; son fuentes distintas.
- Si una herramienta devuelve varias coincidencias (ambiguo), pregunta al usuario cuál antes de continuar. Si devuelve "no_encontrado", dilo con claridad.
- Las herramientas son de SOLO LECTURA: no puedes registrar, modificar, anular ni devolver nada en esta versión; si te lo piden, explica que aún no está disponible.

Respuesta de Ángela:`;


    console.log('Calling Gemini Flash for Angela response...');

    let generatedText = '';

    if (GEMINI_KEY) {
      const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
      // Contexto de herramientas READ-ONLY: el rol viene del token verificado, no
      // del cliente ni de Gemini. Gemini solo elige qué herramienta pedir.
      const toolCtx: ToolContext = {
        supabase,
        isAdmin,
        authenticatedUserId: authenticatedUserId as string,
        bcvRate: businessContext.bcvRate,
      };
      const geminiTools = [{ functionDeclarations: READONLY_TOOL_DECLARATIONS }];

      for (const model of modelsToTry) {
        try {
          console.log(`Trying Gemini model: ${model}`);
          // Conversación multi-turno para function calling. Primer turno: prompt.
          const contents: any[] = [{ role: 'user', parts: [{ text: contextPrompt }] }];
          let modelFailed = false;
          const MAX_TOOL_TURNS = 5;

          for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
            const geminiResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
                body: JSON.stringify({
                  contents,
                  tools: geminiTools,
                  generationConfig: { temperature: 0.7, maxOutputTokens: 2048, topP: 0.9 },
                }),
              }
            );

            if (!geminiResponse.ok) {
              const errText = await geminiResponse.text();
              console.error(`Gemini API error for model ${model}:`, geminiResponse.status, errText);
              modelFailed = true;
              break;
            }

            const geminiResult = await geminiResponse.json();
            const parts = geminiResult?.candidates?.[0]?.content?.parts || [];
            const fnCalls = parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);

            if (fnCalls.length > 0) {
              // Ejecutar cada herramienta pedida (solo lectura) y devolver el
              // resultado real al modelo para que lo redacte.
              contents.push({ role: 'model', parts });
              const responseParts: any[] = [];
              for (const call of fnCalls) {
                const result = await executeReadOnlyTool(call.name, call.args || {}, toolCtx);
                console.log(`Tool executed: ${call.name}`);
                responseParts.push({ functionResponse: { name: call.name, response: result } });
              }
              contents.push({ role: 'user', parts: responseParts });
              continue; // nueva vuelta para que el modelo redacte o pida otra tool
            }

            // Sin llamada a herramienta: respuesta en texto
            generatedText = parts.map((p: any) => p.text || '').join('').trim();
            break;
          }

          if (modelFailed) continue; // probar siguiente modelo
          if (generatedText && generatedText.length >= 2) {
            console.log(`Gemini response received from ${model}, length:`, generatedText.length);
            break;
          }
          console.warn(`Gemini model ${model} returned empty response`);
        } catch (geminiErr) {
          console.error(`Gemini fetch error for model ${model}:`, geminiErr);
        }
      }
      if (!generatedText || generatedText.length < 2) {
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
  const msg = userMessage.toLowerCase().trim();
  const bcvRate = context.bcvRate;

  // ── EMOCIONAL ──
  if (analysis.sentiment === 'negative') {
    return `🩷 Entiendo, quiero ayudarte. ¿Qué necesitas?\n\n• 💰 Precios y cálculos\n• 📦 Productos disponibles\n• 💳 Información de crédito\n• 🧑\u200d💼 Hablar con un asesor\n\nEstoy aquí para ti. ✨`;
  }
  if (analysis.sentiment === 'confused') {
    return `🩷 ¡Sin problema! Puedo ayudarte con:\n• 💰 Precios (tasa BCV: ${bcvRate} Bs/$)\n• 🛒 Buscar productos\n• 💳 Tu crédito\n\n¿Qué te gustaría hacer? ✨`;
  }

  // ── RESPUESTAS CORTESÍA / ESTADO / CASUALES ──
  if (msg.includes('todo bien') || msg.includes('cómo estás') || msg.includes('como estas') ||
      msg.includes('como te va') || msg.includes('cómo te va') || msg.includes('qué tal') || msg.includes('que tal')) {
    return `🩷 ¡Todo excelente por aquí! 😊 ¿En qué te puedo ayudar hoy con nuestro catálogo de Manojitos? ✨`;
  }

  if (msg.includes('gracias') || msg.includes('agradecido') || msg.includes('agradecida')) {
    return `🩷 ¡Con muchísimo gusto! Si necesitas algo más del catálogo, consultar la tasa BCV o tu crédito, solo dímelo. ¡Feliz día! ✨`;
  }

  // ── PREGUNTAS INFANTILES / NIÑOS ──
  if (msg.includes('niño') || msg.includes('niña') || msg.includes('niños') || msg.includes('niñas') ||
      msg.includes('infantil') || msg.includes('bebe') || msg.includes('bebé') || msg.includes('hijo') || msg.includes('hija')) {
    return `🩷 Por los momentos no tenemos prendas infantiles o para niños en nuestro catálogo. Disponemos de ropa para caballeros, damas, perfumes y accesorios. ¡Te invito a explorar nuestras categorías de Ropa o Perfumes! ✨`;
  }

  // ── UBICACIÓN / TIENDA FÍSICA ──
  if (msg.includes('tienda') || msg.includes('ubicacion') || msg.includes('ubicación') ||
      msg.includes('direccion') || msg.includes('dirección') || msg.includes('donde estan') ||
      msg.includes('dónde están') || msg.includes('local') || msg.includes('donde queda') || msg.includes('dónde queda')) {
    return `🩷 Manojitos es principalmente una tienda virtual con atención y envíos a toda Venezuela. Realizamos entregas personales seguras y envíos por las agencias nacionales.\n\n📞 Si deseas coordinar una entrega o tienes alguna pregunta específica, puedes contactarnos al WhatsApp **+58 426-3863042**. ✨`;
  }

  // ── ENVÍOS / DELIVERY ──
  if (msg.includes('delivery') || msg.includes('envio') || msg.includes('envío') ||
      msg.includes('envi') || msg.includes('entreg') || msg.includes('recibir')) {
    return `🩷 ¡Hacemos envíos a nivel nacional a toda Venezuela! 📦 También realizamos entregas personales bajo coordinación previa.\n\nPara detalles de costo y zonas de entrega, escríbenos directamente a nuestro WhatsApp **+58 426-3863042** y con gusto te ayudamos. ✨`;
  }

  // ── MÉTODOS DE PAGO ──
  if (msg.includes('pago') || msg.includes('pagar') || msg.includes('zelle') || msg.includes('pago móvil') ||
      msg.includes('pagomovil') || msg.includes('bolivares') || msg.includes('bs') || msg.includes('transferencia') || msg.includes('efectivo')) {
    return `🩷 **Métodos de pago aceptados:**\n\n• Pago Móvil 📱\n• Efectivo USD/Bs 💵\n• Zelle 💳\n• Transferencias bancarias\n\nLa tasa oficial de hoy es la del BCV: **${bcvRate} Bs/$** (más 10.7% de recargo en transacciones aplicables). ✨`;
  }

  // ── HORARIOS ──
  if (msg.includes('horario') || msg.includes('abierto') || msg.includes('cerrado') ||
      msg.includes('hora') || msg.includes('dia') || msg.includes('trabaja')) {
    return `🩷 **Nuestro horario de atención:**\n\n• Lunes a Viernes: 8:00 AM - 6:00 PM\n• Sábados: 9:00 AM - 1:00 PM\n\n¡Puedes ver y pedir productos en la web las 24 horas! ✨`;
  }

  // ── COLORES / TALLAS ──
  if (msg.includes('color') || msg.includes('colores') || msg.includes('talla') || msg.includes('tallas') || msg.includes('medida')) {
    return `🩷 Puedes consultar las tallas y colores disponibles para cada producto seleccionándolo en el catálogo aquí en la web. Si tienes alguna duda con las medidas de una prenda, escríbenos al WhatsApp **+58 426-3863042**. ✨`;
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

  // ── TASA BCV ──
  if (msg.includes('tasa') || msg.includes('bcv') || msg.includes('dólar') || msg.includes('dolar')) {
    const extraPercent = context.extraPercentage;
    return `🩷 **Tasa BCV de hoy: ${bcvRate} Bs/$**\n\nCon el ${extraPercent}% de recargo, la tasa efectiva es: **${(bcvRate * (1 + extraPercent / 100)).toFixed(2)} Bs/$**\n\n¿Quieres calcular algún precio? ✨`;
  }

  // ── PRECIOS / CONVERSIÓN ──
  if (msg.includes('calcul') || msg.includes('precio') || msg.includes('cuánto') || msg.includes('cuanto') || msg.includes('costo')) {
    const numbers = msg.match(/\d+(\.\d+)?/g);
    if (numbers && numbers.length >= 1 && bcvRate > 0) {
      const amount = parseFloat(numbers[0]);
      const extraPercent = context.extraPercentage;
      const totalBs = amount * bcvRate * (1 + extraPercent / 100);
      const totalBsWithout = amount * bcvRate;

      return `🩷 **Cálculo de precio:**\n\n• Monto: **$${amount}**\n• Tasa BCV: ${bcvRate} Bs/$\n• En Bs puro: ${totalBsWithout.toFixed(2)} Bs\n• Con ${extraPercent}%: **${totalBs.toFixed(2)} Bs**\n\n💡 *Si pagas en USD ahorras ${(totalBs - totalBsWithout).toFixed(2)} Bs* ✨`;
    }
    return `🩷 Para calcular un precio:\n\nDime el monto en USD y te lo convierto.\nTasa BCV: ${bcvRate} Bs/$ + ${context.extraPercentage}% de recargo ✨`;
  }

  // ── DETECTAR CATEGORÍAS ──
  const hasCategoryQuery = msg.includes('categor') || msg.includes('ropa') || msg.includes('perfume') ||
                           msg.includes('interior') || msg.includes('pantalon') || msg.includes('playa') ||
                           context.categories.some(cat => msg.includes(cat.toLowerCase()));

  if (hasCategoryQuery) {
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

  // ── CRÉDITO ──
  if (msg.includes('crédito') || msg.includes('credito') || msg.includes('saldo') || msg.includes('deuda') || msg.includes('fiado') || msg.includes('debo')) {
    if (context.customerHistory) {
      return `🩷 **Tu crédito en Manojitos:**\n\n• Estado: ${context.customerHistory.creditStatus}\n• Límite: $${context.customerHistory.creditLimit}\n• Compras totales: ${context.customerHistory.totalPurchases}\n\n¿Necesitas más detalles? ✨`;
    }
    if (isAdmin) return `🩷 ¿De qué cliente necesitas información de crédito? ✨`;
    return `🩷 Puedo mostrarte tu información de crédito. ¿Quieres ver tu saldo o límite disponible? ✨`;
  }

  // ── STOCK (ADMIN) ──
  if (msg.includes('stock') && isAdmin) {
    if (context.lowStockProducts.length > 0) {
      const list = context.lowStockProducts.map(p => `• ${p.name}: ${p.stock} unidades`).join('\n');
      return `🩷 **Productos con stock bajo:**\n\n${list}\n\n¿Hago un pedido al proveedor? ✨`;
    }
    return `🩷 ¡Todo el inventario está bien abastecido! 🎉`;
  }

  // ── MAPEO SEMÁNTICO DE ESTILOS / CONTEXTO ──
  const styleMap: Record<string, string[]> = {
    playero:   ['short', 'shorts', 'franela', 'franelilla', 'vestido', 'playa', 'maya', 'mayas', 'baño'],
    playa:     ['short', 'shorts', 'franela', 'franelilla', 'vestido', 'playa', 'maya', 'mayas', 'baño'],
    verano:    ['short', 'shorts', 'franela', 'franelilla', 'vestido', 'playa', 'maya', 'mayas', 'baño'],
    calor:     ['short', 'shorts', 'franela', 'franelilla'],
    sport:     ['short', 'shorts', 'franela', 'deportivo'],
    gym:       ['short', 'shorts', 'franela', 'deportivo'],
    ejercicio: ['short', 'shorts', 'franela', 'deportivo'],
    deportivo: ['short', 'shorts', 'franela', 'deportivo'],
    fiesta:    ['vestido', 'body', 'perfume', 'jean paul', 'scandal'],
    salir:     ['vestido', 'body', 'perfume'],
    noche:     ['vestido', 'body', 'perfume'],
    cita:      ['vestido', 'body', 'perfume'],
    'cómodo':  ['bragas', 'body'],
    comodo:    ['bragas', 'body'],
    hombre:    ['short', 'shorts hombre', 'franela', 'oversize', 'chemise'],
    caballero: ['short', 'shorts hombre', 'franela', 'oversize', 'chemise'],
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
    return `🩷 Encontré esto en nuestro catálogo que podría interesarte:\n\n${list}\n\n¿Es lo que buscabas? ✨`;
  }

  // ── MENÚ FINAL ──
  const topProduct = context.topProducts[0];
  return `🩷 Puedo ayudarte con:\n\n• 🛒 Productos: ${context.categories.slice(0, 3).join(', ')}\n• 💰 Precios en USD y Bs (tasa: ${bcvRate} Bs/$)\n• 💳 Tu crédito disponible${topProduct ? `\n\n🔥 Destacado: **${topProduct.name}** - $${topProduct.price_usd}` : ''}\n\n¿Qué necesitas? ✨`;
}
