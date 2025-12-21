-- Crear tabla de wishlist para clientes
CREATE TABLE public.wishlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Habilitar RLS
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

-- Políticas para wishlist
CREATE POLICY "Users can view own wishlist" 
ON public.wishlist 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add to own wishlist" 
ON public.wishlist 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from own wishlist" 
ON public.wishlist 
FOR DELETE 
USING (auth.uid() = user_id);

-- Crear tabla de orders para seguimiento de pedidos
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_user_id UUID,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total_usd NUMERIC NOT NULL,
  total_bs NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Políticas para orders
CREATE POLICY "Customers can view own orders" 
ON public.orders 
FOR SELECT 
USING (customer_user_id = auth.uid());

CREATE POLICY "Admins can manage orders" 
ON public.orders 
FOR ALL 
USING (is_admin());

-- Índices
CREATE INDEX idx_wishlist_user_id ON public.wishlist(user_id);
CREATE INDEX idx_orders_customer_user_id ON public.orders(customer_user_id);
CREATE INDEX idx_orders_status ON public.orders(status);

-- Trigger para updated_at en orders
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();