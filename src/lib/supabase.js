import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y complétalo.')
}

// storage: sessionStorage (no localStorage, que es el default) -- para
// que cerrar la pestaña/ventana cierre la sesion de verdad. Con
// localStorage la sesion sobrevivia el cierre del navegador
// indefinidamente, lo cual no es lo que se espera en equipos
// compartidos de una congregacion.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: window.sessionStorage },
})

// Trae la(s) congregación(es) + nivel de rol de la persona logueada —
// esto determina qué ve el sidebar y qué alcance tienen sus consultas.
export async function getMisRoles() {
  // getSession() (local, sin red) en vez de getUser() (revalida contra
  // el servidor) -- justo despues de iniciar sesion, esta segunda
  // llamada de red a veces competia con la propagacion del token nuevo
  // y devolvia un 401 intermitente en consola. RLS ya revalida el JWT
  // del lado del servidor en la consulta de abajo, asi que no hace
  // falta revalidarlo aqui tambien.
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData?.session?.user) return { data: [], error: new Error('No autenticado') }

  const { data, error } = await supabase
    .from('roles_sistema')
    .select('id, nivel, rol_local, distrito_id, congregacion_id, personas(nombres, apellidos), distritos(nombre, numero), congregaciones(nombre, ciudad, pastor_nombre, distritos(nombre, numero))')
    .is('fecha_fin', null)

  return { data: data ?? [], error }
}
