// Página de Términos y Condiciones
import { motion } from 'framer-motion';
import { FileText, CheckCircle } from 'reicon-react';
import { Card, CardContent } from '@/components/ui/card';
import { StoreLayout } from '@/components/store/StoreLayout';

export default function TermsAndConditions() {
  // --- DERIVED ---
  const sections = [
    {
      title: "1. Introducción",
      content: `Las presentes Condiciones regulan el uso de Manojitos, y cualquier otro Contrato o relación jurídica conexos celebrados con el Titular de forma jurídicamente vinculante. Las palabras en mayúsculas se definen en la sección correspondiente específica del presente documento.

Los Usuarios deben leer atentamente el presente documento.

Los presentes términos y condiciones de Manojitos constituyen el contrato entre el Usuario y Manojitos, que rige el uso de la aplicación móvil, el sitio web, el software y los servicios prestados.

El Usuario al momento de realizar su registro en la aplicación de Manojitos, se compromete a leer y aceptar los presentes términos y condiciones, las Preguntas Frecuentes (FAQs), las Políticas de Cookies y el Aviso de Privacidad, y en caso de no encontrarse de acuerdo con los mismos, el Usuario deberá abstenerse de hacer uso de los servicios ofrecidos por Manojitos.

Manojitos pone también a disposición del Usuario una sección de Preguntas y Respuestas (FAQs) en su aplicación móvil y página web con la finalidad de aclarar dudas o inquietudes, siendo parte integrante de los presentes términos y condiciones. Asimismo, Manojitos se reserva el derecho a realizar modificaciones parciales o totales a los presentes términos y condiciones y el Usuario declara que al aceptar los mismos se adhiere integralmente a todas sus disposiciones y acepta que Manojitos podrá realizar cambios cuando así lo considere pertinente.`
    },
    {
      title: "2. Definiciones",
      content: `A los efectos de los presentes términos y condiciones, se entenderá por:

• Manojitos App: Aplicación web y/o móvil de Manojitos.
• Club Manojitos Más (o equivalente): Programa de beneficios para los Usuarios que premia el consumo responsable y el pago a tiempo.
• Comercios Afiliados: Persona natural o jurídica que presta servicios o vende bienes a cuotas a través de Manojitos.
• Cuotas: Pagos o porciones fijas que debe pagar el Usuario a cada determinado tiempo para completar el pago de sus compras.
• Embajadores: Personal propio de Manojitos destinado a asistir a los Usuarios.
• Factura / Orden de Compra: Documento emitido que evidencia la operación de compraventa del bien o servicio por parte del Usuario.
• Indemnización: Penalidad pecuniaria impuesta al Usuario por incumplir con el pago oportuno de una cuota.
• Inicial Flexible: Pago que debe realizar el Usuario al hacer la compra a cuotas. Representa un porcentaje del valor total (ej. 50%).
• Línea de Compra: Monto máximo asignado por Manojitos al Usuario para cubrir las cuotas de las compras después del pago de la Inicial.
• Línea de Compra Disponible: El monto de la Línea de Compra que no ha sido utilizado por el Usuario.
• Monto de la Compra: Es el precio total de la venta de los bienes y servicios.
• Monto Mínimo de Compra: Es el monto mínimo exigido que debe cumplir la Orden de Compra para que los Usuarios puedan adquirir productos a cuotas.
• Pago Oportuno de las Cuotas: La aplicación fijará el plazo para el pago de las cuotas. Los Usuarios deberán honrar dichas cuotas en los plazos establecidos para evitar la imposición de penalidades.
• Usuario: Persona natural, mayor de edad, con cédula de identidad vigente y domiciliada en la República Bolivariana de Venezuela, que haya completado su perfil en Manojitos.`
    },
    {
      title: "3. Introducción sobre Manojitos",
      content: `Manojitos no es una institución financiera ni pertenece al sector bancario, no realiza ningún tipo de intermediación financiera. Manojitos opera una plataforma tecnológica que permite a los Usuarios solicitar y obtener una línea de compra para realizar adquisiciones a cuotas bajo condiciones favorables. Este servicio no requiere de tarjeta de crédito, permitiendo a los Usuarios satisfacer una necesidad de consumo sin costos fijos ni cargos ocultos en los casos de cumplimiento oportuno. Manojitos recomienda el uso responsable de la aplicación y la realización de compras necesarias y planificadas, y sugiere que los Usuarios realicen compras a cuotas estrictamente por los productos y servicios que tengan capacidad de honrar económicamente.`
    },
    {
      title: "4. Requisitos y Registro",
      content: `Manojitos estará disponible únicamente para personas naturales, mayores de edad, con cédula de identidad válida, legalmente hábiles y domiciliados en la República Bolivariana de Venezuela. El uso de la cuenta es estrictamente personal, por lo que está expresamente prohibido que un Usuario permita el acceso a su cuenta a otra persona.

El Usuario deberá seguir los siguientes pasos:
• Tener un teléfono inteligente o dispositivo con acceso a internet.
• Ser mayor de 18 años.
• Validar su dirección de correo electrónico y número de teléfono celular.
• Proveer su cédula de identidad vigente y cualquier otra documentación adicional que pueda ser requerida (KYC).
• Aceptar los presentes términos y condiciones.`
    },
    {
      title: "5. Compras a Cuotas y Pagos",
      content: `• Protección de los Usuarios: Las compras a cuotas a través de Manojitos no serán recargadas, incrementadas ni condicionadas de forma oculta.
• Moneda de referencia: Todas las compras a cuotas se fijan y establecen en dólares estadounidenses como moneda de referencia. Todas las compras podrán ser pagadas por los Usuarios en Bolívares, calculados a la tasa del Banco Central de Venezuela correspondiente al día del pago.
• Pago oportuno: Al efectuar una compra a cuotas, el sistema indicará el precio total, la inicial a ser pagada, los montos de cada cuota y sus fechas de vencimiento. El Usuario manifiesta su aceptación expresa al confirmar su compra, asumiendo el compromiso de cumplir con los pagos de forma oportuna.
• Indemnización por pago tardío: En caso de que el Usuario pague tardíamente su cuota, se generará una penalidad administrativa. El incumplimiento o mora en el pago de una cuota será suficiente para que se considere vencido de pleno derecho el total del monto pendiente y la cuenta podrá ser bloqueada.`
    },
    {
      title: "6. Garantías, Cancelaciones y Reembolsos",
      content: `• Garantías: Manojitos garantiza que los productos entregados cumplen con la calidad ofrecida. Los cambios o devoluciones se rigen por la política interna de la tienda.
• Reembolsos y Sobrantes: En caso de que una orden sea cancelada, o si el Usuario realiza un pago superior al monto adeudado por error o devolución, cualquier pago realizado en exceso es primero aplicado a otras cuotas de sus compras vigentes, y luego registrado como saldo a favor administrativo, el cual no será devuelto en efectivo sino que servirá para compras futuras.
• Si el Usuario considera que hay un error en su facturación, pone a disposición su servicio de atención al cliente para ayudarlo a canalizar sus reclamos.`
    },
    {
      title: "7. Aceptación a las Comunicaciones",
      content: `El Usuario acepta que Manojitos o terceros contratados puedan enviar mensajes de texto, WhatsApp, notificaciones push, correos electrónicos y llamadas telefónicas, con el fin de recordar el pago de cuotas, realizar campañas de marketing, informar descuentos, promociones y cualquier otro concepto que Manojitos considere relevante.`
    },
    {
      title: "8. Uso Correcto de la Plataforma y Sanciones",
      content: `Manojitos App sólo podrá utilizarse dentro del ámbito para los fines previstos en los presentes Términos y Condiciones, y de conformidad con la legislación aplicable. Los Usuarios serán los únicos responsables de asegurarse de su correcta utilización y a preservar la confidencialidad de su información de acceso. Por consiguiente, Manojitos se reserva el derecho a adoptar las medidas oportunas para proteger sus intereses legítimos, incluyendo la denegación de Líneas de Compra, la terminación de contratos, la presentación de denuncias ante las autoridades competentes cuando se realicen, o se sospeche que se han realizado, cualquiera de las siguientes actividades: Infracciones de las leyes, los reglamentos y/o de las presentes condiciones; Vulneración de los derechos de terceros; Causar un perjuicio considerable a los intereses legítimos de Manojitos o de sus Comercios Afiliados; Ofensas contra Manojitos o contra cualquier tercero; e incumplimiento de los pagos de las cuotas.`
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
                regulaciones para el uso de nuestra plataforma.
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
                      <p className="text-muted-foreground whitespace-pre-line text-[11px] leading-snug">
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
