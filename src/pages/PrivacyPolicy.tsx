// Página de Política de Privacidad
import { motion } from 'framer-motion';
import { Shield, Eye, Lock, UserCheck, Database, Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StoreLayout } from '@/components/store/StoreLayout';

export default function PrivacyPolicy() {
  const sections = [
    {
      icon: Database,
      title: "Información que Recopilamos",
      content: `Recopilamos la siguiente información cuando usas nuestra plataforma:

• **Datos de registro:** Nombre, correo electrónico, número de teléfono
• **Datos de perfil:** Dirección de entrega, ciudad, estado, preferencias de notificación
• **Datos de transacciones:** Historial de compras, métodos de pago utilizados, estado crediticio
• **Datos de uso:** Productos visualizados, preferencias de navegación, interacciones con la plataforma
• **Datos de comunicación:** Conversaciones con nuestro asistente virtual Ángela`
    },
    {
      icon: Eye,
      title: "Cómo Usamos tu Información",
      content: `Utilizamos tus datos para:

• Procesar y entregar tus pedidos
• Gestionar tu cuenta y perfil de cliente
• Administrar el sistema de crédito y facturación
• Personalizar tu experiencia de compra
• Enviarte notificaciones sobre tus pedidos y pagos
• Mejorar nuestros productos y servicios
• Prevenir fraudes y garantizar la seguridad
• Cumplir con obligaciones legales`
    },
    {
      icon: Lock,
      title: "Protección de tus Datos",
      content: `Implementamos medidas de seguridad para proteger tu información:

• **Encriptación:** Todos los datos sensibles se transmiten de forma segura
• **Acceso restringido:** Solo personal autorizado accede a información personal
• **Almacenamiento seguro:** Utilizamos servicios de almacenamiento con altos estándares de seguridad
• **Monitoreo continuo:** Supervisamos constantemente posibles vulnerabilidades
• **Contraseñas:** Se almacenan de forma encriptada y nunca son visibles`
    },
    {
      icon: UserCheck,
      title: "Tus Derechos",
      content: `Como usuario, tienes derecho a:

• **Acceso:** Solicitar una copia de tus datos personales
• **Rectificación:** Corregir datos incorrectos o incompletos
• **Eliminación:** Solicitar la eliminación de tu cuenta y datos (sujeto a obligaciones legales)
• **Portabilidad:** Recibir tus datos en formato estructurado
• **Oposición:** Oponerte al procesamiento de tus datos para ciertos fines
• **Limitación:** Restringir el uso de tus datos en ciertas circunstancias

Para ejercer estos derechos, contáctanos a contacto@manojitos.com`
    },
    {
      icon: Bell,
      title: "Comunicaciones y Notificaciones",
      content: `Te enviaremos comunicaciones sobre:

• Confirmaciones de pedidos y actualizaciones de estado
• Recordatorios de pago y estado de crédito
• Alertas de seguridad sobre tu cuenta
• Novedades y promociones (si lo autorizas)

Puedes gestionar tus preferencias de notificación desde tu perfil de usuario en cualquier momento.`
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
              <Shield className="h-8 w-8 text-pink-500" />
            </div>
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
            Política de Privacidad
          </h1>
          <p className="text-muted-foreground">
            Última actualización: Enero 2025
          </p>
        </motion.div>

        {/* Introducción */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="mb-8">
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                En Manojitos, respetamos tu privacidad y nos comprometemos a proteger tus datos personales. 
                Esta política describe cómo recopilamos, usamos y protegemos tu información cuando utilizas 
                nuestra plataforma de comercio electrónico.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Secciones */}
        <div className="space-y-6">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * (index + 1) }}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-pink-500" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
                        <div className="text-sm text-muted-foreground whitespace-pre-line prose prose-sm dark:prose-invert max-w-none">
                          {section.content.split('\n').map((line, i) => (
                            <p key={i} className="mb-2" dangerouslySetInnerHTML={{ 
                              __html: line
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/^• /, '• ')
                            }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Cookies y Terceros */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8"
        >
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-3">Cookies y Servicios de Terceros</h2>
              <div className="text-sm text-muted-foreground space-y-3">
                <p>
                  Utilizamos cookies para mejorar tu experiencia en la plataforma. Las cookies nos ayudan a:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Mantener tu sesión activa</li>
                  <li>Recordar tus preferencias</li>
                  <li>Mejorar el rendimiento de la plataforma</li>
                </ul>
                <p className="mt-4">
                  También utilizamos servicios de terceros para procesar pagos y comunicaciones. 
                  Estos servicios tienen sus propias políticas de privacidad que te recomendamos revisar.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cambios a la Política */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6"
        >
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-3">Cambios a esta Política</h2>
              <p className="text-sm text-muted-foreground">
                Podemos actualizar esta política de privacidad periódicamente. Te notificaremos sobre 
                cambios significativos a través de la plataforma o por correo electrónico. Te recomendamos 
                revisar esta página regularmente para estar informado sobre cómo protegemos tu información.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Contacto */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-8"
        >
          <Card className="bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800">
            <CardContent className="p-6 text-center">
              <h3 className="font-semibold mb-2">¿Tienes preguntas sobre tu privacidad?</h3>
              <p className="text-sm text-muted-foreground">
                Contáctanos a{' '}
                <a href="mailto:contacto@manojitos.com" className="text-pink-600 hover:underline">
                  contacto@manojitos.com
                </a>
                {' '}y te responderemos lo antes posible.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </StoreLayout>
  );
}
