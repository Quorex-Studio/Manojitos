-- Migration to normalize Contado -> Abono historical payments
-- Objective: Ensure all initial payments in `sales` have a backing `sale_payments` record.

-- 1. Update `confirm_order` to generate sale_group_id, set amount_paid, and insert sale_payments record
CREATE OR REPLACE FUNCTION public.confirm_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_sale_group_id UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol de administrador.';
  END IF;

  -- Lock the order row
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status != 'pending' THEN
    RAISE EXCEPTION 'Order is not in pending status (Current: %)', v_order.status;
  END IF;

  v_rate := COALESCE(v_order.total_bs / NULLIF(v_order.total_usd, 0), 1);
  v_sale_group_id := gen_random_uuid(); -- Generate single group id for the entire order

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
      notes,
      sale_group_id,
      sale_modality,
      amount_paid
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
      v_order.notes,
      v_sale_group_id,
      'contado',
      v_unit_price * v_quantity
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

  -- Insert sale_payments record for the entire order
  IF v_order.total_usd > 0 THEN
    INSERT INTO public.sale_payments (
      sale_group_id, amount_usd, amount_bs, exchange_rate, payment_method, notes
    ) VALUES (
      v_sale_group_id, v_order.total_usd, v_order.total_bs, v_rate, COALESCE(v_order.payment_method, 'efectivo_usd'), 'Pago de Pedido #' || substring(v_order.id::text from 1 for 8)
    );
  END IF;

  -- Update order status
  UPDATE public.orders
  SET 
    status = 'confirmed',
    payment_status = 'paid',
    updated_at = now()
  WHERE id = p_order_id;
END;
$function$;


-- 2. Update `confirm_pos_sale` to insert `sale_payments` if there is an initial payment
CREATE OR REPLACE FUNCTION public.confirm_pos_sale(p_sale_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale    RECORD;
  v_product RECORD;
BEGIN
  -- 1. Autorizar
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol de administrador para confirmar ventas.';
  END IF;

  -- 2. Bloquear la venta (evitar doble confirmacion)
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada: %', p_sale_id;
  END IF;

  IF v_sale.status != 'pending' THEN
    RAISE EXCEPTION 'La venta ya fue procesada (estado actual: %)', v_sale.status;
  END IF;

  -- 3. Actualizar estado de la venta
  UPDATE public.sales
  SET status = 'confirmed'
  WHERE id = p_sale_id;

  -- 4. Descontar stock y actualizar sold_count atomicamente (si hay producto asociado)
  IF v_sale.product_id IS NOT NULL THEN
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_sale.product_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_product.stock < v_sale.quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para % (disponible: %, requerido: %)',
          v_sale.product_name, v_product.stock, v_sale.quantity;
      END IF;

      UPDATE public.products
      SET
        stock      = stock - v_sale.quantity,
        sold_count = sold_count + v_sale.quantity,
        updated_at = now()
      WHERE id = v_sale.product_id;
    END IF;
  END IF;

  -- 5. Insertar pago inicial en sale_payments
  IF COALESCE(v_sale.amount_paid, 0) > 0 THEN
    INSERT INTO public.sale_payments (
      sale_id, sale_group_id, amount_usd, amount_bs, exchange_rate, payment_method, notes
    ) VALUES (
      p_sale_id, v_sale.sale_group_id, v_sale.amount_paid, 
      COALESCE(v_sale.total_bs * (v_sale.amount_paid / NULLIF(v_sale.total_usd, 0)), 0), 
      COALESCE(v_sale.total_bs / NULLIF(v_sale.total_usd, 0), 1), 
      COALESCE(v_sale.payment_method, 'efectivo_usd'), 
      'Pago inicial (POS)'
    );
  END IF;

  -- 6. Registrar en ledger
  PERFORM public.create_ledger_entry(
    v_sale.user_id,
    'credit',
    v_sale.total_usd,
    v_sale.total_bs,
    'sale',
    p_sale_id,
    'Venta POS confirmada - ' || COALESCE(v_sale.client_name, 'Cliente'),
    jsonb_build_object('payment_method', v_sale.payment_method)
  );

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'status',  'confirmed'
  );
END;
$function$;

-- 3. Backfill missing `sale_payments` for existing Contado sales
INSERT INTO public.sale_payments (
    sale_group_id, sale_id, amount_usd, amount_bs, exchange_rate, payment_method, status, notes, created_at
)
SELECT 
    s.sale_group_id, s.id, s.amount_paid,
    COALESCE(s.total_bs * (s.amount_paid / NULLIF(s.total_usd, 0)), 0),
    COALESCE(s.total_bs / NULLIF(s.total_usd, 0), 1),
    COALESCE(s.payment_method, 'efectivo_usd'),
    'valid', 'Pago inicial automático (backfill contado)', s.created_at
FROM public.sales s
WHERE s.amount_paid > 0 
AND NOT EXISTS (
    SELECT 1 FROM public.sale_payments sp 
    WHERE sp.sale_group_id = s.sale_group_id AND sp.status = 'valid'
);
