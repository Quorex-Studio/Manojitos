-- Secreto compartido entre pg_cron y la edge function angela-cron-alerts.
-- Se genera por proyecto en el Vault (nada que configurar a mano) y el cron lo
-- envía en el header x-cron-secret. La función lo valida con verify_cron_secret.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret', 'Secreto de pg_cron para edge functions');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_secret IS NOT NULL AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret' AND decrypted_secret = p_secret
  );
$$;
REVOKE EXECUTE ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;

SELECT cron.unschedule('angela-hourly-alerts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'angela-hourly-alerts');
SELECT cron.unschedule('angela-stock-check') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'angela-stock-check');

SELECT cron.schedule('angela-hourly-alerts', '0 * * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/angela-cron-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')),
    body := '{}'::jsonb
  ) AS request_id;
$$);

SELECT cron.schedule('angela-stock-check', '0 */4 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/angela-cron-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')),
    body := '{"type": "stock_check"}'::jsonb
  ) AS request_id;
$$);
