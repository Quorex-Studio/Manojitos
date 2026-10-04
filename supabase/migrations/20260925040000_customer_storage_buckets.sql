-- Fotos de la clienta (portado de EINA, adaptado a Manojitos).
--   customer-avatars: foto de perfil, pública. Ya existía en Manojitos con sus políticas por
--                     dueña del archivo (owner): se conservan, solo se fija tamaño y formatos.
--   customer-kyc:     cédula, rostro y selfie de verificación. PRIVADO: solo la dueña y la
--                     administración pueden verlos, siempre con enlaces firmados que vencen.
-- Cada clienta escribe únicamente en su carpeta: <user_id>/archivo.
-- Sin DROP: cada política se crea solo si falta (se puede reaplicar).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('customer-avatars', 'customer-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('customer-kyc', 'customer-kyc', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'Clienta sube su avatar') then
    create policy "Clienta sube su avatar" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'customer-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'Clienta cambia su avatar') then
    create policy "Clienta cambia su avatar" on storage.objects
      for update to authenticated
      using (bucket_id = 'customer-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'customer-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'KYC visible para su dueña y la administración') then
    create policy "KYC visible para su dueña y la administración" on storage.objects
      for select to authenticated
      using (bucket_id = 'customer-kyc' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'Clienta sube sus documentos KYC') then
    create policy "Clienta sube sus documentos KYC" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'customer-kyc' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'Clienta reemplaza sus documentos KYC') then
    create policy "Clienta reemplaza sus documentos KYC" on storage.objects
      for update to authenticated
      using (bucket_id = 'customer-kyc' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'customer-kyc' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'Administración borra documentos KYC') then
    create policy "Administración borra documentos KYC" on storage.objects
      for delete to authenticated
      using (bucket_id = 'customer-kyc' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
  end if;
end $$;
