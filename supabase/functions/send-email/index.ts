import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { 
  createWelcomeEmail, 
  createCheckoutEmail, 
  createKycApprovedEmail, 
  createKycRejectedEmail 
} from "./templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Allow override from env, or default to Resend's testing domain for onboarding
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Manojitos <onboarding@resend.dev>";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!resend) {
      throw new Error("RESEND_API_KEY is not configured.");
    }

    // Verify JWT and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
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

    const body = await req.json();
    const { action, email, data } = body;

    // Security check: Only allow sending emails to the authenticated user's email 
    // unless they are a super_admin.
    const isAdmin = user.app_metadata?.is_super_admin === true;
    if (!isAdmin && email !== user.email) {
      throw new Error("You can only send emails to your own registered email address.");
    }

    let subject = "";
    let html = "";

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
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
