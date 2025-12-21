// Mensajes humanos contextuales para la plataforma
export interface HumanMessage {
  text: string;
  emoji?: string;
  tone: 'positive' | 'neutral' | 'warning' | 'error' | 'celebration';
}

type MessageContext = 
  | 'payment_on_time'
  | 'payment_late'
  | 'first_purchase'
  | 'repeat_customer'
  | 'credit_approved'
  | 'credit_blocked'
  | 'credit_near_limit'
  | 'low_stock'
  | 'order_confirmed'
  | 'welcome_back'
  | 'milestone_reached'
  | 'reminder_sent'
  | 'promise_created'
  | 'promise_fulfilled'
  | 'promise_broken'
  | 'good_payment_history'
  | 'bad_payment_history'
  | 'customer_of_month';

const HUMAN_MESSAGES: Record<MessageContext, HumanMessage[]> = {
  payment_on_time: [
    { text: '¡Buen trabajo pagando a tiempo! 👏', emoji: '👏', tone: 'celebration' },
    { text: '¡Gracias por tu puntualidad! Eso nos ayuda mucho', emoji: '🙌', tone: 'positive' },
    { text: 'Excelente, pago recibido a tiempo ✨', emoji: '✨', tone: 'positive' },
    { text: '¡Eres de los buenos! Gracias por pagar a tiempo', emoji: '💪', tone: 'celebration' },
  ],
  payment_late: [
    { text: 'Recibimos tu pago. La próxima vez intenta llegar a tiempo 😊', emoji: '😊', tone: 'neutral' },
    { text: 'Gracias por pagar. Recuerda que los pagos a tiempo te dan beneficios', emoji: '💡', tone: 'warning' },
    { text: 'Pago registrado. ¡No te preocupes, todos tenemos días difíciles!', emoji: '🤝', tone: 'neutral' },
  ],
  first_purchase: [
    { text: '¡Bienvenido a la familia! 🎉 Tu primera compra es especial', emoji: '🎉', tone: 'celebration' },
    { text: '¡Gracias por confiar en nosotros! Esperamos verte de nuevo', emoji: '💜', tone: 'positive' },
    { text: '¡Tu primera compra! Esto es el inicio de algo bueno', emoji: '🌟', tone: 'celebration' },
  ],
  repeat_customer: [
    { text: '¡Qué bueno verte de nuevo! Tus compras nos alegran', emoji: '😊', tone: 'positive' },
    { text: 'Gracias por seguir confiando en nosotros', emoji: '🙏', tone: 'positive' },
    { text: '¡Un cliente frecuente! Eso nos encanta', emoji: '💫', tone: 'celebration' },
  ],
  credit_approved: [
    { text: '¡Felicitaciones! Tu crédito ha sido aprobado 🎊', emoji: '🎊', tone: 'celebration' },
    { text: 'Confiamos en ti. ¡Usa tu crédito con responsabilidad!', emoji: '✨', tone: 'positive' },
    { text: '¡Crédito aprobado! Recuerda pagar a tiempo para mantener tu historial', emoji: '💳', tone: 'positive' },
  ],
  credit_blocked: [
    { text: 'Tu crédito ha sido suspendido temporalmente. Contáctanos para resolverlo', emoji: '⚠️', tone: 'error' },
    { text: 'Necesitamos hablar sobre tu crédito. Por favor comunícate con nosotros', emoji: '📞', tone: 'warning' },
    { text: 'Crédito pausado. No te preocupes, podemos solucionarlo juntos', emoji: '🤝', tone: 'warning' },
  ],
  credit_near_limit: [
    { text: 'Estás cerca de tu límite de crédito. ¡Ojo con eso!', emoji: '⚠️', tone: 'warning' },
    { text: 'Tu crédito está casi al máximo. Considera hacer un pago', emoji: '💡', tone: 'warning' },
    { text: 'Límite casi alcanzado. Un pago te daría más espacio', emoji: '📊', tone: 'neutral' },
  ],
  low_stock: [
    { text: '¡Últimas unidades! No te quedes sin el tuyo', emoji: '⏳', tone: 'warning' },
    { text: 'Quedan pocos. Los que esperan, pierden 😅', emoji: '🏃', tone: 'warning' },
    { text: '¡Se acaban! Este producto es muy popular', emoji: '🔥', tone: 'warning' },
  ],
  order_confirmed: [
    { text: '¡Pedido confirmado! Pronto estará en tus manos', emoji: '📦', tone: 'positive' },
    { text: 'Tu pedido está en camino. ¡Qué emoción!', emoji: '🚀', tone: 'celebration' },
    { text: '¡Listo! Tu pedido ha sido procesado con éxito', emoji: '✅', tone: 'positive' },
  ],
  welcome_back: [
    { text: '¡Hola de nuevo! ¿Qué vas a llevar hoy?', emoji: '👋', tone: 'positive' },
    { text: 'Bienvenido de vuelta. Tenemos cosas nuevas para ti', emoji: '✨', tone: 'positive' },
    { text: '¡Qué bueno verte! Tu tienda favorita te extrañaba', emoji: '💜', tone: 'celebration' },
  ],
  milestone_reached: [
    { text: '¡Wow! Has alcanzado un nuevo logro 🏆', emoji: '🏆', tone: 'celebration' },
    { text: '¡Felicitaciones! Tu progreso es impresionante', emoji: '🌟', tone: 'celebration' },
    { text: '¡Nuevo nivel desbloqueado! Sigue así', emoji: '🎮', tone: 'celebration' },
  ],
  reminder_sent: [
    { text: 'Te enviamos un recordatorio amigable de tu pago', emoji: '📬', tone: 'neutral' },
    { text: 'Solo un aviso: tu fecha de pago se acerca', emoji: '📅', tone: 'neutral' },
    { text: 'Recordatorio enviado. ¡No lo olvides!', emoji: '🔔', tone: 'neutral' },
  ],
  promise_created: [
    { text: 'Promesa de pago registrada. ¡Confiamos en ti!', emoji: '🤝', tone: 'positive' },
    { text: 'Anotado. Te esperamos en la fecha acordada', emoji: '📝', tone: 'neutral' },
    { text: 'Promesa recibida. Sabemos que cumplirás', emoji: '💪', tone: 'positive' },
  ],
  promise_fulfilled: [
    { text: '¡Promesa cumplida! Eso habla muy bien de ti', emoji: '⭐', tone: 'celebration' },
    { text: 'Cumpliste tu palabra. ¡Gracias por ser confiable!', emoji: '🙌', tone: 'celebration' },
    { text: 'Promesa honrada. Tu puntaje de confianza sube', emoji: '📈', tone: 'positive' },
  ],
  promise_broken: [
    { text: 'Te dimos chance, no nos falles 😅', emoji: '😅', tone: 'warning' },
    { text: 'La promesa no se cumplió. ¿Todo bien? Contáctanos', emoji: '🤔', tone: 'warning' },
    { text: 'Ups, la fecha pasó. Hablemos para reorganizar', emoji: '📞', tone: 'warning' },
  ],
  good_payment_history: [
    { text: 'Tu historial de pagos es excelente. ¡Sigue así!', emoji: '⭐', tone: 'celebration' },
    { text: 'Eres un cliente ejemplar. Gracias por ser tan responsable', emoji: '🏆', tone: 'celebration' },
    { text: 'Con clientes como tú, todo es más fácil 💜', emoji: '💜', tone: 'positive' },
  ],
  bad_payment_history: [
    { text: 'Tu historial necesita mejorar. ¿Te ayudamos?', emoji: '📊', tone: 'warning' },
    { text: 'Hemos notado algunos retrasos. Hablemos para mejorar', emoji: '🤝', tone: 'neutral' },
    { text: 'Podemos trabajar juntos para mejorar tu historial', emoji: '💪', tone: 'neutral' },
  ],
  customer_of_month: [
    { text: '¡Eres el Cliente del Mes! 🎉 ¡Felicitaciones!', emoji: '🎉', tone: 'celebration' },
    { text: '¡WOW! Has sido seleccionado como Cliente del Mes 🏆', emoji: '🏆', tone: 'celebration' },
    { text: '¡Increíble! Tu comportamiento te hace nuestro Cliente del Mes', emoji: '🌟', tone: 'celebration' },
  ],
};

export function getHumanMessage(context: MessageContext): HumanMessage {
  const messages = HUMAN_MESSAGES[context];
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

export function getHumanMessageForTrustLevel(trustLevel: string): HumanMessage {
  switch (trustLevel) {
    case 'EXCELENTE':
      return { text: '¡Eres un cliente estrella! Tu confianza es oro', emoji: '⭐', tone: 'celebration' };
    case 'BUENO':
      return { text: 'Buen historial. Sigue así y serás estrella', emoji: '✅', tone: 'positive' };
    case 'REGULAR':
      return { text: 'Vas bien, pero puedes mejorar. ¡Tú puedes!', emoji: '💪', tone: 'neutral' };
    case 'RIESGO':
      return { text: 'Tu historial necesita atención. Hablemos', emoji: '⚠️', tone: 'warning' };
    case 'CRITICO':
      return { text: 'Situación crítica. Contáctanos urgente', emoji: '🆘', tone: 'error' };
    default:
      return { text: 'Bienvenido. Construyamos juntos tu historial', emoji: '🤝', tone: 'neutral' };
  }
}

export function getPaymentDueDateMessage(daysUntilDue: number): HumanMessage {
  if (daysUntilDue < 0) {
    const daysLate = Math.abs(daysUntilDue);
    if (daysLate === 1) {
      return { text: 'Tu pago venció ayer. ¡Aún estás a tiempo!', emoji: '⏰', tone: 'warning' };
    } else if (daysLate <= 3) {
      return { text: `Llevas ${daysLate} días de atraso. Ponte al día pronto`, emoji: '⚠️', tone: 'warning' };
    } else {
      return { text: `${daysLate} días de mora. Necesitamos hablar`, emoji: '🆘', tone: 'error' };
    }
  } else if (daysUntilDue === 0) {
    return { text: '¡Hoy es día de pago! No lo dejes para mañana', emoji: '📅', tone: 'warning' };
  } else if (daysUntilDue <= 3) {
    return { text: `Faltan ${daysUntilDue} días para tu pago. ¡Prepárate!`, emoji: '🔔', tone: 'neutral' };
  } else if (daysUntilDue <= 7) {
    return { text: 'Tu pago se acerca. Recuerda estar listo', emoji: '📆', tone: 'neutral' };
  } else {
    return { text: 'Todo en orden con tu crédito. ¡Sigue así!', emoji: '✅', tone: 'positive' };
  }
}
