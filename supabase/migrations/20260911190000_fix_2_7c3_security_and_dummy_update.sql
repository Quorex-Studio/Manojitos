-- FASE 2.7C-3: Correcciones forenses de hallazgos 2.5 + 2.6 + 2.7
-- Fecha: 2026-09-11
-- 
-- PROBLEMAS CORREGIDOS:
-- 1. edit_sale_total: UPDATE dummy en columna updated_at inexistente -> runtime error silencioso
-- 2. Todos los SECURITY DEFINER sin SET search_path -> riesgo de search_path injection
-- 3. Funciones ejecutables por anon -> exposición no autorizada
-- 4. Autorización insuficiente: solo auth.uid() IS NOT NULL, faltaba is_admin()
-- 5. edit_group_abono: no bloqueaba el pago antes de editar
-- 6. void_group_abono: no bloqueaba el pago, autorizaba por user_id incorrecto

-- ============================================================
-- NUEVA FUNCIÓN: recalculate_sale_group (explícita, atómica)
-- Reemplaza arquitectura de UPDATE dummy
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_sale_group(
    p_sale_group_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_paid NUMERIC;
    v_remaining NUMERIC;
    v_sale RECORD;
    v_to_pay NUMERIC;
BEGIN
    IF p_sale_group_id IS NULL THEN
        RETURN;
    END IF;

    -- 1. Lock group and get sum of VALID payments
    SELECT COALESCE(SUM(sp.amount_usd), 0) INTO v_total_paid
    FROM public.sale_payments sp
    WHERE (
        sp.sale_group_id = p_sale_group_id
        OR sp.sale_id IN (SELECT id FROM public.sales WHERE sale_group_id = p_sale_group_id)
    )
    AND sp.status = 'valid';

    v_remaining := v_total_paid;

    -- 2. FIFO attribution: only updates sales.amount_paid (derived field)
    -- Historical sale_payments records are NEVER modified
    FOR v_sale IN
        SELECT id, total_usd
        FROM public.sales
        WHERE sale_group_id = p_sale_group_id
        ORDER BY created_at ASC
        FOR UPDATE
    LOOP
        IF v_remaining >= v_sale.total_usd THEN
            v_to_pay := v_sale.total_usd;
        ELSIF v_remaining > 0 THEN
            v_to_pay := v_remaining;
        ELSE
            v_to_pay := 0;
        END IF;

        v_remaining := v_remaining - v_to_pay;

        UPDATE public.sales
        SET
            amount_paid = v_to_pay,
            payment_status = CASE
                WHEN v_to_pay >= total_usd THEN 'paid'
                WHEN v_to_pay > 0 THEN 'partial'
                ELSE 'pending'
            END
        WHERE id = v_sale.id;
    END LOOP;
END;
$$;

-- recalculate_sale_group: internal use only, not for direct client calls
REVOKE ALL ON FUNCTION public.recalculate_sale_group(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_sale_group(UUID) FROM anon;

-- ============================================================
-- FIX: edit_sale_total — eliminada arquitectura UPDATE dummy
-- ============================================================
CREATE OR REPLACE FUNCTION public.edit_sale_total(
    p_sale_id UUID,
    p_new_total_usd NUMERIC,
    p_notes TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_group_id UUID;
    v_rows_updated INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
    END IF;

    UPDATE public.sales
    SET total_usd = p_new_total_usd,
        notes = p_notes
    WHERE id = p_sale_id
    RETURNING sale_group_id INTO v_group_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'Venta no encontrada o sin acceso';
    END IF;

    -- Explicit recalculation (no dummy update, no side-effect dependency)
    PERFORM public.recalculate_sale_group(v_group_id);

    RETURN jsonb_build_object('success', true, 'group_id', v_group_id);
END;
$$;

REVOKE ALL ON FUNCTION public.edit_sale_total(UUID, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.edit_sale_total(UUID, NUMERIC, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.edit_sale_total(UUID, NUMERIC, TEXT) TO authenticated;

-- ============================================================
-- FIX: process_group_abono — search_path + is_admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_group_abono(
    p_sale_group_id UUID,
    p_amount_usd NUMERIC,
    p_amount_bs NUMERIC,
    p_exchange_rate NUMERIC,
    p_usdt_rate NUMERIC,
    p_usdt_bought NUMERIC,
    p_payment_method TEXT,
    p_notes TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_first_sale_id UUID;
    v_abono_id UUID;
    v_ledger_id UUID;
    v_client_name TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
    END IF;

    SELECT id, client_name INTO v_first_sale_id, v_client_name
    FROM public.sales
    WHERE sale_group_id = p_sale_group_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontraron ventas para este grupo';
    END IF;

    -- Insert ONE payment per abono — trigger handles FIFO attribution
    INSERT INTO public.sale_payments (
        sale_group_id,
        amount_usd,
        amount_bs,
        exchange_rate,
        usdt_rate,
        usdt_bought,
        payment_method,
        notes,
        status
    ) VALUES (
        p_sale_group_id,
        p_amount_usd,
        p_amount_bs,
        p_exchange_rate,
        p_usdt_rate,
        p_usdt_bought,
        p_payment_method,
        p_notes,
        'valid'
    ) RETURNING id INTO v_abono_id;

    INSERT INTO public.ledger (
        type, category, amount, description, payment_method, reference_id, user_id
    ) VALUES (
        'ingreso',
        'ventas',
        p_amount_usd,
        'Abono a cuenta por cobrar (Fiado) - ' || COALESCE(v_client_name, 'Cliente'),
        p_payment_method,
        p_sale_group_id::text,
        v_user_id
    ) RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object(
        'success', true,
        'abono_id', v_abono_id,
        'ledger_id', v_ledger_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.process_group_abono(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_group_abono(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_group_abono(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;

-- ============================================================
-- FIX: edit_group_abono — search_path + is_admin + FOR UPDATE lock
-- ============================================================
CREATE OR REPLACE FUNCTION public.edit_group_abono(
    p_abono_id UUID,
    p_amount_usd NUMERIC,
    p_amount_bs NUMERIC,
    p_exchange_rate NUMERIC,
    p_payment_method TEXT,
    p_notes TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_group_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
    END IF;

    -- Lock the payment row before editing
    SELECT sp.sale_group_id INTO v_group_id
    FROM public.sale_payments sp
    WHERE sp.id = p_abono_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Abono no encontrado';
    END IF;

    UPDATE public.sale_payments
    SET amount_usd     = p_amount_usd,
        amount_bs      = p_amount_bs,
        exchange_rate  = p_exchange_rate,
        payment_method = p_payment_method,
        notes          = p_notes
    WHERE id = p_abono_id;

    -- Explicit recalculation
    PERFORM public.recalculate_sale_group(v_group_id);

    -- Update ledger
    UPDATE public.ledger
    SET amount         = p_amount_usd,
        payment_method = p_payment_method
    WHERE reference_id = v_group_id::text;

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.edit_group_abono(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.edit_group_abono(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.edit_group_abono(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;

-- ============================================================
-- FIX: void_group_abono — search_path + is_admin + FOR UPDATE lock
-- ============================================================
CREATE OR REPLACE FUNCTION public.void_group_abono(
    p_abono_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_group_id UUID;
    v_rows INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
    END IF;

    -- Lock the payment row
    SELECT sale_group_id INTO v_group_id
    FROM public.sale_payments
    WHERE id = p_abono_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Abono no encontrado';
    END IF;

    -- Void preserves auditability: status='void', record remains
    UPDATE public.sale_payments
    SET status = 'void'
    WHERE id = p_abono_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE EXCEPTION 'No se pudo anular el abono';
    END IF;

    -- Explicit recalculation
    PERFORM public.recalculate_sale_group(v_group_id);

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.void_group_abono(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.void_group_abono(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.void_group_abono(UUID) TO authenticated;

-- ============================================================
-- FIX: get_product_summary — search_path + is_admin + remove user_id filter
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_product_summary(
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
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
    END IF;

    RETURN QUERY
    WITH product_sales AS (
        SELECT
            s.product_id,
            CAST(COALESCE(SUM(s.quantity), 0) AS NUMERIC) AS total_vendido,
            CAST(COALESCE(SUM(CASE WHEN s.payment_status = 'paid' THEN s.quantity ELSE 0 END), 0) AS NUMERIC) AS cant_ventas,
            CAST(COALESCE(SUM(CASE WHEN s.payment_status != 'paid' THEN s.quantity ELSE 0 END), 0) AS NUMERIC) AS cant_por_cobrar,
            CAST(COALESCE(SUM(s.total_usd), 0) AS NUMERIC) AS total_usd,
            CAST(COALESCE(SUM(s.total_bs), 0) AS NUMERIC) AS total_bs,
            CAST(COALESCE(SUM(s.amount_paid), 0) AS NUMERIC) AS cobrado,
            CAST(COALESCE(SUM(s.total_usd - s.amount_paid), 0) AS NUMERIC) AS pendiente
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
            CAST(COALESCE(SUM((item->>'quantity')::NUMERIC), 0) AS NUMERIC) AS cant_pedidos
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

REVOKE ALL ON FUNCTION public.get_product_summary(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_product_summary(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_product_summary(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated;

-- ============================================================
-- FIX: get_product_debtors — search_path + is_admin + remove user_id filter
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_product_debtors(
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
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
    END IF;

    RETURN QUERY
    SELECT
        s.id AS sale_id,
        s.sale_group_id,
        s.client_name,
        s.client_phone,
        s.created_at,
        CAST(s.quantity AS NUMERIC),
        CAST(s.total_usd AS NUMERIC),
        CAST(s.amount_paid AS NUMERIC),
        CAST((s.total_usd - s.amount_paid) AS NUMERIC) AS pending_usd,
        s.sale_modality
    FROM public.sales s
    WHERE s.product_id = p_product_id
      AND s.payment_status != 'paid'
      AND (s.total_usd - s.amount_paid) > 0
    ORDER BY s.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_product_debtors(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_product_debtors(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_product_debtors(UUID) TO authenticated;

-- ============================================================
-- FIX: trg_recalculate_group_payments — add SET search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_recalculate_group_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group_id UUID;
    v_total_paid NUMERIC;
    v_remaining NUMERIC;
    v_sale RECORD;
    v_to_pay NUMERIC;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_group_id := OLD.sale_group_id;
    ELSE
        v_group_id := NEW.sale_group_id;
    END IF;

    IF v_group_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            SELECT sale_group_id INTO v_group_id FROM public.sales WHERE id = OLD.sale_id;
        ELSE
            SELECT sale_group_id INTO v_group_id FROM public.sales WHERE id = NEW.sale_id;
        END IF;
    END IF;

    IF v_group_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(SUM(amount_usd), 0) INTO v_total_paid
    FROM public.sale_payments
    WHERE (sale_group_id = v_group_id OR sale_id IN (SELECT id FROM public.sales WHERE sale_group_id = v_group_id))
      AND status = 'valid';

    v_remaining := v_total_paid;

    -- FIFO: analytical attribution only — sale_payments records are NEVER modified
    FOR v_sale IN
        SELECT id, total_usd
        FROM public.sales
        WHERE sale_group_id = v_group_id
        ORDER BY created_at ASC
        FOR UPDATE
    LOOP
        IF v_remaining >= v_sale.total_usd THEN
            v_to_pay := v_sale.total_usd;
        ELSIF v_remaining > 0 THEN
            v_to_pay := v_remaining;
        ELSE
            v_to_pay := 0;
        END IF;

        v_remaining := v_remaining - v_to_pay;

        UPDATE public.sales
        SET
            amount_paid = v_to_pay,
            payment_status = CASE
                WHEN v_to_pay >= total_usd THEN 'paid'
                WHEN v_to_pay > 0 THEN 'partial'
                ELSE 'pending'
            END
        WHERE id = v_sale.id;
    END LOOP;

    RETURN NULL;
END;
$$;

-- Register in migration history
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
    '20260911190000',
    'fix_2_7c3_security_and_dummy_update',
    ARRAY['FASE 2.7C-3 corrections applied via MCP execute_sql']
)
ON CONFLICT (version) DO NOTHING;
