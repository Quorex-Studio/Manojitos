import { cn } from '@/lib/utils';
import { BRAND_NAME } from '@/config/brand';
import {
  BRAND_LOGO_LIGHT,
  BRAND_LOGO_DARK,
  BRAND_LOGO_SHOP_LIGHT,
  BRAND_LOGO_SHOP_DARK,
  BRAND_ISOTIPO_LIGHT,
  BRAND_ISOTIPO_DARK,
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
