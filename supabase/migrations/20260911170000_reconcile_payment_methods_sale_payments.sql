-- Reconciliación: objetos que existían en producción del proyecto original pero sin migración.

-- 1. Catálogo de métodos de pago (configurable desde Configuración)
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view enabled payment methods" ON public.payment_methods
  FOR SELECT TO anon, authenticated USING (enabled OR public.is_admin());
CREATE POLICY "Admins can manage payment methods" ON public.payment_methods
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.payment_methods (method_key, label, description, enabled, display_order, config) VALUES
  ('pago_movil', 'Pago Móvil', 'Pago instantáneo desde tu banco', true, 1, '{"bank": "", "phone": "", "ci": "", "name": ""}'),
  ('transferencia', 'Transferencia bancaria', 'Transferencia en bolívares', true, 2, '{"bank": "", "account": "", "ci": "", "name": ""}'),
  ('zelle', 'Zelle', 'Transferencia en dólares', true, 3, '{"email": "", "name": ""}'),
  ('efectivo_usd', 'Efectivo (USD)', 'Pago en efectivo al retirar o recibir', true, 4, '{}')
ON CONFLICT (method_key) DO NOTHING;

-- 2. sale_payments: estado (valid/void) y abonos a nivel de grupo sin sale_id
ALTER TABLE public.sale_payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'void'));
ALTER TABLE public.sale_payments ALTER COLUMN sale_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sale_payments_status ON public.sale_payments(status);

-- 3. Solo admins leen/insertan pagos (antes cualquier usuario autenticado podía)
DROP POLICY IF EXISTS "Enable read for authenticated users on sale_payments" ON public.sale_payments;
DROP POLICY IF EXISTS "Enable insert for authenticated users on sale_payments" ON public.sale_payments;
CREATE POLICY "Admins can view sale payments" ON public.sale_payments FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert sale payments" ON public.sale_payments FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Customers can view own sale payments" ON public.sale_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE (s.id = sale_payments.sale_id OR s.sale_group_id = sale_payments.sale_group_id) AND s.customer_user_id = auth.uid()));
