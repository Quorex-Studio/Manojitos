// Banner de fechas de pago cercanas para clientes
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, AlertCircle, X } from 'lucide-react';
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
  let bgClass = '';
  let icon = Calendar;

  if (calculatedStatus === 'POR_VENCER') {
    message = `Tu pago vence en ${daysUntilDue} día${daysUntilDue !== 1 ? 's' : ''}. ¡No lo olvides!`;
    bgClass = 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200';
  } else if (calculatedStatus === 'EN_GRACIA') {
    message = `Estás en período de gracia. Paga pronto para mantener tu buen historial 👀`;
    bgClass = 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200';
    icon = AlertCircle;
  } else if (calculatedStatus === 'VENCIDO') {
    message = `Tienes ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''} de mora. Regulariza tu pago para seguir comprando 💪`;
    bgClass = 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200';
    icon = AlertCircle;
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
