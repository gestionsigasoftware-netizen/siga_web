import { useEffect, useState } from 'react'
import { getMisRoles } from '../lib/supabase'
import { useAuth } from './useAuth'

// Resuelve el nivel MÁS ALTO de la persona (super_admin > nacional > distrital > local)
// y su alcance — esto decide qué ve el sidebar y qué pantallas están disponibles.
const PRIORIDAD = { super_admin: 0, nacional: 1, distrital: 2, local: 3 }
const rolesCache = new Map()
const rolesRequests = new Map()

function rolActivoKey(userId) {
  return `siga_rol_activo:${userId}`
}

function leerRolActivoGuardado(userId) {
  try {
    return localStorage.getItem(rolActivoKey(userId))
  } catch {
    return null
  }
}

export function useMiRol() {
  const { user } = useAuth()
  const [roles, setRoles] = useState(() => user ? rolesCache.get(user.id) ?? [] : [])
  const [loading, setLoading] = useState(() => Boolean(user) && !rolesCache.has(user.id))
  const [rolActivoId, setRolActivoId] = useState(() => user ? leerRolActivoGuardado(user.id) : null)

  useEffect(() => {
    let active = true
    if (!user) {
      setRoles([])
      setLoading(false)
      return () => { active = false }
    }

    const cachedRoles = rolesCache.get(user.id)
    if (cachedRoles) {
      setRoles(cachedRoles)
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    let request = rolesRequests.get(user.id)
    if (!request) {
      request = getMisRoles().then(({ data }) => {
        const loadedRoles = data ?? []
        rolesCache.set(user.id, loadedRoles)
        return loadedRoles
      }).finally(() => rolesRequests.delete(user.id))
      rolesRequests.set(user.id, request)
    }

    request.then((loadedRoles) => {
      if (!active) return
      setRoles(loadedRoles)
      setLoading(false)
    })

    return () => { active = false }
  }, [user])

  useEffect(() => {
    function actualizarRolActivo() {
      setRolActivoId(user ? leerRolActivoGuardado(user.id) : null)
    }
    // Al montar (o cuando `user` pasa de null a resuelto, ej. tras una
    // recarga completa de página) hay que releer el rol guardado: el
    // useState inicial de rolActivoId solo se evalúa una vez, cuando `user`
    // todavía es null mientras useAuth resuelve la sesión — sin este efecto,
    // el rol activo guardado se pierde en cada recarga y cae siempre al de
    // mayor prioridad (ej. vuelve a "distrital" aunque se eligió "local").
    actualizarRolActivo()
    window.addEventListener('siga:rol-activo-cambiado', actualizarRolActivo)
    return () => window.removeEventListener('siga:rol-activo-cambiado', actualizarRolActivo)
  }, [user])

  function elegirRol(roleId) {
    if (!user) return
    try {
      localStorage.setItem(rolActivoKey(user.id), roleId)
    } catch {
      // localStorage no disponible: el rol activo solo dura esta renderización.
    }
    setRolActivoId(roleId)
    window.dispatchEvent(new CustomEvent('siga:rol-activo-cambiado'))
  }

  const rolGuardado = rolActivoId ? roles.find((role) => role.id === rolActivoId) : null
  const rolPrincipal = rolGuardado ?? [...roles].sort((a, b) => PRIORIDAD[a.nivel] - PRIORIDAD[b.nivel])[0] ?? null

  return { roles, rolPrincipal, loading, elegirRol }
}
