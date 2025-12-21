import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  CreditCard, 
  Wallet, 
  Calendar, 
  TrendingDown, 
  TrendingUp,
  Shield,
  ShieldAlert,
  ShieldX,
  Clock,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Award
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { StoreLayout } from '@/components/store/StoreLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const TRUST_CONFIG = {
  CONFIABLE: { icon: Shield, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Confiable' },
  RIESGO: { icon: ShieldAlert, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'En Riesgo' },
  CRITICO: { icon: ShieldX, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Crítico' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVO: { label: 'Activo', color: 'bg-green-500' },
  POR_VENCER: { label: 'Por Vencer', color: 'bg-yellow-500' },
  EN_GRACIA: { label: 'En Período de Gracia', color: 'bg-orange-500' },
  VENCIDO: { label: 'Vencido', color: 'bg-red-500' },
  BLOQUEADO: { label: 'Bloqueado', color: 'bg-gray-500' },
};

export default function CustomerCredit() {
  const { user } = useAuth();
  const { credit, transactions, promises, hasCredit, isLoading } = useCustomerCredit();

  if (!user) {
    return (
      <StoreLayout>
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso requerido</h1>
          <p className="text-muted-foreground mb-6">Debes iniciar sesión para ver tu crédito</p>
          <Link to="/cliente/auth">
            <Button>Iniciar Sesión</Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="container py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  if (!hasCredit) {
    return (
      <StoreLayout>
        <div className="container py-12 max-w-2xl">
          <div className="flex items-center gap-4 mb-8">
            <Link to="/cliente/perfil">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="page-header">Mi Crédito</h1>
          </div>
          <Card className="glass-card text-center py-12">
            <CardContent>
              <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No tienes línea de crédito</h2>
              <p className="text-muted-foreground mb-6">
                Aún no tienes una línea de crédito habilitada. Contacta con la tienda para solicitar una.
              </p>
              <Link to="/tienda">
                <Button>Explorar Tienda</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </StoreLayout>
    );
  }

  const trustConfig = TRUST_CONFIG[credit.trust_level as keyof typeof TRUST_CONFIG] || TRUST_CONFIG.CONFIABLE;
  const TrustIcon = trustConfig.icon;
  const statusConfig = STATUS_CONFIG[credit.calculatedStatus || 'ACTIVO'];
  const usagePercent = (credit.current_balance / credit.credit_limit) * 100;

  return (
    <StoreLayout>
      <div className="container py-8 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link to="/cliente/perfil">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="page-header">Mi Crédito</h1>
              <p className="text-muted-foreground">Estado de tu línea de crédito</p>
            </div>
            <div className={cn("px-4 py-2 rounded-full flex items-center gap-2", trustConfig.bg)}>
              <TrustIcon className={cn("h-5 w-5", trustConfig.color)} />
              <span className={cn("font-semibold", trustConfig.color)}>{trustConfig.label}</span>
            </div>
          </div>

          {/* Tarjeta principal */}
          <Card className="glass-card mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-6">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
                  <p className="text-4xl font-bold">${credit.current_balance.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    de ${credit.credit_limit.toFixed(2)} disponibles
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={cn(statusConfig.color, "text-white mb-2")}>
                    {statusConfig.label}
                  </Badge>
                  {credit.next_due_date && (
                    <p className="text-sm text-muted-foreground flex items-center justify-end gap-1">
                      <Calendar className="h-4 w-4" />
                      Vence: {format(new Date(credit.next_due_date), "dd MMM yyyy", { locale: es })}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Uso del crédito</span>
                  <span>{usagePercent.toFixed(0)}%</span>
                </div>
                <Progress value={usagePercent} className="h-2" />
              </div>
            </div>
          </Card>

          {/* Alertas */}
          {credit.is_blocked && (
            <Card className="mb-6 border-destructive bg-destructive/10">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Crédito Bloqueado</p>
                  <p className="text-sm text-muted-foreground">{credit.blocked_reason || 'Contacta con la tienda'}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {credit.early_payment_discount > 0 && credit.trust_level === 'CONFIABLE' && (
            <Card className="mb-6 border-green-500/30 bg-green-500/10">
              <CardContent className="p-4 flex items-center gap-3">
                <Award className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-600">Descuento por Pago Puntual</p>
                  <p className="text-sm text-muted-foreground">
                    Obtén un {credit.early_payment_discount}% de descuento al pagar antes del vencimiento
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contador de días */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className={cn(credit.daysUntilDue && credit.daysUntilDue > 0 ? "border-green-500/30" : "")}>
              <CardContent className="p-4 text-center">
                <Clock className="h-5 w-5 mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold text-green-600">{credit.daysUntilDue || 0}</p>
                <p className="text-xs text-muted-foreground">Días para pagar</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold">{credit.grace_days}</p>
                <p className="text-xs text-muted-foreground">Días de gracia</p>
              </CardContent>
            </Card>
            <Card className={cn(credit.daysOverdue && credit.daysOverdue > 0 ? "border-red-500/30" : "")}>
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-5 w-5 mx-auto text-red-500 mb-2" />
                <p className="text-2xl font-bold text-red-600">{credit.daysOverdue || 0}</p>
                <p className="text-xs text-muted-foreground">Días vencido</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="transactions" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transactions">Movimientos</TabsTrigger>
              <TabsTrigger value="promises">Compromisos</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Historial de Movimientos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay movimientos registrados
                    </p>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {transactions.map(tx => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                          >
                            <div className="flex items-center gap-3">
                              {tx.type === 'ABONO' ? (
                                <TrendingDown className="h-5 w-5 text-green-500" />
                              ) : (
                                <TrendingUp className="h-5 w-5 text-red-500" />
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
                                tx.type === 'ABONO' ? "text-green-600" : "text-red-600"
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

            <TabsContent value="promises">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Compromisos de Pago</CardTitle>
                  <CardDescription>
                    Acuerdos de pago programados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {promises.length === 0 ? (
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
                            promise.status === 'CUMPLIDA' && "border-green-500/30 bg-green-500/5",
                            promise.status === 'INCUMPLIDA' && "border-red-500/30 bg-red-500/5",
                            promise.status === 'PENDIENTE' && "border-yellow-500/30 bg-yellow-500/5"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                {promise.status === 'CUMPLIDA' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                {promise.status === 'INCUMPLIDA' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                                {promise.status === 'PENDIENTE' && <Clock className="h-4 w-4 text-yellow-500" />}
                                <span className="font-medium">${promise.promised_amount.toFixed(2)}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Fecha: {format(new Date(promise.promised_date), "dd MMM yyyy", { locale: es })}
                              </p>
                            </div>
                            <Badge variant={
                              promise.status === 'CUMPLIDA' ? 'default' :
                              promise.status === 'INCUMPLIDA' ? 'destructive' : 'secondary'
                            }>
                              {promise.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </StoreLayout>
  );
}
