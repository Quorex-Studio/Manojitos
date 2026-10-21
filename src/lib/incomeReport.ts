import { paymentLabel } from '@/lib/receipt';

/**
 * Ingresos por mes y método de pago: el dinero que ENTRÓ (abonos y pagos registrados en
 * `sale_payments`, sin los anulados), no lo vendido. Una venta fiada cuenta el mes en que
 * se cobra cada abono, y en el método con que se pagó.
 */
export interface IncomePaymentRow {
  amount_usd: number | string;
  amount_bs?: number | string | null;
  payment_method: string | null;
  status?: string | null;
  created_at: string;
}

/** Orden fijo (el color de cada uno no cambia al filtrar). Ocho métodos con color propio (validados); el resto (p. ej. Wally) se suma en «Otros» */
export const INCOME_METHODS = ['pago_movil', 'transferencia', 'zelle', 'binance', 'cashea', 'zinli', 'efectivo_usd', 'efectivo_bs'] as const;
export const OTHER_METHOD = 'otro';

export interface IncomeMonth {
  /** YYYY-MM */
  key: string;
  label: string;
  total: number;
  totalBs: number;
  count: number;
  /** USD por método (clave del método) */
  byMethod: Record<string, number>;
  /** Bs recibidos por método (solo los pagos que traen el monto en Bs) */
  byMethodBs: Record<string, number>;
}

export interface IncomeSummary {
  months: IncomeMonth[];
  /** Métodos que tienen dinero en el período, en el orden fijo */
  methods: string[];
  totals: { total: number; totalBs: number; count: number; byMethod: Record<string, number> };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const MONTH_FMT = new Intl.DateTimeFormat('es-VE', { month: 'long' });

export const incomeMethodKey = (m: string | null | undefined) => {
  const k = (m || '').trim().toLowerCase();
  if (k === 'efectivo') return 'efectivo_usd';
  return (INCOME_METHODS as readonly string[]).includes(k) ? k : OTHER_METHOD;
};
export const incomeMethodName = (key: string) => (key === OTHER_METHOD ? 'Otros (Wally y más)' : paymentLabel(key) || key);

/** Mes local (YYYY-MM) de un instante */
const monthOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Los 12 meses de un año (los futuros quedan fuera), con lo cobrado por método. */
export function summarizeIncomeByMonth(payments: IncomePaymentRow[], year: number, now = new Date()): IncomeSummary {
  const lastMonth = year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth() + 1;
  const months: IncomeMonth[] = Array.from({ length: lastMonth }, (_, i) => {
    const label = MONTH_FMT.format(new Date(year, i, 1));
    return { key: `${year}-${String(i + 1).padStart(2, '0')}`, label: label.charAt(0).toUpperCase() + label.slice(1), total: 0, totalBs: 0, count: 0, byMethod: {}, byMethodBs: {} };
  });
  const byKey = new Map(months.map(m => [m.key, m]));
  const totals = { total: 0, totalBs: 0, count: 0, byMethod: {} as Record<string, number> };

  for (const p of payments) {
    if (p.status === 'void') continue;
    const m = byKey.get(monthOf(p.created_at));
    if (!m) continue;
    const usd = Number(p.amount_usd) || 0;
    const bs = Number(p.amount_bs) || 0;
    if (usd <= 0) continue;
    const key = incomeMethodKey(p.payment_method);
    m.total += usd;
    m.totalBs += bs;
    m.count += 1;
    m.byMethod[key] = (m.byMethod[key] || 0) + usd;
    if (bs > 0) m.byMethodBs[key] = (m.byMethodBs[key] || 0) + bs;
    totals.total += usd;
    totals.totalBs += bs;
    totals.count += 1;
    totals.byMethod[key] = (totals.byMethod[key] || 0) + usd;
  }

  for (const m of months) {
    m.total = round2(m.total);
    m.totalBs = round2(m.totalBs);
    for (const k of Object.keys(m.byMethod)) m.byMethod[k] = round2(m.byMethod[k]);
    for (const k of Object.keys(m.byMethodBs)) m.byMethodBs[k] = round2(m.byMethodBs[k]);
  }
  totals.total = round2(totals.total);
  totals.totalBs = round2(totals.totalBs);
  for (const k of Object.keys(totals.byMethod)) totals.byMethod[k] = round2(totals.byMethod[k]);

  const methods = [...INCOME_METHODS, OTHER_METHOD].filter(k => (totals.byMethod[k] || 0) > 0);
  return { months, methods, totals };
}
