// Componente de Cliente del Mes
import { motion } from 'framer-motion';
import { Trophy, Star, Medal, Crown, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCustomerOfMonth, CustomerOfMonth } from '@/hooks/useCustomerOfMonth';

export function CustomerOfMonthCard() {
  const { customerOfMonth, topCustomers } = useCustomerOfMonth();

  if (!customerOfMonth) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="glass-card overflow-hidden border-gold/50">
        {/* Header dorado con efecto premium */}
        <div className="relative bg-gradient-to-r from-gold via-amber-400 to-gold p-4">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="flex items-center gap-4"
          >
            <div className="relative">
              <Crown className="h-12 w-12 text-white drop-shadow-lg" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="h-5 w-5 text-white" />
              </motion.div>
            </div>
            <div className="text-white">
              <h3 className="text-xl font-bold">Cliente del Mes</h3>
              <p className="text-sm opacity-90">¡Felicitaciones por tu excelente comportamiento!</p>
            </div>
          </motion.div>
        </div>

        <CardContent className="p-4">
          {/* Ganador */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {customerOfMonth.clientName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold">{customerOfMonth.clientName}</h4>
              <p className="text-sm text-muted-foreground">{customerOfMonth.reason}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {customerOfMonth.badges.map((badge, i) => (
                  <span key={i} className="text-sm">{badge}</span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gold">{customerOfMonth.score}</p>
              <p className="text-xs text-muted-foreground">puntos</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-secondary/30">
            <div className="text-center">
              <p className="text-lg font-bold text-primary">{customerOfMonth.stats.paymentRate.toFixed(0)}%</p>
              <p className="text-[10px] text-muted-foreground">A tiempo</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{customerOfMonth.stats.totalPurchases}</p>
              <p className="text-[10px] text-muted-foreground">Compras</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{customerOfMonth.stats.avgPaymentDays}</p>
              <p className="text-[10px] text-muted-foreground">Días prom.</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gold">{customerOfMonth.stats.consecutiveOnTime}</p>
              <p className="text-[10px] text-muted-foreground">Seguidos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 3 Podium */}
      {topCustomers.length > 1 && (
        <Card className="glass-card mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              Top Clientes del Mes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topCustomers.map((customer, index) => (
              <motion.div
                key={customer.creditId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  index === 0 ? 'bg-gold text-white' :
                  index === 1 ? 'bg-gray-400 text-white' :
                  'bg-gold/20 text-white'
                }`}>
                  {index === 0 ? <Medal className="h-4 w-4" /> :
                   index === 1 ? <Star className="h-4 w-4" /> :
                   <span className="text-sm font-bold">3</span>}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{customer.clientName}</p>
                  <p className="text-xs text-muted-foreground">{customer.badges.join(' ')}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {customer.score} pts
                </Badge>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
