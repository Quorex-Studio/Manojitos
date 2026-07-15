import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { 
  createWelcomeEmail, 
  createCheckoutEmail, 
  createKycApprovedEmail, 
  createKycRejectedEmail,
  createRecoveryEmail,
  createMagicLinkEmail,
  createEmailChangeEmail
} from "./templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-signature, webhook-timestamp",
};

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Allow override from env, or default to Resend's testing domain for onboarding
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Manojitos <onboarding@resend.dev>";

const rateLimitMap = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 5;

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
    const headers = Object.fromEntries(req.headers);
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
    let subject = "";
    let html = "";

    if (isWebhook) {
      // ===== FLUJO 1: SUPABASE AUTH WEBHOOK (Send Email Hook) =====
      if (!configuredWebhookSecret) {
        throw new Error("Webhook secret not configured in environment");
      }

      const wh = new Webhook(configuredWebhookSecret);
      try {
        wh.verify(rawBody, headers);
      } catch (err) {
        throw new Error("Invalid webhook signature");
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
          subject = "Restablecer tu contraseña - Manojitos";
          html = createRecoveryEmail(link);
          break;
        case "magiclink":
          subject = "Tu enlace de inicio de sesión - Manojitos";
          html = createMagicLinkEmail(link);
          break;
        case "email_change":
          subject = "Confirma tu nuevo correo - Manojitos";
          html = createEmailChangeEmail(link);
          break;
        case "signup":
          // Si el usuario deja "Confirm email" activado, Supabase mandará "signup".
          subject = "Confirma tu correo y ¡Bienvenido a Manojitos!";
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

      // Security check: Only allow sending emails to the authenticated user's email 
      // unless they are a super_admin.
      const isAdmin = user.app_metadata?.is_super_admin === true;
      if (!isAdmin && email !== user.email) {
        throw new Error("You can only send emails to your own registered email address.");
      }

      switch (action) {
        case "welcome":
          subject = "¡Bienvenido a Manojitos!";
          html = createWelcomeEmail();
          break;
        case "checkout":
          subject = "Recibo de Compra - Manojitos";
          html = createCheckoutEmail(data);
          break;
        case "kyc_approved":
          subject = "Línea de Crédito Aprobada - Manojitos";
          html = createKycApprovedEmail(data);
          break;
        case "kyc_rejected":
          subject = "Revisión de Documentos - Manojitos";
          html = createKycRejectedEmail(data);
          break;
        default:
          throw new Error("Invalid action provided");
      }
    }

    // ===== ENVIAR EL CORREO MEDIANTE RESEND =====
    const { error: resendError } = await resend.emails.send({
      from: fromEmail,
      to: [email],
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
