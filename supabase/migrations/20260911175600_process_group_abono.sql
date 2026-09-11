-- Nueva RPC para registrar abonos sobre un Sale Group (Cuenta Multiproducto)
CREATE OR REPLACE FUNCTION process_group_abono(
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
AS $$
DECLARE
    v_sale RECORD;
    v_remaining_payment NUMERIC := p_amount_usd;
    v_to_pay NUMERIC;
    v_new_amount_paid NUMERIC;
    v_sale_pending NUMERIC;
    v_first_sale_id UUID;
BEGIN
    -- 1. Validar que exista al menos una venta para este grupo
    SELECT id INTO v_first_sale_id 
    FROM public.sales 
    WHERE sale_group_id = p_sale_group_id 
    ORDER BY created_at ASC 
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontraron ventas para este grupo';
    END IF;

    -- 2. Insertar UN SOLO registro de pago asociado al grupo
    INSERT INTO public.sale_payments (
        sale_id, -- Mantenemos sale_id por compatibilidad con esquema previo, apuntando a la primera venta
        sale_group_id,
        amount_usd, 
        amount_bs, 
        exchange_rate, 
        usdt_rate, 
        usdt_bought, 
        payment_method, 
        notes
    ) VALUES (
        v_first_sale_id,
        p_sale_group_id,
        p_amount_usd, 
        p_amount_bs, 
        p_exchange_rate, 
        p_usdt_rate, 
        p_usdt_bought, 
        p_payment_method, 
        p_notes
    );

    -- 3. Distribuir el pago entre las ventas individuales del grupo (FIFO) para mantener compatibilidad
    -- Bloquear las filas para evitar race conditions
    FOR v_sale IN 
        SELECT id, total_usd, amount_paid 
        FROM public.sales 
        WHERE sale_group_id = p_sale_group_id 
        ORDER BY created_at ASC 
        FOR UPDATE
    LOOP
        IF v_remaining_payment <= 0 THEN
            EXIT;
        END IF;

        v_sale_pending := v_sale.total_usd - v_sale.amount_paid;
        
        IF v_sale_pending > 0 THEN
            -- ¿Cuánto pagaremos a esta línea?
            IF v_remaining_payment >= v_sale_pending THEN
                v_to_pay := v_sale_pending;
            ELSE
                v_to_pay := v_remaining_payment;
            END IF;

            v_new_amount_paid := v_sale.amount_paid + v_to_pay;
            v_remaining_payment := v_remaining_payment - v_to_pay;

            -- Actualizar la venta individual
            UPDATE public.sales
            SET 
                amount_paid = v_new_amount_paid,
                payment_status = CASE 
                    WHEN v_new_amount_paid >= total_usd THEN 'paid'
                    WHEN v_new_amount_paid > 0 THEN 'partial'
                    ELSE 'pending'
                END
            WHERE id = v_sale.id;
        END IF;
    END LOOP;

    -- Nota: Si v_remaining_payment > 0, es un pago en exceso (overpayment) 
    -- que quedará registrado en sale_payments, pero no asignado a una línea de venta.
    -- El total de la cuenta en el frontend reflejará el sobrepago correctamente leyendo de sale_payments.

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Abono grupal procesado correctamente',
        'sale_group_id', p_sale_group_id,
        'amount_applied', p_amount_usd - v_remaining_payment,
        'overpayment', v_remaining_payment
    );
END;
$$;
