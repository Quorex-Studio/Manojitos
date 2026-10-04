import { useState } from 'react';
import { X, Plus } from 'reicon-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DETAIL_KINDS, joinContent, splitContent, type ProductCategory } from '@/lib/productCategories';

/** Fila del formulario: una talla, tono o presentación con sus unidades y precio opcional */
export interface VariantRow {
  key: string;
  id?: string;
  label: string;
  stock: string;
  /** Vacío = mismo precio del producto */
  price: string;
}

export const newVariantRow = (label = ''): VariantRow => ({ key: crypto.randomUUID(), label, stock: '', price: '' });

interface Props {
  category: ProductCategory | null;
  presentation: string;
  variants: VariantRow[];
  productPrice: string;
  onChange: (next: { presentation?: string; variants?: VariantRow[] }) => void;
}

const chip = (active: boolean) => cn(
  'h-10 min-w-[2.75rem] rounded-full border px-3 text-sm font-medium transition-colors',
  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/50'
);
const digits = (v: string, max = 6) => v.replace(/[^0-9]/g, '').slice(0, max);
const decimal = (v: string) => v.replace(/[^0-9.,]/g, '').replace(',', '.').slice(0, 9);

/**
 * Detalle del producto según su categoría. Tallas, tonos y presentaciones (30 ml, 50 ml…) se
 * cargan como variantes: cada una con sus unidades y, si cuesta distinto, su precio.
 * El stock del producto es la suma de sus variantes.
 */
export function CategoryDetailFields({ category, presentation, variants, productPrice, onChange }: Props) {
  const [toneDraft, setToneDraft] = useState('');
  if (!category || category.detail_kind === 'ninguno') return null;
  const kind = category.detail_kind;

  if (kind === 'medidas') {
    return (
      <div className="space-y-2">
        <Label htmlFor="p-size">Medidas</Label>
        <Input
          id="p-size" placeholder="Ej: 20 × 15 × 8 cm" value={presentation}
          onChange={e => onChange({ presentation: e.target.value.slice(0, 60) })}
          className="h-11 rounded-xl"
        />
        <p className="text-xs text-muted-foreground">Se muestra en la tienda debajo del nombre.</p>
      </div>
    );
  }

  const update = (key: string, patch: Partial<VariantRow>) => onChange({ variants: variants.map(v => (v.key === key ? { ...v, ...patch } : v)) });
  const remove = (key: string) => onChange({ variants: variants.filter(v => v.key !== key) });
  const total = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  const priceHint = Number(productPrice) > 0 ? `$${Number(productPrice).toFixed(2)}` : 'Igual';

  // Unidades y precio de una fila (común a los tres tipos)
  const numbers = (v: VariantRow) => (
    <>
      <Input
        aria-label={`Unidades de ${v.label || 'esta opción'}`} inputMode="numeric" placeholder="0" value={v.stock}
        onChange={e => update(v.key, { stock: digits(e.target.value) })}
        className="h-11 w-[4.5rem] shrink-0 rounded-xl text-center tabular-nums"
      />
      <Input
        aria-label={`Precio de ${v.label || 'esta opción'} (opcional)`} inputMode="decimal" placeholder={priceHint} value={v.price}
        onChange={e => update(v.key, { price: decimal(e.target.value) })}
        className="h-11 w-[5.5rem] shrink-0 rounded-xl text-center tabular-nums"
      />
    </>
  );
  const header = (first: string) => (
    <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      <span className="flex-1">{first}</span>
      <span className="w-[4.5rem] text-center">Unidades</span>
      <span className="w-[5.5rem] text-center">Precio</span>
      <span className="w-9" />
    </div>
  );
  const removeBtn = (v: VariantRow) => (
    <button type="button" onClick={() => remove(v.key)} aria-label={`Quitar ${v.label || 'fila'}`}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-destructive">
      <X className="h-4 w-4" />
    </button>
  );
  const footer = (
    <p className="text-xs text-muted-foreground">
      {variants.length > 0
        ? <>Stock total: <strong className="text-foreground">{total}</strong> unidades. Deja el precio vacío si cuesta lo mismo que el producto.</>
        : 'Sin opciones, el producto usa el stock general.'}
      {variants.length > 1 && ' La clienta elegirá una al comprar.'}
    </p>
  );

  if (kind === 'contenido') {
    const units = category.options.length ? category.options : ['ml', 'g'];
    return (
      <div className="space-y-2">
        <Label>Presentaciones</Label>
        {variants.length > 0 && header('Contenido')}
        <div className="space-y-2">
          {variants.map(v => {
            const { amount, unit } = splitContent(v.label, units);
            const setLabel = (a: string, u: string) => update(v.key, { label: joinContent(a, u) ?? (a ? `${a} ${u}` : '') });
            return (
              <div key={v.key} className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 gap-1">
                  <Input aria-label="Cantidad" inputMode="decimal" placeholder="30" value={amount}
                    onChange={e => setLabel(decimal(e.target.value), unit)} className="h-11 min-w-0 flex-1 rounded-xl" />
                  <Select value={unit} onValueChange={u => setLabel(amount, u)}>
                    <SelectTrigger className="h-11 w-[4.25rem] shrink-0 rounded-xl px-2" aria-label="Unidad"><SelectValue /></SelectTrigger>
                    <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {numbers(v)}
                {removeBtn(v)}
              </div>
            );
          })}
        </div>
        <Button type="button" variant="outline" className="h-10 rounded-full" onClick={() => onChange({ variants: [...variants, newVariantRow()] })}>
          <Plus className="mr-1 h-4 w-4" />{variants.length ? 'Otra presentación' : 'Agregar presentación'}
        </Button>
        {footer}
      </div>
    );
  }

  if (kind === 'tallas') {
    const allowed = category.options.length ? category.options : DETAIL_KINDS.tallas.defaults || [];
    const selected = new Set(variants.map(v => v.label));
    const toggle = (t: string) => {
      if (selected.has(t)) { onChange({ variants: variants.filter(v => v.label !== t) }); return; }
      // Conserva el orden de la categoría (XS, S, M…)
      const next = [...variants, newVariantRow(t)];
      next.sort((a, b) => allowed.indexOf(a.label) - allowed.indexOf(b.label));
      onChange({ variants: next });
    };
    return (
      <div className="space-y-2">
        <Label>Tallas disponibles</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tallas disponibles">
          {allowed.map(t => (
            <button key={t} type="button" aria-pressed={selected.has(t)} className={chip(selected.has(t))} onClick={() => toggle(t)}>{t}</button>
          ))}
        </div>
        {variants.length > 0 && (
          <div className="space-y-2 pt-1">
            {header('Talla')}
            {variants.map(v => (
              <div key={v.key} className="flex items-center gap-2">
                <span className="flex h-11 min-w-0 flex-1 items-center rounded-xl bg-studio px-3 text-sm font-semibold">{v.label}</span>
                {numbers(v)}
                {removeBtn(v)}
              </div>
            ))}
          </div>
        )}
        {footer}
      </div>
    );
  }

  // tonos
  const addTones = (raw: string) => {
    const existing = new Set(variants.map(v => v.label.toLowerCase()));
    const fresh = raw.split(',').map(t => t.trim().replace(/\s+/g, ' ').slice(0, 40)).filter(t => t && !existing.has(t.toLowerCase()));
    if (fresh.length) onChange({ variants: [...variants, ...fresh.map(t => newVariantRow(t))] });
    setToneDraft('');
  };
  const suggestions = category.options.filter(o => !variants.some(v => v.label.toLowerCase() === o.toLowerCase()));
  return (
    <div className="space-y-2">
      <Label htmlFor="p-tone">Tonos o colores</Label>
      {variants.length > 0 && (
        <div className="space-y-2">
          {header('Tono')}
          {variants.map(v => (
            <div key={v.key} className="flex items-center gap-2">
              <Input aria-label="Nombre del tono" value={v.label} onChange={e => update(v.key, { label: e.target.value.slice(0, 40) })}
                className="h-11 min-w-0 flex-1 rounded-xl" />
              {numbers(v)}
              {removeBtn(v)}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          id="p-tone" placeholder="Ej: Azul marino" value={toneDraft}
          onChange={e => setToneDraft(e.target.value.slice(0, 120))}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTones(toneDraft); } }}
          className="h-11 flex-1 rounded-xl"
        />
        <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => addTones(toneDraft)} disabled={!toneDraft.trim()}>
          <Plus className="mr-1 h-4 w-4" />Agregar
        </Button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map(o => (
            <button key={o} type="button" className="h-9 rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground hover:border-primary/50" onClick={() => addTones(o)}>
              + {o}
            </button>
          ))}
        </div>
      )}
      {footer}
    </div>
  );
}
