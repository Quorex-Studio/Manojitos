import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader, Settings as SettingsIcon, Refresh, DollarSign, Moon, Sun, Euro, Calculator } from 'reicon-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useCurrency, DisplayCurrency } from '@/contexts/CurrencyContext';
import { usePricingConfig } from '@/hooks/usePricingConfig';
type Currency = 'USD' | 'EUR' | 'VES';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatBS } from '@/lib/utils';
import { AlertTriangle } from 'reicon-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePaymentMethods, PaymentMethodRow } from '@/hooks/usePaymentMethods';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Settings() {
  // --- STATE ---
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('USD');
  const { rates, loading: rateLoading, lastUpdate, refetch, autoFetching, updateRate } = useExchangeRate(selectedCurrency as 'USD' | 'EUR');
  
  const { methods: allPaymentMethods, updateMethod, createMethod, deleteMethod } = usePaymentMethods(true);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodRow | null>(null);
  const [isCreatingMethod, setIsCreatingMethod] = useState(false);
  const [newMethodDraft, setNewMethodDraft] = useState({ method_key: '', label: '', description: '', configPairs: [{ key: '', value: '' }] });
  // Rate para la UI de configuración de BCV
  const rateInfo = selectedCurrency === 'EUR' ? rates?.EUR : rates?.USD;
  const rate = rateInfo?.rate ?? 0;
  const newLastUpdate = rateInfo?.lastUpdate ?? null;
  const [newRate, setNewRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Pricing config
  const { config: pricingConfig, loading: pricingLoading, updateConfig: savePricingConfig } = usePricingConfig();
  const [pricingForm, setPricingForm] = useState({
    usd_to_eur_multiplier: '2',
    rounding_mode: 'ceil' as 'ceil' | 'round' | 'floor',
    retail_markup_pct: '15',
    credit_surcharge_pct: '10',
  });
  const [savingPricing, setSavingPricing] = useState(false);

  // Sync pricing form with loaded config
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

  const handleSavePricing = async () => {
    setSavingPricing(true);
    try {
      await savePricingConfig({
        usd_to_eur_multiplier: Number(pricingForm.usd_to_eur_multiplier) || 2,
        rounding_mode: pricingForm.rounding_mode,
        retail_markup_pct: Number(pricingForm.retail_markup_pct) || 15,
        credit_surcharge_pct: Number(pricingForm.credit_surcharge_pct) || 10,
      });
    } finally {
      setSavingPricing(false);
    }
  };

  // --- HANDLERS ---

  // Updates rate via edge function (uses service role key to bypass RLS)
  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRate) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-bcv-rate', {
        body: { rate: Number(newRate), currency: selectedCurrency }
      });
      
      if (error) throw error;
      
      if (data?.saved) {
        setNewRate('');
        refetch();
        toast({ title: 'Éxito', description: `Tasa ${selectedCurrency} actualizada: Bs. ${data.rate}` });
      } else {
        throw new Error('No se pudo guardar la tasa');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar la tasa', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Fetches rate via edge function (saves using service role key)
  const handleFetchRate = async () => {
    setFetchingRate(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-bcv-rate', {
        body: { currency: selectedCurrency }
      });
      
      if (error) throw error;
      
      if (data?.saved) {
        refetch();
        toast({ title: 'Éxito', description: `Tasa ${selectedCurrency} actualizada: Bs. ${data.rate}` });
      } else {
        throw new Error('No se pudo obtener la tasa');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo obtener la tasa', variant: 'destructive' });
    } finally {
      setFetchingRate(false);
    }
  };

  const handleToggleTheme = (newMode: boolean) => {
    setIsDark(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="page-header">Configuración</h1>
          <p className="page-subtitle">Ajustes del sistema</p>
        </div>

        {/* Preferencia de Moneda de Visualización */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card-gold border-gold/30">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-gold" />
                Preferencia de Visualización
              </CardTitle>
              <CardDescription>Elige la moneda principal en la que verás los precios (Afecta solo a este dispositivo)</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as DisplayCurrency)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="USD">Dólar ($)</TabsTrigger>
                  <TabsTrigger value="VES">Bolívar (Bs.)</TabsTrigger>
                  <TabsTrigger value="EUR">Euro (€)</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        {/* Exchange Rate */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card-gold border-gold/30">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                {selectedCurrency === 'USD' ? <DollarSign className="h-5 w-5" /> : <Euro className="h-5 w-5" />}
                Tasa de Cambio
              </CardTitle>
              <CardDescription>Configura la tasa de cambio para conversiones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Moneda Base</Label>
                <Tabs value={selectedCurrency} onValueChange={(v) => setSelectedCurrency(v as Currency)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="USD" className="gap-2"><DollarSign className="h-4 w-4" /> Dólar (USD)</TabsTrigger>
                    <TabsTrigger value="EUR" className="gap-2"><Euro className="h-4 w-4" /> Euro (EUR)</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="p-4 rounded-xl bg-secondary/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Tasa {selectedCurrency} actual</p>
                    <p className="text-3xl font-bold text-gradient-gold">
                      {rate > 0 ? `${formatBS(rate)}` : 'No configurada'}
                    </p>
                    {newLastUpdate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Última actualización: {newLastUpdate.toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" onClick={handleFetchRate} disabled={fetchingRate} className="rounded-xl gap-2 shrink-0">
                    {fetchingRate ? <Loader className="h-4 w-4 animate-spin" /> : <Refresh className="h-4 w-4" />}
                    Obtener {selectedCurrency}
                  </Button>
                </div>
              </div>

              <div className="mt-4 border-t border-border/10 pt-4">
                <Alert variant="default" className="mb-4 bg-gold/10 border-gold/30 text-gold-foreground">
                  <AlertTriangle className="h-4 w-4 text-gold" />
                  <AlertTitle>Modo de Contingencia</AlertTitle>
                  <AlertDescription className="text-xs">
                    Si la tasa automática falla, puedes fijar el valor oficial manualmente. Recuerda actualizarlo diariamente.
                  </AlertDescription>
                </Alert>
                <form onSubmit={handleUpdateRate} className="flex flex-wrap gap-2">
                  <Input type="number" step="0.01" min="0" value={newRate} onChange={(e) => setNewRate(e.target.value.replace(/[^0-9.]/g, ''))} placeholder={`Nueva tasa ${selectedCurrency} manual`} className="input-glass rounded-xl min-w-0 flex-1" aria-label="Tasa manual" />
                  <Button type="submit" disabled={loading || !newRate} className="btn-gold rounded-xl shrink-0">
                    {loading ? <Loader className="h-4 w-4 animate-spin" /> : 'Fijar Tasa Manual'}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pricing Configuration */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="glass-card-gold border-gold/30">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Costos y Precios
              </CardTitle>
              <CardDescription>Parámetros de cálculo automático de precios para productos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Factor USD → EUR</Label>
                  <Input type="number" step="0.1" min="0.1" value={pricingForm.usd_to_eur_multiplier} onChange={e => setPricingForm(prev => ({ ...prev, usd_to_eur_multiplier: e.target.value }))} placeholder="2" className="input-glass rounded-xl" />
                  <p className="text-xs text-muted-foreground">Costo redondeado × factor = Precio Mayor EUR</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Tipo de Redondeo</Label>
                  <Select value={pricingForm.rounding_mode} onValueChange={v => setPricingForm(prev => ({ ...prev, rounding_mode: v as 'ceil' | 'round' | 'floor' }))}>
                    <SelectTrigger className="input-glass rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ceil">Arriba (ceil)</SelectItem>
                      <SelectItem value="round">Estándar (round)</SelectItem>
                      <SelectItem value="floor">Abajo (floor)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Recargo Detal (%)</Label>
                  <Input type="number" step="1" min="0" max="100" value={pricingForm.retail_markup_pct} onChange={e => setPricingForm(prev => ({ ...prev, retail_markup_pct: e.target.value }))} placeholder="15" className="input-glass rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Recargo Crédito (%)</Label>
                  <Input type="number" step="1" min="0" max="100" value={pricingForm.credit_surcharge_pct} onChange={e => setPricingForm(prev => ({ ...prev, credit_surcharge_pct: e.target.value }))} placeholder="10" className="input-glass rounded-xl" />
                </div>
              </div>
              <Button onClick={handleSavePricing} disabled={savingPricing} className="btn-gold rounded-xl w-full">
                {savingPricing ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar Configuración de Precios
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Appearance */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                Apariencia
              </CardTitle>
              <CardDescription>Personaliza la apariencia de la aplicación</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/80">
                <div>
                  <p className="font-medium">Modo Oscuro</p>
                  <p className="text-sm text-muted-foreground">Cambia entre tema claro y oscuro</p>
                </div>
                <Switch checked={isDark} onCheckedChange={handleToggleTheme} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Información
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between p-3 rounded-lg bg-secondary/80">
                <span className="text-muted-foreground">Versión</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-secondary/80">
                <span className="text-muted-foreground">Nombre</span>
                <span className="font-medium text-gradient-gold">Manojitos</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Methods */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Métodos de Pago
              </CardTitle>
              <CardDescription>Activa, edita o agrega los métodos de pago disponibles en el checkout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {allPaymentMethods.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/80">
                  <div>
                    <p className="font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={m.enabled} onCheckedChange={(v) => updateMethod.mutate({ id: m.id, enabled: v })} />
                    <Button size="sm" variant="ghost" onClick={() => setEditingMethod(m)}>Editar</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                      if (confirm(`¿Eliminar "${m.label}"?`)) deleteMethod.mutate(m.id);
                    }}>Eliminar</Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-2" onClick={() => setIsCreatingMethod(true)}>
                + Agregar método de pago
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {editingMethod && (
          <Dialog open={!!editingMethod} onOpenChange={(o) => !o && setEditingMethod(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Editar {editingMethod.label}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Nombre</Label>
                  <Input value={editingMethod.label} onChange={e => setEditingMethod({ ...editingMethod, label: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Descripción</Label>
                  <Input value={editingMethod.description || ''} onChange={e => setEditingMethod({ ...editingMethod, description: e.target.value })} />
                </div>
                {Object.entries(editingMethod.config || {}).map(([key, value]) => (
                  <div className="space-y-1" key={key}>
                    <Label className="capitalize">{key}</Label>
                    <Input value={value} onChange={e => setEditingMethod({ ...editingMethod, config: { ...editingMethod.config, [key]: e.target.value } })} />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingMethod(null)}>Cancelar</Button>
                <Button onClick={() => {
                  updateMethod.mutate({ id: editingMethod.id, label: editingMethod.label, description: editingMethod.description, config: editingMethod.config });
                  setEditingMethod(null);
                }}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={isCreatingMethod} onOpenChange={setIsCreatingMethod}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo método de pago</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Clave interna (sin espacios, ej: binance_pay)</Label>
                <Input value={newMethodDraft.method_key} onChange={e => setNewMethodDraft({ ...newMethodDraft, method_key: e.target.value.replace(/\s+/g, '_').toLowerCase() })} />
              </div>
              <div className="space-y-1">
                <Label>Nombre visible</Label>
                <Input value={newMethodDraft.label} onChange={e => setNewMethodDraft({ ...newMethodDraft, label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Descripción</Label>
                <Input value={newMethodDraft.description} onChange={e => setNewMethodDraft({ ...newMethodDraft, description: e.target.value })} />
              </div>
              {newMethodDraft.configPairs.map((pair, idx) => (
                <div className="flex gap-2" key={idx}>
                  <Input placeholder="clave (ej: wallet)" value={pair.key} onChange={e => {
                    const copy = [...newMethodDraft.configPairs]; copy[idx].key = e.target.value;
                    setNewMethodDraft({ ...newMethodDraft, configPairs: copy });
                  }} />
                  <Input placeholder="valor" value={pair.value} onChange={e => {
                    const copy = [...newMethodDraft.configPairs]; copy[idx].value = e.target.value;
                    setNewMethodDraft({ ...newMethodDraft, configPairs: copy });
                  }} />
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setNewMethodDraft({ ...newMethodDraft, configPairs: [...newMethodDraft.configPairs, { key: '', value: '' }] })}>
                + Agregar campo
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreatingMethod(false)}>Cancelar</Button>
              <Button onClick={() => {
                const config: Record<string, string> = {};
                newMethodDraft.configPairs.forEach(p => { if (p.key) config[p.key] = p.value; });
                createMethod.mutate({
                  method_key: newMethodDraft.method_key,
                  label: newMethodDraft.label,
                  description: newMethodDraft.description,
                  enabled: true,
                  display_order: allPaymentMethods.length + 1,
                  config,
                });
                setIsCreatingMethod(false);
                setNewMethodDraft({ method_key: '', label: '', description: '', configPairs: [{ key: '', value: '' }] });
              }}>Crear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
