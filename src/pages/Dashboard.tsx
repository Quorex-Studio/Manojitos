import { needsRestock } from '@/lib/stock';
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChartSuccess, DollarSign, ShoppingBag, ArrowUp, InfoCircle, Package, CreditCard, Plus, DocumentUpload, Store, TickCircle, ArrowRight } from 'reicon-react';
import { Link } from 'react-router-dom';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { PAYMENT_METHOD_LABELS } from '@/lib/paymentMethodFields';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
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
  const { methods: paymentMethods } = usePaymentMethods(false);
  const { user } = useAuth();
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
    const lowStockProducts = products.filter(needsRestock);

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

  const hasWeekSales = salesChartData.some(d => d.ventas > 0);
  const hasTopSellers = topProductsData.some(d => d.vendidos > 0);
  const paymentsReady = paymentMethods.length > 0 && paymentMethods.every(m => Object.values(m.config || {}).every(v => String(v || '').trim()));
  const setupSteps = [
    { done: products.length > 0, label: 'Carga tus productos', hint: 'Impórtalos desde Treinta o Excel', to: '/import-products' },
    { done: paymentsReady, label: 'Completa tus datos de pago', hint: 'Para que las clientas sepan a dónde pagarte', to: '/settings' },
    { done: sales.length > 0, label: 'Registra tu primera venta', hint: 'Desde Ventas → Nueva venta', to: '/sales?nueva=1' },
  ];
  const setupPending = setupSteps.filter(s => !s.done).length;
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0];
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; })();

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
      <div className="space-y-6 md:space-y-8">
        {/* Header — editorial serif with Notification Dropdown */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-header">Panel general</h1>
            <p className="font-serif text-2xl text-foreground md:hidden">{greeting}{firstName ? `, ${firstName}` : ''}</p>
            <p className="page-subtitle">
              <span className="hidden md:inline">{greeting}{firstName ? `, ${firstName}` : ''} · </span>
              {new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="hidden md:block"><DashboardAlertsDropdown /></div>
        </div>

        {/* Accesos rápidos: lo que más se hace en el día */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:px-0">
          {[
            { to: '/sales?nueva=1', label: 'Nueva venta', icon: Plus, primary: true },
            { to: '/products', label: 'Productos', icon: Package },
            { to: '/import-products', label: 'Importar', icon: DocumentUpload },
            { to: '/', label: 'Ver tienda', icon: Store },
          ].map(({ to, label, icon: Icon, primary }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex h-11 shrink-0 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors',
                primary ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : 'border-border bg-card hover:border-primary/40'
              )}
            >
              <Icon className="h-4 w-4" />{label}
            </Link>
          ))}
        </div>

        {/* Primeros pasos (solo mientras falte algo) */}
        {setupPending > 0 && (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 md:p-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="font-serif text-lg">Primeros pasos</h2>
              <span className="text-xs text-muted-foreground">{setupSteps.length - setupPending} de {setupSteps.length} listos</span>
            </div>
            <ol className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {setupSteps.map((step, i) => (
                <li key={step.label}>
                  <Link
                    to={step.to}
                    className={cn(
                      'group flex h-full items-center gap-3 rounded-xl border bg-card p-3 transition-colors',
                      step.done ? 'border-border opacity-70' : 'border-border hover:border-primary/50'
                    )}
                  >
                    <span className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      step.done ? 'bg-success/15 text-success' : 'bg-primary text-primary-foreground'
                    )}>
                      {step.done ? <TickCircle className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm font-semibold', step.done && 'line-through')}>{step.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{step.hint}</span>
                    </span>
                    {!step.done && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1">
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
            href="/sales?tab=cuentas-cobrar"
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
            href="/products?stock=bajo"
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
                {!hasWeekSales ? (
                  <EmptyChart icon={<ChartSuccess className="h-6 w-6" />} text="Cuando registres ventas, aquí verás cómo te fue cada día." />
                ) : (
                <ResponsiveContainer width="100%" height={260}>
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
                )}
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
                {!hasTopSellers ? (
                  <EmptyChart icon={<Package className="h-6 w-6" />} text="Aquí aparecerán tus productos estrella cuando empieces a vender." />
                ) : (
                <ResponsiveContainer width="100%" height={260}>
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
                )}
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
                        <p className="text-xs text-muted-foreground tracking-wide">
                          {new Date(sale.created_at).toLocaleDateString('es-VE', { 
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-gradient-gold">{formatCurrencyPair(Number(sale.total_usd)).primary}</p>
                      <p className="text-[11px] text-muted-foreground">{PAYMENT_METHOD_LABELS[sale.payment_method] || sale.payment_method}</p>
                    </div>
                  </div>
                ))}
                {sales.length === 0 && (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <p className="text-sm text-muted-foreground">Todavía no hay ventas.</p>
                    <Link to="/sales?nueva=1" className="flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
                      <Plus className="h-4 w-4" />Registrar la primera
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}

function EmptyChart({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-3 rounded-2xl bg-studio px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground">{icon}</span>
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
