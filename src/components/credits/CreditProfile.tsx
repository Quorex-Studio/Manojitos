// Componente de perfil de crédito profesional
// Muestra trust score, historial, promesas y restricciones
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  User,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldX,
  Award,
  History,
  FileText,
  Loader2,
  ChevronDown,
  Phone,
  Mail,
  Edit,
  Save,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Credit, useCreditTransactions, usePaymentPromises, getRestrictionLabel } from '@/hooks/useCredits';
import { cn } from '@/lib/utils';

// Props del componente
interface CreditProfileProps {
  credit: Credit;
  onAdjustLimit?: (newLimit: number) => void;
  onCreatePromise?: (promise: { promisedAmount: number; promisedDate: string; notes?: string }) => void;
}

// Configuración del semáforo de confianza
const TRUST_LEVEL_CONFIG = {
  CONFIABLE: {
    icon: Shield,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
    label: 'Confiable',
    description: 'Cliente con excelente historial de pagos',
  },
  RIESGO: {
    icon: ShieldAlert,
    color: 'text-gold',
    bgColor: 'bg-gold/10',
    borderColor: 'border-gold/30',
    label: 'En Riesgo',
    description: 'Cliente con algunos atrasos en pagos',
  },
  CRITICO: {
    icon: ShieldX,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    label: 'Crítico',
    description: 'Cliente con historial de morosidad',
  },
};

// Componente de score visual circular
function TrustScoreCircle({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  
  const getScoreColor = (s: number) => {
    if (s >= 70) return '#22c55e';
    if (s >= 40) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/20"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getScoreColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className="text-3xl font-bold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-muted-foreground">de 100</span>
      </div>
    </div>
  );
}

// Componente contador de mora
function MoraCounter({ daysUntilDue, daysOverdue, graceDays }: {
  daysUntilDue: number;
  daysOverdue: number;
  graceDays: number;
}) {
  const inGrace = daysOverdue > 0 && daysOverdue <= graceDays;
  const isOverdue = daysOverdue > graceDays;

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className={cn(
        "p-3 rounded-lg",
        daysUntilDue > 0 ? "bg-primary/10" : "bg-muted/30"
      )}>
        <p className="text-2xl font-bold text-primary">{daysUntilDue}</p>
        <p className="text-xs text-muted-foreground">Días para pagar</p>
      </div>
      <div className={cn(
        "p-3 rounded-lg",
        inGrace ? "bg-gold/10" : "bg-muted/30"
      )}>
        <p className={cn("text-2xl font-bold", inGrace && "text-gold")}>
          {inGrace ? daysOverdue : graceDays}
        </p>
        <p className="text-xs text-muted-foreground">
          {inGrace ? "Días en gracia" : "Días de gracia"}
        </p>
      </div>
      <div className={cn(
        "p-3 rounded-lg",
        isOverdue ? "bg-destructive/10" : "bg-muted/30"
      )}>
        <p className={cn("text-2xl font-bold", isOverdue && "text-destructive")}>
          {isOverdue ? daysOverdue - graceDays : 0}
        </p>
        <p className="text-xs text-muted-foreground">Días vencido</p>
      </div>
    </div>
  );
}

export function CreditProfile({ credit, onAdjustLimit, onCreatePromise }: CreditProfileProps) {
  const { data: transactions = [], isLoading: loadingTx } = useCreditTransactions(credit.id);
  const { promises, isLoading: loadingPromises, fulfillPromise, breakPromise } = usePaymentPromises(credit.id);
  
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [newLimit, setNewLimit] = useState(credit.credit_limit.toString());
  const [isPromiseOpen, setIsPromiseOpen] = useState(false);
  const [promiseData, setPromiseData] = useState({ amount: '', date: '', notes: '' });

  const trustConfig = TRUST_LEVEL_CONFIG[credit.trust_level] || TRUST_LEVEL_CONFIG.CONFIABLE;
  const TrustIcon = trustConfig.icon;

  // Calcular estadísticas de pagos
  const paymentRate = credit.total_purchases > 0 
    ? Math.round((credit.total_paid_on_time / credit.total_purchases) * 100) 
    : 100;

  const handleSaveLimit = () => {
    const limit = parseFloat(newLimit);
    if (!isNaN(limit) && limit >= 0) {
      onAdjustLimit?.(limit);
      setIsEditingLimit(false);
    }
  };

  const handleCreatePromise = () => {
    if (promiseData.amount && promiseData.date) {
      onCreatePromise?.({
        promisedAmount: parseFloat(promiseData.amount),
        promisedDate: promiseData.date,
        notes: promiseData.notes,
      });
      setIsPromiseOpen(false);
      setPromiseData({ amount: '', date: '', notes: '' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con Trust Score */}
      <Card className={cn("border-2", trustConfig.borderColor)}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            {/* Trust Score Circle */}
            <div className="flex flex-col items-center">
              <TrustScoreCircle score={credit.trust_score} />
              <div className={cn(
                "mt-3 px-4 py-2 rounded-full flex items-center gap-2",
                trustConfig.bgColor
              )}>
                <TrustIcon className={cn("h-5 w-5", trustConfig.color)} />
                <span className={cn("font-semibold", trustConfig.color)}>
                  {trustConfig.label}
                </span>
              </div>
            </div>

            {/* Info del cliente */}
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{credit.client_name}</h2>
                <p className="text-muted-foreground">{trustConfig.description}</p>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                {credit.client_phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {credit.client_phone}
                  </span>
                )}
                {credit.client_email && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {credit.client_email}
                  </span>
                )}
              </div>

              {/* Restricciones */}
              {credit.restriction_level > 0 && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-destructive">
                      {getRestrictionLabel(credit.restriction_level)}
                    </span>
                  </div>
                </div>
              )}

              {/* Incentivos para buen pagador */}
              {credit.trust_level === 'CONFIABLE' && credit.early_payment_discount > 0 && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    <span className="text-primary">
                      Descuento por pago puntual: {credit.early_payment_discount}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Saldos */}
            <div className="text-center md:text-right space-y-2">
              <div>
                <p className="text-3xl font-bold">${credit.current_balance.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Saldo pendiente</p>
              </div>
              <div className="flex items-center gap-2 justify-center md:justify-end">
                {isEditingLimit ? (
                  <>
                    <Input
                      type="number"
                      value={newLimit}
                      onChange={e => setNewLimit(e.target.value.replace(/[^0-9.]/g, ''))}
                      className="w-24 h-8"
                    />
                    <Button size="sm" variant="ghost" onClick={handleSaveLimit}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-lg text-muted-foreground">
                      Límite: ${credit.credit_limit.toFixed(2)}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingLimit(true)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              <Progress 
                value={(credit.current_balance / credit.credit_limit) * 100} 
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contador de Mora */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Estado de Pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MoraCounter
            daysUntilDue={credit.daysUntilDue || 0}
            daysOverdue={credit.daysOverdue || 0}
            graceDays={credit.grace_days}
          />
          {credit.next_due_date && (
            <p className="text-center text-sm text-muted-foreground mt-3">
              Próximo vencimiento: {format(new Date(credit.next_due_date), "dd 'de' MMMM, yyyy", { locale: es })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabs con historial */}
      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="stats">Estadísticas</TabsTrigger>
          <TabsTrigger value="transactions">Historial</TabsTrigger>
          <TabsTrigger value="promises">Compromisos</TabsTrigger>
          <TabsTrigger value="history">Pagos</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">{credit.total_purchases}</p>
                <p className="text-xs text-muted-foreground">Compras totales</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">{credit.total_paid_on_time}</p>
                <p className="text-xs text-muted-foreground">Pagos puntuales</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-destructive">{credit.total_paid_late}</p>
                <p className="text-xs text-muted-foreground">Pagos tardíos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{credit.avg_payment_days}</p>
                <p className="text-xs text-muted-foreground">Promedio días pago</p>
              </CardContent>
            </Card>
          </div>

          {/* Barra de tasa de pago puntual */}
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Tasa de pago puntual</span>
                <span className="text-sm font-bold">{paymentRate}%</span>
              </div>
              <Progress value={paymentRate} className="h-3" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {loadingTx ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay transacciones registradas
                </p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {transactions.map(tx => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          {tx.type === 'ABONO' ? (
                            <TrendingDown className="h-5 w-5 text-primary" />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-destructive" />
                          )}
                          <div>
                            <p className="font-medium">{tx.description || tx.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "font-bold",
                            tx.type === 'ABONO' ? "text-primary" : "text-destructive"
                          )}>
                            {tx.type === 'ABONO' ? '-' : '+'}${tx.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Saldo: ${tx.new_balance.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promises" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">Compromisos de Pago</CardTitle>
              <Button size="sm" onClick={() => setIsPromiseOpen(true)}>
                Nuevo Compromiso
              </Button>
            </CardHeader>
            <CardContent>
              {loadingPromises ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : promises.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay compromisos registrados
                </p>
              ) : (
                <div className="space-y-3">
                  {promises.map(promise => (
                    <div
                      key={promise.id}
                      className={cn(
                        "p-4 rounded-lg border",
                        promise.status === 'CUMPLIDA' && "border-primary/30 bg-primary/10",
                        promise.status === 'INCUMPLIDA' && "border-destructive/30 bg-destructive/10",
                        promise.status === 'PENDIENTE' && "border-gold/30 bg-gold/10",
                        promise.status === 'PARCIAL' && "border-primary/20 bg-primary/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">${promise.promised_amount.toFixed(2)}</span>
                            <Badge variant={
                              promise.status === 'CUMPLIDA' ? 'default' :
                              promise.status === 'INCUMPLIDA' ? 'destructive' :
                              'secondary'
                            }>
                              {promise.status}
                            </Badge>
                            {promise.client_accepted && (
                              <Badge variant="outline" className="text-primary">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Aceptado
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Fecha prometida: {format(new Date(promise.promised_date), "dd MMM yyyy", { locale: es })}
                          </p>
                        </div>
                        {promise.status === 'PENDIENTE' && (
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => fulfillPromise.mutate({ 
                                promiseId: promise.id, 
                                amountPaid: promise.promised_amount 
                              })}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Cumplida
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => breakPromise.mutate(promise.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Incumplida
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                {credit.last_payment_date && (
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Último pago</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(credit.last_payment_date), "dd 'de' MMMM, yyyy", { locale: es })}
                        {' - '}
                        {formatDistanceToNow(new Date(credit.last_payment_date), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </p>
                    </div>
                  </div>
                )}
                {credit.last_late_date && (
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium">Último atraso</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(credit.last_late_date), "dd 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Cliente desde</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(credit.created_at), "dd 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para nuevo compromiso */}
      <Dialog open={isPromiseOpen} onOpenChange={setIsPromiseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Compromiso de Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Monto prometido ($)</Label>
              <Input
                type="number"
                value={promiseData.amount}
                onChange={e => setPromiseData(p => ({ ...p, amount: e.target.value.replace(/[^0-9.]/g, '') }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de pago</Label>
              <Input
                type="date"
                value={promiseData.date}
                onChange={e => setPromiseData(p => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input
                value={promiseData.notes}
                onChange={e => setPromiseData(p => ({ ...p, notes: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s.,;()\-]/g, '') }))}
                placeholder="Observaciones..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPromiseOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePromise}>
              Crear Compromiso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
