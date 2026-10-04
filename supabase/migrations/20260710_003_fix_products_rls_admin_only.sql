-- Fix Products RLS to restrict creation/updates/deletes to admins only

DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
DROP POLICY IF EXISTS "Users can update own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete own products" ON public.products;
DROP POLICY IF EXISTS "Users can view own products" ON public.products;

CREATE POLICY "Only admins can insert products" ON public.products FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Only admins can update products" ON public.products FOR UPDATE USING (is_admin());
CREATE POLICY "Only admins can delete products" ON public.products FOR DELETE USING (is_admin());
