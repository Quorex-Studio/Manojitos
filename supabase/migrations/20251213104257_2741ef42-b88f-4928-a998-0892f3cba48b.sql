-- Remove the permissive INSERT policy that allows any authenticated user to insert rates
DROP POLICY IF EXISTS "Authenticated users can insert rates" ON public.exchange_rates;

-- Create a restrictive policy that only allows service role to insert (edge functions)
-- No authenticated users can insert directly - only the edge function with service role key
CREATE POLICY "Only service role can insert rates" 
ON public.exchange_rates 
FOR INSERT 
TO service_role
WITH CHECK (true);