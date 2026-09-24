import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bank, Check, Copy, Mobile, Phone } from 'reicon-react';
import { BRAND } from '@/config/brand';
import { paymentConfigEntries } from '@/lib/paymentMethodFields';

// Componente interno: datos de pago de la tienda para el método elegido (cualquier método
// con datos cargados en Configuración → Métodos de pago).
export const PaymentInfoPanel = memo(function PaymentInfoPanel({ method, config, label }: { method: string; config?: Record<string, string>; label?: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => { /* sin permiso */ });
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  const entries = paymentConfigEntries(config);
  if (!method || method === 'credito' || method.startsWith('efectivo')) return null;

  return (
    <motion.div
      key={method}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="mt-5 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        {method === 'pago_movil' ? <Mobile className="h-4 w-4 text-primary" /> : <Bank className="h-4 w-4 text-primary" />}
        <p className="text-sm font-semibold text-foreground">Datos para pagar{label ? ` con ${label}` : ''}</p>
      </div>

      {entries.length > 0 ? (
        <div className="divide-y divide-primary/10">
          {entries.map(({ key, label: fieldLabel, value }) => (
            <div key={key} className="flex items-center gap-3 py-2">
              <span className="w-28 shrink-0 text-xs text-muted-foreground">{fieldLabel}</span>
              <span className="min-w-0 flex-1 break-all text-sm font-semibold text-foreground">{value}</span>
              <button
                type="button"
                onClick={() => copy(value, key)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label={`Copiar ${fieldLabel}`}
              >
                {copied === key ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Al confirmar tu pedido te enviamos los datos de pago por WhatsApp.</p>
      )}

      {BRAND.whatsapp && (
        <div className="mt-3 flex items-center gap-2 border-t border-primary/10 pt-3">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Dudas:</span>
          <span className="text-xs font-semibold text-foreground">{BRAND.whatsapp}</span>
        </div>
      )}
    </motion.div>
  );
});

