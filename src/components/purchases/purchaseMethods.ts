import { PAYMENT_METHOD_LABELS } from '@/lib/paymentMethodFields';

/** Métodos con los que se paga a proveedores y gastos (incluye los de compras en el exterior). */
export const PURCHASE_METHODS = ['zelle', 'tarjeta', 'paypal', 'binance', 'pago_movil', 'transferencia', 'zinli', 'wally', 'efectivo_usd', 'efectivo_bs'] as const;

const EXTRA: Record<string, string> = { tarjeta: 'Tarjeta (crédito/débito)', paypal: 'PayPal' };

export const purchaseMethodName = (m: string | null | undefined) => (m ? EXTRA[m] ?? PAYMENT_METHOD_LABELS[m] ?? m : '—');
