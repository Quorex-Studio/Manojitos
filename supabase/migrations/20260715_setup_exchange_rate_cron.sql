-- PLANTILLA: la URL del proyecto y la anon key se leen del Vault de cada tienda.
-- Antes de aplicar, en cada proyecto nuevo:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<anon key>', 'anon_key');
-- Habilitar extensiones requeridas
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Crear el trabajo programado para llamar a la función get-bcv-rate
-- Se ejecutará a las 00:00, 06:00, 12:00 y 18:00 (hora del servidor)
select cron.schedule(
  'invoke-get-bcv-rate',
  '0 0,6,12,18 * * *',
  $$
  select
    net.http_post(
        url:=(select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/get-bcv-rate',
        headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')),
        body:='{}'::jsonb
    ) as request_id;
  $$
);
