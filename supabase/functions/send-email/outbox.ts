// Cola de correos automáticos (public.email_outbox): notificaciones y facturas.
// La llama pg_cron cada 20 s con x-cron-secret; usa service_role porque escribe a clientas
// y a la administración según los datos reales de la base (nunca lo que diga el navegador).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { Resend } from "https://esm.sh/resend@2.0.0";
import { createNewOrderAdminEmail, createNotificationEmail, createSaleReceiptEmail, type ReceiptEmailData } from "./templates.ts";

const BRAND_NAME = Deno.env.get("BRAND_NAME") ?? "Manojitos";

interface OutboxRow {
  id: string;
  kind: "notification" | "sale_receipt" | "payment_receipt" | "sale_admin";
  ref: string;
  payload: Record<string, unknown>;
}

interface Deps {
  admin: SupabaseClient;
  mailer: Resend;
  from: string;
  getAdminEmails: () => Promise<string[]>;
}

type Outcome = { status: "sent" | "skipped"; note?: string };

const shortId = (id: string) => `#${id.split("-")[0].toUpperCase()}`;
const vzDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Caracas" });

async function userInfo(admin: SupabaseClient, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  const user = data?.user;
  return { email: user?.email ?? null, isAdmin: user?.app_metadata?.is_super_admin === true };
}

/** ¿La clienta desactivó los correos en Configuración? (por defecto, sí se envían) */
async function wantsEmail(admin: SupabaseClient, userId: string) {
  const { data } = await admin.from("customer_profiles").select("notification_preferences").eq("user_id", userId).maybeSingle();
  const prefs = data?.notification_preferences as { email?: boolean } | null;
  return prefs?.email !== false;
}

async function send(deps: Deps, to: string[], subject: string, html: string) {
  const { error } = await deps.mailer.emails.send({ from: deps.from, to, subject, html });
  if (error) throw new Error(error.message);
}

interface OwnerAlerts { enabled?: boolean; whatsapp_phone?: string; callmebot_apikey?: string }

/** Configuración de avisos por WhatsApp (business_rules 'owner_alerts', solo administración). */
async function ownerAlerts(admin: SupabaseClient): Promise<OwnerAlerts | null> {
  const { data } = await admin.from("business_rules").select("conditions").eq("rule_key", "owner_alerts").maybeSingle();
  const c = (data?.conditions ?? null) as OwnerAlerts | null;
  return c?.enabled && c.whatsapp_phone && c.callmebot_apikey ? c : null;
}

/** Número para CallMeBot / WhatsApp: siempre internacional 58 + número sin el 0 ("0414 123 4567" → "584141234567"). */
export function toWhatsAppPhone(value?: string | null): string {
  let d = String(value ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (d.startsWith("58")) d = d.slice(2);
  d = d.replace(/^0+/, "");
  return d ? `58${d}` : "";
}

/** WhatsApp a la dueña vía CallMeBot. Devuelve el error como texto (nunca lanza). */
export async function sendOwnerWhatsApp(cfg: OwnerAlerts, text: string): Promise<string | null> {
  try {
    // Siempre internacional 58 + número sin el 0 (CallMeBot rechaza 0414…)
    const phone = toWhatsAppPhone(cfg.whatsapp_phone);
    if (phone.length < 12) return `Número de WhatsApp incompleto: ${cfg.whatsapp_phone}`;
    const url = `https://api.callmebot.com/whatsapp.php?phone=%2B${phone}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(String(cfg.callmebot_apikey))}`;
    const res = await fetch(url);
    const body = await res.text();
    // CallMeBot responde HTML: "Message queued" cuando lo acepta; cualquier otra cosa es un error
    if (!res.ok || !/queued|sent/i.test(body)) {
      return `CallMeBot ${res.status}: ${body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}`;
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function processNotification(deps: Deps, row: OutboxRow): Promise<Outcome> {
  const { admin } = deps;
  const { data: n } = await admin.from("notifications").select("*").eq("id", row.ref).maybeSingle();
  if (!n) return { status: "skipped", note: "notificación no encontrada" };
  const meta = (n.metadata ?? {}) as Record<string, unknown>;
  // Ya salió un correo propio (pedido aprobado, abono, KYC) o es un recordatorio de cuotas,
  // que send-credit-notifications ya envía por correo.
  if (meta.email_sent === true || meta.reminder_type) return { status: "skipped", note: "correo propio ya enviado" };
  if (!n.user_id) return { status: "skipped", note: "sin destinataria" };

  const who = await userInfo(admin, n.user_id);
  if (who.isAdmin) {
    // Ventas y pedidos también llegan por WhatsApp si la dueña lo activó (un fallo no frena el correo)
    if (meta.order_id || meta.sale_group_id) {
      const cfg = await ownerAlerts(admin);
      if (cfg) {
        const failed = await sendOwnerWhatsApp(cfg, `*${n.title}*\n${n.message}`);
        if (failed) console.error("whatsapp", failed);
      }
    }
    const to = await deps.getAdminEmails();
    if (!to.length) return { status: "skipped", note: "sin correos de administración" };
    // Pedido nuevo: el correo lleva el detalle del pedido para aprobarlo desde el teléfono
    if (meta.order_id && /compra/i.test(n.title)) {
      const { data: order } = await admin.from("orders")
        .select("id, customer_name, customer_phone, payment_method, total_usd, items, notes").eq("id", meta.order_id).maybeSingle();
      if (order) {
        const items = Array.isArray(order.items)
          ? (order.items as { name?: string; product_name?: string; quantity?: number; unit_price?: number; price_usd?: number }[])
              .map(i => ({ name: i.name || i.product_name || "Producto", quantity: Number(i.quantity || 1), price_usd: Number(i.unit_price ?? i.price_usd ?? 0) }))
          : [];
        await send(deps, to, `Pedido nuevo: ${order.customer_name || "cliente"} · $${Number(order.total_usd || 0).toFixed(2)}`,
          createNewOrderAdminEmail({ order_id: order.id, client_name: order.customer_name, customer_phone: order.customer_phone ?? undefined, payment_method: order.payment_method ?? "", total_usd: order.total_usd, notes: order.notes ?? undefined, items }));
        return { status: "sent" };
      }
    }
    const link = meta.kind === "product_request" ? "/solicitudes" : meta.order_id ? "/sales?tab=pedidos"
      : meta.sale_group_id ? "/sales" : n.credit_id ? "/credits" : "/notificaciones";
    await send(deps, to, `${n.title} · ${BRAND_NAME}`, createNotificationEmail({ title: n.title, message: n.message, link, linkLabel: "Abrir el panel" }));
    return { status: "sent" };
  }

  if (!who.email) return { status: "skipped", note: "la clienta no tiene correo" };
  if (!(await wantsEmail(admin, n.user_id))) return { status: "skipped", note: "la clienta desactivó los correos" };
  const link = meta.product_id ? `/producto/${meta.product_id}` : meta.order_id ? "/cliente/pedidos" : n.credit_id ? "/cliente/credito" : "/cliente/notificaciones";
  const label = meta.product_id ? "Ver el producto" : meta.order_id ? "Ver mis pedidos" : n.credit_id ? "Ver mi crédito" : "Ver en mi cuenta";
  await send(deps, [who.email], `${n.title} · ${BRAND_NAME}`, createNotificationEmail({ title: n.title, message: n.message, link, linkLabel: label }));
  return { status: "sent" };
}

async function processReceipt(deps: Deps, groupId: string, newPaymentId?: string): Promise<Outcome> {
  const { admin } = deps;
  const { data: lines } = await admin.from("sales").select("*").or(`sale_group_id.eq.${groupId},id.eq.${groupId}`).order("created_at");
  const sales = (lines ?? []).filter(l => l.status === "confirmed");
  if (!sales.length) return { status: "skipped", note: "venta no encontrada o no confirmada" };
  const first = sales[0];

  // Destinataria: su cuenta (si la venta está vinculada) o el correo escrito en la venta
  let email: string | null = null;
  if (first.customer_user_id) {
    const who = await userInfo(admin, first.customer_user_id);
    if (who.isAdmin) return { status: "skipped", note: "venta de la propia tienda" };
    email = who.email;
  }
  email = email || sales.find(s => s.client_email)?.client_email || null;
  if (!email) return { status: "skipped", note: "sin correo de la clienta" };

  const credit = sales.some(s => s.is_credit);
  const total = sales.reduce((sum, s) => sum + Number(s.total_usd || 0), 0);
  const saleIds = sales.map(s => s.id);
  let payments: ReceiptEmailData["payments"] = [];
  let newPayment: number | undefined;
  if (credit) {
    const { data: rows } = await admin.from("sale_payments")
      .select("id, amount_usd, amount_bs, payment_method, created_at, status")
      .or(`sale_group_id.eq.${groupId},sale_id.in.(${saleIds.join(",")})`)
      .order("created_at");
    const valid = (rows ?? []).filter(p => p.status !== "void");
    payments = valid.map(p => ({ date: vzDate(p.created_at), method: p.payment_method, amount_usd: Number(p.amount_usd), amount_bs: p.amount_bs ? Number(p.amount_bs) : null }));
    if (newPaymentId) {
      const p = valid.find(x => x.id === newPaymentId);
      if (!p) return { status: "skipped", note: "abono anulado" };
      newPayment = Number(p.amount_usd);
    }
  }
  const paid = credit ? sales.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0) : total;
  const data: ReceiptEmailData = {
    number: shortId(groupId),
    date: vzDate(first.created_at),
    client_name: first.client_name,
    payment_method: first.payment_method,
    items: sales.map(s => ({ name: s.variant_label ? `${s.product_name} · ${s.variant_label}` : s.product_name, quantity: Number(s.quantity), price_usd: Number(s.unit_price_usd) })),
    total_usd: total,
    total_bs: sales.every(s => s.total_bs) ? sales.reduce((sum, s) => sum + Number(s.total_bs), 0) : null,
    credit,
    paid,
    payments,
    new_payment_usd: newPayment,
  };
  const subject = newPayment !== undefined
    ? `Recibimos tu abono de $${newPayment.toFixed(2)} · ${BRAND_NAME}`
    : `Tu factura ${data.number} · ${BRAND_NAME}`;
  await send(deps, [email], subject, createSaleReceiptEmail(data));
  return { status: "sent" };
}

const METHOD_LABELS: Record<string, string> = {
  pago_movil: "pago móvil", transferencia: "transferencia", zelle: "Zelle", binance: "Binance", zinli: "Zinli",
  wally: "Wally", efectivo_usd: "efectivo", efectivo: "efectivo", punto: "punto de venta", credito: "crédito",
};

/** Aviso a la dueña de una venta registrada en el panel: crea la notificación (que sale por correo y WhatsApp). */
async function processSaleAdmin(deps: Deps, groupId: string): Promise<Outcome> {
  const { admin } = deps;
  const { data: lines } = await admin.from("sales").select("*").or(`sale_group_id.eq.${groupId},id.eq.${groupId}`).order("created_at");
  const sales = (lines ?? []).filter(l => l.status === "confirmed");
  if (!sales.length) return { status: "skipped", note: "venta no encontrada o no confirmada" };
  const first = sales[0];
  const total = sales.reduce((sum, s) => sum + Number(s.total_usd || 0), 0);
  const units = sales.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
  const credit = sales.some(s => s.is_credit);
  const method = METHOD_LABELS[String(first.payment_method || "").toLowerCase()] ?? first.payment_method ?? "";
  const products = sales.slice(0, 4).map(s => `${Number(s.quantity)} × ${s.variant_label ? `${s.product_name} · ${s.variant_label}` : s.product_name}`).join("\n");
  const more = sales.length > 4 ? `\n… y ${sales.length - 4} más` : "";
  const message = [
    `${first.client_name || "Cliente sin nombre"} · ${units} ${units === 1 ? "producto" : "productos"}${credit ? " · a crédito" : method ? ` · ${method}` : ""}`,
    products + more,
    `Factura ${shortId(groupId)}`,
  ].join("\n");

  const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const admins = users.users.filter(u => u.app_metadata?.is_super_admin === true);
  if (!admins.length) return { status: "skipped", note: "sin cuentas de administración" };
  const { error: insertError } = await admin.from("notifications").insert(admins.map(u => ({
    user_id: u.id,
    title: `Venta registrada · $${total.toFixed(2)}`,
    message,
    type: "success",
    metadata: { kind: "sale_registered", sale_group_id: groupId, total_usd: total },
  })));
  if (insertError) throw insertError;
  return { status: "sent", note: "notificación creada" };
}

export async function processOutbox(deps: Deps) {
  const { data: rows, error } = await deps.admin.rpc("claim_email_outbox", { p_limit: 20 });
  if (error) throw error;
  const summary = { sent: 0, skipped: 0, failed: 0 };
  for (const row of (rows ?? []) as OutboxRow[]) {
    try {
      const outcome = row.kind === "notification"
        ? await processNotification(deps, row)
        : row.kind === "sale_admin"
          ? await processSaleAdmin(deps, row.ref)
        : row.kind === "sale_receipt"
          ? await processReceipt(deps, row.ref)
          : await processReceipt(deps, String(row.payload?.sale_group_id ?? ""), row.ref);
      await deps.admin.rpc("finish_email_outbox", { p_id: row.id, p_status: outcome.status, p_error: outcome.note ?? null });
      summary[outcome.status]++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("email_outbox", row.kind, row.ref, message);
      await deps.admin.rpc("finish_email_outbox", { p_id: row.id, p_status: "failed", p_error: message.slice(0, 500) });
      summary.failed++;
    }
  }
  return summary;
}
