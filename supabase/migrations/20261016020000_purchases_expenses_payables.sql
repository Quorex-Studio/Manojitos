-- Compras con productos que alimentan el inventario, gastos con categorías y cuentas por pagar.
-- Se puede reaplicar. Solo la administración ve y escribe (is_admin()).
-- El costo de los productos NO se modifica: el costo de cada compra queda en sus líneas.

-- ── 1. Compras: desglose, método de pago y saldo por pagar ──
alter table public.purchases add column if not exists subtotal_usd numeric(12,2);
alter table public.purchases add column if not exists tax_pct numeric(5,2) not null default 0;
alter table public.purchases add column if not exists tax_usd numeric(12,2) not null default 0;
alter table public.purchases add column if not exists shipping_usd numeric(12,2) not null default 0;
alter table public.purchases add column if not exists payment_method text;
alter table public.purchases add column if not exists amount_paid numeric(12,2) not null default 0;
alter table public.purchases add column if not exists due_date date;

-- Compras viejas: las pagadas quedan saldadas
update public.purchases set amount_paid = amount_usd where status = 'paid' and amount_paid = 0;

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null check (length(trim(product_name)) between 1 and 200),
  variant_label text,
  quantity integer not null check (quantity > 0),
  -- Costo neto por unidad (lo que cobró el proveedor, sin impuesto ni envío)
  unit_cost_usd numeric(12,4) not null check (unit_cost_usd >= 0),
  -- Costo por unidad con su parte del impuesto y el envío
  landed_unit_cost_usd numeric(12,4) not null check (landed_unit_cost_usd >= 0),
  created_at timestamptz not null default now()
);
create index if not exists purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index if not exists purchase_items_product_idx on public.purchase_items (product_id);
alter table public.purchase_items enable row level security;

create table if not exists public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  amount_bs numeric(14,2),
  payment_method text not null,
  notes text,
  paid_at timestamptz not null default now(),
  user_id uuid not null default auth.uid()
);
create index if not exists purchase_payments_purchase_idx on public.purchase_payments (purchase_id);
alter table public.purchase_payments enable row level security;

-- ── 2. Gastos y sus categorías ──
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists expense_categories_name_key on public.expense_categories (lower(name));
alter table public.expense_categories enable row level security;

insert into public.expense_categories (name, sort_order)
select v.name, v.ord from (values
  ('Alquiler', 1), ('Servicios (luz, agua, internet)', 2), ('Nómina y comisiones', 3), ('Publicidad y redes', 4),
  ('Envíos y transporte', 5), ('Empaques y bolsas', 6), ('Comisiones bancarias', 7), ('Impuestos y trámites', 8), ('Otros', 99)
) as v(name, ord)
where not exists (select 1 from public.expense_categories);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.expense_categories(id) on delete set null,
  description text not null check (length(trim(description)) between 1 and 200),
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  amount_bs numeric(14,2),
  payment_method text,
  expense_date date not null default current_date,
  -- pagado o por pagar (cuentas por pagar)
  status text not null default 'paid' check (status in ('paid', 'pending')),
  due_date date,
  paid_at timestamptz,
  provider_id uuid references public.providers(id) on delete set null,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses (expense_date desc);
alter table public.expenses enable row level security;

-- ── 3. Permisos: solo administración ──
do $$
declare t text;
begin
  foreach t in array array['purchase_items', 'purchase_payments', 'expense_categories', 'expenses'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'Solo administración') then
      execute format('create policy "Solo administración" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    end if;
  end loop;
  if not exists (select 1 from pg_policies where tablename = 'purchases' and policyname = 'Administración gestiona compras') then
    create policy "Administración gestiona compras" on public.purchases for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
grant select, insert, update, delete on public.purchase_items, public.purchase_payments, public.expense_categories, public.expenses to authenticated;

-- ── 4. Registrar una compra con sus productos (atómico) ──
-- p_purchase: {provider_id, provider_name, purchase_date, tax_pct, shipping_usd, payment_method,
--              amount_paid, due_date, notes, rate}
-- p_items:    [{product_id, variant_id, product_name, variant_label, quantity, unit_cost_usd}]
-- Suma las unidades al inventario (apply_stock_change), reparte impuesto y envío en el costo
-- por unidad de cada línea y deja el saldo por pagar si no se pagó completa.
create or replace function public.register_purchase(p_purchase jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_subtotal numeric := 0;
  v_tax_pct numeric := greatest(coalesce((p_purchase->>'tax_pct')::numeric, 0), 0);
  v_shipping numeric := greatest(coalesce((p_purchase->>'shipping_usd')::numeric, 0), 0);
  v_tax numeric;
  v_total numeric;
  v_paid numeric;
  v_rate numeric := nullif((p_purchase->>'rate')::numeric, 0);
  v_item jsonb;
  v_qty integer;
  v_cost numeric;
  v_factor numeric;
  v_units integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Solo la administración registra compras';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La compra necesita al menos un producto';
  end if;
  if coalesce(trim(p_purchase->>'provider_name'), '') = '' then
    raise exception 'Falta el proveedor';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    v_cost := (v_item->>'unit_cost_usd')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Cantidad inválida en %', v_item->>'product_name'; end if;
    if v_cost is null or v_cost < 0 then raise exception 'Costo inválido en %', v_item->>'product_name'; end if;
    v_subtotal := v_subtotal + v_qty * v_cost;
    v_units := v_units + v_qty;
  end loop;

  v_tax := round(v_subtotal * v_tax_pct / 100, 2);
  v_total := round(v_subtotal + v_tax + v_shipping, 2);
  if v_total <= 0 then raise exception 'El total de la compra debe ser mayor a cero'; end if;
  v_paid := least(greatest(coalesce((p_purchase->>'amount_paid')::numeric, v_total), 0), v_total);
  -- Factor para repartir impuesto y envío en proporción al costo de cada línea
  v_factor := case when v_subtotal > 0 then v_total / v_subtotal else 1 end;

  insert into public.purchases (provider_id, provider_name, amount_usd, amount_bs, purchase_date, status, notes, user_id,
    subtotal_usd, tax_pct, tax_usd, shipping_usd, payment_method, amount_paid, due_date, paid_at)
  values (
    nullif(p_purchase->>'provider_id', '')::uuid,
    trim(p_purchase->>'provider_name'),
    v_total,
    case when v_rate is not null then round(v_total * v_rate, 2) end,
    coalesce(nullif(p_purchase->>'purchase_date', '')::date, current_date),
    case when v_paid >= v_total - 0.005 then 'paid' else 'pending' end,
    nullif(trim(coalesce(p_purchase->>'notes', '')), ''),
    auth.uid(),
    round(v_subtotal, 2), v_tax_pct, v_tax, v_shipping,
    nullif(p_purchase->>'payment_method', ''),
    v_paid,
    nullif(p_purchase->>'due_date', '')::date,
    case when v_paid >= v_total - 0.005 then now() end
  )
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    v_cost := (v_item->>'unit_cost_usd')::numeric;
    insert into public.purchase_items (purchase_id, product_id, variant_id, product_name, variant_label, quantity, unit_cost_usd, landed_unit_cost_usd)
    values (v_id, nullif(v_item->>'product_id', '')::uuid, nullif(v_item->>'variant_id', '')::uuid,
      trim(v_item->>'product_name'), nullif(v_item->>'variant_label', ''), v_qty, v_cost,
      round(case when v_subtotal > 0 then v_cost * v_factor else v_total / v_units end, 4));
    -- Entra al inventario (a la variante si el producto tiene tallas, tonos o presentaciones)
    perform public.apply_stock_change(nullif(v_item->>'product_id', '')::uuid, nullif(v_item->>'variant_id', '')::uuid, v_qty, v_item->>'product_name');
  end loop;

  if v_paid > 0 then
    insert into public.purchase_payments (purchase_id, amount_usd, amount_bs, payment_method, notes)
    values (v_id, v_paid, case when v_rate is not null then round(v_paid * v_rate, 2) end,
      coalesce(nullif(p_purchase->>'payment_method', ''), 'efectivo_usd'), 'Pago al registrar la compra');
  end if;

  return jsonb_build_object('id', v_id, 'total_usd', v_total, 'paid_usd', v_paid, 'units', v_units);
end;
$$;
revoke execute on function public.register_purchase(jsonb, jsonb) from public, anon;
grant execute on function public.register_purchase(jsonb, jsonb) to authenticated;

-- ── 5. Abonar a una compra por pagar ──
create or replace function public.pay_purchase(p_purchase_id uuid, p_amount_usd numeric, p_amount_bs numeric, p_payment_method text, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.purchases%rowtype;
  v_amount numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo la administración registra pagos';
  end if;
  select * into v_p from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'Compra no encontrada'; end if;
  v_amount := round(coalesce(p_amount_usd, 0), 2);
  if v_amount <= 0 then raise exception 'El pago debe ser mayor a cero'; end if;
  if v_amount > round(v_p.amount_usd - v_p.amount_paid, 2) + 0.005 then
    raise exception 'El pago (%) es mayor que el saldo (%)', v_amount, round(v_p.amount_usd - v_p.amount_paid, 2);
  end if;
  insert into public.purchase_payments (purchase_id, amount_usd, amount_bs, payment_method, notes)
  values (p_purchase_id, v_amount, nullif(p_amount_bs, 0), coalesce(nullif(p_payment_method, ''), 'efectivo_usd'), nullif(trim(coalesce(p_notes, '')), ''));
  update public.purchases
  set amount_paid = round(amount_paid + v_amount, 2),
      status = case when amount_paid + v_amount >= amount_usd - 0.005 then 'paid' else 'pending' end,
      paid_at = case when amount_paid + v_amount >= amount_usd - 0.005 then now() else paid_at end
  where id = p_purchase_id;
  return jsonb_build_object('success', true, 'balance_usd', round(v_p.amount_usd - v_p.amount_paid - v_amount, 2));
end;
$$;
revoke execute on function public.pay_purchase(uuid, numeric, numeric, text, text) from public, anon;
grant execute on function public.pay_purchase(uuid, numeric, numeric, text, text) to authenticated;

-- ── 6. Borrar una compra: devuelve al proveedor las unidades que había sumado al inventario ──
create or replace function public.delete_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_units integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Solo la administración borra compras';
  end if;
  perform 1 from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'Compra no encontrada'; end if;
  for v_item in select * from public.purchase_items where purchase_id = p_purchase_id loop
    -- Falla si ya se vendieron (no hay stock suficiente para descontarlas)
    perform public.apply_stock_change(v_item.product_id, v_item.variant_id, -v_item.quantity, v_item.product_name);
    v_units := v_units + v_item.quantity;
  end loop;
  delete from public.purchases where id = p_purchase_id;
  return jsonb_build_object('success', true, 'units_removed', v_units);
end;
$$;
revoke execute on function public.delete_purchase(uuid) from public, anon;
grant execute on function public.delete_purchase(uuid) to authenticated;
