import { formatPhone } from './venezuela';

/** Nombre visible de cada método (ventas, recibos, reportes). */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia Bs',
  zelle: 'Zelle',
  binance: 'Binance',
  zinli: 'Zinli',
  wally: 'Wally',
  efectivo_usd: 'Efectivo $',
  efectivo_bs: 'Efectivo Bs',
};

// Nombres legibles de los datos de cada método de pago (payment_methods.config).
// Los usan el checkout (para mostrar los datos a la clienta) y Configuración (para editarlos).
export const PAYMENT_CONFIG_LABELS: Record<string, string> = {
  bank: 'Banco',
  phone: 'Teléfono',
  ci: 'Cédula / RIF',
  name: 'Titular',
  account: 'Número de cuenta',
  accountNumber: 'Número de cuenta',
  email: 'Correo',
  pay_id: 'Binance Pay ID',
  wallet: 'Dirección USDT',
  network: 'Red',
};

export const paymentConfigLabel = (key: string) =>
  PAYMENT_CONFIG_LABELS[key] || key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

/** Datos con valor, en orden legible. `display` es para leer; `value` es lo que se copia (sin espacios en teléfonos). */
export function paymentConfigEntries(config?: Record<string, unknown> | null) {
  const order = Object.keys(PAYMENT_CONFIG_LABELS);
  return Object.entries(config || {})
    .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
    .map(([key, value]) => {
      const display = key === 'phone' ? formatPhone(String(value)) : String(value);
      return { key, label: paymentConfigLabel(key), display, value: key === 'phone' ? display.replace(/ /g, '') : display };
    });
}
