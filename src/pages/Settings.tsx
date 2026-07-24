import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader, Settings as SettingsIcon, Refresh, DollarSign, Moon, Sun, Euro } from 'reicon-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useCurrency, DisplayCurrency } from '@/contexts/CurrencyContext';
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

export default function Settings() {
  // --- STATE ---
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('USD');
  const { rates, loading: rateLoading, lastUpdate, refetch, autoFetching, updateRate } = useExchangeRate(selectedCurrency as 'USD' | 'EUR');
  
  // Rate para la UI de configuración de BCV
  const rateInfo = selectedCurrency === 'EUR' ? rates?.EUR : rates?.USD;
  const rate = rateInfo?.rate ?? 0;
  const newLastUpdate = rateInfo?.lastUpdate ?? null;
  const [newRate, setNewRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card-gold border-gold/30">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                {selectedCurrency === 'USD' ? (
                  <DollarSign className="h-5 w-5" />
                ) : (
                  <Euro className="h-5 w-5" />
                )}
                Tasa de Cambio
              </CardTitle>
              <CardDescription>Configura la tasa de cambio para conversiones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Currency Selector */}
              <div className="space-y-2">
                <Label>Moneda Base</Label>
                <Tabs value={selectedCurrency} onValueChange={(v) => setSelectedCurrency(v as Currency)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="USD" className="gap-2">
                      <DollarSign className="h-4 w-4" />
                      Dólar (USD)
                    </TabsTrigger>
                    <TabsTrigger value="EUR" className="gap-2">
                      <Euro className="h-4 w-4" />
                      Euro (EUR)
                    </TabsTrigger>
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
                        Última actualización: {newLastUpdate.toLocaleDateString('es', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleFetchRate}
                    disabled={fetchingRate}
                    className="rounded-xl gap-2 shrink-0"
                  >
                    {fetchingRate ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Refresh className="h-4 w-4" />
                    )}
                    Obtener {selectedCurrency}
                  </Button>
                </div>
              </div>

              {/* Formulario de actualización manual */}
              <div className="mt-4 border-t border-border/10 pt-4">
                <Alert variant="default" className="mb-4 bg-gold/10 border-gold/30 text-gold-foreground">
                  <AlertTriangle className="h-4 w-4 text-gold" />
                  <AlertTitle>Modo de Contingencia</AlertTitle>
                  <AlertDescription className="text-xs">
                    Si la tasa automática falla, puedes fijar el valor oficial manualmente. Recuerda actualizarlo diariamente.
                  </AlertDescription>
                </Alert>
                <form onSubmit={handleUpdateRate} className="flex flex-wrap gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder={`Nueva tasa ${selectedCurrency} manual`}
                    className="input-glass rounded-xl min-w-0 flex-1"
                    aria-label="Tasa manual"
                  />
                  <Button type="submit" disabled={loading || !newRate} className="btn-gold rounded-xl shrink-0">
                    {loading ? <Loader className="h-4 w-4 animate-spin" /> : 'Fijar Tasa Manual'}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
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
      </div>
    </AppLayout>
  );
}
