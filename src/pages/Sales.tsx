import { BRAND, BRAND_NAME, BRAND_NAME_UPPER } from '@/config/brand';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { TickCircle, Location, BoxAdd, Truck, Loader, Plus, ShoppingCart, Search, Trash2, Check, CloseSquare, ClipboardList, User, Phone, Mailbox, DollarSign, Calendar, CreditCard, Bank, FileText, Package, Refresh, InfoCircle } from 'reicon-react';
import { getNextTwoCutoffDates, getNextThreeCutoffDates, formatCutoffDate } from '@/lib/cutoffDates';
import { usePricingConfig } from '@/hooks/usePricingConfig';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { useCredits } from '@/hooks/useCredits';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useProductSummary, useProductDebtors } from '@/hooks/useProductSummary';
import { ReturnSaleDialog } from '@/components/sales/ReturnSaleDialog';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBS } from '@/lib/utils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { notifyCustomer } from '@/lib/notify';
import { ProductSummaryTab } from '@/components/sales/ProductSummaryTab';
import { NewSaleDialog } from '@/components/sales/NewSaleDialog';
import { PAYMENT_METHOD_LABELS } from '@/lib/paymentMethodFields';
import { Sale, Product, CheckoutItem, OrderItem, ProductDebtor, SaleStatus, SalePayment, SaleReturnType } from '@/types';

export interface GroupedReceivable {
  id: string;
  client_name: string;
  sale_modality: string;
  payment_method: string;
  total_usd: number;
  amount_paid: number;
  total_bs: number;
  sales: Sale[];
  created_at: string;
}

export interface GroupedSale {
  id: string;
  client_name: string | null;
  payment_method: string;
  is_credit: boolean;
  created_at: string;
  total_usd: number;
  items: Sale[];
}


// Removed hardcoded paymentMethods array

const formatPaymentMethod = (method: string) => {
  if (!method) return '';
  return PAYMENT_METHOD_LABELS[method] || method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
  const [receivableTab, setReceivableTab] = useState('pending');
  const navigate = useNavigate();
  // --- STATE ---
  const { sales, addSale, confirmSale, deleteSale, registerSalePayment, updateSale, updateSalePayment, voidSalePayment, processSaleReturn, refetch: refetchSales } = useSales();
  const { products, refetch: refetchProducts } = useProducts();
  const { rate, convertToBS } = useExchangeRate();
  const { methods: activePaymentMethods } = usePaymentMethods(false);
  const { config: pricingConfig } = usePricingConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const confirmDialog = useConfirm();
  // La pestaña vive en la URL (?tab=) para que los enlaces del panel abran la correcta
  const SALES_TABS = ['ventas', 'cuentas-cobrar', 'pedidos', 'resumen-producto'];
  const tabParam = searchParams.get('tab') || 'ventas';
  const activeSalesTab = SALES_TABS.includes(tabParam) ? tabParam : 'ventas';
  const setActiveSalesTab = (tab: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'ventas') next.delete('tab'); else next.set('tab', tab);
      return next;
    }, { replace: true });
  };
  const [isOpen, setIsOpen] = useState(false);
  // Acceso directo desde el panel: /sales?nueva=1 abre la nueva venta
  useEffect(() => {
    if (searchParams.get('nueva') === '1') {
      setIsOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('nueva');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [search, setSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderDateFilter, setOrderDateFilter] = useState('all');
  const [orderSort, setOrderSort] = useState('date_desc');
  const [saleModalityFilter, setSaleModalityFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [abonoGroup, setAbonoGroup] = useState<GroupedReceivable | null>(null);
  const [returnGroup, setReturnGroup] = useState<GroupedSale | null>(null);
  const [abonoAmount, setAbonoAmount] = useState<string>(''); // amount in USD
  const [abonoAmountBs, setAbonoAmountBs] = useState<string>('');
  const [abonoExchangeRate, setAbonoExchangeRate] = useState<string>('');
  const [abonoUsdtRate, setAbonoUsdtRate] = useState<string>('');
  const [abonoUsdtBought, setAbonoUsdtBought] = useState<string>('');
  const [abonoPaymentMethod, setAbonoPaymentMethod] = useState<string>('pago_movil');
  const [abonoNotes, setAbonoNotes] = useState<string>('');

  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editSaleForm, setEditSaleForm] = useState({
    amount_paid: '',
    total_usd: '',
    total_bs: '',
  });

  const [editingPayment, setEditingPayment] = useState<SalePayment | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
    amount_usd: '',
    amount_bs: '',
    exchange_rate: '',
    payment_method: '',
    notes: '',
  });

  const [detailsGroup, setDetailsGroup] = useState<GroupedSale | null>(null);
  const [groupPayments, setGroupPayments] = useState<SalePayment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  const loadGroupPayments = async (group: GroupedSale) => {
    setIsLoadingPayments(true);
    try {
      // The account identity is the sale_group_id (= group.id). Callers may pass
      // a grouped-receivable shape (lines stored under `.sales`) or a grouped-sale
      // shape (`.items`); support both so the history is never lost, and always
      // resolve payments by sale_group_id first (with a sale_id fallback).
      const groupRef = group as unknown as { id: string; items?: Sale[]; sales?: Sale[] };
      const items: Sale[] = groupRef.items ?? groupRef.sales ?? [];
      const saleIds = items.map((s) => s.id).filter(Boolean);
      const orFilters = [`sale_group_id.eq.${groupRef.id}`];
      if (saleIds.length > 0) orFilters.push(`sale_id.in.(${saleIds.join(',')})`);

      const { data, error } = await supabase
        .from('sale_payments')
        .select('*')
        .or(orFilters.join(','))
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroupPayments((data || []) as SalePayment[]);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;
    setIsSubmitting(true);
    try {
      await updateSale({
        id: editingSale.id,
        updates: {
          total_usd: Number(editSaleForm.total_usd) || 0,
          total_bs: Number(editSaleForm.total_bs) || 0,
        }
      });
      setEditingSale(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoidPayment = async (paymentId: string) => {
    if (!(await confirmDialog({ title: '¿Anular este abono?', description: 'El saldo de la cuenta se recalculará automáticamente.', confirmText: 'Anular abono', destructive: true }))) {
      return;
    }
    setIsSubmitting(true);
    try {
      await voidSalePayment(paymentId);
      if (detailsGroup) {
        await loadGroupPayments(detailsGroup);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;
    setIsSubmitting(true);
    try {
      await updateSalePayment({
        id: editingPayment.id,
        updates: {
          amount_usd: Number(editPaymentForm.amount_usd) || 0,
          amount_bs: Number(editPaymentForm.amount_bs) || null,
          exchange_rate: Number(editPaymentForm.exchange_rate) || null,
          payment_method: editPaymentForm.payment_method,
          notes: editPaymentForm.notes,
        }
      });
      if (detailsGroup) {
        await loadGroupPayments(detailsGroup);
      }
      setEditingPayment(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAbonoForm = () => {
    setAbonoGroup(null);
    setAbonoAmount('');
    setAbonoAmountBs('');
    setAbonoExchangeRate('');
    setAbonoUsdtRate('');
    setAbonoUsdtBought('');
    setAbonoPaymentMethod('pago_movil');
    setAbonoNotes('');
  };

  const handleSubmitAbono = async () => {
    if (!abonoGroup) return;
    const amount = Number(abonoAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingrese un monto en USD válido');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await registerSalePayment({ 
        saleGroupId: abonoGroup.id, 
        amountUsd: amount,
        amountBs: abonoAmountBs ? Number(abonoAmountBs) : undefined,
        exchangeRate: abonoExchangeRate ? Number(abonoExchangeRate) : rate,
        usdtRate: abonoUsdtRate ? Number(abonoUsdtRate) : undefined,
        usdtBought: abonoUsdtBought ? Number(abonoUsdtBought) : undefined,
        paymentMethod: abonoPaymentMethod,
        notes: abonoNotes
      });
      toast.success('Abono registrado correctamente');
      resetAbonoForm();
    } catch (error) {
      console.error('Error al registrar abono:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const queryClient = useQueryClient();

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

  const groupedReceivables = useMemo(() => {
    const groups = new Map<string, GroupedReceivable>();
    sales.forEach(sale => {
      const key = sale.sale_group_id || sale.id;
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          client_name: sale.client_name || '',
          sale_modality: sale.sale_modality || '',
          created_at: sale.created_at,
          sales: [],
          total_usd: 0,
          amount_paid: 0,
          total_bs: 0,
          payment_method: sale.payment_method,
        });
      }
      const group = groups.get(key)!;
      group.sales.push(sale);
      group.total_usd += Number(sale.total_usd || 0);
      group.amount_paid += Number(sale.amount_paid || 0);
      group.total_bs += Number(sale.total_bs || 0);
    });

    const allGroups = Array.from(groups.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return allGroups.filter(group => {
      const pendingAmountUsd = group.total_usd - group.amount_paid;
      // Por cobrar si pendingAmountUsd > 0. Pagado si pendingAmountUsd <= 0.
      if (receivableTab === 'paid') return pendingAmountUsd <= 0;
      return pendingAmountUsd > 0;
    });
  }, [sales, receivableTab]);

  const groupedSales = useMemo(() => {
    const groupsMap = new Map<string, GroupedSale>();
    
    filteredSales.forEach(sale => {
      const groupId = sale.sale_group_id || sale.id; 
      
      if (!groupsMap.has(groupId)) {
        groupsMap.set(groupId, {
          id: groupId,
          client_name: sale.client_name,
          payment_method: sale.payment_method,
          is_credit: sale.is_credit,
          created_at: sale.created_at,
          total_usd: Number(sale.total_usd),
          items: [sale]
        });
      } else {
        const group = groupsMap.get(groupId)!;
        group.total_usd += Number(sale.total_usd);
        group.items.push(sale);
      }
    });
    
    // Sort groups by created_at descending
    return Array.from(groupsMap.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
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
  const handleDelete = async (id: string) => {
    if (await confirmDialog({ title: '¿Eliminar esta venta?', description: 'El stock de los productos se devuelve al inventario.', confirmText: 'Eliminar', destructive: true })) {
      await deleteSale(id);
      refetchProducts();
    }
  };

  // Devolución manual: delega íntegramente al RPC `process_sale_return` vía el
  // hook. La UI sólo recopila datos y muestra el resultado real.
  const handleReturn = async (payload: {
    saleGroupId: string;
    items: { sale_id: string; quantity: number }[];
    returnType: SaleReturnType;
    reason: string | null;
    idempotencyKey: string;
  }) => {
    const res = await processSaleReturn(payload);
    // Refrescos adicionales para reflejar stock/CxC al instante.
    refetchProducts();
    refetchSales();
    if (Number(res.refund_due_usd) > 0) {
      toast.success(`Devolución registrada. Reembolso pendiente: $${Number(res.refund_due_usd).toFixed(2)}`);
    } else {
      toast.success('Devolución registrada correctamente 🩷');
    }
    return res;
  };

  const handleApproveOrder = async (orderId: string) => {
    if (!(await confirmDialog({ title: '¿Aprobar este pedido?', description: 'Se descuenta el stock, se registra la venta y se avisa a la clienta por correo.', confirmText: 'Aprobar pedido' }))) return;

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
        const { data: initialCredit, error: creditError } = await supabase
          .from('credits')
          .select('*')
          .eq('client_user_id', approvedOrder.customer_user_id)
          .maybeSingle();
        
        let targetCredit = initialCredit;

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
        const { data: initialCredit, error: creditError } = await supabase
          .from('credits')
          .select('*')
          .eq('client_user_id', approvedOrder.customer_user_id)
          .maybeSingle();

        let targetCredit = initialCredit;

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
      
      // 4. Avisar a la clienta (interno + push + correo)
      const isPickup = approvedOrder.notes?.includes('[RETIRO EN TIENDA]');
      notifyCustomer({
        userId: approvedOrder.customer_user_id,
        email: approvedOrder.customer_email,
        orderId,
        title: isPickup ? 'Tu pedido está listo para retirar' : 'Tu pedido fue confirmado',
        message: isPickup
          ? `Ya puedes pasar a retirarlo. Horario: ${BRAND.hours}.`
          : 'Estamos coordinando tu delivery. Te avisaremos cuando salga.',
        emailAction: 'order_confirmed',
        emailData: { client_name: approvedOrder.customer_name, total_usd: approvedOrder.total_usd, pickup: !!isPickup },
      });
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
      
      // Avisar a la clienta (interno + push + correo)
      notifyCustomer({
        userId: order?.customer_user_id,
        email: order?.customer_email,
        orderId: rejectOrderId,
        type: 'error',
        title: 'Tu pedido fue cancelado',
        message: `Motivo: ${rejectReason}`,
        emailAction: 'order_rejected',
        emailData: { client_name: order?.customer_name, total_usd: order?.total_usd, reason: rejectReason },
      });

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
    if (!(await confirmDialog({ title: `¿Marcar como ${newStatus === 'shipped' ? 'enviado' : 'entregado'}?`, description: 'La clienta recibirá un aviso y un correo.', confirmText: newStatus === 'shipped' ? 'Marcar enviado' : 'Marcar entregado' }))) return;

    try {
      const { data: targetOrder } = await supabase
        .from('orders')
        .select('customer_user_id, customer_email, customer_name, total_usd')
        .eq('id', orderId)
        .single();

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      const shipped = newStatus === 'shipped';
      notifyCustomer({
        userId: targetOrder?.customer_user_id,
        email: targetOrder?.customer_email,
        orderId,
        title: shipped ? 'Tu pedido va en camino' : 'Tu pedido fue entregado',
        message: shipped
          ? 'Tu pedido salió hacia tu dirección. Te avisaremos cuando llegue.'
          : `¡Tu pedido fue entregado! Gracias por comprar en ${BRAND_NAME}.`,
        emailAction: shipped ? 'order_shipped' : 'order_delivered',
        emailData: { client_name: targetOrder?.customer_name, total_usd: targetOrder?.total_usd },
      });

      toast.success(`Pedido marcado como ${newStatus === 'shipped' ? 'Enviado 🚚' : 'Entregado ✅'}`);
      
      refetchOrders();
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
    } catch (err) {
      console.error('Error updating order status:', err);
      toast.error(err instanceof Error ? err.message : 'Error al actualizar el estado del pedido');
    }
  };

  const handleViewDebtorAccount = (debtor: ProductDebtor) => {
    const groupSales = sales.filter(s => s.sale_group_id === debtor.sale_group_id);
    if (groupSales.length > 0) {
      const totalUsd = groupSales.reduce((sum, s) => sum + Number(s.total_usd || 0), 0);
      const totalPaid = groupSales.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);
      // Misma forma que groupedReceivables: el abono necesita el id del grupo (sale_group_id)
      const grouped: GroupedReceivable = {
        id: debtor.sale_group_id,
        client_name: debtor.client_name || 'Desconocido',
        sale_modality: groupSales[0].sale_modality || '',
        payment_method: groupSales[0].payment_method,
        total_usd: totalUsd,
        amount_paid: totalPaid,
        total_bs: groupSales.reduce((sum, s) => sum + Number(s.total_bs || 0), 0),
        sales: groupSales,
        created_at: groupSales[0].created_at
      };

      setActiveSalesTab('cuentas-cobrar');
      setReceivableTab('pending');
      setAbonoGroup(grouped);
    } else {
      toast.error('No se pudo cargar la cuenta. Puede que ya esté pagada o no exista.');
    }
  };

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Ventas y pedidos</h1>
          <p className="page-subtitle">Gestiona las ventas del local y aprueba los pedidos de los clientes</p>
        </div>

        <Tabs value={activeSalesTab} onValueChange={setActiveSalesTab} className="w-full">
          <TabsList className="admin-tabs mb-6">
            <TabsTrigger value="ventas">
              <ShoppingCart className="h-4 w-4 hidden sm:inline" />
              Ventas
            </TabsTrigger>
            <TabsTrigger value="cuentas-cobrar">
              <ClipboardList className="h-4 w-4 hidden sm:inline" />
              Por cobrar
              {sales.filter(s => s.payment_status !== 'paid').length > 0 && (
                <Badge variant="destructive" className="px-1.5 py-0.5 text-[10px] rounded-full">
                  {sales.filter(s => s.payment_status !== 'paid').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pedidos">
              <ClipboardList className="h-4 w-4 hidden sm:inline" />
              Pedidos
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <Badge variant="destructive" className="px-1.5 py-0.5 text-[10px] rounded-full">
                  {orders.filter(o => o.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resumen-producto">
              <Package className="h-4 w-4 hidden sm:inline" />
              Resumen
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

              <Button onClick={() => setIsOpen(true)} className="btn-gold rounded-xl gap-2 w-full sm:w-auto">
                <Plus className="h-5 w-5" />
                Nueva venta
              </Button>
              <NewSaleDialog open={isOpen} onOpenChange={setIsOpen} onCreated={() => refetchProducts()} />
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
                          {group.items.some(s => (Number(s.quantity) - Number(s.returned_quantity || 0)) > 0) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReturnGroup(group)}
                              className="flex-shrink-0 gap-1.5"
                            >
                              <Refresh className="h-4 w-4" />
                              <span className="hidden sm:inline">Devolver</span>
                            </Button>
                          )}
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
                        {group.items.map((sale: Sale) => {
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
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
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
                  <ShoppingCart className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
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
              
              <div className="flex bg-secondary/50 p-1 rounded-xl">
                <Button
                  variant={receivableTab === 'pending' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setReceivableTab('pending')}
                  className={receivableTab === 'pending' ? 'shadow-sm' : ''}
                >
                  Por Cobrar
                </Button>
                <Button
                  variant={receivableTab === 'paid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setReceivableTab('paid')}
                  className={receivableTab === 'paid' ? 'shadow-sm' : ''}
                >
                  Pagadas
                </Button>
              </div>
            </div>

            {groupedReceivables.length === 0 ? (
              <div className="text-center py-16">
                <TickCircle className="h-16 w-16 text-green-500/50 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium text-lg">Todo está al día</p>
                <p className="text-muted-foreground text-sm">No hay ventas con saldo pendiente</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groupedReceivables.map(group => {
                    const pendingAmountUsd = group.total_usd - group.amount_paid;
                    const isPartial = group.amount_paid > 0 && group.amount_paid < group.total_usd;
                    const isBsPayment = ['pago_movil', 'efectivo_bs', 'transferencia', 'credito'].includes(group.payment_method);
                    const remainingBs = group.total_bs ? (group.total_bs * (pendingAmountUsd / group.total_usd)) : 0;
                  
                  return (
                    <Card key={group.id} className="glass-card overflow-hidden">
                      <div className={`h-1.5 w-full ${group.sale_modality === 'fiado' ? 'bg-purple-500' : group.sale_modality === 'dos_partes' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold flex items-center gap-1.5">
                                <User className="h-4 w-4 text-primary" />
                                {group.client_name || 'Cliente sin nombre'}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-primary hover:bg-primary/20 bg-primary/10 rounded-full"
                                onClick={() => {
                                  setDetailsGroup(group);
                                  loadGroupPayments(group);
                                }}
                              >
                                <InfoCircle className="h-3 w-3" />
                              </Button>
                            </div>
                            <Badge variant="outline" className="mt-1 capitalize">
                              {group.sale_modality?.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Deuda Total</p>
                            {isBsPayment && group.total_bs > 0 ? (
                              <>
                                <p className="font-bold text-lg text-destructive">{formatBS(remainingBs)}</p>
                                <p className="text-xs text-muted-foreground">${pendingAmountUsd.toFixed(2)}</p>
                              </>
                            ) : (
                              <p className="font-bold text-lg text-destructive">${pendingAmountUsd.toFixed(2)}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          {group.sales.map((sale: Sale) => (
                            <div key={sale.id} className="bg-secondary/50 rounded-lg p-2 text-sm flex justify-between items-center group/sale">
                              <span className="text-muted-foreground truncate flex-1" title={sale.product_name}>
                                {sale.product_name} x{sale.quantity}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium ml-2">${Number(sale.total_usd).toFixed(2)}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 py-0 text-xs text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                                  onClick={() => {
                                    setEditingSale(sale);
                                    setEditSaleForm({
                                      amount_paid: sale.amount_paid ? String(sale.amount_paid) : '0',
                                      total_usd: sale.total_usd ? String(sale.total_usd) : '0',
                                      total_bs: sale.total_bs ? String(sale.total_bs) : '0',
                                    });
                                  }}
                                >
                                  Editar
                                </Button>
                              </div>
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

                        {/* Solo permitir abonar / marcar pagado si aún hay saldo.
                            Una cuenta saldada (pendingAmountUsd <= 0) no debe poder
                            recibir más abonos ni volver a marcarse como pagada. */}
                        {pendingAmountUsd > 0.005 ? (
                          <div className="flex gap-2 w-full mt-2">
                            <Button
                              className="flex-1"
                              variant="outline"
                              onClick={() => {
                                setAbonoGroup(group);
                                setAbonoAmount('');
                              }}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              Reportar Abono
                            </Button>
                            <Button
                              className="flex-1"
                              variant={isPartial ? "default" : "secondary"}
                              onClick={async () => {
                                if (await confirmDialog({ title: '¿Saldar la deuda completa?', description: `Se registrará un pago de $${pendingAmountUsd.toFixed(2)} y la cuenta quedará pagada.`, confirmText: 'Saldar deuda' })) {
                                  await registerSalePayment({
                                    saleGroupId: group.id,
                                    amountUsd: pendingAmountUsd,
                                    paymentMethod: group.payment_method || 'pago_movil'
                                  });
                                }
                              }}
                            >
                              <TickCircle className="h-4 w-4 mr-2" />
                              Marcar Pagado
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 w-full mt-2 py-2 rounded-lg bg-green-500/10 text-green-600 dark:text-green-500 text-sm font-medium">
                            <TickCircle className="h-4 w-4" />
                            Cuenta pagada
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                  })}
              </div>
            )}
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
                <ClipboardList className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
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
                              {items.map((item: OrderItem, idx: number) => (
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

          {/* TAB: RESUMEN POR PRODUCTO */}
          <TabsContent value="resumen-producto" className="space-y-6">
            <ProductSummaryTab onViewDebtorAccount={handleViewDebtorAccount} />
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

      {/* Abono Dialog */}
      {/* Modal de devolución manual (delega en RPC process_sale_return) */}
      <ReturnSaleDialog
        group={returnGroup}
        onOpenChange={(open) => { if (!open) setReturnGroup(null); }}
        onSubmit={handleReturn}
      />

      <Dialog open={!!abonoGroup} onOpenChange={(open) => {
        if (!open) resetAbonoForm();
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reportar Abono</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            
            <div className="space-y-2">
              <Label>Método de Pago del Abono</Label>
              <Select value={abonoPaymentMethod} onValueChange={setAbonoPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione el método de pago" />
                </SelectTrigger>
                <SelectContent>
                  {activePaymentMethods.map(m => (
                    <SelectItem key={m.method_key} value={m.method_key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Monto a descontar de la deuda (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  className="pl-9 font-bold text-primary"
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(e.target.value)}
                />
              </div>
              {abonoGroup && (
                <p className="text-xs text-muted-foreground">
                  Deuda pendiente actual: ${(abonoGroup.total_usd - abonoGroup.amount_paid).toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Monto real cobrado (Bolívares o Moneda Local)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Opcional. Ej. 500"
                value={abonoAmountBs}
                onChange={(e) => setAbonoAmountBs(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tasa de Cobro</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={rate.toString()}
                  value={abonoExchangeRate}
                  onChange={(e) => setAbonoExchangeRate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tasa de Compra USDT</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Opcional"
                  value={abonoUsdtRate}
                  onChange={(e) => setAbonoUsdtRate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>USDT Comprados (Opcional)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Opcional"
                value={abonoUsdtBought}
                onChange={(e) => setAbonoUsdtBought(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas Adicionales</Label>
              <Input
                placeholder="Referencia o detalles del pago"
                value={abonoNotes}
                onChange={(e) => setAbonoNotes(e.target.value)}
              />
            </div>

          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={resetAbonoForm}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmitAbono}
              disabled={!abonoAmount || Number(abonoAmount) <= 0 || isSubmitting}
              className="btn-gold"
            >
              Confirmar Abono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL EDITAR VENTA */}
      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Venta / Cuenta por Cobrar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Deuda Total USD</Label>
              <Input
                type="number"
                step="0.01"
                value={editSaleForm.total_usd}
                onChange={(e) => setEditSaleForm(prev => ({ ...prev, total_usd: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Deuda Total Bs</Label>
              <Input
                type="number"
                step="0.01"
                value={editSaleForm.total_bs}
                onChange={(e) => setEditSaleForm(prev => ({ ...prev, total_bs: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSale(null)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateSale} disabled={isSubmitting} className="btn-gold">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL HISTORIAL DE ABONOS */}
      <Dialog open={!!detailsGroup} onOpenChange={(open) => !open && setDetailsGroup(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Historial de Abonos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {isLoadingPayments ? (
              <div className="flex justify-center p-4">
                <Loader className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : groupPayments.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">No hay abonos registrados en el historial para esta cuenta.</p>
            ) : (
              <div className="space-y-3">
                {groupPayments.map(payment => (
                  <div key={payment.id} className="bg-secondary/50 rounded-lg p-3 border border-border/50 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-gradient-gold">${Number(payment.amount_usd).toFixed(2)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleDateString()} {new Date(payment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        {payment.status === 'void' ? (
                          <Badge variant="destructive" className="text-[10px] scale-90">Anulado</Badge>
                        ) : (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-primary hover:bg-primary/20"
                              onClick={() => {
                                setEditingPayment(payment);
                                setEditPaymentForm({
                                  amount_usd: String(payment.amount_usd),
                                  amount_bs: payment.amount_bs ? String(payment.amount_bs) : '',
                                  exchange_rate: payment.exchange_rate ? String(payment.exchange_rate) : '',
                                  payment_method: payment.payment_method,
                                  notes: payment.notes || ''
                                });
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-destructive hover:bg-destructive/20"
                              onClick={() => handleVoidPayment(payment.id)}
                              disabled={isSubmitting}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {payment.amount_bs > 0 && (
                      <p className="text-xs text-muted-foreground mb-1">
                        Bolívares: {formatBS(payment.amount_bs)} (Tasa: {payment.exchange_rate})
                      </p>
                    )}
                    {payment.usdt_bought > 0 && (
                      <p className="text-xs text-muted-foreground mb-1">
                        USDT Comprados: {payment.usdt_bought} (Tasa: {payment.usdt_rate})
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {payment.payment_method.replace('_', ' ')}
                      </Badge>
                      {payment.notes && <span className="text-xs text-muted-foreground truncate">{payment.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsGroup(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Abono</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Monto USD</Label>
              <Input
                type="number"
                step="0.01"
                value={editPaymentForm.amount_usd}
                onChange={(e) => setEditPaymentForm(prev => ({ ...prev, amount_usd: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto Bs</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPaymentForm.amount_bs}
                  onChange={(e) => setEditPaymentForm(prev => ({ ...prev, amount_bs: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tasa de Cambio</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPaymentForm.exchange_rate}
                  onChange={(e) => setEditPaymentForm(prev => ({ ...prev, exchange_rate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={editPaymentForm.payment_method} onValueChange={v => setEditPaymentForm(prev => ({ ...prev, payment_method: v }))}>
                <SelectTrigger className="input-glass">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input
                value={editPaymentForm.notes}
                onChange={(e) => setEditPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPayment(null)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleUpdatePayment} disabled={isSubmitting} className="btn-gold">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
