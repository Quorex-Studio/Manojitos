-- FASE 1 — Infraestructura de devoluciones / anulación de ventas
-- ================================================================
-- Backend seguro para revertir ventas SIN borrarlas. NO conecta a Ángela,
-- NO toca ai-assistant/Gemini, NO introduce moneda de compromiso.
--
-- Principios:
--   * Nunca DELETE de sales. La venta se conserva; se registra la devolución
--     en tablas dedicadas (historial inmutable) y se ajusta el total vigente.
--   * USD sigue siendo la unidad de cuenta. total_bs se reduce en la MISMA
--     proporción, preservando la tasa original de la línea (no se recalcula a
--     tasa actual, no se toca dinero histórico).
--   * Los pagos (sale_payments) NUNCA se borran ni se falsifican. Si los pagos
--     válidos exceden la obligación que queda tras la devolución, el excedente
--     se registra como `refund_due_usd` (deuda de reembolso hacia el cliente):
--     el sistema NO ejecuta reembolsos monetarios (no existe ese concepto), solo
--     lo deja registrado y auditado. LIMITACIÓN documentada.
--   * Reutiliza el trigger FIFO existente vía recalculate_sale_group. No crea
--     una segunda lógica de CxC.
--   * Idempotente (idempotency_key único) y resistente a concurrencia (FOR UPDATE).

-- ----------------------------------------------------------------
-- 1. Columnas de seguimiento en sales (no destructivas)
-- ----------------------------------------------------------------
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS returned_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS returned_at timestamptz;

DO $c$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_sales_returned_quantity_valid'
          AND conrelid = 'public.sales'::regclass
    ) THEN
        ALTER TABLE public.sales
            ADD CONSTRAINT chk_sales_returned_quantity_valid
            CHECK (returned_quantity >= 0 AND returned_quantity <= quantity);
    END IF;
END
$c$;

-- ----------------------------------------------------------------
-- 2. Tablas de devoluciones (historial inmutable)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_returns (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_group_id   uuid NOT NULL,
    return_type     text NOT NULL CHECK (return_type IN ('anulacion','devolucion_total','devolucion_parcial')),
    reason          text,
    created_by      uuid NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    status          text NOT NULL DEFAULT 'processed',
    total_usd       numeric NOT NULL DEFAULT 0 CHECK (total_usd >= 0),
    refund_due_usd  numeric NOT NULL DEFAULT 0 CHECK (refund_due_usd >= 0),
    idempotency_key text UNIQUE
);

CREATE TABLE IF NOT EXISTS public.sale_return_items (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id   uuid NOT NULL REFERENCES public.sale_returns(id) ON DELETE CASCADE,
    sale_id     uuid NOT NULL REFERENCES public.sales(id),
    product_id  uuid,
    quantity    integer NOT NULL CHECK (quantity > 0),
    amount_usd  numeric NOT NULL CHECK (amount_usd >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_returns_group ON public.sale_returns(sale_group_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON public.sale_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_sale ON public.sale_return_items(sale_id);

-- RLS: sólo admin puede leer; ninguna escritura directa (sólo vía la RPC
-- SECURITY DEFINER, que corre como owner y no está sujeta a RLS).
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_return_items ENABLE ROW LEVEL SECURITY;

DO $p$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sale_returns' AND policyname='Admins can view sale returns') THEN
        CREATE POLICY "Admins can view sale returns" ON public.sale_returns FOR SELECT USING (public.is_admin());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sale_return_items' AND policyname='Admins can view sale return items') THEN
        CREATE POLICY "Admins can view sale return items" ON public.sale_return_items FOR SELECT USING (public.is_admin());
    END IF;
END
$p$;

GRANT SELECT ON public.sale_returns TO authenticated;
GRANT SELECT ON public.sale_return_items TO authenticated;

-- ----------------------------------------------------------------
-- 3. RPC transaccional única: process_sale_return
--    p_items: jsonb array de { "sale_id": uuid, "quantity": int } a devolver.
--    Para 'anulacion'/'devolucion_total' el llamador debe incluir todas las
--    unidades vigentes del grupo (la RPC valida cantidad contra la BD).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_sale_return(
    p_sale_group_id   uuid,
    p_items           jsonb,
    p_return_type     text,
    p_reason          text DEFAULT NULL,
    p_idempotency_key text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id        uuid;
    v_return_id      uuid;
    v_existing       public.sale_returns%ROWTYPE;
    v_item           jsonb;
    v_sale_id        uuid;
    v_qty            integer;
    v_sale           public.sales%ROWTYPE;
    v_returnable     integer;
    v_amount         numeric;
    v_frac           numeric;
    v_new_total_usd  numeric;
    v_new_total_bs   numeric;
    v_total_returned numeric := 0;
    v_valid_payments numeric;
    v_group_total    numeric;
    v_refund_due     numeric;
BEGIN
    -- Autorización server-side (nunca confía en cliente/Gemini)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
    END IF;

    IF p_return_type NOT IN ('anulacion','devolucion_total','devolucion_parcial') THEN
        RAISE EXCEPTION 'Tipo de devolución inválido: %', p_return_type;
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Debe indicar al menos un ítem a devolver';
    END IF;

    -- Idempotencia: si ya se procesó esta clave, devolver el resultado previo
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.sale_returns WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'return_id', v_existing.id,
                'total_usd', v_existing.total_usd,
                'refund_due_usd', v_existing.refund_due_usd
            );
        END IF;
    END IF;

    -- Bloquear las líneas del grupo (serializa devoluciones concurrentes)
    PERFORM 1 FROM public.sales WHERE sale_group_id = p_sale_group_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontraron ventas para el grupo %', p_sale_group_id;
    END IF;

    -- Cabecera de la devolución. El UNIQUE(idempotency_key) es la barrera real
    -- contra doble ejecución concurrente.
    INSERT INTO public.sale_returns (sale_group_id, return_type, reason, created_by, idempotency_key)
    VALUES (p_sale_group_id, p_return_type, p_reason, v_user_id, p_idempotency_key)
    RETURNING id INTO v_return_id;

    -- Procesar cada ítem
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_sale_id := (v_item->>'sale_id')::uuid;
        v_qty     := (v_item->>'quantity')::integer;

        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'Cantidad inválida en ítem (%): debe ser > 0', v_item;
        END IF;

        -- La línea debe pertenecer al grupo (ya bloqueada arriba)
        SELECT * INTO v_sale
        FROM public.sales
        WHERE id = v_sale_id AND sale_group_id = p_sale_group_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La línea % no pertenece al grupo %', v_sale_id, p_sale_group_id;
        END IF;

        v_returnable := v_sale.quantity - v_sale.returned_quantity;
        IF v_qty > v_returnable THEN
            RAISE EXCEPTION 'No se pueden devolver % unidades de la línea %: sólo quedan % devolvibles',
                v_qty, v_sale_id, v_returnable;
        END IF;

        -- Monto proporcional al total VIGENTE de la línea sobre las unidades
        -- todavía devolvibles (respeta descuentos y devoluciones parciales previas)
        v_frac          := v_qty::numeric / v_returnable::numeric;
        v_amount        := round(v_sale.total_usd * v_frac, 2);
        v_new_total_usd := v_sale.total_usd - v_amount;
        v_new_total_bs  := round(COALESCE(v_sale.total_bs, 0) * (1 - v_frac), 2);

        UPDATE public.sales
        SET total_usd         = v_new_total_usd,
            total_bs          = v_new_total_bs,
            returned_quantity = v_sale.returned_quantity + v_qty,
            returned_at       = CASE WHEN (v_sale.returned_quantity + v_qty) >= v_sale.quantity
                                     THEN now() ELSE returned_at END
        WHERE id = v_sale_id;

        -- Reponer inventario exactamente una vez (fila bloqueada). Sólo si hay
        -- producto asociado; el UNIQUE de la cabecera impide doble ejecución.
        IF v_sale.product_id IS NOT NULL THEN
            PERFORM 1 FROM public.products WHERE id = v_sale.product_id FOR UPDATE;
            UPDATE public.products
            SET stock      = stock + v_qty,
                sold_count = GREATEST(0, COALESCE(sold_count, 0) - v_qty),
                updated_at = now()
            WHERE id = v_sale.product_id;
        END IF;

        INSERT INTO public.sale_return_items (return_id, sale_id, product_id, quantity, amount_usd)
        VALUES (v_return_id, v_sale_id, v_sale.product_id, v_qty, v_amount);

        v_total_returned := v_total_returned + v_amount;
    END LOOP;

    -- Reutilizar el FIFO existente para recomputar amount_paid/payment_status
    -- sobre los nuevos totales vigentes. NO se tocan los pagos.
    PERFORM public.recalculate_sale_group(p_sale_group_id);

    -- Excedente de pagos sobre la obligación restante = reembolso pendiente.
    SELECT COALESCE(SUM(amount_usd), 0) INTO v_valid_payments
    FROM public.sale_payments
    WHERE (sale_group_id = p_sale_group_id
           OR sale_id IN (SELECT id FROM public.sales WHERE sale_group_id = p_sale_group_id))
      AND status = 'valid';

    SELECT COALESCE(SUM(total_usd), 0) INTO v_group_total
    FROM public.sales WHERE sale_group_id = p_sale_group_id;

    v_refund_due := GREATEST(0, round(v_valid_payments - v_group_total, 2));

    UPDATE public.sale_returns
    SET total_usd = v_total_returned, refund_due_usd = v_refund_due
    WHERE id = v_return_id;

    -- Auditoría dentro de la misma transacción
    PERFORM public.log_audit_event(
        v_user_id,
        'SALE_RETURN',
        'sale_group',
        p_sale_group_id,
        jsonb_build_object(
            'return_id', v_return_id,
            'return_type', p_return_type,
            'reason', p_reason,
            'total_returned_usd', v_total_returned,
            'refund_due_usd', v_refund_due,
            'items', p_items
        ),
        NULL, NULL
    );

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'return_id', v_return_id,
        'total_usd', v_total_returned,
        'refund_due_usd', v_refund_due,
        'refund_supported', false
    );
END;
$function$;

-- EXECUTE: sólo usuarios autenticados (la RPC valida is_admin internamente).
REVOKE ALL ON FUNCTION public.process_sale_return(uuid, jsonb, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_sale_return(uuid, jsonb, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_sale_return(uuid, jsonb, text, text, text) TO authenticated;
