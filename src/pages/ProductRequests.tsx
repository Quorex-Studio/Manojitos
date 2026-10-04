import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, Heart, Loader, MessageSquare, Search, TickCircle } from 'reicon-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { whatsappLink } from '@/components/customers/customerUi';
import { useProductRequests, type ProductRequestRow, type ProductRequestStatus } from '@/hooks/useProductRequests';
import { BRAND_NAME } from '@/config/brand';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Filter = 'pending' | 'notified' | 'closed' | 'all';
type Sort = 'mas_pedidos' | 'recientes' | 'nombre' | 'agotados';

const FILTERS: [Filter, string][] = [['pending', 'Por atender'], ['notified', 'Avisadas'], ['closed', 'Atendidas'], ['all', 'Todas']];
const SORTS: [Sort, string][] = [['mas_pedidos', 'Más pedidos'], ['recientes', 'Más recientes'], ['agotados', 'Agotados primero'], ['nombre', 'Nombre (A-Z)']];
const STATUS_LABEL: Record<ProductRequestStatus, string> = { pending: 'Por atender', notified: 'Avisada', closed: 'Atendida' };

interface Group {
  productId: string;
  product: ProductRequestRow['product'];
  rows: ProductRequestRow[];
  last: string;
}

const waMessage = (name: string, product: string, available: boolean) =>
  available
    ? `¡Hola ${name}! Te escribimos de ${BRAND_NAME}: ya llegó «${product}», el producto que querías. ¿Te lo apartamos?`
    : `¡Hola ${name}! Te escribimos de ${BRAND_NAME} por «${product}», el producto que nos pediste.`;

/** Panel → Productos pedidos: lo que las clientas quieren y está agotado ("Lo quiero"). */
export default function ProductRequests() {
  const { requests, isLoading, setStatus } = useProductRequests();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('estado') as Filter) || 'pending';
  const sort = (params.get('orden') as Sort) || 'mas_pedidos';
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const setParam = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next, { replace: true }); };

  const counts = useMemo(() => ({
    pending: requests.filter(r => r.status === 'pending').length,
    notified: requests.filter(r => r.status === 'notified').length,
    closed: requests.filter(r => r.status === 'closed').length,
    all: requests.length,
  }), [requests]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, Group>();
    for (const r of requests) {
      if (filter !== 'all' && r.status !== filter) continue;
      if (q && !`${r.product?.name ?? ''} ${r.name} ${r.phone ?? ''}`.toLowerCase().includes(q)) continue;
      const g = map.get(r.product_id) ?? { productId: r.product_id, product: r.product, rows: [], last: r.created_at };
      g.rows.push(r);
      if (r.created_at > g.last) g.last = r.created_at;
      map.set(r.product_id, g);
    }
    const list = [...map.values()];
    const name = (g: Group) => g.product?.name ?? '';
    list.sort((a, b) =>
      sort === 'recientes' ? b.last.localeCompare(a.last)
        : sort === 'nombre' ? name(a).localeCompare(name(b), 'es')
          : sort === 'agotados' ? (a.product?.stock ?? 0) - (b.product?.stock ?? 0) || b.rows.length - a.rows.length
            : b.rows.length - a.rows.length || b.last.localeCompare(a.last));
    return list;
  }, [requests, filter, search, sort]);

  const mark = (ids: string[], status: ProductRequestStatus) =>
    setStatus.mutate({ ids, status }, {
      onSuccess: () => toast({ title: status === 'closed' ? 'Marcadas como atendidas' : status === 'notified' ? 'Marcadas como avisadas' : 'Vuelven a estar por atender' }),
      onError: (e: Error) => toast({ title: 'No se pudo actualizar', description: e.message, variant: 'destructive' }),
    });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="page-header">Productos pedidos</h1>
          <p className="page-subtitle">Lo que las clientas quieren y está agotado. Cuando repongas el stock, a las que tienen cuenta les llega el aviso solo; a las demás escríbeles por WhatsApp.</p>
        </div>

        <div className="admin-tabs flex gap-2 overflow-x-auto">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setParam('estado', key)}
              className={cn('h-10 shrink-0 rounded-full border px-4 text-sm font-medium', filter === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card')}>
              {label} ({counts[key]})
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto o clienta" className="h-11 rounded-xl pl-10" aria-label="Buscar" />
          </div>
          <Select value={sort} onValueChange={v => setParam('orden', v)}>
            <SelectTrigger className="h-11 w-full rounded-xl sm:w-[200px]" aria-label="Ordenar"><SelectValue /></SelectTrigger>
            <SelectContent>{SORTS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <Heart className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 font-medium">{filter === 'pending' ? 'No hay productos pedidos por atender' : 'No hay solicitudes aquí'}</p>
            <p className="mt-1 text-sm text-muted-foreground">Cuando una clienta toque «Lo quiero» en un producto agotado, aparecerá aquí.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map(g => {
              const stock = g.product?.stock ?? 0;
              const expanded = open === g.productId;
              const pendingIds = g.rows.filter(r => r.status === 'pending').map(r => r.id);
              return (
                <li key={g.productId} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <button type="button" onClick={() => setOpen(expanded ? null : g.productId)} aria-expanded={expanded}
                    className="flex w-full items-center gap-3 p-3 text-left sm:gap-4 sm:p-4">
                    <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">
                      {g.product?.image_url
                        ? <img src={g.product.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        : <Heart className="m-auto mt-5 h-6 w-6 text-muted-foreground/50 sm:mt-7" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{g.product?.name ?? 'Producto eliminado'}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className={cn('rounded-full px-2 py-0.5 font-medium', stock > 0 ? 'bg-success/15 text-success' : 'bg-sale/10 text-sale')}>
                          {stock > 0 ? `Hay ${stock}` : 'Agotado'}
                        </span>
                        {g.product && <span className="text-muted-foreground tabular-nums">${Number(g.product.price_usd).toFixed(2)}</span>}
                        <span className="text-muted-foreground">· {formatDistanceToNow(new Date(g.last), { addSuffix: true, locale: es })}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="font-serif text-2xl leading-none tabular-nums text-primary">{g.rows.length}</span>
                      <span className="text-[11px] text-muted-foreground">{g.rows.length === 1 ? 'la quiere' : 'la quieren'}</span>
                    </span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                  </button>

                  {expanded && (
                    <div className="border-t border-border bg-studio/50 p-3 sm:p-4">
                      <ul className="divide-y divide-border">
                        {g.rows.map(r => (
                          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{r.name}{r.user_id && <span className="ml-2 text-xs font-normal text-muted-foreground">con cuenta</span>}</p>
                              <p className="text-xs text-muted-foreground">
                                {[r.phone, r.email].filter(Boolean).join(' · ') || 'Sin contacto'} · {STATUS_LABEL[r.status]} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: es })}
                              </p>
                              {r.note && <p className="mt-1 text-sm text-foreground/80">«{r.note}»</p>}
                            </div>
                            {r.phone && (
                              <Button asChild size="sm" variant="outline" className="h-10 rounded-full">
                                <a href={`${whatsappLink(r.phone)}?text=${encodeURIComponent(waMessage(r.name.split(' ')[0], g.product?.name ?? 'el producto', stock > 0))}`}
                                  target="_blank" rel="noreferrer" onClick={() => r.status === 'pending' && stock > 0 && mark([r.id], 'notified')}>
                                  <MessageSquare className="h-4 w-4" />WhatsApp
                                </a>
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                        {g.product && (
                          <Button asChild variant="outline" className="h-11 rounded-full">
                            <Link to={`/products?q=${encodeURIComponent(g.product.name)}`}>Reponer stock</Link>
                          </Button>
                        )}
                        {pendingIds.length > 0 ? (
                          <Button className="h-11 rounded-full" disabled={setStatus.isPending} onClick={() => mark(pendingIds, 'closed')}>
                            <TickCircle className="h-4 w-4" />Marcar atendidas ({pendingIds.length})
                          </Button>
                        ) : (
                          <Button variant="ghost" className="h-11 rounded-full" disabled={setStatus.isPending} onClick={() => mark(g.rows.map(r => r.id), 'pending')}>
                            Volver a «Por atender»
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
