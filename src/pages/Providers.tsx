import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Truck, Search, Trash2, Check, Phone, Mailbox } from 'reicon-react';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProviders } from '@/hooks/useProviders';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Providers() {
  // --- STATE ---
  const { providers, purchases, addProvider, deleteProvider, addPurchase, markPurchaseAsPaid } = useProviders();
  const { rate, convertToBS } = useExchangeRate();
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const [providerForm, setProviderForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [purchaseForm, setPurchaseForm] = useState({ provider_id: '', amount_usd: '', amount_bs: '', notes: '', purchase_date: new Date().toISOString().split('T')[0] });

  // --- DERIVED ---

  const pendingPurchases = purchases.filter(p => p.status === 'pending');
  const paidPurchases = purchases.filter(p => p.status === 'paid');
  const totalPending = pendingPurchases.reduce((acc, p) => acc + Number(p.amount_usd), 0);

  // --- HANDLERS ---
  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    const { sanitizeText } = await import('@/lib/validations');
    const { error } = await addProvider({
      name: sanitizeText(providerForm.name),
      phone: providerForm.phone ? sanitizeText(providerForm.phone) : null,
      email: providerForm.email ? sanitizeText(providerForm.email) : null,
      notes: providerForm.notes ? sanitizeText(providerForm.notes) : null
    });
    if (!error) {
      setIsProviderOpen(false);
      setProviderForm({ name: '', phone: '', email: '', notes: '' });
    }
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const provider = providers.find(p => p.id === purchaseForm.provider_id);
    if (!provider) return;
    
    const { sanitizeText } = await import('@/lib/validations');
    const { error } = await addPurchase({
      provider_id: purchaseForm.provider_id,
      provider_name: provider.name,
      amount_usd: Number(purchaseForm.amount_usd),
      amount_bs: convertToBS(Number(purchaseForm.amount_usd)),
      status: 'pending',
      notes: purchaseForm.notes ? sanitizeText(purchaseForm.notes) : null,
      purchase_date: purchaseForm.purchase_date
    });
    if (!error) {
      setIsPurchaseOpen(false);
      setPurchaseForm({ provider_id: '', amount_usd: '', amount_bs: '', notes: '', purchase_date: new Date().toISOString().split('T')[0] });
    }
  };

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-header">Proveedores</h1>
            <p className="page-subtitle">
              Pagos pendientes: <span className="text-gradient-gold font-bold">${totalPending.toFixed(2)}</span>
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Dialog open={isProviderOpen} onOpenChange={setIsProviderOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-xl gap-2">
                  <Plus className="h-4 w-4" />
                  Proveedor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto glass-card border-border/50">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl">Nuevo Proveedor</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddProvider} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nombre *</Label>
                    <Input
                      value={providerForm.name}
                      onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]/g, '') })}
                      className="input-glass rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={providerForm.phone}
                      onChange={(e) => setProviderForm({ ...providerForm, phone: e.target.value.replace(/[^\+0-9\-\(\)\s]/g, '') })}
                      className="input-glass rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={providerForm.email}
                      onChange={(e) => setProviderForm({ ...providerForm, email: e.target.value.replace(/[^a-zA-Z0-9@._\-+]/g, '') })}
                      className="input-glass rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={providerForm.notes}
                      onChange={(e) => setProviderForm({ ...providerForm, notes: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s.,()-]/g, '') })}
                      className="input-glass rounded-xl resize-none"
                      rows={2}
                    />
                  </div>
                  <Button type="submit" className="w-full btn-gold rounded-xl">Crear Proveedor</Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isPurchaseOpen} onOpenChange={setIsPurchaseOpen}>
              <DialogTrigger asChild>
                <Button className="btn-gold rounded-xl gap-2">
                  <Plus className="h-4 w-4" />
                  Compra
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto glass-card border-border/50">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl">Nueva Compra</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddPurchase} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Proveedor *</Label>
                    <Select value={purchaseForm.provider_id} onValueChange={(v) => setPurchaseForm({ ...purchaseForm, provider_id: v })}>
                      <SelectTrigger className="input-glass rounded-xl">
                        <SelectValue placeholder="Seleccionar proveedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Monto (Bs.)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={purchaseForm.amount_bs}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          setPurchaseForm({
                            ...purchaseForm,
                            amount_bs: val,
                            amount_usd: rate > 0 && val ? (Number(val) / rate).toFixed(2) : ''
                          });
                        }}
                        className="input-glass rounded-xl"
                        placeholder="Ej. 1500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Equivalente (USD) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={purchaseForm.amount_usd}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          setPurchaseForm({
                            ...purchaseForm,
                            amount_usd: val,
                            amount_bs: rate > 0 && val ? (Number(val) * rate).toFixed(2) : ''
                          });
                        }}
                        className="input-glass rounded-xl"
                        placeholder="Ej. 40"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de compra</Label>
                    <Input
                      type="date"
                      value={purchaseForm.purchase_date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        const today = new Date().toISOString().split('T')[0];
                        if (e.target.value <= today) {
                          setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value });
                        }
                      }}
                      className="input-glass rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={purchaseForm.notes}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s.,()-]/g, '') })}
                      className="input-glass rounded-xl resize-none"
                      rows={2}
                    />
                  </div>
                  <Button type="submit" className="w-full btn-gold rounded-xl" disabled={!purchaseForm.provider_id}>
                    Registrar Compra
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="purchases" className="space-y-4">
          <TabsList className="glass-card p-1 rounded-xl">
            <TabsTrigger value="purchases" className="rounded-lg data-[state=active]:gradient-primary data-[state=active]:text-white">
              Compras
            </TabsTrigger>
            <TabsTrigger value="providers" className="rounded-lg data-[state=active]:gradient-primary data-[state=active]:text-white">
              Proveedores ({providers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchases" className="space-y-3">
            {purchases.map((purchase) => (
              <motion.div
                key={purchase.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="glass-card border-border/50">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${purchase.status === 'paid' ? 'bg-primary/20' : 'gradient-gold'}`}>
                          <Truck className={`h-5 w-5 ${purchase.status === 'paid' ? 'text-primary' : 'text-accent-foreground'}`} />
                        </div>
                        <div>
                          <p className="font-medium">{purchase.provider_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(purchase.purchase_date).toLocaleDateString('es')}
                          </p>
                          {purchase.notes && <p className="text-xs text-muted-foreground italic">{purchase.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-gradient-gold">${Number(purchase.amount_usd).toFixed(2)}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-semibold border",
                              purchase.status === 'paid'
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            )}
                          >
                            {purchase.status === 'paid' ? 'Pagado' : 'Pendiente'}
                          </Badge>
                        </div>
                        {purchase.status === 'pending' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => markPurchaseAsPaid(purchase.id)}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {purchases.length === 0 && (
              <div className="text-center py-16">
                <Truck className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No hay compras registradas</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="providers" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((provider) => (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="glass-card border-border/50 hover-lift">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{provider.name}</h3>
                        {provider.phone && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {provider.phone}
                          </div>
                        )}
                        {provider.email && (
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Mailbox className="h-3 w-3" />
                            {provider.email}
                          </div>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteProvider(provider.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {providers.length === 0 && (
              <div className="col-span-full text-center py-16">
                <Truck className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No hay proveedores registrados</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
