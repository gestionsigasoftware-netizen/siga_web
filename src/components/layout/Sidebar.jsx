import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardPlus,
  Users,
  CheckSquare,
  Settings,
  LogOut,
  UserRound,
  Layers3,
  FileBarChart2,
  HeartHandshake,
  ClipboardList,
  UserPlus,
  ArrowRightLeft,
  MapPinned,
  BookOpen,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useMiRol } from "../../hooks/useMiRol";

const NIVEL_LABEL = {
  super_admin: "Super Admin",
  nacional: "Nivel Nacional",
  distrital: "Nivel Distrital",
  local: "Congregación",
};

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useAuth();
  const { rolPrincipal } = useMiRol();
  const nivel = rolPrincipal?.nivel;
  const rolLocal = rolPrincipal?.rol_local || "pastor";
  const puedeConfigurar = nivel === "local" && rolLocal === "pastor";

  const items = [
    { to: "/", label: "Resumen", icon: LayoutDashboard, show: true },
    {
      to: "/feligresia",
      label: "Feligresía",
      icon: HeartHandshake,
      show: nivel === "local",
    },
    {
      to: "/amigos",
      label: "Amigos en ruta",
      icon: Users,
      show: nivel === "local",
    },
    {
      to: "/evangelismo",
      label: "Evangelismo",
      icon: MapPinned,
      show: nivel === "local",
    },
    {
      to: "/mision-juvenil",
      label: "Misión Juvenil",
      icon: BookOpen,
      show: nivel === "local",
    },
    {
      to: "/registrar",
      label: "Corrección / contingencia",
      icon: ClipboardPlus,
      show: nivel === "local",
    },
    {
      to: "/equipo-congregacion",
      label: "Equipo de trabajo",
      icon: UserPlus,
      show: puedeConfigurar,
    },
    {
      to: "/auditoria-feligresia",
      label: "Auditoría de Feligresía",
      icon: ClipboardList,
      show: nivel !== "local" || rolLocal === "pastor",
    },
    {
      to: "/pastoral-distrital",
      label: "Gestión pastoral",
      icon: ArrowRightLeft,
      show: nivel === "distrital",
    },
    {
      to: "/modulos",
      label: "Módulos y actividades",
      icon: Layers3,
      show: nivel === "local",
    },
    { to: "/reportes", label: "Reportes", icon: FileBarChart2, show: true },
    {
      to: "/aprobaciones",
      label: "Aprobaciones",
      icon: CheckSquare,
      show:
        nivel === "distrital" ||
        nivel === "nacional" ||
        nivel === "super_admin",
    },
    {
      to: "/configuracion",
      label: "Configuración local",
      icon: Settings,
      show: puedeConfigurar,
    },
    {
      to: "/configuracion-sistema",
      label: "Preferencias personales",
      icon: Settings,
      show: true,
    },
  ].filter((i) => i.show);

  return (
    <aside className="sidebar-shell w-full md:w-[248px] flex-shrink-0 md:h-screen md:fixed md:left-0 md:top-0 flex flex-col p-3 md:p-4">
      <div className="flex items-center justify-between gap-3 px-2 pb-2 md:pb-5 pt-1">
        <div className="flex items-center gap-3">
          <div className="sidebar-mark w-10 h-10 rounded-xl text-white flex items-center justify-center text-sm font-semibold">
            S
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-white">
              SIGA
            </div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">
              Sistema integrado
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          className="md:hidden p-2 text-white/75 hover:text-white"
          aria-label={mobileOpen ? "Cerrar navegación" : "Abrir navegación"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className={`${mobileOpen ? "block" : "hidden md:flex"} md:flex-1 md:min-h-0 md:flex-col`}>
        {rolPrincipal && (
          <div className="sidebar-profile mb-5 rounded-xl px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                Tu acceso
              </p>
              <span className="sidebar-status" aria-hidden="true" />
            </div>
            <p className="mt-1.5 text-sm font-medium text-white">
              {NIVEL_LABEL[nivel]}
            </p>
            <p className="text-xs text-white/55 truncate">
              {rolPrincipal.congregaciones?.nombre ||
                rolPrincipal.distritos?.nombre ||
                "Acceso general"}
            </p>
          </div>
        )}

        <p className="sidebar-nav-label px-3 mb-2">Navegación</p>
        <nav className="flex flex-row flex-wrap md:flex-col gap-1.5 md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `navbtn ${isActive ? "navbtn-active" : ""}`
              }
            >
              <Icon className="w-[17px] h-[17px]" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={signOut}
          className="navbtn sidebar-signout md:mt-auto mt-4"
        >
          <LogOut className="w-[17px] h-[17px]" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
