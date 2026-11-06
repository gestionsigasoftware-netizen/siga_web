import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const DEFAULT_PREFERENCIAS = { recibir_notificaciones: true, recibir_alertas: true, formato_fecha: 'DD/MM/AAAA' }
const preferenciasCache = new Map()
const preferenciasRequests = new Map()

// Cachea por usuario igual que useMiRol(). ConfiguracionSistema.jsx dispara
// 'siga:preferencias-actualizadas' al guardar para que el resto de la app se
// entere sin recargar la pagina.
export function usePreferencias() {
  const { user } = useAuth()
  const [preferencias, setPreferencias] = useState(() => user ? preferenciasCache.get(user.id) ?? DEFAULT_PREFERENCIAS : DEFAULT_PREFERENCIAS)

  useEffect(() => {
    let active = true
    if (!user) { setPreferencias(DEFAULT_PREFERENCIAS); return () => { active = false } }

    const cached = preferenciasCache.get(user.id)
    if (cached) { setPreferencias(cached); return () => { active = false } }

    let request = preferenciasRequests.get(user.id)
    if (!request) {
      // getSession() primero (igual que getMisRoles() en lib/supabase.js):
      // justo despues de iniciar sesion, el cliente de Supabase a veces no
      // ha terminado de propagar el token nuevo a sus llamadas internas y
      // esta consulta sale con un 401 intermitente. Eso reduce el problema
      // pero no lo elimina (confirmado con 5 logins seguidos, 1 todavia
      // fallo) -- es una carrera real dentro de supabase-js, no solo orden
      // de llamadas en este archivo. Como esta consulta no es critica
      // (siempre hay un valor por defecto razonable), un reintento corto
      // es mas robusto que perseguir la causa exacta dentro de la libreria.
      const consultar = () => supabase.from('preferencias_usuario').select('recibir_notificaciones, recibir_alertas, formato_fecha').eq('usuario_id', user.id).maybeSingle()
      request = supabase.auth.getSession().then(consultar).then(async (result) => {
        if (result.error) {
          await new Promise((resolve) => setTimeout(resolve, 400))
          result = await consultar()
        }
        const loaded = result.data ?? DEFAULT_PREFERENCIAS
        preferenciasCache.set(user.id, loaded)
        return loaded
      }).finally(() => preferenciasRequests.delete(user.id))
      preferenciasRequests.set(user.id, request)
    }
    request.then((loaded) => { if (active) setPreferencias(loaded) })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    function onUpdated(event) {
      if (!user) return
      preferenciasCache.set(user.id, event.detail)
      setPreferencias(event.detail)
    }
    window.addEventListener('siga:preferencias-actualizadas', onUpdated)
    return () => window.removeEventListener('siga:preferencias-actualizadas', onUpdated)
  }, [user])

  return preferencias
}
