-- Cuentas únicas por cédula, teléfono y correo, sin bloquear a quien ya compró en la tienda.
-- En Nueva venta se guarda el perfil de una clienta sin cuenta (user_id que no existe en auth).
-- Antes, si esa persona se registraba, el índice único de cédula/teléfono hacía fallar el
-- registro ("Database error saving new user"). Ahora su cuenta real reemplaza ese perfil.

-- 1) Chequeo previo al registro: compara por dígitos (V-12.345.678 = V12345678) y el correo sin
--    mayúsculas; los perfiles sin cuenta (creados por la tienda) no cuentan como "ya registrado".
create or replace function public.check_unique_customer_data(p_phone text, p_dni text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_phone text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  v_dni text := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  return jsonb_build_object(
    'phone_taken', v_phone <> '' and exists (
      select 1 from public.customer_profiles cp join auth.users u on u.id = cp.user_id
      where right(regexp_replace(coalesce(cp.phone, ''), '\D', '', 'g'), 10) = v_phone),
    'dni_taken', v_dni <> '' and exists (
      select 1 from public.customer_profiles cp join auth.users u on u.id = cp.user_id
      where regexp_replace(coalesce(cp.dni, ''), '\D', '', 'g') = v_dni),
    'email_taken', v_email <> '' and exists (select 1 from auth.users u where lower(u.email) = v_email)
  );
end $$;

-- 2) Al crear la cuenta, el perfil provisional de la tienda (misma cédula o teléfono) se reemplaza
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(new.raw_user_meta_data->>'phone', '');
  v_dni text := nullif(new.raw_user_meta_data->>'dni', '');
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'))
  on conflict (user_id) do nothing;

  delete from public.customer_profiles cp
  where not exists (select 1 from auth.users u where u.id = cp.user_id)
    and ((v_dni is not null and cp.dni = v_dni) or (v_phone is not null and cp.phone = v_phone));

  insert into public.customer_profiles (
    user_id, full_name, email, phone, dni, avatar_url, address, location_coords,
    dni_photo_url, face_photo_url, verification_photo_url
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
    coalesce(new.raw_user_meta_data->>'verification_photo_url', '')
  )
  on conflict (user_id) do update set
    dni_photo_url = excluded.dni_photo_url,
    face_photo_url = excluded.face_photo_url,
    verification_photo_url = excluded.verification_photo_url;

  return new;
end $$;

-- 3) Restricciones duplicadas: quedan los índices únicos parciales (idx_customer_profiles_unique_dni / _phone)
alter table public.customer_profiles drop constraint if exists unique_dni_per_customer;
alter table public.customer_profiles drop constraint if exists unique_phone_per_customer;
