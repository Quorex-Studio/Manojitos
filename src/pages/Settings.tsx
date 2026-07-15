import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, RefreshCw, DollarSign, Moon, Sun, Loader2, Euro } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useExchangeRate, Currency } from '@/hooks/useExchangeRate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatBS } from '@/lib/utils';

export default function Settings() {
  // --- STATE ---
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => {
    return (localStorage.getItem('preferredCurrency') as Currency) || 'USD';
  });
  
  const { rate, loading: rateLoading, lastUpdate, refetch, autoFetching } = useExchangeRate(selectedCurrency);
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

        {/* Exchange Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
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
                      {rate > 0 ? `Bs. ${formatBS(rate)}` : 'No configurada'}
                    </p>
                    {lastUpdate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Última actualización: {lastUpdate.toLocaleDateString('es', {
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
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Obtener {selectedCurrency}
                  </Button>
                </div>
              </div>

              <form onSubmit={handleUpdateRate} className="hidden flex-wrap gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder={`Nueva tasa ${selectedCurrency} en Bs.`}
                  className="input-glass rounded-xl min-w-0 flex-1"
                />
                <Button type="submit" disabled={loading || !newRate} className="btn-gold rounded-xl shrink-0">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar'}
                </Button>
              </form>
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
