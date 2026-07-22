import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  AlertCircle,
  Package,
  CreditCard
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { AdminAlertsPanel } from '@/components/admin/AdminAlertsPanel';
import { CustomerOfMonthCard } from '@/components/credits/CustomerOfMonthCard';

import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { useDebts } from '@/hooks/useDebts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatBS } from '@/lib/utils';

// Dashboard admin — Premium editorial
export default function Dashboard() {
  // --- STATE ---
  const { sales } = useSales();
  const { products } = useProducts();
  const { pendingDebts } = useDebts();
  const { rate, convertToBS } = useExchangeRate();

  // --- DERIVED ---
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todaySales = sales.filter(s => new Date(s.created_at).toDateString() === today);
    const todayTotal = todaySales.reduce((acc, s) => acc + Number(s.total_usd), 0);
    const monthTotal = sales.reduce((acc, s) => acc + Number(s.total_usd), 0);
    const totalDebt = pendingDebts.reduce((acc, d) => acc + Number(d.amount_usd), 0);
    const lowStockProducts = products.filter(p => p.stock <= 5);

    return {
      todaySales: todaySales.length,
      todayTotal,
      monthTotal,
      totalDebt,
      lowStockCount: lowStockProducts.length,
      totalProducts: products.length
    };
  }, [sales, products, pendingDebts]);

  // Chart data
  const salesChartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toDateString();
    });

    return last7Days.map(dateStr => {
      const daySales = sales.filter(s => new Date(s.created_at).toDateString() === dateStr);
      const total = daySales.reduce((acc, s) => acc + Number(s.total_usd), 0);
      const date = new Date(dateStr);
      return {
        name: date.toLocaleDateString('es', { weekday: 'short' }),
        ventas: total
      };
    });
  }, [sales]);

  const topProductsData = useMemo(() => {
    return [...products]
      .sort((a, b) => b.sold_count - a.sold_count)
      .slice(0, 5)
      .map(p => ({
        name: p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name,
        vendidos: p.sold_count
      }));
  }, [products]);

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header — editorial serif */}
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground/40 mt-1 text-sm tracking-wide">
            Resumen de tu negocio
          </p>
        </div>

        {/* Panel de Alertas + Cliente del Mes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-1">
            <AdminAlertsPanel />
          </div>
          <CustomerOfMonthCard />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Ventas Hoy"
            value={`$${stats.todayTotal.toFixed(2)}`}
            subtitle={`${stats.todaySales} ventas`}
            icon={<DollarSign className="h-6 w-6" />}
            variant="gold"
            delay={0}
          />
          <StatCard
            title="Ventas del Mes"
            value={`$${stats.monthTotal.toFixed(2)}`}
            subtitle={`Bs. ${formatBS(convertToBS(stats.monthTotal))}`}
            icon={<TrendingUp className="h-6 w-6" />}
            variant="default"
            delay={0.1}
          />
          <StatCard
            title="Cuentas Pendientes"
            value={`$${stats.totalDebt.toFixed(2)}`}
            subtitle={`${pendingDebts.length} clientes`}
            icon={<CreditCard className="h-6 w-6" />}
            delay={0.2}
          />
          <StatCard
            title="Stock Bajo"
            value={stats.lowStockCount}
            subtitle={`de ${stats.totalProducts} productos`}
            icon={<AlertCircle className="h-6 w-6" />}
            delay={0.3}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-card backdrop-blur-sm border border-border/40 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <CardHeader>
                <CardTitle className="font-serif text-lg tracking-tight text-foreground/80">
                  Ventas de los últimos 7 días
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground) / 0.4)" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground) / 0.4)" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border) / 0.4)',
                        borderRadius: '16px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                        fontSize: '13px'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ventas" 
                      stroke="hsl(var(--gold))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--gold))', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: 'hsl(var(--gold))', strokeWidth: 2, fill: 'hsl(var(--gold))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-card backdrop-blur-sm border border-border/40 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <CardHeader>
                <CardTitle className="font-serif text-lg tracking-tight text-foreground/80">
                  Productos más vendidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topProductsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground) / 0.4)" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground) / 0.4)" width={100} fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border) / 0.15)',
                        borderRadius: '16px',
                        boxShadow: '0 8px 32px hsl(var(--rose) / 0.1)',
                        fontSize: '13px'
                      }} 
                    />
                    <Bar dataKey="vendidos" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Sales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-card backdrop-blur-sm border border-border/40 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <CardHeader>
              <CardTitle className="font-serif text-lg tracking-tight text-foreground/80">
                Últimas ventas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sales.slice(0, 5).map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors duration-300">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <ShoppingBag className="h-4 w-4 text-primary/70" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground/80">{sale.product_name}</p>
                        <p className="text-xs text-muted-foreground/40 tracking-wide">
                          {new Date(sale.created_at).toLocaleDateString('es-VE', { 
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-gradient-gold">${Number(sale.total_usd).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground/30 tracking-wide">{sale.payment_method}</p>
                    </div>
                  </div>
                ))}
                {sales.length === 0 && (
                  <p className="text-center text-muted-foreground/30 py-12 text-sm tracking-wide">No hay ventas registradas</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
