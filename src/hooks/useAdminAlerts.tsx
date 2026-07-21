/**
 * useAdminAlerts — Hook to generate intelligent alerts based on business data.
 * Computes: stock status, overdue credits, pending debts, and daily sales.
 * Returns: { alerts, criticalCount, warningCount, hasAlerts, hasCritical }
 */
// Hook para alertas inteligentes del admin
import { useMemo } from 'react';
import { useProducts } from './useProducts';
import { useSales } from './useSales';
import { useCredits } from './useCredits';
import { useDebts } from './useDebts';

export type AlertType = 'critical' | 'warning' | 'info' | 'success';
export type AlertCategory = 'stock' | 'sales' | 'credit' | 'debt' | 'performance';

export interface AdminAlert {
  id: string;
  type: AlertType;
  category: AlertCategory;
  title: string;
  message: string;
  icon: string;
  action?: {
    label: string;
    path: string;
  };
  timestamp: Date;
  data?: any;
}

export function useAdminAlerts() {
  const { products } = useProducts();
  const { sales } = useSales();
  const { credits, stats: creditStats } = useCredits();
  const { pendingDebts } = useDebts();

  const alerts = useMemo(() => {
    const alertList: AdminAlert[] = [];
    const now = new Date();

    // 🚨 Alertas de Stock Crítico
    const lowStockProducts = products.filter(p => p.stock > 0 && p.stock < 10);
    const outOfStockProducts = products.filter(p => p.stock === 0);

    if (outOfStockProducts.length > 0) {
      alertList.push({
        id: 'stock-out',
        type: 'critical',
        category: 'stock',
        title: 'Productos agotados',
        message: `${outOfStockProducts.length} producto(s) sin stock`,
        icon: 'AlertTriangle',
        action: { label: 'Ver productos', path: '/tienda' },
        timestamp: now,
        data: outOfStockProducts
      });
    }

    if (lowStockProducts.length > 0) {
      alertList.push({
        id: 'stock-low',
        type: 'warning',
        category: 'stock',
        title: 'Stock bajo',
        message: `${lowStockProducts.length} producto(s) con menos de 10 unidades`,
        icon: 'AlertCircle',
        action: { label: 'Reponer', path: '/tienda' },
        timestamp: now,
        data: lowStockProducts
      });
    }

    // 📉 Alertas de Créditos en mora
    const overdueCredits = credits.filter(c => c.calculatedStatus === 'VENCIDO');
    const atRiskCredits = credits.filter(c => c.calculatedStatus === 'EN_GRACIA');

    if (overdueCredits.length > 0) {
      const totalOverdue = overdueCredits.reduce((sum, c) => sum + c.current_balance, 0);
      alertList.push({
        id: 'credit-overdue',
        type: 'critical',
        category: 'credit',
        title: 'Créditos vencidos',
        message: `${overdueCredits.length} cliente(s) en mora - $${totalOverdue.toFixed(2)} pendiente`,
        icon: 'DollarSign',
        action: { label: 'Gestionar cobros', path: '/credits' },
        timestamp: now
      });
    }

    if (atRiskCredits.length > 0) {
      alertList.push({
        id: 'credit-grace',
        type: 'warning',
        category: 'credit',
        title: 'Créditos en gracia',
        message: `${atRiskCredits.length} cliente(s) en período de gracia`,
        icon: 'Clock',
        action: { label: 'Ver créditos', path: '/credits' },
        timestamp: now
      });
    }

    // 💰 Alertas de deudas pendientes
    if (pendingDebts.length > 0) {
      const totalDebt = pendingDebts.reduce((sum, d) => sum + d.amount_usd, 0);
      alertList.push({
        id: 'debts-pending',
        type: 'warning',
        category: 'debt',
        title: 'Deudas por cobrar',
        message: `${pendingDebts.length} deuda(s) pendiente(s) - $${totalDebt.toFixed(2)}`,
        icon: 'FileText',
        action: { label: 'Ver deudas', path: '/debts' },
        timestamp: now
      });
    }

    // 📊 Alertas de ventas (últimas 24h)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = sales.filter(s => new Date(s.created_at) >= today);
    
    if (todaySales.length === 0 && now.getHours() >= 12) {
      alertList.push({
        id: 'sales-none',
        type: 'info',
        category: 'sales',
        title: 'Sin ventas hoy',
        message: 'No se han registrado ventas hoy',
        icon: 'TrendingDown',
        action: { label: 'Registrar venta', path: '/sales' },
        timestamp: now
      });
    }

    // 🏆 Alerta positiva de buen desempeño
    const goodPayersCount = credits.filter(c => (c.trust_score ?? 100) >= 80).length;
    if (goodPayersCount > 0 && overdueCredits.length === 0) {
      alertList.push({
        id: 'performance-good',
        type: 'success',
        category: 'performance',
        title: '¡Cartera saludable!',
        message: `${goodPayersCount} cliente(s) con excelente historial`,
        icon: 'CheckCircle',
        timestamp: now
      });
    }

    // Ordenar: críticos primero, luego por timestamp
    return alertList.sort((a, b) => {
      const priority = { critical: 0, warning: 1, info: 2, success: 3 };
      return priority[a.type] - priority[b.type];
    });
  }, [products, sales, credits, pendingDebts]);

  const criticalCount = alerts.filter(a => a.type === 'critical').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

  return {
    alerts,
    criticalCount,
    warningCount,
    hasAlerts: alerts.length > 0,
    hasCritical: criticalCount > 0
  };
}
