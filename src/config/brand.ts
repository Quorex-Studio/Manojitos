// Configuración de marca de la tienda.
// Para lanzar otra tienda con esta misma plantilla, basta con cambiar estas
// variables en el .env (o en Vercel) — no hay que tocar el código.

const env = import.meta.env;

export const BRAND = {
  /** Nombre comercial que se muestra en toda la app */
  name: env.VITE_BRAND_NAME || 'EINA',
  /** Descripción corta (SEO / footer) */
  tagline: env.VITE_BRAND_TAGLINE || 'Tu tienda de confianza con los mejores productos.',
  /** Correo de contacto público */
  contactEmail: env.VITE_BRAND_CONTACT_EMAIL || 'contacto@eina.shop',
  /** Correo de soporte */
  supportEmail: env.VITE_BRAND_SUPPORT_EMAIL || env.VITE_BRAND_CONTACT_EMAIL || 'soporte@eina.shop',
  /** Usuario de Instagram sin @ */
  instagram: env.VITE_BRAND_INSTAGRAM || 'eina.shop',
  /** Prefijo para claves de localStorage (evita mezclar datos entre tiendas) */
  storageKey: env.VITE_BRAND_STORAGE_KEY || 'eina',
} as const;

export const BRAND_NAME = BRAND.name;
export const BRAND_NAME_UPPER = BRAND.name.toUpperCase();
export const BRAND_INSTAGRAM_URL = `https://www.instagram.com/${BRAND.instagram}/`;
export const BRAND_FILE_SLUG = BRAND.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

/** Construye una clave de localStorage con el prefijo de la marca */
export const storageKey = (key: string, sep = '_') => `${BRAND.storageKey}${sep}${key}`;
