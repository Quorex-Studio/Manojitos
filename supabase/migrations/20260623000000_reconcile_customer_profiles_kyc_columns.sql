-- Reconciliación: columnas creadas manualmente en el proyecto original y usadas por el código
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS dni TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS location_coords TEXT,
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'none'
    CHECK (kyc_status IN ('none', 'pending', 'approved', 'rejected'));
