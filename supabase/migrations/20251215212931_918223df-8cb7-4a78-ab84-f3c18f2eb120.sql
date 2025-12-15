-- =============================================
-- 1) CHECKOUT TRANSACCIONAL - Estados en sales
-- =============================================
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';

-- Crear índice para búsquedas por status
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);

-- =============================================
-- 2) LEDGER FINANCIERO - Auditoría real
-- =============================================
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  amount_usd numeric NOT NULL,
  amount_bs numeric,
  reference_type text NOT NULL, -- sale, credit_payment, adjustment, refund
  reference_id uuid,
  description text,
  balance_after_usd numeric NOT NULL,
  balance_after_bs numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- No se permite eliminación, solo reversos
  is_reversal boolean DEFAULT false,
  reversal_of_id uuid REFERENCES public.ledger_entries(id),
  reversed_by_id uuid REFERENCES public.ledger_entries(id)
);

-- Índices para ledger
CREATE INDEX IF NOT EXISTS idx_ledger_user ON public.ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON public.ledger_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON public.ledger_entries(created_at DESC);

-- RLS para ledger
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert ledger entries"
  ON public.ledger_entries FOR INSERT
  WITH CHECK (public.is_admin() OR auth.uid() = user_id);

-- Bloquear DELETE en ledger (solo reversos)
-- No se crea política DELETE

-- =============================================
-- 3) PERFIL DE CLIENTE COMPLETO
-- =============================================
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  phone text NOT NULL,
  phone_verified boolean DEFAULT false,
  email text,
  address text,
  city text,
  state text,
  zip_code text,
  notes text,
  notification_preferences jsonb DEFAULT '{"email": true, "sms": false, "internal": true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para customer_profiles
CREATE INDEX IF NOT EXISTS idx_customer_profiles_user ON public.customer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON public.customer_profiles(phone);

-- RLS para customer_profiles
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own customer profile"
  ON public.customer_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customer profile"
  ON public.customer_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customer profile"
  ON public.customer_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all customer profiles"
  ON public.customer_profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can manage customer profiles"
  ON public.customer_profiles FOR ALL
  USING (public.is_admin());

-- Trigger para updated_at
CREATE TRIGGER update_customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4) MÉTODOS DE PAGO DEL CLIENTE
-- =============================================
CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  method_type text NOT NULL, -- efectivo_usd, efectivo_bs, zelle, pago_movil, transferencia
  alias text,
  details jsonb DEFAULT '{}'::jsonb, -- banco, referencia, etc (no datos sensibles)
  is_preferred boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_user ON public.customer_payment_methods(user_id);

-- RLS
ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment methods"
  ON public.customer_payment_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment methods"
  ON public.customer_payment_methods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods"
  ON public.customer_payment_methods FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods"
  ON public.customer_payment_methods FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payment methods"
  ON public.customer_payment_methods FOR SELECT
  USING (public.is_admin());

-- Trigger para updated_at
CREATE TRIGGER update_customer_payment_methods_updated_at
  BEFORE UPDATE ON public.customer_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 5) REGLAS DE NEGOCIO CONFIGURABLES
-- =============================================
CREATE TABLE IF NOT EXISTS public.business_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- El admin dueño de la regla
  rule_key text NOT NULL,
  rule_name text NOT NULL,
  description text,
  rule_type text NOT NULL, -- credit_block, limit_adjustment, notification, restriction
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, rule_key)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_business_rules_user ON public.business_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_business_rules_active ON public.business_rules(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage business rules"
  ON public.business_rules FOR ALL
  USING (public.is_admin());

-- Trigger para updated_at
CREATE TRIGGER update_business_rules_updated_at
  BEFORE UPDATE ON public.business_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar reglas por defecto (estas se crearán cuando un admin acceda)
-- Las reglas se insertarán dinámicamente

-- =============================================
-- 6) TIMELINE DE EVENTOS POR CLIENTE
-- =============================================
CREATE TABLE IF NOT EXISTS public.customer_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- Admin owner
  customer_user_id uuid, -- Cliente si tiene cuenta
  customer_phone text, -- Identificador alternativo
  event_type text NOT NULL, -- sale, payment, credit_granted, credit_blocked, reminder_sent, promise_created, promise_fulfilled, promise_broken
  event_data jsonb DEFAULT '{}'::jsonb,
  reference_type text, -- sales, credits, payment_promises, etc
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_customer_timeline_user ON public.customer_timeline(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_timeline_customer ON public.customer_timeline(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_timeline_phone ON public.customer_timeline(customer_phone);
CREATE INDEX IF NOT EXISTS idx_customer_timeline_created ON public.customer_timeline(created_at DESC);

-- RLS
ALTER TABLE public.customer_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage timeline"
  ON public.customer_timeline FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view own timeline"
  ON public.customer_timeline FOR SELECT
  USING (auth.uid() = customer_user_id);

-- =============================================
-- 7) STORAGE BUCKET PARA IMÁGENES
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images', 
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Public read access for product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND public.is_admin());

-- =============================================
-- 8) FUNCIÓN PARA CREAR ENTRADA DE LEDGER
-- =============================================
CREATE OR REPLACE FUNCTION public.create_ledger_entry(
  p_user_id uuid,
  p_entry_type text,
  p_amount_usd numeric,
  p_amount_bs numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_balance_usd numeric;
  v_last_balance_bs numeric;
  v_new_balance_usd numeric;
  v_new_balance_bs numeric;
  v_entry_id uuid;
BEGIN
  -- Obtener último balance
  SELECT balance_after_usd, balance_after_bs 
  INTO v_last_balance_usd, v_last_balance_bs
  FROM public.ledger_entries 
  WHERE user_id = p_user_id 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- Si no hay entradas previas, empezar en 0
  v_last_balance_usd := COALESCE(v_last_balance_usd, 0);
  v_last_balance_bs := COALESCE(v_last_balance_bs, 0);
  
  -- Calcular nuevo balance
  IF p_entry_type = 'credit' THEN
    v_new_balance_usd := v_last_balance_usd + p_amount_usd;
    v_new_balance_bs := v_last_balance_bs + COALESCE(p_amount_bs, 0);
  ELSE
    v_new_balance_usd := v_last_balance_usd - p_amount_usd;
    v_new_balance_bs := v_last_balance_bs - COALESCE(p_amount_bs, 0);
  END IF;
  
  -- Insertar entrada
  INSERT INTO public.ledger_entries (
    user_id, entry_type, amount_usd, amount_bs, 
    reference_type, reference_id, description,
    balance_after_usd, balance_after_bs, metadata
  ) VALUES (
    p_user_id, p_entry_type, p_amount_usd, p_amount_bs,
    p_reference_type, p_reference_id, p_description,
    v_new_balance_usd, v_new_balance_bs, p_metadata
  ) RETURNING id INTO v_entry_id;
  
  RETURN v_entry_id;
END;
$$;

-- =============================================
-- 9) FUNCIÓN PARA EVALUAR REGLAS DE NEGOCIO
-- =============================================
CREATE OR REPLACE FUNCTION public.evaluate_business_rules(
  p_admin_user_id uuid,
  p_context jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule record;
  v_results jsonb := '[]'::jsonb;
  v_should_apply boolean;
BEGIN
  FOR v_rule IN 
    SELECT * FROM public.business_rules 
    WHERE user_id = p_admin_user_id 
    AND is_active = true 
    ORDER BY priority DESC
  LOOP
    -- Evaluar condiciones básicas
    v_should_apply := true;
    
    -- Verificar trust_score si está en condiciones
    IF v_rule.conditions ? 'min_trust_score' AND p_context ? 'trust_score' THEN
      IF (p_context->>'trust_score')::int < (v_rule.conditions->>'min_trust_score')::int THEN
        v_should_apply := true;
      END IF;
    END IF;
    
    -- Verificar días de mora
    IF v_rule.conditions ? 'max_overdue_days' AND p_context ? 'overdue_days' THEN
      IF (p_context->>'overdue_days')::int > (v_rule.conditions->>'max_overdue_days')::int THEN
        v_should_apply := true;
      END IF;
    END IF;
    
    IF v_should_apply THEN
      v_results := v_results || jsonb_build_object(
        'rule_id', v_rule.id,
        'rule_key', v_rule.rule_key,
        'actions', v_rule.actions
      );
    END IF;
  END LOOP;
  
  RETURN v_results;
END;
$$;

-- =============================================
-- 10) HABILITAR REALTIME EN NUEVAS TABLAS
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_timeline;
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_rules;