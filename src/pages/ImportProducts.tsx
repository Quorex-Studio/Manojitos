import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Upload, CheckCircle, AlertTriangle, Download, Refresh, Loader, ArrowRight, ArrowLeft, XCircle, InfoCircle } from 'reicon-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { sanitizeText } from '@/lib/validations';
import { cn } from '@/lib/utils';
import {
  IMPORT_FIELDS,
  ImportField,
  ImportRow,
  SheetData,
  autoMapColumns,
  buildRows,
  detectHeaderRow,
  pickBestSheet,
  productKey,
  readWorkbook,
} from '@/lib/productImport';

type Step = 'upload' | 'columns' | 'review' | 'done';
type ExistingMode = 'update' | 'add_stock' | 'skip';
type RowFilter = 'all' | 'new' | 'existing' | 'errors';

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Subir' },
  { key: 'columns', label: 'Columnas' },
  { key: 'review', label: 'Revisar' },
  { key: 'done', label: 'Listo' },
];

const ACCEPT = '.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.json';
const SOURCES = ['Treinta', 'Excel', 'Google Sheets', 'CSV', 'Tienda online'];
const NONE = '__none__';

interface Result {
  created: number;
  updated: number;
  skipped: number;
  failed: { row: number; name: string; error: string }[];
}

// Importar productos: acepta lo que exporte cada app (Treinta, Excel, Sheets, CSV, JSON),
// detecta columnas y encabezado solos, y deja corregir todo antes de guardar.
export default function ImportProducts() {
  const { user } = useAuth();
  const { products } = useProducts();
  const { rate } = useExchangeRate();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>>>({});
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [existingMode, setExistingMode] = useState<ExistingMode>('update');
  const [filter, setFilter] = useState<RowFilter>('all');
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const sheet = sheets[sheetIndex];
  const headers = useMemo(() => (sheet?.rows[headerRow] || []).map((h, i) => String(h || '').trim() || `Columna ${i + 1}`), [sheet, headerRow]);

  const existingByKey = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>();
    products.forEach(p => map.set(productKey(p.name), p));
    return map;
  }, [products]);

  const rows: (ImportRow & { existingId?: string })[] = useMemo(() => {
    if (!sheet || mapping.name === undefined || mapping.price === undefined) return [];
    const factor = currency === 'VES' ? rate : 1;
    return buildRows(sheet.rows, headerRow, mapping, { priceFactor: factor }).map(r => ({
      ...r,
      existingId: existingByKey.get(productKey(r.name))?.id,
    }));
  }, [sheet, headerRow, mapping, currency, rate, existingByKey]);

  const stats = useMemo(() => {
    const valid = rows.filter(r => r.errors.length === 0);
    return {
      total: rows.length,
      errors: rows.length - valid.length,
      newOnes: valid.filter(r => !r.existingId).length,
      existing: valid.filter(r => r.existingId).length,
    };
  }, [rows]);

  const visibleRows = useMemo(() => rows.filter(r =>
    filter === 'all' ? true :
    filter === 'errors' ? r.errors.length > 0 :
    filter === 'new' ? r.errors.length === 0 && !r.existingId :
    r.errors.length === 0 && !!r.existingId
  ), [rows, filter]);

  // --- Paso 1: leer archivo ---
  const handleFile = useCallback(async (file: File) => {
    setIsReading(true);
    try {
      const data = await readWorkbook(file);
      if (!data.length) {
        toast.error('El archivo no tiene datos', { description: 'Revisa que la hoja tenga productos.' });
        return;
      }
      const best = pickBestSheet(data);
      const header = detectHeaderRow(data[best].rows);
      const auto = autoMapColumns(data[best].rows[header].map(c => String(c ?? '')));
      setSheets(data);
      setSheetIndex(best);
      setHeaderRow(header);
      setMapping(auto);
      setFileName(file.name);
      setStep('columns');
      if (auto.name !== undefined && auto.price !== undefined) {
        toast.success('Columnas detectadas', { description: 'Revísalas y continúa.' });
      } else {
        toast.info('Indica qué columna es cada dato', { description: 'No pudimos detectar todas las columnas solas.' });
      }
    } catch (error) {
      console.error('Error leyendo archivo:', error);
      toast.error('No pudimos leer el archivo', { description: 'Prueba exportándolo como Excel (.xlsx) o CSV.' });
    } finally {
      setIsReading(false);
    }
  }, []);

  const changeSheet = (index: number) => {
    const header = detectHeaderRow(sheets[index].rows);
    setSheetIndex(index);
    setHeaderRow(header);
    setMapping(autoMapColumns(sheets[index].rows[header].map(c => String(c ?? ''))));
  };

  const changeHeaderRow = (index: number) => {
    setHeaderRow(index);
    setMapping(autoMapColumns((sheet?.rows[index] || []).map(c => String(c ?? ''))));
  };

  const sampleValues = (col?: number) =>
    col === undefined || !sheet
      ? ''
      : sheet.rows.slice(headerRow + 1, headerRow + 4).map(r => String(r[col] ?? '').trim()).filter(Boolean).join(' · ');

  // --- Paso 3: importar ---
  const handleImport = async () => {
    if (!user) return;
    const valid = rows.filter(r => r.errors.length === 0);
    const toCreate = valid.filter(r => !r.existingId);
    const toUpdate = existingMode === 'skip' ? [] : valid.filter(r => r.existingId);
    const res: Result = { created: 0, updated: 0, skipped: existingMode === 'skip' ? valid.filter(r => r.existingId).length : 0, failed: [] };
    const total = toCreate.length + toUpdate.length;
    if (!total) {
      toast.error('No hay productos para importar');
      return;
    }

    setIsImporting(true);
    setProgress(0);
    let done = 0;
    const tick = (n: number) => { done += n; setProgress(Math.round((done / total) * 100)); };

    const toRecord = (r: ImportRow) => ({
      name: sanitizeText(r.name),
      price_usd: r.price ?? 0,
      stock: r.stock,
      category: r.category ? sanitizeText(r.category) : null,
      description: r.description ? sanitizeText(r.description) : null,
      cost_usd: r.cost,
      image_url: r.image || null,
      minimum_stock: r.minStock,
    });

    try {
      // Nuevos: en lotes de 50; si un lote falla se reintenta fila por fila para ubicar el error
      for (let i = 0; i < toCreate.length; i += 50) {
        const batch = toCreate.slice(i, i + 50);
        const { data, error } = await supabase.from('products').insert(batch.map(r => ({ ...toRecord(r), user_id: user.id }))).select('id');
        if (!error) {
          res.created += data?.length ?? batch.length;
        } else {
          for (const r of batch) {
            const { error: e } = await supabase.from('products').insert({ ...toRecord(r), user_id: user.id });
            if (e) res.failed.push({ row: r.rowNumber, name: r.name, error: e.message });
            else res.created++;
          }
        }
        tick(batch.length);
      }

      // Existentes: se actualizan uno a uno (precio, stock y los datos que traiga el archivo)
      for (const r of toUpdate) {
        const current = products.find(p => p.id === r.existingId);
        const rec = toRecord(r);
        const update: TablesUpdate<'products'> = {
          price_usd: rec.price_usd,
          stock: existingMode === 'add_stock' ? (current?.stock ?? 0) + r.stock : r.stock,
        };
        if (rec.category) update.category = rec.category;
        if (rec.description) update.description = rec.description;
        if (rec.cost_usd !== null) update.cost_usd = rec.cost_usd;
        if (rec.image_url) update.image_url = rec.image_url;
        if (rec.minimum_stock !== null) update.minimum_stock = rec.minimum_stock;
        const { error } = await supabase.from('products').update(update).eq('id', r.existingId!);
        if (error) res.failed.push({ row: r.rowNumber, name: r.name, error: error.message });
        else res.updated++;
        tick(1);
      }
    } catch (error) {
      console.error('Error importando:', error);
      toast.error('Se cortó la importación', { description: 'Revisa tu conexión: lo ya guardado no se pierde.' });
    } finally {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['public-products'] });
      setResult(res);
      setIsImporting(false);
      setStep('done');
    }
    if (res.failed.length) toast.warning(`Importación con ${res.failed.length} error(es)`);
    else toast.success('Productos importados');
  };

  const downloadErrors = () => {
    const errorRows = [
      ...rows.filter(r => r.errors.length).map(r => ({ Fila: r.rowNumber, Producto: r.name, Problema: r.errors.join('; ') })),
      ...(result?.failed || []).map(f => ({ Fila: f.row, Producto: f.name, Problema: f.error })),
    ];
    const ws = XLSX.utils.json_to_sheet(errorRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errores');
    XLSX.writeFile(wb, 'productos-con-errores.xlsx');
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nombre del producto', 'Precio de venta', 'Stock actual', 'Categoría', 'Descripción', 'Precio de costo', 'Código', 'Imagen'],
      ['Vestido midi satinado', 25, 10, 'Ropa', 'Tallas S, M y L', 12, 'VES-001', ''],
      ['Perfume Scandal 80ml', 45, 5, 'Perfumería', '', 25, 'PER-002', ''],
    ]);
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 10 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'plantilla-productos.xlsx');
  };

  const reset = () => {
    setStep('upload');
    setSheets([]);
    setMapping({});
    setResult(null);
    setFileName('');
    setFilter('all');
    setProgress(0);
  };

  const stepIndex = STEPS.findIndex(s => s.key === step);
  const canContinue = mapping.name !== undefined && mapping.price !== undefined && rows.length > 0;
  const importCount = stats.newOnes + (existingMode === 'skip' ? 0 : stats.existing);
  const fade = reduceMotion ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.2 } };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-header">Importar productos</h1>
            <p className="page-subtitle">Sube el archivo que exportaste de Treinta, Excel u otra app. Nosotros entendemos las columnas.</p>
          </div>
          <Button variant="outline" className="h-11 gap-2 rounded-full" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Plantilla de ejemplo
          </Button>
        </div>

        {/* Pasos */}
        <ol className="grid grid-cols-4 gap-2" aria-label="Pasos">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                  i < stepIndex && 'border-primary bg-primary text-primary-foreground',
                  i === stepIndex && 'border-primary bg-primary/10 text-primary',
                  i > stepIndex && 'border-border bg-card text-muted-foreground'
                )}
                aria-current={i === stepIndex ? 'step' : undefined}
              >
                {i < stepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn('text-xs font-medium', i === stepIndex ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait">
          {/* ── 1. Subir ── */}
          {step === 'upload' && (
            <motion.section key="upload" {...fade} className="space-y-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                disabled={isReading}
                className={cn(
                  'flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/60 hover:bg-primary/[0.03]'
                )}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {isReading ? <Loader className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
                </span>
                <span className="font-serif text-xl text-foreground">{isReading ? 'Leyendo archivo…' : 'Toca para elegir tu archivo'}</span>
                <span className="text-sm text-muted-foreground">o arrástralo aquí · Excel, CSV, OpenDocument o JSON</span>
                <span className="mt-1 flex flex-wrap justify-center gap-1.5">
                  {SOURCES.map(s => (
                    <span key={s} className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{s}</span>
                  ))}
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><InfoCircle className="h-4 w-4 text-primary" /> Desde Treinta</p>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>Entra a <strong className="text-foreground">Inventario</strong> en Treinta (web o app).</li>
                    <li>Usa <strong className="text-foreground">Descargar / Exportar a Excel</strong>.</li>
                    <li>Sube aquí ese archivo, sin editarlo.</li>
                  </ol>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><InfoCircle className="h-4 w-4 text-primary" /> Cualquier otro archivo</p>
                  <p className="text-sm text-muted-foreground">
                    Solo necesita una columna con el <strong className="text-foreground">nombre</strong> y otra con el <strong className="text-foreground">precio</strong>.
                    Stock, categoría, costo, código e imagen son opcionales. Si un producto ya existe, puedes actualizarlo en vez de duplicarlo.
                  </p>
                </div>
              </div>
            </motion.section>
          )}

          {/* ── 2. Columnas ── */}
          {step === 'columns' && sheet && (
            <motion.section key="columns" {...fade} className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="truncate text-sm font-semibold">{fileName}</p>
                <p className="text-xs text-muted-foreground">{Math.max(sheet.rows.length - headerRow - 1, 0)} filas de datos</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {sheets.length > 1 && (
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium">Hoja</span>
                      <Select value={String(sheetIndex)} onValueChange={(v) => changeSheet(Number(v))}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {sheets.map((s, i) => <SelectItem key={s.name + i} value={String(i)}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </label>
                  )}
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">Los títulos están en la fila</span>
                    <Select value={String(headerRow)} onValueChange={(v) => changeHeaderRow(Number(v))}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sheet.rows.slice(0, 15).map((r, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {i + 1}: {r.map(c => String(c ?? '')).filter(Boolean).slice(0, 3).join(' · ').slice(0, 40) || '(vacía)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">Los precios del archivo están en</span>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as 'USD' | 'VES')}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">Dólares (USD)</SelectItem>
                        <SelectItem value="VES" disabled={!rate}>Bolívares {rate ? `(tasa ${rate.toFixed(2)})` : '(sin tasa)'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">¿Qué columna es cada dato?</p>
                  <p className="text-xs text-muted-foreground">Lo detectamos solo; cámbialo si algo no coincide.</p>
                </div>
                <ul className="divide-y divide-border">
                  {IMPORT_FIELDS.map(field => {
                    const col = mapping[field.key];
                    return (
                      <li key={field.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_1.2fr] sm:items-center">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {field.label} {field.required && <span className="text-sale">*</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{col !== undefined ? `Ej: ${sampleValues(col) || '—'}` : field.hint}</p>
                        </div>
                        <Select
                          value={col === undefined ? NONE : String(col)}
                          onValueChange={(v) => setMapping(prev => {
                            const next = { ...prev };
                            if (v === NONE) delete next[field.key];
                            else next[field.key] = Number(v);
                            return next;
                          })}
                        >
                          <SelectTrigger className={cn('h-11 rounded-xl', field.required && col === undefined && 'border-sale')}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{field.required ? 'Elige una columna…' : 'No importar'}</SelectItem>
                            {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="ghost" className="h-12 gap-2 rounded-full" onClick={reset}><ArrowLeft className="h-4 w-4" /> Otro archivo</Button>
                <Button className="h-12 gap-2 rounded-full px-8" disabled={!canContinue} onClick={() => setStep('review')}>
                  Revisar {rows.length} productos <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.section>
          )}

          {/* ── 3. Revisar ── */}
          {step === 'review' && (
            <motion.section key="review" {...fade} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { key: 'new', label: 'Nuevos', value: stats.newOnes, tone: 'text-success' },
                  { key: 'existing', label: 'Ya existen', value: stats.existing, tone: 'text-primary' },
                  { key: 'errors', label: 'Con errores', value: stats.errors, tone: 'text-sale' },
                  { key: 'all', label: 'Total', value: stats.total, tone: 'text-foreground' },
                ].map(s => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setFilter(s.key as RowFilter)}
                    aria-pressed={filter === s.key}
                    className={cn(
                      'rounded-2xl border bg-card p-4 text-left transition-colors',
                      filter === s.key ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
                    )}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{s.label}</p>
                    <p className={cn('mt-1 font-serif text-3xl tabular-nums', s.tone)}>{s.value}</p>
                  </button>
                ))}
              </div>

              {stats.existing > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="mb-2 text-sm font-semibold">{stats.existing} productos ya están en tu tienda (mismo nombre). ¿Qué hacemos?</p>
                  <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
                    {([
                      { v: 'update', t: 'Actualizar', d: 'Precio y stock del archivo' },
                      { v: 'add_stock', t: 'Sumar stock', d: 'Precio del archivo + unidades nuevas' },
                      { v: 'skip', t: 'Dejarlos igual', d: 'Solo se crean los nuevos' },
                    ] as { v: ExistingMode; t: string; d: string }[]).map(o => (
                      <button
                        key={o.v}
                        type="button"
                        role="radio"
                        aria-checked={existingMode === o.v}
                        onClick={() => setExistingMode(o.v)}
                        className={cn(
                          'rounded-xl border p-3 text-left transition-colors',
                          existingMode === o.v ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                        )}
                      >
                        <p className="text-sm font-semibold">{o.t}</p>
                        <p className="text-xs text-muted-foreground">{o.d}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {visibleRows.slice(0, 200).map(r => (
                  <li key={r.rowNumber} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn('mt-0.5 shrink-0', r.errors.length ? 'text-sale' : r.warnings.length ? 'text-gold' : 'text-success')}>
                      {r.errors.length ? <XCircle className="h-5 w-5" /> : r.warnings.length ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.name || <span className="text-muted-foreground">(sin nombre)</span>}</p>
                      <p className="text-xs text-muted-foreground">
                        Fila {r.rowNumber}{r.category ? ` · ${r.category}` : ''}
                        {r.existingId ? ' · ya existe' : ''}
                      </p>
                      {[...r.errors, ...r.warnings].length > 0 && (
                        <p className={cn('mt-0.5 text-xs', r.errors.length ? 'text-sale' : 'text-gold')}>{[...r.errors, ...r.warnings].join(' · ')}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums">{r.price !== null ? `$${r.price.toFixed(2)}` : '—'}</p>
                      <p className="text-xs text-muted-foreground">{r.stock} uds</p>
                    </div>
                  </li>
                ))}
                {visibleRows.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">Nada en este filtro.</li>}
                {visibleRows.length > 200 && (
                  <li className="px-4 py-3 text-center text-xs text-muted-foreground">Mostrando 200 de {visibleRows.length}. Se importan todos.</li>
                )}
              </ul>

              {isImporting && (
                <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm font-medium">Guardando productos… {progress}%</p>
                  <Progress value={progress} />
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="ghost" className="h-12 gap-2 rounded-full" disabled={isImporting} onClick={() => setStep('columns')}>
                  <ArrowLeft className="h-4 w-4" /> Columnas
                </Button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  {stats.errors > 0 && (
                    <Button variant="outline" className="h-12 gap-2 rounded-full" onClick={downloadErrors}>
                      <Download className="h-4 w-4" /> Descargar filas con error
                    </Button>
                  )}
                  <Button className="h-12 gap-2 rounded-full px-8" disabled={isImporting || importCount === 0} onClick={handleImport}>
                    {isImporting ? <Loader className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Importar {importCount} productos
                  </Button>
                </div>
              </div>
            </motion.section>
          )}

          {/* ── 4. Listo ── */}
          {step === 'done' && result && (
            <motion.section key="done" {...fade} className="space-y-4">
              <div className="flex flex-col items-center rounded-3xl border border-border bg-card px-6 py-10 text-center">
                <span className={cn('mb-3 flex h-16 w-16 items-center justify-center rounded-full', result.failed.length ? 'bg-gold/10 text-gold' : 'bg-success/10 text-success')}>
                  {result.failed.length ? <AlertTriangle className="h-8 w-8" /> : <CheckCircle className="h-8 w-8" />}
                </span>
                <p className="font-serif text-2xl">{result.failed.length ? 'Importación con detalles' : '¡Listo!'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.created} creados · {result.updated} actualizados
                  {result.skipped ? ` · ${result.skipped} sin cambios` : ''}
                  {result.failed.length ? ` · ${result.failed.length} con error` : ''}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                {(result.failed.length > 0 || stats.errors > 0) && (
                  <Button variant="outline" className="h-12 gap-2 rounded-full" onClick={downloadErrors}>
                    <Download className="h-4 w-4" /> Descargar errores
                  </Button>
                )}
                <Button variant="outline" className="h-12 gap-2 rounded-full" onClick={reset}>
                  <Refresh className="h-4 w-4" /> Importar otro archivo
                </Button>
                <Button asChild className="h-12 gap-2 rounded-full px-8">
                  <Link to="/products">Ver productos <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
