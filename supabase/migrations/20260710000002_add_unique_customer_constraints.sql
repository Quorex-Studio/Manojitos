-- Únicos de DNI/teléfono. Se normalizan '' a NULL para que usuarios sin teléfono/DNI
-- (p. ej. el admin) no choquen con la restricción UNIQUE.
UPDATE public.customer_profiles SET phone = NULL WHERE phone = '';
UPDATE public.customer_profiles SET dni = NULL WHERE dni = '';
ALTER TABLE public.customer_profiles
ADD CONSTRAINT unique_dni_per_customer UNIQUE (dni),
ADD CONSTRAINT unique_phone_per_customer UNIQUE (phone);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.customer_profiles (
    user_id, full_name, email, phone, dni, avatar_url, address, location_coords,
    dni_photo_url, face_photo_url, verification_photo_url
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'dni', ''),
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
