-- Add check constraints to products table to prevent negative price and stock

ALTER TABLE public.products
ADD CONSTRAINT check_price_non_negative CHECK (price_usd >= 0),
ADD CONSTRAINT check_stock_non_negative CHECK (stock >= 0);
