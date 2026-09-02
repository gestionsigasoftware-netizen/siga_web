import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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
  if (!authorization || !supabaseUrl || !serviceRoleKey) return response({ error: 'Solicitud no autorizada' }, 401)

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return response({ error: 'Sesion no valida' }, 401)

  const { personId, nivel, distritoId, email } = await request.json()
  if (!personId || !email || !nivel) return response({ error: 'Faltan datos' }, 400)
  if (!['distrital', 'nacional'].includes(nivel)) return response({ error: 'Nivel no valido' }, 400)
  if (nivel === 'distrital' && !distritoId) return response({ error: 'Selecciona un distrito' }, 400)

  const { data: allowed, error: permissionError } = await userClient.rpc('puede_otorgar_rol_jerarquico', { p_nivel: nivel })
  if (permissionError || !allowed) return response({ error: 'No tienes permiso para otorgar este nivel de acceso' }, 403)

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: person, error: personError } = await adminClient
    .from('personas')
    .select('id, auth_user_id, nombres, apellidos')
    .eq('id', personId)
    .maybeSingle()
  if (personError || !person) return response({ error: 'La persona no existe' }, 404)

  if (nivel === 'distrital') {
    const { data: distrito, error: distritoError } = await adminClient
      .from('distritos')
      .select('id')
      .eq('id', distritoId)
      .maybeSingle()
    if (distritoError || !distrito) return response({ error: 'El distrito no existe' }, 404)
  }

  const normalizedEmail = email.trim().toLowerCase()
  let authUser = null
  let invitationSent = false
  if (person.auth_user_id) {
    const { data: existingUser, error: existingUserError } = await adminClient.auth.admin.getUserById(person.auth_user_id)
    if (existingUserError || !existingUser.user || existingUser.user.email?.toLowerCase() !== normalizedEmail) {
      return response({ error: 'La persona ya tiene vinculada otra cuenta de correo' }, 409)
    }
    authUser = existingUser.user
  }
  for (let page = 1; page <= 10 && !authUser; page += 1) {
    const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 })
    if (usersError) return response({ error: 'No se pudo consultar la cuenta de autenticacion' }, 500)
    authUser = usersPage.users.find((user) => user.email?.toLowerCase() === normalizedEmail) ?? null
    if (usersPage.users.length < 1000) break
  }

  if (!authUser) {
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: `${request.headers.get('origin') ?? supabaseUrl}/login`,
      data: { full_name: `${person.nombres} ${person.apellidos}`.trim() },
    })
    if (inviteError || !invited.user) return response({ error: inviteError?.message ?? 'No se pudo enviar la invitacion' }, 400)
    authUser = invited.user
    invitationSent = true
  }

  if (!person.auth_user_id) {
    const { error: linkError } = await adminClient.from('personas').update({ auth_user_id: authUser.id }).eq('id', personId)
    if (linkError) return response({ error: 'La invitacion fue creada, pero no se pudo vincular la persona' }, 500)
  } else if (person.auth_user_id !== authUser.id) {
    return response({ error: 'Esta cuenta ya esta vinculada a otra persona' }, 409)
  }

  let activeRoleQuery = adminClient
    .from('roles_sistema')
    .select('id')
    .eq('persona_id', personId)
    .eq('nivel', nivel)
    .is('fecha_fin', null)
  if (nivel === 'distrital') activeRoleQuery = activeRoleQuery.eq('distrito_id', distritoId)
  const { data: activeRole, error: roleLookupError } = await activeRoleQuery.maybeSingle()
  if (roleLookupError) return response({ error: 'No se pudo verificar el acceso existente' }, 500)

  if (!activeRole) {
    const { error: roleError } = await adminClient
      .from('roles_sistema')
      .insert({
        persona_id: personId,
        nivel,
        distrito_id: nivel === 'distrital' ? distritoId : null,
        asignado_por: userData.user.id,
      })
    if (roleError) return response({ error: 'La cuenta fue vinculada, pero no se pudo asignar el rol' }, 500)
  }

  return response({ ok: true, invitationSent, yaTeniaAcceso: Boolean(activeRole) })
})
