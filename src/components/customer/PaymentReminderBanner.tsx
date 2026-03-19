// Banner de fechas de pago cercanas para clientes
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, AlertCircle, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function PaymentReminderBanner() {
  const { credit, hasCredit } = useCustomerCredit();
  const [dismissed, setDismissed] = useState(false);

  if (!hasCredit || !credit || dismissed) return null;

  const { daysUntilDue, daysOverdue, calculatedStatus } = credit;

  // Solo mostrar si hay algo pendiente
  const shouldShow = credit.current_balance > 0 && (
    calculatedStatus === 'POR_VENCER' ||
    calculatedStatus === 'EN_GRACIA' ||
    calculatedStatus === 'VENCIDO'
  );

  if (!shouldShow) return null;

  let message = '';
  let icon = Calendar;

  const bgClass =
    calculatedStatus === 'POR_VENCER' ? 'bg-gold/10 border-gold/25 text-foreground dark:bg-gold/10 dark:border-gold/25' :
    calculatedStatus === 'EN_GRACIA' ? 'bg-gold/20 border-gold/30 text-foreground dark:bg-gold/20 dark:border-gold/30' :
    calculatedStatus === 'VENCIDO' ? 'bg-destructive/10 border-destructive/30 text-foreground dark:bg-destructive/10 dark:border-destructive/30' :
    'bg-primary/8 border-primary/25 text-foreground dark:bg-primary/10 dark:border-primary/25';

  if (calculatedStatus === 'POR_VENCER') {
    message = `Tu pago vence en ${daysUntilDue} día${daysUntilDue !== 1 ? 's' : ''}. ¡No lo olvides!`;
  } else if (calculatedStatus === 'EN_GRACIA') {
    message = '¡Atención! Tu pago está en periodo de gracia. Evita recargos.';
    icon = AlertTriangle;
  } else if (calculatedStatus === 'VENCIDO') {
    message = 'Tu crédito está vencido. Por favor, regulariza tu situación lo antes posible.';
    icon = AlertCircle;
  } else {
    message = 'Recuerda mantener tus pagos al día para disfrutar de todos tus beneficios.';
  }

  const Icon = icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden"
      >
        <div className={`${bgClass} border px-4 py-3 rounded-lg mb-4`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{message}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-7 text-xs"
              >
                <Link to="/cliente/credito">Ver crédito</Link>
              </Button>
              <button
                onClick={() => setDismissed(true)}
                className="p-1 hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
