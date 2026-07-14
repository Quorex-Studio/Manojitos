-- Migration: Add UNIQUE Constraints to Customer Profiles
-- Date: 2025-07-10
-- Severity: CRITICAL
-- Description: Prevent duplicate DNI and phone numbers at database level

-- Before applying these constraints, check for existing duplicates:
-- SELECT dni, COUNT(*) FROM public.customer_profiles WHERE dni IS NOT NULL GROUP BY dni HAVING COUNT(*) > 1;
-- SELECT phone, COUNT(*) FROM public.customer_profiles WHERE phone IS NOT NULL GROUP BY phone HAVING COUNT(*) > 1;

-- If duplicates exist, you must resolve them manually before applying constraints.
-- For example:
-- UPDATE customer_profiles SET dni = NULL WHERE id IN (SELECT id FROM customer_profiles WHERE dni = 'DUPLICATE_VALUE' OFFSET 1);

-- Add UNIQUE constraint for DNI (allows NULLs for customers without DNI)
ALTER TABLE public.customer_profiles
ADD CONSTRAINT unique_dni_per_customer UNIQUE (dni)
WHERE dni IS NOT NULL;

-- Add UNIQUE constraint for phone (allows NULLs for customers without phone)
ALTER TABLE public.customer_profiles
ADD CONSTRAINT unique_phone_per_customer UNIQUE (phone)
WHERE phone IS NOT NULL;

-- Create indexes to improve performance of lookups and constraint validation
CREATE INDEX IF NOT EXISTS idx_customer_profiles_dni 
ON public.customer_profiles(dni) 
WHERE dni IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone 
ON public.customer_profiles(phone) 
WHERE phone IS NOT NULL;

-- Add comments documenting the constraints
COMMENT ON CONSTRAINT unique_dni_per_customer ON public.customer_profiles IS
'Ensures each unique DNI can only belong to one customer profile. Supports regulatory KYC/AML requirements.';

COMMENT ON CONSTRAINT unique_phone_per_customer ON public.customer_profiles IS
'Ensures each unique phone number can only belong to one customer profile. Prevents duplicate contact information.';

-- Verify constraints were created successfully
-- SELECT constraint_name, column_name FROM information_schema.table_constraints 
-- WHERE table_name='customer_profiles' AND constraint_type='UNIQUE';
