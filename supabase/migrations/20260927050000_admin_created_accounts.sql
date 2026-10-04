-- Cuentas creadas desde el panel (Nueva venta) o por Ina: la clienta queda con cuenta y sin
-- contraseña (la crea con "Olvidé mi contraseña") y, al entrar, debe completar su perfil.

-- 1) Perfil por completar
alter table public.customer_profiles add column if not exists profile_pending boolean not null default false;

-- 2) Buscar una cuenta por correo (solo la edge function admin-actions, con service_role)
create or replace function public.admin_find_user_by_email(p_email text)
returns uuid language sql security definer set search_path = '' stable as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.admin_find_user_by_email(text) from public, anon, authenticated;
grant execute on function public.admin_find_user_by_email(text) to service_role;

-- 3) Al crear la cuenta: reemplaza el perfil provisional (misma cédula o teléfono) y, si la creó
--    la tienda (app_metadata.created_by_admin), le pasa sus compras y créditos anteriores.
--    Una clienta que se registra sola NO hereda compras por teléfono: nadie verificó que sea ella.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(new.raw_user_meta_data->>'phone', '');
  v_dni text := nullif(new.raw_user_meta_data->>'dni', '');
  v_phone10 text := nullif(right(regexp_replace(coalesce(new.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), 10), '');
  v_dni_digits text := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'dni', ''), '\D', '', 'g'), '');
  v_by_admin boolean := coalesce((new.raw_app_meta_data->>'created_by_admin')::boolean, false);
  v_orphans uuid[];
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'))
  on conflict (user_id) do nothing;

  select coalesce(array_agg(cp.user_id), '{}') into v_orphans
  from public.customer_profiles cp
  where not exists (select 1 from auth.users u where u.id = cp.user_id)
    and ((v_dni_digits is not null and regexp_replace(coalesce(cp.dni, ''), '\D', '', 'g') = v_dni_digits)
      or (v_phone10 is not null and right(regexp_replace(coalesce(cp.phone, ''), '\D', '', 'g'), 10) = v_phone10));

  delete from public.customer_profiles where user_id = any(v_orphans);

  insert into public.customer_profiles (
    user_id, full_name, email, phone, dni, avatar_url, address, location_coords,
    dni_photo_url, face_photo_url, verification_photo_url, profile_pending
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'),
    new.email,
    v_phone,
    v_dni,
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    coalesce(new.raw_user_meta_data->>'address', ''),
    coalesce(new.raw_user_meta_data->>'location_coords', ''),
    coalesce(new.raw_user_meta_data->>'dni_photo_url', ''),
    coalesce(new.raw_user_meta_data->>'face_photo_url', ''),
    coalesce(new.raw_user_meta_data->>'verification_photo_url', ''),
    v_by_admin
  )
  on conflict (user_id) do update set
    dni_photo_url = excluded.dni_photo_url,
    face_photo_url = excluded.face_photo_url,
    verification_photo_url = excluded.verification_photo_url;

  if v_by_admin then
    update public.sales set customer_user_id = new.id
    where customer_user_id = any(v_orphans)
       or (customer_user_id is null and v_phone10 is not null
           and right(regexp_replace(coalesce(client_phone, ''), '\D', '', 'g'), 10) = v_phone10);
    update public.credits set client_user_id = new.id where client_user_id = any(v_orphans);
  end if;

  return new;
end $$;
