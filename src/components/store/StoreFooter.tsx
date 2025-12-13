import { Link } from 'react-router-dom';
import { Instagram, Facebook, Mail, Phone, MapPin, Heart } from 'lucide-react';

// Footer de la tienda
export function StoreFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border/50">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="text-2xl font-serif font-bold text-gradient-gold">
              Manojitos
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Tu tienda de confianza con los mejores productos. 
              Calidad, variedad y los mejores precios para ti.
            </p>
            <div className="flex gap-3">
              <a 
                href="#" 
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors"
              >
                <Instagram className="h-5 w-5 text-foreground" />
              </a>
              <a 
                href="#" 
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors"
              >
                <Facebook className="h-5 w-5 text-foreground" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Enlaces Rápidos</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Inicio
                </Link>
              </li>
              <li>
                <Link to="/tienda" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Tienda
                </Link>
              </li>
              <li>
                <Link to="/carrito" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Mi Carrito
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Atención al Cliente</h4>
            <ul className="space-y-2">
              <li className="text-muted-foreground text-sm">
                Preguntas Frecuentes
              </li>
              <li className="text-muted-foreground text-sm">
                Políticas de Envío
              </li>
              <li className="text-muted-foreground text-sm">
                Términos y Condiciones
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Contacto</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-muted-foreground text-sm">
                <Phone className="h-4 w-4 text-accent" />
                <span>+58 412-123-4567</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground text-sm">
                <Mail className="h-4 w-4 text-accent" />
                <span>contacto@manojitos.com</span>
              </li>
              <li className="flex items-start gap-2 text-muted-foreground text-sm">
                <MapPin className="h-4 w-4 text-accent mt-0.5" />
                <span>Venezuela</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>© {currentYear} Manojitos. Todos los derechos reservados.</p>
            <p className="flex items-center gap-1">
              Hecho con <Heart className="h-4 w-4 text-rose fill-rose" /> en Venezuela
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
