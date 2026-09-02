CREATE TABLE IF NOT EXISTS public.sale_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    amount_usd NUMERIC NOT NULL,
    amount_bs NUMERIC,
    exchange_rate NUMERIC,
    usdt_rate NUMERIC,
    usdt_bought NUMERIC,
    payment_method TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated users on sale_payments" ON public.sale_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users on sale_payments" ON public.sale_payments FOR INSERT TO authenticated WITH CHECK (true);

-- RPC for processing POS sale payments
CREATE OR REPLACE FUNCTION process_pos_abono(
    p_sale_id UUID,
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
    v_sale_record RECORD;
    v_new_amount_paid NUMERIC;
    v_new_status TEXT;
    v_abono_id UUID;
    v_ledger_id UUID;
BEGIN
    -- 1. Validate sale
    SELECT * INTO v_sale_record FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta presencial no encontrada';
    END IF;

    -- 2. Insert payment record
    INSERT INTO public.sale_payments (
        sale_id, amount_usd, amount_bs, exchange_rate, usdt_rate, usdt_bought, payment_method, notes
    ) VALUES (
        p_sale_id, p_amount_usd, p_amount_bs, p_exchange_rate, p_usdt_rate, p_usdt_bought, p_payment_method, p_notes
    ) RETURNING id INTO v_abono_id;

    -- 3. Update sale amounts
    v_new_amount_paid := COALESCE(v_sale_record.amount_paid, 0) + p_amount_usd;
    IF v_new_amount_paid >= v_sale_record.total_usd THEN
        v_new_status := 'paid';
        v_new_amount_paid := v_sale_record.total_usd; -- cap it
    ELSE
        v_new_status := 'partial';
    END IF;

    UPDATE public.sales
    SET 
        amount_paid = v_new_amount_paid,
        payment_status = v_new_status
    WHERE id = p_sale_id;

    -- 4. Insert into ledger (similar to process_checkout and register_credit_payment)
    INSERT INTO public.ledger (
        type, category, amount, description, payment_method, reference_id, user_id
    ) VALUES (
        'ingreso', 
        'ventas', 
        p_amount_usd, 
        'Abono a cuenta por cobrar (Fiado) - ' || COALESCE(v_sale_record.client_name, 'Cliente'), 
        p_payment_method, 
        p_sale_id::text, 
        auth.uid()
    ) RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object(
        'success', true,
        'abono_id', v_abono_id,
        'ledger_id', v_ledger_id,
        'new_status', v_new_status,
        'new_amount_paid', v_new_amount_paid
    );
END;
$$;
