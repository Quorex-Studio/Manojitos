// Prefijos telefónicos y tipos de documento de Venezuela, más helpers para guardarlos
// siempre en el mismo formato: teléfono "+58XXXXXXXXXX" y documento "V-12345678".

export const MOBILE_PREFIXES = ['0412', '0414', '0416', '0422', '0424', '0426'] as const;

// Códigos de área de telefonía fija (CONATEL)
export const LANDLINE_PREFIXES = [
  '0212', '0234', '0235', '0237', '0238', '0239', '0240', '0241', '0242', '0243', '0244', '0245',
  '0246', '0247', '0248', '0249', '0251', '0252', '0253', '0254', '0255', '0256', '0257', '0258',
  '0259', '0261', '0262', '0263', '0264', '0265', '0266', '0267', '0268', '0269', '0271', '0272',
  '0273', '0274', '0275', '0276', '0277', '0278', '0279', '0281', '0282', '0283', '0284', '0285',
  '0286', '0287', '0288', '0289', '0291', '0292', '0293', '0294', '0295',
] as const;

export const ALL_PHONE_PREFIXES: readonly string[] = [...MOBILE_PREFIXES, ...LANDLINE_PREFIXES];

export const DOC_TYPES = [
  { value: 'V', label: 'V · Venezolano' },
  { value: 'E', label: 'E · Extranjero' },
  { value: 'J', label: 'J · Jurídico (RIF)' },
  { value: 'G', label: 'G · Gobierno' },
  { value: 'P', label: 'P · Pasaporte' },
] as const;

export type DocType = typeof DOC_TYPES[number]['value'];

/** Separa un teléfono guardado ("+584141234567", "04141234567", "4141234567"...) en prefijo y número. */
export function splitPhone(value?: string | null): { prefix: string; number: string } {
  let digits = (value || '').replace(/\D/g, '');
  if (digits.startsWith('58') && digits.length >= 12) digits = '0' + digits.slice(2);
  else if (digits.length === 10 && !digits.startsWith('0')) digits = '0' + digits;
  const prefix = ALL_PHONE_PREFIXES.find(p => digits.startsWith(p));
  if (prefix) return { prefix, number: digits.slice(4, 11) };
  return { prefix: '0414', number: digits.replace(/^0/, '').slice(-7) };
}

/** Une prefijo + número en formato internacional (+58...). Devuelve '' si no hay número. */
export function joinPhone(prefix: string, number: string): string {
  const n = number.replace(/\D/g, '').slice(0, 7);
  if (!n) return '';
  return `+58${prefix.replace(/^0/, '')}${n}`;
}

/** Número para CallMeBot / WhatsApp: siempre internacional 58 + número sin el 0 ("0414 123 4567" → "584141234567"). */
export function toWhatsAppPhone(value?: string | null): string {
  let d = String(value ?? '').replace(/\D/g, '').replace(/^00/, '');
  if (d.startsWith('58')) d = d.slice(2);
  d = d.replace(/^0+/, '');
  return d ? `58${d}` : '';
}

/** true si el teléfono tiene el formato completo que exige la base. */
export const isCompletePhone = (value?: string | null) => /^\+58(?:4(?:12|14|16|22|24|26)|2\d{2})\d{7}$/.test(value || '');

/** Teléfono para mostrar: "0414 123 4567". */
export function formatPhone(value?: string | null): string {
  if (!value) return '';
  const { prefix, number } = splitPhone(value);
  return number ? `${prefix} ${number.slice(0, 3)} ${number.slice(3)}`.trim() : value;
}

/** Separa un documento guardado ("V-12345678", "v12345678", "12345678") en tipo y número. */
export function splitDoc(value?: string | null): { type: DocType; number: string } {
  const raw = (value || '').toUpperCase().trim();
  const m = raw.match(/^([VEJGP])\s*-?\s*(.*)$/);
  const type = (m?.[1] || 'V') as DocType;
  return { type, number: (m ? m[2] : raw).replace(/\D/g, '').slice(0, 10) };
}

/** Une tipo + número: "V-12345678". Devuelve '' si no hay número. */
export function joinDoc(type: string, number: string): string {
  const n = number.replace(/\D/g, '').slice(0, 10);
  return n ? `${type}-${n}` : '';
}
