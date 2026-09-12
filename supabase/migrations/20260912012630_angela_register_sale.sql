-- FASE 3.4 (A-05): Atomic, admin-only, stock-safe sale registration for Angela.
-- Replaces the ai-assistant Edge Function's direct multi-write REGISTER_SALE
-- logic with a single transactional RPC aligned with the 2.7C sales model
-- (sale_group_id + sale_payments history + derived amount_paid via trigger).

CREATE OR REPLACE FUNCTION public.angela_register_sale(
    p_product_name   TEXT,
    p_quantity       INTEGER,
    p_unit_price_usd NUMERIC DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'efectivo_usd',
    p_client_name    TEXT DEFAULT NULL,
    p_total_usd      NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id       UUID;
    v_product       RECORD;
    v_unit_price    NUMERIC;
    v_total_usd     NUMERIC;
    v_rate          NUMERIC;
    v_total_bs      NUMERIC;
    v_sale_group_id UUID;
    v_sale_id       UUID;
BEGIN
    -- 1. Authorization (server-side only; never trust caller-provided identity/role)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
    END IF;

    -- 2. Validate quantity
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Cantidad inválida: debe ser mayor que 0';
    END IF;

    -- 3. Lock the product row: serializes concurrent sales of the same product
    --    so stock cannot be oversold or driven negative by a race.
    SELECT * INTO v_product
    FROM public.products
    WHERE name ILIKE '%' || p_product_name || '%'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado: %', p_product_name;
    END IF;

    -- 4. Financial values. total_usd is the final agreed amount: honor an
    --    explicit total (discount / negotiated price) and never overwrite it;
    --    only derive it from quantity x unit price when none was provided.
    v_unit_price := COALESCE(p_unit_price_usd, v_product.price_usd);
    v_total_usd  := COALESCE(p_total_usd, p_quantity * v_unit_price);

    IF v_unit_price IS NULL OR v_unit_price < 0 THEN
        RAISE EXCEPTION 'Precio unitario inválido';
    END IF;
    IF v_total_usd IS NULL OR v_total_usd < 0 THEN
        RAISE EXCEPTION 'Total inválido';
    END IF;

    -- 5. Stock check against the locked row
    IF v_product.stock < p_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para % (disponible: %, requerido: %)',
            v_product.name, v_product.stock, p_quantity;
    END IF;

    -- 6. Bs snapshot from the latest exchange rate
    SELECT rate INTO v_rate
    FROM public.exchange_rates
    ORDER BY created_at DESC
    LIMIT 1;
    v_rate := COALESCE(v_rate, 0);
    v_total_bs := v_total_usd * v_rate;

    -- 7. Single sale group for this operation
    v_sale_group_id := gen_random_uuid();

    -- 8. Create the sale (contado, paid in full)
    INSERT INTO public.sales (
        user_id, product_id, product_name, quantity, unit_price_usd,
        total_usd, total_bs, payment_method, client_name, status,
        sale_modality, amount_paid, sale_group_id
    ) VALUES (
        v_user_id, v_product.id, v_product.name, p_quantity, v_unit_price,
        v_total_usd, v_total_bs, p_payment_method, p_client_name, 'confirmed',
        'contado', v_total_usd, v_sale_group_id
    ) RETURNING id INTO v_sale_id;

    -- 9. Payment history for the group. The AFTER trigger on sale_payments
    --    recomputes the derived sales.amount_paid / payment_status (FIFO);
    --    we never distribute payments manually across lines.
    INSERT INTO public.sale_payments (
        sale_id, sale_group_id, amount_usd, amount_bs, exchange_rate,
        payment_method, notes, status
    ) VALUES (
        v_sale_id, v_sale_group_id, v_total_usd, v_total_bs, v_rate,
        p_payment_method, 'Venta registrada por Ángela (POS)', 'valid'
    );

    -- 10. Decrement stock atomically (same transaction; row still locked)
    UPDATE public.products
    SET stock = stock - p_quantity,
        sold_count = COALESCE(sold_count, 0) + p_quantity,
        updated_at = now()
    WHERE id = v_product.id;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('✅ Venta registrada: %sx %s por $%s',
                          p_quantity, v_product.name, to_char(v_total_usd, 'FM999999990.00')),
        'sale_id', v_sale_id,
        'sale_group_id', v_sale_group_id,
        'total_usd', v_total_usd,
        'total_bs', v_total_bs
    );
END;
$$;

REVOKE ALL ON FUNCTION public.angela_register_sale(TEXT, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.angela_register_sale(TEXT, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.angela_register_sale(TEXT, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC) TO authenticated;
