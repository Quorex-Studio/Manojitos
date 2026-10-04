-- Endurecimiento tras los advisors de seguridad (portado de EINA a Manojitos).

-- 1. pg_net se queda donde está: en Manojitos moverlo (DROP/CREATE EXTENSION) se bloquea con el
--    worker de pg_net en producción. Es un aviso menor del advisor; se puede mover en una ventana tranquila.

-- 2. Nadie anónimo ejecuta funciones SECURITY DEFINER, salvo:
--    - is_admin(): se evalúa dentro de políticas RLS también para anon (devuelve false)
--    - check_unique_customer_data(): no se toca (en Manojitos ya estaba sin acceso anónimo y el
--      registro sigue aunque la consulta falle)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname NOT IN ('is_admin', 'check_unique_customer_data', 'rls_auto_enable')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- 3. Funciones de trigger / internas: no se exponen por la API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_on_order_insert() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_on_kyc_submitted() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalculate_group_payments() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_trust_level_trigger() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_sale_group(uuid) FROM authenticated;
-- process_pos_abono: legado (escribe en public.ledger, inexistente) y sin control de admin
REVOKE EXECUTE ON FUNCTION public.process_pos_abono(uuid, numeric, numeric, numeric, numeric, numeric, text, text) FROM authenticated;

-- 4. create_ledger_entry: solo admin (o service_role / funciones internas sin sesión)
CREATE OR REPLACE FUNCTION public.create_ledger_entry(
  p_user_id uuid, p_entry_type text, p_amount_usd numeric, p_amount_bs numeric,
  p_reference_type text, p_reference_id uuid, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_last_balance_usd numeric;
  v_last_balance_bs numeric;
  v_new_balance_usd numeric;
  v_new_balance_bs numeric;
  v_entry_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado: se requiere perfil administrador';
  END IF;
  IF p_entry_type NOT IN ('debit', 'credit') THEN
    RAISE EXCEPTION 'Tipo de asiento inválido: %', p_entry_type;
  END IF;
  SELECT balance_after_usd, balance_after_bs INTO v_last_balance_usd, v_last_balance_bs
  FROM public.ledger_entries WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1;
  v_last_balance_usd := COALESCE(v_last_balance_usd, 0);
  v_last_balance_bs := COALESCE(v_last_balance_bs, 0);
  IF p_entry_type = 'credit' THEN
    v_new_balance_usd := v_last_balance_usd + p_amount_usd;
    v_new_balance_bs := v_last_balance_bs + COALESCE(p_amount_bs, 0);
  ELSE
    v_new_balance_usd := v_last_balance_usd - p_amount_usd;
    v_new_balance_bs := v_last_balance_bs - COALESCE(p_amount_bs, 0);
  END IF;
  INSERT INTO public.ledger_entries (
    user_id, entry_type, amount_usd, amount_bs, reference_type, reference_id, description,
    balance_after_usd, balance_after_bs, metadata
  ) VALUES (
    p_user_id, p_entry_type, p_amount_usd, p_amount_bs, p_reference_type, p_reference_id, p_description,
    v_new_balance_usd, v_new_balance_bs, p_metadata
  ) RETURNING id INTO v_entry_id;
  RETURN v_entry_id;
END;
$$;

-- 5. log_audit_event: un usuario solo puede registrar eventos a su nombre
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID, p_action_type TEXT, p_resource_type TEXT, p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb, p_ip_address TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  INSERT INTO public.audit_logs (user_id, action_type, resource_type, resource_id, details, ip_address, user_agent)
  VALUES (p_user_id, p_action_type, p_resource_type, p_resource_id, p_details, p_ip_address, p_user_agent)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;

-- 6 y 7. Ledger: solo admin inserta asientos. Auditoría: nadie inserta a nombre de otro.
--        Se ajustan las políticas que ya existían en Manojitos (ALTER, sin DROP).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ledger_entries' AND policyname = 'Admins can insert ledger entries') THEN
    ALTER POLICY "Admins can insert ledger entries" ON public.ledger_entries WITH CHECK (public.is_admin());
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Authenticated users can insert audit logs') THEN
    ALTER POLICY "Authenticated users can insert audit logs" ON public.audit_logs WITH CHECK (user_id = auth.uid() OR public.is_admin());
    ALTER POLICY "Authenticated users can insert audit logs" ON public.audit_logs RENAME TO "Users insert own audit logs";
  END IF;
END $$;
