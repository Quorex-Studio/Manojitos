import { describe, expect, it } from 'vitest';
import { parseChatMarkdown, parseInline, safeHref } from './chatMarkdown';

describe('parseInline', () => {
  it('negrita, cursiva y código', () => {
    expect(parseInline('Total **$45,00** hoy, *rápido* y `M`')).toEqual([
      { t: 'text', v: 'Total ' },
      { t: 'bold', v: [{ t: 'text', v: '$45,00' }] },
      { t: 'text', v: ' hoy, ' },
      { t: 'italic', v: [{ t: 'text', v: 'rápido' }] },
      { t: 'text', v: ' y ' },
      { t: 'code', v: 'M' },
    ]);
  });

  it('un asterisco suelto o un guion bajo dentro de una palabra queda como texto', () => {
    expect(parseInline('2 * 3 = 6 y precio_usd')).toEqual([{ t: 'text', v: '2 * 3 = 6 y precio_usd' }]);
  });

  it('enlaces internos sí, javascript: no', () => {
    expect(parseInline('[Ver tienda](/tienda)')).toEqual([{ t: 'link', v: 'Ver tienda', href: '/tienda' }]);
    expect(parseInline('[x](javascript:alert(1))').some(n => n.t === 'link')).toBe(false);
    expect(safeHref('//evil.com')).toBeNull();
  });
});

describe('parseChatMarkdown', () => {
  it('arma párrafos, títulos, viñetas y listas numeradas', () => {
    const blocks = parseChatMarkdown('Hola María.\n\n### Para ti\n- **Vestido** $20\n* Blusa\n• Jean\n\n1. Elige talla\n2. Paga');
    expect(blocks.map(b => b.t)).toEqual(['p', 'h', 'ul', 'ol']);
    expect(blocks[2]).toMatchObject({ t: 'ul', items: { length: 3 } });
    expect(blocks[3]).toMatchObject({ t: 'ol', start: 1, items: { length: 2 } });
  });

  it('tablas con encabezado y filas', () => {
    const [table] = parseChatMarkdown('| Producto | Uds | Total |\n|---|:---:|---:|\n| Vestido | 2 | $40 |\n| Jean | 1 | $25 |');
    expect(table).toMatchObject({ t: 'table', head: { length: 3 }, rows: { length: 2 } });
  });

  it('una línea con | sin separador es texto normal', () => {
    expect(parseChatMarkdown('Talla S | M | L').map(b => b.t)).toEqual(['p']);
  });

  it('texto vacío no rompe', () => {
    expect(parseChatMarkdown('')).toEqual([]);
  });
});
