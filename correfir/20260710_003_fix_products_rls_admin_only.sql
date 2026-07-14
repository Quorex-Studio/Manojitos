-- Migration: Fix Products RLS to Admin-Only for Write Operations
-- Date: 2025-07-10
-- Severity: CRITICAL
-- Description: Restrict product creation/update/delete to administrators only

-- First, drop insecure policies
DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete own products" ON public.products;
DROP POLICY IF EXISTS "Users can update own products" ON public.products;

-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Only admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Only admins can update products" ON public.products;
DROP POLICY IF EXISTS "Only admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = user_id 
    AND (app_metadata->>'is_super_admin')::boolean = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin(user_id UUID) IS
'Returns true if the user has is_super_admin flag set to true in their auth.users app_metadata.';

-- Enable RLS on products table (if not already enabled)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- POLICY 1: Anyone (including anonymous) can READ products
CREATE POLICY "Anyone can read products"
ON public.products
FOR SELECT
USING (true);

-- POLICY 2: Only admins can INSERT products
CREATE POLICY "Only admins can insert products"
ON public.products
FOR INSERT
WITH CHECK (
  public.is_admin(auth.uid()) = true
);

-- POLICY 3: Only admins can UPDATE products
CREATE POLICY "Only admins can update products"
ON public.products
FOR UPDATE
WITH CHECK (
  public.is_admin(auth.uid()) = true
);

-- POLICY 4: Only admins can DELETE products
CREATE POLICY "Only admins can delete products"
ON public.products
FOR DELETE
USING (
  public.is_admin(auth.uid()) = true
);

-- Testing queries (uncomment to verify after migration):
-- 1. Verify policies exist:
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='products' ORDER BY policyname;

-- 2. Test as regular user (should get 403 error on insert/update/delete):
-- SELECT COUNT(*) FROM products; -- ✅ Should work (SELECT allowed)
-- INSERT INTO products (name, price_usd, stock, user_id) VALUES ('Test', 10, 5, auth.uid()); -- ❌ Should fail (INSERT not allowed)

-- 3. Test as admin user:
-- SELECT COUNT(*) FROM products; -- ✅ Should work
-- INSERT INTO products (name, price_usd, stock, user_id) VALUES ('Test', 10, 5, auth.uid()); -- ✅ Should work
