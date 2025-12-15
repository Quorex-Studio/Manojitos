-- Create a SECURITY DEFINER function to check if current user is admin
-- This avoids "permission denied for table users" errors in RLS policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_app_meta_data->>'is_super_admin')::boolean = true
  );
$$;

-- Update RLS policies to use the new function instead of direct auth.users queries

-- credits table
DROP POLICY IF EXISTS "Admins can view all credits" ON public.credits;
DROP POLICY IF EXISTS "Admins can insert credits" ON public.credits;
DROP POLICY IF EXISTS "Admins can update credits" ON public.credits;
DROP POLICY IF EXISTS "Admins can delete credits" ON public.credits;

CREATE POLICY "Admins can view all credits" ON public.credits
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert credits" ON public.credits
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update credits" ON public.credits
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete credits" ON public.credits
  FOR DELETE USING (public.is_admin());

-- credit_transactions table
DROP POLICY IF EXISTS "Admins can manage credit_transactions" ON public.credit_transactions;

CREATE POLICY "Admins can manage credit_transactions" ON public.credit_transactions
  FOR ALL USING (public.is_admin());

-- credit_reminders table
DROP POLICY IF EXISTS "Admins can manage credit_reminders" ON public.credit_reminders;

CREATE POLICY "Admins can manage credit_reminders" ON public.credit_reminders
  FOR ALL USING (public.is_admin());

-- notifications table
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;

CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL USING (public.is_admin());

-- payment_promises table
DROP POLICY IF EXISTS "Admins can manage payment_promises" ON public.payment_promises;

CREATE POLICY "Admins can manage payment_promises" ON public.payment_promises
  FOR ALL USING (public.is_admin());