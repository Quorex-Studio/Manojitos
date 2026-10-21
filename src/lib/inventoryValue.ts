/**
 * Resumen del inventario: cuántos productos hay, cuánto costó (costo base, sin envío ni margen)
 * y cuánto entraría si se vendiera todo hoy al precio de venta.
 */
export interface InventoryValueVariant { stock: number; price_usd: number | null }
export interface InventoryValueProduct {
  stock: number;
  cost_usd: number | null;
  price_usd: number;
  product_variants?: InventoryValueVariant[] | null;
}
export interface InventoryValue {
  /** Productos registrados */
  totalProducts: number;
  /** Productos con al menos una unidad */
  availableProducts: number;
  /** Unidades en stock (todas) */
  units: number;
  /** Costo bruto: unidades × costo base (cost_usd), sin envío ni margen */
  costUsd: number;
  /** Lo que entraría si se vendiera todo hoy al precio de venta */
  saleUsd: number;
  /** Venta de los productos que sí tienen costo cargado (para la ganancia) */
  saleWithCostUsd: number;
  /** saleWithCostUsd − costUsd */
  profitUsd: number;
  /** Ganancia sobre el costo en % (profitUsd / costUsd × 100); null si costUsd es 0 */
  markupPct: number | null;
  /** Productos con stock pero sin costo cargado (cost_usd null o 0) */
  productsWithoutCost: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function summarizeInventory(products: InventoryValueProduct[]): InventoryValue {
  let availableProducts = 0;
  let units = 0;
  let costUsd = 0;
  let saleUsd = 0;
  let saleWithCostUsd = 0;
  let productsWithoutCost = 0;

  for (const p of products) {
    let pUnits = 0;
    let pSale = 0;
    const variants = p.product_variants;
    if (variants && variants.length > 0) {
      for (const v of variants) {
        const vStock = Math.max(0, num(v.stock));
        pUnits += vStock;
        pSale += vStock * (v.price_usd == null ? num(p.price_usd) : num(v.price_usd));
      }
    } else {
      pUnits = Math.max(0, num(p.stock));
      pSale = pUnits * num(p.price_usd);
    }

    if (pUnits > 0) availableProducts++;
    units += pUnits;
    saleUsd += pSale;

    const unitCost = num(p.cost_usd);
    if (unitCost > 0) {
      costUsd += pUnits * unitCost;
      saleWithCostUsd += pSale;
    } else if (pUnits > 0) {
      productsWithoutCost++;
    }
  }

  const cost = round2(costUsd);
  const withCost = round2(saleWithCostUsd);
  const profitUsd = round2(withCost - cost);

  return {
    totalProducts: products.length,
    availableProducts,
    units,
    costUsd: cost,
    saleUsd: round2(saleUsd),
    saleWithCostUsd: withCost,
    profitUsd,
    markupPct: cost > 0 ? Math.round((profitUsd / cost) * 1000) / 10 : null,
    productsWithoutCost,
  };
}
