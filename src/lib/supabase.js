import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y complétalo.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Trae la(s) congregación(es) + nivel de rol de la persona logueada —
// esto determina qué ve el sidebar y qué alcance tienen sus consultas.
export async function getMisRoles() {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return { data: [], error: new Error('No autenticado') }

  const { data, error } = await supabase
    .from('roles_sistema')
    .select('id, nivel, rol_local, distrito_id, congregacion_id, personas(nombres, apellidos), distritos(nombre, numero), congregaciones(nombre, ciudad, pastor_nombre, distritos(nombre, numero))')
    .is('fecha_fin', null)

  return { data: data ?? [], error }
}
