import type jsPDF from 'jspdf';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  buildReceivablesPdf, buildReceivablesReport, normalizeClientKey, receivablesFileName, receivablesSummaryText,
  type BuildReportOptions, type ReceivablePaymentRow, type ReceivableSaleRow, type ReceivablesReport,
} from '@/lib/receivablesReport';

const SALE_FIELDS = 'id, product_id, sale_group_id, client_name, client_phone, product_name, variant_label, quantity, total_usd, amount_paid, total_bs, sale_modality, payment_method, status, created_at';
const PAGE = 1000;

/** Clave de caché compartida por el botón de Por cobrar y la tarjeta de la asistente. */
export const receivablesQueryKey = (clientName?: string | null, sort?: string) => ['receivables-report', clientName ?? '', sort ?? 'saldo'];

/**
 * Lee de Supabase lo que necesita el reporte de Por cobrar (con la sesión de quien lo pide:
 * RLS decide qué ve) y lo arma. Lo usan el botón del módulo y la tarjeta de Ina/Ángela.
 */
export async function loadReceivablesReport(opts: Omit<BuildReportOptions, 'rate'> = {}): Promise<ReceivablesReport> {
  // Ventas no anuladas, por páginas (PostgREST corta en 1000 filas)
  const sales: ReceivableSaleRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('sales').select(SALE_FIELDS).neq('status', 'cancelled').order('created_at', { ascending: true }).range(from, from + PAGE - 1);
    if (opts.clientName) q = q.ilike('client_name', `%${opts.clientName.trim()}%`);
    const { data, error } = await q;
    if (error) throw error;
    sales.push(...((data ?? []) as ReceivableSaleRow[]));
    if (!data || data.length < PAGE) break;
  }

  // Categoría de cada producto (para el detalle y el balance por categoría)
  const productIds = [...new Set(sales.map(s => s.product_id).filter(Boolean))] as string[];
  const categoryOf = new Map<string, string | null>();
  for (let i = 0; i < productIds.length; i += 150) {
    const { data } = await supabase.from('products').select('id, category').in('id', productIds.slice(i, i + 150));
    (data ?? []).forEach(p => categoryOf.set(p.id, p.category));
  }
  sales.forEach(s => { s.category = categoryOf.get(s.product_id ?? '') ?? null; });

  // El nombre que llega (de Ina o de una tarjeta) puede ser parcial: si coincide con una sola
  // clienta, o exactamente con una, sale su estado de cuenta; si no, las que coinciden.
  let clientName: string | null = null;
  if (opts.clientName) {
    const matches = buildReceivablesReport(sales, [], { ...opts, clientName: null }).clients;
    const exact = matches.find(c => c.key === normalizeClientKey(opts.clientName!));
    clientName = exact?.name ?? (matches.length === 1 ? matches[0].name : null);
  }
  const buildOpts = { ...opts, clientName };

  // Solo se piden los abonos de las facturas que deben
  const pre = buildReceivablesReport(sales, [], buildOpts);
  const groupIds = pre.clients.flatMap(c => c.invoices.map(i => i.id));
  const owing = new Set(groupIds);
  const lineIds = sales.filter(s => owing.has(s.sale_group_id || s.id)).map(s => s.id);
  const payments: ReceivablePaymentRow[] = [];
  for (let i = 0; i < Math.max(groupIds.length, lineIds.length); i += 80) {
    const g = groupIds.slice(i, i + 80);
    const l = lineIds.slice(i, i + 80);
    const filters = [g.length ? `sale_group_id.in.(${g.join(',')})` : '', l.length ? `sale_id.in.(${l.join(',')})` : ''].filter(Boolean);
    if (!filters.length) continue;
    const { data } = await supabase.from('sale_payments')
      .select('sale_id, sale_group_id, amount_usd, amount_bs, payment_method, status, created_at')
      .or(filters.join(','));
    payments.push(...((data ?? []) as ReceivablePaymentRow[]));
  }
  // Un mismo abono puede venir por grupo y por línea: se deja uno
  const seen = new Set<string>();
  const unique = payments.filter(p => {
    const k = `${p.sale_group_id}|${p.sale_id}|${p.created_at}|${p.amount_usd}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const { data: rateRow } = await supabase.from('exchange_rates').select('rate').eq('currency', 'USD')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  return buildReceivablesReport(sales, unique, { ...buildOpts, rate: rateRow ? Number(rateRow.rate) : null });
}

/** Descargar, compartir (archivo o WhatsApp) e imprimir un PDF ya armado. */
export function pdfActions(build: () => jsPDF, fileName: string, shareTitle: string, shareText = '') {
  const download = () => build().save(fileName);
  const share = async () => {
    try {
      const file = new File([build().output('blob')], fileName, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: shareTitle, text: shareText });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
    // Sin compartir archivos (escritorio): se descarga y se abre WhatsApp con el resumen
    download();
    if (shareText) window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener');
  };
  const print = () => {
    const url = URL.createObjectURL(build().output('blob'));
    const win = window.open(url, '_blank');
    if (!win) {
      toast.error('Permite las ventanas emergentes para imprimir, o descarga el PDF.');
      return;
    }
    win.addEventListener('load', () => win.print());
  };
  return { download, share, print };
}

export const receivablesPdfActions = (r: ReceivablesReport) =>
  pdfActions(() => buildReceivablesPdf(r), receivablesFileName(r), r.clientFilter ? `Estado de cuenta · ${r.clientFilter}` : 'Cuentas por cobrar', receivablesSummaryText(r));
