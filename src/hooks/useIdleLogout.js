import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

// Cierre de sesión automático por inactividad -- protege cuentas que
// alguien deja abiertas horas o días sin darse cuenta (nunca hace
// clic en "Cerrar sesión"). 1 hora sin actividad real (mouse, teclado,
// scroll o touch), con un aviso de 60s antes por si la persona sigue
// ahí pero solo estaba leyendo/pensando -- un clic en "Seguir
// conectado" reinicia el conteo. Sincronizado entre pestañas vía
// localStorage: actividad en cualquier pestaña de SIGAP reinicia el
// conteo en todas, para no cerrar una pestaña activa solo porque otra
// pestaña de SIGAP quedó quieta.
const TIEMPO_INACTIVIDAD_MS = 60 * 60 * 1000
const TIEMPO_AVISO_MS = 60 * 1000
const EVENTOS_ACTIVIDAD = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
const STORAGE_KEY = 'siga_ultima_actividad'

export function useIdleLogout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [segundosParaCierre, setSegundosParaCierre] = useState(null)
  const ultimaActividadRef = useRef(Date.now())
  const ultimaEscrituraRef = useRef(0)
  const cerrandoRef = useRef(false)

  const registrarActividad = useCallback(() => {
    const ahora = Date.now()
    ultimaActividadRef.current = ahora
    // Evita re-render en cada movimiento del mouse: si ya estaba en
    // null (sin aviso visible), React descarta el update igual (misma
    // referencia devuelta).
    setSegundosParaCierre((current) => (current === null ? current : null))
    // localStorage sincroniza entre pestañas, pero escribir en cada
    // mousemove sería excesivo -- una vez cada 5s alcanza de sobra.
    if (ahora - ultimaEscrituraRef.current > 5000) {
      ultimaEscrituraRef.current = ahora
      try { localStorage.setItem(STORAGE_KEY, String(ahora)) } catch {
        // localStorage no disponible (modo privado, etc.): el timeout
        // sigue funcionando por pestaña, solo sin sincronizar entre ellas.
      }
    }
  }, [])

  useEffect(() => {
    EVENTOS_ACTIVIDAD.forEach((evento) => window.addEventListener(evento, registrarActividad, { passive: true }))
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      const valor = Number(event.newValue)
      if (valor > ultimaActividadRef.current) {
        ultimaActividadRef.current = valor
        setSegundosParaCierre((current) => (current === null ? current : null))
      }
    }
    window.addEventListener('storage', onStorage)

    const intervalo = setInterval(() => {
      if (cerrandoRef.current) return
      const restante = TIEMPO_INACTIVIDAD_MS - (Date.now() - ultimaActividadRef.current)
      if (restante <= 0) {
        cerrandoRef.current = true
        // Navegar ANTES de signOut(): si se cierra la sesión primero,
        // ProtectedRoute reacciona al instante (vía onAuthStateChange)
        // y redirige a /login con su propio motivo genérico
        // ("session_expired"), ganándole la carrera a este mensaje más
        // específico de inactividad.
        navigate('/login', { replace: true, state: { reason: 'idle_timeout' } })
        signOut()
      } else if (restante <= TIEMPO_AVISO_MS) {
        setSegundosParaCierre(Math.ceil(restante / 1000))
      }
    }, 1000)

    return () => {
      EVENTOS_ACTIVIDAD.forEach((evento) => window.removeEventListener(evento, registrarActividad))
      window.removeEventListener('storage', onStorage)
      clearInterval(intervalo)
    }
  }, [registrarActividad, signOut, navigate])

  return { segundosParaCierre, seguirConectado: registrarActividad }
}
