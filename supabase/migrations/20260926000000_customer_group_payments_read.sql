-- "Mis pedidos" muestra los abonos de cada compra: la clienta ve también los abonos registrados
-- al grupo de venta (sale_group_id, sin sale_id), no solo los de una línea. Igual que en EINA.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_payments' AND policyname = 'Customers can view own sale_payments') THEN
    ALTER POLICY "Customers can view own sale_payments" ON public.sale_payments
      USING (EXISTS (SELECT 1 FROM public.sales s
        WHERE (s.id = sale_payments.sale_id OR s.sale_group_id = sale_payments.sale_group_id)
          AND s.customer_user_id = (SELECT auth.uid())));
  END IF;
END $$;
