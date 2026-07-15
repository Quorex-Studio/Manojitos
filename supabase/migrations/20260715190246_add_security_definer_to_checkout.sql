-- Fix process_checkout to prevent price injection by fetching the price from the database.
-- Adds SECURITY DEFINER so auth.users can be read.

CREATE OR REPLACE FUNCTION public.process_checkout(
    items public.order_item_input[],
    payment_method text,
    client_name text,
    client_phone text,
    notes text,
    total_bs_rate numeric DEFAULT NULL::numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_customer_user_id UUID;
  v_admin_user_id UUID;
  v_item public.order_item_input;
  v_product_stock INTEGER;
  v_image_url TEXT;
  v_product_price DECIMAL(10,2);
  v_order_id UUID;
  v_total_amount_usd DECIMAL(10,2) := 0;
  v_current_item_total DECIMAL(10,2);
  v_rate DECIMAL(15,4);
  v_items_jsonb JSONB := '[]'::jsonb;
  v_customer_email TEXT;
BEGIN
  -- Get current authenticated user (customer)
  v_customer_user_id := auth.uid();
  IF v_customer_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get customer email from auth.users
  SELECT email INTO v_customer_email FROM auth.users WHERE id = v_customer_user_id;

  -- Determine Exchange Rate
  SELECT rate INTO v_rate FROM public.exchange_rates ORDER BY created_at DESC LIMIT 1;
  IF v_rate IS NULL THEN
     v_rate := COALESCE(total_bs_rate, 1);
  END IF;

  -- Loop through items to validate stock, retrieve image_url, and build JSONB
  FOREACH v_item IN ARRAY items
  LOOP
    -- Lock product row to prevent race conditions during verification
    SELECT stock, user_id, image_url, price_usd INTO v_product_stock, v_admin_user_id, v_image_url, v_product_price
    FROM public.products
    WHERE id = v_item.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID % not found', v_item.id;
    END IF;

    IF v_product_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Requested: %, Available: %)', v_item.name, v_item.quantity, v_product_stock;
    END IF;

    IF v_item.price_usd != v_product_price THEN
      RAISE EXCEPTION 'Price mismatch for product % (Client: %, DB: %)', v_item.name, v_item.price_usd, v_product_price;
    END IF;

    -- Calculate item totals using REAL DB PRICE
    v_current_item_total := v_product_price * v_item.quantity;
    v_total_amount_usd := v_total_amount_usd + v_current_item_total;

    -- Build JSONB array of items
    v_items_jsonb := v_items_jsonb || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_item.id,
        'product_name', v_item.name,
        'quantity', v_item.quantity,
        'unit_price', v_product_price,
        'total', v_current_item_total,
        'image_url', v_image_url
      )
    );
  END LOOP;

  -- Fallback admin ID if not found (should always be found via products)
  IF v_admin_user_id IS NULL THEN
    SELECT id INTO v_admin_user_id FROM auth.users WHERE (raw_app_meta_data->>'is_super_admin')::boolean = true LIMIT 1;
    IF v_admin_user_id IS NULL THEN
      v_admin_user_id := v_customer_user_id;
    END IF;
  END IF;

  -- Create the pending order
  INSERT INTO public.orders (
    user_id,
    customer_user_id,
    customer_name,
    customer_phone,
    customer_email,
    items,
    subtotal,
    discount,
    total_usd,
    total_bs,
    status,
    payment_method,
    payment_status,
    notes
  )
  VALUES (
    v_admin_user_id,
    v_customer_user_id,
    client_name,
    client_phone,
    v_customer_email,
    v_items_jsonb,
    v_total_amount_usd,
    0,
    v_total_amount_usd,
    v_total_amount_usd * v_rate,
    'pending',
    payment_method,
    'pending',
    notes
  )
  RETURNING id INTO v_order_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'sale_ids', array_to_json(ARRAY[v_order_id]::UUID[])::jsonb,
    'total_usd', v_total_amount_usd,
    'exchange_rate_used', v_rate
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_checkout(
    items public.order_item_input[],
    payment_method text,
    client_name text,
    client_phone text,
    notes text,
    total_bs_rate numeric,
    p_banco_origen text,
    p_numero_referencia text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_customer_user_id UUID;
  v_admin_user_id UUID;
  v_item public.order_item_input;
  v_product_stock INTEGER;
  v_image_url TEXT;
  v_product_price DECIMAL(10,2);
  v_order_id UUID;
  v_total_amount_usd DECIMAL(10,2) := 0;
  v_current_item_total DECIMAL(10,2);
  v_rate DECIMAL(15,4);
  v_items_jsonb JSONB := '[]'::jsonb;
  v_customer_email TEXT;
BEGIN
  -- Get current authenticated user (customer)
  v_customer_user_id := auth.uid();
  IF v_customer_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get customer email from auth.users
  SELECT email INTO v_customer_email FROM auth.users WHERE id = v_customer_user_id;

  -- Determine Exchange Rate
  SELECT rate INTO v_rate FROM public.exchange_rates ORDER BY created_at DESC LIMIT 1;
  IF v_rate IS NULL THEN
     v_rate := COALESCE(total_bs_rate, 1);
  END IF;

  -- Loop through items to validate stock, retrieve image_url, and build JSONB
  FOREACH v_item IN ARRAY items
  LOOP
    -- Lock product row to prevent race conditions during verification
    SELECT stock, user_id, image_url, price_usd INTO v_product_stock, v_admin_user_id, v_image_url, v_product_price
    FROM public.products
    WHERE id = v_item.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID % not found', v_item.id;
    END IF;

    IF v_product_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Requested: %, Available: %)', v_item.name, v_item.quantity, v_product_stock;
    END IF;

    IF v_item.price_usd != v_product_price THEN
      RAISE EXCEPTION 'Price mismatch for product % (Client: %, DB: %)', v_item.name, v_item.price_usd, v_product_price;
    END IF;

    -- Calculate item totals using REAL DB PRICE
    v_current_item_total := v_product_price * v_item.quantity;
    v_total_amount_usd := v_total_amount_usd + v_current_item_total;

    -- Build JSONB array of items
    v_items_jsonb := v_items_jsonb || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_item.id,
        'product_name', v_item.name,
        'quantity', v_item.quantity,
        'unit_price', v_product_price,
        'total', v_current_item_total,
        'image_url', v_image_url
      )
    );
  END LOOP;

  -- Fallback admin ID if not found (should always be found via products)
  IF v_admin_user_id IS NULL THEN
    SELECT id INTO v_admin_user_id FROM auth.users WHERE (raw_app_meta_data->>'is_super_admin')::boolean = true LIMIT 1;
    IF v_admin_user_id IS NULL THEN
      v_admin_user_id := v_customer_user_id;
    END IF;
  END IF;

  -- Create the pending order
  INSERT INTO public.orders (
    user_id,
    customer_user_id,
    customer_name,
    customer_phone,
    customer_email,
    items,
    subtotal,
    discount,
    total_usd,
    total_bs,
    status,
    payment_method,
    payment_status,
    notes,
    banco_origen,
    numero_referencia
  )
  VALUES (
    v_admin_user_id,
    v_customer_user_id,
    client_name,
    client_phone,
    v_customer_email,
    v_items_jsonb,
    v_total_amount_usd,
    0,
    v_total_amount_usd,
    v_total_amount_usd * v_rate,
    'pending',
    payment_method,
    'pending',
    notes,
    p_banco_origen,
    p_numero_referencia
  )
  RETURNING id INTO v_order_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'sale_ids', array_to_json(ARRAY[v_order_id]::UUID[])::jsonb,
    'total_usd', v_total_amount_usd,
    'exchange_rate_used', v_rate
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$function$;
