import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardPlus,
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
  Heart,
  UsersRound,
  BookOpen,
  Compass,
  Menu,
  X,
  MapPin,
  Repeat,
  Baby,
  LockKeyhole,
  ShieldAlert,
  Music,
  Palette,
  BookOpenCheck,
  Flag,
  HandHeart,
  Globe2,
  LayoutGrid,
  LifeBuoy,
  Send,
  Database,
  CreditCard,
  Bug,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useMiRol } from "../../hooks/useMiRol";
import { describirAlcance } from "./RoleChooser";
import sigapLogoWhite from "../../assets/sigap-logo-white.svg";

const NIVEL_LABEL = {
  super_admin: "Super Admin",
  nacional: "Nivel Nacional",
  distrital: "Nivel Distrital",
  local: "Congregación",
};

// Orden fijo de las secciones del sidebar; "inicio" (Resumen) se renderiza
// sin encabezado, como punto de entrada, no como una seccion mas.
const GROUP_ORDER = ["inicio", "feligresia", "evangelismo", "comites", "administracion", "soporte"];
const GROUP_LABELS = {
  feligresia: "Feligresía",
  evangelismo: "Evangelismo y misión",
  comites: "Comités y ministerios",
  administracion: "Administración",
  soporte: "Información y soporte",
};

function FamilyNetworkIcon({ className }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className || ""}`} aria-hidden="true">
      <Heart className="absolute inset-0 h-full w-full" strokeWidth={1.8} />
      <UsersRound className="relative h-[58%] w-[58%]" strokeWidth={2.2} />
    </span>
  );
}

// Mientras el rol todavia se esta cargando (justo tras iniciar sesion o al
// recargar la pagina), rolPrincipal es null y todos los items con
// show: nivel === '...' se ocultan -- sin este skeleton, el sidebar
// mostraba por un instante un menu real pero reducido (parece un perfil
// sin permisos, en vez de leerse como "cargando").
function SidebarNavSkeleton() {
  const anchos = [85, 70, 90, 65, 80, 60, 75, 55];
  return (
    <div className="flex flex-col gap-1.5 w-full" aria-hidden="true">
      {anchos.map((ancho, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
          <div className="w-4 h-4 rounded bg-white/10 flex-shrink-0" />
          <div className="h-3 rounded bg-white/10" style={{ width: `${ancho}%` }} />
        </div>
      ))}
    </div>
  );
}

function formatDistrictLabel(nombre, numero) {
  // Los distritos se identifican solo por numero -- `nombre` es un campo
  // legado de la tabla `distritos` (de antes de que existiera `numero`)
  // que en la práctica quedó con el nombre de una congregación del
  // distrito, no un nombre propio del distrito. No se muestra.
  return numero ? `Distrito ${numero}` : null;
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [organization, setOrganization] = useState(null);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { roles, rolPrincipal, loading: rolLoading, elegirRol } = useMiRol();
  const nivel = rolPrincipal?.nivel;
  const rolLocal = rolPrincipal?.rol_local || "pastor";
  const puedeConfigurar = nivel === "local" && rolLocal === "pastor";
  const esAdminNacional = nivel === "nacional" || nivel === "super_admin";

  useEffect(() => {
    const distrito = rolPrincipal?.congregaciones?.distritos || rolPrincipal?.distritos;
    setOrganization({
      congregation: rolPrincipal?.congregaciones?.nombre,
      district: formatDistrictLabel(distrito?.nombre, distrito?.numero),
      pastor: rolPrincipal?.congregaciones?.pastor_nombre,
    });
  }, [rolPrincipal]);

  useEffect(() => {
    function updateOrganization(event) {
      // Combina en vez de reemplazar: el evento de Configuracion local solo
      // trae congregation/district, y reemplazar todo el objeto borraria el
      // pastor (que no cambia desde esa pantalla) hasta la proxima recarga.
      setOrganization((current) => ({ ...current, ...event.detail }));
    }

    window.addEventListener("siga:organizacion-actualizada", updateOrganization);
    return () => window.removeEventListener("siga:organizacion-actualizada", updateOrganization);
  }, []);

  const items = [
    { to: "/app", label: "Resumen", icon: LayoutDashboard, show: true, group: "inicio" },
    {
      to: "/feligresia",
      label: "Feligresía",
      icon: FamilyNetworkIcon,
      show: nivel === "local",
      group: "feligresia",
    },
    {
      to: "/red-familias",
      label: "Red de Familias",
      icon: HeartHandshake,
      show: nivel === "local",
      group: "feligresia",
    },
    {
      to: "/misiones-evangelismo",
      label: "Misiones y Evangelismo",
      icon: Compass,
      show: nivel === "local",
      group: "evangelismo",
    },
    {
      to: "/amigos",
      label: "Amigos en ruta",
      icon: UsersRound,
      show: nivel === "local",
      group: "evangelismo",
    },
    {
      to: "/impacto-misionero",
      label: "Impacto Misionero",
      icon: Globe2,
      show: nivel === "local" || nivel === "distrital" || esAdminNacional,
      group: "evangelismo",
    },
    {
      to: "/mision-juvenil",
      label: "Misión Juvenil",
      icon: BookOpen,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/escuela-dominical",
      label: "Escuela Dominical",
      icon: Baby,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/damas-dorcas",
      label: "Damas Dorcas",
      icon: UserRound,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/obra-carcelaria",
      label: "Obra Carcelaria",
      icon: LockKeyhole,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/sepri",
      label: "SEPRI",
      icon: ShieldAlert,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/musica",
      label: "Música",
      icon: Music,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/educacion-artistica",
      label: "Educación Artística",
      icon: Palette,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/educacion-teologica",
      label: "Educación Teológica",
      icon: BookOpenCheck,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/conquistadores",
      label: "Conquistadores Pentecostales",
      icon: Flag,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/obra-social",
      label: "Obra Social",
      icon: HandHeart,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/registrar",
      label: "Corrección / contingencia",
      icon: ClipboardPlus,
      show: nivel === "local",
      group: "administracion",
    },
    {
      to: "/equipo-congregacion",
      label: "Equipo de trabajo",
      icon: UserPlus,
      show: puedeConfigurar,
      group: "administracion",
    },
    {
      to: "/auditoria-feligresia",
      label: "Auditoría de Feligresía",
      icon: ClipboardList,
      show: nivel === "local" ? rolLocal === "pastor" : nivel === "distrital" || esAdminNacional,
      group: "administracion",
    },
    {
      to: "/pastoral-distrital",
      label: "Gestión pastoral",
      icon: ArrowRightLeft,
      show: nivel === "distrital",
      group: "administracion",
    },
    {
      to: "/distritos",
      label: "Catálogo de distritos",
      icon: MapPin,
      show: esAdminNacional,
      group: "administracion",
    },
    {
      to: "/gestion-pastoral-nacional",
      label: "Gestión Pastoral Nacional",
      icon: ArrowRightLeft,
      show: esAdminNacional,
      group: "administracion",
    },
    {
      to: "/comites-nacional",
      label: "Comités Nacional",
      icon: LayoutGrid,
      show: esAdminNacional,
      group: "administracion",
    },
    {
      to: "/suscripciones",
      label: "Suscripciones",
      icon: CreditCard,
      show: nivel === "super_admin",
      group: "administracion",
    },
    {
      to: "/errores-sistema",
      label: "Errores del sistema",
      icon: Bug,
      show: nivel === "super_admin",
      group: "administracion",
    },
    {
      to: "/modulos",
      label: "Módulos y actividades",
      icon: Layers3,
      show: puedeConfigurar,
      group: "administracion",
    },
    {
      to: "/aprobaciones",
      label: "Aprobaciones",
      icon: CheckSquare,
      show: nivel === "distrital" || nivel === "super_admin",
      group: "administracion",
    },
    {
      to: "/configuracion",
      label: "Configuración local",
      icon: Settings,
      show: puedeConfigurar,
      group: "administracion",
    },
    { to: "/reportes", label: "Reportes", icon: FileBarChart2, show: true, group: "soporte" },
    { to: "/manual", label: "Manual de uso", icon: BookOpen, show: true, group: "soporte" },
    { to: "/salud-datos", label: "Salud de datos", icon: Database, show: true, group: "soporte" },
    { to: "/soporte", label: "Soporte", icon: LifeBuoy, show: true, group: "soporte" },
    { to: "/solicitudes", label: "Solicitudes internas", icon: Send, show: true, group: "soporte" },
    {
      to: "/configuracion-sistema",
      label: "Preferencias personales",
      icon: Settings,
      show: true,
      group: "soporte",
    },
  ].filter((i) => i.show);

  // Agrupa la navegacion por secciones (en vez de una lista plana de hasta 27
  // items para el rol local) -- cada grupo solo aparece con encabezado si
  // tiene al menos un item visible para el rol/permiso actual, asi que
  // distrital/nacional/super_admin (con muchos menos items) no ven grupos
  // vacios ni encabezados de mas.
  const groupedItems = GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    items: items.filter((item) => item.group === group),
  })).filter((section) => section.items.length > 0);

  return (
    <aside className={`sidebar-shell w-full flex-shrink-0 fixed left-0 right-0 top-0 z-50 flex flex-col p-3 md:w-[248px] md:right-auto md:h-dvh md:p-4 ${mobileOpen ? "h-dvh" : "h-16"}`}>
      <div className="flex items-center justify-between gap-3 px-2 h-16 md:h-auto md:pt-1 md:pb-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <img src={sigapLogoWhite} alt="SIGAP" className="h-6 w-auto" />
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/45 mt-1">
              Gestión y Analítica Pastoral
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

      <div className={`${mobileOpen ? "flex" : "hidden md:flex"} flex-col flex-1 min-h-0 overflow-y-auto md:overflow-visible`}>
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
            <p className="text-xs text-white/75 truncate">
              {organization?.congregation || "Acceso general"}
            </p>
            {organization?.pastor && (
              <p className="text-[11px] text-white/60 truncate">
                Pastor: {organization.pastor}
              </p>
            )}
            {organization?.district && (
              <p className="text-[11px] text-white/45 truncate">
                {organization.district}
              </p>
            )}
            {roles.length > 1 && (
              <div className="mt-2.5 pt-2.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setRoleSwitcherOpen((current) => !current)}
                  className="flex items-center gap-1.5 text-[11px] text-white/60 hover:text-white"
                >
                  <Repeat className="w-3 h-3" />
                  Cambiar de rol
                </button>
                {roleSwitcherOpen && (
                  <div className="mt-2 flex flex-col gap-1">
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          elegirRol(role.id);
                          setRoleSwitcherOpen(false);
                          navigate("/app");
                        }}
                        disabled={role.id === rolPrincipal?.id}
                        className={`text-left text-[11px] rounded px-2 py-1.5 ${role.id === rolPrincipal?.id ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
                      >
                        <span className="block font-medium">{NIVEL_LABEL[role.nivel] || role.nivel}</span>
                        <span className="block text-white/50">{describirAlcance(role)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <nav className="flex flex-col gap-1.5 w-full overflow-x-hidden md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1">
          {rolLoading ? (
            <>
              <p className="sidebar-nav-label px-3 mb-2">Navegación</p>
              <SidebarNavSkeleton />
            </>
          ) : (
            groupedItems.map((section, sectionIndex) => (
              <div key={section.group} className={sectionIndex > 0 ? "mt-3" : undefined}>
                {section.label && (
                  <p className="sidebar-nav-label px-3 mb-2">{section.label}</p>
                )}
                <div className="flex flex-col gap-1.5">
                  {section.items.map(({ to, label, icon: Icon }) => (
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
                </div>
              </div>
            ))
          )}
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
