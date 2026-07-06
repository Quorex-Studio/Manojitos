export const createWelcomeEmail = (link?: string) => `
<div style="font-family: 'Quicksand', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #c4607a 0%, #a04961 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-family: 'Playfair Display', serif;">¡Bienvenido a Manojitos!</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(196, 96, 122, 0.08);">
    <h2 style="color: #c4607a; margin-top: 0; font-family: 'Playfair Display', serif;">Nos alegra tenerte aquí</h2>
    <p style="color: #555; line-height: 1.6; font-size: 16px;">
      Tu cuenta ha sido creada exitosamente. Ya puedes acceder a nuestra plataforma, completar tu perfil KYC (si deseas crédito) y realizar tus compras.
    </p>
    ${link ? `
    <div style="text-align: center; margin: 35px 0;">
      <a href="${link}" style="background-color: #c4607a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
        Confirmar mi correo electrónico
      </a>
    </div>
    ` : ''}
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
      <p style="color: #888; font-size: 13px;">Este es un mensaje automático, por favor no respondas a este correo.</p>
    </div>
  </div>
</div>
`;

export const createCheckoutEmail = (data: any) => `
<div style="font-family: 'Quicksand', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #c4607a 0%, #a04961 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-family: 'Playfair Display', serif;">Confirmación de Pedido</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(196, 96, 122, 0.08);">
    <h2 style="color: #c4607a; margin-top: 0; font-family: 'Playfair Display', serif;">¡Gracias por tu compra, ${data?.client_name || ''}!</h2>
    <p style="color: #555; line-height: 1.6; font-size: 16px;">Hemos procesado tu pedido exitosamente.</p>
    
    <div style="background: #fef0f3; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px dashed #c4607a;">
      <h3 style="margin-top: 0; color: #c4607a; font-family: 'Playfair Display', serif;">Detalles de la Compra</h3>
      <ul style="list-style: none; padding: 0; margin: 0; color: #555; font-size: 16px;">
        <li style="margin-bottom: 12px;"><strong>Método de pago:</strong> ${data?.payment_method}</li>
        <li style="margin-bottom: 12px;"><strong>Total:</strong> $${data?.total_usd} USD</li>
        ${data?.notes ? `<li style="margin-top: 12px;"><strong>Notas:</strong> ${data?.notes}</li>` : ''}
      </ul>
    </div>

    <p style="color: #555; line-height: 1.6; font-size: 16px;">Si tienes alguna pregunta sobre tu pedido, no dudes en contactarnos.</p>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
      <p style="color: #888; font-size: 13px;">Manojitos</p>
    </div>
  </div>
</div>
`;

export const createKycApprovedEmail = (data: any) => `
<div style="font-family: 'Quicksand', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #c4607a 0%, #a04961 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-family: 'Playfair Display', serif;">¡Línea de Crédito Aprobada!</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(196, 96, 122, 0.08);">
    <h2 style="color: #c4607a; margin-top: 0; font-family: 'Playfair Display', serif;">Felicidades, ${data?.client_name || ''}</h2>
    <p style="color: #555; line-height: 1.6; font-size: 16px;">Tus documentos de identidad han sido verificados con éxito.</p>
    
    <div style="background: #fef0f3; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px dashed #c4607a; text-align: center;">
      <h3 style="margin-top: 0; color: #c4607a; font-family: 'Playfair Display', serif;">Ya puedes usar "Crédito Manojitos"</h3>
      <p style="margin-bottom: 0; color: #555;">Disfruta de comprar ahora y pagar después.</p>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
      <p style="color: #888; font-size: 13px;">Manojitos</p>
    </div>
  </div>
</div>
`;

export const createKycRejectedEmail = (data: any) => `
<div style="font-family: 'Quicksand', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #555555 0%, #333333 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-family: 'Playfair Display', serif;">Revisión de Documentos</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
    <h2 style="color: #333; margin-top: 0; font-family: 'Playfair Display', serif;">Hola, ${data?.client_name || ''}</h2>
    <p style="color: #555; line-height: 1.6; font-size: 16px;">Hemos revisado tus documentos de identidad pero lamentablemente no pudimos aprobar tu solicitud para línea de crédito en este momento.</p>
    
    <p style="color: #555; line-height: 1.6; font-size: 16px;">
      Por favor, revisa que los documentos subidos sean legibles, estén vigentes y correspondan a tus datos de perfil.
      Puedes volver a intentar subir tus documentos desde tu Perfil de Cliente.
    </p>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
      <p style="color: #888; font-size: 13px;">Manojitos</p>
    </div>
  </div>
</div>
`;

export const createRecoveryEmail = (link: string) => `
<div style="font-family: 'Quicksand', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #c4607a 0%, #a04961 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-family: 'Playfair Display', serif;">Recuperar Contraseña</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(196, 96, 122, 0.08);">
    <p style="color: #555; line-height: 1.6; font-size: 16px;">
      Hemos recibido una solicitud para restablecer tu contraseña en <strong>Manojitos</strong>.
    </p>
    <div style="text-align: center; margin: 35px 0;">
      <a href="${link}" style="background-color: #c4607a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
        Restablecer Contraseña
      </a>
    </div>
    <p style="color: #777; line-height: 1.6; font-size: 14px;">
      Si no solicitaste este cambio, puedes ignorar este correo de forma segura. El enlace expirará pronto.
    </p>
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
      <p style="color: #888; font-size: 13px;">Manojitos</p>
    </div>
  </div>
</div>
`;

export const createMagicLinkEmail = (link: string) => `
<div style="font-family: 'Quicksand', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #c4607a 0%, #a04961 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-family: 'Playfair Display', serif;">Iniciar Sesión</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(196, 96, 122, 0.08);">
    <p style="color: #555; line-height: 1.6; font-size: 16px;">
      Haz clic en el botón de abajo para iniciar sesión de forma segura en <strong>Manojitos</strong>. No necesitas contraseña.
    </p>
    <div style="text-align: center; margin: 35px 0;">
      <a href="${link}" style="background-color: #c4607a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
        Iniciar Sesión Mágica
      </a>
    </div>
    <p style="color: #777; line-height: 1.6; font-size: 14px;">
      Este enlace es de un solo uso y expirará pronto.
    </p>
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
      <p style="color: #888; font-size: 13px;">Manojitos</p>
    </div>
  </div>
</div>
`;

export const createEmailChangeEmail = (link: string) => `
<div style="font-family: 'Quicksand', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #c4607a 0%, #a04961 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-family: 'Playfair Display', serif;">Confirmar Cambio de Correo</h1>
  </div>
  <div style="background: #fff; padding: 40px 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(196, 96, 122, 0.08);">
    <p style="color: #555; line-height: 1.6; font-size: 16px;">
      Se ha solicitado cambiar el correo asociado a tu cuenta en <strong>Manojitos</strong> a esta nueva dirección.
    </p>
    <div style="text-align: center; margin: 35px 0;">
      <a href="${link}" style="background-color: #c4607a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
        Confirmar Nuevo Correo
      </a>
    </div>
    <p style="color: #777; line-height: 1.6; font-size: 14px;">
      Si no solicitaste este cambio, ignora este correo. Tu cuenta seguirá segura con tu dirección anterior.
    </p>
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
      <p style="color: #888; font-size: 13px;">Manojitos</p>
    </div>
  </div>
</div>
`;
