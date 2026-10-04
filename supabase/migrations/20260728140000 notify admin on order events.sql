-- YA APLICADA en producción (utfoempgdbhhikpvbvir). Agrégala tal cual a supabase/migrations/
-- para sincronizar el historial de migraciones de tu repo con la base de datos real.
CREATE OR REPLACE FUNCTION public.notify_admin_on_order_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin_id uuid; v_title text; v_message text;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE (raw_app_meta_data->>'is_super_admin')::boolean = true LIMIT 1;
  IF v_admin_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.notes LIKE '%[SOLICITUD_CREDITO]%' THEN
    v_title := 'Nueva solicitud de crédito';
    v_message := 'Cliente ' || COALESCE(NEW.customer_name, NEW.customer_phone, 'sin nombre') || ' solicitó una línea de crédito.';
  ELSIF NEW.notes LIKE '%[ABONO_CREDITO]%' THEN
    v_title := 'Nuevo abono reportado';
    v_message := 'Cliente ' || COALESCE(NEW.customer_name, NEW.customer_phone, 'sin nombre') || ' reportó un pago de cuota.';
  ELSE
    v_title := 'Nueva compra recibida';
    v_message := 'Pedido de ' || COALESCE(NEW.customer_name, NEW.customer_phone, 'sin nombre') || ' por $' || COALESCE(NEW.total_usd, 0)::text || '.';
  END IF;
  INSERT INTO public.notifications (id, user_id, title, message, type, channel, is_read, sent_at, metadata)
  VALUES (gen_random_uuid(), v_admin_id, v_title, v_message, 'info', 'internal', false, now(), jsonb_build_object('order_id', NEW.id));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_order_insert ON public.orders;
CREATE TRIGGER trg_notify_admin_on_order_insert AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_order_insert();

CREATE OR REPLACE FUNCTION public.notify_admin_on_kyc_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin_id uuid;
BEGIN
  IF NEW.kyc_status = 'pending' AND (OLD.kyc_status IS NULL OR OLD.kyc_status IS DISTINCT FROM NEW.kyc_status) THEN
    SELECT id INTO v_admin_id FROM auth.users WHERE (raw_app_meta_data->>'is_super_admin')::boolean = true LIMIT 1;
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO public.notifications (id, user_id, title, message, type, channel, is_read, sent_at, metadata)
      VALUES (gen_random_uuid(), v_admin_id, 'Validación KYC pendiente',
              'El cliente ' || COALESCE(NEW.full_name, NEW.phone, 'sin nombre') || ' envió documentos para validar KYC.',
              'warning', 'internal', false, now(), jsonb_build_object('customer_user_id', NEW.user_id));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_kyc_submitted ON public.customer_profiles;
CREATE TRIGGER trg_notify_admin_on_kyc_submitted AFTER UPDATE OF kyc_status ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_kyc_submitted();
