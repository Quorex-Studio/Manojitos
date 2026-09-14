-- FASE 0 — Integridad financiera existente
-- =========================================
-- Reparaciones quirúrgicas sobre la infraestructura financiera ya existente.
-- NO cambia el modelo monetario (USD sigue siendo la unidad de cuenta), NO
-- introduce moneda de compromiso, NO recalcula datos históricos de dinero.
--
-- Contenido:
--   1. process_group_abono  -> usar create_ledger_entry (public.ledger no existe)
--                              + validar monto > 0 + bloqueo + anti-sobrepago.
--   2. edit_group_abono     -> quitar el UPDATE a public.ledger (inexistente)
--                              + validar monto > 0 + guardia anti-sobrepago.
--   3. Selección de tasa    -> filtrar currency = 'USD' en las funciones que
--                              leen exchange_rates sin filtrar moneda
--                              (angela_register_sale y las 4 sobrecargas de
--                              process_checkout).
--   4. sale_group_id        -> DEFAULT gen_random_uuid() + backfill de las
--                              ventas huérfanas (sale_group_id IS NULL) para que
--                              puedan recibir abonos por la ruta de grupo.
--   5. CHECK constraints    -> invariantes numéricos ya vigentes en el código.
--   6. payment_methods      -> alta (deshabilitada) del método histórico
--                              'credito' para coherencia de catálogo.
--
-- NOTA (GAP DE REGLA FINANCIERA, NO RESUELTO AQUÍ): edit_sale_total deja
-- total_bs sin recalcular al cambiar total_usd. La regla correcta (congelar el
-- valor histórico vs. reescalar a la tasa original) requiere decisión del dueño
-- del negocio y queda fuera de FASE 0.


-- =====================================================================
-- 1. process_group_abono: ruta oficial de abono a cuenta (grupo)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.process_group_abono(
    p_sale_group_id uuid,
    p_amount_usd    numeric,
    p_amount_bs     numeric,
    p_exchange_rate numeric,
    p_usdt_rate     numeric,
    p_usdt_bought   numeric,
    p_payment_method text,
    p_notes         text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id     UUID;
    v_client_name TEXT;
    v_total       NUMERIC;
    v_paid        NUMERIC;
    v_remaining   NUMERIC;
    v_abono_id    UUID;
    v_ledger_id   UUID;
BEGIN
    -- Autorización (nunca confiar en identidad/rol provistos por el cliente)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
    END IF;

    -- Monto válido
    IF p_amount_usd IS NULL OR p_amount_usd <= 0 THEN
        RAISE EXCEPTION 'El monto del abono debe ser mayor a cero.';
    END IF;

    -- Bloquear las líneas del grupo para serializar abonos concurrentes.
    -- (FOR UPDATE no puede combinarse con agregados, por eso se bloquea aparte.)
    PERFORM 1 FROM public.sales WHERE sale_group_id = p_sale_group_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontraron ventas para este grupo';
    END IF;

    -- Total acordado y abonado actual del grupo (filas ya bloqueadas)
    SELECT COALESCE(SUM(total_usd), 0),
           COALESCE(SUM(COALESCE(amount_paid, 0)), 0),
           MIN(client_name)
      INTO v_total, v_paid, v_client_name
    FROM public.sales
    WHERE sale_group_id = p_sale_group_id;

    -- Anti-sobrepago: el abono no puede exceder el saldo pendiente del grupo.
    v_remaining := v_total - v_paid;
    IF p_amount_usd > v_remaining + 0.01 THEN
        RAISE EXCEPTION 'El abono ($%) excede el saldo pendiente del grupo ($%).',
            to_char(p_amount_usd, 'FM999999990.00'),
            to_char(v_remaining, 'FM999999990.00');
    END IF;

    -- Un único registro de pago sobre el grupo. El trigger AFTER distribuye FIFO
    -- y recalcula sales.amount_paid / payment_status: nunca se reparte a mano.
    INSERT INTO public.sale_payments (
        sale_group_id, amount_usd, amount_bs, exchange_rate,
        usdt_rate, usdt_bought, payment_method, notes, status
    ) VALUES (
        p_sale_group_id, p_amount_usd, p_amount_bs, p_exchange_rate,
        p_usdt_rate, p_usdt_bought, p_payment_method, p_notes, 'valid'
    ) RETURNING id INTO v_abono_id;

    -- Asiento contable usando el helper canónico (mismo patrón que process_pos_abono).
    v_ledger_id := public.create_ledger_entry(
        v_user_id,
        'credit',
        p_amount_usd,
        COALESCE(p_amount_bs, 0),
        'sale_payment',
        p_sale_group_id,
        'Abono a cuenta por cobrar (Fiado) - ' || COALESCE(v_client_name, 'Cliente'),
        jsonb_build_object('payment_method', p_payment_method)
    );

    RETURN jsonb_build_object(
        'success',   true,
        'abono_id',  v_abono_id,
        'ledger_id', v_ledger_id
    );
END;
$function$;

-- =====================================================================
-- 2. edit_group_abono: corregir un abono existente (sin public.ledger)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.edit_group_abono(
    p_abono_id      uuid,
    p_amount_usd    numeric,
    p_amount_bs     numeric,
    p_exchange_rate numeric,
    p_payment_method text,
    p_notes         text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id  UUID;
    v_group_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
    END IF;
    IF p_amount_usd IS NULL OR p_amount_usd <= 0 THEN
        RAISE EXCEPTION 'El monto del abono debe ser mayor a cero.';
    END IF;

    -- Bloquear el pago y obtener su grupo
    SELECT sp.sale_group_id INTO v_group_id
    FROM public.sale_payments sp
    WHERE sp.id = p_abono_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Abono no encontrado';
    END IF;

    -- Actualizar el pago (el historial se preserva; sólo cambian estos campos).
    -- NOTA: no se escribe en el libro contable; el ajuste de ledger por edición
    -- de abonos queda como gap documentado de FASE 0 (no había ledger funcional).
    UPDATE public.sale_payments
    SET amount_usd     = p_amount_usd,
        amount_bs      = p_amount_bs,
        exchange_rate  = p_exchange_rate,
        payment_method = p_payment_method,
        notes          = p_notes
    WHERE id = p_abono_id;

    -- Recalcular derivados (el trigger AFTER también lo hace; se deja explícito).
    PERFORM public.recalculate_sale_group(v_group_id);

    -- Guardia de integridad: los pagos válidos no pueden exceder el total del grupo.
    IF v_group_id IS NOT NULL THEN
        IF (SELECT COALESCE(SUM(amount_usd), 0)
              FROM public.sale_payments
             WHERE (sale_group_id = v_group_id
                    OR sale_id IN (SELECT id FROM public.sales WHERE sale_group_id = v_group_id))
               AND status = 'valid')
           > (SELECT COALESCE(SUM(total_usd), 0)
                FROM public.sales WHERE sale_group_id = v_group_id) + 0.01
        THEN
            RAISE EXCEPTION 'La edición haría que los pagos excedan el total de la cuenta.';
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$function$;

-- =====================================================================
-- 3. Selección de tasa: filtrar currency = 'USD'
--    Regenera cada función afectada desde su propia definición, sustituyendo
--    de forma única el ORDER BY del lookup de exchange_rates. Es idempotente
--    (si ya está filtrado, se omite) y aborta si la suposición de unicidad falla.
-- =====================================================================
DO $rate_fix$
DECLARE
    r      RECORD;
    v_def  TEXT;
    v_needle CONSTANT TEXT := 'ORDER BY created_at DESC';
    v_repl   CONSTANT TEXT := 'WHERE currency = ''USD'' ORDER BY created_at DESC';
BEGIN
    FOR r IN
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND (p.proname = 'process_checkout'
               OR (p.proname = 'angela_register_sale' AND p.pronargs = 6))
    LOOP
        v_def := pg_get_functiondef(r.oid);

        -- Ya filtrado: idempotente
        IF position('WHERE currency = ''USD''' IN v_def) > 0 THEN
            CONTINUE;
        END IF;

        -- Debe existir exactamente un lookup a exchange_rates ordenado por fecha
        IF (length(v_def) - length(replace(v_def, v_needle, ''))) / length(v_needle) <> 1 THEN
            RAISE EXCEPTION 'FASE0 rate fix abortado: se esperaba exactamente un "%" en %',
                v_needle, r.oid::regprocedure;
        END IF;
        IF position('public.exchange_rates' IN v_def) = 0 THEN
            RAISE EXCEPTION 'FASE0 rate fix abortado: sin referencia a exchange_rates en %',
                r.oid::regprocedure;
        END IF;

        EXECUTE replace(v_def, v_needle, v_repl);
    END LOOP;
END
$rate_fix$;

-- =====================================================================
-- 4. sale_group_id: garantizar grupo y sanear huérfanas
--    - DEFAULT para que ninguna venta nueva quede sin grupo.
--    - Backfill: a cada venta sin grupo se le asigna su propio id como grupo
--      singleton (convención coalesce(sale_group_id, id)); no toca dinero.
-- =====================================================================
ALTER TABLE public.sales ALTER COLUMN sale_group_id SET DEFAULT gen_random_uuid();

UPDATE public.sales
SET sale_group_id = id
WHERE sale_group_id IS NULL;

-- =====================================================================
-- 5. CHECK constraints (invariantes numéricos ya vigentes en el código)
--    Datos actuales verificados sin violaciones antes de crearlos.
-- =====================================================================
ALTER TABLE public.sale_payments
    ADD CONSTRAINT chk_sale_payments_amount_usd_positive CHECK (amount_usd > 0);
ALTER TABLE public.sale_payments
    ADD CONSTRAINT chk_sale_payments_amount_bs_nonneg CHECK (amount_bs IS NULL OR amount_bs >= 0);

ALTER TABLE public.sales
    ADD CONSTRAINT chk_sales_quantity_positive CHECK (quantity > 0);
ALTER TABLE public.sales
    ADD CONSTRAINT chk_sales_total_usd_nonneg CHECK (total_usd >= 0);
ALTER TABLE public.sales
    ADD CONSTRAINT chk_sales_unit_price_nonneg CHECK (unit_price_usd >= 0);
ALTER TABLE public.sales
    ADD CONSTRAINT chk_sales_amount_paid_nonneg CHECK (amount_paid IS NULL OR amount_paid >= 0);

-- =====================================================================
-- 6. Catálogo: alta (deshabilitada) del método histórico 'credito'
--    Usado en ventas/pagos históricos pero ausente del catálogo. No es opción
--    de pago para clientes (enabled = false). No modifica ninguna venta.
--    La tabla public.payment_methods existe en producción pero no se crea en
--    ninguna migración del repositorio; por eso el seed se protege y es no-op
--    si la tabla aún no existe (p. ej. una BD construida sólo desde migraciones).
-- =====================================================================
DO $seed_credito$
BEGIN
    IF to_regclass('public.payment_methods') IS NOT NULL THEN
        INSERT INTO public.payment_methods (method_key, label, description, enabled, display_order, config)
        SELECT 'credito',
               'Crédito / Fiado',
               'Método histórico/interno para ventas a crédito y fiadas. No es una opción de pago para clientes.',
               false, 99, '{}'::jsonb
        WHERE NOT EXISTS (
            SELECT 1 FROM public.payment_methods WHERE method_key = 'credito'
        );
    END IF;
END
$seed_credito$;

