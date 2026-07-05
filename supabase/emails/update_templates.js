/**
 * Supabase Email Templates Configuration Script for Manojitos
 * 
 * Instructions:
 * 1. Get your Supabase Access Token from: https://supabase.com/dashboard/account/tokens
 * 2. Run this script in your terminal:
 *    export SUPABASE_ACCESS_TOKEN="your-access-token"
 *    node supabase/emails/update_templates.js
 * 
 * Or in PowerShell (Windows):
 *    $env:SUPABASE_ACCESS_TOKEN="your-access-token"
 *    node supabase/emails/update_templates.js
 */

const PROJECT_REF = "utfoempgdbhhikpvbvir";

// Base HTML layout for Manojitos brand
const createTemplate = (title, body) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manojitos - ${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Quicksand:wght@300;400;500;600;700&display=swap');
    body {
      font-family: 'Quicksand', sans-serif;
      background-color: #fcf9f9;
      margin: 0;
      padding: 0;
      color: #333333;
    }
    .wrapper {
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(196, 96, 122, 0.08);
    }
    .header {
      background-color: #c4607a;
      padding: 40px 20px;
      text-align: center;
      background-image: linear-gradient(135deg, #c4607a 0%, #a04961 100%);
    }
    .header h1 {
      font-family: 'Playfair Display', serif;
      color: #ffffff;
      margin: 0;
      font-size: 36px;
      font-weight: 600;
      letter-spacing: 1px;
    }
    .content {
      padding: 40px 30px;
      text-align: center;
    }
    .content h2 {
      font-family: 'Playfair Display', serif;
      color: #c4607a;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content p {
      font-size: 16px;
      line-height: 1.6;
      color: #555555;
      margin-bottom: 24px;
    }
    .button {
      display: inline-block;
      background-color: #c9952a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 50px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 15px rgba(201, 149, 42, 0.3);
      margin-bottom: 20px;
    }
    .token-box {
      background-color: #fef0f3;
      border: 1px dashed #c4607a;
      border-radius: 8px;
      padding: 16px;
      font-size: 28px;
      font-weight: 700;
      color: #c4607a;
      letter-spacing: 6px;
      margin: 20px auto;
      max-width: 250px;
    }
    .footer {
      background-color: #f9f9f9;
      padding: 24px;
      text-align: center;
      font-size: 13px;
      color: #888888;
      border-top: 1px solid #eeeeee;
    }
    .footer p {
      margin: 5px 0;
    }
    .ignore-text {
      font-size: 13px;
      color: #999999;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Manojitos</h1>
      </div>
      <div class="content">
        ${body}
      </div>
      <div class="footer">
        <p>© {{ .SiteURL }} - Todos los derechos reservados.</p>
        <p>Este es un correo automático, por favor no respondas.</p>
      </div>
    </div>
  </div>
</body>
</html>
`.replace(/\n/g, '').replace(/\s{2,}/g, ' '); // minify a bit

const templates = {
  // Confirm Signup
  mailer_subjects_confirmation: "Bienvenido a Manojitos - Confirma tu correo",
  mailer_templates_confirmation_content: createTemplate(
    "Confirma tu correo",
    `<h2>¡Hola! Nos alegra tenerte aquí</h2>
    <p>Estás a un solo paso de unirte a la familia Manojitos. Por favor, confirma tu dirección de correo electrónico haciendo clic en el siguiente botón:</p>
    <a href="{{ .ConfirmationURL }}" class="button">Confirmar mi correo</a>
    <p>O si prefieres, usa este código de verificación:</p>
    <div class="token-box">{{ .Token }}</div>
    <p class="ignore-text">Si tú no solicitaste este registro, puedes ignorar este correo de forma segura.</p>`
  ),

  // Magic Link / Sign-in
  mailer_subjects_magic_link: "Tu enlace de acceso a Manojitos",
  mailer_templates_magic_link_content: createTemplate(
    "Acceso a tu cuenta",
    `<h2>Enlace de Acceso Seguro</h2>
    <p>Hemos recibido una solicitud para acceder a tu cuenta. Haz clic en el botón de abajo para iniciar sesión al instante. (Este enlace expirará pronto).</p>
    <a href="{{ .ConfirmationURL }}" class="button">Iniciar Sesión</a>
    <p>O ingresa el siguiente código en la aplicación:</p>
    <div class="token-box">{{ .Token }}</div>
    <p class="ignore-text">Si no solicitaste iniciar sesión, ignora este mensaje.</p>`
  ),

  // Reset Password
  mailer_subjects_recovery: "Restablece tu contraseña de Manojitos",
  mailer_templates_recovery_content: createTemplate(
    "Restablecer Contraseña",
    `<h2>Recuperación de cuenta</h2>
    <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para crear una nueva contraseña segura:</p>
    <a href="{{ .ConfirmationURL }}" class="button">Restablecer Contraseña</a>
    <p>Código de verificación (OTP):</p>
    <div class="token-box">{{ .Token }}</div>
    <p class="ignore-text">Si no solicitaste este cambio, por favor ignora este correo. Tu cuenta sigue estando segura.</p>`
  ),

  // Invite User
  mailer_subjects_invite: "¡Te han invitado a Manojitos!",
  mailer_templates_invite_content: createTemplate(
    "Invitación Especial",
    `<h2>¡Tienes una invitación!</h2>
    <p>Has sido invitado a formar parte de Manojitos. Haz clic en el botón de abajo para aceptar la invitación y configurar tu cuenta:</p>
    <a href="{{ .ConfirmationURL }}" class="button">Aceptar Invitación</a>
    <p class="ignore-text">Si no esperabas esta invitación, puedes ignorarla sin problemas.</p>`
  ),

  // Change Email
  mailer_subjects_email_change: "Confirma tu nuevo correo electrónico - Manojitos",
  mailer_templates_email_change_content: createTemplate(
    "Cambio de Correo",
    `<h2>Verificación de nuevo correo</h2>
    <p>Has solicitado cambiar tu correo electrónico a <strong>{{ .NewEmail }}</strong>. Confirma esta acción haciendo clic en el siguiente botón:</p>
    <a href="{{ .ConfirmationURL }}" class="button">Confirmar nuevo correo</a>
    <p>Código de seguridad (OTP):</p>
    <div class="token-box">{{ .Token }}</div>
    <p class="ignore-text">Si no solicitaste cambiar tu dirección de correo, comunícate con soporte de inmediato.</p>`
  )
};

async function updateTemplates() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error("Error: Falta la variable de entorno SUPABASE_ACCESS_TOKEN.");
    console.log("Obtén tu token en: https://supabase.com/dashboard/account/tokens");
    process.exit(1);
  }

  console.log("Actualizando plantillas de correo en Supabase...");

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templates)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    console.log("✅ ¡Plantillas de correo actualizadas exitosamente!");
    console.log("Puedes ir al Dashboard de Supabase -> Authentication -> Email Templates para verificar los cambios.");
  } catch (error) {
    console.error("❌ Ocurrió un error al actualizar:", error.message);
  }
}

updateTemplates();
