import { supabase } from '@/integrations/supabase/client';

/**
 * Fotos de la clienta.
 *  - Perfil → bucket público `customer-avatars` (se guarda la URL pública).
 *  - Cédula / rostro / selfie → bucket PRIVADO `customer-kyc`. Se guarda `kyc://<ruta>` y
 *    para verla se pide un enlace firmado que vence (solo la dueña o la administración).
 * Cada archivo va en la carpeta del usuario: <user_id>/archivo (lo exigen las políticas).
 */
const KYC_PREFIX = 'kyc://';
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // antes de comprimir

/** Reduce la foto a JPEG (máx. 1024 px) en el navegador; si no se puede, sube el original. */
export async function compressImage(file: File, maxSide = 1024, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // formato que el navegador no sabe leer (p. ej. HEIC fuera de Safari)
  }
}

const extensionOf = (blob: Blob, name?: string) =>
  blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp'
    : (name?.split('.').pop() || 'jpg').toLowerCase();

async function upload(bucket: string, userId: string, file: File, label: string) {
  const blob = await compressImage(file);
  const path = `${userId}/${label}_${Date.now()}.${extensionOf(blob, file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: blob.type || file.type || 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) throw error;
  return path;
}

/** Sube la foto de perfil y devuelve su URL pública. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const path = await upload('customer-avatars', userId, file, 'avatar');
  return supabase.storage.from('customer-avatars').getPublicUrl(path).data.publicUrl;
}

/** Sube un documento de verificación al bucket privado y devuelve la referencia a guardar. */
export async function uploadKycFile(userId: string, type: 'dni' | 'face' | 'verification', file: File): Promise<string> {
  return KYC_PREFIX + (await upload('customer-kyc', userId, file, type));
}

/** Convierte la referencia guardada en un enlace que se puede mostrar (firmado si es privado). */
export async function resolveKycUrl(value: string | null | undefined, expiresIn = 3600): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith(KYC_PREFIX)) return value; // enlaces antiguos
  const { data, error } = await supabase.storage.from('customer-kyc').createSignedUrl(value.slice(KYC_PREFIX.length), expiresIn);
  return error ? null : data.signedUrl;
}

/** Mensaje claro según el error de Storage. */
export function uploadErrorMessage(error: unknown): string {
  const msg = String((error as { message?: string })?.message || error || '').toLowerCase();
  if (msg.includes('mime') || msg.includes('type')) return 'Ese formato no se puede subir. Usa una foto JPG o PNG.';
  if (msg.includes('size') || msg.includes('large')) return 'La foto pesa demasiado. Prueba con otra o recórtala.';
  if (msg.includes('bucket')) return 'El almacenamiento de fotos no está disponible. Avísale a la tienda.';
  if (msg.includes('policy') || msg.includes('row-level') || msg.includes('unauthorized')) return 'Tu sesión venció. Vuelve a iniciar sesión e inténtalo de nuevo.';
  return 'No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.';
}
