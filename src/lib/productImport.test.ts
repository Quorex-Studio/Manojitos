import { describe, it, expect } from 'vitest';
import { parseNumber, autoMapColumns, detectHeaderRow, buildRows } from './productImport';

describe('parseNumber', () => {
  it.each([
    ['$ 1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['12,5', 12.5],
    ['3.99', 3.99],
    ['Bs. 850', 850],
    ['15 und', 15],
    ['1.500', 1500],
    ['12,500', 12500],
    ['0,75', 0.75],
    [42, 42],
    ['', null],
    ['abc', null],
  ])('%s -> %s', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });
});

describe('autoMapColumns', () => {
  it('reconoce el formato de Treinta', () => {
    const m = autoMapColumns(['Código', 'Nombre del producto', 'Categoría', 'Stock actual', 'Precio de costo', 'Precio de venta']);
    expect(m).toEqual({ code: 0, name: 1, category: 2, stock: 3, cost: 4, price: 5 });
  });

  it('reconoce un export en inglés (tienda online)', () => {
    const m = autoMapColumns(['Title', 'Variant SKU', 'Variant Price', 'Variant Inventory Qty', 'Image Src']);
    expect(m.name).toBe(0);
    expect(m.code).toBe(1);
    expect(m.price).toBe(2);
    expect(m.stock).toBe(3);
    expect(m.image).toBe(4);
  });

  it('no confunde precio de costo con precio de venta', () => {
    const m = autoMapColumns(['Producto', 'Precio de costo', 'Precio']);
    expect(m.price).toBe(2);
    expect(m.cost).toBe(1);
  });
});

describe('detectHeaderRow + buildRows', () => {
  const rows = [
    ['Reporte de inventario', '', ''],
    ['Negocio: EINA', '', ''],
    ['Nombre', 'Precio de venta', 'Cantidad'],
    ['Labial mate', '$ 12,50', '10'],
    ['Sérum', '28', ''],
    ['', '', ''],
    ['Total', '', '10'],
  ].filter(r => r.some(c => c));

  it('encuentra el encabezado aunque haya títulos arriba', () => {
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it('convierte filas y descarta la de totales sin precio', () => {
    const header = detectHeaderRow(rows);
    const result = buildRows(rows, header, autoMapColumns(rows[header] as string[]));
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: 'Labial mate', price: 12.5, stock: 10, errors: [] });
    expect(result[1]).toMatchObject({ name: 'Sérum', price: 28, stock: 0 });
    expect(result.map(r => r.name)).not.toContain('Total');
  });

  it('convierte precios en Bs a USD con el factor indicado', () => {
    const r = buildRows([['Nombre', 'Precio'], ['Base', '8544,64']], 0, { name: 0, price: 1 }, { priceFactor: 854.464 });
    expect(r[0].price).toBe(10);
  });
});
