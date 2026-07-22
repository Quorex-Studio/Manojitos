-- Migration: Handle overpayments (vueltos) and detailed history logs for Cuentas por Cobrar
-- Modifies: rpc_register_abono

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
  v_surplus NUMERIC;
  v_amount_to_apply NUMERIC;
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

  -- Calcular el excedente si el pago es mayor a la deuda
  v_surplus := GREATEST(0, p_amount - COALESCE(v_debt.amount_usd, 0));
  v_amount_to_apply := LEAST(p_amount, COALESCE(v_debt.amount_usd, 0));

  v_new_usd := v_debt.amount_usd - v_amount_to_apply;
  v_new_bs := v_debt.amount_bs;

  -- Construir el log del abono con el monto recibido (incluyendo el excedente si lo hay)
  -- Formato esperado: [Abono: $8.00 - Bs. 360,00 - Tasa: Bs. 45,00 - Sin referencia - 22/07/2026 14:30]
  IF p_rate IS NOT NULL THEN
    -- Actualizar bs restante de la deuda (restando el abono aplicado en bs)
    IF v_debt.amount_bs IS NOT NULL THEN
      v_new_bs := GREATEST(0, v_debt.amount_bs - (v_amount_to_apply * p_rate));
    ELSE
      v_new_bs := v_new_usd * p_rate;
    END IF;

    -- Usamos TO_CHAR con 'FM999999990.00' para que no deje espacios vacios en los números
    v_abono_log := CHR(10) || '[Abono: $' || TO_CHAR(p_amount, 'FM999999990.00') || ' - Bs. ' || TO_CHAR((p_amount * p_rate), 'FM999999990.00') || ' - Tasa: Bs. ' || TO_CHAR(p_rate, 'FM999999990.00') || ' - ' || COALESCE(p_notes, 'Sin referencia') || ' - ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI') || ']';
  ELSE
    v_abono_log := CHR(10) || '[Abono: $' || TO_CHAR(p_amount, 'FM999999990.00') || ' - ' || COALESCE(p_notes, 'Sin referencia') || ' - ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI') || ']';
  END IF;
  
  IF v_debt.notes IS NOT NULL AND v_debt.notes != '' THEN
    v_new_notes := v_debt.notes || v_abono_log;
  ELSE
    v_new_notes := LTRIM(v_abono_log, CHR(10));
  END IF;

  IF v_new_usd <= 0.01 THEN -- Tolerancia para decimales
    v_status := 'paid';
    v_paid_at := NOW();
    v_new_usd := 0;
    v_new_bs := 0;
  ELSE
    v_status := 'pending';
    v_paid_at := NULL;
  END IF;

  UPDATE debts
  SET 
    amount_usd = v_new_usd,
    amount_bs = v_new_bs,
    notes = v_new_notes,
    status = v_status,
    paid_at = v_paid_at,
    updated_at = NOW()
  WHERE id = p_debt_id;

  RETURN jsonb_build_object(
    'success', true, 
    'status', v_status,
    'surplus', v_surplus
  );
END;
$function$;
