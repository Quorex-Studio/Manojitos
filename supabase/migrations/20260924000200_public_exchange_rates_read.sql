-- La tasa BCV es pública: la tienda la necesita para mostrar precios en Bs a visitantes
-- sin sesión (antes veían "0,00 Bs"). Solo lectura; la escritura sigue siendo service_role.
DROP POLICY IF EXISTS "Authenticated users can view exchange rates" ON public.exchange_rates;
CREATE POLICY "Anyone can view exchange rates" ON public.exchange_rates FOR SELECT TO anon, authenticated USING (true);
