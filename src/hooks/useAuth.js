import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = useCallback((email, password) => supabase.auth.signInWithPassword({ email, password }), [])
  const resetPassword = useCallback((email) => supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login?reset=1`,
  }), [])
  const updatePassword = useCallback((password) => supabase.auth.updateUser({ password }), [])
  // Solo para cuentas sin persona vinculada en el censo (ej. nacional o
  // distrital puros) -- cuando SI hay persona vinculada, el nombre se
  // corrige en personas via actualizar_mi_nombre(), no aqui, para no
  // terminar con dos nombres distintos para la misma persona.
  const updateProfile = useCallback((nombres, apellidos) => supabase.auth.updateUser({ data: { nombres, apellidos } }), [])
  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem('siga_rol_elegido')
    } catch {
      // sessionStorage no disponible: no bloquea el cierre de sesión.
    }
    return supabase.auth.signOut()
  }, [])

  return { session, user: session?.user ?? null, loading, signIn, resetPassword, updatePassword, updateProfile, signOut }
}

// Se llama una sola vez, justo al completar un login (ver Login.jsx),
// nunca desde el hook useAuth en si -- useAuth se monta en muchos
// componentes a la vez y duplicaria la lectura/escritura si viviera
// en su listener de onAuthStateChange. Lee el acceso anterior guardado
// (antes de sobrescribirlo) para poder mostrarselo al usuario, y deja
// listo el valor de "ahora" para la proxima vez que entre.
export async function registrarAcceso() {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) return null
  const { data } = await supabase.from('preferencias_usuario').select('ultimo_acceso').eq('usuario_id', userId).maybeSingle()
  const accesoAnterior = data?.ultimo_acceso ?? null
  // acceso_anterior queda "congelado" con este valor durante toda la
  // sesión (para que Configuración lo muestre bien sin importar cuándo
  // se visite) -- ultimo_acceso pasa a ser la hora de este login, listo
  // para convertirse en el "anterior" la próxima vez.
  // Las consultas de supabase-js son "lazy": si esto no se espera (o no
  // se le encadena .then()), la petición nunca se dispara. Se espera
  // para garantizar que sí quede escrita antes de navegar.
  await supabase.from('preferencias_usuario').upsert({ usuario_id: userId, ultimo_acceso: new Date().toISOString(), acceso_anterior: accesoAnterior })
  return accesoAnterior
}
