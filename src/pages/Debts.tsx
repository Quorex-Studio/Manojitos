import { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Search, Check, Trash2, Phone, User } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useDebts, Debt } from '@/hooks/useDebts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export default function Debts() {
  // --- STATE ---
  const { pendingDebts, paidDebts, markAsPaid, deleteDebt } = useDebts();
  const { convertToBS } = useExchangeRate();
  const [search, setSearch] = useState('');

  // --- DERIVED ---

  const filterDebts = (debts: typeof pendingDebts) =>
    debts.filter(d => d.client_name.toLowerCase().includes(search.toLowerCase()));

  const totalPending = pendingDebts.reduce((acc, d) => acc + Number(d.amount_usd), 0);

  // --- HANDLERS ---

  const handleMarkPaid = async (id: string) => {
    if (confirm('¿Marcar esta deuda como pagada?')) {
      await markAsPaid(id);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta deuda?')) {
      await deleteDebt(id);
    }
  };



  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Deudas</h1>
          <p className="page-subtitle">
            Total pendiente: <span className="text-gradient-gold font-bold">${totalPending.toFixed(2)}</span>
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
                convertToBS={convertToBS}
              />
            ))}
            {filterDebts(pendingDebts).length === 0 && (
              <div className="text-center py-16">
                <CreditCard className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No hay deudas pendientes</p>
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
                <p className="text-muted-foreground">No hay deudas pagadas</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

interface DebtCardProps {
  debt: Debt;
  showActions?: boolean;
  onMarkPaid: (id: string) => void;
  onDelete: (id: string) => void;
  convertToBS: (usd: number) => number;
}

function DebtCard({ debt, showActions = true, onMarkPaid, onDelete, convertToBS }: DebtCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass-card border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
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
                  {new Date(debt.created_at).toLocaleDateString('es', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </p>
                {debt.notes && <p className="text-xs text-muted-foreground italic mt-1">{debt.notes}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-bold text-gradient-gold">${Number(debt.amount_usd).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Bs. {convertToBS(Number(debt.amount_usd)).toFixed(2)}</p>
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
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onMarkPaid(debt.id)}
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(debt.id)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
