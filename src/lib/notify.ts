import { supabase } from '@/integrations/supabase/client';

export type OrderEmailAction = 'order_confirmed' | 'order_rejected' | 'order_shipped' | 'order_delivered';

interface NotifyCustomerInput {
  userId?: string | null;
  email?: string | null;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  orderId?: string;
  /** Si se indica, además del aviso interno y el push se envía el correo (Resend) */
  emailAction?: OrderEmailAction;
  emailData?: Record<string, unknown>;
}

/**
 * Avisa a una clienta por los tres canales: notificación interna, push y correo.
 * Cada canal es independiente: si uno falla (p. ej. Resend sin configurar) los otros siguen,
 * y la acción de la administración nunca se cae por un aviso.
 */
export async function notifyCustomer({ userId, email, title, message, type = 'success', orderId, emailAction, emailData }: NotifyCustomerInput) {
  const tasks: Promise<unknown>[] = [];

  if (userId) {
    tasks.push(
      Promise.resolve(
        supabase.from('notifications').insert({
          user_id: userId,
          title,
          message,
          type,
          channel: 'internal',
          is_read: false,
          sent_at: new Date().toISOString(),
          metadata: orderId ? { order_id: orderId } : {},
        })
      )
    );
    tasks.push(
      supabase.functions.invoke('send-push', {
        body: { userId, title, message, url: '/cliente/pedidos' },
      })
    );
  }

  if (email && emailAction) {
    tasks.push(
      supabase.functions.invoke('send-email', {
        body: { action: emailAction, email, data: { order_id: orderId, ...emailData } },
      })
    );
  }

  const results = await Promise.allSettled(tasks);
  results.forEach(r => r.status === 'rejected' && console.error('Aviso no enviado:', r.reason));
}

/** Avisa a la administración por correo de un pedido nuevo (el servidor elige los destinatarios). */
export function notifyAdminNewOrder(orderId: string) {
  return supabase.functions
    .invoke('send-email', { body: { action: 'new_order_admin', data: { order_id: orderId } } })
    .catch(err => console.error('Aviso de pedido nuevo no enviado:', err));
}
