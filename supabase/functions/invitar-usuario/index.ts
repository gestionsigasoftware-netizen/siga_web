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

  const { personId, profileId, moduleId, congregacionId, email } = await request.json()
  if (!personId || !congregacionId || !email || (!profileId && !moduleId)) return response({ error: 'Selecciona al menos un tipo de acceso' }, 400)

  const { data: allowed, error: permissionError } = await userClient.rpc('tiene_permiso', {
    p_congregacion_id: congregacionId,
    p_permiso: 'usuarios.administrar',
  })
  let authorized = !permissionError && Boolean(allowed)
  if (!authorized) {
    const { data: canBootstrap, error: bootstrapError } = await userClient.rpc('distrital_puede_iniciar_congregacion', {
      p_congregacion_id: congregacionId,
      p_persona_id: personId,
    })
    authorized = !bootstrapError && Boolean(canBootstrap)
  }
  if (!authorized) return response({ error: 'No tienes permiso para invitar usuarios' }, 403)

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: actor } = await adminClient
    .from('personas')
    .select('id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()
  const { data: person, error: personError } = await adminClient
    .from('personas')
    .select('id, auth_user_id, congregacion_id')
    .eq('id', personId)
    .eq('congregacion_id', congregacionId)
    .maybeSingle()
  if (personError || !person) return response({ error: 'La persona no pertenece a la congregacion' }, 404)

  let profile = null
  if (profileId) {
    const { data: loadedProfile, error: profileError } = await adminClient
      .from('perfiles_acceso')
      .select('id, codigo')
      .eq('id', profileId)
      .maybeSingle()
    if (profileError || !loadedProfile) return response({ error: 'Perfil no valido' }, 400)
    profile = loadedProfile
  }

  let module = null
  if (moduleId) {
    const { data: loadedModule, error: moduleError } = await adminClient
    .from('modulos')
    .select('id, congregacion_id, nombre_modulo, activo')
    .eq('id', moduleId)
    .eq('congregacion_id', congregacionId)
    .eq('activo', true)
      .maybeSingle()
    if (moduleError || !loadedModule) return response({ error: 'El modulo no pertenece a la congregacion o esta inactivo' }, 400)
    module = loadedModule
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
    })
    if (inviteError || !invited.user) return response({ error: inviteError?.message ?? 'No se pudo enviar la invitacion' }, 400)
    authUser = invited.user
    invitationSent = true
  }

  const { data: linkedPerson, error: linkedPersonError } = await adminClient
    .from('personas')
    .select('id, congregacion_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (linkedPersonError) return response({ error: 'No se pudo verificar el vinculo de la cuenta' }, 500)
  if (linkedPerson && linkedPerson.id !== personId) return response({ error: 'Esta cuenta ya esta vinculada a otra persona' }, 409)

  const { error: linkError } = await adminClient
    .from('personas')
    .update({ auth_user_id: authUser.id })
    .eq('id', personId)
    .eq('congregacion_id', congregacionId)
  if (linkError) return response({ error: 'La invitacion fue creada, pero no se pudo vincular la persona' }, 500)

  const { data: activeRole, error: roleLookupError } = await adminClient
    .from('roles_sistema')
    .select('id')
    .eq('persona_id', personId)
    .eq('congregacion_id', congregacionId)
    .eq('nivel', 'local')
    .is('fecha_fin', null)
    .maybeSingle()
  if (roleLookupError) return response({ error: 'No se pudo verificar la asignacion territorial' }, 500)
  if (!activeRole) {
    const { error: roleError } = await adminClient
      .from('roles_sistema')
      .insert({
        persona_id: personId,
        nivel: 'local',
        congregacion_id: congregacionId,
        rol_local: profile?.codigo === 'pastor' ? 'pastor' : 'solo_lectura',
        asignado_por: userData.user.id,
      })
    if (roleError) return response({ error: 'La cuenta fue vinculada, pero no se pudo asignar la congregacion' }, 500)
  }

  if (module) {
    const { data: existingCargo, error: cargoLookupError } = await adminClient
    .from('cargos')
    .select('id')
    .eq('modulo_id', module.id)
    .eq('nombre_cargo', 'Capturador PWA')
    .maybeSingle()
    if (cargoLookupError) return response({ error: 'No se pudo preparar el cargo del modulo' }, 500)
    let cargoId = existingCargo?.id
    if (!cargoId) {
      const { data: createdCargo, error: cargoError } = await adminClient
      .from('cargos')
      .insert({ modulo_id: module.id, nombre_cargo: 'Capturador PWA' })
      .select('id')
      .single()
      if (cargoError || !createdCargo) return response({ error: 'No se pudo crear el cargo del modulo' }, 500)
      cargoId = createdCargo.id
    }

    const { data: activeCargoAssignment, error: cargoAssignmentLookupError } = await adminClient
    .from('asignaciones_cargo')
    .select('id')
    .eq('cargo_id', cargoId)
    .eq('persona_id', personId)
    .is('fecha_fin', null)
    .maybeSingle()
    if (cargoAssignmentLookupError) return response({ error: 'No se pudo verificar la asignacion del modulo' }, 500)
    if (!activeCargoAssignment) {
      const { error: cargoAssignmentError } = await adminClient
      .from('asignaciones_cargo')
      .insert({ cargo_id: cargoId, persona_id: personId, autorizado_por: actor?.id ?? null })
      if (cargoAssignmentError) return response({ error: 'La cuenta fue vinculada, pero no se pudo asignar el modulo de captura' }, 500)
    }
  }

  if (profile) {
    const { data: activeAssignment, error: assignmentLookupError } = await adminClient
    .from('asignaciones_acceso')
    .select('id')
    .eq('persona_id', personId)
    .eq('congregacion_id', congregacionId)
    .eq('perfil_id', profile.id)
    .is('fecha_fin', null)
    .maybeSingle()
    if (assignmentLookupError) return response({ error: 'No se pudo verificar el perfil asignado' }, 500)
    if (!activeAssignment) {
      const { error: assignmentError } = await adminClient
      .from('asignaciones_acceso')
      .insert({ persona_id: personId, congregacion_id: congregacionId, perfil_id: profile.id, asignado_por: userData.user.id })
      if (assignmentError) return response({ error: 'La cuenta fue vinculada, pero no se pudo asignar el perfil' }, 500)
    }
  }

  return response({ ok: true, profile: profile?.codigo ?? null, module: module?.nombre_modulo ?? null, invitationSent })
})
