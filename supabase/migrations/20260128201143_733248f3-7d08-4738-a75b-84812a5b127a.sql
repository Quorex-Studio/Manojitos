-- Corregir política RLS para audit_logs - usar autenticación en lugar de true
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Crear política que permite inserción solo a usuarios autenticados o service_role
CREATE POLICY "Authenticated users can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Nota: El service_role bypasea RLS automáticamente, por lo que Edge Functions 
-- con SUPABASE_SERVICE_ROLE_KEY pueden insertar sin restricciones.