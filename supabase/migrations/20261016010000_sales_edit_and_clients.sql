-- Ventas: editar y cartera de clientes. Sin DROP: se puede reaplicar.
--
-- 1) La administración puede corregir cualquier venta (no solo las que registró su usuario):
--    cliente, fecha, método, nombres y precios desde «Editar venta».
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'sales' and policyname = 'Admins can update sales') then
    create policy "Admins can update sales" on public.sales
      for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- 2) Ventas viejas que quedaron sin cuenta: el panel no guardaba customer_user_id (se perdía al
--    validar), así que las ventas fiadas o a crédito de clientes con cuenta no aparecían en su
--    ficha. Se vinculan por correo, cédula o teléfono (en ese orden), solo a cuentas que existen
--    (hay fichas huérfanas y la llave foránea sales.customer_user_id → auth.users rechazaría el
--    cambio) y solo cuando coincide UNA cuenta: si dos fichas comparten el dato, no se adivina.
update public.sales s
set customer_user_id = m.user_id
from (
  select s2.id, (array_agg(distinct cp.user_id))[1] as user_id
  from public.sales s2
  join public.customer_profiles cp
    on s2.client_email is not null and cp.email is not null
   and lower(trim(s2.client_email)) = lower(trim(cp.email))
  where s2.customer_user_id is null
    and exists (select 1 from auth.users u where u.id = cp.user_id)
  group by s2.id
  having count(distinct cp.user_id) = 1
) m
where s.id = m.id;

update public.sales s
set customer_user_id = m.user_id
from (
  select s2.id, (array_agg(distinct cp.user_id))[1] as user_id
  from public.sales s2
  join public.customer_profiles cp
    on s2.client_dni is not null and cp.dni is not null
   and length(regexp_replace(s2.client_dni, '\D', '', 'g')) >= 6
   and regexp_replace(s2.client_dni, '\D', '', 'g') = regexp_replace(cp.dni, '\D', '', 'g')
  where s2.customer_user_id is null
    and exists (select 1 from auth.users u where u.id = cp.user_id)
  group by s2.id
  having count(distinct cp.user_id) = 1
) m
where s.id = m.id;

update public.sales s
set customer_user_id = m.user_id
from (
  select s2.id, (array_agg(distinct cp.user_id))[1] as user_id
  from public.sales s2
  join public.customer_profiles cp
    on s2.client_phone is not null and cp.phone is not null
   and public.normalize_ve_phone(s2.client_phone) = public.normalize_ve_phone(cp.phone)
  where s2.customer_user_id is null
    and exists (select 1 from auth.users u where u.id = cp.user_id)
  group by s2.id
  having count(distinct cp.user_id) = 1
) m
where s.id = m.id;
