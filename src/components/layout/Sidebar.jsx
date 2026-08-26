import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ClipboardPlus, Users, CheckSquare, Settings, LogOut, UserRound, Layers3, FileBarChart2, HeartHandshake, ClipboardList } from 'lucide-react'
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
    { to: '/registrar', label: 'Registrar asistencia', icon: ClipboardPlus, show: nivel === 'local' },
    { to: '/feligresia', label: 'Feligresía', icon: HeartHandshake, show: nivel === 'local' },
    { to: '/auditoria-feligresia', label: 'Auditoría', icon: ClipboardList, show: nivel !== 'local' || rolLocal === 'pastor' },
    { to: '/modulos', label: 'Módulos y actividades', icon: Layers3, show: nivel === 'local' },
    { to: '/amigos', label: 'Amigos en ruta', icon: Users, show: nivel === 'local' },
    { to: '/reportes', label: 'Reportes', icon: FileBarChart2, show: true },
    { to: '/aprobaciones', label: 'Aprobaciones', icon: CheckSquare, show: nivel === 'distrital' || nivel === 'nacional' || nivel === 'super_admin' },
    { to: '/configuracion', label: 'Configuración', icon: Settings, show: puedeConfigurar },
    { to: '/configuracion-sistema', label: 'Preferencias', icon: Settings, show: true },
  ].filter((i) => i.show)

  return (
    <aside className="w-full md:w-[220px] flex-shrink-0 bg-surface-1 border-b md:border-b-0 md:border-r border-border md:h-screen md:fixed md:left-0 md:top-0 flex flex-col p-3">
      <div className="flex items-center gap-2 px-2 pb-4">
        <div className="w-7 h-7 rounded bg-ink text-white flex items-center justify-center text-xs font-medium">S</div>
        <span className="font-medium">SIGA</span>
      </div>
      {rolPrincipal && (
        <p className="text-xs text-muted px-2 pb-4">
          {NIVEL_LABEL[nivel]}
          {rolPrincipal.congregaciones?.nombre && ` — ${rolPrincipal.congregaciones.nombre}`}
          {rolPrincipal.distritos?.nombre && ` — ${rolPrincipal.distritos.nombre}`}
        </p>
      )}

      <nav className="flex flex-row flex-wrap md:flex-col gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end className={({ isActive }) => `navbtn ${isActive ? 'navbtn-active' : ''}`}>
            <Icon className="w-[17px] h-[17px]" /> {label}
          </NavLink>
        ))}
      </nav>

      <button onClick={signOut} className="navbtn md:mt-auto">
        <LogOut className="w-[17px] h-[17px]" /> Cerrar sesión
      </button>
    </aside>
  )
}
