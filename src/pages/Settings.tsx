import { PhoneInput, DocumentIdInput } from '@/components/ui/ve-inputs';
import { BRAND_NAME } from '@/config/brand';
import { paymentConfigLabel, PAYMENT_CONFIG_LABELS } from '@/lib/paymentMethodFields';
import { useConfirm } from '@/components/ui/confirm-dialog';
import React, { useState, useEffect, useMemo } from 'react';
import { Loader, Refresh, DollarSign, Euro, Calculator, CreditCard, Moon, Sun, Plus, Edit, Trash2, TickCircle, AlertTriangle, Category } from 'reicon-react';
import { useSearchParams } from 'react-router-dom';
import { CategoriesSettings } from '@/components/settings/CategoriesSettings';
import { AppLayout } from '@/components/layout/AppLayout';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useCurrency, DisplayCurrency } from '@/contexts/CurrencyContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePricingConfig } from '@/hooks/usePricingConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatBS, cn } from '@/lib/utils';
import { usePaymentMethods, PaymentMethodRow } from '@/hooks/usePaymentMethods';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Currency = 'USD' | 'EUR';

// Datos que se suelen pedir para cada método (se proponen si el método no trae campos).
const SUGGESTED_FIELDS: Record<string, string[]> = {
  pago_movil: ['bank', 'phone', 'ci', 'name'],
  transferencia: ['bank', 'account', 'ci', 'name'],
  zelle: ['email', 'name'],
  binance: ['pay_id', 'email', 'name'],
  zinli: ['email', 'name'],
  wally: ['phone', 'email', 'name'],
};
const FIELD_CHOICES = ['bank', 'phone', 'ci', 'name', 'account', 'email', 'pay_id', 'wallet', 'network'];

const filledCount = (m: PaymentMethodRow) => Object.values(m.config || {}).filter(v => String(v || '').trim()).length;
const fieldCount = (m: PaymentMethodRow) => Object.keys(m.config || {}).length;

function SectionCard({ title, description, icon, children }: { title: string; description?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
        <div className="min-w-0">
          <h2 className="font-serif text-xl">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function Settings() {
  const confirmDialog = useConfirm();
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  const { theme, setTheme } = useTheme();
  // La pestaña va en la URL: "Administrar categorías" desde Productos abre /settings?tab=categorias
  const [searchParams, setSearchParams] = useSearchParams();
  const TABS = ['pagos', 'categorias', 'tasa', 'precios', 'preferencias'];
  const tab = TABS.includes(searchParams.get('tab') || '') ? searchParams.get('tab')! : 'pagos';
  const setTab = (value: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', value); return n; }, { replace: true });

  // --- Tasa ---
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('USD');
  const { rates, refetch } = useExchangeRate(selectedCurrency);
  const rateInfo = selectedCurrency === 'EUR' ? rates?.EUR : rates?.USD;
  const rate = rateInfo?.rate ?? 0;
  const rateUpdated = rateInfo?.lastUpdate ?? null;
  const [newRate, setNewRate] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);

  // --- Métodos de pago ---
  const { methods, updateMethod, createMethod, deleteMethod } = usePaymentMethods(true);
  const visibleMethods = methods.filter(m => m.method_key !== 'credito');
  const [editing, setEditing] = useState<PaymentMethodRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ label: '', description: '', fields: ['name'] as string[] });
  const missingData = visibleMethods.filter(m => m.enabled && fieldCount(m) > 0 && filledCount(m) < fieldCount(m));

  // --- Precios ---
  const { config: pricingConfig, updateConfig: savePricingConfig } = usePricingConfig();
  const [pricingForm, setPricingForm] = useState({ usd_to_eur_multiplier: '2', rounding_mode: 'ceil' as 'ceil' | 'round' | 'floor', retail_markup_pct: '15', credit_surcharge_pct: '10' });
  const [savingPricing, setSavingPricing] = useState(false);

  useEffect(() => {
    if (pricingConfig) {
      setPricingForm({
        usd_to_eur_multiplier: String(pricingConfig.usd_to_eur_multiplier),
        rounding_mode: pricingConfig.rounding_mode,
        retail_markup_pct: String(pricingConfig.retail_markup_pct),
        credit_surcharge_pct: String(pricingConfig.credit_surcharge_pct),
      });
    }
  }, [pricingConfig]);

  // Ejemplo en vivo: un producto que costó $7,40
  const example = useMemo(() => {
    const cost = 7.4;
    const factor = Number(pricingForm.usd_to_eur_multiplier) || 0;
    const rounded = pricingForm.rounding_mode === 'ceil' ? Math.ceil(cost) : pricingForm.rounding_mode === 'floor' ? Math.floor(cost) : Math.round(cost);
    const price = rounded * factor;
    const credit = Math.round(price * (1 + (Number(pricingForm.credit_surcharge_pct) || 0) / 100) * 100) / 100;
    return { cost, rounded, price, credit };
  }, [pricingForm]);

  const handleSavePricing = async () => {
    setSavingPricing(true);
    try {
      await savePricingConfig({
        usd_to_eur_multiplier: Number(pricingForm.usd_to_eur_multiplier) || 2,
        rounding_mode: pricingForm.rounding_mode,
        retail_markup_pct: Number(pricingForm.retail_markup_pct) || 0,
        credit_surcharge_pct: Number(pricingForm.credit_surcharge_pct) || 0,
      });
    } finally {
      setSavingPricing(false);
    }
  };

  const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRate) return;
    setSavingRate(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-bcv-rate', { body: { rate: Number(newRate), currency: selectedCurrency } });
      if (error) throw error;
      if (!data?.saved) throw new Error('No se pudo guardar la tasa');
      setNewRate('');
      refetch();
      toast({ title: 'Tasa guardada', description: `${selectedCurrency}: ${formatBS(data.rate)}` });
    } catch (err) {
      toast({ title: 'No se pudo guardar', description: errorText(err, 'Intenta de nuevo'), variant: 'destructive' });
    } finally {
      setSavingRate(false);
    }
  };

  const handleFetchRate = async () => {
    setFetchingRate(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-bcv-rate', { body: { currency: selectedCurrency } });
      if (error) throw error;
      if (!data?.saved) throw new Error('El BCV no respondió');
      refetch();
      toast({ title: 'Tasa actualizada', description: `${selectedCurrency}: ${formatBS(data.rate)}` });
    } catch (err) {
      toast({ title: 'No se pudo obtener la tasa', description: errorText(err, 'Escríbela a mano abajo'), variant: 'destructive' });
    } finally {
      setFetchingRate(false);
    }
  };

  // Al editar un método sin campos, se le proponen los habituales
  const openEdit = (m: PaymentMethodRow) => {
    const config = { ...(m.config || {}) };
    if (Object.keys(config).length === 0) (SUGGESTED_FIELDS[m.method_key] || []).forEach(k => { config[k] = ''; });
    setEditing({ ...m, config });
  };

  const saveEdit = () => {
    if (!editing) return;
    updateMethod.mutate({ id: editing.id, label: editing.label.trim(), description: editing.description, config: editing.config });
    setEditing(null);
  };

  const createNew = () => {
    const label = draft.label.trim();
    if (!label) return;
    const key = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (methods.some(m => m.method_key === key)) {
      toast({ title: 'Ese método ya existe', description: 'Búscalo en la lista y edítalo.', variant: 'destructive' });
      return;
    }
    createMethod.mutate({
      method_key: key,
      label,
      description: draft.description.trim() || null,
      enabled: true,
      display_order: methods.length + 1,
      config: Object.fromEntries(draft.fields.map(f => [f, ''])),
    });
    setCreating(false);
    setDraft({ label: '', description: '', fields: ['name'] });
  };

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-5">
        <div>
          <h1 className="page-header">Configuración</h1>
          <p className="page-subtitle">Datos de pago, categorías, tasa, precios y preferencias de {BRAND_NAME}</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="admin-tabs">
            <TabsTrigger value="pagos">
              <CreditCard className="h-4 w-4" />Pagos
              {missingData.length > 0 && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="faltan datos" />}
            </TabsTrigger>
            <TabsTrigger value="categorias"><Category className="h-4 w-4" />Categorías</TabsTrigger>
            <TabsTrigger value="tasa"><DollarSign className="h-4 w-4" />Tasa</TabsTrigger>
            <TabsTrigger value="precios"><Calculator className="h-4 w-4" />Precios</TabsTrigger>
            <TabsTrigger value="preferencias">{theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}Preferencias</TabsTrigger>
          </TabsList>

          {/* ===== PAGOS ===== */}
          <TabsContent value="pagos" className="mt-5 space-y-4">
            {missingData.length > 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-sm">
                  <strong className="font-semibold">Completa tus datos de pago.</strong> A {missingData.map(m => m.label).join(', ')} les faltan datos:
                  sin ellos, tus clientas no sabrán a dónde pagarte al comprar.
                </p>
              </div>
            )}

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visibleMethods.map(m => {
                const total = fieldCount(m);
                const filled = filledCount(m);
                const complete = total === 0 || filled === total;
                return (
                  <li key={m.id} className={cn('flex flex-col rounded-2xl border bg-card p-4 transition-opacity', m.enabled ? 'border-border' : 'border-dashed border-border opacity-60')}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{m.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.enabled ? (m.description || 'Sin descripción') : 'Desactivado · no aparece al pagar'}</p>
                      </div>
                      <Switch
                        checked={m.enabled}
                        onCheckedChange={v => updateMethod.mutate({ id: m.id, enabled: v })}
                        aria-label={`${m.enabled ? 'Desactivar' : 'Activar'} ${m.label}`}
                      />
                    </div>
                    <p className={cn('mt-3 flex items-center gap-1.5 text-xs font-medium', complete ? 'text-success' : 'text-amber-700 dark:text-amber-300')}>
                      {complete ? <TickCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {total === 0 ? 'No necesita datos' : complete ? 'Datos completos' : `Faltan ${total - filled} de ${total} datos`}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" className="h-10 flex-1 rounded-full" onClick={() => openEdit(m)}>
                        <Edit className="h-4 w-4" />{complete ? 'Editar datos' : 'Completar datos'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive"
                        aria-label={`Eliminar ${m.label}`}
                        onClick={async () => {
                          if (await confirmDialog({ title: `¿Eliminar ${m.label}?`, description: 'Dejará de aparecer como opción de pago. Si solo quieres ocultarlo, desactívalo.', confirmText: 'Eliminar', destructive: true })) deleteMethod.mutate(m.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex h-full min-h-[148px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Plus className="h-5 w-5" />Agregar otro método
                </button>
              </li>
            </ul>
          </TabsContent>

          {/* ===== TASA ===== */}
          <TabsContent value="tasa" className="mt-5 space-y-4">
            <SectionCard title="Tasa del día" description="Se usa para mostrar los precios en bolívares." icon={selectedCurrency === 'USD' ? <DollarSign /> : <Euro />}>
              <div className="mb-4 inline-flex rounded-full bg-secondary p-1" role="radiogroup" aria-label="Moneda">
                {(['USD', 'EUR'] as Currency[]).map(c => (
                  <button key={c} type="button" role="radio" aria-checked={selectedCurrency === c} onClick={() => setSelectedCurrency(c)}
                    className={cn('h-9 rounded-full px-4 text-sm font-medium transition-colors', selectedCurrency === c ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                    {c === 'USD' ? 'Dólar' : 'Euro'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-studio p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">BCV · {selectedCurrency}</p>
                  <p className="font-serif text-4xl font-semibold tabular-nums text-primary">{rate > 0 ? formatBS(rate) : 'Sin tasa'}</p>
                  {rateUpdated && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Actualizada {rateUpdated.toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <Button variant="outline" onClick={handleFetchRate} disabled={fetchingRate} className="h-11 rounded-full bg-card">
                  {fetchingRate ? <Loader className="h-4 w-4 animate-spin" /> : <Refresh className="h-4 w-4" />}Actualizar del BCV
                </Button>
              </div>
              <form onSubmit={handleUpdateRate} className="mt-4 space-y-2">
                <Label htmlFor="manual-rate">¿El BCV no responde? Escribe la tasa a mano</Label>
                <div className="flex gap-2">
                  <Input id="manual-rate" inputMode="decimal" value={newRate} onChange={e => setNewRate(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Ej: 854.46" className="h-11 min-w-0 flex-1 rounded-xl" />
                  <Button type="submit" disabled={savingRate || !newRate} className="h-11 rounded-full">
                    {savingRate ? <Loader className="h-4 w-4 animate-spin" /> : 'Guardar'}
                  </Button>
                </div>
              </form>
            </SectionCard>
          </TabsContent>

          {/* ===== PRECIOS ===== */}
          <TabsContent value="precios" className="mt-5 space-y-4">
            <SectionCard title="Cómo se calculan los precios" description="Cuando cargas una compra, el sistema sugiere el precio de venta con estas reglas." icon={<Calculator />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-factor">Multiplicador sobre el costo</Label>
                  <Input id="p-factor" inputMode="decimal" value={pricingForm.usd_to_eur_multiplier} onChange={e => setPricingForm(p => ({ ...p, usd_to_eur_multiplier: e.target.value.replace(/[^0-9.]/g, '') }))} className="h-11 rounded-xl" />
                  <p className="text-xs text-muted-foreground">2 = vendes al doble de lo que te costó.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Redondeo del costo</Label>
                  <Select value={pricingForm.rounding_mode} onValueChange={v => setPricingForm(p => ({ ...p, rounding_mode: v as 'ceil' | 'round' | 'floor' }))}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ceil">Hacia arriba ($7,40 → $8)</SelectItem>
                      <SelectItem value="round">Al más cercano ($7,40 → $7)</SelectItem>
                      <SelectItem value="floor">Hacia abajo ($7,40 → $7)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-credit">Recargo por crédito (%)</Label>
                  <Input id="p-credit" inputMode="numeric" value={pricingForm.credit_surcharge_pct} onChange={e => setPricingForm(p => ({ ...p, credit_surcharge_pct: e.target.value.replace(/[^0-9.]/g, '') }))} className="h-11 rounded-xl" />
                  <p className="text-xs text-muted-foreground">Se suma cuando la venta es financiada.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-retail">Recargo al detal (%)</Label>
                  <Input id="p-retail" inputMode="numeric" value={pricingForm.retail_markup_pct} onChange={e => setPricingForm(p => ({ ...p, retail_markup_pct: e.target.value.replace(/[^0-9.]/g, '') }))} className="h-11 rounded-xl" />
                  <p className="text-xs text-muted-foreground">Para ventas por unidad, si lo usas.</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-studio p-4 text-sm">
                <p className="mb-1 font-semibold">Ejemplo</p>
                <p className="text-muted-foreground">
                  Te costó <strong className="text-foreground">${example.cost.toFixed(2)}</strong> → costo redondeado{' '}
                  <strong className="text-foreground">${example.rounded}</strong> → precio de venta{' '}
                  <strong className="text-primary">${example.price.toFixed(2)}</strong> · a crédito{' '}
                  <strong className="text-foreground">${example.credit.toFixed(2)}</strong>
                </p>
              </div>

              <Button onClick={handleSavePricing} disabled={savingPricing} className="mt-4 h-12 w-full rounded-full">
                {savingPricing && <Loader className="h-4 w-4 animate-spin" />}Guardar reglas de precio
              </Button>
            </SectionCard>
          </TabsContent>

          {/* ===== CATEGORÍAS ===== */}
          <TabsContent value="categorias" className="mt-5 space-y-4">
            <CategoriesSettings />
          </TabsContent>

          {/* ===== PREFERENCIAS ===== */}
          <TabsContent value="preferencias" className="mt-5 space-y-4">
            <SectionCard title="En este dispositivo" description="Solo cambia cómo lo ves tú." icon={theme === 'dark' ? <Moon /> : <Sun />}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Moneda principal de los precios</Label>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Moneda principal">
                    {([['USD', 'Dólar $'], ['VES', 'Bolívar Bs'], ['EUR', 'Euro €']] as [DisplayCurrency, string][]).map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={displayCurrency === v} onClick={() => setDisplayCurrency(v)}
                        className={cn('h-11 rounded-full border text-sm font-medium transition-colors', displayCurrency === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40')}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-studio p-4">
                  <div>
                    <p className="font-medium">Modo oscuro</p>
                    <p className="text-sm text-muted-foreground">Más cómodo de noche.</p>
                  </div>
                  <Switch checked={theme === 'dark'} onCheckedChange={v => setTheme(v ? 'dark' : 'light')} aria-label="Modo oscuro" />
                </div>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* Editar datos de un método */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.label}</DialogTitle>
                <DialogDescription>Estos datos los ve la clienta al pagar. Revísalos bien.</DialogDescription>
              </DialogHeader>
              <form className="space-y-3" onSubmit={e => { e.preventDefault(); saveEdit(); }}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="m-label">Nombre</Label>
                    <Input id="m-label" value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value.slice(0, 40) })} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="m-desc">Descripción corta</Label>
                    <Input id="m-desc" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value.slice(0, 80) })} className="h-11 rounded-xl" />
                  </div>
                </div>
                {Object.keys(editing.config || {}).length > 0 && (
                  <div className="space-y-3 rounded-2xl bg-studio p-4">
                    {Object.entries(editing.config).map(([key, value]) => (
                      <div className="space-y-1.5" key={key}>
                        <Label htmlFor={`m-${key}`}>{paymentConfigLabel(key)}</Label>
                        {key === 'phone' ? (
                          <PhoneInput id={`m-${key}`} value={value} onChange={v => setEditing({ ...editing, config: { ...editing.config, [key]: v } })} inputClassName="h-11 rounded-xl bg-card" />
                        ) : key === 'ci' ? (
                          <DocumentIdInput id={`m-${key}`} value={value} onChange={v => setEditing({ ...editing, config: { ...editing.config, [key]: v } })} inputClassName="h-11 rounded-xl bg-card" />
                        ) : (
                          <Input id={`m-${key}`} value={value} onChange={e => setEditing({ ...editing, config: { ...editing.config, [key]: e.target.value.slice(0, 120) } })} className="h-11 rounded-xl bg-card" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  <Button type="submit" disabled={!editing.label.trim()}>Guardar</Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Nuevo método */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo método de pago</DialogTitle>
            <DialogDescription>Ponle un nombre y elige qué datos necesita la clienta para pagarte.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); createNew(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="n-label">Nombre</Label>
              <Input id="n-label" value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value.slice(0, 40) })} placeholder="Ej: PayPal" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-desc">Descripción corta (opcional)</Label>
              <Input id="n-desc" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value.slice(0, 80) })} placeholder="Ej: Pago en dólares por PayPal" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Datos que pedirá</Label>
              <div className="flex flex-wrap gap-2">
                {FIELD_CHOICES.map(f => {
                  const on = draft.fields.includes(f);
                  return (
                    <button key={f} type="button" aria-pressed={on}
                      onClick={() => setDraft({ ...draft, fields: on ? draft.fields.filter(x => x !== f) : [...draft.fields, f] })}
                      className={cn('h-9 rounded-full border px-3 text-sm transition-colors', on ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground')}>
                      {PAYMENT_CONFIG_LABELS[f]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Después tocas "Completar datos" para escribirlos.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
              <Button type="submit" disabled={!draft.label.trim()}>Crear método</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
