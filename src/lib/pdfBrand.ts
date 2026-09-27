import type jsPDF from 'jspdf';
import { BRAND, BRAND_COLOR_RGB, BRAND_NAME_UPPER } from '@/config/brand';

/**
 * Piezas comunes de los reportes A4 de la tienda (Cuentas por cobrar, Ventas): encabezado
 * tipo factura con la marca, mosaicos de resumen y pie con paginación. Así todos los PDF
 * del panel se ven de la misma familia. Colores = tokens de DESIGN.md.
 */
export type RGB = [number, number, number];
export const PDF = {
  brand: BRAND_COLOR_RGB,
  ink: [37, 32, 36] as RGB,
  muted: [112, 102, 106] as RGB,
  line: [226, 216, 206] as RGB,
  cream: [244, 231, 215] as RGB,
  canvas: [252, 248, 243] as RGB,
  copper: [155, 90, 63] as RGB,
  success: [29, 114, 73] as RGB,
  danger: [191, 38, 38] as RGB,
  white: [255, 255, 255] as RGB,
  margin: 14,
};

export const pdfMoney = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const pdfBs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const pdfShortDate = (d: Date) => d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const pdfLongDate = (d: Date) => d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });

/** Mezcla un color con blanco (0 = blanco, 1 = color) para fondos suaves. */
export const tint = (c: RGB, k: number): RGB => c.map(v => Math.round(255 - (255 - v) * k)) as RGB;

/** Banda de marca: nombre y rubro a la izquierda; tipo de documento, número y fecha a la derecha. */
export function drawPdfHeader(doc: jsPDF, title: string, number: string, issuedAt: Date): number {
  const W = doc.internal.pageSize.getWidth();
  const M = PDF.margin;
  doc.setFillColor(...PDF.brand);
  doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(...PDF.white);
  doc.setFont('times', 'normal');
  doc.setFontSize(26);
  doc.text(BRAND_NAME_UPPER, M, 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(BRAND.category.toUpperCase(), M, 23);
  doc.text(`${BRAND.domain} · ${BRAND.contactEmail}`, M, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title.toUpperCase(), W - M, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`N° ${number}`, W - M, 22, { align: 'right' });
  doc.text(`Emitido: ${pdfShortDate(issuedAt)} ${issuedAt.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`, W - M, 27.5, { align: 'right' });
  return 44;
}

/** Recuadro de datos (como el "Facturar a" de una factura). */
export function drawInfoBox(doc: jsPDF, x: number, y: number, w: number, label: string, lines: string[]) {
  doc.setFillColor(...PDF.canvas);
  doc.setDrawColor(...PDF.line);
  doc.roundedRect(x, y, w, 24, 2.5, 2.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.muted);
  doc.text(label.toUpperCase(), x + 4, y + 6);
  doc.setTextColor(...PDF.ink);
  lines.forEach((l, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
    doc.setFontSize(i === 0 ? 10.5 : 8.5);
    doc.text(l, x + 4, y + 12 + i * 5, { maxWidth: w - 8 });
  });
}

/** Mosaicos de resumen; el primero (accent) va en el color de marca: es el número que importa. */
export function drawTiles(doc: jsPDF, y: number, tiles: { label: string; value: string; sub?: string; accent?: boolean }[]): number {
  const W = doc.internal.pageSize.getWidth();
  const M = PDF.margin;
  const gap = 4;
  const tileW = (W - M * 2 - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach((t, i) => {
    const x = M + i * (tileW + gap);
    doc.setFillColor(...(t.accent ? PDF.brand : PDF.cream));
    doc.roundedRect(x, y, tileW, 22, 2.5, 2.5, 'F');
    doc.setTextColor(...(t.accent ? PDF.white : PDF.muted));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(t.label.toUpperCase(), x + 4, y + 6);
    doc.setTextColor(...(t.accent ? PDF.white : PDF.ink));
    doc.setFontSize(tiles.length > 3 ? 13 : 15);
    doc.text(t.value, x + 4, y + 14);
    if (t.sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...(t.accent ? PDF.cream : PDF.muted));
      doc.text(t.sub, x + 4, y + 19, { maxWidth: tileW - 8 });
    }
  });
  return y + 29;
}

export function drawSectionTitle(doc: jsPDF, y: number, title: string, hint?: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PDF.ink);
  doc.text(title, PDF.margin, y);
  if (!hint) return y + 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF.muted);
  doc.text(hint, PDF.margin, y + 4.5);
  return y + 8;
}

/** Pie en todas las páginas: marca, ubicación y "Página X de Y". */
export function drawPdfFooter(doc: jsPDF, label: string) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = PDF.margin;
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF.brand);
    doc.setLineWidth(0.4);
    doc.line(M, H - 12, W - M, H - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PDF.muted);
    doc.text(`${BRAND.name} · ${BRAND.location} · ${BRAND.domain}`, M, H - 7.5);
    doc.text(`${label} · Página ${i} de ${pages}`, W - M, H - 7.5, { align: 'right' });
  }
}

/** Encabezado corto en las páginas 2 en adelante (la 1 lleva la banda de marca). */
export function drawRunningHeader(doc: jsPDF, left: string, right: string) {
  const W = doc.internal.pageSize.getWidth();
  const M = PDF.margin;
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF.brand);
    doc.text(left.toUpperCase(), M, 11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF.muted);
    doc.text(right, W - M, 11, { align: 'right' });
    doc.setDrawColor(...PDF.line);
    doc.setLineWidth(0.3);
    doc.line(M, 14, W - M, 14);
  }
}

/** Margen de las tablas: arriba deja lugar al encabezado corto, abajo al pie. */
export const PDF_TABLE_MARGIN = { top: 20, left: PDF.margin, right: PDF.margin, bottom: 18 };
/** Dónde sigue el contenido al abrir una página nueva a mano. */
export const PDF_PAGE_TOP = 22;

export const pdfLastY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
