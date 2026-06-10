import { Link } from 'react-router-dom';
import { Instagram, Facebook, Mail, Phone, MapPin, Heart } from 'lucide-react';

// Footer de la tienda — Editorial luxury
export function StoreFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#120A0C] text-[#F5EDE8]/80 grain-overlay">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16">
          {/* Brand */}
          <div className="space-y-5 lg:col-span-1">
            <h3 className="text-3xl font-serif font-bold text-gradient-gold">
              Manojitos
            </h3>
            <p className="text-[#F5EDE8]/50 text-sm leading-relaxed tracking-wide">
              Tu tienda de confianza con los mejores productos. 
              Calidad, variedad y los mejores precios para ti.
            </p>
            <div className="flex gap-3 pt-2">
              <a 
                href="#" 
                className="w-10 h-10 rounded-full bg-[#F5EDE8]/5 border border-[#F5EDE8]/10 flex items-center justify-center hover:bg-primary/20 hover:border-primary/30 transition-all duration-300"
              >
                <Instagram className="h-4 w-4 text-[#F5EDE8]/70" />
              </a>
              <a 
                href="#" 
                className="w-10 h-10 rounded-full bg-[#F5EDE8]/5 border border-[#F5EDE8]/10 flex items-center justify-center hover:bg-primary/20 hover:border-primary/30 transition-all duration-300"
              >
                <Facebook className="h-4 w-4 text-[#F5EDE8]/70" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-5">
            <h4 className="font-serif text-[#F5EDE8]/90 text-sm tracking-[0.15em] uppercase">Enlaces</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/" className="text-[#F5EDE8]/40 hover:text-gold transition-colors duration-300 text-sm tracking-wide">
                  Inicio
                </Link>
              </li>
              <li>
                <Link to="/tienda" className="text-[#F5EDE8]/40 hover:text-gold transition-colors duration-300 text-sm tracking-wide">
                  Tienda
                </Link>
              </li>
              <li>
                <Link to="/carrito" className="text-[#F5EDE8]/40 hover:text-gold transition-colors duration-300 text-sm tracking-wide">
                  Mi Carrito
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="space-y-5">
            <h4 className="font-serif text-[#F5EDE8]/90 text-sm tracking-[0.15em] uppercase">Atención</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/atencion" className="text-[#F5EDE8]/40 hover:text-gold transition-colors duration-300 text-sm tracking-wide">
                  Atención al Cliente
                </Link>
              </li>
              <li>
                <Link to="/nosotros" className="text-[#F5EDE8]/40 hover:text-gold transition-colors duration-300 text-sm tracking-wide">
                  Sobre Nosotros
                </Link>
              </li>
              <li>
                <Link to="/envios" className="text-[#F5EDE8]/40 hover:text-gold transition-colors duration-300 text-sm tracking-wide">
                  Política de Envíos
                </Link>
              </li>
              <li>
                <Link to="/terminos" className="text-[#F5EDE8]/40 hover:text-gold transition-colors duration-300 text-sm tracking-wide">
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <Link to="/privacidad" className="text-[#F5EDE8]/40 hover:text-gold transition-colors duration-300 text-sm tracking-wide">
                  Política de Privacidad
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-5">
            <h4 className="font-serif text-[#F5EDE8]/90 text-sm tracking-[0.15em] uppercase">Contacto</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-[#F5EDE8]/40 text-sm tracking-wide">
                <Phone className="h-4 w-4 text-gold/70 flex-shrink-0" />
                <span>+58 426-3863042</span>
              </li>
              <li className="flex items-center gap-3 text-[#F5EDE8]/40 text-sm tracking-wide">
                <Mail className="h-4 w-4 text-gold/70 flex-shrink-0" />
                <span>contacto@manojitos.com</span>
              </li>
              <li className="flex items-start gap-3 text-[#F5EDE8]/40 text-sm tracking-wide">
                <MapPin className="h-4 w-4 text-gold/70 mt-0.5 flex-shrink-0" />
                <span>Venezuela</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[#F5EDE8]/5">
        <div className="container mx-auto px-4 py-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[#F5EDE8]/30 tracking-widest uppercase">
            <p>© {currentYear} Manojitos. Todos los derechos reservados.</p>
            <p className="flex items-center gap-1.5">
              Hecho con <Heart className="h-3 w-3 text-primary fill-primary" /> en Venezuela
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
