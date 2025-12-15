-- Fix get_unread_notifications_count to validate caller authorization
-- This prevents users from querying notification counts for other users
CREATE OR REPLACE FUNCTION public.get_unread_notifications_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    -- Allow if user is querying their own notifications
    WHEN auth.uid() = p_user_id THEN (
      SELECT COUNT(*)::INTEGER 
      FROM public.notifications 
      WHERE user_id = p_user_id AND is_read = false
    )
    -- Allow if user is a super admin
    WHEN EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_app_meta_data->>'is_super_admin')::boolean = true
    ) THEN (
      SELECT COUNT(*)::INTEGER 
      FROM public.notifications 
      WHERE user_id = p_user_id AND is_read = false
    )
    -- Return 0 for unauthorized access
    ELSE 0
  END;
$$;