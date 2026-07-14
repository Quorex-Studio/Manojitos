-- Add unique constraints to customer profiles to prevent duplicate DNI and phone numbers
ALTER TABLE public.customer_profiles
ADD CONSTRAINT unique_dni_per_customer UNIQUE (dni),
ADD CONSTRAINT unique_phone_per_customer UNIQUE (phone);
