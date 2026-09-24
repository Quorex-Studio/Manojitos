-- process_checkout final: precio tomado de la DB (anti price-injection), SECURITY DEFINER,
-- search_path fijo, tasa USD y costo de delivery (p_delivery_fee, usado por el frontend).
-- Consolida 20260710_001 + 20260715190246 del proyecto original.
DROP FUNCTION IF EXISTS public.process_checkout(public.order_item_input[], text, text, text, text, numeric);
DROP FUNCTION IF EXISTS public.process_checkout(public.order_item_input[], text, text, text, text, numeric, text, text);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0);

CREATE FUNCTION public.process_checkout(
    items public.order_item_input[],
    payment_method text,
    client_name text,
    client_phone text,
    notes text DEFAULT NULL,
    total_bs_rate numeric DEFAULT NULL,
    p_banco_origen text DEFAULT NULL,
    p_numero_referencia text DEFAULT NULL,
    p_delivery_fee numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_customer_user_id UUID;
  v_admin_user_id UUID;
  v_item public.order_item_input;
  v_product_stock INTEGER;
  v_image_url TEXT;
  v_product_price DECIMAL(10,2);
  v_order_id UUID;
  v_subtotal_usd DECIMAL(10,2) := 0;
  v_total_amount_usd DECIMAL(10,2);
  v_delivery_fee DECIMAL(10,2) := GREATEST(COALESCE(p_delivery_fee, 0), 0);
  v_current_item_total DECIMAL(10,2);
  v_rate DECIMAL(15,4);
  v_items_jsonb JSONB := '[]'::jsonb;
  v_customer_email TEXT;
BEGIN
  v_customer_user_id := auth.uid();
  IF v_customer_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_customer_email FROM auth.users WHERE id = v_customer_user_id;

  SELECT rate INTO v_rate FROM public.exchange_rates WHERE currency = 'USD' ORDER BY created_at DESC LIMIT 1;
  IF v_rate IS NULL THEN
     v_rate := COALESCE(total_bs_rate, 1);
  END IF;

  FOREACH v_item IN ARRAY items
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_item.name;
    END IF;

    SELECT stock, user_id, image_url, price_usd INTO v_product_stock, v_admin_user_id, v_image_url, v_product_price
    FROM public.products WHERE id = v_item.id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID % not found', v_item.id;
    END IF;
    IF v_product_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Requested: %, Available: %)', v_item.name, v_item.quantity, v_product_stock;
    END IF;
    IF v_item.price_usd != v_product_price THEN
      RAISE EXCEPTION 'Price mismatch for product % (Client: %, DB: %)', v_item.name, v_item.price_usd, v_product_price;
    END IF;

    v_current_item_total := v_product_price * v_item.quantity;
    v_subtotal_usd := v_subtotal_usd + v_current_item_total;

    v_items_jsonb := v_items_jsonb || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_item.id, 'product_name', v_item.name, 'quantity', v_item.quantity,
        'unit_price', v_product_price, 'total', v_current_item_total, 'image_url', v_image_url
      )
    );
  END LOOP;

  v_total_amount_usd := v_subtotal_usd + v_delivery_fee;

  IF v_admin_user_id IS NULL THEN
    SELECT id INTO v_admin_user_id FROM auth.users WHERE (raw_app_meta_data->>'is_super_admin')::boolean = true LIMIT 1;
    IF v_admin_user_id IS NULL THEN
      v_admin_user_id := v_customer_user_id;
    END IF;
  END IF;

  INSERT INTO public.orders (
    user_id, customer_user_id, customer_name, customer_phone, customer_email, items,
    subtotal, discount, delivery_fee, total_usd, total_bs, status, payment_method, payment_status, notes,
    banco_origen, numero_referencia
  )
  VALUES (
    v_admin_user_id, v_customer_user_id, client_name, client_phone, v_customer_email, v_items_jsonb,
    v_subtotal_usd, 0, v_delivery_fee, v_total_amount_usd, v_total_amount_usd * v_rate, 'pending', payment_method, 'pending', notes,
    p_banco_origen, p_numero_referencia
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'sale_ids', array_to_json(ARRAY[v_order_id]::UUID[])::jsonb,
    'total_usd', v_total_amount_usd,
    'exchange_rate_used', v_rate
  );
END;
$function$;
