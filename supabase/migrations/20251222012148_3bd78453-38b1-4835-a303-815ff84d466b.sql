-- Tabla para memoria de cliente (preferencias y comportamiento)
CREATE TABLE public.customer_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_user_id UUID,
  customer_phone TEXT,
  memory_type TEXT NOT NULL, -- 'preference', 'behavior', 'interaction'
  memory_key TEXT NOT NULL,
  memory_value JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para búsqueda rápida
CREATE INDEX idx_customer_memory_user ON public.customer_memory(user_id);
CREATE INDEX idx_customer_memory_customer ON public.customer_memory(customer_user_id);
CREATE INDEX idx_customer_memory_phone ON public.customer_memory(customer_phone);
CREATE INDEX idx_customer_memory_type ON public.customer_memory(memory_type);

-- Enable RLS
ALTER TABLE public.customer_memory ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage customer memory"
ON public.customer_memory FOR ALL
USING (is_admin());

CREATE POLICY "Customers can view own memory"
ON public.customer_memory FOR SELECT
USING (customer_user_id = auth.uid());

-- Tabla para alertas de Ángela
CREATE TABLE public.angela_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL, -- 'stock_low', 'risky_client', 'overdue_debt', 'star_product', 'recommendation'
  severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  reference_type TEXT, -- 'product', 'client', 'credit', 'sale'
  reference_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_angela_alerts_user ON public.angela_alerts(user_id);
CREATE INDEX idx_angela_alerts_type ON public.angela_alerts(alert_type);
CREATE INDEX idx_angela_alerts_unread ON public.angela_alerts(user_id, is_read, is_dismissed);

-- Enable RLS
ALTER TABLE public.angela_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage angela alerts"
ON public.angela_alerts FOR ALL
USING (is_admin());

CREATE POLICY "Users can view own alerts"
ON public.angela_alerts FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update own alerts"
ON public.angela_alerts FOR UPDATE
USING (user_id = auth.uid());

-- Tabla para historial de interacciones con Ángela
CREATE TABLE public.angela_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_angela_conv_user ON public.angela_conversations(user_id);
CREATE INDEX idx_angela_conv_session ON public.angela_conversations(session_id);

-- Enable RLS
ALTER TABLE public.angela_conversations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can manage own conversations"
ON public.angela_conversations FOR ALL
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all conversations"
ON public.angela_conversations FOR SELECT
USING (is_admin());

-- Trigger para updated_at en customer_memory
CREATE TRIGGER update_customer_memory_updated_at
BEFORE UPDATE ON public.customer_memory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Agregar campo minimum_stock a products si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'minimum_stock') THEN
    ALTER TABLE public.products ADD COLUMN minimum_stock INTEGER DEFAULT 5;
  END IF;
END $$;