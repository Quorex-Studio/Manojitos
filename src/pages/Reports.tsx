import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';
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

export default function Reports() {
  // --- STATE ---
  const { sales } = useSales();
  const { convertToBS } = useExchangeRate();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // --- DERIVED ---

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const saleDate = new Date(s.created_at).toISOString().split('T')[0];
      return saleDate >= startDate && saleDate <= endDate;
    });
  }, [sales, startDate, endDate]);

  const stats = useMemo(() => {
    const totalUSD = filteredSales.reduce((acc, s) => acc + Number(s.total_usd), 0);
    const totalQuantity = filteredSales.reduce((acc, s) => acc + s.quantity, 0);
    const creditSales = filteredSales.filter(s => s.is_credit);
    const creditTotal = creditSales.reduce((acc, s) => acc + Number(s.total_usd), 0);

    const byPaymentMethod: Record<string, number> = {};
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
      s.product_name,
      s.quantity,
      Number(s.unit_price_usd).toFixed(2),
      Number(s.total_usd).toFixed(2),
      s.is_credit ? 'Crédito' : s.payment_method,
      s.client_name || '-'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_ventas_${startDate}_${endDate}.csv`;
    link.click();
  };

  const exportToJSON = () => {
    const data = filteredSales.map(s => ({
      fecha: new Date(s.created_at).toISOString(),
      producto: s.product_name,
      cantidad: s.quantity,
      precio_unitario: Number(s.unit_price_usd),
      total_usd: Number(s.total_usd),
      metodo_pago: s.is_credit ? 'crédito' : s.payment_method,
      cliente: s.client_name
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_ventas_${startDate}_${endDate}.json`;
    link.click();
  };

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Reportes</h1>
          <p className="page-subtitle">Análisis de ventas e ingresos</p>
        </div>

        {/* Filters */}
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-glass rounded-xl"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-glass rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={exportToCSV} className="rounded-xl gap-2">
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
                <Button variant="outline" onClick={exportToJSON} className="rounded-xl gap-2">
                  <Download className="h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Ventas"
            value={`$${stats.totalUSD.toFixed(2)}`}
            subtitle={`Bs. ${convertToBS(stats.totalUSD).toFixed(2)}`}
            icon={<DollarSign className="h-6 w-6" />}
            variant="gold"
          />
          <StatCard
            title="Cantidad Vendida"
            value={stats.totalQuantity}
            subtitle={`${stats.salesCount} transacciones`}
            icon={<ShoppingCart className="h-6 w-6" />}
            variant="rose"
          />
          <StatCard
            title="Ventas a Crédito"
            value={`$${stats.creditTotal.toFixed(2)}`}
            subtitle={`${((stats.creditTotal / stats.totalUSD) * 100 || 0).toFixed(1)}% del total`}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Período"
            value={`${filteredSales.length}`}
            subtitle="ventas en rango"
            icon={<Calendar className="h-6 w-6" />}
          />
        </div>

        {/* Payment Methods Breakdown */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="font-serif">Ventas por Método de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(stats.byPaymentMethod).map(([method, total]) => (
                <div key={method} className="p-4 rounded-xl bg-secondary/30 text-center">
                  <p className="text-sm text-muted-foreground capitalize">{method.replace('_', ' ')}</p>
                  <p className="text-lg font-bold text-gradient-gold">${(total as number).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sales Table */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="font-serif">Historial de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
                        <Badge variant={sale.is_credit ? 'destructive' : 'secondary'}>
                          {sale.is_credit ? 'Crédito' : sale.payment_method.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{sale.client_name || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredSales.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground">No hay ventas en este período</p>
                </div>
              )}
              {filteredSales.length > 50 && (
                <p className="text-center text-muted-foreground py-4">
                  Mostrando 50 de {filteredSales.length} ventas. Exporta para ver todas.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
