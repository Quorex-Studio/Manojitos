import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar token del admin (para asegurarse de que quien llama es admin)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Falta encabezado de autorización' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')

    // Inicializar cliente regular para verificar el rol del usuario que llama
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: { user: adminUser }, error: verifyError } = await supabaseClient.auth.getUser(token)

    if (verifyError || !adminUser) {
      return new Response(JSON.stringify({ error: 'Token inválido', details: verifyError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar si el usuario que llama es admin real (usando app_metadata en lugar de tabla profiles)
    if (adminUser?.app_metadata?.is_super_admin !== true) {
      return new Response(JSON.stringify({ error: 'No autorizado. Se requiere rol de admin.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cliente con Service Role Key para realizar acciones de administración
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!serviceRoleKey) {
        return new Response(JSON.stringify({ error: 'Service Role Key no configurada' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const body = await req.json()
    const { action, userId, newPassword } = body

    // Clienta nueva desde Nueva venta o Ina: cuenta con su correo y SIN contraseña. Ella la crea
    // con "Olvidé mi contraseña" y, al entrar, completa su perfil (profile_pending).
    if (action === 'create_customer') {
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const email = String(body.email ?? '').trim().toLowerCase()
      const fullName = String(body.full_name ?? '').trim().slice(0, 120)
      const phone = String(body.phone ?? '').trim().slice(0, 30) || null
      const dni = String(body.dni ?? '').trim().slice(0, 20) || null
      const address = String(body.address ?? '').trim().slice(0, 300) || null
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'Escribe un correo válido' }, 400)
      if (!fullName) return json({ error: 'Falta el nombre de la clienta' }, 400)

      // Si ya tiene cuenta con ese correo, se usa esa (no se toca su perfil)
      const { data: existingId, error: findError } = await adminClient.rpc('admin_find_user_by_email', { p_email: email })
      if (findError) return json({ error: findError.message }, 500)
      if (existingId) return json({ success: true, user_id: existingId, existing: true })

      // Teléfono o cédula de OTRA cuenta: no se crea (sería un duplicado)
      const { data: taken, error: takenError } = await adminClient.rpc('check_unique_customer_data', { p_phone: phone, p_dni: dni, p_email: email })
      if (takenError) return json({ error: takenError.message }, 500)
      if (taken?.phone_taken) return json({ error: 'Ese teléfono ya pertenece a otra cuenta. Búscala como clienta existente.' }, 409)
      if (taken?.dni_taken) return json({ error: 'Esa cédula ya pertenece a otra cuenta. Búscala como clienta existente.' }, 409)

      const created = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone, dni, address },
        app_metadata: { created_by_admin: true },
      })
      if (created.error || !created.data.user) return json({ error: created.error?.message ?? 'No se pudo crear la cuenta' }, 500)
      return json({ success: true, user_id: created.data.user.id, existing: false })
    }


    if (!userId) {
      return new Response(JSON.stringify({ error: 'ID de usuario es requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let result = null;

    switch (action) {
      case 'suspend':
        // Suspender = bloquear acceso baneando por un tiempo largo
        result = await adminClient.auth.admin.updateUserById(
          userId,
          { ban_duration: '876000h' } // ~100 años
        )
        break;
      
      case 'restore':
        // Quitar ban
        result = await adminClient.auth.admin.updateUserById(
          userId,
          { ban_duration: 'none' }
        )
        break;

      case 'delete':
        // Eliminar por completo de auth.users (cascada borrará customer_profiles si está configurado así)
        result = await adminClient.auth.admin.deleteUser(userId)
        break;
      
      case 'change_password':
        if (!newPassword || newPassword.length < 6) {
          return new Response(JSON.stringify({ error: 'Contraseña inválida (mínimo 6 caracteres)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        result = await adminClient.auth.admin.updateUserById(
          userId,
          { password: newPassword }
        )
        break;
      
      default:
        return new Response(JSON.stringify({ error: 'Acción no reconocida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: true, data: result.data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
