-- Reconciliación: columnas de pago en ventas creadas fuera de migraciones en el proyecto original
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_modality TEXT NOT NULL DEFAULT 'contado';
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON public.sales(payment_status);
