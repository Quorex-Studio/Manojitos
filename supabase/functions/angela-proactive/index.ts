import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const alerts: Array<{
      alert_type: string;
      severity: string;
      title: string;
      message: string;
      reference_type?: string;
      reference_id?: string;
      action_data?: Record<string, unknown>;
    }> = [];

    // 1. STOCK BAJO - productos con stock < minimum_stock
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('id, name, stock, minimum_stock, sold_count, price_usd, user_id')
      .lt('stock', 10); // Usar 10 como default si minimum_stock no está configurado

    if (lowStockProducts) {
      for (const product of lowStockProducts) {
        const minStock = product.minimum_stock || 5;
        if (product.stock < minStock) {
          // Calcular cantidad sugerida basada en ventas
          const suggestedQty = Math.max(minStock * 2, product.sold_count || 10);
          
          alerts.push({
            alert_type: 'stock_low',
            severity: product.stock === 0 ? 'critical' : 'warning',
            title: `📦 Stock bajo: ${product.name}`,
            message: `El producto "${product.name}" tiene solo ${product.stock} unidades (mínimo: ${minStock}). Sugiero reordenar ${suggestedQty} unidades según ventas históricas.`,
            reference_type: 'product',
            reference_id: product.id,
            action_data: { suggestedQty, currentStock: product.stock }
          });
        }
      }
    }

    // 2. CLIENTES RIESGOSOS - trust_score bajo o pagos atrasados
    const { data: riskyClients } = await supabase
      .from('credits')
      .select('id, client_name, trust_score, trust_level, current_balance, consecutive_late_payments, is_blocked, user_id')
      .or('trust_score.lt.50,consecutive_late_payments.gt.2')
      .eq('is_blocked', false)
      .gt('current_balance', 0);

    if (riskyClients) {
      for (const client of riskyClients) {
        let severity = 'warning';
        let action = 'Sugiero monitorear de cerca';
        
        if (client.trust_score < 30 || client.consecutive_late_payments > 3) {
          severity = 'critical';
          action = 'Sugiero bloquear crédito o exigir pago parcial';
        }
        
        alerts.push({
          alert_type: 'risky_client',
          severity,
          title: `⚠️ Cliente riesgoso: ${client.client_name}`,
          message: `${client.client_name} presenta riesgo crediticio (Trust Score: ${client.trust_score}/100, Pagos tardíos: ${client.consecutive_late_payments}). ${action}.`,
          reference_type: 'credit',
          reference_id: client.id,
          action_data: { trustScore: client.trust_score, latePayments: client.consecutive_late_payments }
        });
      }
    }

    // 3. DEUDAS VENCIDAS
    const { data: overdueDebts } = await supabase
      .from('credits')
      .select('id, client_name, current_balance, next_due_date, client_phone, user_id')
      .lt('next_due_date', new Date().toISOString().split('T')[0])
      .gt('current_balance', 0)
      .eq('is_blocked', false);

    if (overdueDebts) {
      for (const debt of overdueDebts) {
        const daysOverdue = Math.floor((Date.now() - new Date(debt.next_due_date).getTime()) / (1000 * 60 * 60 * 24));
        
        alerts.push({
          alert_type: 'overdue_debt',
          severity: daysOverdue > 7 ? 'critical' : 'warning',
          title: `💸 Deuda vencida: ${debt.client_name}`,
          message: `La deuda de ${debt.client_name} ($${debt.current_balance}) está vencida desde hace ${daysOverdue} días. Se recomienda contacto inmediato.`,
          reference_type: 'credit',
          reference_id: debt.id,
          action_data: { daysOverdue, balance: debt.current_balance, phone: debt.client_phone }
        });
      }
    }

    // 4. PRODUCTOS ESTRELLA - ventas ↑ 30% vs promedio
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
      // Agrupar ventas por producto
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

      // Detectar productos con aumento > 30%
      for (const [productId, data] of Object.entries(recentByProduct)) {
        const previousQty = previousByProduct[productId] || 0;
        if (previousQty > 0) {
          const increase = ((data.qty - previousQty) / previousQty) * 100;
          if (increase >= 30) {
            alerts.push({
              alert_type: 'star_product',
              severity: 'info',
              title: `🔥 Producto estrella: ${data.name}`,
              message: `"${data.name}" está teniendo alto rendimiento (+${increase.toFixed(0)}% vs semana anterior). Considera una promoción o aumento leve de precio (3-7%).`,
              reference_type: 'product',
              reference_id: productId,
              action_data: { increase: increase.toFixed(0), recentQty: data.qty, previousQty }
            });
          }
        }
      }
    }

    // Obtener todos los admin users para asignar alertas
    const { data: adminUsers } = await supabase
      .from('profiles')
      .select('user_id');

    // Insertar alertas para cada admin (evitar duplicados del mismo día)
    const today = new Date().toISOString().split('T')[0];
    
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
        // Insertar para el primer admin encontrado (simplificación)
        if (adminUsers && adminUsers.length > 0) {
          await supabase.from('angela_alerts').insert({
            user_id: adminUsers[0].user_id,
            ...alert
          });
        }
      }
    }

    console.log(`Generated ${alerts.length} alerts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertsGenerated: alerts.length,
        alerts: alerts.map(a => ({ type: a.alert_type, title: a.title }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Angela proactive error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
