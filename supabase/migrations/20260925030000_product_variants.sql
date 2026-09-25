-- Variantes de producto con stock propio: tallas (S, M…), tonos (120 Classic Ivory…) o
-- presentaciones (30 ml, 50 ml). Cada variante tiene sus unidades y, si hace falta, su precio.
--
-- Reglas:
--   * products.stock = suma del stock de sus variantes y products.sizes = sus etiquetas
--     (lo mantiene un trigger; el resto de la app sigue leyendo products.stock).
--   * Un producto con variantes no acepta cambios directos de stock: toda venta, pedido o
--     devolución pasa por apply_stock_change() indicando la variante.
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 40),
  stock integer not null default 0 check (stock >= 0),
  price_usd numeric(10,2) check (price_usd is null or price_usd >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_variants_label_key on public.product_variants (product_id, lower(label));
create index if not exists product_variants_product_idx on public.product_variants (product_id);

alter table public.product_variants enable row level security;

drop policy if exists "Variantes visibles para todos" on public.product_variants;
create policy "Variantes visibles para todos" on public.product_variants for select using (true);
drop policy if exists "Solo admin crea variantes" on public.product_variants;
create policy "Solo admin crea variantes" on public.product_variants for insert to authenticated with check (public.is_admin());
drop policy if exists "Solo admin edita variantes" on public.product_variants;
create policy "Solo admin edita variantes" on public.product_variants for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Solo admin borra variantes" on public.product_variants;
create policy "Solo admin borra variantes" on public.product_variants for delete to authenticated using (public.is_admin());

grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;

-- Qué variante se vendió (el nombre de la línea ya la incluye, p. ej. "Base (Tono: 120)")
alter table public.sales add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
alter table public.sales add column if not exists variant_label text;

-- El checkout envía la variante de cada ítem
alter type public.order_item_input add attribute variant_id uuid;

-- ── Sincronización producto ← variantes ──
create or replace function public.sync_product_from_variants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  if tg_op = 'UPDATE' and new.product_id is distinct from old.product_id then
    raise exception 'Una variante no puede cambiar de producto';
  end if;
  perform set_config('app.variant_sync', 'on', true);
  update public.products p
  set stock = coalesce((select sum(v.stock) from public.product_variants v where v.product_id = v_product), 0),
      sizes = (select array_agg(v.label order by v.sort_order, v.created_at) from public.product_variants v where v.product_id = v_product),
      updated_at = now()
  where p.id = v_product;
  perform set_config('app.variant_sync', 'off', true);
  return null;
end;
$$;

drop trigger if exists product_variants_sync on public.product_variants;
create trigger product_variants_sync
  after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_from_variants();

create or replace function public.guard_variant_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.variant_sync', true), 'off') <> 'on'
     and exists (select 1 from public.product_variants where product_id = new.id) then
    raise exception '% tiene tallas, tonos o presentaciones: ajusta el stock de cada una', new.name
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_variant_stock on public.products;
create trigger products_guard_variant_stock
  before update of stock on public.products
  for each row execute function public.guard_variant_stock();

-- ── Único punto para mover stock (ventas, pedidos, devoluciones) ──
create or replace function public.apply_stock_change(p_product_id uuid, p_variant_id uuid, p_delta integer, p_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_variant_label text;
begin
  if p_product_id is null or coalesce(p_delta, 0) = 0 then
    return;
  end if;
  if exists (select 1 from public.product_variants where product_id = p_product_id) then
    if p_variant_id is null then
      raise exception '% tiene varias opciones (talla, tono o presentación): indica cuál', p_label using errcode = 'P0001';
    end if;
    select stock, label into v_stock, v_variant_label from public.product_variants
    where id = p_variant_id and product_id = p_product_id for update;
    if not found then
      raise exception 'La opción elegida de % ya no existe', p_label using errcode = 'P0001';
    end if;
    if v_stock + p_delta < 0 then
      raise exception 'Stock insuficiente para % (%): disponible %, requerido %', p_label, v_variant_label, v_stock, -p_delta using errcode = 'P0001';
    end if;
    update public.product_variants set stock = stock + p_delta, updated_at = now() where id = p_variant_id;
  else
    select stock into v_stock from public.products where id = p_product_id for update;
    if not found then
      return;
    end if;
    if v_stock + p_delta < 0 then
      raise exception 'Stock insuficiente para % (disponible: %, requerido: %)', p_label, v_stock, -p_delta using errcode = 'P0001';
    end if;
    update public.products set stock = stock + p_delta, updated_at = now() where id = p_product_id;
  end if;
end;
$$;

revoke execute on function public.apply_stock_change(uuid, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.sync_product_from_variants() from public, anon, authenticated;
revoke execute on function public.guard_variant_stock() from public, anon, authenticated;

-- ── Checkout: valida stock y precio de la variante ──
create or replace function public.process_checkout(items order_item_input[], payment_method text, client_name text, client_phone text, notes text default null::text, total_bs_rate numeric default null::numeric, p_banco_origen text default null::text, p_numero_referencia text default null::text, p_delivery_fee numeric default 0)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_customer_user_id UUID;
  v_admin_user_id UUID;
  v_item public.order_item_input;
  v_product_stock INTEGER;
  v_image_url TEXT;
  v_product_price DECIMAL(10,2);
  v_variant_label TEXT;
  v_has_variants BOOLEAN;
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

    v_variant_label := NULL;
    SELECT EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = v_item.id) INTO v_has_variants;
    IF v_has_variants THEN
      IF v_item.variant_id IS NULL THEN
        RAISE EXCEPTION 'Elige la talla, el tono o la presentación de %', v_item.name;
      END IF;
      SELECT v.stock, COALESCE(v.price_usd, v_product_price), v.label INTO v_product_stock, v_product_price, v_variant_label
      FROM public.product_variants v WHERE v.id = v_item.variant_id AND v.product_id = v_item.id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'La opción elegida de % ya no está disponible', v_item.name;
      END IF;
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
        'unit_price', v_product_price, 'total', v_current_item_total, 'image_url', v_image_url,
        'variant_id', v_item.variant_id, 'variant_label', v_variant_label
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

-- ── Confirmar pedido: descuenta la variante ──
create or replace function public.confirm_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_order RECORD;
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC;
  v_product_name TEXT;
  v_rate NUMERIC;
  v_sale_id UUID;
  v_sale_group_id UUID;
  v_items_total NUMERIC;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol de administrador.';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status != 'pending' THEN
    RAISE EXCEPTION 'Order is not in pending status (Current: %)', v_order.status;
  END IF;
  v_rate := COALESCE(v_order.total_bs / NULLIF(v_order.total_usd, 0), 1);
  v_sale_group_id := gen_random_uuid();
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_product_name := v_item->>'product_name';
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_product_id) THEN
      RAISE EXCEPTION 'Product with ID % not found', v_product_id;
    END IF;
    -- Valida y descuenta (producto o variante); si falta stock, todo el pedido se revierte
    PERFORM public.apply_stock_change(v_product_id, v_variant_id, -v_quantity, v_product_name);
    UPDATE public.products SET sold_count = sold_count + v_quantity, updated_at = now() WHERE id = v_product_id;
    INSERT INTO public.sales (
      user_id, product_id, product_name, quantity, unit_price_usd, total_usd, total_bs,
      payment_method, client_name, client_phone, is_credit, status, notes, sale_group_id, sale_modality, amount_paid, customer_user_id,
      variant_id, variant_label
    )
    VALUES (
      v_order.customer_user_id, v_product_id, v_product_name, v_quantity, v_unit_price,
      v_unit_price * v_quantity, v_unit_price * v_quantity * v_rate,
      v_order.payment_method, v_order.customer_name, v_order.customer_phone, FALSE, 'confirmed', v_order.notes,
      v_sale_group_id, 'contado', v_unit_price * v_quantity, v_order.customer_user_id,
      v_variant_id, v_item->>'variant_label'
    )
    RETURNING id INTO v_sale_id;
    PERFORM public.create_ledger_entry(
      v_order.user_id, 'credit', v_unit_price * v_quantity, v_unit_price * v_quantity * v_rate,
      'sale', v_sale_id, 'Venta registrada (Pedido #' || substring(v_order.id::text from 1 for 8) || ')'
    );
  END LOOP;
  -- El pago del grupo cubre los productos; el delivery se cobra aparte (orders.delivery_fee)
  v_items_total := v_order.total_usd - COALESCE(v_order.delivery_fee, 0);
  IF v_items_total > 0 THEN
    INSERT INTO public.sale_payments (sale_group_id, amount_usd, amount_bs, exchange_rate, payment_method, notes)
    VALUES (v_sale_group_id, v_items_total, v_items_total * v_rate, v_rate,
      COALESCE(v_order.payment_method, 'efectivo_usd'), 'Pago de Pedido #' || substring(v_order.id::text from 1 for 8));
  END IF;
  UPDATE public.orders SET status = 'confirmed', payment_status = 'paid', updated_at = now() WHERE id = p_order_id;
END;
$function$;

-- ── Venta de mostrador: descuenta la variante ──
create or replace function public.confirm_pos_sale(p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_sale    RECORD;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol de administrador para confirmar ventas.';
  END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada: %', p_sale_id;
  END IF;
  IF v_sale.status != 'pending' THEN
    RAISE EXCEPTION 'La venta ya fue procesada (estado actual: %)', v_sale.status;
  END IF;
  UPDATE public.sales SET status = 'confirmed' WHERE id = p_sale_id;
  IF v_sale.product_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.products WHERE id = v_sale.product_id) THEN
    PERFORM public.apply_stock_change(v_sale.product_id, v_sale.variant_id, -v_sale.quantity, v_sale.product_name);
    UPDATE public.products SET sold_count = sold_count + v_sale.quantity, updated_at = now() WHERE id = v_sale.product_id;
  END IF;
  IF COALESCE(v_sale.amount_paid, 0) > 0 THEN
    INSERT INTO public.sale_payments (sale_id, sale_group_id, amount_usd, amount_bs, exchange_rate, payment_method, notes)
    VALUES (
      p_sale_id, v_sale.sale_group_id, v_sale.amount_paid,
      COALESCE(v_sale.total_bs * (v_sale.amount_paid / NULLIF(v_sale.total_usd, 0)), 0),
      COALESCE(v_sale.total_bs / NULLIF(v_sale.total_usd, 0), 1),
      COALESCE(v_sale.payment_method, 'efectivo_usd'),
      'Pago inicial (POS)'
    );
  END IF;
  PERFORM public.create_ledger_entry(
    v_sale.user_id, 'credit', v_sale.total_usd, v_sale.total_bs, 'sale', p_sale_id,
    'Venta POS confirmada - ' || COALESCE(v_sale.client_name, 'Cliente'),
    jsonb_build_object('payment_method', v_sale.payment_method)
  );
  RETURN jsonb_build_object('success', true, 'sale_id', p_sale_id, 'status', 'confirmed');
END;
$function$;

-- ── Devoluciones: reponen la variante ──
create or replace function public.process_sale_return(p_sale_group_id uuid, p_items jsonb, p_return_type text, p_reason text default null::text, p_idempotency_key text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
    v_user_id        uuid;
    v_return_id      uuid;
    v_existing       public.sale_returns%ROWTYPE;
    v_item           jsonb;
    v_sale_id        uuid;
    v_qty            integer;
    v_sale           public.sales%ROWTYPE;
    v_returnable     integer;
    v_amount         numeric;
    v_frac           numeric;
    v_new_total_usd  numeric;
    v_new_total_bs   numeric;
    v_total_returned numeric := 0;
    v_valid_payments numeric;
    v_group_total    numeric;
    v_refund_due     numeric;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
    END IF;
    IF p_return_type NOT IN ('anulacion','devolucion_total','devolucion_parcial') THEN
        RAISE EXCEPTION 'Tipo de devolución inválido: %', p_return_type;
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Debe indicar al menos un ítem a devolver';
    END IF;
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.sale_returns WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object('success', true, 'idempotent', true, 'return_id', v_existing.id,
                'total_usd', v_existing.total_usd, 'refund_due_usd', v_existing.refund_due_usd);
        END IF;
    END IF;
    PERFORM 1 FROM public.sales WHERE sale_group_id = p_sale_group_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontraron ventas para el grupo %', p_sale_group_id;
    END IF;
    INSERT INTO public.sale_returns (sale_group_id, return_type, reason, created_by, idempotency_key)
    VALUES (p_sale_group_id, p_return_type, p_reason, v_user_id, p_idempotency_key)
    RETURNING id INTO v_return_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_sale_id := (v_item->>'sale_id')::uuid;
        v_qty     := (v_item->>'quantity')::integer;
        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'Cantidad inválida en ítem (%): debe ser > 0', v_item;
        END IF;
        SELECT * INTO v_sale FROM public.sales WHERE id = v_sale_id AND sale_group_id = p_sale_group_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La línea % no pertenece al grupo %', v_sale_id, p_sale_group_id;
        END IF;
        v_returnable := v_sale.quantity - v_sale.returned_quantity;
        IF v_qty > v_returnable THEN
            RAISE EXCEPTION 'No se pueden devolver % unidades de la línea %: sólo quedan % devolvibles', v_qty, v_sale_id, v_returnable;
        END IF;
        v_frac          := v_qty::numeric / v_returnable::numeric;
        v_amount        := round(v_sale.total_usd * v_frac, 2);
        v_new_total_usd := v_sale.total_usd - v_amount;
        v_new_total_bs  := round(COALESCE(v_sale.total_bs, 0) * (1 - v_frac), 2);
        UPDATE public.sales
        SET total_usd = v_new_total_usd, total_bs = v_new_total_bs,
            returned_quantity = v_sale.returned_quantity + v_qty,
            returned_at = CASE WHEN (v_sale.returned_quantity + v_qty) >= v_sale.quantity THEN now() ELSE returned_at END
        WHERE id = v_sale_id;
        IF v_sale.product_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.products WHERE id = v_sale.product_id) THEN
            PERFORM public.apply_stock_change(v_sale.product_id, v_sale.variant_id, v_qty, v_sale.product_name);
            UPDATE public.products
            SET sold_count = GREATEST(0, COALESCE(sold_count, 0) - v_qty), updated_at = now()
            WHERE id = v_sale.product_id;
        END IF;
        INSERT INTO public.sale_return_items (return_id, sale_id, product_id, quantity, amount_usd)
        VALUES (v_return_id, v_sale_id, v_sale.product_id, v_qty, v_amount);
        v_total_returned := v_total_returned + v_amount;
    END LOOP;
    PERFORM public.recalculate_sale_group(p_sale_group_id);
    SELECT COALESCE(SUM(amount_usd), 0) INTO v_valid_payments FROM public.sale_payments
    WHERE (sale_group_id = p_sale_group_id OR sale_id IN (SELECT id FROM public.sales WHERE sale_group_id = p_sale_group_id))
      AND status = 'valid';
    SELECT COALESCE(SUM(total_usd), 0) INTO v_group_total FROM public.sales WHERE sale_group_id = p_sale_group_id;
    v_refund_due := GREATEST(0, round(v_valid_payments - v_group_total, 2));
    UPDATE public.sale_returns SET total_usd = v_total_returned, refund_due_usd = v_refund_due WHERE id = v_return_id;
    PERFORM public.log_audit_event(v_user_id, 'SALE_RETURN', 'sale_group', p_sale_group_id,
        jsonb_build_object('return_id', v_return_id, 'return_type', p_return_type, 'reason', p_reason,
            'total_returned_usd', v_total_returned, 'refund_due_usd', v_refund_due, 'items', p_items),
        NULL, NULL);
    RETURN jsonb_build_object('success', true, 'idempotent', false, 'return_id', v_return_id,
        'total_usd', v_total_returned, 'refund_due_usd', v_refund_due, 'refund_supported', false);
END;
$function$;
