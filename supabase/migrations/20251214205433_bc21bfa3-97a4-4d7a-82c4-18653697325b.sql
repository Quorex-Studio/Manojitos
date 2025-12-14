-- Corregir search_path en la función calculate_credit_status
CREATE OR REPLACE FUNCTION public.calculate_credit_status(
  p_next_due_date DATE,
  p_grace_days INTEGER,
  p_is_blocked BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_grace_end DATE;
BEGIN
  IF p_is_blocked THEN
    RETURN 'BLOQUEADO';
  END IF;
  
  IF p_next_due_date IS NULL THEN
    RETURN 'ACTIVO';
  END IF;
  
  v_grace_end := p_next_due_date + p_grace_days;
  
  -- 3 días antes del vencimiento
  IF v_today < p_next_due_date AND v_today >= (p_next_due_date - 3) THEN
    RETURN 'POR_VENCER';
  ELSIF v_today >= p_next_due_date AND v_today <= v_grace_end THEN
    RETURN 'EN_GRACIA';
  ELSIF v_today > v_grace_end THEN
    RETURN 'VENCIDO';
  ELSE
    RETURN 'ACTIVO';
  END IF;
END;
$$;