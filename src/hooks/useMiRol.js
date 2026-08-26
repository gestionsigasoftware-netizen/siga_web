import { useState, useEffect } from 'react'
import { getMisRoles } from '../lib/supabase'
import { useAuth } from './useAuth'

// Resuelve el nivel MÁS ALTO de la persona (super_admin > nacional > distrital > local)
// y su alcance — esto decide qué ve el sidebar y qué pantallas están disponibles.
const PRIORIDAD = { super_admin: 0, nacional: 1, distrital: 2, local: 3 }

export function useMiRol() {
  const { user } = useAuth()
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getMisRoles().then(({ data }) => { setRoles(data); setLoading(false) })
  }, [user])

  const rolPrincipal = [...roles].sort((a, b) => PRIORIDAD[a.nivel] - PRIORIDAD[b.nivel])[0] ?? null

  return { roles, rolPrincipal, loading }
}
