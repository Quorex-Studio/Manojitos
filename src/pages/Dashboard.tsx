import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChartSuccess, DollarSign, ShoppingBag, ArrowUp, InfoCircle, Package, CreditCard } from 'reicon-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { DashboardAlertsDropdown } from '@/components/admin/AdminAlertsPanel';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCredits } from '@/hooks/useCredits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatBS } from '@/lib/utils';
import { isToday } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Dashboard admin — Premium editorial
export default function Dashboard() {
  // --- STATE ---
  const { sales } = useSales();
  const { products } = useProducts();
  const { credits } = useCredits();
  const { displayCurrency } = useCurrency();
  const { rate, convertToBS, calculateAllCurrencies } = useExchangeRate(displayCurrency === 'EUR' ? 'EUR' : 'USD');

  const { data: todayPayments = [] } = useQuery({
    queryKey: ['today-payments'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('sale_payments')
        .select(`
          id, amount_usd, payment_method, created_at,
          sale:sales(client_name, product_name)
        `)
        .gte('created_at', today.toISOString());
      
      if (error) throw error;
      return data || [];
    }
  });

  // --- DERIVED ---
  const stats = useMemo(() => {
    const todaySales = sales.filter(s => isToday(new Date(s.created_at)));
    const todayTotal = todaySales.reduce((acc, s) => acc + Number(s.total_usd), 0);
    const monthTotal = sales.reduce((acc, s) => acc + Number(s.total_usd), 0);
    const totalCreditBalance = credits.reduce((acc, c) => acc + Number(c.current_balance), 0);
    const lowStockProducts = products.filter(p => p.stock <= 5);

    return {
      todaySales: todaySales.length,
      todayTotal,
      monthTotal,
      totalCreditBalance,
      lowStockCount: lowStockProducts.length,
      totalProducts: products.length,
      todaySalesList: todaySales,
      pendingCreditsList: [...credits].sort((a, b) => b.current_balance - a.current_balance).filter(c => c.current_balance > 0),
      lowStockProductsList: lowStockProducts,
    };
  }, [sales, products, credits]);

  // Chart data
  const salesChartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - idx));
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

  // Helper para mostrar moneda primaria/secundaria en el Dashboard
  const formatCurrencyPair = (amountUsd: number) => {
    const { USD, VES, EUR } = calculateAllCurrencies(amountUsd);
    
    if (displayCurrency === 'VES') {
      return {
        primary: `${formatBS(VES)}`,
        secondary: `$${USD.toFixed(2)}`
      };
    } else if (displayCurrency === 'EUR') {
      return {
        primary: `€${EUR.toFixed(2)}`,
        secondary: `$${USD.toFixed(2)}`
      };
    }
    
    return {
      primary: `$${USD.toFixed(2)}`,
      secondary: rate > 0 ? `${formatBS(VES)}` : ''
    };
  };

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header — editorial serif with Notification Dropdown */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground tracking-tight">
              Panel General
            </h1>
            <p className="text-muted-foreground/40 mt-1 text-sm tracking-wide">
              Resumen de tu negocio
            </p>
          </div>
          <DashboardAlertsDropdown />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            title="Ventas Hoy"
            value={formatCurrencyPair(stats.todayTotal).primary}
            subtitle={`${stats.todaySales} ventas`}
            tertiaryText={formatCurrencyPair(stats.todayTotal).secondary}
            icon={<DollarSign className="h-6 w-6" />}
            variant="gold"
            delay={0}
            href="/sales"
            hoverContent={
              stats.todaySalesList.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold border-b border-border/50 pb-2">Ventas de Hoy</h4>
                  <ul className="text-sm space-y-1">
                    {stats.todaySalesList.slice(0, 5).map(s => (
                      <li key={s.id} className="flex justify-between items-center text-xs">
                        <span className="truncate w-32">{s.product_name}</span>
                        <span className="font-bold text-gradient-gold">{formatCurrencyPair(Number(s.total_usd)).primary}</span>
                      </li>
                    ))}
                  </ul>
                  {stats.todaySalesList.length > 5 && <p className="text-xs text-muted-foreground pt-1">+ {stats.todaySalesList.length - 5} más</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay ventas hoy</p>
              )
            }
          />
          <StatCard
            title="Abonos Hoy"
            value={formatCurrencyPair(todayPayments.reduce((acc, p) => acc + Number(p.amount_usd), 0)).primary}
            subtitle={`${todayPayments.length} abonos`}
            tertiaryText={formatCurrencyPair(todayPayments.reduce((acc, p) => acc + Number(p.amount_usd), 0)).secondary}
            icon={<ArrowUp className="h-6 w-6" />}
            variant="default"
            delay={0.05}
            href="/sales"
            hoverContent={
              todayPayments.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold border-b border-border/50 pb-2">Abonos de Hoy</h4>
                  <ul className="text-sm space-y-1">
                    {todayPayments.slice(0, 5).map(p => (
                      <li key={p.id} className="flex justify-between items-center text-xs">
                        <span className="truncate w-32">{p.sale?.client_name || 'Desconocido'}</span>
                        <span className="font-bold text-gradient-gold">${Number(p.amount_usd).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  {todayPayments.length > 5 && <p className="text-xs text-muted-foreground pt-1">+ {todayPayments.length - 5} más</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay abonos hoy</p>
              )
            }
          />
          <StatCard
            title="Ventas del Mes"
            value={formatCurrencyPair(stats.monthTotal).primary}
            subtitle={`${sales.length} ventas`}
            tertiaryText={formatCurrencyPair(stats.monthTotal).secondary}
            icon={<ChartSuccess className="h-6 w-6" />}
            variant="default"
            delay={0.1}
            href="/sales"
            hoverContent={
              sales.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold border-b border-border/50 pb-2">Últimas Ventas</h4>
                  <ul className="text-sm space-y-1">
                    {sales.slice(0, 5).map(s => (
                      <li key={s.id} className="flex justify-between items-center text-xs">
                        <span className="truncate w-32">{s.product_name}</span>
                        <span className="font-bold text-gradient-gold">${Number(s.total_usd).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  {sales.length > 5 && <p className="text-xs text-muted-foreground pt-1">+ {sales.length - 5} ventas previas</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay ventas registradas</p>
              )
            }
          />
          <StatCard
            title="Créditos Pendientes"
            value={formatCurrencyPair(stats.totalCreditBalance).primary}
            subtitle={`${stats.pendingCreditsList.length} clientes`}
            tertiaryText={formatCurrencyPair(stats.totalCreditBalance).secondary}
            icon={<CreditCard className="h-6 w-6" />}
            variant="default"
            delay={0.2}
            href="/credits"
            hoverContent={
              stats.pendingCreditsList.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold border-b border-border/50 pb-2">Top Deudores</h4>
                  <ul className="text-sm space-y-1">
                    {stats.pendingCreditsList.slice(0, 5).map(c => (
                      <li key={c.id} className="flex justify-between items-center text-xs">
                        <span className="truncate w-32">{c.client_name || 'Sin nombre'}</span>
                        <span className="font-bold text-destructive">{formatCurrencyPair(Number(c.current_balance)).primary}</span>
                      </li>
                    ))}
                  </ul>
                  {stats.pendingCreditsList.length > 5 && <p className="text-xs text-muted-foreground pt-1">+ {stats.pendingCreditsList.length - 5} más</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay créditos pendientes</p>
              )
            }
          />
          <StatCard
            title="Stock Bajo"
            value={stats.lowStockCount}
            subtitle={`de ${stats.totalProducts} productos`}
            icon={<InfoCircle className="h-6 w-6" />}
            delay={0.3}
            href="/products"
            hoverContent={
              stats.lowStockProductsList.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold border-b border-border/50 pb-2">Atención Stock</h4>
                  <ul className="text-sm space-y-1">
                    {stats.lowStockProductsList.slice(0, 5).map(p => (
                      <li key={p.id} className="flex justify-between items-center text-xs">
                        <span className="truncate w-32">{p.name}</span>
                        <span className="font-bold text-destructive">{p.stock} uds</span>
                      </li>
                    ))}
                  </ul>
                  {stats.lowStockProductsList.length > 5 && <p className="text-xs text-muted-foreground pt-1">+ {stats.lowStockProductsList.length - 5} más</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Inventario saludable</p>
              )
            }
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
                      <p className="font-semibold text-sm text-gradient-gold">{formatCurrencyPair(Number(sale.total_usd)).primary}</p>
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
