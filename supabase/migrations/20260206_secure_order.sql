-- Create a type for the order items parameter
CREATE TYPE public.order_item_input AS (
  id UUID,
  name TEXT,
  quantity INTEGER,
  price_usd DECIMAL(10,2)
);

-- Create the process_checkout function
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
  -- Ideally, we fetch this from the DB to be secure, but for now we'll support the passed rate 
  -- IF it matches roughly what we have, OR just rely on the client if that's the current business rule.
  -- BETTER: Fetch the latest rate from DB.
  SELECT rate INTO v_rate FROM public.exchange_rates ORDER BY created_at DESC LIMIT 1;
  
  -- Fallback if no rate in DB (shouldn't happen in prod but good for safety)
  IF v_rate IS NULL THEN
     v_rate := COALESCE(total_bs_rate, 1);
  END IF;

  -- 3. Loop through items to validate stock AND calculate totals
  FOREACH v_item IN ARRAY items
  LOOP
    -- Lock the product row for update to prevent race conditions
    SELECT stock INTO v_product_stock
    FROM public.products
    WHERE id = v_item.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID % not found', v_item.id;
    END IF;

    IF v_product_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Requested: %, Available: %)', v_item.name, v_item.quantity, v_product_stock;
    END IF;

    -- Calculate item totals
    v_current_item_total := v_item.price_usd * v_item.quantity;
    v_total_amount_usd := v_total_amount_usd + v_current_item_total;
  END LOOP;

  -- 4. Loop again to execute the changes (Deduct stock & Create Sales)
  -- We do this in a second loop to ensure ALL items are valid before making ANY changes.
  FOREACH v_item IN ARRAY items
  LOOP
    -- Deduct stock
    UPDATE public.products
    SET 
      stock = stock - v_item.quantity,
      sold_count = sold_count + v_item.quantity,
      updated_at = now()
    WHERE id = v_item.id;

    -- Calculate specific BS amount for this line item
    v_current_item_total := v_item.price_usd * v_item.quantity;
    v_current_item_total_bs := v_current_item_total * v_rate;

    -- Insert into sales
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
      v_item.price_usd,
      v_current_item_total,
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
