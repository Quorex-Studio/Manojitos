import { useMemo } from 'react';
import { Package, DollarSign, ChartSuccess } from 'reicon-react';
import { StatCard } from '@/components/ui/stat-card';
import { summarizeInventory, type InventoryValueProduct } from '@/lib/inventoryValue';

const usd = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Tarjetas del inventario: disponibles/total, costo bruto (lo que costó, sin envío)
 * y valor de venta si se vendiera todo hoy.
 */
export function InventorySummary({ products }: { products: InventoryValueProduct[] }) {
  const s = useMemo(() => summarizeInventory(products), [products]);
  const soldOut = s.totalProducts - s.availableProducts;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        title="Disponibles"
        value={`${s.availableProducts}/${s.totalProducts}`}
        subtitle={`${s.units} ${s.units === 1 ? 'unidad' : 'unidades'} en stock`}
        tertiaryText={soldOut > 0 ? `${soldOut} ${soldOut === 1 ? 'agotado' : 'agotados'}` : undefined}
        icon={<Package />}
        delay={0}
      />
      <StatCard
        title="Costo del inventario"
        value={usd(s.costUsd)}
        subtitle="Lo que te costó, sin envío"
        tertiaryText={s.productsWithoutCost > 0 ? `${s.productsWithoutCost} sin costo cargado` : undefined}
        icon={<DollarSign />}
        delay={0.05}
      />
      <StatCard
        title="Valor de venta"
        value={usd(s.saleUsd)}
        subtitle="Si vendieras todo hoy"
        tertiaryText={s.markupPct !== null ? `Ganancia ${usd(s.profitUsd)} (${s.markupPct >= 0 ? '+' : ''}${s.markupPct}%)` : undefined}
        icon={<ChartSuccess />}
        variant="gold"
        delay={0.1}
      />
    </div>
  );
}
