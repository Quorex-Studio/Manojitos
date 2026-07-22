import { motion } from 'framer-motion';
import { Truck, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StoreLayout } from '@/components/store/StoreLayout';

export default function ShippingPolicy() {
  const sections = [
    {
      title: "1.- Plataforma Manojitos Envíos",
      content: `Manojitos Envíos es un servicio que ofrece a los usuarios la opción de recibir los productos adquiridos a través de su marketplace (compras online) a la dirección de domicilio o a la agencia de la empresa de envíos más cercana a su domicilio. Los envíos a domicilio y los retiros en agencia se realizarán únicamente en aquellas direcciones previstas dentro de las áreas de cobertura establecidas por las empresas de envíos. El área de cobertura y las zonas de entrega de este sistema de envíos puede estar sujeta a cambios sin previo aviso.`
    },
    {
      title: "2.- Carrito de Compras",
      content: `Los usuarios podrán hacer uso del servicio Manojitos Envíos para realizar compras a domicilio o con retiros en agencias, para lo cual, deberán indicarlo en su orden de compra online respectiva.
El carrito de compras permite a los usuarios seleccionar productos. Los productos agregados al carrito no representan una reserva ni garantizan su disponibilidad hasta que se complete el proceso de compra (pago de la inicial en cuotas o pago total de contado).
Los usuarios pueden revisar, modificar o eliminar los productos antes de proceder al pago. La disponibilidad puede cambiar durante el proceso de compra.
Los productos no se consideran comprados hasta que se haya completado el pago respectivo y recibido la confirmación de Manojitos.`
    },
    {
      title: "3.- Políticas de Envío",
      content: `Manojitos Envíos busca facilitar el seguimiento y la entrega eficiente de los productos a nivel nacional por intermedio de empresas especializadas.
Existen limitaciones (tamaño, volumen, peso, áreas de cobertura, productos prohibidos) impuestas por terceros autorizados.
**Envíos Última Milla:** Para zonas céntricas y locales, el proceso de entrega se realizará mediante un servicio de última milla, siempre y cuando la distancia no sea mayor a 15 Km.
**Envíos Nacionales:** Los comercios afiliados llevarán la mercancía a un proveedor autorizado para despachar al domicilio o agencia. Manojitos no será responsable por retrasos o problemas en la entrega causados por factores externos o de fuerza mayor.`
    },
    {
      title: "4.- Recepción del Envío",
      content: `Los usuarios deberán indicar toda la información necesaria y correcta para el envío y recepción del producto (dirección exacta).
Las personas que podrán recibir el envío son:
• El usuario que realizó la compra (mostrando su cédula y número de orden).
• Un tercero debidamente autorizado (con copia de la cédula del usuario y número de guía).
• En caso de cobro en destino, quien reciba deberá pagar el costo del envío a la empresa de encomiendas.`
    },
    {
      title: "5.- Costo de Envío",
      content: `La aplicación indicará los productos que contarán con envío gratuito y aquellos que deberán ser pagados con cobro en destino. Manojitos no interviene ni fija los costos de envío de los productos; estos son determinados por las agencias de envíos.`
    },
    {
      title: "6.- Procedimiento en Caso de No Entrega y Abandono",
      content: `Si el producto no puede ser entregado (dirección inexacta, ausencia de personas, falta de autorización), la agencia lo devolverá a la tienda o lo tendrá en depósito por 5 a 10 días hábiles. Si el usuario solicita un reenvío, deberá cubrir nuevamente los costos del mismo.`
    },
    {
      title: "7.- Reclamos por Pérdida, Extravío o Daños",
      content: `El usuario podrá reportar inconvenientes a atencion@manojitos.com o al número de soporte en un plazo no mayor a 24 horas tras la recepción del paquete, indicando número de guía, factura, copia de cédula y evidencia fotográfica. Manojitos notificará a la agencia de envíos en un plazo máximo de 24 horas y habrá un plazo de 7 días hábiles para el análisis y resolución.`
    },
    {
      title: "8.- Devoluciones y Reembolsos",
      content: `La política de devoluciones será determinada por los comercios afiliados correspondientes. Al realizar una compra, los usuarios aceptan las condiciones establecidas por la tienda. Se recomienda revisar estas políticas antes de efectuar cualquier compra.`
    },
    {
      title: "9.- Responsabilidad de los Usuarios",
      content: `• Proporcionar una dirección de envío precisa y completa.
• Conocer las políticas de devoluciones.
• Revisar el producto al recibirlo y reportar cualquier daño oportunamente.
• Asegurarse de que la compra no infrinja leyes locales.`
    },
    {
      title: "10.- Responsabilidades Generales",
      content: `Manojitos proveerá la plataforma segura, pero no es el transportista final. Las empresas de envío son las responsables directas del traslado, seguridad de la carga y puntualidad, acatando las leyes de la República Bolivariana de Venezuela.`
    }
  ];

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Truck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
            Términos y Condiciones
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Conoce los términos y condiciones del uso de Manojitos Envíos.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card shadow-lg border-border/50">
            <CardContent className="p-6 md:p-8 prose prose-slate dark:prose-invert max-w-none">
              
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mb-8 text-sm leading-relaxed text-muted-foreground">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="mb-2">
                      Los presentes términos y condiciones de Manojitos constituyen el contrato entre el USUARIO y la plataforma, que rige el uso de la logística y del sistema de envíos (MANOJITOS ENVÍOS) para las compras efectuadas en el Marketplace de la aplicación (compras online).
                    </p>
                    <p>
                      Manojitos prestará el servicio a través de empresas de envío debidamente autorizadas en la República Bolivariana de Venezuela, por lo que serán éstas las responsables de la adecuada entrega de los productos. En caso de no estar de acuerdo con los presentes términos, por favor no haga uso de Manojitos Envíos.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-8 text-foreground/80">
                {sections.map((section, idx) => (
                  <div key={idx}>
                    <h3 className="text-xl font-bold text-foreground mb-3">{section.title}</h3>
                    {section.content.split('\\n').map((paragraph, i) => {
                      if (paragraph.startsWith('**') || paragraph.startsWith('•')) {
                        return <p key={i} className="mb-2 leading-relaxed whitespace-pre-line ml-4">{paragraph}</p>;
                      }
                      return <p key={i} className="mb-3 leading-relaxed text-justify">{paragraph}</p>;
                    })}
                  </div>
                ))}
              </div>

            </CardContent>
          </Card>
        </motion.div>
      </div>
    </StoreLayout>
  );
}
