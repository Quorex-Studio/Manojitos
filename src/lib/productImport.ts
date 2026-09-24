/**
 * Lectura flexible de listas de productos (Treinta, Excel, Google Sheets, CSV, tiendas online).
 *
 * El objetivo es aceptar el archivo "tal cual" lo exporta cada app:
 * - Cualquier hoja y cualquier fila de encabezado (Treinta y otros ponen títulos arriba).
 * - Nombres de columna en español o inglés, con o sin acentos, mayúsculas o símbolos.
 * - Números como "$ 1.234,56", "1,234.56", "12,5", "Bs. 850", "15 und".
 * La interfaz permite corregir el mapeo a mano si la detección no acierta.
 */
import * as XLSX from 'xlsx';

export type ImportField =
  | 'name'
  | 'price'
  | 'stock'
  | 'category'
  | 'description'
  | 'cost'
  | 'code'
  | 'image'
  | 'minStock';

export const IMPORT_FIELDS: { key: ImportField; label: string; required?: boolean; hint: string }[] = [
  { key: 'name', label: 'Nombre del producto', required: true, hint: 'Ej: Nombre, Producto, Nombre del producto' },
  { key: 'price', label: 'Precio de venta', required: true, hint: 'Ej: Precio, Precio de venta, Valor' },
  { key: 'stock', label: 'Cantidad / stock', hint: 'Si falta, se importa con 0 unidades' },
  { key: 'category', label: 'Categoría', hint: 'Ej: Categoría, Tipo, Grupo' },
  { key: 'description', label: 'Descripción', hint: 'Opcional' },
  { key: 'cost', label: 'Costo', hint: 'Precio de costo o de compra' },
  { key: 'code', label: 'Código / SKU', hint: 'Solo para detectar repetidos del archivo' },
  { key: 'image', label: 'Imagen (enlace)', hint: 'Una URL https://…' },
  { key: 'minStock', label: 'Stock mínimo', hint: 'Para la alerta de reponer' },
];

/** Sinónimos por campo, ya normalizados (minúsculas, sin acentos ni símbolos). */
const SYNONYMS: Record<ImportField, string[]> = {
  name: ['nombre del producto', 'nombre producto', 'nombre', 'producto', 'productos', 'articulo', 'item', 'name', 'product', 'product name', 'title', 'titulo', 'descripcion corta', 'nombre_producto'],
  price: ['precio de venta', 'precio venta', 'precio', 'pvp', 'precio al publico', 'precio unitario', 'valor', 'valor venta', 'valor de venta', 'price', 'sale price', 'regular price', 'variant price', 'precio usd', 'precio_usd', 'precio detal'],
  stock: ['stock actual', 'stock', 'cantidad', 'cantidad disponible', 'unidades', 'unidades disponibles', 'existencia', 'existencias', 'inventario', 'disponible', 'qty', 'quantity', 'inventory', 'variant inventory qty', 'stock quantity'],
  category: ['categoria', 'categorias', 'category', 'categories', 'tipo', 'grupo', 'linea', 'familia', 'departamento', 'coleccion', 'product type', 'type'],
  description: ['descripcion', 'description', 'detalle', 'detalles', 'body html', 'body', 'notas', 'observaciones'],
  cost: ['precio de costo', 'precio costo', 'costo', 'costo unitario', 'precio de compra', 'precio compra', 'cost', 'cost per item', 'unit cost'],
  code: ['codigo', 'codigo de barras', 'cod', 'referencia', 'ref', 'sku', 'barcode', 'ean', 'upc', 'code', 'id producto', 'variant sku'],
  image: ['imagen', 'imagenes', 'foto', 'url imagen', 'image', 'images', 'image src', 'image url', 'picture', 'imagen url'],
  minStock: ['stock minimo', 'minimo', 'cantidad minima', 'min stock', 'minimum stock', 'punto de reorden', 'alerta stock'],
};

export const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-./()[\]:#*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Qué tan bien una cabecera corresponde a un campo (0 = nada, 100 = exacto). */
function headerScore(header: string, field: ImportField): number {
  const h = normalizeHeader(header);
  if (!h) return 0;
  let best = 0;
  for (const syn of SYNONYMS[field]) {
    if (h === syn) return 100;
    if (h.startsWith(syn + ' ') || h.endsWith(' ' + syn)) best = Math.max(best, 70 + syn.length);
    else if (syn.length >= 4 && h.includes(syn)) best = Math.max(best, 50 + syn.length);
  }
  return best;
}

/** Asigna cada campo a la columna que mejor le corresponde, sin repetir columnas. */
export function autoMapColumns(headers: string[]): Partial<Record<ImportField, number>> {
  const candidates: { field: ImportField; col: number; score: number }[] = [];
  headers.forEach((header, col) => {
    (Object.keys(SYNONYMS) as ImportField[]).forEach(field => {
      const score = headerScore(header, field);
      if (score > 0) candidates.push({ field, col, score });
    });
  });
  candidates.sort((a, b) => b.score - a.score);
  const mapping: Partial<Record<ImportField, number>> = {};
  const usedCols = new Set<number>();
  for (const c of candidates) {
    if (mapping[c.field] !== undefined || usedCols.has(c.col)) continue;
    mapping[c.field] = c.col;
    usedCols.add(c.col);
  }
  return mapping;
}

/**
 * Convierte texto con formato de dinero/cantidad a número.
 * Decide el separador decimal mirando el último "," o "." y cuántos dígitos le siguen.
 */
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/[^\d\-(]/g, ''));
  // Quita letras/símbolos y separadores sueltos al borde ("Bs. 850" -> "850")
  s = s.replace(/[^\d.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // El que aparece último es el decimal: 1.234,56 · 1,234.56
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    s = s.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = s.split(sep);
    const tail = parts[parts.length - 1];
    // "1.234" o "12,500" (grupos de 3) son miles; "12,5" o "3.99" son decimales
    const looksThousands = parts.length > 2 || (tail.length === 3 && parts[0].length >= 1 && parts[0] !== '0');
    s = looksThousands ? parts.join('') : parts.slice(0, -1).join('') + '.' + tail;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export interface SheetData {
  name: string;
  rows: unknown[][];
}

/** Lee cualquier archivo soportado y devuelve sus hojas como filas crudas. */
export async function readWorkbook(file: File): Promise<SheetData[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'json') {
    const data = JSON.parse(await file.text());
    const list: Record<string, unknown>[] = Array.isArray(data) ? data : data.products || data.productos || data.items || data.data || [];
    const headers = Array.from(new Set(list.flatMap(o => Object.keys(o))));
    return [{ name: 'JSON', rows: [headers, ...list.map(o => headers.map(h => o[h]))] }];
  }
  let workbook: XLSX.WorkBook;
  if (['csv', 'tsv', 'txt'].includes(ext)) {
    // Texto: se detecta el separador (, ; tab |) y se lee como texto para no perder decimales
    let text = await file.text();
    if (text.includes('�')) {
      // Archivo en Latin-1 (común en Excel de Windows): re-decodificar
      text = new TextDecoder('windows-1252').decode(await file.arrayBuffer());
    }
    const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
    const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 } as Record<string, number>;
    Object.keys(counts).forEach(sep => { counts[sep] = firstLines.split(sep).length - 1; });
    const FS = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    workbook = XLSX.read(text, { type: 'string', FS, raw: true });
  } else {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  }
  return workbook.SheetNames.map(name => ({
    name,
    rows: (XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' }) as unknown[][])
      .filter(row => row.some(cell => String(cell ?? '').trim() !== '')),
  })).filter(sheet => sheet.rows.length > 0);
}

/** Busca la fila de encabezado en las primeras filas (la que mejor coincide con campos conocidos). */
export function detectHeaderRow(rows: unknown[][]): number {
  let bestRow = 0;
  let bestScore = -1;
  rows.slice(0, 20).forEach((row, i) => {
    const mapping = autoMapColumns(row.map(c => String(c ?? '')));
    const score = Object.keys(mapping).length * 10 + (mapping.name !== undefined ? 15 : 0) + (mapping.price !== undefined ? 15 : 0);
    if (score > bestScore) { bestScore = score; bestRow = i; }
  });
  return bestRow;
}

/** Elige la hoja con más filas que parezcan productos. */
export function pickBestSheet(sheets: SheetData[]): number {
  let best = 0;
  let bestScore = -1;
  sheets.forEach((sheet, i) => {
    const header = sheet.rows[detectHeaderRow(sheet.rows)] || [];
    const mapping = autoMapColumns(header.map(c => String(c ?? '')));
    const score = (mapping.name !== undefined ? 1000 : 0) + (mapping.price !== undefined ? 1000 : 0) + sheet.rows.length;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

export interface ImportRow {
  rowNumber: number;
  name: string;
  price: number | null;
  stock: number;
  category: string;
  description: string;
  cost: number | null;
  code: string;
  image: string;
  minStock: number | null;
  errors: string[];
  warnings: string[];
}

export function buildRows(
  rows: unknown[][],
  headerRow: number,
  mapping: Partial<Record<ImportField, number>>,
  options: { priceFactor?: number } = {}
): ImportRow[] {
  const factor = options.priceFactor && options.priceFactor > 0 ? options.priceFactor : 1;
  const cell = (row: unknown[], field: ImportField) => {
    const col = mapping[field];
    return col === undefined ? '' : row[col];
  };
  const text = (row: unknown[], field: ImportField) => String(cell(row, field) ?? '').replace(/\s+/g, ' ').trim();

  const seenCodes = new Map<string, number>();
  return rows.slice(headerRow + 1).map((row, i) => {
    const rowNumber = headerRow + i + 2; // número de fila como lo ve la persona en Excel
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = text(row, 'name').slice(0, 100);
    if (!name) errors.push('Falta el nombre');

    const rawPrice = parseNumber(cell(row, 'price'));
    const price = rawPrice === null ? null : Math.round((rawPrice / factor) * 100) / 100;
    if (price === null) errors.push('Falta el precio');
    else if (price < 0) errors.push('Precio negativo');
    else if (price === 0) warnings.push('Precio en 0');

    const rawStock = parseNumber(cell(row, 'stock'));
    let stock = 0;
    if (mapping.stock === undefined || rawStock === null) {
      if (mapping.stock !== undefined) warnings.push('Sin cantidad: se importa con 0');
    } else if (rawStock < 0) {
      warnings.push('Cantidad negativa: se importa con 0');
    } else {
      stock = Math.floor(rawStock);
      if (stock !== rawStock) warnings.push('Cantidad con decimales: se redondeó hacia abajo');
    }

    const rawCost = parseNumber(cell(row, 'cost'));
    const cost = rawCost === null || rawCost < 0 ? null : Math.round((rawCost / factor) * 100) / 100;

    const image = text(row, 'image').split(/[\s,;]+/)[0] || '';
    if (image && !/^https?:\/\//i.test(image)) warnings.push('La imagen no es un enlace: se omite');

    const code = text(row, 'code');
    if (code) {
      const prev = seenCodes.get(code.toLowerCase());
      if (prev) warnings.push(`Código repetido (igual que la fila ${prev})`);
      else seenCodes.set(code.toLowerCase(), rowNumber);
    }

    const minStockRaw = parseNumber(cell(row, 'minStock'));

    return {
      rowNumber,
      name,
      price,
      stock,
      category: text(row, 'category').slice(0, 60),
      description: text(row, 'description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 255),
      cost,
      code,
      image: /^https?:\/\//i.test(image) ? image : '',
      minStock: minStockRaw === null || minStockRaw < 0 ? null : Math.floor(minStockRaw),
      errors,
      warnings,
    };
  })
    // Filas vacías, de totales o notas al final no cuentan como productos
    .filter(r => !(r.errors.includes('Falta el nombre') && r.price === null))
    .filter(r => !/^(sub)?totale?s?\b|^total general$/i.test(normalizeHeader(r.name)));
}

export const productKey = (name: string) => normalizeHeader(name);
