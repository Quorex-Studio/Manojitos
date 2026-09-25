/**
 * Convierte enlaces "para compartir" en enlaces directos a la imagen.
 * Google Drive: .../file/d/<id>/view abre una página de Drive (no una imagen), así que la
 * foto no carga en la tienda. lh3.googleusercontent.com/d/<id>=w1200 entrega la imagen
 * optimizada. El archivo debe estar compartido como "Cualquier persona con el enlace".
 */
const DRIVE_ID = /(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([\w-]{20,})/i;

export function normalizeImageUrl(url: string | null | undefined): string | null {
  const u = String(url ?? '').trim();
  if (!u) return null;
  const drive = u.match(DRIVE_ID);
  if (drive) return `https://lh3.googleusercontent.com/d/${drive[1]}=w1200`;
  // Dropbox: dl=0 muestra una página; raw=1 entrega el archivo
  if (/^https:\/\/(www\.)?dropbox\.com\//i.test(u)) return u.replace(/([?&])dl=0/, '$1raw=1').replace(/^(?!.*[?&]raw=1)(.*)$/, (m) => m.includes('?') ? `${m}&raw=1` : `${m}?raw=1`);
  return u;
}

/** Aplica la conversión a filas que traen image_url (productos, carrito). */
export const withDirectImage = <T extends { image_url: string | null }>(row: T): T =>
  row.image_url ? { ...row, image_url: normalizeImageUrl(row.image_url) } : row;
