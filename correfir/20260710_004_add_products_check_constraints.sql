-- Migration: Add CHECK Constraints to Products Table
-- Date: 2025-07-10
-- Severity: MEDIUM/HIGH
-- Description: Prevent invalid data (negative prices/stock) at database level

-- Before applying: Check for existing violations:
-- SELECT id, name, price_usd, stock FROM public.products WHERE price_usd < 0 OR stock < 0;
-- If violations exist, fix them manually before applying constraints.

-- Example fix for negative prices (if needed):
-- UPDATE public.products SET price_usd = ABS(price_usd) WHERE price_usd < 0;
-- UPDATE public.products SET stock = 0 WHERE stock < 0;

-- Add CHECK constraint: price must be non-negative
ALTER TABLE public.products
ADD CONSTRAINT check_price_non_negative 
CHECK (price_usd >= 0);

-- Add CHECK constraint: stock must be non-negative
ALTER TABLE public.products
ADD CONSTRAINT check_stock_non_negative 
CHECK (stock >= 0);

-- Add CHECK constraint: sold_count must be non-negative
ALTER TABLE public.products
ADD CONSTRAINT check_sold_count_non_negative 
CHECK (sold_count >= 0);

-- Add CHECK constraint: quantity_per_unit must be positive
ALTER TABLE public.products
ADD CONSTRAINT check_quantity_per_unit_positive 
CHECK (quantity_per_unit > 0);

-- Add CHECK constraint: name must not be empty
ALTER TABLE public.products
ADD CONSTRAINT check_name_not_empty 
CHECK (name IS NOT NULL AND length(trim(name)) > 0);

-- Add comment documenting constraints
COMMENT ON CONSTRAINT check_price_non_negative ON public.products IS
'Ensures product prices cannot be negative. Prevents accounting inconsistencies.';

COMMENT ON CONSTRAINT check_stock_non_negative ON public.products IS
'Ensures product stock quantities cannot be negative. Prevents inventory inconsistencies.';

COMMENT ON CONSTRAINT check_sold_count_non_negative ON public.products IS
'Ensures sold count cannot be negative. Maintains audit trail integrity.';

COMMENT ON CONSTRAINT check_quantity_per_unit_positive ON public.products IS
'Ensures quantity_per_unit is always positive. Prevents division by zero in calculations.';

COMMENT ON CONSTRAINT check_name_not_empty ON public.products IS
'Ensures product names are not empty or whitespace-only. Improves data quality.';

-- Testing queries (uncomment to verify after migration):
-- 1. Verify constraints exist:
-- SELECT constraint_name, check_clause FROM information_schema.check_constraints 
-- WHERE table_name='products' ORDER BY constraint_name;

-- 2. Test constraint violations (should all fail):
-- INSERT INTO products (name, price_usd, stock) VALUES ('Bad Price', -10, 5); -- ❌ Fails: price < 0
-- INSERT INTO products (name, price_usd, stock) VALUES ('Bad Stock', 10, -5); -- ❌ Fails: stock < 0
-- INSERT INTO products (name, price_usd, stock) VALUES ('', 10, 5); -- ❌ Fails: empty name

-- 3. Test valid insert (should succeed):
-- INSERT INTO products (name, price_usd, stock, quantity_per_unit) 
-- VALUES ('Good Product', 10.00, 5, 1); -- ✅ Succeeds
