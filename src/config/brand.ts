// Configuración de marca de la tienda.
// Para lanzar otra tienda con esta misma plantilla, basta con cambiar estas
// variables en el .env (o en Vercel) — no hay que tocar el código.
// Lista completa en .env.example; guía en PLANTILLA.md.

const env = import.meta.env;

export const BRAND = {
  /** Nombre comercial que se muestra en toda la app */
  name: env.VITE_BRAND_NAME || 'Manojitos',
  /** Descripción corta (SEO / footer) */
  tagline: env.VITE_BRAND_TAGLINE || 'Tu tienda de confianza con los mejores productos. Calidad, variedad y los mejores precios para ti.',
  /** Dominio público de la tienda (sin https://) */
  domain: env.VITE_BRAND_DOMAIN || 'manojitos.vercel.app',
  /** Correo de contacto público */
  contactEmail: env.VITE_BRAND_CONTACT_EMAIL || 'contacto@manojitos.com',
  /** Correo de soporte */
  supportEmail: env.VITE_BRAND_SUPPORT_EMAIL || env.VITE_BRAND_CONTACT_EMAIL || 'soporte@manojitos.com',
  /** Usuario de Instagram sin @ */
  instagram: env.VITE_BRAND_INSTAGRAM || 'manojitos.shop',
  /** WhatsApp / teléfono de atención en formato internacional (+58 412 0000000). Vacío = se oculta */
  whatsapp: env.VITE_BRAND_WHATSAPP || '+58 426-3863042',
  /** Horario de atención (texto libre) */
  hours: env.VITE_BRAND_HOURS || 'Lunes a Viernes: 8:00 AM - 6:00 PM · Sábados: 9:00 AM - 1:00 PM',
  /** Ubicación mostrada en el footer */
  /** Color principal de marca (hex): recibos, PDF y barra del navegador */
  color: env.VITE_BRAND_THEME_COLOR || '#d69729',
  /** Rubro corto para recibos y encabezados, p. ej. "Boutique · Ropa y accesorios" */
  category: env.VITE_BRAND_CATEGORY || 'Boutique · Ropa, accesorios y lencería',
  location: env.VITE_BRAND_LOCATION || 'Venezuela',
  /** Nombre de la asistente virtual (chat con IA) */
  assistantName: env.VITE_ASSISTANT_NAME || 'Ángela',
  /** Prefijo para claves de localStorage (evita mezclar datos entre tiendas) */
  storageKey: env.VITE_BRAND_STORAGE_KEY || 'manojitos',
} as const;

export const BRAND_NAME = BRAND.name;
export const BRAND_NAME_UPPER = BRAND.name.toUpperCase();
export const BRAND_SITE_URL = `https://${BRAND.domain}`;
export const BRAND_WHATSAPP_URL = BRAND.whatsapp ? `https://wa.me/${BRAND.whatsapp.replace(/\D/g, '')}` : '';
export const BRAND_INSTAGRAM_URL = `https://www.instagram.com/${BRAND.instagram}/`;
export const BRAND_FILE_SLUG = BRAND.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

/** Construye una clave de localStorage con el prefijo de la marca */
export const storageKey = (key: string, sep = '_') => `${BRAND.storageKey}${sep}${key}`;

/** Color de marca como [r, g, b] para jsPDF */
export const BRAND_COLOR_RGB: [number, number, number] = (() => {
  const hex = BRAND.color.replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.split('').map((c: string) => c + c).join('') : hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
})();
