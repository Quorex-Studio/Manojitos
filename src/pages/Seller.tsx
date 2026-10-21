import { useMemo, useState } from 'react';
import { Logout, Plus, Receipt } from 'reicon-react';
import { BRAND } from '@/config/brand';
import { Button } from '@/components/ui/button';
import { NewSaleDialog } from '@/components/sales/NewSaleDialog';
import { useAuth } from '@/hooks/useAuth';
import { useSales } from '@/hooks/useSales';
import { PAYMENT_METHOD_LABELS } from '@/lib/paymentMethodFields';

const TIME_FMT = new Intl.DateTimeFormat('es-VE', { hour: 'numeric', minute: '2-digit' });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Panel del empleado (rol «vendedor»): solo factura. Abre Nueva venta y ve lo que vendió hoy.
 * Sin precios editables, inventario, reportes ni ajustes (eso es de administración).
 */
export default function Seller() {
  const { user, signOut } = useAuth();
  const { sales, loading: isLoading, refetch } = useSales();
  const [open, setOpen] = useState(false);
  const name = String(user?.user_metadata?.full_name || user?.email || '').split(' ')[0];

  const today = useMemo(() => {
    const now = new Date();
    const groups = new Map<string, { id: string; client: string; total: number; method: string; at: string; items: number }>();
    for (const s of sales) {
      if (s.user_id !== user?.id || s.status === 'cancelled' || !sameDay(new Date(s.created_at), now)) continue;
      const key = s.sale_group_id || s.id;
      const g = groups.get(key) ?? { id: key, client: s.client_name || 'Sin cliente', total: 0, method: s.payment_method || '', at: s.created_at, items: 0 };
      g.total += Number(s.total_usd) || 0;
      g.items += s.quantity || 1;
      groups.set(key, g);
    }
    const list = [...groups.values()].sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return { list, total: Math.round(list.reduce((t, g) => t + g.total, 0) * 100) / 100 };
  }, [sales, user?.id]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg font-semibold leading-tight">{BRAND.name}</p>
            <p className="truncate text-xs text-muted-foreground">Hola{name ? `, ${name}` : ''} · Ventas</p>
          </div>
          <Button variant="ghost" className="h-11 gap-2 rounded-full" onClick={() => signOut()}>
            <Logout className="h-5 w-5" />
            Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <Button onClick={() => setOpen(true)} className="btn-gold h-14 w-full gap-2 rounded-2xl text-base">
          <Plus className="h-5 w-5" />
          Nueva venta
        </Button>
        <NewSaleDialog open={open} onOpenChange={setOpen} onCreated={() => refetch()} />

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-lg font-semibold">Mis ventas de hoy</h1>
            <p className="text-sm text-muted-foreground">
              {today.list.length} {today.list.length === 1 ? 'venta' : 'ventas'} · <span className="font-semibold text-foreground">${today.total.toFixed(2)}</span>
            </p>
          </div>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : today.list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              Aún no has registrado ventas hoy.
            </p>
          ) : (
            <ul className="space-y-2">
              {today.list.map(g => (
                <li key={g.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Receipt className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.client}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {TIME_FMT.format(new Date(g.at))} · {g.items} {g.items === 1 ? 'artículo' : 'artículos'} · {PAYMENT_METHOD_LABELS[g.method] || g.method}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">${g.total.toFixed(2)}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Para corregir o anular una venta, avisa a administración.</p>
        </section>
      </main>
    </div>
  );
}
