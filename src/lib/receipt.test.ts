import { describe, expect, it } from 'vitest';
import { buildReceiptPdf, receiptNumber, receiptTotals, receiptWhatsappText, type ReceiptData } from './receipt';

const base: ReceiptData = {
  kind: 'venta',
  number: receiptNumber('g1aaaaaa-0000-0000'),
  date: new Date('2026-09-25T15:00:00Z'),
  customerName: 'María',
  paymentMethod: 'pago_movil',
  items: [
    { name: 'Base líquida', quantity: 2, unitPrice: 22 },
    { name: 'Sérum', quantity: 1, unitPrice: 28 },
  ],
  total: 72,
};

describe('receipt', () => {
  it('numera con el primer bloque del id', () => {
    expect(base.number).toBe('#G1AAAAAA');
  });

  it('una venta pagada no tiene saldo', () => {
    expect(receiptTotals({ ...base, status: 'pagado' })).toEqual({ subtotal: 72, paid: 72, balance: 0 });
  });

  it('una venta por cobrar muestra abonado y saldo', () => {
    expect(receiptTotals({ ...base, status: 'por_cobrar', paid: 20 })).toEqual({ subtotal: 72, paid: 20, balance: 52 });
  });

  it('el texto de WhatsApp lleva productos, total, método y saldo', () => {
    const text = receiptWhatsappText({ ...base, status: 'por_cobrar', paid: 20 });
    expect(text).toContain('2 × Base líquida — $44.00');
    expect(text).toContain('*Total: $72.00*');
    expect(text).toContain('Pago: Pago Móvil');
    expect(text).toContain('Saldo pendiente: $52.00');
    expect(text).not.toMatch(/\n\n\n/);
  });

  it('genera un PDF', () => {
    const doc = buildReceiptPdf({ ...base, delivery: 3, total: 75, totalBs: 64000 });
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000);
  });

  it('los abonos salen uno por uno en el texto y en el PDF', () => {
    const payments = [
      { date: new Date('2026-09-20T15:00:00'), amount: 20, method: 'pago_movil', amountBs: 17000 },
      { date: new Date('2026-09-24T15:00:00'), amount: 52, method: 'zinli' },
    ];
    const text = receiptWhatsappText({ ...base, status: 'pagado', paid: 72, payments });
    expect(text).toContain('*Abonos*');
    expect(text).toContain('• 20/09/26 · Pago Móvil · Bs 17.000,00 — $20.00');
    expect(text).toContain('• 24/09/26 · Zinli — $52.00');
    expect(text).toContain('*Cuenta pagada*');
    const doc = buildReceiptPdf({ ...base, paid: 72, payments });
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
