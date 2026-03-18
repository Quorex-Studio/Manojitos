import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ShoppingCart, Search, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { useDebts } from '@/hooks/useDebts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AngelaSmartCalculator } from '@/components/ai/AngelaSmartCalculator';

const paymentMethods = [
  { value: 'efectivo_usd', label: 'Efectivo USD' },
  { value: 'efectivo_bs', label: 'Efectivo Bs' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'pago_movil', label: 'Pago Móvil' },
  { value: 'transferencia', label: 'Transferencia' },
];

export default function Sales() {
  // --- STATE ---
  const { sales, addSale, deleteSale } = useSales();
  const { products } = useProducts();
  const { addDebt } = useDebts();
  const { rate, convertToBS } = useExchangeRate();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    product_id: '',
    quantity: '1',
    payment_method: '',
    client_name: '',
    client_phone: '',
    is_credit: false,
    notes: ''
  });

  // --- DERIVED ---

  const selectedProduct = products.find(p => p.id === form.product_id);
  const totalUSD = selectedProduct ? Number(selectedProduct.price_usd) * Number(form.quantity) : 0;
  const totalBS = convertToBS(totalUSD);

  const filteredSales = sales.filter(s =>
    s.product_name.toLowerCase().includes(search.toLowerCase()) ||
    s.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  // --- HANDLERS ---
  const resetForm = () => {
    setForm({
      product_id: '',
      quantity: '1',
      payment_method: '',
      client_name: '',
      client_phone: '',
      is_credit: false,
      notes: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const saleData = {
      product_id: form.product_id,
      product_name: selectedProduct.name,
      quantity: Number(form.quantity),
      unit_price_usd: Number(selectedProduct.price_usd),
      total_usd: totalUSD,
      total_bs: totalBS,
      payment_method: form.is_credit ? 'credito' : form.payment_method,
      client_name: form.client_name || null,
      client_phone: form.client_phone || null,
      is_credit: form.is_credit,
      notes: form.notes || null
    };

    const { data, error } = await addSale(saleData);

    if (!error && form.is_credit && form.client_name) {
      await addDebt({
        sale_id: data?.id || null,
        client_name: form.client_name,
        client_phone: form.client_phone || null,
        amount_usd: totalUSD,
        amount_bs: totalBS,
        status: 'pending',
        notes: form.notes || null
      });
    }

    if (!error) {
      setIsOpen(false);
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta venta?')) {
      await deleteSale(id);
    }
  };

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Ángela Smart Calculator */}
        <div className="lg:hidden">
          <AngelaSmartCalculator />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="page-header">Ventas</h1>
                <p className="page-subtitle">{sales.length} ventas registradas</p>
              </div>

          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="btn-gold rounded-xl gap-2">
                <Plus className="h-5 w-5" />
                Nueva Venta
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50 max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Nueva Venta</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Producto *</Label>
                  <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                    <SelectTrigger className="input-glass rounded-xl">
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.filter(p => p.stock > 0).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - ${Number(p.price_usd).toFixed(2)} ({p.stock} uds)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cantidad *</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedProduct?.stock || 999}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="input-glass rounded-xl"
                    required
                  />
                </div>

                {selectedProduct && (
                  <div className="p-4 rounded-xl bg-secondary/50 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total USD:</span>
                      <span className="font-bold text-gradient-gold">${totalUSD.toFixed(2)}</span>
                    </div>
                    {rate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Bs:</span>
                        <span className="font-medium">Bs. {totalBS.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                  <Label className="cursor-pointer">¿Es a crédito?</Label>
                  <Switch
                    checked={form.is_credit}
                    onCheckedChange={(checked) => setForm({ ...form, is_credit: checked })}
                  />
                </div>

                {!form.is_credit && (
                  <div className="space-y-2">
                    <Label>Método de pago *</Label>
                    <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                      <SelectTrigger className="input-glass rounded-xl">
                        <SelectValue placeholder="Seleccionar método" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {form.is_credit && (
                  <>
                    <div className="space-y-2">
                      <Label>Nombre del cliente *</Label>
                      <Input
                        value={form.client_name}
                        onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                        placeholder="Nombre del cliente"
                        className="input-glass rounded-xl"
                        required={form.is_credit}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Teléfono</Label>
                      <Input
                        value={form.client_phone}
                        onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                        placeholder="Teléfono de contacto"
                        className="input-glass rounded-xl"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Observaciones..."
                    className="input-glass rounded-xl resize-none"
                    rows={2}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full btn-gold rounded-xl"
                  disabled={!form.product_id || (!form.is_credit && !form.payment_method)}
                >
                  Registrar Venta
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ventas..."
            className="pl-10 input-glass rounded-xl"
          />
        </div>

        <div className="space-y-3">
          {filteredSales.map((sale, index) => (
            <motion.div
              key={sale.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card className="glass-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg gradient-primary">
                        <ShoppingCart className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{sale.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {sale.quantity} x ${Number(sale.unit_price_usd).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sale.created_at).toLocaleDateString('es', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-gradient-gold">${Number(sale.total_usd).toFixed(2)}</p>
                        <Badge variant={sale.is_credit ? 'destructive' : 'secondary'} className="mt-1">
                          {sale.is_credit ? 'Crédito' : sale.payment_method}
                        </Badge>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(sale.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

            {filteredSales.length === 0 && (
              <div className="text-center py-16">
                <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No hay ventas registradas</p>
              </div>
            )}
          </div>

          {/* Ángela Smart Calculator - Desktop Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-24">
              <AngelaSmartCalculator />
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
