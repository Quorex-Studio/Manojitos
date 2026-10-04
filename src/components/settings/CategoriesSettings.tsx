import { useMemo, useState } from 'react';
import { ArrowDown2, ArrowUp2, Category, Edit, Plus, Trash2, X } from 'reicon-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductCategories } from '@/hooks/useProductCategories';
import { useProducts } from '@/hooks/useProducts';
import { cn } from '@/lib/utils';
import { DETAIL_KINDS, DETAIL_KIND_ORDER, cleanOptions, type DetailKind, type ProductCategory } from '@/lib/productCategories';

type Draft = { id?: string; name: string; detail_kind: DetailKind; options: string[] };

/**
 * Configuración → Categorías. Aquí se definen las categorías del inventario y qué detalle pide
 * cada una al cargar un producto (contenido en ml, medidas, tallas o tonos).
 */
export function CategoriesSettings() {
  const { categories, isLoading, saveCategory, deleteCategory, moveCategory } = useProductCategories();
  const { products } = useProducts();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [optionInput, setOptionInput] = useState('');
  const [deleting, setDeleting] = useState<ProductCategory | null>(null);
  const [moveTo, setMoveTo] = useState('');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach(p => p.category && m.set(p.category, (m.get(p.category) || 0) + 1));
    return m;
  }, [products]);

  const openNew = () => { setDraft({ name: '', detail_kind: 'ninguno', options: [] }); setOptionInput(''); };
  const openEdit = (c: ProductCategory) => { setDraft({ id: c.id, name: c.name, detail_kind: c.detail_kind, options: [...c.options] }); setOptionInput(''); };

  const setKind = (kind: DetailKind) => setDraft(d => d && ({
    ...d,
    detail_kind: kind,
    // Al cambiar de tipo se proponen las opciones habituales (tallas XS–XL, unidades ml y g)
    options: kind === d.detail_kind ? d.options : [...(DETAIL_KINDS[kind].defaults || [])],
  }));
  const addOptions = () => {
    if (!draft || !optionInput.trim()) return;
    setDraft({ ...draft, options: cleanOptions([...draft.options, ...optionInput.split(',')]) });
    setOptionInput('');
  };

  const nameTaken = !!draft && categories.some(c => c.id !== draft.id && c.name.toLowerCase() === draft.name.trim().toLowerCase());
  const needsOptions = draft?.detail_kind === 'tallas' || draft?.detail_kind === 'contenido';
  const canSave = !!draft && draft.name.trim().length > 0 && !nameTaken && (!needsOptions || draft.options.length > 0);
  const editingCount = draft?.id ? counts.get(categories.find(c => c.id === draft.id)?.name || '') || 0 : 0;

  const save = () => {
    if (!draft || !canSave) return;
    saveCategory.mutate(draft, { onSuccess: () => setDraft(null) });
  };

  const deletingCount = deleting ? counts.get(deleting.name) || 0 : 0;
  const confirmDelete = () => {
    if (!deleting || (deletingCount > 0 && !moveTo)) return;
    deleteCategory.mutate({ category: deleting, moveTo: deletingCount > 0 ? moveTo : null }, { onSuccess: () => { setDeleting(null); setMoveTo(''); } });
  };

  const meta = draft ? DETAIL_KINDS[draft.detail_kind] : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Category className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="font-serif text-xl">Categorías del inventario</h2>
            <p className="text-sm text-muted-foreground">Cada categoría decide qué se pide al cargar un producto. El orden es el de la tienda.</p>
          </div>
        </div>
        <Button onClick={openNew} className="h-11 rounded-full"><Plus className="mr-1.5 h-4 w-4" />Nueva categoría</Button>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : categories.length === 0 ? (
        <p className="rounded-2xl bg-studio p-6 text-center text-sm text-muted-foreground">Aún no hay categorías. Crea la primera para poder cargar productos.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {categories.map((c, i) => {
            const n = counts.get(c.name) || 0;
            return (
              <li key={c.id} className="flex items-center gap-2 p-3 sm:gap-3">
                <div className="flex flex-col">
                  <button type="button" aria-label={`Subir ${c.name}`} disabled={i === 0 || moveCategory.isPending}
                    onClick={() => moveCategory.mutate({ id: c.id, direction: -1 })}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-30">
                    <ArrowUp2 className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label={`Bajar ${c.name}`} disabled={i === categories.length - 1 || moveCategory.isPending}
                    onClick={() => moveCategory.mutate({ id: c.id, direction: 1 })}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-30">
                    <ArrowDown2 className="h-4 w-4" />
                  </button>
                </div>
                <button type="button" onClick={() => openEdit(c)} className="min-w-0 flex-1 text-left">
                  <p className="font-medium">{c.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {DETAIL_KINDS[c.detail_kind].label}
                    {c.options.length > 0 && ` · ${c.options.join(', ')}`}
                    {` · ${n} ${n === 1 ? 'producto' : 'productos'}`}
                  </p>
                </button>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label={`Editar ${c.name}`} onClick={() => openEdit(c)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full text-muted-foreground hover:text-destructive" aria-label={`Eliminar ${c.name}`}
                  onClick={() => { setDeleting(c); setMoveTo(''); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Crear / editar */}
      <Dialog open={!!draft} onOpenChange={o => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          {draft && meta && (
            <>
              <DialogHeader>
                <DialogTitle>{draft.id ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
                <DialogDescription>
                  {draft.id && editingCount > 0
                    ? `Tiene ${editingCount} ${editingCount === 1 ? 'producto' : 'productos'}. Si cambias el nombre, se mueven con ella.`
                    : 'Define el nombre y qué detalle se pide en cada producto.'}
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); save(); }}>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-name">Nombre</Label>
                  <Input id="cat-name" autoFocus value={draft.name} placeholder="Ej: Vestidos"
                    onChange={e => setDraft({ ...draft, name: e.target.value.slice(0, 50) })} className="h-11 rounded-xl" />
                  {nameTaken && <p className="text-xs text-destructive">Ya existe una categoría con ese nombre.</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>¿Qué se pide en cada producto?</Label>
                  <div className="grid gap-2" role="radiogroup" aria-label="Detalle del producto">
                    {DETAIL_KIND_ORDER.map(k => (
                      <button key={k} type="button" role="radio" aria-checked={draft.detail_kind === k} onClick={() => setKind(k)}
                        className={cn('rounded-2xl border p-3 text-left transition-colors',
                          draft.detail_kind === k ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                        <p className="text-sm font-semibold">{DETAIL_KINDS[k].label}</p>
                        <p className="text-xs text-muted-foreground">{DETAIL_KINDS[k].help}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {meta.optionsLabel && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-opt">{meta.optionsLabel}</Label>
                    {draft.options.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {draft.options.map(o => (
                          <span key={o} className="inline-flex h-9 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 pl-3 pr-1 text-sm">
                            {o}
                            <button type="button" aria-label={`Quitar ${o}`} onClick={() => setDraft({ ...draft, options: draft.options.filter(x => x !== o) })}
                              className="grid h-7 w-7 place-items-center rounded-full hover:bg-primary/15">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input id="cat-opt" value={optionInput} className="h-11 flex-1 rounded-xl"
                        placeholder={draft.detail_kind === 'tallas' ? 'Ej: XXL, 36, 38' : draft.detail_kind === 'contenido' ? 'Ej: oz' : 'Ej: Nude, Rosa'}
                        onChange={e => setOptionInput(e.target.value.slice(0, 120))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOptions(); } }} />
                      <Button type="button" variant="outline" className="h-11 rounded-full" onClick={addOptions} disabled={!optionInput.trim()}>Agregar</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{meta.optionsHelp} Puedes escribir varias separadas por coma.</p>
                    {needsOptions && draft.options.length === 0 && <p className="text-xs text-destructive">Agrega al menos una.</p>}
                  </div>
                )}

                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => setDraft(null)}>Cancelar</Button>
                  <Button type="submit" className="rounded-full" disabled={!canSave || saveCategory.isPending}>
                    {saveCategory.isPending ? 'Guardando…' : draft.id ? 'Guardar cambios' : 'Crear categoría'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Eliminar (moviendo antes sus productos) */}
      <Dialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          {deleting && (
            <>
              <DialogHeader>
                <DialogTitle>Eliminar {deleting.name}</DialogTitle>
                <DialogDescription>
                  {deletingCount > 0
                    ? `Tiene ${deletingCount} ${deletingCount === 1 ? 'producto' : 'productos'}. Elige a qué categoría pasan antes de eliminarla.`
                    : 'No tiene productos. Se puede eliminar sin afectar nada.'}
                </DialogDescription>
              </DialogHeader>
              {deletingCount > 0 && (
                <Select value={moveTo || undefined} onValueChange={setMoveTo}>
                  <SelectTrigger className="h-11 rounded-xl" aria-label="Mover productos a"><SelectValue placeholder="Mover sus productos a…" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.id !== deleting.id).map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setDeleting(null)}>Cancelar</Button>
                <Button variant="destructive" className="rounded-full" onClick={confirmDelete}
                  disabled={(deletingCount > 0 && !moveTo) || deleteCategory.isPending}>
                  {deletingCount > 0 ? 'Mover y eliminar' : 'Eliminar'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
