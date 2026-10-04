import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Ban, Call, Copy, FileText, Gallery, Key, Loader, Location, Mailbox, MessageSquare,
  ShieldAlert, ShoppingBag, TickCircle, Trash2, Unlock, Wallet, XCircle, Clock,
} from 'reicon-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { CustomerProfile } from '@/hooks/useCustomers';
import { KycBadge, initials, whatsappLink } from './customerUi';

type KycStatus = 'approved' | 'rejected' | 'pending';
type AdminAction = 'suspend' | 'restore' | 'delete' | 'change_password';

interface CustomerDetailDialogProps {
  customer: CustomerProfile | null;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (userId: string, status: KycStatus) => Promise<void>;
  isUpdating: boolean;
}

const money = (n: number | string | null | undefined) => `$${Number(n || 0).toFixed(2)}`;
const shortDate = (d: string) => format(new Date(d), 'dd MMM yyyy', { locale: es });

// Compras (pedidos web + ventas de tienda) y línea de crédito del cliente.
function useCustomerHistory(userId: string | undefined, phone: string | null | undefined) {
  return useQuery({
    queryKey: ['admin-customer-history', userId],
    enabled: !!userId,
    queryFn: async () => {
      const ordersQ = supabase
        .from('orders')
        .select('id, created_at, total_usd, status, items')
        .eq('customer_user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(10);
      let salesQ = supabase
        .from('sales')
        .select('id, created_at, total_usd, status, product_name, quantity')
        .order('created_at', { ascending: false })
        .limit(10);
      salesQ = phone ? salesQ.or(`client_phone.eq.${phone},user_id.eq.${userId}`) : salesQ.eq('user_id', userId!);
      const creditQ = supabase.from('credits').select('*').eq('client_user_id', userId!).maybeSingle();
      const [{ data: orders }, { data: sales }, { data: credit }] = await Promise.all([ordersQ, salesQ, creditQ]);

      const purchases = [
        ...(orders || []).map(o => ({
          id: o.id, date: o.created_at, total: Number(o.total_usd), status: o.status,
          label: `Pedido web · ${(o.items as unknown[] | null)?.length || 0} artículos`,
        })),
        ...(sales || []).map(s => ({
          id: s.id, date: s.created_at, total: Number(s.total_usd), status: s.status,
          label: `${s.product_name} ×${s.quantity}`,
        })),
      ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

      return { purchases, credit, spent: purchases.reduce((sum, p) => sum + p.total, 0) };
    },
  });
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', completed: 'Completada', confirmed: 'Confirmada', delivered: 'Entregado',
  cancelled: 'Cancelado', paid: 'Pagado', processing: 'En proceso', shipped: 'Enviado', returned: 'Devuelto',
};

function InfoRow({ icon, label, value, action }: { icon: React.ReactNode; label: string; value: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
      {action}
    </div>
  );
}

function KycPhoto({ url, label }: { url: string | null; label: string }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{label}</figcaption>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="group relative block aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-studio">
          <img src={url} alt={label} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-3 py-1 text-xs font-medium">Ver completa</span>
        </a>
      ) : (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground">
          <Gallery className="h-6 w-6 opacity-40" />
          <span className="text-xs">No enviada</span>
        </div>
      )}
    </figure>
  );
}

export function CustomerDetailDialog({ customer, onOpenChange, onUpdateStatus, isUpdating }: CustomerDetailDialogProps) {
  const confirmDialog = useConfirm();
  const [tab, setTab] = useState('resumen');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: history, isLoading: loadingHistory } = useCustomerHistory(customer?.user_id, customer?.phone);

  // Al abrir otro cliente: pendiente → directo a verificar; si no, al resumen.
  useEffect(() => {
    if (customer) setTab(customer.kyc_status === 'pending' ? 'verificacion' : 'resumen');
    setPassword('');
  }, [customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${what} copiado` });
    } catch { /* sin permiso de portapapeles */ }
  };

  const runAdminAction = async (action: AdminAction) => {
    if (!customer) return;
    if (action === 'change_password' && password.length < 6) {
      toast({ title: 'Contraseña muy corta', description: 'Usa al menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (action === 'delete' && !(await confirmDialog({
      title: `¿Eliminar a ${customer.full_name}?`,
      description: 'Se borran la cuenta y sus datos. No se puede deshacer.',
      confirmText: 'Eliminar cliente', destructive: true,
    }))) return;
    if (action === 'suspend' && !(await confirmDialog({
      title: `¿Suspender a ${customer.full_name}?`,
      description: 'No podrá iniciar sesión hasta que la reactives.',
      confirmText: 'Suspender', destructive: true,
    }))) return;

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action, userId: customer.user_id, newPassword: action === 'change_password' ? password : null },
      });
      if (error || (data && (data as { error?: string }).error)) {
        throw new Error((data as { error?: string } | null)?.error || error?.message || 'No se pudo completar la acción');
      }
      const done: Record<AdminAction, string> = {
        suspend: 'Cuenta suspendida', restore: 'Cuenta reactivada', delete: 'Cliente eliminado', change_password: 'Contraseña actualizada',
      };
      toast({ title: done[action] });
      setPassword('');
      if (action === 'delete') onOpenChange(false);
    } catch (err) {
      toast({ title: 'No se pudo completar', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const status = customer?.kyc_status ?? 'none';
  const credit = history?.credit;

  return (
    <Dialog open={!!customer} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] gap-0 p-0 max-sm:!pb-0 sm:max-w-2xl sm:overflow-hidden">
        {customer && (
          <>
            <DialogHeader className="space-y-4 border-b border-border p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 shrink-0 border border-border">
                  <AvatarImage src={customer.face_photo_url || ''} alt="" className="object-cover" />
                  <AvatarFallback className="bg-primary/10 font-serif text-xl text-primary">{initials(customer.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <DialogTitle className="truncate text-xl sm:text-2xl">{customer.full_name}</DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-2">
                    <KycBadge status={status} />
                    <span className="text-xs">Cliente desde {shortDate(customer.created_at)}</span>
                  </DialogDescription>
                </div>
              </div>
              {/* Contacto directo: lo más usado, al alcance del pulgar */}
              <div className="grid grid-cols-3 gap-2">
                <Button asChild variant="outline" className="h-11 rounded-full" disabled={!customer.phone}>
                  <a href={whatsappLink(customer.phone)} target="_blank" rel="noopener noreferrer"><MessageSquare className="h-4 w-4" />WhatsApp</a>
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-full">
                  <a href={`tel:${customer.phone}`}><Call className="h-4 w-4" />Llamar</a>
                </Button>
                <Button asChild variant="outline" className={cn('h-11 rounded-full', !customer.email && 'pointer-events-none opacity-50')}>
                  <a href={customer.email ? `mailto:${customer.email}` : undefined} aria-disabled={!customer.email}><Mailbox className="h-4 w-4" />Correo</a>
                </Button>
              </div>
            </DialogHeader>

            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-col">
              <div className="border-b border-border px-5 py-3 sm:px-6">
                <TabsList className="admin-tabs">
                  <TabsTrigger value="resumen">Resumen</TabsTrigger>
                  <TabsTrigger value="verificacion">
                    Verificación
                    {status === 'pending' && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="pendiente" />}
                  </TabsTrigger>
                  <TabsTrigger value="compras">Compras</TabsTrigger>
                  <TabsTrigger value="cuenta">Cuenta</TabsTrigger>
                </TabsList>
              </div>

              <div className="sm:max-h-[min(60vh,560px)] sm:overflow-y-auto">
                {/* RESUMEN */}
                <TabsContent value="resumen" className="mt-0 space-y-4 p-5 sm:p-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShoppingBag className="h-3.5 w-3.5" />Compras</p>
                      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{loadingHistory ? '…' : history?.purchases.length ?? 0}</p>
                      <p className="text-xs text-muted-foreground">{loadingHistory ? '' : `${money(history?.spent)} en total`}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" />Crédito</p>
                      {credit ? (
                        <>
                          <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{money(Number(credit.credit_limit) - Number(credit.current_balance))}</p>
                          <p className="text-xs text-muted-foreground">
                            {credit.is_blocked ? 'Bloqueado' : `disponible de ${money(credit.credit_limit)}`}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 font-serif text-2xl font-semibold text-muted-foreground">—</p>
                          <p className="text-xs text-muted-foreground">Sin línea de crédito</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                    <InfoRow
                      icon={<Call />} label="Teléfono" value={customer.phone || 'Sin teléfono'}
                      action={customer.phone && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => copy(customer.phone, 'Teléfono')} aria-label="Copiar teléfono"><Copy className="h-4 w-4" /></Button>
                      )}
                    />
                    <InfoRow icon={<Mailbox />} label="Correo" value={customer.email || 'Sin correo'} />
                    <InfoRow
                      icon={<FileText />} label="Cédula" value={customer.dni || 'Sin cédula'}
                      action={customer.dni && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => copy(customer.dni!, 'Cédula')} aria-label="Copiar cédula"><Copy className="h-4 w-4" /></Button>
                      )}
                    />
                    <InfoRow icon={<Location />} label="Dirección" value={customer.address || 'Sin dirección'} />
                  </div>

                  {status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => setTab('verificacion')}
                      className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left"
                    >
                      <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="flex-1 text-sm"><strong className="font-semibold">Verificación por revisar.</strong> Revisa sus fotos para aprobarla o rechazarla.</span>
                    </button>
                  )}
                </TabsContent>

                {/* VERIFICACIÓN */}
                <TabsContent value="verificacion" className="mt-0 space-y-4 p-5 sm:p-6">
                  {status === 'none' ? (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                      <ShieldAlert className="h-8 w-8 text-muted-foreground/60" />
                      <p className="font-medium">Todavía no envió sus documentos</p>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        Cuando suba la foto de su cédula y la selfie desde su cuenta, aparecerán aquí para que las revises.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Compara la foto de la cédula con la selfie. Si coinciden y se leen bien, aprueba: así podrá pedir crédito.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <KycPhoto url={customer.dni_photo_url} label="Cédula" />
                        <KycPhoto url={customer.verification_photo_url} label="Selfie con cédula" />
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* COMPRAS */}
                <TabsContent value="compras" className="mt-0 p-5 sm:p-6">
                  {loadingHistory ? (
                    <div className="flex justify-center py-10"><Loader className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : !history?.purchases.length ? (
                    <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                      Aún no tiene compras registradas.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                      {history.purchases.map(p => (
                        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.label}</p>
                            <p className="text-xs text-muted-foreground">{shortDate(p.date)} · {STATUS_LABEL[p.status] || p.status}</p>
                          </div>
                          <p className="font-semibold tabular-nums">{money(p.total)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                {/* CUENTA */}
                <TabsContent value="cuenta" className="mt-0 space-y-4 p-5 sm:p-6">
                  <p className="text-sm text-muted-foreground">
                    Solo aplica a clientes que crearon su cuenta en la tienda. Los clientes registrados desde una venta no tienen contraseña.
                  </p>
                  <form
                    className="space-y-2 rounded-2xl border border-border bg-card p-4"
                    onSubmit={e => { e.preventDefault(); runAdminAction('change_password'); }}
                  >
                    <label htmlFor="cd-pass" className="flex items-center gap-2 text-sm font-semibold"><Key className="h-4 w-4" />Cambiar contraseña</label>
                    <input type="text" autoComplete="username" value={customer.email || ''} readOnly hidden />
                    <div className="flex gap-2">
                      <Input id="cd-pass" type="password" autoComplete="new-password" placeholder="Nueva contraseña (mín. 6)" value={password} onChange={e => setPassword(e.target.value)} className="h-11 rounded-xl" />
                      <Button type="submit" variant="secondary" className="h-11 rounded-full" disabled={busy || password.length < 6}>Guardar</Button>
                    </div>
                  </form>

                  <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold"><Ban className="h-4 w-4" />Acceso a la tienda</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="h-11 rounded-full" onClick={() => runAdminAction('suspend')} disabled={busy}><Ban className="h-4 w-4" />Suspender</Button>
                      <Button variant="outline" className="h-11 rounded-full" onClick={() => runAdminAction('restore')} disabled={busy}><Unlock className="h-4 w-4" />Reactivar</Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-destructive">Eliminar cliente</p>
                      <p className="text-xs text-muted-foreground">Borra la cuenta y sus datos. No se puede deshacer.</p>
                    </div>
                    <Button variant="destructive" className="h-11 rounded-full" onClick={() => runAdminAction('delete')} disabled={busy}>
                      <Trash2 className="h-4 w-4" />Eliminar
                    </Button>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            {/* Decisión de verificación: fija abajo mientras se revisan las fotos */}
            {tab === 'verificacion' && status !== 'none' && (
              <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-2 border-t border-border bg-background/95 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:px-6 sm:pb-4">
                {status === 'approved' ? (
                  <>
                    <Button variant="outline" className="h-12 rounded-full" disabled={isUpdating} onClick={() => onUpdateStatus(customer.user_id, 'pending')}>
                      <Clock className="h-4 w-4" />Volver a revisar
                    </Button>
                    <Button variant="outline" className="h-12 rounded-full text-destructive" disabled={isUpdating} onClick={() => onUpdateStatus(customer.user_id, 'rejected')}>
                      <XCircle className="h-4 w-4" />Rechazar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="h-12 rounded-full text-destructive"
                      disabled={isUpdating || status === 'rejected'}
                      onClick={() => onUpdateStatus(customer.user_id, 'rejected')}
                    >
                      <XCircle className="h-4 w-4" />{status === 'rejected' ? 'Rechazada' : 'Rechazar'}
                    </Button>
                    <Button className="h-12 rounded-full" disabled={isUpdating} onClick={() => onUpdateStatus(customer.user_id, 'approved')}>
                      <TickCircle className="h-4 w-4" />Aprobar
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
