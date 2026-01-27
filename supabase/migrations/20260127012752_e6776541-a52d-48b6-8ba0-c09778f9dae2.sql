-- ================== SISTEMA DE AUDITORÍA ==================
-- Tabla para registrar todas las acciones administrativas sensibles

CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver logs de auditoría (lectura)
CREATE POLICY "Admins can view audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (is_admin());

-- Solo el sistema (service_role) puede insertar logs
CREATE POLICY "System can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (true);

-- Los logs son inmutables - no se pueden actualizar ni eliminar
-- (No policies for UPDATE/DELETE = cannot update/delete)

-- Comentarios para documentación
COMMENT ON TABLE public.audit_logs IS 'Registro inmutable de auditoría para acciones administrativas sensibles';
COMMENT ON COLUMN public.audit_logs.action_type IS 'Tipo de acción: view_credit, update_credit, block_client, access_sensitive_data, etc.';
COMMENT ON COLUMN public.audit_logs.resource_type IS 'Tipo de recurso afectado: credit, customer, product, sale, etc.';
COMMENT ON COLUMN public.audit_logs.details IS 'Detalles adicionales de la acción en JSON (cambios realizados, valores anteriores/nuevos)';

-- ================== FUNCIÓN HELPER PARA LOGGING ==================
-- Función para insertar logs desde Edge Functions

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID,
  p_action_type TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id, action_type, resource_type, resource_id, 
    details, ip_address, user_agent
  ) VALUES (
    p_user_id, p_action_type, p_resource_type, p_resource_id,
    p_details, p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION public.log_audit_event IS 'Inserta un registro de auditoría de forma segura';