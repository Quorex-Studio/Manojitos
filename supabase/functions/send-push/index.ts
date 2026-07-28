import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webPush from "npm:web-push";

// CORS headers for browser requests (if called directly)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Setup Web Push
const VAPID_PUBLIC_KEY = Deno.env.get("VITE_VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
webPush.setVapidDetails("mailto:admin@manojitos.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Received Webhook Payload:", payload);

    // The webhook payload contains a 'record' object when triggered from DB insert
    let notification = payload.record;
    
    if (!notification || !notification.user_id) {
       // if called manually from frontend
       if (payload.userId && payload.title) {
          notification = { user_id: payload.userId, title: payload.title, message: payload.message, url: payload.url };
       } else {
         throw new Error("Invalid payload: missing user_id");
       }
    }

    const { user_id, title, message, url } = notification;

    // Get push subscriptions for this user
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (error) {
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${user_id}`);
      return new Response(JSON.stringify({ success: true, message: "No subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pushPayload = JSON.stringify({
      title: title || "Manojitos",
      body: message || "Tienes una nueva notificación",
      url: url || "/",
    });

    // Send push notification to all endpoints
    const pushPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh_key,
          auth: sub.auth_key,
        },
      };

      try {
        await webPush.sendNotification(pushSubscription, pushPayload);
        console.log(`Push sent successfully to endpoint ${sub.endpoint}`);
      } catch (err: any) {
        console.error(`Error sending push to endpoint ${sub.endpoint}:`, err);
        // If the endpoint is no longer valid (e.g. 410 Gone), delete it from DB
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          console.log(`Deleted invalid push subscription ${sub.id}`);
        }
      }
    });

    await Promise.all(pushPromises);

    return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-push function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
