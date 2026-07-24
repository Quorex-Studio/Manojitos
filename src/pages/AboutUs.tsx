// Página Sobre Nosotros y Contacto
import { motion } from 'framer-motion';
import { Map, Phone, Mailbox, Clock, Heart, Sparkles, Instagram, Global } from 'reicon-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StoreLayout } from '@/components/store/StoreLayout';

export default function AboutUs() {
  // --- RENDER ---
  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center">
              <Flower2 className="h-10 w-10 text-pink-500" />
            </div>
          </div>
          <h1 className="text-4xl font-serif font-bold text-foreground mb-4">
            Sobre Nosotros
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Somos una tienda familiar dedicada a llevar amor y belleza a cada hogar venezolano
            a través de nuestros productos cuidadosamente seleccionados.
          </p>
        </motion.div>

        {/* Historia */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <Card className="overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <Heart className="h-6 w-6 text-pink-500" />
                <h2 className="text-2xl font-serif font-semibold">Nuestra Historia</h2>
              </div>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Manojitos nació de un sueño familiar: compartir la belleza y la alegría 
                  que los detalles especiales pueden traer a la vida cotidiana. Lo que comenzó 
                  como un pequeño emprendimiento desde casa, hoy se ha convertido en una 
                  tienda que sirve a clientes en toda Venezuela.
                </p>
                <p>
                  Cada producto que ofrecemos es seleccionado con amor y cuidado, pensando 
                  siempre en nuestros clientes y en los momentos especiales que quieren crear. 
                  Creemos que los pequeños detalles hacen la diferencia, y por eso nos 
                  esforzamos en ofrecer productos de la mejor calidad a precios justos.
                </p>
                <p>
                  Nuestro compromiso es brindarte una experiencia de compra excepcional, 
                  con atención personalizada y entregas rápidas. ¡Gracias por confiar en nosotros!
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Información de Contacto */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-serif font-semibold text-center mb-6">Contáctanos</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-pink-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Ubicación</h3>
                    <p className="text-muted-foreground text-sm">
                      Venezuela<br />
                      Atención a todo el país
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-6 w-6 text-pink-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Teléfono / WhatsApp</h3>
                    <p className="text-muted-foreground text-sm">
                      +58 426-3863042<br />
                      Escríbenos para atención personalizada
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                    <Mailbox className="h-6 w-6 text-pink-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Email</h3>
                    <p className="text-muted-foreground text-sm">
                      contacto@manojitos.com<br />
                      Respondemos en 24 horas
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-6 w-6 text-pink-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Horario de Atención</h3>
                    <p className="text-muted-foreground text-sm">
                      Lunes a Viernes: 8:00 AM - 6:00 PM<br />
                      Sábados: 9:00 AM - 1:00 PM
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {/* Redes Sociales */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <h2 className="text-2xl font-serif font-semibold mb-6">Síguenos en Redes Sociales</h2>
          <div className="flex justify-center gap-4">
            <Button variant="outline" size="lg" className="gap-2" asChild>
              <a href="https://www.instagram.com/manojitos.shop/" target="_blank" rel="noopener noreferrer">
                <Instagram className="h-5 w-5" />
                Instagram
              </a>
            </Button>
            <Button variant="outline" size="lg" className="gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              Facebook
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            @MANOJITOS.SHOP
          </p>
        </motion.section>
      </div>
    </StoreLayout>
  );
}
