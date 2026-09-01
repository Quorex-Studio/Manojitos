import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TickCircle, Location, BoxAdd, Truck, Loader, Plus, ShoppingCart, Search, Trash2, Check, CloseSquare, ClipboardList, User, Phone, Mailbox, DollarSign, Calendar, CreditCard, Bank, FileText, Package, Refresh } from 'reicon-react';
import { getNextTwoCutoffDates, getNextThreeCutoffDates, formatCutoffDate } from '@/lib/cutoffDates';
import { usePricingConfig } from '@/hooks/usePricingConfig';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { useCredits } from '@/hooks/useCredits';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBS } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';

const paymentMethods = [
  { value: 'efectivo_usd', label: 'Efectivo USD' },
  { value: 'efectivo_bs', label: 'Efectivo Bs' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'pago_movil', label: 'Pago Móvil' },
  { value: 'transferencia', label: 'Transferencia' },
];

const formatPaymentMethod = (method: string) => {
  if (!method) return '';
  return method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const renderOrderNotes = (notes: string) => {
  if (!notes) return null;
  const isDelivery = notes.includes('[DELIVERY]');
  let cleanNotes = notes.replace('[DELIVERY]', '').trim();

  // Try to extract Tlf. Emisor PM
  let pmPhone = '';
  const phoneMatch = cleanNotes.match(/Tlf\. Emisor PM:\s*([\d\s]+)/i);
  if (phoneMatch) {
    pmPhone = phoneMatch[1].trim();
    cleanNotes = cleanNotes.replace(phoneMatch[0], '').trim();
  }
  
  // Try to extract Dirección
  let address = cleanNotes;
  if (cleanNotes.startsWith('Dirección:')) {
    address = cleanNotes.replace('Dirección:', '').trim();
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      {isDelivery && (
        <div className="flex items-start gap-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 p-2.5 rounded-lg border border-blue-500/20">
          <Truck className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-0.5">Delivery a:</p>
            <p className="text-sm">{address}</p>
          </div>
        </div>
      )}
      {!isDelivery && address && (
        <div className="flex items-start gap-2 bg-background/50 p-2.5 rounded-lg border border-border/50">
          <Location className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-foreground">{address}</p>
        </div>
      )}
      {pmPhone && (
        <div className="flex items-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 p-2.5 rounded-lg border border-green-500/20">
          <Phone className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm font-medium">Tlf. Pago Móvil: {pmPhone}</p>
        </div>
      )}
    </div>
  );
};

// Línea individual del carrito de venta
interface SaleLineItem {
  id: string; // UUID local para key
  product_id: string;
  quantity: string;
}

export default function Sales() {
  // --- STATE ---
  const { sales, addSale, confirmSale, deleteSale, registerSalePayment, refetch: refetchSales } = useSales();
  const { products, refetch: refetchProducts } = useProducts();
  const { rate, convertToBS } = useExchangeRate();
  const { config: pricingConfig } = usePricingConfig();
  const [searchParams] = useSearchParams();
  const initialSalesTab = searchParams.get('tab') === 'pedidos' ? 'pedidos' : 'ventas';
  const [activeSalesTab, setActiveSalesTab] = useState(initialSalesTab);
  const [isOpen, setIsOpen] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [search, setSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderDateFilter, setOrderDateFilter] = useState('all');
  const [orderSort, setOrderSort] = useState('date_desc');
  const [saleModalityFilter, setSaleModalityFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carrito multi-producto
  const [items, setItems] = useState<SaleLineItem[]>([{ id: crypto.randomUUID(), product_id: '', quantity: '1' }]);

  // Datos del pago
  const [payment, setPayment] = useState({
    method: '',
    amount_received: '',
    is_credit: false,
  });

  // Modalidad de venta: contado | dos_partes | financiamiento | fiado
  type SaleModality = 'contado' | 'dos_partes' | 'financiamiento' | 'fiado';
  const [saleModality, setSaleModality] = useState<SaleModality>('contado');

  // Datos del cliente (DNI primero)
  const [client, setClient] = useState({
    dni: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [clientType, setClientType] = useState<'registered' | 'new'>('registered');
  const [dniLookupState, setDniLookupState] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle');

  const queryClient = useQueryClient();

  // --- CART HANDLERS ---
  const addItem = () => setItems(prev => [...prev, { id: crypto.randomUUID(), product_id: '', quantity: '1' }]);
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id: string, field: 'product_id' | 'quantity', value: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  // Auto-buscar cliente por DNI en customer_profiles
  const handleDniBlur = useCallback(async () => {
    const dni = client.dni.trim();
    if (!dni || dni.length < 4) return;
    setDniLookupState('loading');
    try {
      const { data } = await supabase
        .from('customer_profiles')
        .select('full_name, phone, email, address')
        .ilike('dni', `%${dni}%`)
        .limit(1)
        .maybeSingle();
      if (data) {
        setClient(prev => ({
          ...prev,
          name: data.full_name || prev.name,
          phone: data.phone || prev.phone,
          email: data.email || prev.email,
          address: data.address || prev.address,
        }));
        setDniLookupState('found');
      } else {
        setDniLookupState('notfound');
      }
    } catch {
      setDniLookupState('idle');
    }
  }, [client.dni]);

  // --- DERIVED ---
  const resolvedItems = items.map(item => {
    const product = products.find(p => p.id === item.product_id);
    const qty = Math.max(1, parseInt(item.quantity) || 1);
    const subtotalUSD = product ? Number(product.price_usd) * qty : 0;
    const subtotalBS = convertToBS(subtotalUSD);
    return { ...item, product, qty, subtotalUSD, subtotalBS };
  });

  const totalUSD = resolvedItems.reduce((sum, i) => sum + i.subtotalUSD, 0);
  const totalBS = convertToBS(totalUSD);

  const amountReceived = Number(payment.amount_received) || 0;
  const isEfectivo = payment.method === 'efectivo_usd' || payment.method === 'efectivo_bs';

  let changeUSD = 0;
  let changeBS = 0;
  if (isEfectivo && amountReceived > 0) {
    if (payment.method === 'efectivo_usd') {
      changeUSD = Math.max(0, amountReceived - totalUSD);
      changeBS = convertToBS(changeUSD);
    } else {
      changeBS = Math.max(0, amountReceived - totalBS);
      changeUSD = changeBS > 0 && rate > 0 ? changeBS / rate : 0;
    }
  }
  
  const isFinanced = saleModality === 'dos_partes' || saleModality === 'financiamiento' || saleModality === 'fiado';
  const isCreditSale = payment.is_credit || isFinanced;
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

  // --- DERIVED (orders/sales list)
  const existingClients = useMemo(() => {
    const clientsMap = new Map<string, string>();
    sales.forEach(s => {
      if (s.client_name) {
        if (!clientsMap.has(s.client_name) || (!clientsMap.get(s.client_name) && s.client_phone)) {
           clientsMap.set(s.client_name, s.client_phone || '');
        }
      }
    });
    return Array.from(clientsMap.entries()).map(([name, phone]) => ({ name, phone }));
  }, [sales]);

  const filteredSales = sales.filter(s => {
    const matchesSearch = s.product_name.toLowerCase().includes(search.toLowerCase()) || s.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchesModality = saleModalityFilter === 'all' || s.sale_modality === saleModalityFilter;
    return matchesSearch && matchesModality;
  });

  const posReceivables = sales.filter(s => s.payment_status !== 'paid');

  const groupedSales = useMemo(() => {
    const groups: any[] = [];
    filteredSales.forEach(sale => {
      if (groups.length === 0) {
        groups.push({
          id: sale.id,
          client_name: sale.client_name,
          payment_method: sale.payment_method,
          is_credit: sale.is_credit,
          created_at: sale.created_at,
          total_usd: Number(sale.total_usd),
          items: [sale]
        });
      } else {
        const lastGroup = groups[groups.length - 1];
        const timeDiff = Math.abs(new Date(lastGroup.created_at).getTime() - new Date(sale.created_at).getTime());
        
        if (
          lastGroup.client_name === sale.client_name &&
          lastGroup.payment_method === sale.payment_method &&
          timeDiff <= 60000 // Within 1 minute
        ) {
          lastGroup.total_usd += Number(sale.total_usd);
          lastGroup.items.push(sale);
        } else {
          groups.push({
            id: sale.id,
            client_name: sale.client_name,
            payment_method: sale.payment_method,
            is_credit: sale.is_credit,
            created_at: sale.created_at,
            total_usd: Number(sale.total_usd),
            items: [sale]
          });
        }
      }
    });
    return groups;
  }, [filteredSales]);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.customer_name?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customer_email?.toLowerCase().includes(orderSearch.toLowerCase());
    
    const matchesStatus = orderStatusFilter === 'all' ? true : o.status === orderStatusFilter;
    
    let matchesDate = true;
    if (orderDateFilter === 'today') {
      const today = new Date();
      const orderDate = new Date(o.created_at);
      matchesDate = today.toDateString() === orderDate.toDateString();
    } else if (orderDateFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      matchesDate = new Date(o.created_at) >= sevenDaysAgo;
    }

    return matchesSearch && matchesStatus && matchesDate;
  }).sort((a, b) => {
    if (orderSort === 'date_desc') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (orderSort === 'date_asc') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (orderSort === 'total_desc') {
      return Number(b.total_usd) - Number(a.total_usd);
    } else if (orderSort === 'total_asc') {
      return Number(a.total_usd) - Number(b.total_usd);
    }
    return 0;
  });

  // --- HANDLERS ---
  const resetForm = () => {
    setItems([{ id: crypto.randomUUID(), product_id: '', quantity: '1' }]);
    setPayment({ method: '', amount_received: '', is_credit: false });
    setClient({ dni: '', name: '', phone: '', email: '', address: '', notes: '' });
    setDniLookupState('idle');
    setSaleModality('contado');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = resolvedItems.filter(i => i.product);
    if (validItems.length === 0) return;
    setIsSubmitting(true);

    const { sanitizeText } = await import('@/lib/validations');
    let finalNotes = client.notes;
    if (saleModality === 'contado' && !payment.is_credit && isEfectivo && amountReceived > 0) {
      const currency = payment.method === 'efectivo_usd' ? '$' : 'Bs';
      const changeText = payment.method === 'efectivo_usd' ? `$${changeUSD.toFixed(2)}` : `Bs ${changeBS.toFixed(2)}`;
      const exchangeText = rate > 0 ? ` (Tasa: Bs ${rate.toFixed(2)})` : '';
      const receiptInfo = `[Recibido: ${currency}${amountReceived.toFixed(2)} | Vuelto: ${changeText}${exchangeText}]`;
      finalNotes = finalNotes ? `${receiptInfo} - ${finalNotes}` : receiptInfo;
    }

    const creditSurcharge = saleModality === 'financiamiento' ? (pricingConfig?.credit_surcharge_pct || 10) : 0;

    if (saleModality === 'dos_partes') {
      const [cuota1Date] = getNextTwoCutoffDates();
      finalNotes = `[EN 2 PARTES - 50% contado, 50% al ${formatCutoffDate(cuota1Date)}] ${finalNotes || ''}`.trim();
    } else if (saleModality === 'financiamiento') {
      const [c1, c2] = getNextTwoCutoffDates();
      finalNotes = `[FINANCIAMIENTO MANOJITOS +${creditSurcharge}% - Inicial 33%, Cuota 1: ${formatCutoffDate(c1)}, Cuota 2: ${formatCutoffDate(c2)}] ${finalNotes || ''}`.trim();
    } else if (saleModality === 'fiado') {
      const [dueDate] = getNextTwoCutoffDates();
      finalNotes = `[FIADO QUINCENA - 100% al ${formatCutoffDate(dueDate)}] ${finalNotes || ''}`.trim();
    }

    let hasError = false;
    for (const item of validItems) {
      const unitPriceUsd = saleModality === 'financiamiento'
        ? Number(item.product!.price_usd) * (1 + creditSurcharge / 100)
        : Number(item.product!.price_usd);
      const itemTotalUsd = unitPriceUsd * item.qty;
      const itemTotalBs = convertToBS(itemTotalUsd);

      let initialAmountPaid = 0;
      if (saleModality === 'contado') initialAmountPaid = itemTotalUsd;
      else if (saleModality === 'dos_partes') initialAmountPaid = itemTotalUsd / 2;
      else if (saleModality === 'financiamiento') initialAmountPaid = itemTotalUsd / 3;
      else if (saleModality === 'fiado') initialAmountPaid = 0;

      const paymentStatus = initialAmountPaid >= itemTotalUsd ? 'paid' : (initialAmountPaid > 0 ? 'partial' : 'pending');

      const saleData = {
        product_id: item.product_id,
        product_name: item.product!.name,
        quantity: item.qty,
        unit_price_usd: unitPriceUsd,
        total_usd: itemTotalUsd,
        total_bs: itemTotalBs,
        payment_method: payment.method || 'efectivo_usd',
        client_name: client.name ? sanitizeText(client.name) : null,
        client_dni: client.dni ? sanitizeText(client.dni) : null,
        client_email: client.email ? sanitizeText(client.email) : null,
        client_phone: client.phone ? sanitizeText(client.phone) : null,
        client_address: client.address ? sanitizeText(client.address) : null,
        is_credit: isCreditSale,
        sale_modality: saleModality,
        amount_paid: initialAmountPaid,
        payment_status: paymentStatus,
        notes: finalNotes ? sanitizeText(finalNotes) : null,
      };

      const { data, error } = await addSale(saleData);
      if (error) { hasError = true; break; }

      if (data?.id) {
        await confirmSale(data.id);
      }
    }

    setIsSubmitting(false);
    if (!hasError) {
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

      // 2.1 Notificar al cliente según el tipo de entrega
      if (approvedOrder.customer_user_id) {
        const isPickup = approvedOrder.notes?.includes('[RETIRO EN TIENDA]');
        const notifTitle = isPickup ? 'Tu pedido está listo para retirar' : 'Tu pedido fue aprobado';
        const notifMessage = isPickup
          ? 'Pedido aprobado, listo para retirar. Horario de atención: Lunes a Sábado, 9:00am - 6:00pm.'
          : 'Pedido aprobado, tu delivery está siendo coordinado / en vía.';

        await supabase.from('notifications').insert({
          user_id: approvedOrder.customer_user_id,
          title: notifTitle,
          message: notifMessage,
          type: 'success',
          channel: 'internal',
          is_read: false,
          sent_at: new Date().toISOString(),
          metadata: { order_id: orderId },
        });
      }

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
          const montoFinanciado = Math.round((totalUsd * 0.50) * 100) / 100;
          const montoCuota = Math.round((montoFinanciado / 2) * 100) / 100;
          const saldoDeudorNeto = montoFinanciado; // El 50% inicial se asume pagado. Quedan 2 cuotas.

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

          toast.success(`Financiamiento aplicado a ${targetCredit.client_name}: Cargado $${montoFinanciado.toFixed(2)} a crédito (2 cuotas de $${montoCuota.toFixed(2)}).`);
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
          const creditUpdate: Record<string, unknown> = {
            current_balance: newBalance,
            last_payment_date: new Date().toISOString(),
          };

          // Si el saldo queda en 0, limpiar la fecha de vencimiento para desbloquear al cliente
          if (newBalance === 0) {
            creditUpdate.next_due_date = null;
          }

          const { error: updateCreditErr } = await supabase
            .from('credits')
            .update(creditUpdate)
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
              description: `Pago verificado (Pedido #${orderId.substring(0, 8)})`,
            });

          if (txErr) throw txErr;

          toast.success(`Pago a Crédito verificado para ${targetCredit.client_name}: Saldo disminuido en $${abonoAmount.toFixed(2)}. Nuevo saldo: $${newBalance.toFixed(2)}.`);
        } else {
          toast.warning('Se verificó el pago, pero no se encontró la cuenta de crédito asociada.');
        }
      }
      
      // Invalidate queries to refresh UI
      refetchOrders();
      refetchSales();
      refetchProducts();
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['customer-credit'] });
      queryClient.invalidateQueries({ queryKey: ['customer-pending-payments'] });
      
      // 4. Enviar notificación al cliente
      if (approvedOrder?.customer_user_id) {
        const isPickup = approvedOrder.notes?.includes('[RETIRO EN TIENDA]');
        const message = !isPickup 
           ? 'Pedido aprobado, su delivery está siendo coordinado.' 
           : 'Pedido aprobado, debe retirarlo en tienda. Nuestro horario laboral es de Lunes a Sábado, 9:00am - 6:00pm.';
           
        await supabase.from('notifications').insert({
           user_id: approvedOrder.customer_user_id,
           title: 'Pedido Aprobado',
           message: message,
           type: 'success',
           channel: 'internal'
        });

        // Trigger push notification
        supabase.functions.invoke('send-push', {
          body: {
            userId: approvedOrder.customer_user_id,
            title: 'Pedido Aprobado',
            message: message,
            url: '/orders'
          }
        }).catch(console.error);
      }
    } catch (err) {
      console.error('Error approving order:', err);
      toast.error(err instanceof Error ? err.message : 'Error al aprobar el pedido');
    }
  };

  const handleRejectOrder = async () => {
    if (!rejectOrderId) return;
    if (!rejectReason.trim()) {
      toast.error('Debe proporcionar un motivo de rechazo');
      return;
    }

    setIsSubmitting(true);
    try {
      // Find current order notes
      const order = orders.find(o => o.id === rejectOrderId);
      const updatedNotes = order?.notes 
        ? `${order.notes}\n\n[MOTIVO_RECHAZO] ${rejectReason}` 
        : `[MOTIVO_RECHAZO] ${rejectReason}`;

      // Update notes with the reason
      const { error: updateError } = await supabase
        .from('orders')
        .update({ notes: updatedNotes })
        .eq('id', rejectOrderId);
      
      if (updateError) throw updateError;

      // Reject the order
      const { error } = await supabase.rpc('reject_order', { p_order_id: rejectOrderId });
      if (error) throw error;

      toast.success('Pedido rechazado y cancelado ❌');
      
      // Enviar notificacion interna al cliente
      if (order?.customer_user_id) {
        await supabase.from('notifications').insert({
          user_id: order.customer_user_id,
          title: 'Pedido Rechazado',
          message: `Su pedido ha sido rechazado. Motivo: ${rejectReason}`,
          type: 'error',
          channel: 'internal'
        });

        // Trigger push notification
        supabase.functions.invoke('send-push', {
          body: {
            userId: order.customer_user_id,
            title: 'Pedido Rechazado',
            message: `Su pedido ha sido rechazado. Motivo: ${rejectReason}`,
            url: '/orders'
          }
        }).catch(console.error);
      }
      
      setRejectOrderId(null);
      setRejectReason('');
      refetchOrders();
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
    } catch (err) {
      console.error('Error rejecting order:', err);
      toast.error(err instanceof Error ? err.message : 'Error al rechazar el pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!confirm(`¿Marcar este pedido como ${newStatus === 'shipped' ? 'Enviado' : 'Entregado'}?`)) return;

    try {
      const { data: targetOrder } = await supabase
        .from('orders')
        .select('customer_user_id')
        .eq('id', orderId)
        .single();

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      if (targetOrder?.customer_user_id) {
        await supabase.from('notifications').insert({
          user_id: targetOrder.customer_user_id,
          title: newStatus === 'shipped' ? 'Tu pedido fue enviado' : 'Tu pedido fue entregado',
          message: newStatus === 'shipped'
            ? 'Tu pedido está en camino. Te avisaremos cuando llegue.'
            : '¡Tu pedido ha sido entregado! Gracias por tu compra en Manojitos.',
          type: 'success',
          channel: 'internal',
          is_read: false,
          sent_at: new Date().toISOString(),
          metadata: { order_id: orderId },
        });
      }

      toast.success(`Pedido marcado como ${newStatus === 'shipped' ? 'Enviado 🚚' : 'Entregado ✅'}`);
      
      refetchOrders();
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
    } catch (err) {
      console.error('Error updating order status:', err);
      toast.error(err instanceof Error ? err.message : 'Error al actualizar el estado del pedido');
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

        <Tabs value={activeSalesTab} onValueChange={setActiveSalesTab} className="w-full">
          <TabsList className="grid grid-cols-3 max-w-2xl bg-secondary rounded-xl mb-6">
            <TabsTrigger value="ventas" className="rounded-lg">
              <ShoppingCart className="h-4 w-4 mr-2 hidden sm:inline" />
              Ventas
            </TabsTrigger>
            <TabsTrigger value="cuentas-cobrar" className="rounded-lg relative">
              <ClipboardList className="h-4 w-4 mr-2 hidden sm:inline" />
              Cuentas por Cobrar
              {sales.filter(s => s.payment_status !== 'paid').length > 0 && (
                <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full">
                  {sales.filter(s => s.payment_status !== 'paid').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="rounded-lg relative">
              <ClipboardList className="h-4 w-4 mr-2 hidden sm:inline" />
              Pedidos
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
              <div className="flex flex-1 flex-col sm:flex-row gap-2 max-w-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar ventas..."
                    className="pl-10 input-glass rounded-xl w-full"
                  />
                </div>
                <Select value={saleModalityFilter} onValueChange={setSaleModalityFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] input-glass rounded-xl">
                    <SelectValue placeholder="Modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Modalidades</SelectItem>
                    <SelectItem value="contado">Contado</SelectItem>
                    <SelectItem value="fiado">Fiado Quincena</SelectItem>
                    <SelectItem value="dos_partes">En 2 Partes</SelectItem>
                    <SelectItem value="financiamiento">Financiamiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="btn-gold rounded-xl gap-2 w-full sm:w-auto">
                    <Plus className="h-5 w-5" />
                    Nueva Venta
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card border-border/50 w-[95vw] sm:max-w-md mx-auto max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-serif text-2xl">Nueva Venta</DialogTitle>
                  </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {/* ── CARRITO DE PRODUCTOS ── */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Productos *</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addItem}
                          className="gap-1 text-xs"
                        >
                          <BoxAdd className="h-3.5 w-3.5" />
                          Agregar producto
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {items.map((item, idx) => {
                          const ri = resolvedItems[idx];
                          return (
                            <div key={item.id} className="flex items-center gap-2 p-3 rounded-xl bg-secondary/60 border border-border/40">
                              <div className="flex-1 min-w-0">
                                <Select value={item.product_id} onValueChange={v => updateItem(item.id, 'product_id', v)}>
                                  <SelectTrigger className="input-glass rounded-lg text-sm h-9">
                                    <SelectValue placeholder="Seleccionar producto" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {products.filter(p => p.stock > 0).map(p => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name} — ${Number(p.price_usd).toFixed(2)} ({p.stock} uds)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-20 flex-shrink-0">
                                <Input
                                  type="number"
                                  min="1"
                                  max={ri?.product?.stock || 999}
                                  value={item.quantity}
                                  onChange={e => updateItem(item.id, 'quantity', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                                  className="input-glass rounded-lg text-sm h-9 text-center"
                                  placeholder="Cant."
                                />
                              </div>
                              {ri?.product && (
                                <span className="text-xs font-bold text-primary w-16 text-right flex-shrink-0">
                                  ${ri.subtotalUSD.toFixed(2)}
                                </span>
                              )}
                              {items.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                                  onClick={() => removeItem(item.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Total del carrito */}
                      {totalUSD > 0 && (
                        <div className="p-3 rounded-xl bg-secondary/80 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground font-medium">Total USD:</span>
                            <span className="font-bold text-gradient-gold text-lg">${totalUSD.toFixed(2)}</span>
                          </div>
                          {rate > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground text-sm">Total Bs:</span>
                              <span className="font-medium text-sm">{formatBS(totalBS)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── DATOS DEL CLIENTE ── */}
                    <div className="space-y-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
                      <h4 className="font-semibold text-primary flex items-center gap-2 mb-2">
                        <User className="h-4 w-4" />
                        Datos del Cliente
                      </h4>

                      <Tabs value={clientType} onValueChange={(v: any) => { 
                        setClientType(v); 
                        setClient({ dni: '', name: '', phone: '', email: '', address: '', notes: '' }); 
                        setDniLookupState('idle'); 
                      }}>
                        <TabsList className="grid w-full grid-cols-2 mb-4 bg-background/50">
                          <TabsTrigger value="registered">Ya Registrado</TabsTrigger>
                          <TabsTrigger value="new">Cliente Nuevo</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="registered" className="space-y-4">
                          <div className="space-y-1.5">
                            <Label>Buscar por Cédula / RIF *</Label>
                            <div className="relative">
                              <Input
                                value={client.dni}
                                onChange={e => {
                                  setClient(prev => ({ ...prev, dni: e.target.value.replace(/[^0-9VJEG-]/ig, '').toUpperCase().slice(0, 15) }));
                                  setDniLookupState('idle');
                                }}
                                onBlur={handleDniBlur}
                                placeholder="Ej: V-12345678"
                                className="input-glass rounded-xl pr-9"
                              />
                              {dniLookupState === 'loading' && (
                                <Loader className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                              {dniLookupState === 'found' && (
                                <Check className="absolute right-3 top-2.5 h-4 w-4 text-primary" />
                              )}
                            </div>
                            {dniLookupState === 'found' && (
                              <div className="mt-3 p-3 bg-primary/10 rounded-xl border border-primary/20 space-y-1">
                                <p className="font-bold text-primary">{client.name}</p>
                                {(client.phone || client.email) && (
                                  <p className="text-sm text-muted-foreground">
                                    {client.phone} {client.phone && client.email && '•'} {client.email}
                                  </p>
                                )}
                              </div>
                            )}
                            {dniLookupState === 'notfound' && (
                              <p className="text-sm text-destructive font-medium mt-1">Cliente no encontrado. Por favor, regístralo como Cliente Nuevo.</p>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="new" className="space-y-3">
                          <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1.5">
                              <Label>Cédula / RIF</Label>
                              <Input
                                value={client.dni}
                                onChange={e => setClient(prev => ({ ...prev, dni: e.target.value.replace(/[^0-9VJEG-]/ig, '').toUpperCase().slice(0, 15) }))}
                                placeholder="Ej: V-12345678"
                                className="input-glass rounded-xl"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Nombre del cliente *</Label>
                              <Input
                                value={client.name}
                                onChange={e => setClient(prev => ({ ...prev, name: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').slice(0, 50) }))}
                                placeholder="Nombre completo"
                                className="input-glass rounded-xl"
                                required={clientType === 'new'}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label>Teléfono</Label>
                                <Input
                                  value={client.phone}
                                  onChange={e => setClient(prev => ({ ...prev, phone: e.target.value.replace(/[^\+0-9\-\(\)\s]/g, '').slice(0, 20) }))}
                                  placeholder="+584141234567"
                                  className="input-glass rounded-xl"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Email</Label>
                                <Input
                                  type="email"
                                  value={client.email}
                                  onChange={e => setClient(prev => ({ ...prev, email: e.target.value.slice(0, 100) }))}
                                  placeholder="correo@ejemplo.com"
                                  className="input-glass rounded-xl"
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Dirección</Label>
                              <Textarea
                                value={client.address}
                                onChange={e => setClient(prev => ({ ...prev, address: e.target.value.slice(0, 150) }))}
                                placeholder="Dirección completa del cliente..."
                                className="input-glass rounded-xl resize-none h-14"
                              />
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>

                    {true && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Método de pago *</Label>
                          <Select value={payment.method} onValueChange={v => setPayment(prev => ({ ...prev, method: v }))}>
                            <SelectTrigger className="input-glass rounded-xl">
                              <SelectValue placeholder="Seleccionar método" />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentMethods.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {isEfectivo && (
                          <div className="space-y-2 p-4 rounded-xl border border-primary/20 bg-primary/5">
                            <Label className="text-primary font-semibold">
                              Monto Recibido ({payment.method === 'efectivo_usd' ? 'USD' : 'Bs'}) *
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={payment.amount_received}
                              onChange={e => setPayment(prev => ({ ...prev, amount_received: e.target.value.replace(/[^0-9.]/g, '').slice(0, 10) }))}
                              placeholder="0.00"
                              className="input-glass rounded-xl text-lg font-bold"
                              required
                            />
                            {amountReceived > 0 && (
                              <div className="mt-3 p-3 rounded-lg bg-background/50 border border-border/50">
                                <p className="text-sm text-muted-foreground mb-1">Vuelto a entregar:</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-2xl font-bold text-gradient-gold">${changeUSD.toFixed(2)}</span>
                                  {rate > 0 && (
                                    <span className="text-sm font-medium">{formatBS(changeBS)}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── MODALIDAD DE VENTA ── */}
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Modalidad de Venta</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { key: 'contado' as const, label: 'Contado', icon: '🟢', desc: 'Pago completo' },
                          { key: 'dos_partes' as const, label: 'En 2 Partes', icon: '🔵', desc: '50% ahora + 50% al 15/30' },
                          { key: 'financiamiento' as const, label: 'Financiamiento', icon: '🟡', desc: `Inicial 33% + 2 cuotas (+${pricingConfig?.credit_surcharge_pct || 10}%)` },
                          { key: 'fiado' as const, label: 'Fiado Quincena', icon: '🟣', desc: '0% ahora, 100% al 15/30' },
                        ]).map(mod => (
                          <button
                            key={mod.key}
                            type="button"
                            onClick={() => setSaleModality(mod.key)}
                            className={[
                              'p-3 rounded-xl border text-left transition-all text-sm',
                              saleModality === mod.key
                                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                                : 'border-border/40 bg-card/50 hover:border-primary/40',
                            ].join(' ')}
                          >
                            <span className="text-lg">{mod.icon}</span>
                            <p className="font-medium mt-1">{mod.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{mod.desc}</p>
                          </button>
                        ))}
                      </div>

                      {/* Info de cuotas para modalidades de financiamiento */}
                      {saleModality === 'dos_partes' && totalUSD > 0 && (
                        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm space-y-1">
                          <p className="font-semibold text-blue-600 dark:text-blue-400">Resumen: En 2 Partes</p>
                          <p>Pago hoy: <strong>${(totalUSD / 2).toFixed(2)}</strong></p>
                          <p>Pendiente al {formatCutoffDate(getNextTwoCutoffDates()[0])}: <strong>${(totalUSD / 2).toFixed(2)}</strong></p>
                        </div>
                      )}
                      {saleModality === 'financiamiento' && totalUSD > 0 && (() => {
                        const surcharge = pricingConfig?.credit_surcharge_pct || 10;
                        const totalWithSurcharge = totalUSD * (1 + surcharge / 100);
                        const initial = totalWithSurcharge / 3;
                        const installment = (totalWithSurcharge - initial) / 2;
                        const [c1, c2] = getNextTwoCutoffDates();
                        return (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm space-y-1">
                            <p className="font-semibold text-amber-600 dark:text-amber-400">Resumen: Financiamiento Manojitos (+{surcharge}%)</p>
                            <p>Precio total con recargo: <strong>${totalWithSurcharge.toFixed(2)}</strong></p>
                            <p>Inicial hoy (33%): <strong>${initial.toFixed(2)}</strong></p>
                            <p>Cuota 1 ({formatCutoffDate(c1)}): <strong>${installment.toFixed(2)}</strong></p>
                            <p>Cuota 2 ({formatCutoffDate(c2)}): <strong>${installment.toFixed(2)}</strong></p>
                          </div>
                        );
                      })()}
                      {saleModality === 'fiado' && totalUSD > 0 && (
                        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-sm space-y-1">
                          <p className="font-semibold text-purple-600 dark:text-purple-400">Resumen: Fiado Quincena</p>
                          <p>Pago hoy: <strong>$0.00</strong></p>
                          <p>Pendiente total al {formatCutoffDate(getNextTwoCutoffDates()[0])}: <strong>${totalUSD.toFixed(2)}</strong></p>
                        </div>
                      )}
                    </div>

                    {/* ── NOTAS ── */}
                    <div className="space-y-2">
                      <Label>Notas</Label>
                      <Textarea
                        value={client.notes}
                        onChange={e => setClient(prev => ({ ...prev, notes: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s.,()-]/g, '').slice(0, 200) }))}
                        placeholder="Observaciones..."
                        className="input-glass rounded-xl resize-none"
                        rows={2}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full btn-gold rounded-xl"
                      disabled={
                        isSubmitting ||
                        resolvedItems.filter(i => i.product).length === 0 ||
                        (!isCreditSale && !payment.method) ||
                        (clientType === 'registered' && !client.name)
                      }
                    >
                      {isSubmitting ? (
                        <><Loader className="h-4 w-4 mr-2 animate-spin" />Registrando...</>
                      ) : (
                        `Registrar Venta${resolvedItems.filter(i => i.product).length > 1 ? ` (${resolvedItems.filter(i => i.product).length} productos)` : ''}`
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {groupedSales.map((group, index) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Card className="glass-card border-border/50 hover:shadow-md transition-all duration-300">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/10 pb-3 mb-3">
                        <div>
                          {group.client_name && (
                            <p className="font-semibold text-lg flex items-center gap-2">
                              <User className="h-4 w-4 text-primary" />
                              {group.client_name}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(group.created_at).toLocaleDateString('es-VE', {
                              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                          <div className="text-right flex-1 sm:flex-initial">
                            <p className="font-bold text-xl text-gradient-gold">${group.total_usd.toFixed(2)}</p>
                            <Badge variant={group.is_credit ? 'destructive' : 'secondary'} className="mt-1">
                              {group.is_credit ? 'Por Cobrar' : formatPaymentMethod(group.payment_method)}
                            </Badge>
                          </div>
                          {group.items.length === 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(group.items[0].id)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full flex-shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {group.items.map((sale: any) => {
                          const product = products.find(p => p.id === sale.product_id);
                          return (
                            <div key={sale.id} className="flex justify-between items-center py-1.5 group/item">
                              <div className="flex items-center gap-3">
                                {product?.image_url ? (
                                  <img src={product.image_url} alt={sale.product_name} className="w-10 h-10 rounded-lg object-cover ring-1 ring-border/50" />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                                    <ShoppingCart className="h-5 w-5 text-primary" />
                                  </div>
                                )}
                                <div className="text-left">
                                  <p className="font-medium text-sm leading-tight">{sale.product_name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {sale.quantity} x ${Number(sale.unit_price_usd).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-sm">${Number(sale.total_usd).toFixed(2)}</span>
                                {group.items.length > 1 && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDelete(sale.id)}
                                    className="h-7 w-7 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {groupedSales.length === 0 && (
                <div className="text-center py-16">
                  <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay ventas registradas</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB: CUENTAS POR COBRAR */}
          <TabsContent value="cuentas-cobrar" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div>
                <h2 className="text-xl font-bold">Cuentas por Cobrar (Caja)</h2>
                <p className="text-sm text-muted-foreground">Ventas pendientes de pago (Fiado, 2 Partes, Financiamiento)</p>
              </div>
            </div>

            {posReceivables.length === 0 ? (
              <div className="text-center py-16">
                <TickCircle className="h-16 w-16 text-green-500/50 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium text-lg">Todo está al día</p>
                <p className="text-muted-foreground text-sm">No hay ventas con saldo pendiente</p>
              </div>
            ) : (() => {
              const groups = new Map<string, any>();
              posReceivables.forEach(sale => {
                 const dateStr = new Date(sale.created_at).toLocaleDateString();
                 const key = `${sale.client_name || 'Desconocido'}_${sale.sale_modality}_${dateStr}`;
                 if (!groups.has(key)) {
                   groups.set(key, {
                     id: key,
                     client_name: sale.client_name,
                     sale_modality: sale.sale_modality,
                     created_at: sale.created_at,
                     sales: [],
                     total_usd: 0,
                     amount_paid: 0,
                   });
                 }
                 const group = groups.get(key);
                 group.sales.push(sale);
                 group.total_usd += Number(sale.total_usd || 0);
                 group.amount_paid += Number(sale.amount_paid || 0);
              });
              const groupedReceivables = Array.from(groups.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              return (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {groupedReceivables.map(group => {
                    const pendingAmount = group.total_usd - group.amount_paid;
                    const isPartial = group.amount_paid > 0 && group.amount_paid < group.total_usd;
                  
                  return (
                    <Card key={group.id} className="glass-card overflow-hidden">
                      <div className={`h-1.5 w-full ${group.sale_modality === 'fiado' ? 'bg-purple-500' : group.sale_modality === 'dos_partes' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold flex items-center gap-1.5">
                              <User className="h-4 w-4 text-primary" />
                              {group.client_name || 'Cliente sin nombre'}
                            </p>
                            <Badge variant="outline" className="mt-1 capitalize">
                              {group.sale_modality?.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Deuda Total</p>
                            <p className="font-bold text-lg text-destructive">${pendingAmount.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {group.sales.map((sale: any) => (
                            <div key={sale.id} className="bg-secondary/50 rounded-lg p-2 text-sm flex justify-between items-center">
                              <span className="text-muted-foreground truncate flex-1" title={sale.product_name}>
                                {sale.product_name} x{sale.quantity}
                              </span>
                              <span className="font-medium ml-2">${Number(sale.total_usd).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/10 pt-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(group.created_at).toLocaleDateString()}
                          </span>
                          <span>Pagado: ${Number(group.amount_paid).toFixed(2)}</span>
                        </div>

                        <Button 
                          className="w-full mt-2" 
                          variant={isPartial ? "default" : "secondary"}
                          onClick={async () => {
                            if (confirm(`¿Marcar la deuda total de $${pendingAmount.toFixed(2)} como pagada en su totalidad?`)) {
                              for (const sale of group.sales) {
                                const salePending = Number(sale.total_usd) - Number(sale.amount_paid || 0);
                                if (salePending > 0) {
                                  await registerSalePayment({ saleId: sale.id, amount: salePending, isFullPayment: true });
                                }
                              }
                            }
                          }}
                        >
                          <TickCircle className="h-4 w-4 mr-2" />
                          Marcar todo como Pagado
                        </Button>
                      </CardContent>
                    </Card>
                  );
                  })}
                </div>
              );
            })()}
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

              <div className="flex flex-wrap gap-2 w-full md:w-auto md:flex-nowrap">
                <Select value={orderDateFilter} onValueChange={setOrderDateFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] input-glass rounded-xl">
                    <SelectValue placeholder="Fecha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las fechas</SelectItem>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="7days">Últimos 7 días</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] input-glass rounded-xl">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="confirmed">Aprobados</SelectItem>
                    <SelectItem value="shipped">Enviados</SelectItem>
                    <SelectItem value="delivered">Entregados</SelectItem>
                    <SelectItem value="cancelled">Rechazados</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={orderSort} onValueChange={setOrderSort}>
                  <SelectTrigger className="w-full sm:w-[160px] input-glass rounded-xl">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Más recientes</SelectItem>
                    <SelectItem value="date_asc">Más antiguos</SelectItem>
                    <SelectItem value="total_desc">Mayor total</SelectItem>
                    <SelectItem value="total_asc">Menor total</SelectItem>
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
                                  (order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered') ? 'default' : 'destructive'
                                } className={
                                  order.status === 'shipped' ? 'bg-primary/80 hover:bg-primary text-primary-foreground' :
                                  order.status === 'delivered' ? 'bg-green-600 hover:bg-green-700 text-white' : ''
                                }>
                                  {order.status === 'pending' ? 'Pendiente' : 
                                   order.status === 'confirmed' ? 'Aprobado' : 
                                   order.status === 'shipped' ? 'Enviado' :
                                   order.status === 'delivered' ? 'Entregado' : 'Rechazado'}
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
                                  <Mailbox className="h-4 w-4" />
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
                                  <span className="text-sm text-muted-foreground font-medium">/ {formatBS(Number(order.total_bs))}</span>
                                )}
                              </div>
                              
                              <div className="bg-primary/10 border-2 border-primary/20 rounded-xl p-4 shadow-sm space-y-4">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 border-b border-primary/10 pb-2">
                                    <CreditCard className="h-5 w-5 text-primary" />
                                    <span className="text-sm text-foreground font-semibold uppercase tracking-wider">Información de Pago</span>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <p className="text-lg font-bold text-primary capitalize">
                                      {order.payment_method.replace('_', ' ')}
                                    </p>
                                    {order.payment_method === 'pago_movil' && order.banco_origen && (
                                      <div className="flex flex-col gap-2 mt-1 bg-background/50 p-3 rounded-lg border border-border/50">
                                        <div className="flex items-center gap-2">
                                          <Bank className="h-4 w-4 text-muted-foreground" />
                                          <span className="text-sm text-muted-foreground font-medium w-16">Banco:</span>
                                          <span className="font-semibold text-foreground">{order.banco_origen}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <FileText className="h-4 w-4 text-muted-foreground" />
                                          <span className="text-sm text-muted-foreground font-medium w-16">Referencia:</span>
                                          <span className="font-bold text-accent bg-accent/10 px-2 py-0.5 rounded text-sm tracking-widest border border-accent/20">
                                            {order.numero_referencia}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {order.notes && (
                                  <div className="pt-3 border-t border-primary/10">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Location className="h-4 w-4 text-primary" />
                                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notas / Dirección</p>
                                    </div>
                                    {renderOrderNotes(order.notes)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {order.status === 'pending' && (
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                  variant="outline" 
                                  onClick={() => setRejectOrderId(order.id)}
                                  className="border-destructive/30 hover:border-destructive text-destructive hover:bg-destructive/5 rounded-xl flex-1 sm:flex-initial"
                                >
                                  <CloseSquare className="h-4 w-4 mr-2" />
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

                            {order.status === 'confirmed' && (
                              <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                <Button 
                                  onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}
                                  className="bg-primary/90 hover:bg-primary text-white rounded-xl flex-1 sm:flex-initial"
                                >
                                  <Truck className="h-4 w-4 mr-2" />
                                  Marcar como Enviado
                                </Button>
                              </div>
                            )}

                            {order.status === 'shipped' && (
                              <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                <Button 
                                  onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                                  className="bg-green-600 hover:bg-green-700 text-white rounded-xl flex-1 sm:flex-initial"
                                >
                                  <TickCircle className="h-4 w-4 mr-2" />
                                  Marcar como Entregado
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

      {/* Reject Order Dialog */}
      <Dialog open={!!rejectOrderId} onOpenChange={(open) => {
        if (!open) {
          setRejectOrderId(null);
          setRejectReason('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo de Rechazo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject_reason">¿Por qué se rechaza este pedido?</Label>
              <Textarea 
                id="reject_reason" 
                placeholder="Ej. Falta de stock, comprobante inválido..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setRejectOrderId(null); setRejectReason(''); }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectOrder}
              disabled={!rejectReason.trim() || isSubmitting}
            >
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
