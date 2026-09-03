import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import RoleChooser from './RoleChooser'
import NotificationCenter from './NotificationCenter'
import GlobalSearch from './GlobalSearch'
import Footer from '../Footer'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, Lock, UserRound } from 'lucide-react'
import { useMiRol } from '../../hooks/useMiRol'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { calcularEstadoSuscripcion } from '../../lib/suscripciones'
import { formatFecha } from '../../lib/dateFormat'

const RUTAS_PERMITIDAS_BLOQUEADO = ['/perfil', '/soporte', '/manual', '/legal', '/ayuda']

export default function MainLayout() {
  const { roles, rolPrincipal, loading: roleLoading, elegirRol } = useMiRol()
  const { user } = useAuth()
  const [suscripcion, setSuscripcion] = useState(null)
  const [metodoPago, setMetodoPago] = useState(null)
  const [rolElegidoEnSesion, setRolElegidoEnSesion] = useState(() => {
    try {
      return Boolean(sessionStorage.getItem('siga_rol_elegido'))
    } catch {
      return true
    }
  })
  const location = useLocation()
  const navigate = useNavigate()
  const scrollPositions = useRef({})
  const locationKey = `${location.pathname}${location.search}`
  // El censo (personas) es la unica fuente real del nombre cuando la
  // cuenta esta vinculada a una persona -- Mi perfil corrige ese mismo
  // registro, no un nombre paralelo, asi que este siempre debe ganar.
  // Solo las cuentas sin persona vinculada (nacional/distrital puros)
  // usan el nombre guardado en los metadatos de Auth.
  const nombrePersona = roles[0]?.personas
    ? `${roles[0].personas.nombres} ${roles[0].personas.apellidos}`
    : (user?.user_metadata?.nombres ? `${user.user_metadata.nombres} ${user.user_metadata.apellidos || ''}`.trim() : null)

  function confirmarRol(roleId) {
    elegirRol(roleId)
    try {
      sessionStorage.setItem('siga_rol_elegido', '1')
    } catch {
      // sessionStorage no disponible: se volverá a preguntar en la próxima navegación.
    }
    setRolElegidoEnSesion(true)
    navigate('/app')
  }

  useEffect(() => {
    let active = true
    // Solo aplica a local: distrital/nacional/super_admin nunca se
    // bloquean por suscripción, y una congregación sin fila en
    // `suscripciones` sigue sin restricción (ver suscripciones.sql).
    if (rolPrincipal?.nivel !== 'local' || !rolPrincipal?.congregacion_id) {
      setSuscripcion(null)
      return () => { active = false }
    }
    supabase.from('suscripciones').select('*').eq('congregacion_id', rolPrincipal.congregacion_id).maybeSingle()
      .then(({ data }) => { if (active) setSuscripcion(data) })
    return () => { active = false }
  }, [rolPrincipal?.nivel, rolPrincipal?.congregacion_id])

  useEffect(() => {
    let active = true
    const estado = calcularEstadoSuscripcion(suscripcion)
    // El método de pago (Nequi/banco) solo importa cuando hay algo que
    // pagar -- no vale la pena cargarlo para congregaciones al día.
    if (estado !== 'en_gracia' && estado !== 'bloqueada') {
      setMetodoPago(null)
      return () => { active = false }
    }
    supabase.from('metodos_pago_sigap').select('*').maybeSingle()
      .then(({ data }) => { if (active) setMetodoPago(data) })
    return () => { active = false }
  }, [suscripcion])

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    const savedPosition = scrollPositions.current[locationKey] || 0
    const restorePosition = () => {
      window.scrollTo(0, savedPosition)
      document.documentElement.scrollTop = savedPosition
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restorePosition()
        setTimeout(restorePosition, 80)
      })
    })
    const savePosition = () => {
      scrollPositions.current[locationKey] = window.scrollY || document.documentElement.scrollTop
    }
    window.addEventListener('scroll', savePosition, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      savePosition()
      window.removeEventListener('scroll', savePosition)
    }
  }, [locationKey])

  if (!roleLoading && roles.length > 1 && !rolElegidoEnSesion) {
    return <RoleChooser roles={roles} onElegir={confirmarRol} />
  }

  const estadoSuscripcion = calcularEstadoSuscripcion(suscripcion)
  const rutaPermitidaBloqueado = RUTAS_PERMITIDAS_BLOQUEADO.includes(location.pathname)
  const bloqueado = estadoSuscripcion === 'bloqueada' && !rutaPermitidaBloqueado

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <main className="app-main md:ml-[248px] min-h-screen flex flex-col px-4 pb-4 pt-20 md:p-6">
        <header className="main-header sticky top-16 md:top-0 z-20 mb-6 border-b border-border">
          <div className="mx-auto flex max-w-[1220px] items-center justify-between gap-3 py-3.5">
            <div>
              <p className="eyebrow">Panel de control</p>
              <p className="text-sm text-secondary">Panel de gestión pastoral</p>
            </div>

            <GlobalSearch />

            <div className="toolbar">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-secondary">
                <Bell className="w-4 h-4" />
                <span>Notificaciones</span>
              </div>
              <NotificationCenter />
              {nombrePersona && (
                <span className="hidden sm:inline text-sm text-secondary">{nombrePersona}</span>
              )}
              <Link to="/perfil" aria-label="Abrir mi perfil" title="Mi perfil" className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-secondary hover:bg-surface-1 hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/20">
                <UserRound className="w-[18px] h-[18px]" />
                <span>Perfil</span>
              </Link>
            </div>
          </div>
        </header>

        {estadoSuscripcion === 'en_gracia' && (
          <div className="mx-auto max-w-[1220px] w-full mb-4 flex flex-col gap-1.5 rounded-card border border-warning/30 bg-warning-bg px-4 py-2.5 text-sm text-warning" role="alert">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                El pago de esta congregación venció el {formatFecha(suscripcion.fecha_proximo_pago)}. Quedan {suscripcion.dias_gracia} días de gracia antes de que se bloquee el acceso.
              </span>
            </div>
            <MetodoPagoInfo metodoPago={metodoPago} />
          </div>
        )}

        <div className="mx-auto max-w-[1220px] flex-1">
          {bloqueado ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-20">
              <Lock className="w-10 h-10 text-danger" />
              <h1 className="text-lg font-semibold">Acceso bloqueado por falta de pago</h1>
              <p className="text-sm text-secondary max-w-md">
                La suscripción de esta congregación venció el {formatFecha(suscripcion.fecha_proximo_pago)} y el periodo de gracia terminó. Realiza el pago y pide a soporte que lo confirme — solo super_admin puede reactivar el acceso.
              </p>
              <MetodoPagoInfo metodoPago={metodoPago} />
              <div className="flex gap-2 mt-2">
                <Link to="/soporte" className="btn-primary">Ir a Soporte</Link>
                <Link to="/perfil" className="btn-secondary">Mi perfil</Link>
              </div>
            </div>
          ) : (
            <Suspense fallback={<div className="module-loading" role="status"><span className="loading-dot" />Cargando módulo...</div>}>
              {roleLoading ? <div className="module-loading" role="status"><span className="loading-dot" />Preparando tu espacio...</div> : <Outlet />}
            </Suspense>
          )}
        </div>
        <Footer variant="app" />
      </main>
    </div>
  )
}

function MetodoPagoInfo({ metodoPago }) {
  if (!metodoPago) return null
  const tieneNequi = Boolean(metodoPago.nequi_numero)
  const tieneBanco = Boolean(metodoPago.banco_numero)
  if (!tieneNequi && !tieneBanco) return null
  return (
    <p className="text-xs">
      Paga a:{' '}
      {tieneNequi && <>Nequi {metodoPago.nequi_numero}{metodoPago.nequi_titular ? ` (${metodoPago.nequi_titular})` : ''}</>}
      {tieneNequi && tieneBanco && ' · '}
      {tieneBanco && <>{metodoPago.banco_nombre || 'Cuenta bancaria'} {metodoPago.banco_numero}{metodoPago.banco_titular ? ` (${metodoPago.banco_titular})` : ''}</>}
    </p>
  )
}
