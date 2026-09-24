/**
 * Fecha local en formato YYYY-MM-DD.
 * No usar `toISOString().split('T')[0]`: eso es UTC y en Venezuela (UTC-4) adelanta el día
 * a partir de las 8 p. m. (pagos, reportes y vencimientos caían en la fecha equivocada).
 */
export const localDateISO = (date: Date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
