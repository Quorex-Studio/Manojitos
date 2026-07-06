-- 1. Create unique indexes for DNI and Phone (ignoring empty or null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_unique_dni 
ON public.customer_profiles (dni) 
WHERE dni IS NOT NULL AND dni != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_unique_phone 
ON public.customer_profiles (phone) 
WHERE phone IS NOT NULL AND phone != '';

-- 2. Create the RPC function to check availability
CREATE OR REPLACE FUNCTION public.check_unique_customer_data(
  p_phone text,
  p_dni text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_taken boolean := false;
  v_dni_taken boolean := false;
  v_email_taken boolean := false;
BEGIN
  -- Check phone
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.customer_profiles WHERE phone = p_phone
    ) INTO v_phone_taken;
  END IF;

  -- Check DNI
  IF p_dni IS NOT NULL AND p_dni != '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.customer_profiles WHERE dni = p_dni
    ) INTO v_dni_taken;
  END IF;

  -- Check Email
  IF p_email IS NOT NULL AND p_email != '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.customer_profiles WHERE email = p_email
    ) INTO v_email_taken;
  END IF;

  RETURN jsonb_build_object(
    'phone_taken', v_phone_taken,
    'dni_taken', v_dni_taken,
    'email_taken', v_email_taken
  );
END;
$$;
