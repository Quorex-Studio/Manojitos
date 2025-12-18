-- Add currency column to exchange_rates table
ALTER TABLE public.exchange_rates 
ADD COLUMN currency text NOT NULL DEFAULT 'USD';

-- Add index for faster queries by currency
CREATE INDEX idx_exchange_rates_currency ON public.exchange_rates(currency);

-- Update existing records to be USD
UPDATE public.exchange_rates SET currency = 'USD' WHERE currency IS NULL;