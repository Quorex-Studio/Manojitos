// Cola de correos automáticos (public.email_outbox): notificaciones y facturas.
// La llama pg_cron cada 20 s con x-cron-secret; usa service_role porque escribe a clientas
// y a la administración según los datos reales de la base (nunca lo que diga el navegador).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { Resend } from "https://esm.sh/resend@2.0.0";
import { createNewOrderAdminEmail, createNotificationEmail, createSaleReceiptEmail, type ReceiptEmailData } from "./templates.ts";

const BRAND_NAME = Deno.env.get("BRAND_NAME") ?? "Manojitos";

interface OutboxRow {
  id: string;
  kind: "notification" | "sale_receipt" | "payment_receipt";
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
    const link = meta.order_id ? "/sales?tab=pedidos" : n.credit_id ? "/credits" : "/dashboard";
    await send(deps, to, `${n.title} · ${BRAND_NAME}`, createNotificationEmail({ title: n.title, message: n.message, link, linkLabel: "Abrir el panel" }));
    return { status: "sent" };
  }

  if (!who.email) return { status: "skipped", note: "la clienta no tiene correo" };
  if (!(await wantsEmail(admin, n.user_id))) return { status: "skipped", note: "la clienta desactivó los correos" };
  const link = meta.order_id ? "/cliente/pedidos" : n.credit_id ? "/cliente/credito" : "/cliente/notificaciones";
  const label = meta.order_id ? "Ver mis pedidos" : n.credit_id ? "Ver mi crédito" : "Ver en mi cuenta";
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

export async function processOutbox(deps: Deps) {
  const { data: rows, error } = await deps.admin.rpc("claim_email_outbox", { p_limit: 20 });
  if (error) throw error;
  const summary = { sent: 0, skipped: 0, failed: 0 };
  for (const row of (rows ?? []) as OutboxRow[]) {
    try {
      const outcome = row.kind === "notification"
        ? await processNotification(deps, row)
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
