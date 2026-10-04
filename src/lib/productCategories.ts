/**
 * Categorías de producto configurables (Configuración → Categorías).
 * Cada categoría dice qué detalle pide el producto, así el formulario solo muestra lo que aplica:
 * un perfume pide su contenido en ml, una blusa sus tallas, un bolso sus medidas.
 */
export type DetailKind = 'ninguno' | 'contenido' | 'medidas' | 'tallas' | 'tonos';

export interface ProductCategory {
  id: string;
  name: string;
  detail_kind: DetailKind;
  /** tallas: tallas permitidas · contenido: unidades (ml, g) · tonos: tonos sugeridos */
  options: string[];
  sort_order: number;
}

export const DETAIL_KINDS: Record<DetailKind, { label: string; help: string; optionsLabel?: string; optionsHelp?: string; defaults?: string[] }> = {
  ninguno: { label: 'Sin detalle', help: 'Solo nombre, precio y stock.' },
  contenido: {
    label: 'Contenido (ml, g…)', help: 'Cada producto indica su contenido neto, p. ej. 30 ml.',
    optionsLabel: 'Unidades', optionsHelp: 'Las que se pueden elegir al cargar el producto.', defaults: ['ml', 'g'],
  },
  medidas: { label: 'Medidas', help: 'Cada producto indica sus medidas, p. ej. 20 × 15 cm.' },
  tallas: {
    label: 'Tallas', help: 'Se marcan las tallas disponibles y la clienta elige una al comprar.',
    optionsLabel: 'Tallas de esta categoría', optionsHelp: 'En orden, de la más pequeña a la más grande.', defaults: ['XS', 'S', 'M', 'L', 'XL'],
  },
  tonos: {
    label: 'Tonos o colores', help: 'Se escriben los tonos disponibles y la clienta elige uno al comprar.',
    optionsLabel: 'Tonos sugeridos (opcional)', optionsHelp: 'Aparecen como atajos al cargar un producto.',
  },
};

export const DETAIL_KIND_ORDER: DetailKind[] = ['ninguno', 'contenido', 'medidas', 'tallas', 'tonos'];

/** Detalle que se guarda en products.presentation */
export const usesPresentation = (kind?: DetailKind | null) => kind === 'contenido' || kind === 'medidas';
/** Detalle que se guarda en products.sizes y la clienta elige al comprar */
export const usesVariants = (kind?: DetailKind | null) => kind === 'tallas' || kind === 'tonos';

/** Nombre de la opción que elige la clienta: "Talla", "Tono" u "Opción". */
export const variantLabel = (kind?: DetailKind | null) => (kind === 'tallas' ? 'Talla' : kind === 'tonos' ? 'Tono' : 'Opción');

/** "30 ml" → { amount: '30', unit: 'ml' } */
export function splitContent(presentation: string | null | undefined, units: string[]): { amount: string; unit: string } {
  const m = String(presentation || '').trim().match(/^([\d.,]+)\s*(.*)$/);
  const unit = m?.[2] && units.includes(m[2]) ? m[2] : units[0] || 'ml';
  return { amount: m?.[1] ?? '', unit };
}

export function joinContent(amount: string, unit: string): string | null {
  const n = amount.trim().replace(',', '.');
  return n && Number(n) > 0 ? `${n} ${unit}` : null;
}

/** Limpia una lista de opciones: sin vacíos ni repetidos (sin importar mayúsculas), máximo 30. */
export function cleanOptions(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = raw.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out.slice(0, 30);
}

/** Opciones que elige la clienta. "Única" (dato viejo) equivale a no tener opciones. */
export const productVariants = (sizes?: string[] | null): string[] => (sizes || []).filter(s => s && s !== 'Única');
