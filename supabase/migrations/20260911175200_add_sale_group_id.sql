-- Add sale_group_id to sales and sale_payments
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_group_id UUID;
ALTER TABLE public.sale_payments ADD COLUMN IF NOT EXISTS sale_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_sales_sale_group_id ON public.sales(sale_group_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_group_id ON public.sale_payments(sale_group_id);

-- Backfill: Group historical sales
-- For historical data, we create a temporary mapping of groups of sales to a new UUID.
-- Groups are defined by: client_name, payment_method, and created_at truncated to the minute.
-- We assign a UUID to each unique combination.

DO $$
DECLARE
    r RECORD;
    v_group_id UUID;
BEGIN
    FOR r IN (
        SELECT 
            COALESCE(client_name, 'unknown') as cname, 
            payment_method, 
            date_trunc('minute', created_at) as cminute 
        FROM public.sales 
        WHERE sale_group_id IS NULL
        GROUP BY COALESCE(client_name, 'unknown'), payment_method, date_trunc('minute', created_at)
    ) LOOP
        v_group_id := gen_random_uuid();
        
        UPDATE public.sales 
        SET sale_group_id = v_group_id
        WHERE COALESCE(client_name, 'unknown') = r.cname
          AND payment_method = r.payment_method
          AND date_trunc('minute', created_at) = r.cminute
          AND sale_group_id IS NULL;
    END LOOP;
END $$;

-- For sale_payments: Link historical payments to the new sale_group_id using their sale_id.
UPDATE public.sale_payments sp
SET sale_group_id = s.sale_group_id
FROM public.sales s
WHERE sp.sale_id = s.id
  AND sp.sale_group_id IS NULL;
