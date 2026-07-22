import { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Search, Check, Trash2, Phone, User, DollarSign, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useDebts, Debt } from '@/hooks/useDebts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn, formatBS } from '@/lib/utils';

export default function Debts() {
  // --- STATE ---
  const { pendingDebts, paidDebts, markAsPaid, registerAbono, deleteDebt } = useDebts();
  const { convertToBS, rate } = useExchangeRate();
  const [search, setSearch] = useState('');
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoNotes, setAbonoNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- DERIVED ---

  const filterDebts = (debts: typeof pendingDebts) =>
    debts.filter(d => d.client_name.toLowerCase().includes(search.toLowerCase()));

  const totalPending = pendingDebts.reduce((acc, d) => acc + Number(d.amount_usd), 0);

  // --- HANDLERS ---

  const handleMarkPaid = async (id: string) => {
    if (confirm('¿Marcar esta cuenta como pagada en su totalidad?')) {
      await markAsPaid(id);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta cuenta por cobrar?')) {
      await deleteDebt(id);
    }
  };

  const handleOpenAbono = (debt: Debt) => {
    setSelectedDebt(debt);
    setAbonoAmount('');
    setAbonoNotes('');
  };

  const handleSaveAbono = async () => {
    if (!selectedDebt || !abonoAmount || Number(abonoAmount) <= 0) return;
    
    const amount = Number(abonoAmount);
    // [MODIFICADO]: Eliminado el bloqueo que impedía un abono mayor al saldo.
    // El excedente será procesado y almacenado como saldo a favor en la RPC.
    setIsSubmitting(true);
    try {
      await registerAbono(selectedDebt.id, amount, abonoNotes, rate || undefined);
      setSelectedDebt(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Cuentas por Cobrar</h1>
          <p className="page-subtitle">
            Total pendiente: <span className="text-gradient-gold font-bold">${totalPending.toFixed(2)}</span>
          </p>
        </div>

        <div className="p-4 rounded-xl border border-white/10 bg-secondary/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">💡 ¿Cuentas por Cobrar vs Crédito?</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              Las <strong>Cuentas por Cobrar</strong> corresponden a ventas manuales o físicas facturadas en partes. El <strong>Crédito</strong> (pago en cuotas) se gestiona de forma automatizada por cliente en la pestaña o sección de Clientes / Créditos.
            </p>
          </div>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ''))}
            placeholder="Buscar por cliente..."
            className="pl-10 input-glass rounded-xl"
          />
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="glass-card p-1 rounded-xl">
            <TabsTrigger value="pending" className="rounded-lg data-[state=active]:gradient-primary data-[state=active]:text-white">
              Pendientes ({pendingDebts.length})
            </TabsTrigger>
            <TabsTrigger value="paid" className="rounded-lg data-[state=active]:gradient-primary data-[state=active]:text-white">
              Pagadas ({paidDebts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {filterDebts(pendingDebts).map((debt) => (
              <DebtCard
                key={debt.id}
                debt={debt}
                onMarkPaid={handleMarkPaid}
                onDelete={handleDelete}
                onAbono={handleOpenAbono}
                convertToBS={convertToBS}
              />
            ))}
            {filterDebts(pendingDebts).length === 0 && (
              <div className="text-center py-16">
                <CreditCard className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No hay cuentas por cobrar pendientes</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="paid" className="space-y-3">
            {filterDebts(paidDebts).map((debt) => (
              <DebtCard
                key={debt.id}
                debt={debt}
                showActions={false}
                onMarkPaid={handleMarkPaid}
                onDelete={handleDelete}
                convertToBS={convertToBS}
              />
            ))}
            {filterDebts(paidDebts).length === 0 && (
              <div className="text-center py-16">
                <Check className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No hay cuentas pagadas</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Diálogo para registrar abono parcial */}
      <Dialog open={!!selectedDebt} onOpenChange={(open) => !open && setSelectedDebt(null)}>
        <DialogContent className="glass-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif text-gradient-gold">Registrar Abono</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Ingresa el monto del abono en USD para <strong>{selectedDebt?.client_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {selectedDebt && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 text-sm space-y-1">
                <p className="flex justify-between">
                  <span>Monto original/pendiente:</span>
                  <span className="font-bold text-gradient-gold">${Number(selectedDebt.amount_usd).toFixed(2)}</span>
                </p>
                <p className="flex justify-between text-xs text-muted-foreground">
                  <span>Equivalente en Bs:</span>
                  <span>Bs. {formatBS(convertToBS(Number(selectedDebt.amount_usd)))}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="abono-amount" className="text-sm font-medium">Monto a abonar (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                  <Input
                    id="abono-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={abonoAmount}
                    onChange={(e) => setAbonoAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="pl-7 input-glass rounded-xl font-semibold text-lg"
                  />
                </div>
                {abonoAmount && !isNaN(Number(abonoAmount)) && (
                  <p className="text-xs text-muted-foreground pl-1">
                    Equivalente en Bs: Bs. {formatBS(convertToBS(Number(abonoAmount)))}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="abono-notes" className="text-sm font-medium">Referencia / Método de pago</Label>
                <Input
                  id="abono-notes"
                  value={abonoNotes}
                  onChange={(e) => setAbonoNotes(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s.,()-]/g, ''))}
                  placeholder="Ej: Pago Móvil ref: 123456, Efectivo, etc."
                  className="input-glass rounded-xl"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedDebt(null)}
              className="rounded-xl border-border/60 hover:bg-muted/50"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAbono}
              disabled={isSubmitting || !abonoAmount || Number(abonoAmount) <= 0}
              className="gradient-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Registrar Pago'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

interface DebtCardProps {
  debt: Debt;
  showActions?: boolean;
  onMarkPaid: (id: string) => void;
  onDelete: (id: string) => void;
  onAbono?: (debt: Debt) => void;
  convertToBS: (usd: number) => number;
}

function DebtCard({ debt, showActions = true, onMarkPaid, onDelete, onAbono, convertToBS }: DebtCardProps) {
  // Procesar notas para ver si contienen historial de abonos
  const lines = debt.notes ? debt.notes.split('\n') : [];
  const mainNotes = lines.filter(l => !l.startsWith('[Abono:')).join('\n');
  const abonosLogs = lines.filter(l => l.startsWith('[Abono:'));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass-card border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-2 rounded-lg",
                debt.status === 'paid' ? 'bg-primary/20' : 'bg-gold/20'
              )}>
                <CreditCard className={cn(
                  "h-5 w-5",
                  debt.status === 'paid' ? 'text-primary' : 'text-gold'
                )} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{debt.client_name}</p>
                </div>
                {debt.client_phone && (
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{debt.client_phone}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Creado: {new Date(debt.created_at).toLocaleDateString('es-VE', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                  })}
                </p>
                {mainNotes && <p className="text-xs text-muted-foreground italic mt-1">{mainNotes}</p>}

                {/* Mostrar historial de abonos si existen */}
                {abonosLogs.length > 0 && (
                  <div className="mt-2 pl-2 border-l border-amber-500/30 space-y-1">
                    <p className="text-[10px] text-amber-500 uppercase tracking-wider font-semibold">Historial de abonos:</p>
                    {abonosLogs.map((log, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                        {log.replace(/[\[\]]/g, '')}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-border/30">
              <div className="text-right">
                <p className="font-bold text-gradient-gold text-lg">${Number(debt.amount_usd).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Bs. {formatBS(convertToBS(Number(debt.amount_usd)))}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-1 font-semibold border",
                    debt.status === 'paid'
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  )}
                >
                  {debt.status === 'paid' ? 'Pagado' : 'Pendiente'}
                </Badge>
              </div>
              {showActions && debt.status === 'pending' && (
                <div className="flex items-center gap-1.5">
                  {onAbono && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAbono(debt)}
                      className="h-8 gap-1.5 rounded-lg border-amber-500/30 hover:border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-medium"
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>Abonar</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMarkPaid(debt.id)}
                    className="h-8 gap-1.5 rounded-lg border-emerald-500/30 hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-medium"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Pago Completo</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(debt.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                    title="Eliminar Cuenta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
