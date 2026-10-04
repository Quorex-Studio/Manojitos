import { cn } from '@/lib/utils';
import { BRAND_NAME } from '@/config/brand';
import {
  BRAND_LOGO_LIGHT,
  BRAND_LOGO_DARK,
  BRAND_LOGO_SHOP_LIGHT,
  BRAND_LOGO_SHOP_DARK,
  BRAND_ISOTIPO_LIGHT,
  BRAND_ISOTIPO_DARK,
  BRAND_LOGO_IS_WORDMARK,
} from '@/config/brand-assets';

type Variant = 'logotipo' | 'shop' | 'isotipo';

const SOURCES: Record<Variant, [string, string]> = {
  logotipo: [BRAND_LOGO_LIGHT, BRAND_LOGO_DARK],
  shop: [BRAND_LOGO_SHOP_LIGHT, BRAND_LOGO_SHOP_DARK],
  isotipo: [BRAND_ISOTIPO_LIGHT, BRAND_ISOTIPO_DARK],
};

interface BrandLogoProps {
  variant?: Variant;
  /** Fuerza la versión clara (crema) aunque el tema sea claro, p. ej. sobre fondos vino */
  onDark?: boolean;
  className?: string;
}

// Logo de la marca en su color oficial según el tema: vino en claro, crema en oscuro.
// La guía de marca prohíbe recolorear o aplicar degradados al logo, por eso se usan los PNG.
export function BrandLogo({ variant = 'logotipo', onDark = false, className }: BrandLogoProps) {
  const [light, dark] = SOURCES[variant];
  // Marca con símbolo redondo + nombre en texto (p. ej. Manojitos): la altura de className
  // manda sobre el símbolo y el nombre se escala con ella.
  if (!BRAND_LOGO_IS_WORDMARK) {
    const mark = <img src={light} alt={variant === 'isotipo' ? BRAND_NAME : ''} className={cn('aspect-square w-auto shrink-0 rounded-full object-cover ring-1 ring-gold/20 select-none', className)} draggable={false} />;
    if (variant === 'isotipo') return mark;
    return (
      <span className="inline-flex min-w-0 items-center gap-2" aria-label={BRAND_NAME}>
        {mark}
        <span className={cn('truncate font-serif font-bold leading-none', onDark ? 'text-gold' : 'text-gradient-gold')} style={{ fontSize: '1.35em' }}>
          {BRAND_NAME}
        </span>
      </span>
    );
  }
  if (onDark) {
    return <img src={dark} alt={BRAND_NAME} className={cn('w-auto select-none', className)} draggable={false} />;
  }
  return (
    <>
      <img src={light} alt={BRAND_NAME} className={cn('w-auto select-none dark:hidden', className)} draggable={false} />
      <img src={dark} alt={BRAND_NAME} className={cn('hidden w-auto select-none dark:block', className)} draggable={false} />
    </>
  );
}
