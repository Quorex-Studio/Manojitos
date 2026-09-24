-- Reconciliación: columnas de precios/tallas creadas fuera de migraciones en el proyecto original
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_usd numeric(10,2) CHECK (cost_usd IS NULL OR cost_usd >= 0),
  ADD COLUMN IF NOT EXISTS price_bs_usd numeric(10,2) CHECK (price_bs_usd IS NULL OR price_bs_usd >= 0),
  ADD COLUMN IF NOT EXISTS price_retail_eur numeric(10,2) CHECK (price_retail_eur IS NULL OR price_retail_eur >= 0),
  ADD COLUMN IF NOT EXISTS price_wholesale_eur numeric(10,2) CHECK (price_wholesale_eur IS NULL OR price_wholesale_eur >= 0),
  ADD COLUMN IF NOT EXISTS sizes text[];
