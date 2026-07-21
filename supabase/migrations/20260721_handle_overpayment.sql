-- Migration to update rpc_register_credit_payment to handle overpayments (vueltos/saldo a favor)
-- Elimina el límite de GREATEST(0) para permitir saldos negativos (a favor del cliente).

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
  v_surplus NUMERIC;
  v_response_msg TEXT;
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

  -- Calculamos el nuevo balance permitiendo negativos (saldo a favor)
  v_new_balance := COALESCE(v_credit.current_balance, 0) - p_amount;
  v_surplus := GREATEST(0, p_amount - COALESCE(v_credit.current_balance, 0));

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
    last_payment_date = now(),
    total_paid_on_time = v_new_total_paid_on_time,
    total_paid_late = v_new_total_paid_late,
    consecutive_late_payments = v_new_consecutive_late,
    trust_score = v_new_score,
    status = CASE 
               WHEN v_new_balance <= 0 THEN 'ACTIVO'
               ELSE status
             END,
    is_blocked = CASE
                   WHEN v_new_balance <= 0 THEN false
                   ELSE is_blocked
                 END
  WHERE id = p_credit_id;

  IF v_surplus > 0 THEN
    v_response_msg := 'Pago procesado exitosamente. Se ha registrado un saldo a favor de $' || ROUND(v_surplus, 2)::text || '.';
  ELSE
    v_response_msg := 'Pago procesado exitosamente.';
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'transaction_id', v_transaction_id, 
    'new_balance', v_new_balance,
    'surplus', v_surplus,
    'message', v_response_msg
  );
END;
$function$;
