import { useQuery } from '@tanstack/react-query';
import { resolveKycUrl } from '@/lib/customerFiles';

/** Enlace para mostrar un documento de verificación (firmado, se renueva antes de vencer). */
export function useKycUrl(value: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ['kyc-url', value],
    queryFn: () => resolveKycUrl(value),
    enabled: !!value,
    staleTime: 1000 * 60 * 50, // el enlace dura 60 min
  });
  return value ? data ?? null : null;
}
