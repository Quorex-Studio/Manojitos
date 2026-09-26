import { supabase } from '@/integrations/supabase/client';

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

export interface NewCustomerInput {
  email: string;
  full_name: string;
  phone?: string | null;
  dni?: string | null;
  address?: string | null;
}

/**
 * Crea la cuenta de una clienta nueva desde el panel (edge function admin-actions, solo admin):
 * con su correo y sin contraseña. Ella entra con "Olvidé mi contraseña" y completa su perfil.
 * Si el correo ya tiene cuenta, devuelve esa. Lanza un Error con el motivo si no se puede.
 */
export async function createCustomerAccount(input: NewCustomerInput): Promise<{ userId: string; existing: boolean }> {
  const { data, error } = await supabase.functions.invoke('admin-actions', { body: { action: 'create_customer', ...input } });
  if (!error && data?.user_id) return { userId: data.user_id as string, existing: data.existing === true };
  let message = (data?.error as string | undefined) ?? '';
  const context = (error as { context?: Response } | null)?.context;
  if (!message && context && typeof context.json === 'function') {
    try { message = (await context.json())?.error ?? ''; } catch { /* respuesta sin JSON */ }
  }
  throw new Error(message || error?.message || 'No se pudo crear la cuenta de la clienta');
}
