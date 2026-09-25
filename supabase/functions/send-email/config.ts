// Configuración de correo: primero variables de entorno (supabase secrets set ...) y, si no
// están, los secretos guardados en Vault (public.get_email_secret, solo service_role).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ENV_BY_SECRET: Record<string, string> = {
  resend_api_key: "RESEND_API_KEY",
  resend_from_email: "RESEND_FROM_EMAIL",
  admin_notify_emails: "ADMIN_NOTIFY_EMAILS",
  send_email_hook_secret: "SEND_EMAIL_HOOK_SECRET",
};

const cache = new Map<string, string>();

export async function getEmailSecret(name: keyof typeof ENV_BY_SECRET | string): Promise<string> {
  const fromEnv = Deno.env.get(ENV_BY_SECRET[name] ?? "");
  if (fromEnv) return fromEnv;
  if (cache.has(name)) return cache.get(name)!;
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.rpc("get_email_secret", { p_name: name });
    if (error) throw error;
    const value = typeof data === "string" ? data : "";
    if (value) cache.set(name, value);
    return value;
  } catch (e) {
    console.error(`No se pudo leer el secreto ${name}:`, e);
    return "";
  }
}
