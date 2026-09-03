import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import RoleChooser from './RoleChooser'
import NotificationCenter from './NotificationCenter'
import GlobalSearch from './GlobalSearch'
import Footer from '../Footer'
import { Link } from 'react-router-dom'
import { Bell, UserRound } from 'lucide-react'
import { useMiRol } from '../../hooks/useMiRol'
import { useAuth } from '../../hooks/useAuth'

export default function MainLayout() {
  const { roles, loading: roleLoading, elegirRol } = useMiRol()
  const { user } = useAuth()
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

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <main className="app-main md:ml-[248px] min-h-screen p-4 md:p-6">
        <header className="main-header sticky top-0 z-20 mb-6 border-b border-border">
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

        <div className="mx-auto max-w-[1220px]">
          <Suspense fallback={<div className="module-loading" role="status"><span className="loading-dot" />Cargando módulo...</div>}>
            {roleLoading ? <div className="module-loading" role="status"><span className="loading-dot" />Preparando tu espacio...</div> : <Outlet />}
          </Suspense>
        </div>
        <Footer variant="app" />
      </main>
    </div>
  )
}
