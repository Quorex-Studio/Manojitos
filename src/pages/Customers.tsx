import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, Loader, MessageSquare, Search, Users } from 'reicon-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerDetailDialog } from '@/components/customers/CustomerDetailDialog';
import { KYC_META, KycBadge, KycFilter, initials, whatsappLink } from '@/components/customers/customerUi';
import { useCustomers, CustomerProfile } from '@/hooks/useCustomers';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type SortKey = 'recent' | 'name' | 'pending';

const FILTERS: { key: KycFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: KYC_META.pending.label },
  { key: 'approved', label: 'Verificados' },
  { key: 'none', label: KYC_META.none.label },
  { key: 'rejected', label: 'Rechazados' },
];

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Customers() {
  const reduceMotion = useReducedMotion();
  const { customers, isLoading, updateKycStatus } = useCustomers();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<KycFilter>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<KycFilter, number> = { all: customers.length, pending: 0, approved: 0, rejected: 0, none: 0 };
    customers.forEach(cu => { c[cu.kyc_status] = (c[cu.kyc_status] || 0) + 1; });
    return c;
  }, [customers]);

  const visible = useMemo(() => {
    const q = normalize(search.trim());
    const digits = search.replace(/\D/g, '');
    const list = customers.filter(c => {
      if (filter !== 'all' && c.kyc_status !== filter) return false;
      if (!q) return true;
      return normalize(c.full_name || '').includes(q)
        || normalize(c.email || '').includes(q)
        || (!!digits && ((c.phone || '').replace(/\D/g, '').includes(digits) || (c.dni || '').replace(/\D/g, '').includes(digits)));
    });
    return [...list].sort((a, b) => {
      if (sort === 'name') return (a.full_name || '').localeCompare(b.full_name || '', 'es');
      if (sort === 'pending' && (a.kyc_status === 'pending') !== (b.kyc_status === 'pending')) return a.kyc_status === 'pending' ? -1 : 1;
      return +new Date(b.created_at) - +new Date(a.created_at);
    });
  }, [customers, filter, search, sort]);

  // Se busca por id para que el diálogo refleje al instante el nuevo estado de verificación.
  const selected = customers.find(c => c.id === selectedId) ?? null;

  const handleUpdateStatus = async (userId: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      await updateKycStatus.mutateAsync({ userId, status });
      toast({ title: status === 'approved' ? 'Verificación aprobada' : status === 'rejected' ? 'Verificación rechazada' : 'Marcada para revisar de nuevo' });
    } catch {
      toast({ title: 'No se pudo actualizar', description: 'Intenta de nuevo en un momento.', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="page-header">Clientes</h1>
          <p className="page-subtitle">
            {counts.all} {counts.all === 1 ? 'cliente' : 'clientes'}
            {counts.pending > 0 && <> · <button type="button" onClick={() => setFilter('pending')} className="font-medium text-primary underline-offset-2 hover:underline">{counts.pending} por revisar</button></>}
          </p>
        </div>

        {/* Buscar + ordenar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value.slice(0, 60))}
              placeholder="Nombre, teléfono, cédula o correo"
              className="h-12 rounded-full pl-12"
              aria-label="Buscar clientes"
            />
          </div>
          <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
            <SelectTrigger className="h-12 w-[132px] shrink-0 rounded-full sm:w-[170px]" aria-label="Ordenar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recientes</SelectItem>
              <SelectItem value="name">Nombre A–Z</SelectItem>
              <SelectItem value="pending">Por revisar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtros por estado de verificación, con conteo */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="Filtrar por verificación">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                filter === f.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40'
              )}
            >
              {f.key !== 'all' && <span className={cn('h-2 w-2 rounded-full', KYC_META[f.key].dot)} />}
              {f.label}
              <span className={cn('tabular-nums', filter === f.key ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader className="h-8 w-8 animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-studio"><Users className="h-7 w-7 text-muted-foreground" /></span>
            <p className="font-medium">{customers.length === 0 ? 'Aún no hay clientes' : 'Ningún cliente coincide'}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {customers.length === 0
                ? 'Aparecen aquí cuando alguien crea su cuenta en la tienda o registras un cliente nuevo al vender.'
                : 'Prueba con otra búsqueda o cambia el filtro.'}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((c, i) => (
              <motion.li
                key={c.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.025, duration: 0.2 }}
              >
                <CustomerCard customer={c} onOpen={() => setSelectedId(c.id)} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <CustomerDetailDialog
        customer={selected}
        onOpenChange={open => { if (!open) setSelectedId(null); }}
        onUpdateStatus={handleUpdateStatus}
        isUpdating={updateKycStatus.isPending}
      />
    </AppLayout>
  );
}

function CustomerCard({ customer: c, onOpen }: { customer: CustomerProfile; onOpen: () => void }) {
  const pending = c.kyc_status === 'pending';
  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-2xl border bg-card p-3 pr-2 transition-colors hover:border-primary/40',
        pending ? 'border-amber-500/40' : 'border-border'
      )}
    >
      {/* Toda la tarjeta abre la ficha; WhatsApp queda como acción aparte */}
      <button type="button" onClick={onOpen} className="absolute inset-0 rounded-2xl" aria-label={`Ver ficha de ${c.full_name}`} />
      <Avatar className="h-12 w-12 shrink-0 border border-border">
        <AvatarImage src={c.face_photo_url || ''} alt="" className="object-cover" />
        <AvatarFallback className="bg-primary/10 font-serif text-primary">{initials(c.full_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-semibold group-hover:text-primary">{c.full_name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {c.phone || 'Sin teléfono'}{c.dni ? ` · CI ${c.dni}` : ''}
        </p>
        <div className="flex items-center gap-2">
          <KycBadge status={c.kyc_status} />
          <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), 'dd MMM yy', { locale: es })}</span>
        </div>
      </div>
      {c.phone && (
        <a
          href={whatsappLink(c.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-success/10 hover:text-success"
          aria-label={`WhatsApp a ${c.full_name}`}
        >
          <MessageSquare className="h-5 w-5" />
        </a>
      )}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </div>
  );
}
