import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Inline en vez de importar desde ../_shared/cors.ts: desplegado desde el
// editor web de Supabase (sin CLI local), que solo sube este archivo.
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
const correoSoporte = Deno.env.get('SOPORTE_EMAIL') ?? 'soportesigasoftware@gmail.com'

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Metodo no permitido' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization || !supabaseUrl) return response({ error: 'Solicitud no autorizada' }, 401)

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return response({ error: 'Sesion no valida' }, 401)

  const { reporteId, asunto, descripcion, correoUsuario, pagina, nivel, congregacionNombre } = await request.json()
  if (!reporteId || !asunto || !descripcion) return response({ error: 'Faltan datos' }, 400)

  // Si no hay API key configurada, el reporte ya quedo guardado en la
  // base de datos igual -- el correo es un aviso adicional, no el
  // mecanismo principal. No se rompe el flujo por esto.
  if (!resendApiKey) return response({ ok: true, emailSent: false })

  const html = `
    <p><strong>Nuevo reporte de soporte en SIGAP</strong></p>
    <p><strong>Asunto:</strong> ${asunto}</p>
    <p><strong>De:</strong> ${correoUsuario || 'desconocido'} (${nivel || 'sin nivel'}${congregacionNombre ? ' · ' + congregacionNombre : ''})</p>
    <p><strong>Página:</strong> ${pagina || 'no especificada'}</p>
    <p><strong>Descripción:</strong></p>
    <p>${String(descripcion).replace(/\n/g, '<br>')}</p>
  `

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'SIGAP Soporte <no-reply@sigap.com.co>',
      to: [correoSoporte],
      subject: `[SIGAP] Nuevo reporte: ${asunto}`,
      html,
    }),
  })

  if (!emailResponse.ok) {
    const errorBody = await emailResponse.text()
    return response({ ok: true, emailSent: false, emailError: errorBody })
  }

  return response({ ok: true, emailSent: true })
})
