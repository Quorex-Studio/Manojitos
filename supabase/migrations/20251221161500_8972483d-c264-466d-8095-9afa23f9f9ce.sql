-- Fix: Require authentication to view exchange rates
-- This prevents unauthenticated access while still allowing all logged-in users to see rates

DROP POLICY IF EXISTS "Anyone can view exchange rates" ON public.exchange_rates;

CREATE POLICY "Authenticated users can view exchange rates"
ON public.exchange_rates
FOR SELECT
USING (auth.uid() IS NOT NULL);