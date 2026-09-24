import { cn } from '@/lib/utils';

export type KycFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'none';

export const KYC_META: Record<Exclude<KycFilter, 'all'>, { label: string; dot: string; chip: string }> = {
  pending: { label: 'Por revisar', dot: 'bg-amber-500', chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  approved: { label: 'Verificada', dot: 'bg-success', chip: 'bg-success/10 text-success' },
  rejected: { label: 'Rechazada', dot: 'bg-destructive', chip: 'bg-destructive/10 text-destructive' },
  none: { label: 'Sin verificar', dot: 'bg-muted-foreground/50', chip: 'bg-muted text-muted-foreground' },
};

export function KycBadge({ status, className }: { status: string; className?: string }) {
  const meta = KYC_META[(status in KYC_META ? status : 'none') as keyof typeof KYC_META];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', meta.chip, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

export const initials = (name?: string | null) =>
  (name || 'Cliente').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/** Enlace de WhatsApp a partir de un teléfono venezolano (+58…, 0414…, 414…). */
export function whatsappLink(phone?: string | null) {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '58' + digits.slice(1);
  else if (digits.length === 10) digits = '58' + digits;
  return `https://wa.me/${digits}`;
}
