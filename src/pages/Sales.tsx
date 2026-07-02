import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ShoppingCart, Search, Trash2, Check, X, ClipboardList, User, Phone, Mail, DollarSign, Calendar } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const paymentMethods = [
  { value: 'efectivo_usd', label: 'Efectivo USD' },
  { value: 'efectivo_bs', label: 'Efectivo Bs' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'pago_movil', label: 'Pago Móvil' },
  { value: 'transferencia', label: 'Transferencia' },
];

export default function Sales() {
  // --- STATE ---
  const { sales, addSale, deleteSale, refetch: refetchSales } = useSales();
  const { products, refetch: refetchProducts } = useProducts();
  const { addDebt } = useDebts();
  const { rate, convertToBS } = useExchangeRate();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('pending');
  const [form, setForm] = useState({
    product_id: '',
    quantity: '1',
    payment_method: '',
    client_name: '',
    client_phone: '',
    is_credit: false,
    notes: ''
  });

  const queryClient = useQueryClient();

  // --- QUERY CUSTOMER ORDERS ---
  const { data: orders = [], isLoading: isLoadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['admin-orders-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admin orders:', error);
        throw error;
      }
      return data || [];
    }
  });

  // --- DERIVED ---
  const selectedProduct = products.find(p => p.id === form.product_id);
  const totalUSD = selectedProduct ? Number(selectedProduct.price_usd) * Number(form.quantity) : 0;
  const totalBS = convertToBS(totalUSD);

  const filteredSales = sales.filter(s =>
    s.product_name.toLowerCase().includes(search.toLowerCase()) ||
    s.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.customer_name?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customer_email?.toLowerCase().includes(orderSearch.toLowerCase());
    
    if (orderStatusFilter === 'all') return matchesSearch;
    return matchesSearch && o.status === orderStatusFilter;
  });

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
      refetchProducts();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta venta?')) {
      await deleteSale(id);
      refetchProducts();
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    if (!confirm('¿Aprobar este pedido? Esto descontará el stock y registrará la venta.')) return;

    try {
      // 1. Consultar la orden antes de aprobar para conocer sus detalles
      const { data: approvedOrder, error: orderFetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderFetchError) throw orderFetchError;

      // 2. Ejecutar la función RPC para confirmar y registrar venta
      const { error } = await supabase.rpc('confirm_order', { p_order_id: orderId });
      if (error) throw error;

      toast.success('Pedido aprobado y venta registrada correctamente 🩷');

      // 3. Si el método es crédito, descontar/cargar a su cuenta de crédito
      if (approvedOrder.payment_method === 'credito') {
        // Encontrar cuenta de crédito por user_id, email, o teléfono
        let { data: targetCredit, error: creditError } = await supabase
          .from('credits')
          .select('*')
          .eq('client_user_id', approvedOrder.customer_user_id)
          .maybeSingle();

        if (!targetCredit) {
          if (approvedOrder.customer_email) {
            const { data: emailData } = await supabase
              .from('credits')
              .select('*')
              .eq('client_email', approvedOrder.customer_email)
              .maybeSingle();
            targetCredit = emailData;
          }
          if (!targetCredit && approvedOrder.customer_phone) {
            const { data: phoneData } = await supabase
              .from('credits')
              .select('*')
              .eq('client_phone', approvedOrder.customer_phone)
              .maybeSingle();
            targetCredit = phoneData;
          }
        }

        if (targetCredit) {
          const totalUsd = approvedOrder.total_usd;
          const montoFinanciado = totalUsd * 0.50;
          const montoCuota = montoFinanciado / 3;
          const saldoDeudorNeto = montoFinanciado - montoCuota; // 2 cuotas pendientes ($40 en una orden de $120)

          const previousBalance = targetCredit.current_balance;
          const newBalance = previousBalance + saldoDeudorNeto;

          // Próxima fecha de vencimiento a 15 días
          const nextDueDate = new Date();
          nextDueDate.setDate(nextDueDate.getDate() + 15);

          // Actualizar el balance, total_purchases y next_due_date
          const { error: updateCreditErr } = await supabase
            .from('credits')
            .update({
              current_balance: newBalance,
              total_purchases: (targetCredit.total_purchases || 0) + 1,
              next_due_date: targetCredit.next_due_date 
                ? (new Date(targetCredit.next_due_date) < nextDueDate ? targetCredit.next_due_date : nextDueDate.toISOString())
                : nextDueDate.toISOString()
            })
            .eq('id', targetCredit.id);

          if (updateCreditErr) throw updateCreditErr;

          // Registrar 2 transacciones para transparencia:
          // 1. CARGO del 50% financiado
          const { error: txCargoErr } = await supabase
            .from('credit_transactions')
            .insert({
              credit_id: targetCredit.id,
              user_id: approvedOrder.customer_user_id || targetCredit.user_id,
              type: 'CARGO',
              amount: montoFinanciado,
              previous_balance: previousBalance,
              new_balance: previousBalance + montoFinanciado,
              description: `Cargo Financiamiento 50% pedido #${orderId.substring(0, 8)}`,
            });

          if (txCargoErr) throw txCargoErr;

          // 2. ABONO inmediato de la Cuota 1 de 3 (incluida en el pago inicial)
          const { error: txAbonoErr } = await supabase
            .from('credit_transactions')
            .insert({
              credit_id: targetCredit.id,
              user_id: approvedOrder.customer_user_id || targetCredit.user_id,
              type: 'ABONO',
              amount: montoCuota,
              previous_balance: previousBalance + montoFinanciado,
              new_balance: newBalance,
              description: `Abono Cuota 1/3 (Pago Inicial) pedido #${orderId.substring(0, 8)}`,
            });

          if (txAbonoErr) throw txAbonoErr;

          toast.success(`Financiamiento Manojitos aplicado a ${targetCredit.client_name}: Cargado $${montoFinanciado.toFixed(2)}, Abonado Cuota 1 $${montoCuota.toFixed(2)}. Saldo restante financiado: $${saldoDeudorNeto.toFixed(2)}.`);
        } else {
          toast.warning('El pedido se aprobó con método Crédito, pero el cliente no posee una línea de crédito registrada.');
        }
      } else if (approvedOrder.notes?.includes('[ABONO_CREDITO]')) {
        // Encontrar cuenta de crédito por user_id, email, o teléfono
        let { data: targetCredit, error: creditError } = await supabase
          .from('credits')
          .select('*')
          .eq('client_user_id', approvedOrder.customer_user_id)
          .maybeSingle();

        if (!targetCredit) {
          if (approvedOrder.customer_email) {
            const { data: emailData } = await supabase
              .from('credits')
              .select('*')
              .eq('client_email', approvedOrder.customer_email)
              .maybeSingle();
            targetCredit = emailData;
          }
          if (!targetCredit && approvedOrder.customer_phone) {
            const { data: phoneData } = await supabase
              .from('credits')
              .select('*')
              .eq('client_phone', approvedOrder.customer_phone)
              .maybeSingle();
            targetCredit = phoneData;
          }
        }

        if (targetCredit) {
          const abonoAmount = approvedOrder.total_usd;
          const previousBalance = targetCredit.current_balance;
          const newBalance = Math.max(0, previousBalance - abonoAmount);

          // Actualizar el balance de la línea de crédito
          const { error: updateCreditErr } = await supabase
            .from('credits')
            .update({
              current_balance: newBalance
            })
            .eq('id', targetCredit.id);

          if (updateCreditErr) throw updateCreditErr;

          // Registrar la transacción de tipo ABONO
          const { error: txErr } = await supabase
            .from('credit_transactions')
            .insert({
              credit_id: targetCredit.id,
              user_id: approvedOrder.customer_user_id || targetCredit.user_id,
              type: 'ABONO',
              amount: abonoAmount,
              previous_balance: previousBalance,
              new_balance: newBalance,
              description: `Abono verificado (Pedido #${orderId.substring(0, 8)})`,
            });

          if (txErr) throw txErr;

          toast.success(`Abono a Crédito verificado para ${targetCredit.client_name}: Saldo disminuido en $${abonoAmount.toFixed(2)}. Nuevo saldo: $${newBalance.toFixed(2)}.`);
        } else {
          toast.warning('Se verificó el abono, pero no se encontró la cuenta de crédito asociada.');
        }
      }
      
      // Invalidate queries to refresh UI
      refetchOrders();
      refetchSales();
      refetchProducts();
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    } catch (err) {
      console.error('Error approving order:', err);
      toast.error(err instanceof Error ? err.message : 'Error al aprobar el pedido');
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    if (!confirm('¿Rechazar y cancelar este pedido?')) return;

    try {
      const { error } = await supabase.rpc('reject_order', { p_order_id: orderId });
      if (error) throw error;

      toast.success('Pedido rechazado y cancelado 💔');
      
      refetchOrders();
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
    } catch (err) {
      console.error('Error rejecting order:', err);
      toast.error(err instanceof Error ? err.message : 'Error al rechazar el pedido');
    }
  };

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Ventas y Pedidos</h1>
          <p className="page-subtitle">Gestiona las ventas del local y aprueba los pedidos de los clientes</p>
        </div>

        <Tabs defaultValue="ventas" className="w-full">
          <TabsList className="grid grid-cols-2 max-w-md bg-secondary rounded-xl mb-6">
            <TabsTrigger value="ventas" className="rounded-lg">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Ventas de Caja
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="rounded-lg relative">
              <ClipboardList className="h-4 w-4 mr-2" />
              Pedidos Clientes
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full">
                  {orders.filter(o => o.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB: VENTAS DIRECTAS */}
          <TabsContent value="ventas" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar ventas..."
                  className="pl-10 input-glass rounded-xl"
                />
              </div>

              <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="btn-gold rounded-xl gap-2 w-full sm:w-auto">
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
                      <div className="p-4 rounded-xl bg-secondary/80 space-y-1">
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

                    <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/80">
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

            <div className="space-y-3">
              {filteredSales.map((sale, index) => (
                <motion.div
                  key={sale.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Card className="glass-card border-border/50 hover:shadow-md transition-all duration-300">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-left">{sale.product_name}</p>
                            <p className="text-sm text-muted-foreground text-left">
                              {sale.quantity} x ${Number(sale.unit_price_usd).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground text-left">
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
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {filteredSales.length === 0 && (
                <div className="text-center py-16">
                  <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay ventas registradas</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB: PEDIDOS DE CLIENTES */}
          <TabsContent value="pedidos" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="relative max-w-md flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Buscar por cliente o ID de pedido..."
                  className="pl-10 input-glass rounded-xl"
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                  <SelectTrigger className="w-full sm:w-44 input-glass rounded-xl">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="confirmed">Aprobados</SelectItem>
                    <SelectItem value="cancelled">Rechazados</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoadingOrders ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Cargando pedidos de clientes...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-16">
                <ClipboardList className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No se encontraron pedidos con el filtro seleccionado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order, index) => {
                  const items = Array.isArray(order.items) ? order.items : [];
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <Card className="glass-card border-border/50 hover:shadow-md transition-all duration-300">
                        <CardContent className="p-5 space-y-4">
                          {/* Order Header */}
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/10">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-lg">{order.customer_name}</h3>
                                <Badge variant={
                                  order.status === 'pending' ? 'outline' : 
                                  order.status === 'confirmed' ? 'default' : 'destructive'
                                }>
                                  {order.status === 'pending' ? 'Pendiente' : 
                                   order.status === 'confirmed' ? 'Aprobado' : 'Rechazado'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">
                                Pedido #{order.id.substring(0, 8)}...
                              </p>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4" />
                                {new Date(order.created_at).toLocaleDateString('es', {
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                              {order.customer_phone && (
                                <span className="flex items-center gap-1.5">
                                  <Phone className="h-4 w-4" />
                                  {order.customer_phone}
                                </span>
                              )}
                              {order.customer_email && (
                                <span className="flex items-center gap-1.5">
                                  <Mail className="h-4 w-4" />
                                  {order.customer_email}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Order Items */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 text-left">Productos pedidos</h4>
                            <div className="divide-y divide-border/10 bg-secondary/30 rounded-xl p-3">
                              {items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center py-2 text-sm">
                                  <div className="flex items-center gap-3">
                                    {item.image_url && (
                                      <img src={item.image_url} alt={item.product_name} className="w-8 h-8 rounded object-cover" />
                                    )}
                                    <div className="text-left">
                                      <p className="font-medium">{item.product_name}</p>
                                      <p className="text-xs text-muted-foreground">Cant: {item.quantity}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold">${Number(item.total).toFixed(2)}</p>
                                    <p className="text-xs text-muted-foreground">${Number(item.unit_price).toFixed(2)} c/u</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Order Footer & Actions */}
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pt-2">
                            <div className="text-left w-full sm:w-2/3">
                              <div className="flex items-baseline gap-2 mb-3">
                                <span className="text-xs text-muted-foreground">Total:</span>
                                <span className="text-xl font-bold text-gradient-gold">${Number(order.total_usd).toFixed(2)}</span>
                                {order.total_bs && (
                                  <span className="text-sm text-muted-foreground font-medium">/ Bs. {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(order.total_bs))}</span>
                                )}
                              </div>
                              
                              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
                                <p className="text-xs text-foreground">
                                  <span className="text-muted-foreground font-medium">Método Pago:</span> <span className="capitalize font-bold text-primary">{order.payment_method.replace('_', ' ')}</span>
                                </p>
                                {order.payment_method === 'pago_movil' && order.banco_origen && (
                                  <p className="text-xs text-foreground">
                                    <span className="text-muted-foreground font-medium">Banco:</span> <span className="font-semibold">{order.banco_origen}</span> <span className="mx-1 text-border">|</span> <span className="text-muted-foreground font-medium">Ref:</span> <span className="font-semibold text-accent">{order.numero_referencia}</span>
                                  </p>
                                )}
                                {order.notes && (
                                  <div className="mt-2 pt-2 border-t border-primary/10">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Notas / Instrucciones:</p>
                                    <p className="text-sm text-foreground italic bg-background/50 p-2 rounded-md border border-border/50">
                                      {order.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {order.status === 'pending' && (
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                  variant="outline" 
                                  onClick={() => handleRejectOrder(order.id)}
                                  className="border-destructive/30 hover:border-destructive text-destructive hover:bg-destructive/5 rounded-xl flex-1 sm:flex-initial"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Rechazar
                                </Button>
                                <Button 
                                  onClick={() => handleApproveOrder(order.id)}
                                  className="btn-gold rounded-xl flex-1 sm:flex-initial"
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Aprobar Pedido
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
