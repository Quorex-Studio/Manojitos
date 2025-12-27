import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Angela Cron Alerts - Función de alertas automáticas
 * 
 * Esta función se ejecuta periódicamente para:
 * 1. Detectar stock bajo
 * 2. Identificar clientes riesgosos
 * 3. Alertar sobre deudas vencidas
 * 4. Detectar productos estrella
 * 5. Limpiar memoria expirada
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔔 Angela Cron Alerts started...');

    const alerts: Array<{
      alert_type: string;
      severity: string;
      title: string;
      message: string;
      reference_type?: string;
      reference_id?: string;
      action_data?: Record<string, unknown>;
    }> = [];

    // ================== 1. STOCK BAJO ==================
    console.log('Checking low stock...');
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('id, name, stock, minimum_stock, sold_count, price_usd, user_id')
      .lt('stock', 10);

    if (lowStockProducts) {
      for (const product of lowStockProducts) {
        const minStock = product.minimum_stock || 5;
        if (product.stock < minStock) {
          const suggestedQty = Math.max(minStock * 2, product.sold_count || 10);
          const severity = product.stock === 0 ? 'critical' : 'warning';
          
          alerts.push({
            alert_type: 'stock_low',
            severity,
            title: `📦 Stock ${severity === 'critical' ? 'AGOTADO' : 'bajo'}: ${product.name}`,
            message: `"${product.name}" tiene ${product.stock} unidades (mínimo: ${minStock}). Sugiero reordenar ${suggestedQty} unidades basado en ventas históricas.`,
            reference_type: 'product',
            reference_id: product.id,
            action_data: { 
              suggestedQty, 
              currentStock: product.stock,
              estimatedCost: suggestedQty * product.price_usd * 0.6 // Estimado de costo
            }
          });
        }
      }
    }

    // ================== 2. CLIENTES RIESGOSOS ==================
    console.log('Checking risky clients...');
    const { data: riskyClients } = await supabase
      .from('credits')
      .select('id, client_name, trust_score, trust_level, current_balance, consecutive_late_payments, is_blocked, user_id, client_phone')
      .or('trust_score.lt.50,consecutive_late_payments.gt.2')
      .eq('is_blocked', false)
      .gt('current_balance', 0);

    if (riskyClients) {
      for (const client of riskyClients) {
        let severity = 'warning';
        let action = 'Sugiero monitorear de cerca y considerar restricción de crédito';
        
        if (client.trust_score < 30 || client.consecutive_late_payments > 3) {
          severity = 'critical';
          action = 'URGENTE: Sugiero bloquear crédito o exigir pago parcial antes de más ventas';
        }
        
        alerts.push({
          alert_type: 'risky_client',
          severity,
          title: `⚠️ Cliente riesgoso: ${client.client_name}`,
          message: `${client.client_name} presenta riesgo crediticio (Trust Score: ${client.trust_score}/100, Pagos tardíos consecutivos: ${client.consecutive_late_payments}, Saldo: $${client.current_balance}). ${action}.`,
          reference_type: 'credit',
          reference_id: client.id,
          action_data: { 
            trustScore: client.trust_score, 
            latePayments: client.consecutive_late_payments,
            balance: client.current_balance,
            phone: client.client_phone
          }
        });
      }
    }

    // ================== 3. DEUDAS VENCIDAS ==================
    console.log('Checking overdue debts...');
    const today = new Date().toISOString().split('T')[0];
    const { data: overdueDebts } = await supabase
      .from('credits')
      .select('id, client_name, current_balance, next_due_date, client_phone, user_id, grace_days')
      .lt('next_due_date', today)
      .gt('current_balance', 0)
      .eq('is_blocked', false);

    if (overdueDebts) {
      for (const debt of overdueDebts) {
        const dueDate = new Date(debt.next_due_date);
        const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const graceDays = debt.grace_days || 3;
        
        let severity = 'warning';
        let urgency = 'Se recomienda contacto amable';
        
        if (daysOverdue > graceDays) {
          severity = 'critical';
          urgency = 'URGENTE: Fuera del período de gracia. Contactar inmediatamente';
        }
        
        alerts.push({
          alert_type: 'overdue_debt',
          severity,
          title: `💸 Deuda vencida: ${debt.client_name}`,
          message: `La deuda de ${debt.client_name} ($${debt.current_balance}) venció hace ${daysOverdue} días (gracia: ${graceDays} días). ${urgency}.`,
          reference_type: 'credit',
          reference_id: debt.id,
          action_data: { 
            daysOverdue, 
            balance: debt.current_balance, 
            phone: debt.client_phone,
            graceDays
          }
        });
      }
    }

    // ================== 4. PRODUCTOS ESTRELLA ==================
    console.log('Checking star products...');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentSales } = await supabase
      .from('sales')
      .select('product_id, product_name, quantity, total_usd')
      .gte('created_at', sevenDaysAgo)
      .eq('status', 'confirmed');

    const { data: previousSales } = await supabase
      .from('sales')
      .select('product_id, quantity')
      .gte('created_at', fourteenDaysAgo)
      .lt('created_at', sevenDaysAgo)
      .eq('status', 'confirmed');

    if (recentSales && previousSales) {
      const recentByProduct: Record<string, { qty: number; name: string; total: number }> = {};
      const previousByProduct: Record<string, number> = {};

      for (const sale of recentSales) {
        if (sale.product_id) {
          if (!recentByProduct[sale.product_id]) {
            recentByProduct[sale.product_id] = { qty: 0, name: sale.product_name, total: 0 };
          }
          recentByProduct[sale.product_id].qty += sale.quantity;
          recentByProduct[sale.product_id].total += Number(sale.total_usd);
        }
      }

      for (const sale of previousSales) {
        if (sale.product_id) {
          previousByProduct[sale.product_id] = (previousByProduct[sale.product_id] || 0) + sale.quantity;
        }
      }

      for (const [productId, data] of Object.entries(recentByProduct)) {
        const previousQty = previousByProduct[productId] || 0;
        if (previousQty > 0) {
          const increase = ((data.qty - previousQty) / previousQty) * 100;
          if (increase >= 30) {
            const suggestedIncrease = Math.min(Math.round(increase / 10), 10); // 3-10%
            
            alerts.push({
              alert_type: 'star_product',
              severity: 'info',
              title: `🔥 Producto estrella: ${data.name}`,
              message: `"${data.name}" está volando (+${increase.toFixed(0)}% vs semana anterior, $${data.total.toFixed(2)} en ventas). Considera aumentar precio ${suggestedIncrease}% o crear una promoción combo.`,
              reference_type: 'product',
              reference_id: productId,
              action_data: { 
                increase: increase.toFixed(0), 
                recentQty: data.qty, 
                previousQty,
                recentRevenue: data.total,
                suggestedPriceIncrease: suggestedIncrease
              }
            });
          }
        }
      }
    }

    // ================== 5. LIMPIAR MEMORIA EXPIRADA ==================
    console.log('Cleaning expired memory...');
    const { error: cleanupError } = await supabase
      .from('customer_memory')
      .delete()
      .lt('expires_at', new Date().toISOString());
    
    if (cleanupError) {
      console.error('Error cleaning expired memory:', cleanupError);
    }

    // ================== INSERTAR ALERTAS ==================
    const { data: adminUsers } = await supabase
      .from('profiles')
      .select('user_id');

    let insertedCount = 0;
    
    for (const alert of alerts) {
      // Verificar si ya existe una alerta similar hoy
      const { data: existing } = await supabase
        .from('angela_alerts')
        .select('id')
        .eq('alert_type', alert.alert_type)
        .eq('reference_id', alert.reference_id)
        .gte('created_at', `${today}T00:00:00`)
        .limit(1);

      if (!existing || existing.length === 0) {
        if (adminUsers && adminUsers.length > 0) {
          const { error } = await supabase.from('angela_alerts').insert({
            user_id: adminUsers[0].user_id,
            ...alert
          });
          
          if (!error) {
            insertedCount++;
          }
        }
      }
    }

    console.log(`✅ Angela Cron completed: ${alerts.length} alerts detected, ${insertedCount} new alerts inserted`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertsDetected: alerts.length,
        alertsInserted: insertedCount,
        summary: {
          stockLow: alerts.filter(a => a.alert_type === 'stock_low').length,
          riskyClients: alerts.filter(a => a.alert_type === 'risky_client').length,
          overdueDebts: alerts.filter(a => a.alert_type === 'overdue_debt').length,
          starProducts: alerts.filter(a => a.alert_type === 'star_product').length,
        },
        alerts: alerts.map(a => ({ type: a.alert_type, title: a.title, severity: a.severity }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Angela cron error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
