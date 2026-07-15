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
        url:='https://utfoempgdbhhikpvbvir.supabase.co/functions/v1/get-bcv-rate',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Zm9lbXBnZGJoaGlrcHZidmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzOTk4NjEsImV4cCI6MjA4MDk3NTg2MX0.YOtYzlXWVR4GiwbNpIRqfy8g5qfGQPvEltG8NUTuqhU"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
