-- Agregar columnas a customer_profiles si no existen
ALTER TABLE public.customer_profiles 
ADD COLUMN IF NOT EXISTS dni_photo_url TEXT,
ADD COLUMN IF NOT EXISTS face_photo_url TEXT,
ADD COLUMN IF NOT EXISTS verification_photo_url TEXT;

-- Recrear/Actualizar la función trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into public.profiles
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'))
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert into public.customer_profiles
  INSERT INTO public.customer_profiles (
    user_id, 
    full_name, 
    email, 
    phone, 
    dni, 
    avatar_url, 
    address, 
    location_coords,
    dni_photo_url,
    face_photo_url,
    verification_photo_url
  )
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'), 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'dni', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'address', ''),
    COALESCE(NEW.raw_user_meta_data->>'location_coords', ''),
    COALESCE(NEW.raw_user_meta_data->>'dni_photo_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'face_photo_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'verification_photo_url', '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    dni_photo_url = EXCLUDED.dni_photo_url,
    face_photo_url = EXCLUDED.face_photo_url,
    verification_photo_url = EXCLUDED.verification_photo_url;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
