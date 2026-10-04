-- Add updated_at to debts
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
