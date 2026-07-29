-- YA APLICADA en producción (utfoempgdbhhikpvbvir). Agrégala tal cual a supabase/migrations/.
DROP POLICY IF EXISTS "Users can view own sales" ON public.sales;
CREATE POLICY "Users can view own sales" ON public.sales
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = customer_user_id OR public.is_admin());
