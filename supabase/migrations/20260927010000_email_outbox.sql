-- Correos automáticos: cada notificación y cada factura (venta y abono) se encola aquí y la
-- edge function send-email los envía (pg_cron cada 20 s llama a send-email con x-cron-secret).
-- La cola evita duplicados (unique kind+ref), espera a que una venta de varios productos esté
-- completa (due_at se corre con cada línea) y reintenta si Resend falla.
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notification', 'sale_receipt', 'payment_receipt')),
  ref text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts int not null default 0,
  last_error text,
  due_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, ref)
);
create index if not exists email_outbox_pending_idx on public.email_outbox (due_at) where status = 'pending';

alter table public.email_outbox enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'email_outbox' and policyname = 'Administración ve la cola de correos') then
    create policy "Administración ve la cola de correos" on public.email_outbox
      for select to authenticated using (public.is_admin());
  end if;
end $$;

-- Notificaciones: todas salen también por correo (la función decide destinatario y preferencias)
create or replace function public.enqueue_notification_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.email_outbox (kind, ref) values ('notification', new.id::text)
  on conflict (kind, ref) do nothing;
  return new;
end $$;

create or replace trigger trg_notifications_email after insert on public.notifications
  for each row execute function public.enqueue_notification_email();

-- Factura de una venta: cuando se confirma. El POS confirma producto por producto, así que
-- cada línea corre el envío 45 s y sale un solo correo con la venta completa.
-- Solo ventas recientes (una importación de ventas viejas no escribe a nadie).
create or replace function public.enqueue_sale_receipt_email()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_group text := coalesce(new.sale_group_id, new.id)::text;
begin
  if new.status <> 'confirmed' or new.created_at < now() - interval '1 day' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' then
    return new;
  end if;
  insert into public.email_outbox (kind, ref, due_at) values ('sale_receipt', v_group, now() + interval '45 seconds')
  on conflict (kind, ref) do update set due_at = excluded.due_at
    where public.email_outbox.status = 'pending';
  return new;
end $$;

create or replace trigger trg_sales_receipt_email after insert or update of status on public.sales
  for each row execute function public.enqueue_sale_receipt_email();

-- Abono registrado: factura actualizada con el detalle de todos los abonos
create or replace function public.enqueue_payment_receipt_email()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  if coalesce(new.status, 'valid') <> 'valid' then return new; end if;
  v_group := coalesce(new.sale_group_id, (select s.sale_group_id from public.sales s where s.id = new.sale_id));
  if v_group is null then return new; end if;
  insert into public.email_outbox (kind, ref, payload, due_at)
  values ('payment_receipt', new.id::text, jsonb_build_object('sale_group_id', v_group), now() + interval '10 seconds')
  on conflict (kind, ref) do nothing;
  return new;
end $$;

create or replace trigger trg_sale_payments_receipt_email after insert on public.sale_payments
  for each row execute function public.enqueue_payment_receipt_email();

-- La función toma lotes sin pisarse con otra ejecución (skip locked) y rescata envíos colgados
create or replace function public.claim_email_outbox(p_limit int default 20)
returns setof public.email_outbox language plpgsql security definer set search_path = public as $$
begin
  update public.email_outbox set status = 'pending'
    where status = 'sending' and due_at < now() - interval '5 minutes';
  return query
  update public.email_outbox o set status = 'sending', attempts = o.attempts + 1, due_at = now()
  where o.id in (
    select id from public.email_outbox
    where status = 'pending' and due_at <= now() and attempts < 5
    order by due_at
    limit p_limit
    for update skip locked
  )
  returning o.*;
end $$;

create or replace function public.finish_email_outbox(p_id uuid, p_status text, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update public.email_outbox
  set status = case when p_status = 'failed' and attempts < 5 then 'pending' else p_status end,
      last_error = p_error,
      sent_at = case when p_status = 'sent' then now() else sent_at end,
      due_at = case when p_status = 'failed' then now() + (attempts * interval '1 minute') else due_at end
  where id = p_id;
$$;

revoke execute on function public.claim_email_outbox(int) from public, anon, authenticated;
revoke execute on function public.finish_email_outbox(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.enqueue_notification_email() from public, anon, authenticated;
revoke execute on function public.enqueue_sale_receipt_email() from public, anon, authenticated;
revoke execute on function public.enqueue_payment_receipt_email() from public, anon, authenticated;
grant execute on function public.claim_email_outbox(int) to service_role;
grant execute on function public.finish_email_outbox(uuid, text, text) to service_role;

-- Cada 20 s, solo si hay algo por enviar.
-- En Manojitos se programó después de desplegar la edge function send-email nueva.
select cron.unschedule('email-outbox') where exists (select 1 from cron.job where jobname = 'email-outbox');
select cron.schedule('email-outbox', '20 seconds', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"process_outbox": true}'::jsonb
  ) as request_id
  where exists (select 1 from public.email_outbox where status = 'pending' and due_at <= now() and attempts < 5);
$cron$);
