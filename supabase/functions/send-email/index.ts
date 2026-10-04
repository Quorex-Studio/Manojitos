// Marca configurable por secreto de Supabase (supabase secrets set BRAND_NAME=...)
const BRAND_NAME = Deno.env.get("BRAND_NAME") ?? "Manojitos";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createWelcomeEmail,
  createCheckoutEmail,
  createKycApprovedEmail,
  createKycRejectedEmail,
  createRecoveryEmail,
  createMagicLinkEmail,
  createEmailChangeEmail,
  createOrderStatusEmail,
  createNewOrderAdminEmail,
} from "./templates.ts";

const ORDER_ACTIONS = {
  order_confirmed: "confirmed",
  order_rejected: "rejected",
  order_shipped: "shipped",
  order_delivered: "delivered",
} as const;

/** Correos de administración: ADMIN_NOTIFY_EMAILS (coma) o, si no hay, las cuentas con is_super_admin. */
async function getAdminEmails(): Promise<string[]> {
  const configured = (Deno.env.get("ADMIN_NOTIFY_EMAILS") ?? "").split(",").map(e => e.trim()).filter(Boolean);
  if (configured.length) return configured;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.filter(u => u.app_metadata?.is_super_admin === true && u.email).map(u => u.email!);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-signature, webhook-timestamp",
};

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Allow override from env, or default to Resend's testing domain for onboarding
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || `${BRAND_NAME} <onboarding@resend.dev>`;

const rateLimitMap = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 20; // una compra envía 2 correos; aprobar varios pedidos seguidos no debe perder avisos

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!resend) {
      throw new Error("RESEND_API_KEY is not configured.");
    }

    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    const configuredWebhookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    const isWebhook = body.user && body.email_data;

    // Rate Limiting Logic (In-Memory per isolate)
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = isWebhook ? `webhook-${clientIp}` : `manual-${clientIp}`;
    
    const now = Date.now();
    const requestTimes = rateLimitMap.get(rateLimitKey) || [];
    const recentRequests = requestTimes.filter(time => now - time < 60000);
    
    if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    recentRequests.push(now);
    rateLimitMap.set(rateLimitKey, recentRequests);

    let email = "";
    let recipients: string[] = [];
    let subject = "";
    let html = "";

    if (isWebhook) {
      // ===== FLUJO 1: SUPABASE AUTH WEBHOOK (Send Email Hook) =====
      if (!configuredWebhookSecret) {
        throw new Error("Webhook secret not configured in environment");
      }

      // Supabase Auth Hooks NO usan el protocolo standardwebhooks.
      // Se debe validar mediante un header personalizado (ej. x-webhook-secret) o el Authorization header.
      const customHeader = req.headers.get("x-webhook-secret");
      const authHeader = req.headers.get("authorization");

      const isValid = 
        customHeader === configuredWebhookSecret || 
        authHeader === `Bearer ${configuredWebhookSecret}`;

      if (!isValid) {
        throw new Error("Acceso denegado: Firma de webhook inválida. Asegúrate de enviar el header 'x-webhook-secret' en Supabase Auth Hooks.");
      }

      const { user, email_data } = body;
      const { email_action_type, token_hash, redirect_to, site_url } = email_data;
      email = user.email;
      
      // Construir el enlace de verificación nativo de Supabase usando concatenacion segura
      const verifyUrl = site_url + "/auth/v1/verify" + 
                        "?token=" + token_hash + 
                        "&type=" + email_action_type + 
                        "&redirect_to=" + encodeURIComponent(redirect_to || site_url);
      const link = verifyUrl;

      switch (email_action_type) {
        case "recovery":
          subject = `Restablecer tu contraseña - ${BRAND_NAME}`;
          html = createRecoveryEmail(link);
          break;
        case "magiclink":
          subject = `Tu enlace de inicio de sesión - ${BRAND_NAME}`;
          html = createMagicLinkEmail(link);
          break;
        case "email_change":
          subject = `Confirma tu nuevo correo - ${BRAND_NAME}`;
          html = createEmailChangeEmail(link);
          break;
        case "signup":
          // Si el usuario deja "Confirm email" activado, Supabase mandará "signup".
          subject = `Confirma tu correo y ¡Bienvenido a ${BRAND_NAME}!`;
          html = createWelcomeEmail(link);
          break;
        default:
          console.log("Unhandled email action type: " + email_action_type);
          return new Response(JSON.stringify({ success: true, ignored: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      }

    } else {
      // ===== FLUJO 2: LLAMADAS DIRECTAS DESDE EL FRONTEND =====
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        throw new Error("Missing Authorization header for manual invocation");
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Unauthorized request");
      }

      const { action, data } = body;
      email = body.email;
      const isAdmin = user.app_metadata?.is_super_admin === true;

      if (action === "new_order_admin") {
        // Cualquier cliente autenticado puede avisar de SU pedido, pero el destinatario lo
        // decide el servidor (nunca el navegador).
        recipients = await getAdminEmails();
        if (!recipients.length) {
          return new Response(JSON.stringify({ success: true, skipped: "no admin emails" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // El contenido sale del pedido real (RLS: la clienta solo puede leer los suyos).
        if (!data?.order_id) throw new Error("Missing order_id");
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("id, customer_name, customer_phone, payment_method, total_usd, items, notes, created_at")
          .eq("id", data.order_id)
          .single();
        if (orderError || !order) throw new Error("Order not found");
        if (Date.now() - new Date(order.created_at).getTime() > 10 * 60 * 1000) {
          throw new Error("Order notice window expired");
        }
        const items = Array.isArray(order.items)
          ? (order.items as { name?: string; product_name?: string; quantity?: number; price_usd?: number; unit_price?: number }[]).map(i => ({
              name: i.name || i.product_name || "Producto",
              quantity: Number(i.quantity || 1),
              price_usd: Number(i.unit_price ?? i.price_usd ?? 0),
            }))
          : [];
        const orderData = {
          order_id: order.id,
          client_name: order.customer_name,
          customer_phone: order.customer_phone ?? undefined,
          payment_method: order.payment_method ?? "",
          total_usd: order.total_usd,
          notes: order.notes ?? undefined,
          items,
        };
        subject = `Pedido nuevo: ${order.customer_name || "cliente"} · $${Number(order.total_usd || 0).toFixed(2)}`;
        html = createNewOrderAdminEmail(orderData);
      } else if (action in ORDER_ACTIONS) {
        // Estados de pedido: solo la administración los envía (a la clienta del pedido).
        if (!isAdmin) throw new Error("Only admins can send order status emails.");
        if (!email) throw new Error("Missing recipient email");
        const status = ORDER_ACTIONS[action as keyof typeof ORDER_ACTIONS];
        subject = {
          confirmed: data?.pickup ? `Tu pedido está listo para retirar - ${BRAND_NAME}` : `Pedido confirmado - ${BRAND_NAME}`,
          rejected: `Tu pedido fue cancelado - ${BRAND_NAME}`,
          shipped: `Tu pedido va en camino - ${BRAND_NAME}`,
          delivered: `Pedido entregado - ${BRAND_NAME}`,
        }[status];
        html = createOrderStatusEmail(status, data);
      } else {
      // Solo se puede escribir al propio correo, salvo la administración.
      if (!isAdmin && email !== user.email) {
        throw new Error("You can only send emails to your own registered email address.");
      }

      switch (action) {
        case "welcome":
          subject = `¡Bienvenido a ${BRAND_NAME}!`;
          html = createWelcomeEmail();
          break;
        case "checkout":
          subject = `Recibimos tu pedido - ${BRAND_NAME}`;
          html = createCheckoutEmail(data);
          break;
        case "kyc_approved":
          subject = `Línea de Crédito Aprobada - ${BRAND_NAME}`;
          html = createKycApprovedEmail(data);
          break;
        case "kyc_rejected":
          subject = `Revisión de Documentos - ${BRAND_NAME}`;
          html = createKycRejectedEmail(data);
          break;
        default:
          throw new Error("Invalid action provided");
      }
      }
    }

    // ===== ENVIAR EL CORREO MEDIANTE RESEND =====
    const to = recipients.length ? recipients : [email];
    if (!to[0]) throw new Error("Missing recipient email");
    const { error: resendError } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: subject,
      html: html,
    });

    if (resendError) {
      console.error("Resend API Error:", resendError);
      throw new Error(resendError.message);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: {
          http_code: 400,
          message: errorMessage
        } 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
