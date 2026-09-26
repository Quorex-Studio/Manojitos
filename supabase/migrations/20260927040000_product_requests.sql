-- "Lo quiero": clientas piden un producto agotado; la dueña ve las solicitudes en el panel
-- (/solicitudes) y, cuando repone el stock, a quienes tienen cuenta les llega el aviso solo.
create table if not exists public.product_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 30),
  email text check (email is null or char_length(email) <= 200),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'notified', 'closed')),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists product_requests_product_idx on public.product_requests (product_id, status);
-- Una solicitud pendiente por persona y producto
create unique index if not exists product_requests_user_pending_idx
  on public.product_requests (product_id, user_id) where status = 'pending' and user_id is not null;
create unique index if not exists product_requests_phone_pending_idx
  on public.product_requests (product_id, phone) where status = 'pending' and user_id is null and phone is not null;

alter table public.product_requests enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'product_requests' and policyname = 'Admins manage product requests') then
    create policy "Admins manage product requests" on public.product_requests
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_requests' and policyname = 'Users see own product requests') then
    create policy "Users see own product requests" on public.product_requests
      for select using (user_id = auth.uid());
  end if;
end $$;

-- Solo se crea por la función (valida el producto, evita duplicados y avisa a la dueña)
create or replace function public.request_product(p_product_id uuid, p_name text default null, p_phone text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_product record;
  v_profile record;
  v_name text;
  v_phone text;
  v_email text;
  v_id uuid;
  v_count int;
begin
  select id, name, stock into v_product from public.products where id = p_product_id;
  if not found then raise exception 'Producto no encontrado'; end if;

  if v_uid is not null then
    select full_name, phone, email into v_profile from public.customer_profiles where user_id = v_uid;
    v_name := coalesce(nullif(trim(v_profile.full_name), ''), nullif(trim(p_name), ''));
    v_phone := coalesce(nullif(trim(v_profile.phone), ''), nullif(trim(p_phone), ''));
    select email into v_email from auth.users where id = v_uid;
    if exists (select 1 from public.product_requests where product_id = p_product_id and user_id = v_uid and status = 'pending') then
      return jsonb_build_object('ok', true, 'already', true);
    end if;
  else
    v_name := nullif(trim(p_name), '');
    v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
    if v_name is null or v_phone is null or length(regexp_replace(v_phone, '\D', '', 'g')) < 10 then
      raise exception 'Escribe tu nombre y tu teléfono para avisarte';
    end if;
    if exists (select 1 from public.product_requests where product_id = p_product_id and user_id is null and phone = v_phone and status = 'pending') then
      return jsonb_build_object('ok', true, 'already', true);
    end if;
    -- Freno a abusos: máximo 10 solicitudes de invitada por teléfono al día
    if (select count(*) from public.product_requests where phone = v_phone and created_at > now() - interval '1 day') >= 10 then
      raise exception 'Ya enviaste muchas solicitudes hoy';
    end if;
  end if;

  insert into public.product_requests (product_id, user_id, name, phone, email, note)
  values (p_product_id, v_uid, coalesce(v_name, 'Clienta'), left(v_phone, 30), left(v_email, 200), left(nullif(trim(p_note), ''), 300))
  returning id into v_id;

  select count(*) into v_count from public.product_requests where product_id = p_product_id and status = 'pending';

  insert into public.notifications (user_id, title, message, type, metadata)
  select u.id,
         'Quieren un producto agotado',
         format('%s quiere «%s»%s. Ya son %s %s.', coalesce(v_name, 'Una clienta'), v_product.name,
                case when nullif(trim(p_note), '') is not null then format(' (%s)', left(trim(p_note), 120)) else '' end,
                v_count, case when v_count = 1 then 'solicitud' else 'solicitudes' end),
         'info',
         jsonb_build_object('kind', 'product_request', 'product_id', p_product_id, 'product_request_id', v_id)
  from auth.users u where (u.raw_app_meta_data->>'is_super_admin')::boolean = true;

  return jsonb_build_object('ok', true, 'already', false, 'count', v_count);
end $$;

revoke all on function public.request_product(uuid, text, text, text) from public;
grant execute on function public.request_product(uuid, text, text, text) to anon, authenticated;

-- Al reponer stock: aviso a las clientas con cuenta (sale por la campana y por correo)
create or replace function public.notify_product_restock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(old.stock, 0) <= 0 and coalesce(new.stock, 0) > 0 then
    insert into public.notifications (user_id, title, message, type, metadata)
    select r.user_id, '¡Volvió lo que querías!',
           format('«%s» ya está disponible otra vez. Aparta el tuyo antes de que se agote.', new.name),
           'success', jsonb_build_object('kind', 'product_restock', 'product_id', new.id)
    from public.product_requests r
    where r.product_id = new.id and r.status = 'pending' and r.user_id is not null;

    update public.product_requests set status = 'notified', notified_at = now()
    where product_id = new.id and status = 'pending' and user_id is not null;
  end if;
  return new;
end $$;

create or replace trigger trg_products_restock_requests
  after update of stock on public.products
  for each row execute function public.notify_product_restock();
