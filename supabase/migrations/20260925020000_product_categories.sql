-- Categorías de productos configurables desde Configuración → Categorías.
-- Cada categoría define qué detalle pide el producto:
--   ninguno   → nada extra
--   contenido → contenido neto (número + unidad de `options`, p. ej. ml, g)   → products.presentation
--   medidas   → medidas en texto libre (p. ej. "20 × 15 cm")                   → products.presentation
--   tallas    → tallas que elige la clienta (lista en `options`)               → products.sizes
--   tonos     → tonos/colores que elige la clienta (sugerencias en `options`)  → products.sizes
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 50),
  detail_kind text not null default 'ninguno'
    check (detail_kind in ('ninguno', 'contenido', 'medidas', 'tallas', 'tonos')),
  options text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_categories_name_key on public.product_categories (lower(name));

alter table public.product_categories enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'product_categories' and policyname = 'Categorias visibles para todos') then
    create policy "Categorias visibles para todos" on public.product_categories
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_categories' and policyname = 'Solo admin crea categorias') then
    create policy "Solo admin crea categorias" on public.product_categories
      for insert to authenticated with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_categories' and policyname = 'Solo admin edita categorias') then
    create policy "Solo admin edita categorias" on public.product_categories
      for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_categories' and policyname = 'Solo admin borra categorias') then
    create policy "Solo admin borra categorias" on public.product_categories
      for delete to authenticated using (public.is_admin());
  end if;
end $$;

grant select on public.product_categories to anon, authenticated;
grant insert, update, delete on public.product_categories to authenticated;

-- Contenido neto o medidas del producto ("30 ml", "20 × 15 cm")
alter table public.products add column if not exists presentation text
  check (presentation is null or length(presentation) <= 60);

-- Renombrar una categoría mueve sus productos; borrarla exige que quede vacía
-- (el panel ofrece moverlos antes), así ningún producto queda con una categoría fantasma.
create or replace function public.product_categories_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if new.name is distinct from old.name then
      update public.products set category = new.name where category = old.name;
    end if;
    return new;
  end if;
  select count(*) into n from public.products where category = old.name;
  if n > 0 then
    raise exception 'La categoría % tiene % productos: muévelos antes de borrarla', old.name, n
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

revoke execute on function public.product_categories_sync() from public, anon, authenticated;

create or replace trigger product_categories_sync
  before update or delete on public.product_categories
  for each row execute function public.product_categories_sync();

-- Categorías de Manojitos (boutique: ropa, accesorios, lencería, perfumes) con su detalle
insert into public.product_categories (name, detail_kind, options, sort_order) values
  ('Ropa', 'tallas', '{XS,S,M,L,XL,Única}', 1),
  ('Pantalones', 'tallas', '{XS,S,M,L,XL}', 2),
  ('Deportivo', 'tallas', '{XS,S,M,L,XL}', 3),
  ('Ropa Interior', 'tallas', '{XS,S,M,L,XL}', 4),
  ('Ropa de Baño', 'tallas', '{XS,S,M,L,XL}', 5),
  ('Playa', 'tallas', '{XS,S,M,L,XL,Única}', 6),
  ('Calzado', 'tallas', '{35,36,37,38,39,40}', 7),
  ('Accesorios', 'ninguno', '{}', 8),
  ('Perfumes', 'contenido', '{ml}', 9),
  ('Otros', 'ninguno', '{}', 10)
on conflict do nothing;

-- Cualquier categoría usada por productos que no esté en la lista se agrega sin detalle
insert into public.product_categories (name, sort_order)
select distinct p.category, 100
from public.products p
where p.category is not null and trim(p.category) <> ''
  and not exists (select 1 from public.product_categories c where lower(c.name) = lower(p.category))
on conflict do nothing;
