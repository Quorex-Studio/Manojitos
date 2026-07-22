-- Add billing fields to sales and debts
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_dni TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_address TEXT;

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS client_dni TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS client_address TEXT;
