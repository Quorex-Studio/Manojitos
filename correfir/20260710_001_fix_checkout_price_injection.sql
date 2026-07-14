-- Migration: Fix Price Injection Vulnerability in Checkout
-- Date: 2025-07-10
-- Severity: CRITICAL
-- Description: Re-validate product prices from database instead of trusting client input

-- Drop existing function
DROP FUNCTION IF EXISTS public.process_checkout(public.order_item_input[], TEXT, TEXT, TEXT, TEXT, DECIMAL);

-- Create the SECURE process_checkout function
CREATE OR REPLACE FUNCTION public.process_checkout(
  items public.order_item_input[],
  payment_method TEXT,
  client_name TEXT,
  client_phone TEXT,
  notes TEXT DEFAULT NULL,
  total_bs_rate DECIMAL(15,4) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_item public.order_item_input;
  v_db_product RECORD;  -- ← NEW: Store complete product record from DB
  v_product_stock INTEGER;
  v_sale_id UUID;
  v_total_amount_usd DECIMAL(10,2) := 0;
  v_current_item_total DECIMAL(10,2);
  v_current_item_total_bs DECIMAL(15,2);
  v_rate DECIMAL(15,4);
  v_sale_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- 1. Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Determine Exchange Rate
  SELECT rate INTO v_rate FROM public.exchange_rates ORDER BY created_at DESC LIMIT 1;
  
  IF v_rate IS NULL THEN
     v_rate := COALESCE(total_bs_rate, 1);
  END IF;

  -- 3. Loop through items to validate stock AND calculate totals
  -- ⭐ SECURITY: Re-validate price against DB
  FOREACH v_item IN ARRAY items
  LOOP
    -- Lock the product row for update AND fetch REAL price from DB
    SELECT id, stock, price_usd, name INTO v_db_product
    FROM public.products
    WHERE id = v_item.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID % not found', v_item.id;
    END IF;

    -- ⭐ SECURITY: Validate price matches (with 0.01 tolerance for rounding)
    IF ABS(v_item.price_usd - v_db_product.price_usd) > 0.01 THEN
      RAISE EXCEPTION 'Price mismatch for product % (Client: %, DB: %). Possible fraud attempt.', 
        v_item.id, v_item.price_usd, v_db_product.price_usd;
    END IF;

    -- ⭐ SECURITY: Validate price >= 0
    IF v_db_product.price_usd < 0 THEN
      RAISE EXCEPTION 'Invalid price for product %: price must be >= 0', v_item.id;
    END IF;

    -- Check stock
    IF v_db_product.stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Requested: %, Available: %)', 
        v_db_product.name, v_item.quantity, v_db_product.stock;
    END IF;

    -- ⭐ CHANGE: Use DB price, not client price
    v_current_item_total := v_db_product.price_usd * v_item.quantity;
    v_total_amount_usd := v_total_amount_usd + v_current_item_total;
  END LOOP;

  -- 4. Loop again to execute the changes (Deduct stock & Create Sales)
  -- We do this in a second loop to ensure ALL items are valid before making ANY changes.
  FOREACH v_item IN ARRAY items
  LOOP
    -- Get the REAL product data (price has already been validated)
    SELECT price_usd, name INTO v_current_item_total, v_item.name
    FROM public.products
    WHERE id = v_item.id;

    -- Deduct stock
    UPDATE public.products
    SET 
      stock = stock - v_item.quantity,
      sold_count = sold_count + v_item.quantity,
      updated_at = now()
    WHERE id = v_item.id;

    -- Calculate specific BS amount for this line item using REAL DB price
    v_current_item_total_bs := v_current_item_total * v_item.quantity * v_rate;

    -- Insert into sales with VALIDATED PRICE from DB
    INSERT INTO public.sales (
      user_id,
      product_id,
      product_name,
      quantity,
      unit_price_usd,
      total_usd,
      total_bs,
      payment_method,
      client_name,
      client_phone,
      is_credit,
      notes
    )
    VALUES (
      v_user_id,
      v_item.id,
      v_item.name,
      v_item.quantity,
      v_current_item_total,  -- ⭐ SECURED: Price validated from DB
      v_current_item_total * v_item.quantity,
      v_current_item_total_bs,
      payment_method,
      client_name,
      client_phone,
      FALSE, -- Default to not credit for checkout
      notes
    )
    RETURNING id INTO v_sale_id;

    v_sale_ids := array_append(v_sale_ids, v_sale_id);
  END LOOP;

  -- 5. Return success
  RETURN jsonb_build_object(
    'success', true,
    'sale_ids', v_sale_ids,
    'total_usd', v_total_amount_usd,
    'exchange_rate_used', v_rate
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction is automatically rolled back by Postgres on exception
    RAISE;
END;
$$;

-- Add comment documenting the security fix
COMMENT ON FUNCTION public.process_checkout(public.order_item_input[], TEXT, TEXT, TEXT, TEXT, DECIMAL) IS
'Securely process checkout by re-validating all prices from the database instead of trusting client input. Prevents price injection attacks.';
