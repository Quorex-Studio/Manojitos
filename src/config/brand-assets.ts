// Imágenes de marca. Para otra tienda, reemplaza estos archivos (misma ruta y nombre)
// o cambia aquí la ruta del import. El resto de la app los toma de este módulo.
import logo from '@/assets/logo.jpeg';
import mascot from '@/assets/stitch-rosa-mascot.png';

/**
 * false = el logo es un símbolo (redondo) y el nombre se escribe al lado en texto (Manojitos).
 * true  = los PNG ya traen el nombre dibujado (logotipo completo), como en EINA.
 */
export const BRAND_LOGO_IS_WORDMARK = false;

// Variantes por tema: Manojitos usa el mismo logo en claro y en oscuro.
export const BRAND_LOGO_LIGHT = logo;
export const BRAND_LOGO_DARK = logo;
export const BRAND_LOGO_SHOP_LIGHT = logo;
export const BRAND_LOGO_SHOP_DARK = logo;
export const BRAND_ISOTIPO_LIGHT = logo;
export const BRAND_ISOTIPO_DARK = logo;
/** Motivo gráfico de la marca (decoración). Manojitos no tiene: null = no se dibuja. */
export const BRAND_STAR: string | null = null;
export const BRAND_STAR_WINE: string | null = null;
// Logo por defecto y avatar de la asistente (Ángela, mascota rosa)
export const BRAND_LOGO = logo;
export const BRAND_MASCOT = mascot;
