import { describe, expect, it } from 'vitest';
import { agingIndex, buildReceivablesPdf, paymentState, buildReceivablesReport, receivablesFileName, receivablesSummaryText, type ReceivableSaleRow } from './receivablesReport';

const now = new Date(2026, 8, 27, 10, 0);
const day = (d: number) => new Date(2026, 8, 27 - d, 12, 0).toISOString();

const sale = (p: Partial<ReceivableSaleRow>): ReceivableSaleRow => ({
  id: crypto.randomUUID(), sale_group_id: null, client_name: 'María Pérez', product_name: 'Base', quantity: 1,
  total_usd: 20, amount_paid: 0, sale_modality: 'fiado', status: 'confirmed', created_at: day(1), ...p,
});

const sales: ReceivableSaleRow[] = [
  // Factura de María con 2 líneas (mismo grupo), abonó $10
  sale({ id: 'l1', sale_group_id: 'g1aaaaaa-1', product_name: 'Base', category: 'Maquillaje', quantity: 2, total_usd: 40, amount_paid: 10, created_at: day(5), client_phone: '04141234567' }),
  sale({ id: 'l2', sale_group_id: 'g1aaaaaa-1', product_name: 'Sérum', category: 'Skincare', total_usd: 25, amount_paid: 0, created_at: day(5) }),
  // Segunda factura de María (nombre escrito distinto) de hace 70 días
  sale({ id: 'l3', client_name: ' maría  pérez ', total_usd: 15, created_at: day(70) }),
  // Ana: 20 días
  sale({ id: 'l4', client_name: 'Ana', category: 'Skincare', total_usd: 30, amount_paid: 5, created_at: day(20) }),
  // Pagada: no sale
  sale({ id: 'l5', client_name: 'Luisa', total_usd: 12, amount_paid: 12 }),
  // Anulada: no sale
  sale({ id: 'l6', client_name: 'Rosa', total_usd: 50, status: 'cancelled' }),
];

const payments = [
  { sale_id: null, sale_group_id: 'g1aaaaaa-1', amount_usd: 10, amount_bs: 3600, payment_method: 'pago_movil', created_at: day(3) },
  { sale_id: 'l4', sale_group_id: null, amount_usd: 5, payment_method: 'zelle', created_at: day(2) },
  { sale_id: 'l4', sale_group_id: null, amount_usd: 99, payment_method: 'zelle', status: 'void', created_at: day(1) },
];

describe('reporte de cuentas por cobrar', () => {
  const r = buildReceivablesReport(sales, payments, { now, rate: 360 });

  it('agrupa por venta y por clienta, sin pagadas ni anuladas', () => {
    expect(r.clients.map(c => c.name)).toEqual(['María Pérez', 'Ana']);
    expect(r.totals).toMatchObject({ balance: 95, paid: 15, total: 110, invoices: 3, clients: 2 });
    const maria = r.clients[0];
    expect(maria.balance).toBe(70);
    expect(maria.invoices).toHaveLength(2);
    expect(maria.phone).toBe('04141234567');
    // de la más antigua a la más reciente
    expect(maria.invoices[0].days).toBe(70);
    expect(maria.invoices[1].items).toEqual([{ name: 'Base', quantity: 2, total: 40 }, { name: 'Sérum', quantity: 1, total: 25 }]);
  });

  it('asigna los abonos a su factura e ignora los anulados', () => {
    expect(r.clients[0].invoices[1].payments).toHaveLength(1);
    expect(r.clients[0].invoices[1].payments[0]).toMatchObject({ amount: 10, amountBs: 3600, method: 'Pago Móvil' });
    expect(r.clients[1].invoices[0].payments.map(p => p.amount)).toEqual([5]);
  });

  it('reparte la deuda por antigüedad', () => {
    expect(r.aging.map(b => b.amount)).toEqual([55, 25, 0, 15]);
    expect(agingIndex(0)).toBe(0);
    expect(agingIndex(16)).toBe(1);
    expect(agingIndex(61)).toBe(3);
  });

  it('estado de cuenta de una sola clienta', () => {
    const one = buildReceivablesReport(sales, payments, { now, clientName: 'MARÍA PÉREZ' });
    expect(one.clientFilter).toBe('María Pérez');
    expect(one.totals.balance).toBe(70);
    expect(receivablesFileName(one)).toMatch(/^cuentas_por_cobrar_.+_maria_perez_2026-09-27\.pdf$/);
  });

  it('ordena por antigüedad o por nombre', () => {
    expect(buildReceivablesReport(sales, [], { now, sort: 'clienta' }).clients[0].name).toBe('Ana');
    expect(buildReceivablesReport(sales, [], { now, sort: 'antiguedad' }).clients[0].name).toBe('María Pérez');
  });

  it('arma el PDF (A4) y el resumen de texto', () => {
    const doc = buildReceivablesPdf(r);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(210);
    expect(receivablesSummaryText(r)).toContain('Total por cobrar: $95.00');
    expect(buildReceivablesPdf(buildReceivablesReport([], [], { now })).getNumberOfPages()).toBe(1);
  });

  it('estado de cada cuenta: sin abono, abonó X% o pagada', () => {
    expect(paymentState(0, 20)).toEqual({ label: 'Sin abono', tone: 'none' });
    expect(paymentState(10, 20)).toEqual({ label: 'Abonó 50%', tone: 'partial' });
    expect(paymentState(20, 20).tone).toBe('paid');
  });

  it('agrupa la deuda por categoría (sin categoría al final) con % cobrado', () => {
    expect(r.categories.map(c => [c.name, c.units, c.total, c.paid, c.balance, c.collectedPct])).toEqual([
      ['Skincare', 2, 55, 5, 50, 9.1],
      ['Maquillaje', 2, 40, 10, 30, 25],
      ['Sin categoría', 1, 15, 0, 15, 0],
    ]);
    expect(r.categories[0].rows.map(x => x.name)).toEqual(['Ana', 'María Pérez']); // empate de saldo: A–Z
    expect(r.categories[0].unpaidCount).toBe(1);
    expect(r.totals.units).toBe(5);
  });

  it('lee el reporte: prioritarias, parciales, sin abono y atrasadas', () => {
    expect(r.insights.priority.map(p => p.name)).toEqual(['María Pérez', 'Ana']);
    expect(r.insights.partial.count).toBe(2);
    expect(r.insights.unpaid).toEqual({ count: 0, amount: 0 });
    expect(r.insights.overdue).toEqual({ count: 1, amount: 70 });
  });

  it('arma el PDF por categoría', () => {
    expect(buildReceivablesPdf({ ...r, groupBy: 'categoria' }).getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
