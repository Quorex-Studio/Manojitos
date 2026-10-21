import { describe, expect, it } from 'vitest';
import { summarizeInventory } from './inventoryValue';

describe('summarizeInventory', () => {
  it('lista vacía: todo en 0 y markupPct null', () => {
    const r = summarizeInventory([]);
    expect(r.totalProducts).toBe(0);
    expect(r.availableProducts).toBe(0);
    expect(r.units).toBe(0);
    expect(r.costUsd).toBe(0);
    expect(r.saleUsd).toBe(0);
    expect(r.profitUsd).toBe(0);
    expect(r.markupPct).toBeNull();
    expect(r.productsWithoutCost).toBe(0);
  });

  it('5 protectores con costo 26 y precio 39', () => {
    const r = summarizeInventory([{ stock: 5, cost_usd: 26, price_usd: 39 }]);
    expect(r.costUsd).toBe(130);
    expect(r.saleUsd).toBe(195);
    expect(r.profitUsd).toBe(65);
    expect(r.markupPct).toBe(50);
  });

  it('cuenta disponibles y total (un agotado)', () => {
    const r = summarizeInventory([
      { stock: 0, cost_usd: 10, price_usd: 15 },
      { stock: 2, cost_usd: 10, price_usd: 15 },
    ]);
    expect(r.availableProducts).toBe(1);
    expect(r.totalProducts).toBe(2);
  });

  it('variantes: usa el precio de cada una y ignora product.stock', () => {
    const r = summarizeInventory([
      {
        stock: 99,
        cost_usd: 5,
        price_usd: 10,
        product_variants: [
          { stock: 2, price_usd: 20 },
          { stock: 3, price_usd: null },
        ],
      },
    ]);
    expect(r.units).toBe(5);
    expect(r.saleUsd).toBe(2 * 20 + 3 * 10);
    expect(r.costUsd).toBe(25);
  });

  it('sin costo cargado: no suma costo ni saleWithCost, pero sí saleUsd', () => {
    const r = summarizeInventory([{ stock: 3, cost_usd: null, price_usd: 10 }]);
    expect(r.productsWithoutCost).toBe(1);
    expect(r.costUsd).toBe(0);
    expect(r.saleWithCostUsd).toBe(0);
    expect(r.saleUsd).toBe(30);
    expect(r.markupPct).toBeNull();
  });

  it('stock negativo cuenta como 0', () => {
    const r = summarizeInventory([{ stock: -4, cost_usd: 10, price_usd: 20 }]);
    expect(r.units).toBe(0);
    expect(r.availableProducts).toBe(0);
    expect(r.costUsd).toBe(0);
    expect(r.saleUsd).toBe(0);
  });
});
