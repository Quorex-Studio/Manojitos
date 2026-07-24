import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, CreditCard, ShieldCheck, UserCheck, ShoppingBag, ArrowLeft, Building2 } from 'reicon-react';
import { StoreLayout } from '@/components/store/StoreLayout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Question = { q: string; a: string };
type Category = { title: string; icon: React.ReactNode; description: string; questions: Question[] };

export default function FAQ() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const faqCategories: Category[] = [
    {
      title: "Pago de Cuotas",
      description: "Encuentra métodos, fechas, recordatorios y soluciones para pagar tus cuotas.",
      icon: <CreditCard className="h-8 w-8 text-primary" />,
      questions: [
        {
          q: "Posibles inconvenientes al pagar o reportar un pago por el app",
          a: `El proceso de pagar y reportar el pago por la app de Manojitos es muy sencillo y la mayoría de inconvenientes que ocurren al pagar se pueden evitar conociendo el proceso.
          
**Al hacer el pago (Desde tu banco):**
• **Datos incorrectos de beneficiario (RIF):** Al copiar el RIF desde la app y pegarlo en tu banco, puede pasar que el número se pague incompleto. Revisar que se haya copiado correctamente soluciona esto.
• **Banco receptor no disponible:** Manojitos trabaja con cuentas específicas, a veces pueden ocurrir incidencias del lado del banco receptor que duran unos minutos.
• **Transacción fallida:** Usualmente tiene que ver con tu banco emisor. Recomendamos utilizar otro banco o método de pago. Para casos urgentes, escribe a soporte.

**Al reportar el pago (En Manojitos):**
• **Nro. Referencia:** La incidencia más común es reportar un número diferente al del comprobante de pago. Para pagos del Banco de Venezuela, la referencia suele ser el número de operación.
• **Pago de tercero:** Otro error común son pagos realizados por terceros. Lo más conveniente es que el titular de Manojitos sea el titular de la cuenta bancaria.
• **Fecha, Banco emisor o Monto:** A veces se coloca la fecha actual en vez de la fecha real del pago.
• **Pago a banco equivocado o persona natural:** Requiere confirmación manual. Si pagaste a una persona natural por error, tendrás que comunicarte directamente con esa persona.`
        },
        {
          q: "Métodos de Pago",
          a: "Los métodos de pago con los que cuenta Manojitos son: Pago móvil, transferencia bancaria (Bs), depósito en Bs o USD.\n\nEstos métodos aplican para el pago de todas las cuotas y para el pago inicial de compras hechas online. Para el pago inicial de compras en tienda, puedes pagar con cualquier método que la tienda tenga disponible."
        },
        {
          q: "¿Cómo reportar el comprobante de pago por la app?",
          a: "1. Entra al app y ve a la sección de pagos o 'Mis Pedidos'.\n2. Selecciona la cuota de la compra que quieras pagar.\n3. El app te irá solicitando datos como (Fecha de pago, Monto pagado y Número de referencia).\n4. Ten en cuenta que en depósitos en efectivo, el número a reportar es el de Serial y no de Referencia (o el número de operación según el banco).\n5. Lee detenidamente todos los datos y sube una foto o captura del comprobante de pago."
        },
        {
          q: "¿Cómo encuentro los datos de pago?",
          a: "Para pagar tus cuotas pendientes o consultar los datos de pago, simplemente entra al app y en la pantalla principal o perfil verás tus próximas fechas de pago y las cuotas pendientes. Al seleccionar una, el app te indicará a qué datos bancarios debes transferir."
        },
        {
          q: "¿Puedo elegir el número de cuotas?",
          a: "En Manojitos tenemos una modalidad principal que consiste en una inicial y posteriormente un plan de cuotas (generalmente 2 cuotas quincenales, o según lo defina el comercio). No es posible elegir el número de cuotas a discreción, ya que dependen del plan asociado al producto."
        },
        {
          q: "¿Cuándo vence mi próxima cuota?",
          a: "A partir del momento de tu compra, tus cuotas vencerán cada 14 o 15 días (según el plan). Podrás conocer las fechas de vencimiento en nuestra aplicación y te enviaremos recordatorios para que nunca olvides pagarlas a tiempo."
        },
        {
          q: "¿Puedo pagar mis cuotas por adelantado o abonar una parte?",
          a: "Siempre podrás adelantar el pago de tus cuotas pendientes e inclusive abonar parte de ellas. Lo importante es que al llegar la fecha de vencimiento de la cuota, esté pagada en su totalidad para evitar que tu cuenta sea pausada y apliquen cargos de reactivación."
        }
      ]
    },
    {
      title: "Usuarios y Cuenta",
      description: "Descubre cómo crear tu cuenta, verificar tu identidad y recuperar el acceso.",
      icon: <UserCheck className="h-8 w-8 text-primary" />,
      questions: [
        {
          q: "¿Qué es Manojitos y cómo funciona?",
          a: "Manojitos es una plataforma que te permite comprar productos a cuotas sin intereses ocultos, pagando una inicial y financiando el resto del monto. Solo necesitas registrarte, verificar tu identidad y obtener tu línea de compra."
        },
        {
          q: "Creación de cuenta y verificación de identidad",
          a: "Para crear tu cuenta, necesitas ser mayor de edad, tener cédula de identidad vigente y un número de teléfono válido. El proceso de verificación (KYC) te pedirá que subas una foto de tu cédula y una selfie para garantizar la seguridad de la plataforma."
        },
        {
          q: "Recuperación de Cuenta",
          a: "Si olvidaste tu contraseña o perdiste acceso a tu teléfono, puedes usar la opción 'Recuperar contraseña' en la pantalla de inicio de sesión. Te enviaremos un código de seguridad a tu correo electrónico registrado."
        }
      ]
    },
    {
      title: "Compras y Envíos",
      description: "Aprende a comprar, entender tu inicial y solucionar problemas con tus pedidos.",
      icon: <ShoppingBag className="h-8 w-8 text-primary" />,
      questions: [
        {
          q: "Proceso de Compra y Pago Inicial",
          a: "Para comprar, agrega los productos al carrito, ve al Checkout y selecciona el método de 'Crédito'. El sistema calculará automáticamente tu inicial (usualmente el 50%) y las cuotas restantes. El pedido se procesa una vez verificado el pago de la inicial."
        },
        {
          q: "Cambios y Problemas con mi Factura",
          a: "Si notas un error en tu factura o necesitas un cambio de producto, debes comunicarte directamente con atención al cliente dentro de las primeras 24 a 48 horas de haber recibido tu pedido."
        }
      ]
    },
    {
      title: "Seguridad y Privacidad",
      description: "Descubre cómo protegemos tu información y las mejores prácticas de ciberseguridad.",
      icon: <ShieldCheck className="h-8 w-8 text-primary" />,
      questions: [
        {
          q: "Protección de Datos y Ciberseguridad",
          a: "En Manojitos protegemos tu información bajo estrictos estándares de ciberseguridad. Nunca compartiremos tus datos financieros con terceros sin tu consentimiento. Te recomendamos no compartir tus credenciales de acceso con nadie."
        }
      ]
    }
  ];

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-12 max-w-4xl min-h-[70vh]">
        
        {/* Encabezado Principal */}
        <AnimatePresence mode="wait">
          {!selectedCategory && (
            <motion.div
              key="header"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              className="text-center mb-12"
            >
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <HelpCircle className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
                Centro de Soluciones y FAQs
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                En este espacio diseñado especialmente para ti, encontrarás respuestas a las preguntas frecuentes sobre el uso de nuestra plataforma.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sistema de Tabs y Vistas */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {!selectedCategory ? (
              <motion.div
                key="grid-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
              >
                <Tabs defaultValue="usuarios" className="w-full">
                  <div className="flex justify-center mb-8">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                      <TabsTrigger value="usuarios" className="text-base font-medium">Usuarios</TabsTrigger>
                      <TabsTrigger value="comercios" className="text-base font-medium">Comercios</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="usuarios" className="mt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {faqCategories.map((category, idx) => (
                        <Card 
                          key={idx} 
                          className="glass-card border-border/50 shadow-sm hover:border-primary/50 transition-all cursor-pointer hover:shadow-md group"
                          onClick={() => setSelectedCategory(category)}
                        >
                          <CardContent className="p-6 flex flex-col h-full">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                              {category.icon}
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                              {category.title}
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed flex-grow">
                              {category.description}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="comercios" className="mt-0">
                    <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl border-dashed border-border bg-card/30">
                      <Building2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
                      <h3 className="text-xl font-bold text-foreground mb-2">Próximamente</h3>
                      <p className="text-muted-foreground max-w-sm">
                        Estamos preparando el centro de soluciones exclusivo para nuestros comercios aliados.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </motion.div>
            ) : (
              <motion.div
                key="detail-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                className="w-full"
              >
                <div className="mb-8">
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className="flex items-center text-muted-foreground hover:text-primary transition-colors mb-6 text-sm font-medium"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a categorías
                  </button>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      {selectedCategory.icon}
                    </div>
                    <div>
                      <h1 className="text-3xl font-serif font-bold text-foreground">{selectedCategory.title}</h1>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-lg ml-20">
                    {selectedCategory.description}
                  </p>
                </div>

                <Card className="glass-card border-border/50 shadow-sm overflow-hidden">
                  <CardContent className="p-2 sm:p-6">
                    <Accordion type="single" collapsible className="w-full">
                      {selectedCategory.questions.map((item, i) => (
                        <AccordionItem key={i} value={`item-${i}`} className="border-border/30 px-2 sm:px-4">
                          <AccordionTrigger className="text-left font-medium hover:text-primary transition-colors text-[15px] py-4">
                            {item.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm bg-secondary/30 p-4 rounded-lg mb-4">
                            {item.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Footer de Soporte */}
        <div className="mt-16 text-center p-8 bg-primary/5 rounded-3xl border border-primary/20">
          <p className="text-muted-foreground mb-4 font-medium">¿Aún tienes dudas o necesitas ayuda personalizada?</p>
          <a href="mailto:soporte@manojitos.com" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 h-12 px-8 py-2">
            Contactar a Soporte
          </a>
        </div>
      </div>
    </StoreLayout>
  );
}

