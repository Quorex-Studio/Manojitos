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
import { AngelaCopilotPanel } from '@/components/ai/AngelaCopilotPanel';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { useDebts } from '@/hooks/useDebts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Dashboard() {
  const { sales } = useSales();
  const { products } = useProducts();
  const { pendingDebts } = useDebts();
  const { rate, convertToBS } = useExchangeRate();

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

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="page-subtitle">Resumen de tu negocio</p>
        </div>

        {/* Panel de Alertas + Ángela Copiloto + Cliente del Mes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <AdminAlertsPanel />
          </div>
          <div className="lg:col-span-1">
            <AngelaCopilotPanel />
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
            subtitle={`Bs. ${convertToBS(stats.monthTotal).toFixed(2)}`}
            icon={<TrendingUp className="h-6 w-6" />}
            variant="rose"
            delay={0.1}
          />
          <StatCard
            title="Deudas Pendientes"
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
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="font-serif text-xl">Ventas de los últimos 7 días</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ventas" 
                      stroke="hsl(var(--gold))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--gold))', strokeWidth: 2 }}
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
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="font-serif text-xl">Productos más vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topProductsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={100} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px'
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
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="font-serif text-xl">Últimas ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sales.slice(0, 5).map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg gradient-primary">
                        <ShoppingBag className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{sale.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(sale.created_at).toLocaleDateString('es', { 
                            day: 'numeric', 
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gradient-gold">${Number(sale.total_usd).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{sale.payment_method}</p>
                    </div>
                  </div>
                ))}
                {sales.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No hay ventas registradas</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
