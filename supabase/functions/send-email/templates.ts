// Plantillas de correo (Resend). Toda la marca sale de secretos de Supabase, así la misma
// función sirve para cualquier tienda de la plantilla:
//   BRAND_NAME, BRAND_COLOR (hex), BRAND_SITE_URL, BRAND_CATEGORY, BRAND_WHATSAPP, STORE_HOURS
const BRAND_NAME = Deno.env.get("BRAND_NAME") ?? "Manojitos";
const BRAND_COLOR = Deno.env.get("BRAND_COLOR") ?? "#c4607a";
const BRAND_CREAM = Deno.env.get("BRAND_CREAM") ?? "#f5ede8";
const SITE_URL = (Deno.env.get("BRAND_SITE_URL") ?? "https://manojitos.vercel.app").replace(/\/$/, "");
const BRAND_CATEGORY = Deno.env.get("BRAND_CATEGORY") ?? "Boutique · Ropa, accesorios y lencería";
const BRAND_WHATSAPP = Deno.env.get("BRAND_WHATSAPP") ?? "";
const STORE_HOURS = Deno.env.get("STORE_HOURS") ?? "Lunes a Sábado, 9:00 a. m. - 6:00 p. m.";

export interface EmailData {
  client_name?: string;
  payment_method?: string;
  total_usd?: number | string;
  notes?: string;
  order_id?: string;
  reason?: string;
  pickup?: boolean;
  items?: { name: string; quantity: number; price_usd: number }[];
  customer_phone?: string;
  [key: string]: unknown;
}

/** Escapa texto que viene de clientes (nombre, notas, motivos) para que no inyecte HTML. */
export const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "";
};
const shortId = (id?: string) => (id ? `#${String(id).slice(0, 8).toUpperCase()}` : "");
const METHOD_LABELS: Record<string, string> = {
  pago_movil: "Pago Móvil",
  transferencia: "Transferencia Bs",
  zelle: "Zelle",
  binance: "Binance",
  zinli: "Zinli",
  wally: "Wally",
  efectivo_usd: "Efectivo (USD)",
  credito: "Crédito",
};
const methodLabel = (m?: string) => esc(METHOD_LABELS[m || ""] ?? (m || "").replace(/_/g, " "));

const button = (href: string, label: string) => `
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px auto 8px;">
    <tr><td style="border-radius:999px;background:${BRAND_COLOR};">
      <a href="${href}" style="display:inline-block;padding:14px 30px;border-radius:999px;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${label}</a>
    </td></tr>
  </table>`;

const box = (inner: string) => `
  <div style="background:${BRAND_CREAM};border-radius:14px;padding:18px 20px;margin:22px 0;color:#252024;font-size:15px;line-height:1.6;">${inner}</div>`;

/** Estructura común: cabecera de marca, contenido, pie con contacto. Compatible con Gmail/Outlook. */
const layout = (opts: { preheader: string; title: string; body: string }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f7f1ea;">
  <span style="display:none!important;opacity:0;color:transparent;max-height:0;overflow:hidden;">${esc(opts.preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f1ea;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
        <tr><td style="background:${BRAND_COLOR};padding:26px 28px;text-align:center;">
          <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:2px;color:${BRAND_CREAM};">${esc(BRAND_NAME)}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${BRAND_CREAM};opacity:.8;margin-top:4px;">${esc(BRAND_CATEGORY)}</div>
        </td></tr>
        <tr><td style="padding:32px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#3a3236;font-size:15px;line-height:1.65;">
          <h1 style="margin:0 0 14px;font-family:'Playfair Display',Georgia,serif;font-weight:normal;font-size:24px;color:#252024;">${esc(opts.title)}</h1>
          ${opts.body}
        </td></tr>
        <tr><td style="padding:22px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a7f83;text-align:center;border-top:1px solid #efe6dc;">
          ${BRAND_WHATSAPP ? `¿Dudas? Escríbenos por WhatsApp: <strong>${esc(BRAND_WHATSAPP)}</strong><br>` : ""}
          <a href="${SITE_URL}" style="color:${BRAND_COLOR};text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, "")}</a>
          <br><span style="opacity:.8">Mensaje automático: por favor no respondas a este correo.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const itemsTable = (items?: EmailData["items"]) =>
  items && items.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;margin-top:6px;">
        ${items.map(i => `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #eadfd3;">${esc(i.name)} <span style="color:#8a7f83;">× ${esc(i.quantity)}</span></td>
          <td style="padding:6px 0;border-bottom:1px solid #eadfd3;text-align:right;white-space:nowrap;">${money(Number(i.price_usd) * Number(i.quantity))}</td>
        </tr>`).join("")}
      </table>`
    : "";

// ── Cuenta ──────────────────────────────────────────────────────────────────
export const createWelcomeEmail = (link?: string) => layout({
  preheader: `Tu cuenta en ${BRAND_NAME} está lista`,
  title: link ? "Confirma tu correo" : `¡Bienvenida a ${BRAND_NAME}!`,
  body: `
    <p>Nos alegra tenerte aquí. Con tu cuenta puedes comprar más rápido, guardar favoritos, seguir tus pedidos y, si quieres, solicitar compra a crédito.</p>
    ${link ? button(link, "Confirmar mi correo") : button(`${SITE_URL}/tienda`, "Ver la tienda")}
  `,
});

export const createRecoveryEmail = (link: string) => layout({
  preheader: "Restablece tu contraseña",
  title: "Restablecer contraseña",
  body: `
    <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta en <strong>${esc(BRAND_NAME)}</strong>.</p>
    ${button(link, "Crear nueva contraseña")}
    <p style="font-size:13px;color:#8a7f83;">Si no fuiste tú, ignora este correo: tu contraseña no cambiará.</p>
  `,
});

export const createMagicLinkEmail = (link: string) => layout({
  preheader: "Tu enlace para entrar",
  title: "Tu enlace de acceso",
  body: `
    <p>Toca el botón para entrar a tu cuenta. El enlace vence en unos minutos y solo sirve una vez.</p>
    ${button(link, "Entrar a mi cuenta")}
  `,
});

export const createEmailChangeEmail = (link: string) => layout({
  preheader: "Confirma tu nuevo correo",
  title: "Confirma tu nuevo correo",
  body: `
    <p>Pediste cambiar el correo de tu cuenta. Confírmalo para empezar a usarlo.</p>
    ${button(link, "Confirmar correo")}
  `,
});

// ── Compras y pedidos ───────────────────────────────────────────────────────
export const createCheckoutEmail = (data: EmailData) => layout({
  preheader: `Recibimos tu pedido ${shortId(data.order_id)}`,
  title: `¡Gracias por tu compra${data.client_name ? `, ${data.client_name}` : ""}!`,
  body: `
    <p>Recibimos tu pedido y lo estamos verificando. Te avisaremos por aquí apenas esté confirmado.</p>
    ${box(`
      ${data.order_id ? `<div><strong>Pedido:</strong> ${shortId(data.order_id)}</div>` : ""}
      <div><strong>Método de pago:</strong> ${methodLabel(data.payment_method)}</div>
      ${itemsTable(data.items)}
      <div style="margin-top:10px;font-size:17px;"><strong>Total: ${money(data.total_usd)}</strong></div>
    `)}
    ${button(`${SITE_URL}/cliente/pedidos`, "Ver mi pedido")}
  `,
});

export const createOrderStatusEmail = (
  status: "confirmed" | "rejected" | "shipped" | "delivered",
  data: EmailData
) => {
  const id = shortId(data.order_id);
  const copy = {
    confirmed: {
      title: data.pickup ? "Tu pedido está listo para retirar" : "Tu pedido fue confirmado",
      text: data.pickup
        ? `Ya puedes pasar a retirarlo. Horario: <strong>${esc(STORE_HOURS)}</strong>`
        : "Estamos coordinando tu delivery. Te avisaremos cuando salga.",
    },
    shipped: { title: "Tu pedido va en camino", text: "Tu pedido salió hacia tu dirección. Te avisaremos cuando llegue." },
    delivered: { title: "Tu pedido fue entregado", text: `¡Esperamos que lo disfrutes! Gracias por comprar en ${esc(BRAND_NAME)}.` },
    rejected: {
      title: "No pudimos procesar tu pedido",
      text: `Tu pedido fue cancelado.${data.reason ? ` Motivo: <strong>${esc(data.reason)}</strong>.` : ""} Si ya pagaste, te contactaremos para resolverlo.`,
    },
  }[status];
  return layout({
    preheader: `${copy.title} ${id}`,
    title: copy.title,
    body: `
      <p>${data.client_name ? `Hola ${esc(data.client_name)}. ` : ""}${copy.text}</p>
      ${box(`
        ${id ? `<div><strong>Pedido:</strong> ${id}</div>` : ""}
        ${data.total_usd !== undefined ? `<div><strong>Total:</strong> ${money(data.total_usd)}</div>` : ""}
      `)}
      ${button(`${SITE_URL}/cliente/pedidos`, "Ver mis pedidos")}
    `,
  });
};

/** Aviso interno para la administración cuando entra un pedido nuevo. */
export const createNewOrderAdminEmail = (data: EmailData) => layout({
  preheader: `Pedido nuevo ${shortId(data.order_id)} por ${money(data.total_usd)}`,
  title: "Entró un pedido nuevo",
  body: `
    ${box(`
      <div><strong>Cliente:</strong> ${esc(data.client_name) || "—"}${data.customer_phone ? ` · ${esc(data.customer_phone)}` : ""}</div>
      <div><strong>Método de pago:</strong> ${methodLabel(data.payment_method)}</div>
      ${itemsTable(data.items)}
      <div style="margin-top:10px;font-size:17px;"><strong>Total: ${money(data.total_usd)}</strong></div>
      ${data.notes ? `<div style="margin-top:8px;color:#5c5357;font-size:13px;">${esc(data.notes)}</div>` : ""}
    `)}
    ${button(`${SITE_URL}/sales?tab=pedidos`, "Revisar y aprobar")}
  `,
});

// ── Crédito ─────────────────────────────────────────────────────────────────
export const createKycApprovedEmail = (data: EmailData) => layout({
  preheader: "Tu crédito fue aprobado",
  title: `¡Felicidades${data.client_name ? `, ${data.client_name}` : ""}!`,
  body: `
    <p>Verificamos tus documentos y tu cuenta ya puede comprar con <strong>Crédito ${esc(BRAND_NAME)}</strong>: pagas una inicial y el resto en cuotas.</p>
    ${button(`${SITE_URL}/tienda`, "Ir a la tienda")}
  `,
});

export const createKycRejectedEmail = (data: EmailData) => layout({
  preheader: "Necesitamos revisar tus documentos",
  title: `Hola${data.client_name ? `, ${data.client_name}` : ""}`,
  body: `
    <p>Revisamos tus documentos pero no pudimos aprobar el crédito por ahora. Verifica que las fotos se lean bien, estén vigentes y coincidan con los datos de tu perfil.</p>
    ${button(`${SITE_URL}/cliente/perfil`, "Volver a enviar documentos")}
  `,
});

/** Abono a crédito reportado por la clienta: aprobado o rechazado por la administración. */
export const createCreditPaymentEmail = (status: "approved" | "rejected", data: EmailData) => {
  const approved = status === "approved";
  return layout({
    preheader: approved ? `Aplicamos tu abono de ${money(data.total_usd)}` : "Revisa tu abono reportado",
    title: approved ? "¡Recibimos tu abono!" : "No pudimos confirmar tu abono",
    body: `
      <p>${data.client_name ? `Hola ${esc(data.client_name)}. ` : ""}${approved
        ? "Verificamos tu pago y ya lo aplicamos a tu crédito. ¡Gracias por estar al día!"
        : `Revisamos el pago que reportaste pero no pudimos confirmarlo.${data.reason ? ` Motivo: <strong>${esc(data.reason)}</strong>.` : ""} Verifica la referencia o escríbenos para ayudarte.`}</p>
      ${box(`
        ${data.total_usd !== undefined ? `<div><strong>Monto:</strong> ${money(data.total_usd)}</div>` : ""}
        ${data.reference ? `<div><strong>Referencia:</strong> ${esc(data.reference)}</div>` : ""}
        ${approved && data.balance_usd !== undefined ? `<div><strong>Saldo pendiente:</strong> ${money(data.balance_usd)}</div>` : ""}
      `)}
      ${button(`${SITE_URL}/cliente/credito`, "Ver mi crédito")}
    `,
  });
};

/** Recordatorios de cuotas y vencimientos del crédito (send-credit-notifications). */
export const createCreditReminderEmail = (title: string, message: string) => layout({
  preheader: title,
  title,
  body: `
    <p>${esc(message)}</p>
    ${button(`${SITE_URL}/cliente/credito`, "Ver mi crédito")}
  `,
});

// ── Notificaciones y facturas automáticas (cola email_outbox) ────────────────
/** Cualquier notificación de la campana, también por correo. */
export const createNotificationEmail = (opts: { title: string; message: string; link: string; linkLabel: string }) => layout({
  preheader: opts.message.slice(0, 120),
  title: opts.title,
  body: `
    <p style="white-space:pre-line;">${esc(opts.message)}</p>
    ${button(`${SITE_URL}${opts.link}`, opts.linkLabel)}
  `,
});

export interface ReceiptEmailData {
  number: string;
  date: string;
  client_name?: string | null;
  payment_method?: string | null;
  items: { name: string; quantity: number; price_usd: number }[];
  total_usd: number;
  total_bs?: number | null;
  credit: boolean;
  paid: number;
  payments: { date: string; method?: string | null; amount_usd: number; amount_bs?: number | null }[];
  /** Si viene, el correo destaca ese abono ("Recibimos tu abono de $X") */
  new_payment_usd?: number;
}

const bsText = (n: number) => `Bs ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Factura de una venta (en tienda o por pedido aprobado), con el detalle de abonos si es a crédito. */
export const createSaleReceiptEmail = (d: ReceiptEmailData) => {
  const balance = Math.max(0, Math.round((d.total_usd - d.paid) * 100) / 100);
  const title = d.new_payment_usd !== undefined ? "Recibimos tu abono" : "Tu factura";
  const intro = d.new_payment_usd !== undefined
    ? `Registramos tu abono de <strong>${money(d.new_payment_usd)}</strong>. Aquí está tu factura actualizada.`
    : `Gracias por tu compra en ${esc(BRAND_NAME)}. Esta es tu factura.`;
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:3px 0;${strong ? "font-weight:bold;font-size:16px;" : ""}">${label}</td><td style="padding:3px 0;text-align:right;${strong ? "font-weight:bold;font-size:16px;" : ""}">${value}</td></tr>`;
  return layout({
    preheader: `${title} ${d.number} · ${money(d.total_usd)}`,
    title,
    body: `
      <p>${d.client_name ? `Hola ${esc(d.client_name)}. ` : ""}${intro}</p>
      ${box(`
        <div style="display:flex;justify-content:space-between;"><strong>Factura ${esc(d.number)}</strong></div>
        <div style="color:#8a7f83;font-size:13px;">${esc(d.date)}${!d.credit && d.payment_method ? ` · ${methodLabel(d.payment_method ?? undefined)}` : ""}</div>
        ${itemsTable(d.items)}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;margin-top:10px;">
          ${row("Total", money(d.total_usd), true)}
          ${d.total_bs ? row("Total en bolívares", bsText(d.total_bs)) : ""}
        </table>
        ${d.credit && d.payments.length ? `
          <div style="margin-top:14px;font-weight:bold;color:${BRAND_COLOR};font-size:12px;letter-spacing:1px;text-transform:uppercase;">Abonos</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;margin-top:4px;">
            ${d.payments.map(p => `<tr>
              <td style="padding:4px 0;border-bottom:1px solid #eadfd3;color:#5c5357;">${esc(p.date)}${p.method ? ` · ${methodLabel(p.method ?? undefined)}` : ""}${p.amount_bs ? ` · ${bsText(p.amount_bs)}` : ""}</td>
              <td style="padding:4px 0;border-bottom:1px solid #eadfd3;text-align:right;white-space:nowrap;">${money(p.amount_usd)}</td>
            </tr>`).join("")}
          </table>` : ""}
        ${d.credit ? `
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;margin-top:10px;">
            ${row("Abonado", money(d.paid))}
            ${row(balance > 0 ? "Saldo pendiente" : "Saldo", balance > 0 ? money(balance) : "Pagada", true)}
          </table>` : ""}
      `)}
      ${button(`${SITE_URL}/cliente/pedidos`, "Ver mis compras")}
    `,
  });
};
