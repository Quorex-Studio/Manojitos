-- Crear tabla de créditos para clientes
CREATE TABLE public.credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- Admin que gestiona
  client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Cliente si tiene cuenta
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  
  -- Monto y estado del crédito
  credit_limit NUMERIC NOT NULL DEFAULT 0, -- Límite de crédito autorizado
  current_balance NUMERIC NOT NULL DEFAULT 0, -- Saldo actual pendiente
  
  -- Fechas de corte
  cut_off_day INTEGER NOT NULL DEFAULT 15 CHECK (cut_off_day IN (15, 30)), -- Día de corte: 15 o 30
  grace_days INTEGER NOT NULL DEFAULT 3, -- Días de gracia
  
  -- Estados: ACTIVO, POR_VENCER, EN_GRACIA, VENCIDO, BLOQUEADO
  status TEXT NOT NULL DEFAULT 'ACTIVO',
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_at TIMESTAMP WITH TIME ZONE,
  blocked_reason TEXT,
  
  -- Última fecha de vencimiento y pago
  next_due_date DATE,
  last_payment_date TIMESTAMP WITH TIME ZONE,
  last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  reminders_sent JSONB DEFAULT '[]'::jsonb, -- Historial de recordatorios
  
  -- Notas y metadatos
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla para registrar movimientos de crédito
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Admin que registra
  
  type TEXT NOT NULL CHECK (type IN ('CARGO', 'ABONO')), -- CARGO = nueva deuda, ABONO = pago
  amount NUMERIC NOT NULL,
  previous_balance NUMERIC NOT NULL,
  new_balance NUMERIC NOT NULL,
  
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL, -- Si viene de una venta
  description TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla para historial de recordatorios enviados
CREATE TABLE public.credit_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  
  reminder_type TEXT NOT NULL, -- '3_DAYS_BEFORE', 'DUE_DATE', '1_DAY_AFTER', '3_DAYS_AFTER'
  channel TEXT NOT NULL DEFAULT 'PENDING', -- 'WHATSAPP', 'SMS', 'INTERNAL', 'PENDING'
  message TEXT NOT NULL,
  
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reminders ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para credits (solo admins)
CREATE POLICY "Admins can view all credits"
  ON public.credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_super_admin')::boolean = true
    )
  );

CREATE POLICY "Admins can insert credits"
  ON public.credits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_super_admin')::boolean = true
    )
  );

CREATE POLICY "Admins can update credits"
  ON public.credits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_super_admin')::boolean = true
    )
  );

CREATE POLICY "Admins can delete credits"
  ON public.credits FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_super_admin')::boolean = true
    )
  );

-- Clientes pueden ver su propio crédito
CREATE POLICY "Clients can view own credit"
  ON public.credits FOR SELECT
  USING (client_user_id = auth.uid());

-- Políticas para credit_transactions
CREATE POLICY "Admins can manage credit_transactions"
  ON public.credit_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_super_admin')::boolean = true
    )
  );

CREATE POLICY "Clients can view own transactions"
  ON public.credit_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.credits
      WHERE credits.id = credit_transactions.credit_id
      AND credits.client_user_id = auth.uid()
    )
  );

-- Políticas para credit_reminders
CREATE POLICY "Admins can manage credit_reminders"
  ON public.credit_reminders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_super_admin')::boolean = true
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_credits_updated_at
  BEFORE UPDATE ON public.credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Función para calcular el estado del crédito
CREATE OR REPLACE FUNCTION public.calculate_credit_status(
  p_next_due_date DATE,
  p_grace_days INTEGER,
  p_is_blocked BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
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