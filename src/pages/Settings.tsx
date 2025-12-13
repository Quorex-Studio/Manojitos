import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, RefreshCw, DollarSign, Moon, Sun, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  const { rate, loading: rateLoading, lastUpdate, refetch, autoFetching } = useExchangeRate();
  const [newRate, setNewRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingBCV, setFetchingBCV] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Updates rate via edge function (uses service role key to bypass RLS)
  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRate) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-bcv-rate', {
        body: { rate: Number(newRate) }
      });
      
      if (error) throw error;
      
      if (data?.saved) {
        setNewRate('');
        refetch();
        toast({ title: 'Éxito', description: `Tasa actualizada: Bs. ${data.rate}` });
      } else {
        throw new Error('No se pudo guardar la tasa');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar la tasa', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Fetches BCV rate via edge function (saves using service role key)
  const handleFetchBCV = async () => {
    setFetchingBCV(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-bcv-rate');
      
      if (error) throw error;
      
      if (data?.saved) {
        refetch();
        toast({ title: 'Éxito', description: `Tasa BCV actualizada: Bs. ${data.rate}` });
      } else {
        throw new Error('No se pudo obtener la tasa');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo obtener la tasa del BCV', variant: 'destructive' });
    } finally {
      setFetchingBCV(false);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

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
                <DollarSign className="h-5 w-5" />
                Tasa de Cambio
              </CardTitle>
              <CardDescription>Configura la tasa del dólar para conversiones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tasa actual</p>
                    <p className="text-3xl font-bold text-gradient-gold">
                      {rate > 0 ? `Bs. ${rate.toFixed(2)}` : 'No configurada'}
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
                    onClick={handleFetchBCV}
                    disabled={fetchingBCV}
                    className="rounded-xl gap-2"
                  >
                    {fetchingBCV ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Obtener BCV
                  </Button>
                </div>
              </div>

              <form onSubmit={handleUpdateRate} className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  placeholder="Nueva tasa en Bs."
                  className="input-glass rounded-xl"
                />
                <Button type="submit" disabled={loading || !newRate} className="btn-gold rounded-xl">
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
              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                <div>
                  <p className="font-medium">Modo Oscuro</p>
                  <p className="text-sm text-muted-foreground">Cambia entre tema claro y oscuro</p>
                </div>
                <Switch checked={isDark} onCheckedChange={toggleDarkMode} />
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
              <div className="flex justify-between p-3 rounded-lg bg-secondary/30">
                <span className="text-muted-foreground">Versión</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-secondary/30">
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
