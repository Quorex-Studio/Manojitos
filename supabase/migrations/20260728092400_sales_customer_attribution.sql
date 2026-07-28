-- 1. Función de normalización de teléfonos venezolanos (0412xxxxxxx <-> +58412xxxxxxx)
CREATE OR REPLACE FUNCTION public.normalize_ve_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_phone IS NULL THEN NULL
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^0[0-9]{10}$'
      THEN '+58' || substring(regexp_replace(p_phone, '[^0-9]', '', 'g') from 2)
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^58[0-9]{10}$'
      THEN '+' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
      THEN '+58' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    ELSE regexp_replace(p_phone, '[^0-9+]', '', 'g')
  END;
$$;

-- 2. Columna para vincular la venta al cliente real (separada de quién la procesó)
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_customer_user_id ON public.sales(customer_user_id);

-- 3. Backfill: vincular ventas existentes a su cliente real por coincidencia de teléfono normalizado
UPDATE public.sales s
SET customer_user_id = cp.user_id
FROM public.customer_profiles cp
WHERE s.customer_user_id IS NULL
  AND s.client_phone IS NOT NULL
  AND cp.phone IS NOT NULL
  AND public.normalize_ve_phone(s.client_phone) = public.normalize_ve_phone(cp.phone);

-- 4. Trigger: auto-vincular ventas futuras al insertar, si el teléfono coincide con un cliente registrado
CREATE OR REPLACE FUNCTION public.sales_autolink_customer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_user_id IS NULL AND NEW.client_phone IS NOT NULL THEN
    SELECT cp.user_id INTO NEW.customer_user_id
    FROM public.customer_profiles cp
    WHERE public.normalize_ve_phone(cp.phone) = public.normalize_ve_phone(NEW.client_phone)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_autolink_customer ON public.sales;
CREATE TRIGGER trg_sales_autolink_customer
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_autolink_customer();

-- 5. RLS: permitir que el cliente vea sus ventas por customer_user_id, además de por user_id (staff)
DROP POLICY IF EXISTS "Users can view own sales" ON public.sales;
CREATE POLICY "Users can view own sales" ON public.sales
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = customer_user_id);
