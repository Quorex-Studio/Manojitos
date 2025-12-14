-- Add new fields to credits table for professional credit management
ALTER TABLE public.credits
ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS trust_level TEXT DEFAULT 'CONFIABLE',
ADD COLUMN IF NOT EXISTS avg_payment_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_purchases INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_paid_on_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_paid_late INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_late_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS consecutive_late_payments INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS restriction_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_payment_discount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_limit_adjustment BOOLEAN DEFAULT true;

-- Create payment_promises table for digital commitments
CREATE TABLE public.payment_promises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  promised_amount NUMERIC NOT NULL,
  promised_date DATE NOT NULL,
  actual_payment_date DATE,
  actual_amount_paid NUMERIC,
  status TEXT NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, CUMPLIDA, INCUMPLIDA, PARCIAL
  client_accepted BOOLEAN DEFAULT false,
  accepted_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on payment_promises
ALTER TABLE public.payment_promises ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_promises
CREATE POLICY "Admins can manage payment_promises"
ON public.payment_promises
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE users.id = auth.uid() 
    AND (users.raw_app_meta_data->>'is_super_admin')::boolean = true
  )
);

CREATE POLICY "Clients can view own promises"
ON public.payment_promises
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM credits 
    WHERE credits.id = payment_promises.credit_id 
    AND credits.client_user_id = auth.uid()
  )
);

-- Function to calculate trust score
CREATE OR REPLACE FUNCTION public.calculate_trust_score(
  p_total_purchases INTEGER,
  p_total_paid_on_time INTEGER,
  p_total_paid_late INTEGER,
  p_consecutive_late INTEGER,
  p_current_score INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INTEGER;
  v_on_time_rate NUMERIC;
BEGIN
  -- Start with current score or 100
  v_score := COALESCE(p_current_score, 100);
  
  -- Calculate on-time payment rate
  IF p_total_purchases > 0 THEN
    v_on_time_rate := p_total_paid_on_time::NUMERIC / p_total_purchases;
  ELSE
    v_on_time_rate := 1.0;
  END IF;
  
  -- Penalize consecutive late payments heavily
  v_score := v_score - (p_consecutive_late * 15);
  
  -- Adjust based on overall payment history
  IF v_on_time_rate >= 0.9 THEN
    v_score := v_score + 5;
  ELSIF v_on_time_rate < 0.5 THEN
    v_score := v_score - 10;
  END IF;
  
  -- Keep score within bounds
  IF v_score > 100 THEN v_score := 100; END IF;
  IF v_score < 0 THEN v_score := 0; END IF;
  
  RETURN v_score;
END;
$$;

-- Function to determine trust level from score
CREATE OR REPLACE FUNCTION public.get_trust_level(p_score INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_score >= 70 THEN
    RETURN 'CONFIABLE';
  ELSIF p_score >= 40 THEN
    RETURN 'RIESGO';
  ELSE
    RETURN 'CRITICO';
  END IF;
END;
$$;

-- Function to get restriction level based on trust level
CREATE OR REPLACE FUNCTION public.get_restriction_level(p_trust_level TEXT, p_is_blocked BOOLEAN)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_is_blocked THEN
    RETURN 3; -- Bloqueo total
  ELSIF p_trust_level = 'CRITICO' THEN
    RETURN 2; -- Solo pago contado
  ELSIF p_trust_level = 'RIESGO' THEN
    RETURN 1; -- Crédito limitado
  ELSE
    RETURN 0; -- Sin restricciones
  END IF;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credits_trust_score ON public.credits(trust_score);
CREATE INDEX IF NOT EXISTS idx_credits_trust_level ON public.credits(trust_level);
CREATE INDEX IF NOT EXISTS idx_payment_promises_credit_id ON public.payment_promises(credit_id);
CREATE INDEX IF NOT EXISTS idx_payment_promises_status ON public.payment_promises(status);
CREATE INDEX IF NOT EXISTS idx_payment_promises_promised_date ON public.payment_promises(promised_date);

-- Trigger to update trust level when score changes
CREATE OR REPLACE FUNCTION public.update_trust_level_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.trust_level := public.get_trust_level(NEW.trust_score);
  NEW.restriction_level := public.get_restriction_level(NEW.trust_level, NEW.is_blocked);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_trust_level
BEFORE INSERT OR UPDATE OF trust_score, is_blocked ON public.credits
FOR EACH ROW
EXECUTE FUNCTION public.update_trust_level_trigger();