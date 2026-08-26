import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ClipboardPlus, Users, CheckSquare, Settings, LogOut, UserRound, Layers3, FileBarChart2, HeartHandshake, ClipboardList, UserPlus, ArrowRightLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useMiRol } from '../../hooks/useMiRol'

const NIVEL_LABEL = {
  super_admin: 'Super Admin',
  nacional: 'Nivel Nacional',
  distrital: 'Nivel Distrital',
  local: 'Congregación',
}

export default function Sidebar() {
  const { signOut } = useAuth()
  const { rolPrincipal } = useMiRol()
  const nivel = rolPrincipal?.nivel
  const rolLocal = rolPrincipal?.rol_local || 'pastor'
  const puedeConfigurar = nivel === 'local' && rolLocal === 'pastor'

  const items = [
    { to: '/', label: 'Resumen', icon: LayoutDashboard, show: true },
    { to: '/registrar', label: 'Corrección / contingencia', icon: ClipboardPlus, show: nivel === 'local' },
    { to: '/feligresia', label: 'Feligresía', icon: HeartHandshake, show: nivel === 'local' },
    { to: '/equipo-congregacion', label: 'Equipo de trabajo', icon: UserPlus, show: puedeConfigurar },
    { to: '/auditoria-feligresia', label: 'Auditoría', icon: ClipboardList, show: nivel !== 'local' || rolLocal === 'pastor' },
    { to: '/pastoral-distrital', label: 'Gestión pastoral', icon: ArrowRightLeft, show: nivel === 'distrital' },
    { to: '/modulos', label: 'Módulos y actividades', icon: Layers3, show: nivel === 'local' },
    { to: '/amigos', label: 'Amigos en ruta', icon: Users, show: nivel === 'local' },
    { to: '/reportes', label: 'Reportes', icon: FileBarChart2, show: true },
    { to: '/aprobaciones', label: 'Aprobaciones', icon: CheckSquare, show: nivel === 'distrital' || nivel === 'nacional' || nivel === 'super_admin' },
    { to: '/configuracion', label: 'Configuración', icon: Settings, show: puedeConfigurar },
    { to: '/configuracion-sistema', label: 'Preferencias', icon: Settings, show: true },
  ].filter((i) => i.show)

  return (
    <aside className="sidebar-shell w-full md:w-[248px] flex-shrink-0 md:h-screen md:fixed md:left-0 md:top-0 flex flex-col p-3 md:p-4">
      <div className="flex items-center gap-3 px-2 pb-5 pt-1">
        <div className="sidebar-mark w-10 h-10 rounded-xl text-white flex items-center justify-center text-sm font-semibold">S</div>
        <div>
          <div className="text-sm font-semibold tracking-wide text-white">SIGA</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Sistema integrado</div>
        </div>
      </div>

      {rolPrincipal && (
        <div className="sidebar-profile mb-5 rounded-xl px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Tu acceso</p>
            <span className="sidebar-status" aria-hidden="true" />
          </div>
          <p className="mt-1.5 text-sm font-medium text-white">{NIVEL_LABEL[nivel]}</p>
          <p className="text-xs text-white/55 truncate">
            {rolPrincipal.congregaciones?.nombre || rolPrincipal.distritos?.nombre || 'Acceso general'}
          </p>
        </div>
      )}

      <p className="sidebar-nav-label px-3 mb-2">Navegación</p>
      <nav className="flex flex-row flex-wrap md:flex-col gap-1.5 md:overflow-y-auto">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end className={({ isActive }) => `navbtn ${isActive ? 'navbtn-active' : ''}`}>
            <Icon className="w-[17px] h-[17px]" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button onClick={signOut} className="navbtn sidebar-signout md:mt-auto mt-4">
        <LogOut className="w-[17px] h-[17px]" />
        <span>Cerrar sesión</span>
      </button>
    </aside>
  )
}
