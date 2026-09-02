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
