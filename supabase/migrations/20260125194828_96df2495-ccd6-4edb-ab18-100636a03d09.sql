-- Agregar política pública para que cualquiera pueda ver productos (tienda pública)
CREATE POLICY "Public can view all products" 
ON public.products 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Comentario: Esta política permite que usuarios anónimos y autenticados 
-- vean todos los productos para la experiencia de tienda pública