-- Establecer is_super_admin = true para los usuarios administradores
UPDATE auth.users 
SET raw_app_meta_data = raw_app_meta_data || '{"is_super_admin": true}'::jsonb
WHERE email IN ('manojito@gmail.com', 'michael.rafael03@gmail.com');