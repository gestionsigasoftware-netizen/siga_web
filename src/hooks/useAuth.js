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
  const signOut = useCallback(() => supabase.auth.signOut(), [])

  return { session, user: session?.user ?? null, loading, signIn, resetPassword, updatePassword, signOut }
}
