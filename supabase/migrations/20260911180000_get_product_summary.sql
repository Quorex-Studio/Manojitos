-- Migration para RPC de Fase 2.6: Resumen por Producto

-- 1. RPC para resumir métricas por producto
CREATE OR REPLACE FUNCTION get_product_summary(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_category TEXT DEFAULT 'all'
) RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  category TEXT,
  vendido NUMERIC,
  ventas NUMERIC,
  por_cobrar NUMERIC,
  pedidos NUMERIC,
  total_usd NUMERIC,
  total_bs NUMERIC,
  cobrado NUMERIC,
  pendiente NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH product_sales AS (
        SELECT 
            s.product_id,
            COALESCE(SUM(s.quantity), 0) AS total_vendido,
            COALESCE(SUM(CASE WHEN s.payment_status = 'paid' THEN s.quantity ELSE 0 END), 0) AS cant_ventas,
            COALESCE(SUM(CASE WHEN s.payment_status != 'paid' THEN s.quantity ELSE 0 END), 0) AS cant_por_cobrar,
            COALESCE(SUM(s.total_usd), 0) AS total_usd,
            COALESCE(SUM(s.total_bs), 0) AS total_bs,
            COALESCE(SUM(s.amount_paid), 0) AS cobrado,
            COALESCE(SUM(s.total_usd - s.amount_paid), 0) AS pendiente
        FROM public.sales s
        WHERE 
            (p_start_date IS NULL OR s.created_at >= p_start_date)
            AND (p_end_date IS NULL OR s.created_at <= p_end_date)
            AND s.product_id IS NOT NULL
        GROUP BY s.product_id
    ),
    product_orders AS (
        SELECT 
            (item->>'product_id')::UUID AS product_id,
            COALESCE(SUM((item->>'quantity')::NUMERIC), 0) AS cant_pedidos
        FROM public.orders o
        CROSS JOIN LATERAL jsonb_array_elements(o.items::jsonb) AS item
        WHERE o.status = 'pending'
            AND (p_start_date IS NULL OR o.created_at >= p_start_date)
            AND (p_end_date IS NULL OR o.created_at <= p_end_date)
            AND item->>'product_id' IS NOT NULL
            AND item->>'product_id' != ''
        GROUP BY (item->>'product_id')::UUID
    )
    SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.category,
        COALESCE(ps.total_vendido, 0) AS vendido,
        COALESCE(ps.cant_ventas, 0) AS ventas,
        COALESCE(ps.cant_por_cobrar, 0) AS por_cobrar,
        COALESCE(po.cant_pedidos, 0) AS pedidos,
        COALESCE(ps.total_usd, 0) AS total_usd,
        COALESCE(ps.total_bs, 0) AS total_bs,
        COALESCE(ps.cobrado, 0) AS cobrado,
        COALESCE(ps.pendiente, 0) AS pendiente
    FROM public.products p
    LEFT JOIN product_sales ps ON p.id = ps.product_id
    LEFT JOIN product_orders po ON p.id = po.product_id
    WHERE 
        (p_category IS NULL OR p_category = 'all' OR p.category = p_category)
        AND (COALESCE(ps.total_vendido, 0) > 0 OR COALESCE(po.cant_pedidos, 0) > 0)
    ORDER BY p.name ASC;
END;
$$;

-- 2. RPC para deudores por producto
CREATE OR REPLACE FUNCTION get_product_debtors(
  p_product_id UUID
) RETURNS TABLE (
  sale_id UUID,
  sale_group_id UUID,
  client_name TEXT,
  client_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  quantity NUMERIC,
  total_usd NUMERIC,
  amount_paid NUMERIC,
  pending_usd NUMERIC,
  sale_modality TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS sale_id,
        s.sale_group_id,
        s.client_name,
        s.client_phone,
        s.created_at,
        s.quantity,
        s.total_usd,
        s.amount_paid,
        (s.total_usd - s.amount_paid) AS pending_usd,
        s.sale_modality
    FROM public.sales s
    WHERE s.product_id = p_product_id
      AND s.payment_status != 'paid'
      AND (s.total_usd - s.amount_paid) > 0
    ORDER BY s.created_at DESC;
END;
$$;
