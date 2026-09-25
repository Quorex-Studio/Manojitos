import { useState } from 'react';
import { X, Plus } from 'reicon-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DETAIL_KINDS, cleanOptions, joinContent, splitContent, type ProductCategory } from '@/lib/productCategories';

interface Props {
  category: ProductCategory | null;
  presentation: string;
  sizes: string[];
  onChange: (next: { presentation?: string; sizes?: string[] }) => void;
}

const chip = (active: boolean) => cn(
  'h-10 min-w-[2.75rem] rounded-full border px-3 text-sm font-medium transition-colors',
  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/50'
);

/**
 * Detalle del producto que pide su categoría: contenido (30 ml), medidas, tallas o tonos.
 * Si la categoría no pide nada, no se muestra nada.
 */
export function CategoryDetailFields({ category, presentation, sizes, onChange }: Props) {
  const [draft, setDraft] = useState('');
  if (!category || category.detail_kind === 'ninguno') return null;
  const kind = category.detail_kind;
  const meta = DETAIL_KINDS[kind];

  if (kind === 'contenido') {
    const units = category.options.length ? category.options : ['ml', 'g'];
    const { amount, unit } = splitContent(presentation, units);
    const set = (a: string, u: string) => onChange({ presentation: joinContent(a, u) ?? (a ? a : '') });
    return (
      <div className="space-y-2">
        <Label htmlFor="p-content">Contenido neto</Label>
        <div className="flex gap-2">
          <Input
            id="p-content" inputMode="decimal" placeholder="Ej: 30" value={amount}
            onChange={e => set(e.target.value.replace(/[^\d.,]/g, '').slice(0, 8), unit)}
            className="h-11 flex-1 rounded-xl"
          />
          <Select value={unit} onValueChange={u => set(amount, u)}>
            <SelectTrigger className="h-11 w-24 rounded-xl" aria-label="Unidad"><SelectValue /></SelectTrigger>
            <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">Se muestra en la tienda debajo del nombre.</p>
      </div>
    );
  }

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

  const toggle = (v: string) => onChange({ sizes: sizes.includes(v) ? sizes.filter(s => s !== v) : [...sizes, v] });

  if (kind === 'tallas') {
    const allowed = category.options.length ? category.options : meta.defaults || [];
    // Conserva el orden de la categoría (XS, S, M…) aunque se marquen en otro orden
    const ordered = (next: string[]) => allowed.filter(a => next.includes(a)).concat(next.filter(n => !allowed.includes(n)));
    return (
      <div className="space-y-2">
        <Label>Tallas disponibles</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tallas disponibles">
          {allowed.map(t => (
            <button key={t} type="button" aria-pressed={sizes.includes(t)} className={chip(sizes.includes(t))}
              onClick={() => onChange({ sizes: ordered(sizes.includes(t) ? sizes.filter(s => s !== t) : [...sizes, t]) })}>
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {sizes.length > 1 ? 'La clienta elegirá su talla al comprar.' : sizes.length === 1 ? 'Solo esta talla: se agrega directo al carrito.' : 'Marca las tallas que tienes.'}
        </p>
      </div>
    );
  }

  // tonos
  const add = () => {
    const next = cleanOptions([...sizes, ...draft.split(',')]);
    onChange({ sizes: next });
    setDraft('');
  };
  const suggestions = category.options.filter(o => !sizes.includes(o));
  return (
    <div className="space-y-2">
      <Label htmlFor="p-tone">Tonos o colores</Label>
      {sizes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sizes.map(t => (
            <span key={t} className="inline-flex h-9 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 pl-3 pr-1 text-sm">
              {t}
              <button type="button" onClick={() => toggle(t)} aria-label={`Quitar ${t}`} className="grid h-7 w-7 place-items-center rounded-full hover:bg-primary/15">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          id="p-tone" placeholder="Ej: 120 Classic Ivory" value={draft}
          onChange={e => setDraft(e.target.value.slice(0, 60))}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          className="h-11 flex-1 rounded-xl"
        />
        <Button type="button" variant="outline" className="h-11 rounded-full" onClick={add} disabled={!draft.trim()}>
          <Plus className="mr-1 h-4 w-4" />Agregar
        </Button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map(o => (
            <button key={o} type="button" className="h-9 rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground hover:border-primary/50" onClick={() => toggle(o)}>
              + {o}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {sizes.length > 1 ? 'La clienta elegirá el tono al comprar.' : 'Si el producto tiene un solo tono, puedes dejarlo vacío o escribir ese tono.'}
      </p>
    </div>
  );
}
