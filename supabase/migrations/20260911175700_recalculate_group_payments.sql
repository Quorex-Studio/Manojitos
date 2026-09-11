-- Trigger para recalcular amount_paid y payment_status en sales
-- basado en la suma de sale_payments para un sale_group_id dado.
-- Esto garantiza la Atomicidad y evita discrepancias.

CREATE OR REPLACE FUNCTION trg_recalculate_group_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
    v_total_paid NUMERIC;
    v_remaining NUMERIC;
    v_sale RECORD;
    v_to_pay NUMERIC;
    v_new_amount_paid NUMERIC;
BEGIN
    -- Determinar el group_id afectado
    IF TG_OP = 'DELETE' THEN
        v_group_id := OLD.sale_group_id;
    ELSE
        v_group_id := NEW.sale_group_id;
    END IF;

    -- Si el grupo es nulo, usamos el sale_id para ubicar el grupo (por si acaso hay data vieja)
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

    -- 1. Obtener la suma real total de los pagos asociados a este grupo
    SELECT COALESCE(SUM(amount_usd), 0) INTO v_total_paid 
    FROM public.sale_payments 
    WHERE sale_group_id = v_group_id OR sale_id IN (SELECT id FROM public.sales WHERE sale_group_id = v_group_id);

    v_remaining := v_total_paid;

    -- 2. Distribuir (FIFO) el total pagado entre todas las líneas de venta del grupo
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

        -- Actualizar la venta (directamente, sin desencadenar otros triggers infinitos si los hubiera, 
        -- aunque aquí actualizamos sales y el trigger es sobre sale_payments)
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

    RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_payments_recalc ON public.sale_payments;
CREATE TRIGGER trg_sale_payments_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.sale_payments
FOR EACH ROW
EXECUTE FUNCTION trg_recalculate_group_payments();
