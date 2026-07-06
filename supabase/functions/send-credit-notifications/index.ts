import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Supabase client with service role for admin operations
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Resend client for emails
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Verify admin authorization
async function verifyAdminAuth(authHeader: string | null): Promise<{ isAdmin: boolean; error?: string }> {
  if (!authHeader) {
    return { isAdmin: false, error: "Authentication required" };
  }

  // Create client with user's auth token to verify their identity
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  
  if (authError || !user) {
    console.error("Auth error:", authError);
    return { isAdmin: false, error: "Invalid authentication" };
  }

  // Check if user is admin
  const isAdmin = user.app_metadata?.is_super_admin === true;
  if (!isAdmin) {
    console.log(`User ${user.id} attempted admin action without admin privileges`);
    return { isAdmin: false, error: "Admin access required" };
  }

  console.log(`Admin access verified for user ${user.id}`);
  return { isAdmin: true };
}

// Types
interface NotificationRequest {
  action: "send_manual" | "process_automatic" | "check_credits";
  credit_id?: string;
  channels?: ("internal" | "email" | "sms")[];
  message?: string;
  reminder_type?: string;
}

interface Credit {
  id: string;
  user_id: string;
  client_user_id: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  current_balance: number;
  next_due_date: string | null;
  grace_days: number;
  is_blocked: boolean;
  last_reminder_sent_at: string | null;
}

// Reminder message templates
const REMINDER_TEMPLATES = {
  "3_DAYS_BEFORE": {
    title: "Recordatorio de pago próximo",
    message: (credit: Credit, dueDate: string) =>
      `Estimado/a ${credit.client_name}, le recordamos que su próximo pago vence el ${dueDate}. El monto pendiente es de $${credit.current_balance.toFixed(2)}. Agradecemos su puntualidad. - Manojitos`,
  },
  "DUE_DATE": {
    title: "Vencimiento de pago hoy",
    message: (credit: Credit, dueDate: string) =>
      `Estimado/a ${credit.client_name}, hoy ${dueDate} es la fecha de vencimiento de su pago. El monto pendiente es de $${credit.current_balance.toFixed(2)}. Por favor, realice su pago lo antes posible. - Manojitos`,
  },
  "1_DAY_AFTER": {
    title: "Pago atrasado - 1 día",
    message: (credit: Credit, dueDate: string) =>
      `Estimado/a ${credit.client_name}, su pago venció ayer (${dueDate}). El monto pendiente es de $${credit.current_balance.toFixed(2)}. Le invitamos a ponerse al día para evitar inconvenientes. - Manojitos`,
  },
  "3_DAYS_AFTER": {
    title: "AVISO FINAL - Pago vencido",
    message: (credit: Credit, dueDate: string) =>
      `Estimado/a ${credit.client_name}, su pago tiene 3 días de atraso desde el ${dueDate}. El monto pendiente es de $${credit.current_balance.toFixed(2)}. Este es un aviso final antes de suspender el crédito. Por favor, comuníquese con nosotros inmediatamente. - Manojitos`,
  },
};

// Calculate credit status
function calculateCreditStatus(credit: Credit): string {
  if (credit.is_blocked) return "BLOQUEADO";
  if (!credit.next_due_date) return "ACTIVO";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(credit.next_due_date);
  dueDate.setHours(0, 0, 0, 0);

  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + credit.grace_days);

  const threeDaysBefore = new Date(dueDate);
  threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);

  if (today < dueDate && today >= threeDaysBefore) return "POR_VENCER";
  if (today >= dueDate && today <= graceEnd) return "EN_GRACIA";
  if (today > graceEnd) return "VENCIDO";

  return "ACTIVO";
}

// Determine which reminder type should be sent
function getReminderType(credit: Credit): string | null {
  if (!credit.next_due_date || credit.current_balance <= 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(credit.next_due_date);
  dueDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === -3) return "3_DAYS_BEFORE";
  if (diffDays === 0) return "DUE_DATE";
  if (diffDays === 1) return "1_DAY_AFTER";
  if (diffDays === 3) return "3_DAYS_AFTER";

  return null;
}

// Check if reminder was already sent today
function wasReminderSentToday(lastSentAt: string | null): boolean {
  if (!lastSentAt) return false;

  const lastSent = new Date(lastSentAt);
  const today = new Date();

  return (
    lastSent.getFullYear() === today.getFullYear() &&
    lastSent.getMonth() === today.getMonth() &&
    lastSent.getDate() === today.getDate()
  );
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Create internal notification
async function createInternalNotification(
  credit: Credit,
  title: string,
  message: string,
  reminderType: string
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    // Create notification for admin
    const { data: adminNotif, error: adminError } = await supabase
      .from("notifications")
      .insert({
        user_id: credit.user_id,
        credit_id: credit.id,
        title,
        message,
        type: reminderType.includes("AFTER") ? "warning" : "info",
        channel: "internal",
        metadata: { reminder_type: reminderType, client_name: credit.client_name },
      })
      .select()
      .single();

    if (adminError) {
      console.error("Error creating admin notification:", adminError);
      return { success: false, error: adminError.message };
    }

    // If client has user_id, create notification for them too
    if (credit.client_user_id) {
      await supabase.from("notifications").insert({
        user_id: credit.client_user_id,
        credit_id: credit.id,
        title,
        message,
        type: reminderType.includes("AFTER") ? "warning" : "info",
        channel: "internal",
        metadata: { reminder_type: reminderType },
      });
    }

    console.log(`Internal notification created for credit ${credit.id}`);
    return { success: true, notificationId: adminNotif.id };
  } catch (error) {
    console.error("Error in createInternalNotification:", error);
    return { success: false, error: String(error) };
  }
}

// Send email notification
async function sendEmailNotification(
  credit: Credit,
  title: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log("Resend not configured, skipping email");
    return { success: false, error: "Email service not configured" };
  }

  if (!credit.client_email) {
    console.log("Client has no email, skipping");
    return { success: false, error: "Client has no email" };
  }

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Manojitos <onboarding@resend.dev>";

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [credit.client_email],
      subject: title,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #FFB5C5 0%, #D4AF37 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Manojitos</h1>
          </div>
          <div style="background: #fff; padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">${title}</h2>
            <p style="color: #555; line-height: 1.6; font-size: 16px;">${message}</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              <p style="color: #999; font-size: 12px;">Este es un mensaje automático, por favor no responda a este correo.</p>
            </div>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending email:", error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    console.log(`Email sent to ${credit.client_email}`);
    return { success: true };
  } catch (error) {
    console.error("Error in sendEmailNotification:", error);
    return { success: false, error: String(error) };
  }
}

// Send SMS notification (placeholder for future integration)
async function sendSmsNotification(
  credit: Credit,
  message: string
): Promise<{ success: boolean; error?: string }> {
  // SMS integration placeholder - ready for Twilio or other service
  if (!credit.client_phone) {
    return { success: false, error: "Client has no phone number" };
  }

  console.log(`SMS placeholder - would send to ${credit.client_phone}: ${message}`);
  
  // TODO: Integrate with Twilio or other SMS provider
  // const twilioClient = new Twilio(accountSid, authToken);
  // await twilioClient.messages.create({
  //   body: message,
  //   to: credit.client_phone,
  //   from: 'YOUR_TWILIO_NUMBER'
  // });

  return { success: false, error: "SMS service not yet configured" };
}

// Record reminder in database
async function recordReminder(
  creditId: string,
  reminderType: string,
  channel: string,
  message: string,
  success: boolean,
  errorMessage?: string,
  notificationId?: string
): Promise<void> {
  await supabase.from("credit_reminders").insert({
    credit_id: creditId,
    reminder_type: reminderType,
    channel,
    message,
    delivered: success,
    delivery_status: success ? "sent" : "failed",
    error_message: errorMessage,
    notification_id: notificationId,
    sent_at: success ? new Date().toISOString() : null,
  });

  // Update last reminder sent timestamp
  if (success) {
    await supabase
      .from("credits")
      .update({ last_reminder_sent_at: new Date().toISOString() })
      .eq("id", creditId);
  }
}

// Send notification through all specified channels
async function sendNotification(
  credit: Credit,
  reminderType: string,
  channels: ("internal" | "email" | "sms")[],
  customMessage?: string
): Promise<{ channel: string; success: boolean; error?: string }[]> {
  const template = REMINDER_TEMPLATES[reminderType as keyof typeof REMINDER_TEMPLATES];
  if (!template && !customMessage) {
    return [{ channel: "all", success: false, error: "Invalid reminder type" }];
  }

  const dueDate = credit.next_due_date ? formatDate(credit.next_due_date) : "N/A";
  const title = template?.title || "Recordatorio de pago";
  const message = customMessage || template.message(credit, dueDate);

  const results: { channel: string; success: boolean; error?: string }[] = [];

  for (const channel of channels) {
    let result: { success: boolean; notificationId?: string; error?: string };

    switch (channel) {
      case "internal":
        result = await createInternalNotification(credit, title, message, reminderType);
        break;
      case "email":
        result = await sendEmailNotification(credit, title, message);
        break;
      case "sms":
        result = await sendSmsNotification(credit, message);
        break;
      default:
        result = { success: false, error: "Unknown channel" };
    }

    // Record the reminder attempt
    await recordReminder(
      credit.id,
      reminderType,
      channel,
      message,
      result.success,
      result.error,
      result.notificationId
    );

    results.push({ channel, success: result.success, error: result.error });
  }

  return results;
}

// Process automatic notifications for all credits
async function processAutomaticNotifications(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  const stats = { processed: 0, sent: 0, skipped: 0, errors: 0 };

  // Fetch all credits with balance > 0
  const { data: credits, error } = await supabase
    .from("credits")
    .select("*")
    .gt("current_balance", 0);

  if (error) {
    console.error("Error fetching credits:", error);
    return stats;
  }

  console.log(`Processing ${credits?.length || 0} credits for automatic notifications`);

  for (const credit of credits || []) {
    stats.processed++;

    // Skip if already sent today
    if (wasReminderSentToday(credit.last_reminder_sent_at)) {
      stats.skipped++;
      continue;
    }

    // Determine reminder type
    const reminderType = getReminderType(credit);
    if (!reminderType) {
      stats.skipped++;
      continue;
    }

    // Determine channels based on reminder type
    const channels: ("internal" | "email" | "sms")[] = ["internal"];
    
    // Always send email if available
    if (credit.client_email) {
      channels.push("email");
    }

    // Send SMS only for overdue or final notice
    if ((reminderType === "1_DAY_AFTER" || reminderType === "3_DAYS_AFTER") && credit.client_phone) {
      channels.push("sms");
    }

    console.log(`Sending ${reminderType} notification for credit ${credit.id} via ${channels.join(", ")}`);

    const results = await sendNotification(credit, reminderType, channels);
    
    const hasSuccess = results.some((r) => r.success);
    if (hasSuccess) {
      stats.sent++;
    } else {
      stats.errors++;
    }
  }

  console.log(`Automatic notifications complete: ${JSON.stringify(stats)}`);
  return stats;
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin authentication before processing any action
    const authHeader = req.headers.get("Authorization");
    const { isAdmin, error: authError } = await verifyAdminAuth(authHeader);
    
    if (!isAdmin) {
      console.error("Authorization failed:", authError);
      return new Response(
        JSON.stringify({ success: false, error: authError }),
        { 
          status: authError === "Authentication required" ? 401 : 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const body: NotificationRequest = await req.json();
    console.log("Request received:", body.action);

    let response: unknown;

    switch (body.action) {
      case "send_manual": {
        // Send manual notification to a specific credit
        if (!body.credit_id) {
          throw new Error("credit_id is required");
        }

        const { data: credit, error } = await supabase
          .from("credits")
          .select("*")
          .eq("id", body.credit_id)
          .single();

        if (error || !credit) {
          throw new Error("Credit not found");
        }

        const channels = body.channels || ["internal"];
        const reminderType = body.reminder_type || "DUE_DATE";
        const results = await sendNotification(credit, reminderType, channels, body.message);

        response = { success: true, results };
        break;
      }

      case "process_automatic": {
        // Process all automatic notifications (for cron job)
        const stats = await processAutomaticNotifications();
        response = { success: true, stats };
        break;
      }

      case "check_credits": {
        // Check credits status without sending (for debugging)
        const { data: credits } = await supabase
          .from("credits")
          .select("*")
          .gt("current_balance", 0);

        const statusReport = (credits || []).map((credit) => ({
          id: credit.id,
          client_name: credit.client_name,
          balance: credit.current_balance,
          status: calculateCreditStatus(credit),
          reminderType: getReminderType(credit),
          lastReminderSent: credit.last_reminder_sent_at,
          shouldSend: !wasReminderSentToday(credit.last_reminder_sent_at) && getReminderType(credit) !== null,
        }));

        response = { success: true, credits: statusReport };
        break;
      }

      default:
        throw new Error("Invalid action");
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-credit-notifications:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
