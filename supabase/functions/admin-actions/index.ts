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

    const { action, userId, newPassword } = await req.json()
    
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

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
