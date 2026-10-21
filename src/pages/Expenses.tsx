import { useMemo, useState } from 'react';
import { Category, Edit, Loader, Plus, Search, Trash2, Wallet } from 'reicon-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { missingMigration, useExpenses, usePurchasingActions, type ExpenseRow } from '@/hooks/usePurchasing';
import { PURCHASE_METHODS, purchaseMethodName } from '@/components/purchases/purchaseMethods';
import { localDateISO } from '@/lib/dates';
import { cn, formatBS } from '@/lib/utils';

const money = (n: number) => `$${Number(n).toFixed(2)}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const l = new Date(y, m - 1, 1).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
  return l.charAt(0).toUpperCase() + l.slice(1);
};
const EMPTY = { id: '', category_id: '', description: '', amount_usd: '', amount_bs: '', payment_method: 'efectivo_usd', expense_date: localDateISO(), status: 'paid' as 'paid' | 'pending', due_date: '' };

/** Gastos del negocio por categoría (alquiler, servicios, publicidad…); los «por pagar» van a Cuentas por pagar. */
export default function Expenses() {
  const confirm = useConfirm();
  const { rate } = useExchangeRate();
  const { categories, expenses, migrated } = useExpenses();
  const { saveExpense, deleteExpense, saveCategory, deleteCategory } = usePurchasingActions();
  const cats = categories.data ?? [];
  const list = expenses.data ?? [];
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [editCat, setEditCat] = useState<{ id: string; name: string } | null>(null);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? 'Sin categoría';
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const stats = useMemo(() => {
    const month = list.filter(e => e.expense_date.startsWith(monthKey));
    const byCat = new Map<string, number>();
    month.forEach(e => byCat.set(e.category_id ?? '', (byCat.get(e.category_id ?? '') || 0) + Number(e.amount_usd)));
    return {
      month: month.reduce((s, e) => s + Number(e.amount_usd), 0),
      year: list.filter(e => e.expense_date.startsWith(String(now.getFullYear()))).reduce((s, e) => s + Number(e.amount_usd), 0),
      pending: list.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount_usd), 0),
      byCat: [...byCat.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [list, monthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = search.trim().toLowerCase();
  const visible = list.filter(e => (!filterCat || (e.category_id ?? '') === filterCat) && (!q || e.description.toLowerCase().includes(q)));
  const months = useMemo(() => {
    const m = new Map<string, ExpenseRow[]>();
    visible.forEach(e => { const k = e.expense_date.slice(0, 7); m.set(k, [...(m.get(k) || []), e]); });
    return [...m.entries()];
  }, [visible]);

  const errorText = (e: unknown) => (missingMigration(e) ? 'Falta aplicar la migración de compras y gastos en la base de datos.' : e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

  const submit = async () => {
    if (!form) return;
    const usd = Number(form.amount_usd.replace(',', '.')) || 0;
    if (!form.description.trim() || usd <= 0) return;
    try {
      const { sanitizeText } = await import('@/lib/validations');
      await saveExpense.mutateAsync({
        ...(form.id ? { id: form.id } : {}),
        category_id: form.category_id || null,
        description: sanitizeText(form.description.trim()).slice(0, 200),
        amount_usd: Math.round(usd * 100) / 100,
        amount_bs: Number(form.amount_bs.replace(',', '.')) || (rate > 0 ? Math.round(usd * rate * 100) / 100 : null),
        payment_method: form.status === 'paid' ? form.payment_method : null,
        expense_date: form.expense_date,
        status: form.status,
        due_date: form.status === 'pending' && form.due_date ? form.due_date : null,
        provider_id: null,
      });
      toast.success(form.id ? 'Gasto actualizado' : form.status === 'pending' ? 'Gasto por pagar registrado' : 'Gasto registrado');
      setForm(null);
    } catch (e) {
      toast.error('No se pudo guardar el gasto', { description: errorText(e) });
    }
  };

  const setUsd = (v: string) => setForm(f => f && ({ ...f, amount_usd: v, amount_bs: rate > 0 && v ? (Number(v.replace(',', '.')) * rate).toFixed(2) : '' }));
  const setBs = (v: string) => setForm(f => f && ({ ...f, amount_bs: v, amount_usd: rate > 0 && v ? (Number(v.replace(',', '.')) / rate).toFixed(2) : f.amount_usd }));

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    try {
      await saveCategory.mutateAsync({ name: name.slice(0, 60) });
      setNewCat('');
    } catch (e) {
      toast.error('No se pudo crear la categoría', { description: /duplicate|unique/i.test(String((e as { message?: string })?.message)) ? 'Ya existe una con ese nombre.' : errorText(e) });
    }
  };

  const pill = (active: boolean) => cn('h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50');

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-header">Gastos</h1>
            <p className="page-subtitle">Lo que cuesta mantener la tienda, por categoría</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button className="h-11 rounded-full" disabled={!migrated} onClick={() => setForm({ ...EMPTY, category_id: cats[0]?.id ?? '', expense_date: localDateISO() })}><Plus className="h-4 w-4" />Registrar gasto</Button>
            <Button variant="outline" className="h-11 rounded-full" disabled={!migrated} onClick={() => setCatsOpen(true)}><Category className="h-4 w-4" />Categorías</Button>
          </div>
        </div>

        {!migrated && (
          <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            Para usar Gastos hay que aplicar la migración <code className="text-xs">20261016020000_purchases_expenses_payables.sql</code> en la base de datos.
          </p>
        )}

        <section className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-4 md:gap-4 md:p-5">
          {([['Este mes', stats.month], [`En ${now.getFullYear()}`, stats.year], ['Por pagar', stats.pending]] as const).map(([label, value], i) => (
            <div key={label} className={cn(i > 0 && 'border-l border-border pl-2 md:pl-4')}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
              <p className={cn('font-serif text-xl font-semibold tabular-nums md:text-3xl', i === 0 && 'text-primary', i === 2 && value > 0 && 'text-sale')}>{money(value)}</p>
            </div>
          ))}
        </section>

        {stats.byCat.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-sm font-semibold">Este mes por categoría</p>
            <ul className="space-y-2">
              {stats.byCat.map(([id, amount]) => (
                <li key={id}>
                  <button type="button" onClick={() => setFilterCat(filterCat === id ? null : id)} className="w-full text-left" aria-pressed={filterCat === id}>
                    <div className="flex justify-between text-sm"><span className={cn(filterCat === id && 'font-semibold text-primary')}>{catName(id || null)}</span><span className="tabular-nums">{money(amount)}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (amount / (stats.byCat[0][1] || 1)) * 100)}%` }} /></div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={search} onChange={e => setSearch(e.target.value.slice(0, 60))} placeholder="Buscar gasto" className="h-12 rounded-full pl-12" aria-label="Buscar gasto" />
        </div>
        {filterCat !== null && (
          <button type="button" onClick={() => setFilterCat(null)} className="text-sm font-medium text-primary hover:underline">Ver todas las categorías</button>
        )}

        {expenses.isLoading ? (
          <div className="flex justify-center py-12"><Loader className="h-6 w-6 animate-spin text-primary" /></div>
        ) : months.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-studio"><Wallet className="h-7 w-7 text-muted-foreground" /></span>
            <p className="font-medium">{list.length === 0 ? 'Aún no hay gastos' : 'Nada coincide'}</p>
            <p className="max-w-sm text-sm text-muted-foreground">Registra alquiler, servicios, publicidad o envíos para saber cuánto te cuesta la tienda cada mes.</p>
          </div>
        ) : months.map(([key, items]) => (
          <section key={key}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="font-serif text-lg">{monthLabel(key)}</h2>
              <span className="text-sm font-semibold tabular-nums">{money(items.reduce((s, e) => s + Number(e.amount_usd), 0))}</span>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {items.map(e => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.description}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(`${e.expense_date}T12:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })} · {catName(e.category_id)}
                      {e.status === 'paid' ? ` · ${purchaseMethodName(e.payment_method)}` : ''}
                    </p>
                    {e.status === 'pending' && <p className="text-xs font-semibold text-sale">Por pagar{e.due_date ? ` · vence ${new Date(`${e.due_date}T12:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}` : ''}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{money(Number(e.amount_usd))}</p>
                    {e.amount_bs ? <p className="text-[11px] text-muted-foreground">{formatBS(Number(e.amount_bs))}</p> : null}
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full text-muted-foreground" aria-label={`Editar ${e.description}`}
                    onClick={() => setForm({ id: e.id, category_id: e.category_id ?? '', description: e.description, amount_usd: String(e.amount_usd), amount_bs: e.amount_bs ? String(e.amount_bs) : '', payment_method: e.payment_method ?? 'efectivo_usd', expense_date: e.expense_date, status: e.status, due_date: e.due_date ?? '' })}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-destructive" aria-label={`Eliminar ${e.description}`}
                    onClick={async () => {
                      if (!(await confirm({ title: '¿Eliminar este gasto?', description: `${e.description} · ${money(Number(e.amount_usd))}. No se puede deshacer.`, confirmText: 'Eliminar', destructive: true }))) return;
                      deleteExpense.mutate(e.id, { onError: err => toast.error('No se pudo eliminar', { description: errorText(err) }) });
                    }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Registrar / editar gasto */}
      <Dialog open={!!form} onOpenChange={o => { if (!o) setForm(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          {form && (
            <>
              <DialogHeader>
                <DialogTitle>{form.id ? 'Editar gasto' : 'Registrar gasto'}</DialogTitle>
                <DialogDescription>Si aún no lo pagas, márcalo «Por pagar» y aparecerá en Cuentas por pagar.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ex-cat">Categoría</Label>
                  <select id="ex-cat" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                    <option value="">Sin categoría</option>
                    {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ex-desc">Descripción</Label>
                  <Input id="ex-desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value.slice(0, 200) })} placeholder="Ej: alquiler de octubre, publicidad en Instagram" className="h-11 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ex-usd">Monto en $</Label>
                    <Input id="ex-usd" inputMode="decimal" value={form.amount_usd} onChange={e => setUsd(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10))} placeholder="0.00" className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ex-bs">o en Bs</Label>
                    <Input id="ex-bs" inputMode="decimal" value={form.amount_bs} onChange={e => setBs(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 14))} placeholder="0.00" className="h-11 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ex-date">Fecha</Label>
                  <Input id="ex-date" type="date" value={form.expense_date} max={localDateISO()} onChange={e => e.target.value && setForm({ ...form, expense_date: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Estado</p>
                  <div className="flex gap-2">
                    <button type="button" className={pill(form.status === 'paid')} onClick={() => setForm({ ...form, status: 'paid' })}>Pagado</button>
                    <button type="button" className={pill(form.status === 'pending')} onClick={() => setForm({ ...form, status: 'pending' })}>Por pagar</button>
                  </div>
                </div>
                {form.status === 'paid' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="ex-method">Método de pago</Label>
                    <select id="ex-method" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                      {PURCHASE_METHODS.map(m => <option key={m} value={m}>{purchaseMethodName(m)}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="ex-due">Vence (opcional)</Label>
                    <Input id="ex-due" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="h-11 rounded-xl" />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" className="h-11 rounded-full" onClick={() => setForm(null)}>Cancelar</Button>
                <Button className="h-11 gap-2 rounded-full" disabled={!form.description.trim() || !(Number(form.amount_usd.replace(',', '.')) > 0) || saveExpense.isPending} onClick={() => void submit()}>
                  {saveExpense.isPending && <Loader className="h-4 w-4 animate-spin" />}Guardar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Categorías de gastos */}
      <Dialog open={catsOpen} onOpenChange={setCatsOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Categorías de gastos</DialogTitle>
            <DialogDescription>Crea, renombra o borra categorías. Los gastos de una categoría borrada quedan «Sin categoría».</DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {cats.map(c => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                {editCat?.id === c.id ? (
                  <Input autoFocus value={editCat.name} onChange={e => setEditCat({ ...editCat, name: e.target.value.slice(0, 60) })} aria-label="Nombre de la categoría"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') setEditCat(null);
                      if (e.key === 'Enter' && editCat.name.trim()) { await saveCategory.mutateAsync({ id: c.id, name: editCat.name.trim() }).catch(err => toast.error('No se pudo renombrar', { description: errorText(err) })); setEditCat(null); }
                    }}
                    className="h-10 flex-1 rounded-xl" />
                ) : (
                  <span className="flex-1 text-sm">{c.name}</span>
                )}
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label={`Renombrar ${c.name}`}
                  onClick={async () => {
                    if (editCat?.id === c.id) {
                      if (editCat.name.trim()) await saveCategory.mutateAsync({ id: c.id, name: editCat.name.trim() }).catch(err => toast.error('No se pudo renombrar', { description: errorText(err) }));
                      setEditCat(null);
                    } else setEditCat({ id: c.id, name: c.name });
                  }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:text-destructive" aria-label={`Borrar ${c.name}`}
                  onClick={async () => {
                    if (!(await confirm({ title: `¿Borrar «${c.name}»?`, description: 'Sus gastos quedan sin categoría.', confirmText: 'Borrar', destructive: true }))) return;
                    deleteCategory.mutate(c.id, { onError: err => toast.error('No se pudo borrar', { description: errorText(err) }) });
                  }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input value={newCat} onChange={e => setNewCat(e.target.value.slice(0, 60))} onKeyDown={e => { if (e.key === 'Enter') void addCategory(); }} placeholder="Nueva categoría" aria-label="Nueva categoría" className="h-11 flex-1 rounded-xl" />
            <Button className="h-11 rounded-full" disabled={!newCat.trim() || saveCategory.isPending} onClick={() => void addCategory()}><Plus className="h-4 w-4" />Agregar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
