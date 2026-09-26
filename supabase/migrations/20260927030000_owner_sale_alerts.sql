-- Aviso a la dueña de cada venta del panel (la de la tienda online ya llega como "pedido nuevo").
-- Se encola junto con la factura; la edge function crea la notificación para la administración,
-- que sale por correo y, si está configurado, por WhatsApp (business_rules 'owner_alerts').
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check
  check (kind in ('notification', 'sale_receipt', 'payment_receipt', 'sale_admin'));

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
  -- Venta del panel (no la que genera la aprobación de un pedido online, que ya se avisó)
  if new.customer_user_id is null or new.user_id <> new.customer_user_id then
    insert into public.email_outbox (kind, ref, due_at) values ('sale_admin', v_group, now() + interval '45 seconds')
    on conflict (kind, ref) do update set due_at = excluded.due_at
      where public.email_outbox.status = 'pending';
  end if;
  return new;
end $$;
