// Página de Términos y Condiciones
import { motion } from 'framer-motion';
import { FileText, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StoreLayout } from '@/components/store/StoreLayout';

export default function TermsAndConditions() {
  // --- DERIVED ---
  const sections = [
    {
      title: "1. Aceptación de los Términos",
      content: `Al acceder y utilizar la plataforma de Manojitos, usted acepta estar sujeto a estos términos y condiciones de uso. Si no está de acuerdo con alguno de estos términos, le recomendamos no utilizar nuestros servicios.`
    },
    {
      title: "2. Uso de la Plataforma",
      content: `Nuestra plataforma está destinada para la compra de productos ofrecidos por Manojitos. Usted se compromete a:
      • Proporcionar información veraz y actualizada al registrarse
      • Mantener la confidencialidad de su cuenta y contraseña
      • Utilizar la plataforma únicamente para fines legales
      • No intentar acceder a áreas restringidas del sistema`
    },
    {
      title: "3. Productos y Precios",
      content: `• Los precios están expresados en USD y pueden mostrarse en Bs según la tasa BCV del día
      • Los precios pueden cambiar sin previo aviso
      • Las imágenes de los productos son referenciales
      • Nos reservamos el derecho de limitar cantidades de compra
      • La disponibilidad de productos está sujeta a inventario`
    },
    {
      title: "4. Proceso de Compra",
      content: `• Al realizar un pedido, usted está haciendo una oferta de compra
      • La confirmación del pedido no garantiza la disponibilidad del producto
      • Nos reservamos el derecho de cancelar pedidos por razones justificadas
      • El pago debe realizarse según los métodos habilitados en la plataforma`
    },
    {
      title: "5. Sistema de Crédito",
      content: `• El crédito es un beneficio otorgado a discreción de Manojitos
      • El límite de crédito se asigna según evaluación individual
      • Los pagos deben realizarse en las fechas acordadas
      • El incumplimiento puede resultar en la suspensión inmediata del crédito
      • El historial de pagos afecta su nivel de confianza en el sistema
      • En caso de transcurrir más de un (1) mes con deuda pendiente, se procederá a la apertura de un expediente legal con respaldo de nuestro equipo de abogados y los cuerpos policiales competentes.`
    },
    {
      title: "6. Responsabilidades del Usuario",
      content: `El usuario es responsable de:
      • La veracidad de los datos proporcionados
      • El uso correcto de su cuenta
      • Notificar cualquier uso no autorizado de su cuenta
      • Cumplir con los plazos de pago acordados`
    },
    {
      title: "7. Propiedad Intelectual",
      content: `Todo el contenido de esta plataforma, incluyendo pero no limitado a textos, gráficos, logos, imágenes y software, es propiedad de Manojitos o sus proveedores de contenido y está protegido por las leyes de propiedad intelectual.`
    },
    {
      title: "8. Limitación de Responsabilidad",
      content: `Manojitos no será responsable por:
      • Daños indirectos o consecuentes derivados del uso de la plataforma
      • Interrupciones temporales del servicio
      • Errores u omisiones en el contenido
      • Acciones de terceros que afecten el servicio`
    },
    {
      title: "9. Modificaciones",
      content: `Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación en la plataforma. El uso continuado del servicio constituye su aceptación de los términos modificados.`
    },
    {
      title: "10. Ley Aplicable",
      content: `Estos términos se rigen por las leyes de la República Bolivariana de Venezuela. Cualquier disputa será resuelta en los tribunales competentes del país.`
    }
  ];

  // --- RENDER ---
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
              <FileText className="h-8 w-8 text-pink-500" />
            </div>
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
            Términos y Condiciones
          </h1>
          <p className="text-muted-foreground">
            Última actualización: Enero 2025
          </p>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <Card className="mb-6">
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                Bienvenido a Manojitos. Estos términos y condiciones describen las reglas y 
                regulaciones para el uso de nuestra plataforma de comercio electrónico.
                Por favor, léalos cuidadosamente antes de utilizar nuestros servicios.
              </p>
            </CardContent>
          </Card>

          {sections.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-pink-500 mt-1 flex-shrink-0" />
                    <div>
                      <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
                      <p className="text-muted-foreground whitespace-pre-line text-sm">
                        {section.content}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Contact */}
          <Card className="bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800">
            <CardContent className="p-6 text-center">
              <h3 className="font-semibold mb-2">¿Tienes preguntas?</h3>
              <p className="text-sm text-muted-foreground">
                Si tienes alguna duda sobre estos términos, contáctanos a{' '}
                <a href="mailto:contacto@manojitos.com" className="text-pink-600 hover:underline">
                  contacto@manojitos.com
                </a>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </StoreLayout>
  );
}
