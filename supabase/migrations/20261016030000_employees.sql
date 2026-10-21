-- Empleados (rol «vendedor»): solo facturan ventas. Se puede reaplicar.
--
-- El rol vive en auth.users.raw_app_meta_data.role = 'vendedor' (lo pone la edge function
-- admin-actions al crear el empleado). La administración sigue siendo is_super_admin.

-- 1) ¿Quien llama es administración o un empleado activo?
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and (
        (raw_app_meta_data->>'is_super_admin')::boolean = true
        or (raw_app_meta_data->>'role' = 'vendedor' and (banned_until is null or banned_until < now()))
      )
  );
$$;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- 2) Lo que hace falta para registrar una venta deja pasar también a los empleados.
--    Se ajusta la versión que tenga la base (sin copiar el cuerpo entero): en estas cuatro
--    funciones el chequeo «NOT is_admin()» pasa a «NOT public.is_staff()».
do $$
declare
  f record;
  def text;
  patched text;
begin
  for f in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('confirm_pos_sale', 'process_group_abono', 'create_ledger_entry', 'recalculate_sale_group')
  loop
    def := pg_get_functiondef(f.oid);
    patched := regexp_replace(def, 'NOT\s+(public\.)?is_admin\(\)', 'NOT public.is_staff()', 'gi');
    if patched <> def then
      execute patched;
    end if;
  end loop;
end $$;

-- 3) Buscar clientes al vender (Nueva venta → Buscar cliente)
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'customer_profiles' and policyname = 'Empleados ven clientes') then
    create policy "Empleados ven clientes" on public.customer_profiles
      for select to authenticated using (public.is_staff());
  end if;
end $$;

-- 4) El empleado solo factura: no edita ni borra ventas por su cuenta (las políticas viejas
--    «Users can update/delete own sales» se lo permitirían con las que él registró).
create or replace function public.is_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and raw_app_meta_data->>'role' = 'vendedor'
      and coalesce((raw_app_meta_data->>'is_super_admin')::boolean, false) = false
  );
$$;
revoke execute on function public.is_employee() from public, anon;
grant execute on function public.is_employee() to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'sales' and policyname = 'Empleados no editan ventas') then
    create policy "Empleados no editan ventas" on public.sales
      as restrictive for update to authenticated using (not public.is_employee());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'sales' and policyname = 'Empleados no borran ventas') then
    create policy "Empleados no borran ventas" on public.sales
      as restrictive for delete to authenticated using (not public.is_employee());
  end if;
end $$;

-- 5) Nueva venta lee el recargo de «Financiado» (regla pricing_config): solo esa regla, solo lectura
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'business_rules' and policyname = 'Empleados leen la regla de precios') then
    create policy "Empleados leen la regla de precios" on public.business_rules
      for select to authenticated using (rule_key = 'pricing_config' and public.is_staff());
  end if;
end $$;
