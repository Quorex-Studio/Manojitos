-- Migration: Harden RPC security by adding authorization checks
-- Fixes IDOR vulnerabilities in SECURITY DEFINER functions

-- 1. rpc_register_abono
CREATE OR REPLACE FUNCTION public.rpc_register_abono(p_debt_id uuid, p_amount numeric, p_notes text, p_rate numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_debt RECORD;
  v_new_usd NUMERIC;
  v_new_bs NUMERIC;
  v_new_notes TEXT;
  v_abono_log TEXT;
  v_status TEXT;
  v_paid_at TIMESTAMP WITH TIME ZONE;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol de administrador.';
  END IF;

  SELECT * INTO v_debt 
  FROM debts 
  WHERE id = p_debt_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deuda no encontrada';
  END IF;

  IF p_amount > v_debt.amount_usd THEN
    RAISE EXCEPTION 'El monto del abono (%.2f) supera el saldo actual (%.2f)', p_amount, v_debt.amount_usd;
  END IF;

  v_new_usd := v_debt.amount_usd - p_amount;
  v_new_bs := v_debt.amount_bs;

  IF p_rate IS NOT NULL THEN
    IF v_debt.amount_bs IS NOT NULL THEN
      v_new_bs := GREATEST(0, v_debt.amount_bs - (p_amount * p_rate));
    ELSE
      v_new_bs := v_new_usd * p_rate;
    END IF;
  END IF;

  v_abono_log := CHR(10) || '[Abono: $' || ROUND(p_amount, 2)::text || ' - ' || COALESCE(p_notes, 'Sin referencia') || ' - ' || TO_CHAR(NOW(), 'DD/MM/YYYY') || ']';
  
  IF v_debt.notes IS NOT NULL THEN
    v_new_notes := v_debt.notes || v_abono_log;
  ELSE
    v_new_notes := TRIM(v_abono_log);
  END IF;

  IF v_new_usd <= 0 THEN
    v_status := 'paid';
    v_paid_at := NOW();
  ELSE
    v_status := v_debt.status;
    v_paid_at := v_debt.paid_at;
  END IF;

  UPDATE debts
  SET 
    amount_usd = v_new_usd,
    amount_bs = v_new_bs,
    notes = v_new_notes,
    status = v_status,
    paid_at = v_paid_at
  WHERE id = p_debt_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_amount_usd', v_new_usd,
    'status', v_status
  );
END;
$function$;

-- 2. rpc_register_credit_charge
CREATE OR REPLACE FUNCTION public.rpc_register_credit_charge(p_credit_id uuid, p_user_id uuid, p_amount numeric, p_description text, p_sale_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_credit RECORD;
  v_new_balance NUMERIC;
  v_new_purchases INTEGER;
  v_transaction_id UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol de administrador.';
  END IF;

  SELECT * INTO v_credit 
  FROM credits 
  WHERE id = p_credit_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crédito no encontrado';
  END IF;

  v_new_balance := COALESCE(v_credit.current_balance, 0) + p_amount;
  
  -- Verificar límite de crédito
  IF v_credit.credit_limit IS NOT NULL AND v_new_balance > v_credit.credit_limit THEN
    RAISE EXCEPTION 'El cargo supera el límite de crédito permitido (%.2f)', v_credit.credit_limit;
  END IF;

  v_new_purchases := COALESCE(v_credit.total_purchases, 0) + 1;

  INSERT INTO credit_transactions (credit_id, user_id, type, amount, previous_balance, new_balance, description, sale_id)
  VALUES (p_credit_id, p_user_id, 'CARGO', p_amount, COALESCE(v_credit.current_balance, 0), v_new_balance, COALESCE(p_description, 'Compra a crédito autorizada'), p_sale_id)
  RETURNING id INTO v_transaction_id;

  UPDATE credits
  SET 
    current_balance = v_new_balance,
    total_purchases = v_new_purchases,
    updated_at = NOW()
  WHERE id = p_credit_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
END;
$function$;

-- 3. rpc_register_credit_payment
CREATE OR REPLACE FUNCTION public.rpc_register_credit_payment(p_credit_id uuid, p_user_id uuid, p_amount numeric, p_description text, p_is_on_time boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_credit RECORD;
  v_new_balance NUMERIC;
  v_new_total_paid_on_time INTEGER;
  v_new_total_paid_late INTEGER;
  v_new_consecutive_late INTEGER;
  v_new_score INTEGER;
  v_transaction_id UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol de administrador.';
  END IF;

  SELECT * INTO v_credit 
  FROM credits 
  WHERE id = p_credit_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crédito no encontrado';
  END IF;

  v_new_balance := GREATEST(0, COALESCE(v_credit.current_balance, 0) - p_amount);

  IF p_is_on_time THEN
    v_new_total_paid_on_time := COALESCE(v_credit.total_paid_on_time, 0) + 1;
    v_new_total_paid_late := COALESCE(v_credit.total_paid_late, 0);
    v_new_consecutive_late := 0;
    v_new_score := LEAST(100, COALESCE(v_credit.trust_score, 100) + 5);
  ELSE
    v_new_total_paid_on_time := COALESCE(v_credit.total_paid_on_time, 0);
    v_new_total_paid_late := COALESCE(v_credit.total_paid_late, 0) + 1;
    v_new_consecutive_late := COALESCE(v_credit.consecutive_late_payments, 0) + 1;
    v_new_score := GREATEST(0, COALESCE(v_credit.trust_score, 100) - 10 - (v_new_consecutive_late * 5));
  END IF;

  INSERT INTO credit_transactions (credit_id, user_id, type, amount, previous_balance, new_balance, description)
  VALUES (p_credit_id, p_user_id, 'ABONO', p_amount, COALESCE(v_credit.current_balance, 0), v_new_balance, COALESCE(p_description, 'Pago registrado'))
  RETURNING id INTO v_transaction_id;

  UPDATE credits
  SET 
    current_balance = v_new_balance,
    last_payment_date = NOW(),
    is_blocked = CASE WHEN v_new_balance > 0 THEN COALESCE(v_credit.is_blocked, false) ELSE false END,
    trust_score = v_new_score,
    total_paid_on_time = v_new_total_paid_on_time,
    total_paid_late = v_new_total_paid_late,
    consecutive_late_payments = v_new_consecutive_late,
    last_late_date = CASE WHEN NOT p_is_on_time THEN NOW() ELSE v_credit.last_late_date END,
    updated_at = NOW()
  WHERE id = p_credit_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
END;
$function$;

-- 4. confirm_order
CREATE OR REPLACE FUNCTION public.confirm_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC;
  v_product_name TEXT;
  v_rate NUMERIC;
  v_sale_id UUID;
  v_product_stock INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol de administrador.';
  END IF;

  -- Lock the order row
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status != 'pending' THEN
    RAISE EXCEPTION 'Order is not in pending status (Current: %)', v_order.status;
  END IF;

  v_rate := COALESCE(v_order.total_bs / NULLIF(v_order.total_usd, 0), 1);

  -- Validate stock for all items
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_product_name := v_item->>'product_name';

    SELECT stock INTO v_product_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID % not found', v_product_id;
    END IF;

    IF v_product_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Requested: %, Available: %)', v_product_name, v_quantity, v_product_stock;
    END IF;
  END LOOP;

  -- Deduct stock and insert into sales
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_product_name := v_item->>'product_name';
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    -- Deduct stock
    UPDATE public.products
    SET 
      stock = stock - v_quantity,
      sold_count = sold_count + v_quantity,
      updated_at = now()
    WHERE id = v_product_id;

    -- Insert into sales
    INSERT INTO public.sales (
      user_id,
      product_id,
      product_name,
      quantity,
      unit_price_usd,
      total_usd,
      total_bs,
      payment_method,
      client_name,
      client_phone,
      is_credit,
      status,
      notes
    )
    VALUES (
      v_order.customer_user_id,
      v_product_id,
      v_product_name,
      v_quantity,
      v_unit_price,
      v_unit_price * v_quantity,
      v_unit_price * v_quantity * v_rate,
      v_order.payment_method,
      v_order.customer_name,
      v_order.customer_phone,
      FALSE,
      'confirmed',
      v_order.notes
    )
    RETURNING id INTO v_sale_id;

    -- Record in ledger
    PERFORM public.create_ledger_entry(
      v_order.user_id, -- admin user
      'credit',
      v_unit_price * v_quantity,
      v_unit_price * v_quantity * v_rate,
      'sale',
      v_sale_id,
      'Venta registrada (Pedido #' || substring(v_order.id::text from 1 for 8) || ')'
    );
  END LOOP;

  -- Update order status
  UPDATE public.orders
  SET 
    status = 'confirmed',
    payment_status = 'paid',
    updated_at = now()
  WHERE id = p_order_id;
END;
$function$;

-- 5. reject_order
CREATE OR REPLACE FUNCTION public.reject_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol de administrador.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status != 'pending' THEN
    RAISE EXCEPTION 'Only pending orders can be rejected';
  END IF;

  UPDATE public.orders
  SET 
    status = 'cancelled',
    payment_status = 'failed',
    updated_at = now()
  WHERE id = p_order_id;
END;
$function$;
