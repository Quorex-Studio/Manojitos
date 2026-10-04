/**
 * Formato de las respuestas de la asistente: un subconjunto pequeño de Markdown, sin HTML.
 * Bloques: párrafos, títulos (#, ##, ###), viñetas (-, *, •), listas numeradas y tablas
 * (| a | b |). En línea: **negrita**, *cursiva* / _cursiva_, `código` y [enlaces](/ruta).
 * Se convierte a datos puros y el componente ChatMarkdown los pinta como elementos React,
 * así nada del texto del modelo se interpreta como HTML.
 */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: Inline[] }
  | { t: 'italic'; v: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string };

export type Block =
  | { t: 'p'; v: Inline[] }
  | { t: 'h'; v: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; items: Inline[][]; start: number }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] };

const BULLET = /^\s*(?:[-*•·]|•)\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Solo enlaces internos (/ruta) o https: nada de javascript: ni data:. */
export const safeHref = (href: string): string | null => {
  const h = href.trim();
  if (/^\/(?!\/)/.test(h)) return h;
  if (/^https:\/\/[^\s]+$/i.test(h)) return h;
  return null;
};

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /(\*\*([^*]+?)\*\*|__([^_]+?)__|`([^`]+?)`|\[([^\]]+?)\]\(([^)\s]+?)\)|\*([^*\s][^*]*?)\*|(?<![\w])_([^_\s][^_]*?)_(?![\w]))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (s: string) => {
    if (!s) return;
    const prev = out[out.length - 1];
    if (prev && prev.t === 'text') prev.v += s;
    else out.push({ t: 'text', v: s });
  };
  while ((m = pattern.exec(text))) {
    push(text.slice(last, m.index));
    if (m[2] !== undefined || m[3] !== undefined) out.push({ t: 'bold', v: parseInline(m[2] ?? m[3]) });
    else if (m[4] !== undefined) out.push({ t: 'code', v: m[4] });
    else if (m[5] !== undefined) {
      const href = safeHref(m[6]);
      if (href) out.push({ t: 'link', v: m[5], href });
      else push(m[5]);
    } else if (m[7] !== undefined || m[8] !== undefined) out.push({ t: 'italic', v: parseInline(m[7] ?? m[8]) });
    last = m.index + m[0].length;
  }
  push(text.slice(last));
  return out;
}

const cells = (row: string) =>
  row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => parseInline(c.trim()));

export function parseChatMarkdown(source: string): Block[] {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', v: parseInline(para.join('\n')) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }

    // Tabla: fila de encabezado + separador (|---|---|) + filas
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flush();
      const head = cells(line);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      i--;
      blocks.push({ t: 'table', head, rows });
      continue;
    }

    const h = HEADING.exec(line);
    if (h) { flush(); blocks.push({ t: 'h', v: parseInline(h[1].replace(/\s*#+\s*$/, '')) }); continue; }

    const b = BULLET.exec(line);
    if (b) {
      flush();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.t === 'ul') prev.items.push(parseInline(b[1]));
      else blocks.push({ t: 'ul', items: [parseInline(b[1])] });
      continue;
    }

    const n = NUMBERED.exec(line);
    if (n) {
      flush();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.t === 'ol') prev.items.push(parseInline(n[2]));
      else blocks.push({ t: 'ol', items: [parseInline(n[2])], start: Number(n[1]) || 1 });
      continue;
    }

    // Línea que continúa el último punto de una lista (sangría)
    const prev = blocks[blocks.length - 1];
    if (!para.length && /^\s{2,}\S/.test(line) && prev && (prev.t === 'ul' || prev.t === 'ol')) {
      const item = prev.items[prev.items.length - 1];
      item.push({ t: 'text', v: '\n' }, ...parseInline(line.trim()));
      continue;
    }

    para.push(line.trim());
  }
  flush();
  return blocks;
}
