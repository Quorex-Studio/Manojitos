import jsPDF from 'jspdf';
import { BRAND, BRAND_COLOR_RGB, BRAND_FILE_SLUG, BRAND_NAME, BRAND_NAME_UPPER } from '@/config/brand';
import { PAYMENT_METHOD_LABELS } from '@/lib/paymentMethodFields';
import { formatPhone } from '@/lib/venezuela';

/**
 * Recibo único de la tienda: lo usan la clienta (Mis pedidos) y la administración (Ventas).
 * Los datos se arman una vez y de ellos salen la vista en pantalla, el PDF (ticket de 80 mm)
 * y el texto para compartir por WhatsApp, así los tres dicen siempre lo mismo.
 */
export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ReceiptData {
  /** 'pedido' = compra en la tienda online; 'venta' = venta registrada en el panel */
  kind: 'pedido' | 'venta';
  number: string;
  date: Date;
  customerName?: string | null;
  customerPhone?: string | null;
  paymentMethod?: string | null;
  items: ReceiptItem[];
  delivery?: number;
  total: number;
  /** Abonado hasta hoy (ventas por cobrar). Si no se indica, se asume pagado completo. */
  paid?: number;
  /** Total en bolívares registrado en la operación (si existe). */
  totalBs?: number | null;
  status?: 'pagado' | 'pendiente' | 'por_cobrar';
}

export const receiptNumber = (id: string) => `#${id.split('-')[0].toUpperCase()}`;

export const paymentLabel = (method?: string | null) =>
  method ? (PAYMENT_METHOD_LABELS[method] ?? method.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())) : '';

const money = (n: number) => `$${n.toFixed(2)}`;
const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function receiptTotals(data: ReceiptData) {
  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const paid = data.paid ?? (data.status === 'por_cobrar' ? 0 : data.total);
  const balance = Math.max(0, Math.round((data.total - paid) * 100) / 100);
  return { subtotal, paid, balance };
}

export const STATUS_LABEL: Record<NonNullable<ReceiptData['status']>, string> = {
  pagado: 'Pagado',
  pendiente: 'Pago por confirmar',
  por_cobrar: 'Por cobrar',
};

/** Ticket de 80 mm con la marca de la tienda. */
export function buildReceiptPdf(data: ReceiptData): jsPDF {
  const { subtotal, paid, balance } = receiptTotals(data);
  const brand = BRAND_COLOR_RGB;
  const ink: [number, number, number] = [37, 32, 36];
  const muted: [number, number, number] = [120, 110, 114];
  const extraLines = (data.customerName ? 1 : 0) + (data.customerPhone ? 1 : 0) + (data.delivery ? 1 : 0) + (balance > 0 ? 2 : 0) + (data.totalBs ? 1 : 0);
  const doc = new jsPDF({ unit: 'mm', format: [80, 78 + data.items.length * 8 + extraLines * 4.5] });
  const W = 80;
  let y = 0;

  // Cabecera de marca
  doc.setFillColor(...brand);
  doc.rect(0, 0, W, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'normal');
  doc.setFontSize(18);
  doc.text(BRAND_NAME_UPPER, W / 2, 10, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(BRAND.category.toUpperCase(), W / 2, 15, { align: 'center' });
  y = 27;

  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(data.kind === 'pedido' ? 'Recibo de compra' : 'Recibo de venta', W / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text(`${data.number} · ${data.date.toLocaleDateString('es-VE')} ${data.date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`, W / 2, y, { align: 'center' });
  y += 6;

  doc.setTextColor(...ink);
  if (data.customerName) { doc.text(`Cliente: ${data.customerName}`, 5, y); y += 4.5; }
  if (data.customerPhone) { doc.text(`Teléfono: ${formatPhone(data.customerPhone)}`, 5, y); y += 4.5; }
  if (data.paymentMethod) { doc.text(`Pago: ${paymentLabel(data.paymentMethod)}`, 5, y); y += 4.5; }

  doc.setDrawColor(...brand);
  doc.setLineWidth(0.3);
  doc.line(5, y, W - 5, y);
  y += 5;

  data.items.forEach(item => {
    const name = doc.splitTextToSize(item.name, 50) as string[];
    doc.setTextColor(...ink);
    doc.text(name[0], 5, y);
    doc.text(money(item.quantity * item.unitPrice), W - 5, y, { align: 'right' });
    y += 3.8;
    doc.setTextColor(...muted);
    doc.text(`${item.quantity} × ${money(item.unitPrice)}`, 5, y);
    y += 4.2;
  });

  doc.setDrawColor(...brand);
  doc.line(5, y, W - 5, y);
  y += 5;

  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 9.5 : 7.5);
    doc.setTextColor(...ink);
    doc.text(label, 5, y);
    doc.text(value, W - 5, y, { align: 'right' });
    y += bold ? 6 : 4.5;
  };
  if (data.delivery) { row('Subtotal', money(subtotal)); row('Delivery', money(data.delivery)); }
  row('Total', money(data.total), true);
  if (data.totalBs) row('Total en bolívares', bs(data.totalBs));
  if (balance > 0) { row('Abonado', money(paid)); row('Saldo pendiente', money(balance), true); }

  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text(`¡Gracias por tu compra en ${BRAND_NAME}!`, W / 2, y, { align: 'center' });
  y += 3.8;
  doc.text(BRAND.domain, W / 2, y, { align: 'center' });

  return doc;
}

export function receiptFileName(data: ReceiptData) {
  return `recibo_${BRAND_FILE_SLUG}_${data.number.replace('#', '')}.pdf`;
}

/** Texto plano para WhatsApp (negritas con *...*). */
export function receiptWhatsappText(data: ReceiptData): string {
  const { paid, balance } = receiptTotals(data);
  const lines = [
    `*${BRAND_NAME} · Recibo ${data.number}*`,
    data.date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    '',
    ...data.items.map(i => `• ${i.quantity} × ${i.name} — ${money(i.quantity * i.unitPrice)}`),
    '',
    data.delivery ? `Delivery: ${money(data.delivery)}` : '',
    `*Total: ${money(data.total)}*`,
    data.totalBs ? `Total en bolívares: ${bs(data.totalBs)}` : '',
    data.paymentMethod ? `Pago: ${paymentLabel(data.paymentMethod)}` : '',
    balance > 0 ? `Abonado: ${money(paid)} · *Saldo pendiente: ${money(balance)}*` : '',
    '',
    `¡Gracias por tu compra! 🩷 ${BRAND.domain}`,
  ];
  return lines.filter((l, i, arr) => l !== '' || (arr[i - 1] !== '' && i > 0)).join('\n').trim();
}
