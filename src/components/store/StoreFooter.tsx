import { BRAND, BRAND_INSTAGRAM_URL, BRAND_NAME, BRAND_WHATSAPP_URL } from '@/config/brand';
import { Link } from 'react-router-dom';
import { Location, Instagram, Mailbox, Phone } from 'reicon-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { BRAND_STAR } from '@/config/brand-assets';

const SHOP_LINKS = [
  { to: '/', label: 'Inicio' },
  { to: '/tienda', label: 'Tienda' },
  { to: '/carrito', label: 'Mi carrito' },
  { to: '/cliente/auth', label: 'Mi cuenta' },
];

const HELP_LINKS = [
  { to: '/atencion', label: 'Atención al cliente' },
  { to: '/faq', label: 'Preguntas frecuentes' },
  { to: '/nosotros', label: 'Sobre nosotras' },
  { to: '/envios', label: 'Política de envíos' },
  { to: '/terminos', label: 'Términos y condiciones' },
  { to: '/privacidad', label: 'Política de privacidad' },
];

const linkClass =
  'inline-flex min-h-[32px] items-center text-sm text-cream/70 transition-colors hover:text-nude focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nude rounded';

// Footer de la tienda sobre el vino de marca (manual EINA): logotipo crema, acentos nude.
export function StoreFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-wine text-cream dark:bg-card dark:border-t dark:border-border">
      {/* Estrella de marca como motivo gráfico */}
      <img
        src={BRAND_STAR}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-6 w-64 opacity-[0.12] md:w-96"
      />

      <div className="container relative mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4 lg:gap-12">
          {/* Marca */}
          <div className="col-span-2 space-y-4 lg:col-span-1">
            <BrandLogo onDark className="h-10" />
            <p className="max-w-xs text-sm leading-relaxed text-cream/70">{BRAND.tagline}</p>
            <div className="flex gap-3 pt-1">
              <a
                href={BRAND_INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Instagram de ${BRAND_NAME}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-cream/20 transition-colors hover:border-nude hover:bg-cream/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nude"
              >
                <Instagram className="h-5 w-5" />
              </a>
              {BRAND.whatsapp && (
                <a
                  href={BRAND_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp de ${BRAND_NAME}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-cream/20 transition-colors hover:border-nude hover:bg-cream/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nude"
                >
                  <Phone className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>

          {/* Tienda */}
          <nav aria-label="Tienda" className="space-y-3">
            <h4 className="font-serif text-base text-cream">Tienda</h4>
            <ul className="space-y-1">
              {SHOP_LINKS.map(link => (
                <li key={link.to}>
                  <Link to={link.to} className={linkClass}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Ayuda */}
          <nav aria-label="Ayuda" className="space-y-3">
            <h4 className="font-serif text-base text-cream">Ayuda</h4>
            <ul className="space-y-1">
              {HELP_LINKS.map(link => (
                <li key={link.to}>
                  <Link to={link.to} className={linkClass}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contacto */}
          <div className="col-span-2 space-y-3 lg:col-span-1">
            <h4 className="font-serif text-base text-cream">Contacto</h4>
            <ul className="space-y-3 text-sm text-cream/70">
              <li>
                <a href={BRAND_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-nude">
                  <Instagram className="h-4 w-4 shrink-0 text-nude" />@{BRAND.instagram}
                </a>
              </li>
              {BRAND.whatsapp && (
                <li>
                  <a href={BRAND_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-nude">
                    <Phone className="h-4 w-4 shrink-0 text-nude" />{BRAND.whatsapp}
                  </a>
                </li>
              )}
              <li>
                <a href={`mailto:${BRAND.contactEmail}`} className="flex items-center gap-3 break-all hover:text-nude">
                  <Mailbox className="h-4 w-4 shrink-0 text-nude" />{BRAND.contactEmail}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Location className="mt-0.5 h-4 w-4 shrink-0 text-nude" />
                <span>{BRAND.location} · Envíos a toda Venezuela</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="relative border-t border-cream/10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-cream/60 md:flex-row">
          <p>© {currentYear} {BRAND_NAME}. Todos los derechos reservados.</p>
          <p>Desarrollado por Quorex Studio</p>
        </div>
      </div>
    </footer>
  );
}
