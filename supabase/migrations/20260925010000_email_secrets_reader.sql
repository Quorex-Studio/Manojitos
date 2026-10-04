-- Lee secretos de correo guardados en Vault. Solo el servidor (service_role) puede llamarla,
-- y solo para los nombres permitidos: las edge functions la usan cuando el secreto no está
-- definido como variable de entorno.
-- Los valores se cargan aparte (no van en el repositorio):
--   select vault.create_secret('<api key>', 'resend_api_key');
--   select vault.create_secret('Manojitos <contacto@manojitos.com>', 'resend_from_email');
create or replace function public.get_email_secret(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text;
begin
  if p_name not in ('resend_api_key', 'resend_from_email', 'admin_notify_emails', 'send_email_hook_secret') then
    raise exception 'secreto no permitido';
  end if;
  select decrypted_secret into v from vault.decrypted_secrets where name = p_name limit 1;
  return v;
end;
$$;

revoke all on function public.get_email_secret(text) from public, anon, authenticated;
grant execute on function public.get_email_secret(text) to service_role;
