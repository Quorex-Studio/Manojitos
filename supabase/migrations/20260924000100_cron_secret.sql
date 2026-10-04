-- Secreto compartido entre pg_cron y las edge functions (send-email, angela-cron-alerts).
-- En Manojitos no se programan las alertas horarias de Ángela (sus tablas se quitaron en
-- 20260622 drop_angela_tables); solo se crea el secreto y la URL del proyecto en el Vault.
-- Se genera por proyecto en el Vault (nada que configurar a mano) y el cron lo
-- envía en el header x-cron-secret. La función lo valida con verify_cron_secret.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret', 'Secreto de pg_cron para edge functions');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'project_url') THEN
    PERFORM vault.create_secret('https://utfoempgdbhhikpvbvir.supabase.co', 'project_url', 'URL del proyecto para pg_cron');
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

