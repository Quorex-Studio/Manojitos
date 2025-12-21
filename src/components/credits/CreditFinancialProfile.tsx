// Componente de perfil financiero del cliente con visualización premium
import { motion } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, 
  CreditCard, DollarSign, Calendar, Award,
  Shield, Target, Zap, Clock, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useFinancialProfile, FinancialProfile } from '@/hooks/useFinancialProfile';

interface CreditFinancialProfileProps {
  creditId: string;
  compact?: boolean;
}

export function CreditFinancialProfile({ creditId, compact = false }: CreditFinancialProfileProps) {
  const { profile, clientName, isLoading } = useFinancialProfile(creditId);

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return null;
  }
  const getTrustBadgeColor = () => {
    switch (profile.trustLevel) {
      case 'EXCELENTE': return 'bg-green-500 text-white';
      case 'BUENO': return 'bg-blue-500 text-white';
      case 'REGULAR': return 'bg-yellow-500 text-white';
      case 'RIESGO': return 'bg-orange-500 text-white';
      case 'CRITICO': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getAdjustmentIcon = () => {
    switch (profile.adjustmentSuggestion) {
      case 'increase': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decrease': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'block': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  if (compact) {
    return (
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`text-2xl p-2 rounded-full ${getTrustBadgeColor()}`}>
                {profile.trustEmoji}
              </div>
              <div>
                <p className="font-medium">{clientName}</p>
                <p className="text-sm text-muted-foreground">
                  Score: {profile.trustScore}/100
                </p>
              </div>
            </div>
            <Badge className={getTrustBadgeColor()}>
              {profile.trustLevel}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="font-medium text-green-600">{profile.paymentRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">A tiempo</p>
            </div>
            <div>
              <p className="font-medium">${profile.currentBalance.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Saldo</p>
            </div>
            <div>
              <p className="font-medium">{profile.utilizationRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Uso</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header con score principal */}
      <Card className="glass-card overflow-hidden">
        <div className={`p-4 ${getTrustBadgeColor()}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{profile.trustEmoji}</div>
              <div>
                <h3 className="text-xl font-bold">{clientName}</h3>
                <p className="opacity-90">Perfil Financiero</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold">{profile.trustScore}</p>
              <p className="text-sm opacity-90">Puntos de confianza</p>
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Nivel de confianza</span>
            <Badge className={getTrustBadgeColor()}>{profile.trustLevel}</Badge>
          </div>
          <Progress value={profile.trustScore} className="h-2" />
        </CardContent>
      </Card>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-gold" />
            <p className="text-lg font-bold">${profile.creditLimit.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Límite</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <CreditCard className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">${profile.currentBalance.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Saldo actual</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold">{profile.utilizationRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Uso del límite</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <Shield className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-bold">${profile.availableCredit.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Disponible</p>
          </CardContent>
        </Card>
      </div>

      {/* Historial de pagos */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Comportamiento de Pagos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm">Pagos a tiempo</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-green-600">{profile.onTimePayments}</span>
              <div className="w-20 bg-secondary rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${profile.paymentRate}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Pagos tardíos</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-red-600">{profile.latePayments}</span>
              <div className="w-20 bg-secondary rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full" 
                  style={{ width: `${100 - profile.paymentRate}%` }}
                />
              </div>
            </div>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Promedio días de pago</span>
            </div>
            <span className="font-medium">{profile.avgPaymentDays} días</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Total compras</span>
            </div>
            <span className="font-medium">{profile.totalPurchases}</span>
          </div>
        </CardContent>
      </Card>

      {/* Recomendaciones */}
      {profile.recommendations.length > 0 && (
        <Card className="glass-card border-gold/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-gold" />
              Recomendaciones del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                {getAdjustmentIcon()}
                <span>{rec}</span>
              </div>
            ))}
            {profile.suggestedLimitChange !== 0 && (
              <div className="mt-3 p-3 rounded-lg bg-secondary/50">
                <p className="text-sm font-medium flex items-center gap-2">
                  {profile.suggestedLimitChange > 0 ? (
                    <>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      Sugerencia: Aumentar límite en {profile.suggestedLimitChange}%
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      Sugerencia: Reducir límite en {Math.abs(profile.suggestedLimitChange)}%
                    </>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
