import { PAYMENT_METHOD_LABELS } from '@/lib/paymentMethodFields';
import { BRAND, BRAND_COLOR_RGB, BRAND_FILE_SLUG, BRAND_NAME, BRAND_NAME_UPPER } from '@/config/brand';
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChartSuccess, FileText, Download, Calendar, ArrowUp, DollarSign, ShoppingCart } from 'reicon-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSales } from '@/hooks/useSales';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatBS } from '@/lib/utils';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  // --- STATE ---
  const { sales } = useSales();
  const { convertToBS } = useExchangeRate();
  const REPORT_LAUNCH_DATE = '2026-01-01';
  // Fecha local (no UTC): en Venezuela (UTC-4) toISOString() adelanta el día después de las 8 p. m.
  const toLocalISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const getTodayStr = () => toLocalISO(new Date());

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const iso = toLocalISO(d);
    return iso < REPORT_LAUNCH_DATE ? REPORT_LAUNCH_DATE : iso;
  });
  const [endDate, setEndDate] = useState(() => getTodayStr());

  // Rangos rápidos (fechas locales en formato YYYY-MM-DD, nunca antes del lanzamiento)
  const rangePresets = (() => {
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const clamp = (iso: string) => (iso < REPORT_LAUNCH_DATE ? REPORT_LAUNCH_DATE : iso);
    const now = new Date();
    const today = fmt(now);
    const daysAgo = (n: number) => fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
    const monthStart = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
    const prevStart = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const prevEnd = fmt(new Date(now.getFullYear(), now.getMonth(), 0));
    return [
      { label: 'Hoy', from: today, to: today },
      { label: '7 días', from: clamp(daysAgo(6)), to: today },
      { label: '30 días', from: clamp(daysAgo(29)), to: today },
      { label: 'Este mes', from: clamp(monthStart), to: today },
      { label: 'Mes pasado', from: clamp(prevStart), to: prevEnd },
    ].filter(p => p.to >= REPORT_LAUNCH_DATE);
  })();

  const handleStartDateChange = (value: string) => {
    const today = getTodayStr();
    if (value > today) {
      toast.error('No se pueden generar reportes con fecha futura.');
      setStartDate(today);
      return;
    }
    if (value < REPORT_LAUNCH_DATE) {
      toast.error(`La fecha mínima permitida es ${REPORT_LAUNCH_DATE}.`);
      setStartDate(REPORT_LAUNCH_DATE);
      return;
    }
    if (value > endDate) setEndDate(value);
    setStartDate(value);
  };

  const handleEndDateChange = (value: string) => {
    const today = getTodayStr();
    if (value > today) {
      toast.error('No se pueden generar reportes con fecha futura.');
      setEndDate(today);
      return;
    }
    if (value < REPORT_LAUNCH_DATE) {
      toast.error(`La fecha mínima permitida es ${REPORT_LAUNCH_DATE}.`);
      setEndDate(REPORT_LAUNCH_DATE);
      return;
    }
    if (value < startDate) setStartDate(value);
    setEndDate(value);
  };

  // --- DERIVED ---

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const saleDate = toLocalISO(new Date(s.created_at));
      return saleDate >= startDate && saleDate <= endDate;
    });
  }, [sales, startDate, endDate]);

  const stats = useMemo(() => {
    const totalUSD = filteredSales.reduce((acc, s) => acc + Number(s.total_usd), 0);
    const totalQuantity = filteredSales.reduce((acc, s) => acc + s.quantity, 0);
    const creditSales = filteredSales.filter(s => s.is_credit);
    const creditTotal = creditSales.reduce((acc, s) => acc + Number(s.total_usd), 0);

    const byPaymentMethod: Record<string, number> = { /* empty */ };
    filteredSales.forEach(s => {
      const method = s.is_credit ? 'crédito' : s.payment_method;
      byPaymentMethod[method] = (byPaymentMethod[method] || 0) + Number(s.total_usd);
    });

    return { totalUSD, totalQuantity, creditTotal, salesCount: filteredSales.length, byPaymentMethod };
  }, [filteredSales]);

  // --- HANDLERS ---
  const exportToCSV = () => {
    const headers = ['Fecha', 'Producto', 'Cantidad', 'Precio Unit.', 'Total USD', 'Método Pago', 'Cliente'];
    const rows = filteredSales.map(s => [
      new Date(s.created_at).toLocaleDateString('es'),
      `"${s.product_name.replace(/"/g, '""')}"`,
      s.quantity,
      Number(s.unit_price_usd).toFixed(2).replace('.', ','),
      Number(s.total_usd).toFixed(2).replace('.', ','),
      s.is_credit ? 'Crédito' : s.payment_method.replace('_', ' '),
      `"${(s.client_name || '-').replace(/"/g, '""')}"`
    ]);
    
    // In LATAM/Spain, Excel uses `;` as the default column separator.
    // Explicitly tell Excel to use semicolon by adding sep=; at the top
    const csvContent = "sep=;\r\n" + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    // Add BOM (\uFEFF) for Excel to recognize UTF-8 encoding correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_ventas_${startDate}_${endDate}.csv`;
    link.click();
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = BRAND_NAME;
    const sheet = workbook.addWorksheet('Ventas', { views: [{ state: 'frozen', ySplit: 4 }] });

    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${BRAND_NAME_UPPER} — Reporte de Ventas`;
    titleCell.font = { name: 'Georgia', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD69729' } };
    sheet.getRow(1).height = 28;

    sheet.mergeCells('A2:G2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `Período: ${startDate} al ${endDate}  ·  Generado: ${new Date().toLocaleString('es')}`;
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF181013' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E9D7' } };
    sheet.getRow(2).height = 18;

    sheet.addRow([]);

    const headers = ['Fecha', 'Producto', 'Cantidad', 'Precio Unit. ($)', 'Total ($)', 'Método de Pago', 'Cliente'];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD36983' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFAE4761' } } };
    });

    filteredSales.forEach((s, idx) => {
      const row = sheet.addRow([
        new Date(s.created_at).toLocaleDateString('es'),
        s.product_name,
        s.quantity,
        Number(s.unit_price_usd),
        Number(s.total_usd),
        s.is_credit ? 'Crédito' : s.payment_method.replace('_', ' '),
        s.client_name || '-'
      ]);
      const fillColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9F1E7';
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      });
      row.getCell(4).numFmt = '"$"#,##0.00';
      row.getCell(5).numFmt = '"$"#,##0.00';
    });

    const totalRow = sheet.addRow(['', '', '', 'TOTAL', stats.totalUSD, '', '']);
    totalRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E9D7' } };
    });
    totalRow.getCell(5).numFmt = '"$"#,##0.00';

    sheet.columns = [
      { width: 14 }, { width: 30 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 18 }, { width: 24 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_ventas_${BRAND_FILE_SLUG}_${startDate}_${endDate}.xlsx`;
    link.click();
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const goldColor = BRAND_COLOR_RGB; // color de marca
    const roseColor: [number, number, number] = [211, 105, 131];
    const darkColor: [number, number, number] = [24, 16, 19];

    doc.setFillColor(...goldColor);
    doc.rect(0, 0, 210, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(BRAND_NAME_UPPER, 14, 14);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${BRAND.category} — Reporte de Ventas`, 14, 21);

    doc.setTextColor(...darkColor);
    doc.setFontSize(10);
    doc.text(`Período: ${startDate} al ${endDate}`, 14, 34);
    doc.text(`Generado: ${new Date().toLocaleString('es')}`, 14, 40);

    autoTable(doc, {
      startY: 46,
      head: [['Fecha', 'Producto', 'Cant.', 'Precio Unit.', 'Total', 'Pago', 'Cliente']],
      body: filteredSales.map((s) => [
        new Date(s.created_at).toLocaleDateString('es'),
        s.product_name,
        String(s.quantity),
        `$${Number(s.unit_price_usd).toFixed(2)}`,
        `$${Number(s.total_usd).toFixed(2)}`,
        s.is_credit ? 'Crédito' : s.payment_method.replace('_', ' '),
        s.client_name || '-'
      ]),
      headStyles: { fillColor: roseColor, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 241, 231] },
      styles: { fontSize: 8, cellPadding: 3 },
      foot: [['', '', '', 'TOTAL', `$${stats.totalUSD.toFixed(2)}`, '', '']],
      footStyles: { fillColor: [243, 233, 215], textColor: darkColor, fontStyle: 'bold' },
    });

    doc.save(`reporte_ventas_${BRAND_FILE_SLUG}_${startDate}_${endDate}.pdf`);
  };

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Reportes</h1>
          <p className="page-subtitle">Análisis de ventas e ingresos</p>
        </div>

        {/* Filtros: rangos rápidos + fechas + exportar */}
        <Card className="border-border">
          <CardContent className="space-y-4 p-4">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:px-0" role="group" aria-label="Rango rápido">
              {rangePresets.map(preset => {
                const active = startDate === preset.from && endDate === preset.to;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => { setStartDate(preset.from); setEndDate(preset.to); }}
                    aria-pressed={active}
                    className={`h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
                      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end sm:gap-4">
              <div className="flex-1 space-y-2">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={startDate}
                  min={REPORT_LAUNCH_DATE}
                  max={getTodayStr()}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="input-glass rounded-xl"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={endDate}
                  min={REPORT_LAUNCH_DATE}
                  max={getTodayStr()}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="input-glass rounded-xl"
                />
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-2 sm:flex">
                <Button variant="outline" onClick={exportToCSV} className="rounded-xl gap-2">
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
                <Button variant="outline" onClick={exportToExcel} className="rounded-xl gap-2">
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
                <Button variant="outline" onClick={exportToPDF} className="rounded-xl gap-2">
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            title="Total ventas"
            value={`$${stats.totalUSD.toFixed(2)}`}
            subtitle={`${formatBS(convertToBS(stats.totalUSD))}`}
            icon={<DollarSign className="h-6 w-6" />}
            variant="gold"
          />
          <StatCard
            title="Cantidad Vendida"
            value={stats.totalQuantity}
            subtitle={`${stats.salesCount} transacciones`}
            icon={<ShoppingCart className="h-6 w-6" />}
            variant="default"
          />
          <StatCard
            title="Ventas a Crédito"
            value={`$${stats.creditTotal.toFixed(2)}`}
            subtitle={`${((stats.creditTotal / stats.totalUSD) * 100 || 0).toFixed(1)}% del total`}
            icon={<ChartSuccess className="h-6 w-6" />}
          />
          <StatCard
            title="Período"
            value={`${filteredSales.length}`}
            subtitle="ventas en rango"
            icon={<Calendar className="h-6 w-6" />}
          />
        </div>

        {/* Payment Methods Breakdown (solo si hay ventas en el período) */}
        {Object.keys(stats.byPaymentMethod).length > 0 && (
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="font-serif">Ventas por Método de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(stats.byPaymentMethod).map(([method, total]) => (
                <div key={method} className="p-4 rounded-xl bg-secondary/80 text-center">
                  <p className="text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[method] || method.replace(/_/g, ' ')}</p>
                  <p className="text-lg font-bold text-gradient-gold">${(total as number).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Sales Table */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="font-serif">Historial de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Móvil: lista; escritorio: tabla */}
            <ul className="divide-y divide-border md:hidden">
              {filteredSales.slice(0, 50).map((sale) => (
                <li key={sale.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{sale.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sale.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                      {' · '}{sale.quantity} ud{sale.quantity === 1 ? '' : 's'}
                      {sale.client_name ? ` · ${sale.client_name}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">${Number(sale.total_usd).toFixed(2)}</p>
                    <p className="text-[11px] capitalize text-muted-foreground">{sale.is_credit ? 'Crédito' : sale.payment_method.replace(/_/g, ' ')}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Cliente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.slice(0, 50).map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(sale.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                      </TableCell>
                      <TableCell className="font-medium">{sale.product_name}</TableCell>
                      <TableCell className="text-center">{sale.quantity}</TableCell>
                      <TableCell className="text-right font-semibold">${Number(sale.total_usd).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={sale.is_credit ? 'outline' : 'secondary'} className="capitalize">
                          {sale.is_credit ? 'Crédito' : sale.payment_method.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{sale.client_name || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
              {filteredSales.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-muted-foreground">No hay ventas en este período</p>
                </div>
              )}
              {filteredSales.length > 50 && (
                <p className="text-center text-muted-foreground py-4">
                  Mostrando 50 de {filteredSales.length} ventas. Exporta para ver todas.
                </p>
              )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
