import { describe, it, expect } from 'vitest';
import { summarizeIncomeByMonth, incomeMethodKey } from './incomeReport';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();

describe('ingresos por mes y método', () => {
  const payments = [
    { amount_usd: 10, payment_method: 'zelle', created_at: at(2026, 1, 5) },
    { amount_usd: 5.555, amount_bs: 2000, payment_method: 'pago_movil', created_at: at(2026, 1, 20) },
    { amount_usd: 20, payment_method: 'zelle', created_at: at(2026, 3, 1) },
    { amount_usd: 7, payment_method: 'zelle', status: 'void', created_at: at(2026, 3, 2) },
    { amount_usd: 3, payment_method: 'efectivo', created_at: at(2026, 3, 3) },
    { amount_usd: 4, payment_method: 'cripto_raro', created_at: at(2026, 3, 4) },
    { amount_usd: 99, payment_method: 'zelle', created_at: at(2025, 12, 31) },
  ];
  const now = new Date(2026, 3, 15); // 15-abr-2026

  it('solo los meses del año hasta hoy, sin anulados ni otros años', () => {
    const s = summarizeIncomeByMonth(payments, 2026, now);
    expect(s.months.map(m => m.key)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(s.months[0].total).toBe(15.56);
    expect(s.months[0].byMethod).toEqual({ zelle: 10, pago_movil: 5.56 });
    expect(s.months[0].byMethodBs).toEqual({ pago_movil: 2000 });
    expect(s.months[1].total).toBe(0);
    expect(s.months[2].byMethod).toEqual({ zelle: 20, efectivo_usd: 3, otro: 4 });
    expect(s.totals.total).toBe(42.56);
    expect(s.totals.count).toBe(5);
  });

  it('métodos en orden fijo y solo los que tienen dinero', () => {
    expect(summarizeIncomeByMonth(payments, 2026, now).methods).toEqual(['pago_movil', 'zelle', 'efectivo_usd', 'otro']);
  });

  it('un año pasado trae los 12 meses', () => {
    const s = summarizeIncomeByMonth(payments, 2025, now);
    expect(s.months).toHaveLength(12);
    expect(s.months[11].byMethod).toEqual({ zelle: 99 });
  });

  it('normaliza el método', () => {
    expect(incomeMethodKey('Zelle')).toBe('zelle');
    expect(incomeMethodKey(null)).toBe('otro');
  });
});
