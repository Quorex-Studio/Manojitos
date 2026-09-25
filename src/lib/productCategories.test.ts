import { describe, expect, it } from 'vitest';
import { cleanOptions, joinContent, productVariants, sortedVariants, splitContent, usesPresentation, usesVariants, variantLabel, variantPrice } from './productCategories';

describe('productCategories', () => {
  it('separa y arma el contenido neto', () => {
    expect(splitContent('30 ml', ['ml', 'g'])).toEqual({ amount: '30', unit: 'ml' });
    expect(splitContent('50 g', ['ml', 'g'])).toEqual({ amount: '50', unit: 'g' });
    expect(splitContent('', ['ml', 'g'])).toEqual({ amount: '', unit: 'ml' });
    expect(joinContent('7,5', 'ml')).toBe('7.5 ml');
    expect(joinContent('0', 'ml')).toBeNull();
  });

  it('limpia opciones repetidas sin importar mayúsculas', () => {
    expect(cleanOptions([' Nude ', 'nude', '', 'Rosa  claro'])).toEqual(['Nude', 'Rosa claro']);
  });

  it('"Única" (dato viejo) no cuenta como opción a elegir', () => {
    expect(productVariants(['Única'])).toEqual([]);
    expect(productVariants(['S', 'M'])).toEqual(['S', 'M']);
    expect(productVariants(null)).toEqual([]);
  });

  it('cada tipo guarda su detalle donde corresponde', () => {
    expect(usesPresentation('contenido')).toBe(false);
    expect(usesVariants('contenido')).toBe(true);
    expect(usesPresentation('medidas')).toBe(true);
    expect(usesVariants('tallas')).toBe(true);
    expect(usesVariants('tonos')).toBe(true);
    expect(usesVariants('ninguno')).toBe(false);
    expect(variantLabel('tonos')).toBe('Tono');
    expect(variantLabel('tallas')).toBe('Talla');
    expect(variantLabel('contenido')).toBe('Presentación');
  });

  it('el precio de la variante manda si tiene uno propio', () => {
    expect(variantPrice(10, { price_usd: 14 })).toBe(14);
    expect(variantPrice(10, { price_usd: null })).toBe(10);
    expect(variantPrice(10, null)).toBe(10);
    expect(sortedVariants([{ sort_order: 2, l: 'b' }, { sort_order: 1, l: 'a' }]).map(v => v.l)).toEqual(['a', 'b']);
  });
});
