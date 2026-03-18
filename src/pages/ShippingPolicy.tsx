// Página de Política de Envíos
import { motion } from 'framer-motion';
import { Truck, MapPin, Clock, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StoreLayout } from '@/components/store/StoreLayout';

export default function ShippingPolicy() {
  // --- DERIVED ---
  const deliveryZones = [
    {
      zone: "Zona Local",
      description: "Área metropolitana y zonas cercanas",
      time: "24-48 horas",
      available: true
    },
    {
      zone: "Zona Regional",
      description: "Estados cercanos y ciudades principales",
      time: "3-5 días hábiles",
      available: true
    },
    {
      zone: "Todo el País",
      description: "Resto de Venezuela",
      time: "5-10 días hábiles",
      available: true
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
              <Truck className="h-8 w-8 text-pink-500" />
            </div>
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
            Política de Envíos
          </h1>
          <p className="text-muted-foreground">
            Información sobre entregas y despachos
          </p>
        </motion.div>

        {/* Zonas de Entrega */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-pink-500" />
            Zonas de Entrega
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {deliveryZones.map((zone, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{zone.zone}</CardTitle>
                    {zone.available && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Disponible
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">{zone.description}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-pink-500" />
                    <span className="font-medium">{zone.time}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        {/* Proceso de Envío */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-10"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-pink-500" />
            Proceso de Envío
          </h2>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-sm flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium">Confirmación del Pedido</h4>
                    <p className="text-sm text-muted-foreground">
                      Una vez realizado el pago, recibirás confirmación de tu pedido por la plataforma.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-sm flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium">Preparación</h4>
                    <p className="text-sm text-muted-foreground">
                      Preparamos tu pedido con cuidado en 24-48 horas hábiles.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-sm flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium">Despacho</h4>
                    <p className="text-sm text-muted-foreground">
                      Tu pedido es despachado y te notificamos por la plataforma o WhatsApp.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-sm flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium">Entrega</h4>
                    <p className="text-sm text-muted-foreground">
                      Recibes tu pedido en la dirección indicada. ¡Listo para disfrutar!
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Costos de Envío */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-10"
        >
          <h2 className="text-xl font-semibold mb-4">Costos de Envío</h2>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Los costos de envío se calculan al momento de realizar tu pedido y dependen de:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>La zona de entrega</li>
                  <li>El peso y volumen del pedido</li>
                  <li>El método de envío seleccionado</li>
                </ul>
                <div className="bg-pink-50 dark:bg-pink-950/20 p-4 rounded-lg">
                  <p className="text-sm font-medium text-pink-700 dark:text-pink-300">
                    💡 Consulta con nuestro equipo para conocer el costo exacto de envío a tu zona.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Consideraciones Importantes */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-pink-500" />
            Consideraciones Importantes
          </h2>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  • Los tiempos de entrega son estimados y pueden variar según disponibilidad 
                  y condiciones externas.
                </p>
                <p>
                  • Es responsabilidad del cliente proporcionar una dirección de entrega 
                  correcta y completa.
                </p>
                <p>
                  • En caso de no encontrar al destinatario, se realizarán hasta 2 intentos 
                  de entrega adicionales.
                </p>
                <p>
                  • Para entregas especiales (horarios específicos, fechas particulares), 
                  consultar disponibilidad con anticipación.
                </p>
                <p>
                  • Los productos deben ser revisados al momento de la entrega. Cualquier 
                  inconformidad debe reportarse en las primeras 24 horas.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <Card className="bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800">
            <CardContent className="p-6 text-center">
              <h3 className="font-semibold mb-2">¿Tienes dudas sobre tu envío?</h3>
              <p className="text-sm text-muted-foreground">
                Contáctanos por WhatsApp o escríbenos a{' '}
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
