import { describe, it, expect, vi } from 'vitest';
import { purchaseTotals } from './usePurchasing';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

describe('totales de una compra (igual que register_purchase)', () => {
  it('Victoria Secret: 18 splash a $4 neto, tax USA 7% y envío $5', () => {
    const t = purchaseTotals([{ quantity: 18, unit_cost_usd: 4 }], 7, 5);
    expect(t).toMatchObject({ subtotal: 72, tax: 5.04, shipping: 5, total: 82.04 });
    expect(t.landed(4)).toBe(4.5578);
  });
  it('envío gratis y sin impuesto: el costo por unidad no cambia', () => {
    const t = purchaseTotals([{ quantity: 2, unit_cost_usd: 10 }, { quantity: 1, unit_cost_usd: 5.5 }], 0, 0);
    expect(t.total).toBe(25.5);
    expect(t.landed(10)).toBe(10);
  });
});
