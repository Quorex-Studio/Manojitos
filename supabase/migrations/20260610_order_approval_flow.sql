-- 1. Alter customer_profiles to make phone nullable
ALTER TABLE public.customer_profiles ALTER COLUMN phone DROP NOT NULL;

-- 2. Re-define handle_new_user to populate both profiles and customer_profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.profiles
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'))
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert into public.customer_profiles
  INSERT INTO public.customer_profiles (user_id, full_name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'), NEW.email, '')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Retroactively sync existing users into customer_profiles
INSERT INTO public.customer_profiles (user_id, full_name, email, phone)
SELECT 
  u.id, 
  COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', 'Usuario'), 
  u.email, 
  ''
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
ON CONFLICT (user_id) DO NOTHING;

-- 4. Rewrite process_checkout function
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
  v_customer_user_id UUID;
  v_admin_user_id UUID;
  v_item public.order_item_input;
  v_product_stock INTEGER;
  v_image_url TEXT;
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
    SELECT stock, user_id, image_url INTO v_product_stock, v_admin_user_id, v_image_url
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

    -- Build JSONB array of items
    v_items_jsonb := v_items_jsonb || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_item.id,
        'product_name', v_item.name,
        'quantity', v_item.quantity,
        'unit_price', v_item.price_usd,
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
$$;

-- 5. Create confirm_order function
CREATE OR REPLACE FUNCTION public.confirm_order(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC;
  v_product_name TEXT;
  v_rate NUMERIC;
  v_sale_id UUID;
  v_product_stock INTEGER;
BEGIN
  -- Lock the order row
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status != 'pending' THEN
    RAISE EXCEPTION 'Order is not in pending status (Current: %)', v_order.status;
  END IF;

  v_rate := COALESCE(v_order.total_bs / NULLIF(v_order.total_usd, 0), 1);

  -- Validate stock for all items
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_product_name := v_item->>'product_name';

    SELECT stock INTO v_product_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID % not found', v_product_id;
    END IF;

    IF v_product_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Requested: %, Available: %)', v_product_name, v_quantity, v_product_stock;
    END IF;
  END LOOP;

  -- Deduct stock and insert into sales
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_product_name := v_item->>'product_name';
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    -- Deduct stock
    UPDATE public.products
    SET 
      stock = stock - v_quantity,
      sold_count = sold_count + v_quantity,
      updated_at = now()
    WHERE id = v_product_id;

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
      status,
      notes
    )
    VALUES (
      v_order.customer_user_id,
      v_product_id,
      v_product_name,
      v_quantity,
      v_unit_price,
      v_unit_price * v_quantity,
      v_unit_price * v_quantity * v_rate,
      v_order.payment_method,
      v_order.customer_name,
      v_order.customer_phone,
      FALSE,
      'confirmed',
      v_order.notes
    )
    RETURNING id INTO v_sale_id;

    -- Record in ledger
    PERFORM public.create_ledger_entry(
      v_order.user_id, -- admin user
      'credit',
      v_unit_price * v_quantity,
      v_unit_price * v_quantity * v_rate,
      'sale',
      v_sale_id,
      'Venta registrada (Pedido #' || substring(v_order.id::text from 1 for 8) || ')'
    );
  END LOOP;

  -- Update order status
  UPDATE public.orders
  SET 
    status = 'confirmed',
    payment_status = 'paid',
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;

-- 6. Create reject_order function
CREATE OR REPLACE FUNCTION public.reject_order(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status != 'pending' THEN
    RAISE EXCEPTION 'Only pending orders can be rejected';
  END IF;

  UPDATE public.orders
  SET 
    status = 'cancelled',
    payment_status = 'failed',
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;
