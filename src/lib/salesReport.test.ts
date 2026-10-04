import { describe, expect, it } from 'vitest';
import { buildSalesPdf, filterSales, pctChange, previousRange, summarizeSales, type ReportSaleRow } from './salesReport';

const at = (iso: string) => new Date(`${iso}T15:00:00`).toISOString();
const row = (p: Partial<ReportSaleRow>): ReportSaleRow => ({
  id: crypto.randomUUID(), sale_group_id: null, product_name: 'Vestido', quantity: 1, unit_price_usd: 10, total_usd: 10,
  payment_method: 'pago_movil', is_credit: false, client_name: 'María', status: 'confirmed', created_at: at('2026-09-10'), ...p,
});

const sales = [
  row({ id: 'a', sale_group_id: 'g1', product_name: 'Vestido', quantity: 2, total_usd: 40 }),
  row({ id: 'b', sale_group_id: 'g1', product_name: 'Suéter', total_usd: 25 }),
  row({ id: 'c', product_name: 'Labial', total_usd: 15, payment_method: 'zelle', client_name: 'Ána', created_at: at('2026-09-12') }),
  row({ id: 'd', product_name: 'Vestido', total_usd: 20, is_credit: true, amount_paid: 5, payment_method: 'fiado', client_name: 'ana', created_at: at('2026-09-12') }),
  row({ id: 'e', total_usd: 99, status: 'cancelled' }),
  row({ id: 'f', total_usd: 50, created_at: at('2026-08-30') }),
];
const f = { from: '2026-09-10', to: '2026-09-12' };

describe('reporte de ventas', () => {
  it('filtra por rango, sin anuladas, por método, día y búsqueda sin acentos', () => {
    expect(filterSales(sales, f).map(s => s.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(filterSales(sales, { ...f, method: 'credito' }).map(s => s.id)).toEqual(['d']);
    expect(filterSales(sales, { ...f, day: '2026-09-12' }).map(s => s.id)).toEqual(['c', 'd']);
    expect(filterSales(sales, { ...f, q: 'sueter' }).map(s => s.id)).toEqual(['b']);
    expect(filterSales(sales, { ...f, q: 'ana' }).map(s => s.id)).toEqual(['c', 'd']);
  });

  it('resume ventas (tickets por grupo), crédito, métodos, días, productos y clientas', () => {
    const s = summarizeSales(filterSales(sales, f), f);
    expect(s).toMatchObject({ total: 100, units: 5, tickets: 3, lines: 4, averageTicket: 33.33, creditTotal: 20, creditPending: 15 });
    expect(s.byMethod.map(m => [m.label, m.amount, m.count])).toEqual([['Pago Móvil', 65, 1], ['Crédito', 20, 1], ['Zelle', 15, 1]]);
    expect(s.byDay.map(d => [d.day, d.amount])).toEqual([['2026-09-10', 65], ['2026-09-11', 0], ['2026-09-12', 35]]);
    expect(s.topProducts[0]).toMatchObject({ name: 'Vestido', units: 3, amount: 60 });
    expect(s.topClients.map(c => [c.name, c.amount])).toEqual([['María', 65], ['Ána', 15], ['ana', 20]].sort((a, b) => (b[1] as number) - (a[1] as number)));
  });

  it('compara con el período anterior de igual duración', () => {
    expect(previousRange('2026-09-10', '2026-09-12')).toEqual({ from: '2026-09-07', to: '2026-09-09', days: 3 });
    expect(previousRange('2026-09-01', '2026-09-30').from).toBe('2026-08-02');
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(10, 0)).toBeNull();
  });

  it('arma el PDF A4 aunque no haya ventas', () => {
    expect(buildSalesPdf(filterSales(sales, f), f, { rate: 360, previousTotal: 50 }).getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(buildSalesPdf([], f).getNumberOfPages()).toBe(1);
  });
});
