-- Habilitar extensiones necesarias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agregar índice único para evitar duplicados en customer_memory
CREATE UNIQUE INDEX IF NOT EXISTS customer_memory_unique_key 
ON public.customer_memory (customer_user_id, memory_key) 
WHERE customer_user_id IS NOT NULL;

-- Programar el cron job de alertas de Ángela cada hora
SELECT cron.schedule(
  'angela-hourly-alerts',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://utfoempgdbhhikpvbvir.supabase.co/functions/v1/angela-cron-alerts',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- También programar análisis más frecuente para stock bajo (cada 4 horas)
SELECT cron.schedule(
  'angela-stock-check',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://utfoempgdbhhikpvbvir.supabase.co/functions/v1/angela-cron-alerts',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"type": "stock_check"}'::jsonb
  ) AS request_id;
  $$
);