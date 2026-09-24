// Reglas de stock compartidas por el panel (Panel general, Productos, alertas).
export const DEFAULT_MIN_STOCK = 5;

interface StockLike {
  stock: number;
  minimum_stock?: number | null;
}

export const isOutOfStock = (p: StockLike) => p.stock <= 0;
/** Por reponer: agotado o en el mínimo configurado (5 si no hay mínimo propio) */
export const needsRestock = (p: StockLike) => p.stock <= (p.minimum_stock ?? DEFAULT_MIN_STOCK);
