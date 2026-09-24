-- PLANTILLA: el admin de cada tienda se asigna después de crear su usuario en Auth
-- (ver PLANTILLA.md). Ejecutar en el SQL Editor, cambiando el correo:
--
--   UPDATE auth.users
--   SET raw_app_meta_data = raw_app_meta_data || '{"is_super_admin": true}'::jsonb
--   WHERE email = 'admin@tu-dominio.com';
--
-- (La versión original asignaba correos fijos de otra tienda; se deja sin efecto.)
SELECT 1;
