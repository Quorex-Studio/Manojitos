/**
 * OverdueCreditBanner — Banner flotante para clientes con cuota vencida.
 * Se monta sobre el layout de la tienda (StoreLayout) cuando
 * `calculatedStatus === 'VENCIDO'` o `is_blocked === true`.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CreditCard, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import { useAuth } from '@/hooks/useAuth';

export function OverdueCreditBanner() {
  const { user } = useAuth();
  const { credit, hasCredit, isLoading, hasPendingPayments } = useCustomerCredit();
  const [dismissed, setDismissed] = useState(false);

  // Solo para usuarios autenticados con crédito vencido/bloqueado o con pago pendiente
  const isOverdue =
    hasCredit &&
    credit &&
    (credit.calculatedStatus === 'VENCIDO' || credit.is_blocked || hasPendingPayments);

  if (!user || isLoading || !isOverdue || dismissed) return null;

  const daysOverdue = credit.daysOverdue ?? 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-0 left-0 right-0 z-[9999] shadow-2xl"
      >
        <div className={`bg-gradient-to-r ${hasPendingPayments ? 'from-amber-950 via-amber-900 to-amber-950 border-amber-500/60' : 'from-red-950 via-red-900 to-red-950 border-red-500/60'} border-b-2 px-4 py-3`}>
          <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`p-1.5 rounded-full ${hasPendingPayments ? 'bg-amber-500/20' : 'bg-red-500/20'} flex-shrink-0 mt-0.5`}>
                <AlertTriangle className={`h-4 w-4 ${hasPendingPayments ? 'text-amber-400' : 'text-red-400'}`} />
              </div>
              <div className="min-w-0">
                <p className={`${hasPendingPayments ? 'text-amber-100' : 'text-red-100'} font-semibold text-sm leading-tight`}>
                  {hasPendingPayments ? 'Abono en verificación' : 'Cuota de crédito vencida'}
                  {!hasPendingPayments && daysOverdue > 0 && (
                    <span className="ml-1.5 text-red-300 font-normal">
                      ({daysOverdue} {daysOverdue === 1 ? 'día' : 'días'} de retraso)
                    </span>
                  )}
                </p>
                <p className={`${hasPendingPayments ? 'text-amber-300' : 'text-red-300'} text-xs mt-0.5 leading-relaxed`}>
                  {hasPendingPayments ? 'Tu pago está siendo procesado por el administrador. Tu límite se actualizará pronto.' : 'Tienes pagos pendientes. No puedes realizar nuevas compras hasta regularizar tu cuenta.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 pl-7 sm:pl-0">
              <Link to="/cliente/credito">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-red-500 hover:bg-red-400 text-white border-0 gap-1.5 rounded-full"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Ver mi crédito
                </Button>
              </Link>
              <button
                onClick={() => setDismissed(true)}
                className="text-red-400 hover:text-red-200 transition-colors p-1"
                aria-label="Cerrar aviso"
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
