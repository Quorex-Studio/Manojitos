// Página de Atención al Cliente / Soporte
import { motion } from 'framer-motion';
import { Phone, Mailbox, Clock, MessageSquare, AlertTriangle, ShieldCheck, HelpCircle } from 'reicon-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { StoreLayout } from '@/components/store/StoreLayout';

export default function Atencion() {
  const faqs = [
    {
      question: "¿Cómo puedo solicitar un límite de crédito?",
      answer: "Puedes solicitarlo directamente contactando a nuestro equipo de atención al cliente. Evaluaremos tu solicitud en base a tu historial de compras y nivel de confianza, y te asignaremos un límite acorde."
    },
    {
      question: "¿Cuáles son los métodos de pago aceptados?",
      answer: "Aceptamos Pago Móvil, transferencias bancarias a Bancamiga o Banco de Venezuela, y pagos en efectivo (según la zona). Los detalles exactos para realizar los pagos se muestran al finalizar tu compra o en tu panel de facturación."
    },
    {
      question: "¿Qué pasa si me retraso con el pago de mi crédito?",
      answer: "Los pagos deben realizarse puntualmente en tu fecha de corte. Si te retrasas, tu línea de crédito será suspendida temporalmente y no podrás realizar nuevas compras bajo esta modalidad. Te recomendamos contactarnos de inmediato para acordar un plan de pago."
    },
    {
      question: "¿Cuál es la política para deudas vencidas?",
      answer: "Manojitos mantiene una política estricta de cumplimiento financiero. En caso de transcurrir más de un (1) mes con una deuda pendiente y sin comunicación por parte del cliente, se procederá a la apertura de un expediente legal con respaldo de nuestro equipo de abogados y las autoridades policiales competentes."
    },
    {
      question: "¿Hacen envíos a todo el país?",
      answer: "Sí, realizamos envíos nacionales a través de las agencias de encomienda principales (MRW, Zoom, Tealca). Los costos de envío corren por cuenta del cliente y el tiempo de entrega varía según la zona de destino."
    }
  ];

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-pink-500" />
            </div>
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
            Atención al Cliente
          </h1>
          <p className="text-muted-foreground">
            Estamos aquí para ayudarte. Contáctanos o resuelve tus dudas a continuación.
          </p>
        </motion.div>

        {/* Contact Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid md:grid-cols-2 gap-6 mb-12"
        >
          <Card className="hover:shadow-lg transition-shadow border-pink-100 dark:border-pink-900">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Phone className="h-5 w-5 text-pink-500" />
                Vías Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escríbenos por WhatsApp o llámanos directamente para una respuesta inmediata.
              </p>
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  Teléfono / WhatsApp:
                  <span className="text-pink-600 dark:text-pink-400 font-mono">+58 426-3863042</span>
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Lunes a Viernes: 8:00 AM - 6:00 PM | Sábados: 9:00 AM - 1:00 PM
                </p>
              </div>
              <Button 
                onClick={() => window.open('https://wa.me/584263863042', '_blank')}
                className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white gap-2"
              >
                Escribir por WhatsApp
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-pink-100 dark:border-pink-900">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mailbox className="h-5 w-5 text-pink-500" />
                Correo de Soporte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Para consultas de facturación, reclamos, o propuestas comerciales, puedes enviarnos un correo.
              </p>
              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  Email:{' '}
                  <a href="mailto:contacto@manojitos.com" className="text-pink-600 hover:underline font-mono">
                    contacto@manojitos.com
                  </a>
                </p>
                <p className="text-xs text-muted-foreground">
                  Tiempo de respuesta estimado: Menos de 24 horas hábiles.
                </p>
              </div>
              <Button 
                variant="outline"
                onClick={() => window.location.href = 'mailto:contacto@manojitos.com'}
                className="w-full gap-2"
              >
                Enviar Correo
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Warning Alert banner */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
            <CardContent className="p-6">
              <div className="flex items-start gap-3.5">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mt-1 flex-shrink-0" />
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-red-800 dark:text-red-300">AVISO IMPORTANTE - POLÍTICA DE COBRANZA</h3>
                  <p className="text-sm text-red-700 dark:text-red-400/90 leading-relaxed">
                    Manojitos confía plenamente en su clientela ofreciendo facilidades de crédito. Sin embargo, en caso de transcurrir <strong>más de un (1) mes con deuda pendiente</strong> y sin comunicación del titular para regularizar la situación, se iniciará formalmente un <strong>expediente legal con el respaldo de nuestro cuerpo de abogados y las autoridades policiales competentes</strong>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* FAQs Accordion */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-serif font-semibold text-center mb-6 flex items-center justify-center gap-2">
            <HelpCircle className="h-6 w-6 text-pink-500" />
            Preguntas Frecuentes
          </h2>
          <Card>
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`faq-${index}`}>
                    <AccordionTrigger className="text-left font-medium hover:text-pink-600 transition-colors">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </motion.section>

        {/* Security & Support footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300 rounded-full text-xs font-medium border border-pink-100 dark:border-pink-900">
            <ShieldCheck className="h-4 w-4" />
            Tu seguridad y satisfacción son nuestra prioridad
          </div>
        </motion.div>
      </div>
    </StoreLayout>
  );
}
