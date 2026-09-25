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
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { useMiRol } from "../../hooks/useMiRol";
import { describirAlcance } from "./RoleChooser";
import sigapLogoWhite from "../../assets/sigap-logo-white.svg";

// Orden fijo de las secciones del sidebar; "inicio" (Resumen) se renderiza
// sin encabezado, como punto de entrada, no como una seccion mas.
const GROUP_ORDER = ["inicio", "feligresia", "evangelismo", "comites", "administracion", "soporte"];

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

function formatDistrictLabel(t, nombre, numero) {
  // Los distritos se identifican solo por numero -- `nombre` es un campo
  // legado de la tabla `distritos` (de antes de que existiera `numero`)
  // que en la práctica quedó con el nombre de una congregación del
  // distrito, no un nombre propio del distrito. No se muestra.
  return numero ? t("sidebar.district", { numero }) : null;
}

export default function Sidebar() {
  const { t } = useTranslation();
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

  const NIVEL_LABEL = {
    super_admin: t("sidebar.levels.super_admin"),
    nacional: t("sidebar.levels.nacional"),
    distrital: t("sidebar.levels.distrital"),
    local: t("sidebar.levels.local"),
  };

  const GROUP_LABELS = {
    feligresia: t("sidebar.groups.feligresia"),
    evangelismo: t("sidebar.groups.evangelismo"),
    comites: t("sidebar.groups.comites"),
    administracion: t("sidebar.groups.administracion"),
    soporte: t("sidebar.groups.soporte"),
  };

  useEffect(() => {
    const distrito = rolPrincipal?.congregaciones?.distritos || rolPrincipal?.distritos;
    setOrganization({
      congregation: rolPrincipal?.congregaciones?.nombre,
      district: formatDistrictLabel(t, distrito?.nombre, distrito?.numero),
      pastor: rolPrincipal?.congregaciones?.pastor_nombre,
    });
  }, [rolPrincipal, t]);

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
    { to: "/app", label: t("sidebar.nav.resumen"), icon: LayoutDashboard, show: true, group: "inicio" },
    {
      to: "/feligresia",
      label: t("sidebar.nav.feligresia"),
      icon: FamilyNetworkIcon,
      show: nivel === "local",
      group: "feligresia",
    },
    {
      to: "/red-familias",
      label: t("sidebar.nav.redFamilias"),
      icon: HeartHandshake,
      show: nivel === "local",
      group: "feligresia",
    },
    {
      to: "/misiones-evangelismo",
      label: t("sidebar.nav.misionesEvangelismo"),
      icon: Compass,
      show: nivel === "local",
      group: "evangelismo",
    },
    {
      to: "/amigos",
      label: t("sidebar.nav.amigosEnRuta"),
      icon: UsersRound,
      show: nivel === "local",
      group: "evangelismo",
    },
    {
      to: "/impacto-misionero",
      label: t("sidebar.nav.impactoMisionero"),
      icon: Globe2,
      show: nivel === "local" || nivel === "distrital" || esAdminNacional,
      group: "evangelismo",
    },
    {
      to: "/mision-juvenil",
      label: t("sidebar.nav.misionJuvenil"),
      icon: BookOpen,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/escuela-dominical",
      label: t("sidebar.nav.escuelaDominical"),
      icon: Baby,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/damas-dorcas",
      label: t("sidebar.nav.damasDorcas"),
      icon: UserRound,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/obra-carcelaria",
      label: t("sidebar.nav.obraCarcelaria"),
      icon: LockKeyhole,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/sepri",
      label: t("sidebar.nav.sepri"),
      icon: ShieldAlert,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/musica",
      label: t("sidebar.nav.musica"),
      icon: Music,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/educacion-artistica",
      label: t("sidebar.nav.educacionArtistica"),
      icon: Palette,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/educacion-teologica",
      label: t("sidebar.nav.educacionTeologica"),
      icon: BookOpenCheck,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/conquistadores",
      label: t("sidebar.nav.conquistadores"),
      icon: Flag,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/obra-social",
      label: t("sidebar.nav.obraSocial"),
      icon: HandHeart,
      show: nivel === "local",
      group: "comites",
    },
    {
      to: "/registrar",
      label: t("sidebar.nav.correccionContingencia"),
      icon: ClipboardPlus,
      show: nivel === "local",
      group: "administracion",
    },
    {
      to: "/equipo-congregacion",
      label: t("sidebar.nav.equipoTrabajo"),
      icon: UserPlus,
      show: puedeConfigurar,
      group: "administracion",
    },
    {
      to: "/auditoria-feligresia",
      label: t("sidebar.nav.auditoriaFeligresia"),
      icon: ClipboardList,
      show: nivel === "local" ? rolLocal === "pastor" : nivel === "distrital" || esAdminNacional,
      group: "administracion",
    },
    {
      to: "/pastoral-distrital",
      label: t("sidebar.nav.gestionPastoral"),
      icon: ArrowRightLeft,
      show: nivel === "distrital",
      group: "administracion",
    },
    {
      to: "/distritos",
      label: t("sidebar.nav.catalogoDistritos"),
      icon: MapPin,
      show: esAdminNacional,
      group: "administracion",
    },
    {
      to: "/gestion-pastoral-nacional",
      label: t("sidebar.nav.gestionPastoralNacional"),
      icon: ArrowRightLeft,
      show: esAdminNacional,
      group: "administracion",
    },
    {
      to: "/comites-nacional",
      label: t("sidebar.nav.comitesNacional"),
      icon: LayoutGrid,
      show: esAdminNacional,
      group: "administracion",
    },
    {
      to: "/suscripciones",
      label: t("sidebar.nav.suscripciones"),
      icon: CreditCard,
      show: nivel === "super_admin",
      group: "administracion",
    },
    {
      to: "/errores-sistema",
      label: t("sidebar.nav.erroresSistema"),
      icon: Bug,
      show: nivel === "super_admin",
      group: "administracion",
    },
    {
      to: "/modulos",
      label: t("sidebar.nav.modulosActividades"),
      icon: Layers3,
      show: puedeConfigurar,
      group: "administracion",
    },
    {
      to: "/aprobaciones",
      label: t("sidebar.nav.aprobaciones"),
      icon: CheckSquare,
      show: nivel === "distrital" || nivel === "super_admin",
      group: "administracion",
    },
    {
      to: "/configuracion",
      label: t("sidebar.nav.configuracionLocal"),
      icon: Settings,
      show: puedeConfigurar,
      group: "administracion",
    },
    { to: "/reportes", label: t("sidebar.nav.reportes"), icon: FileBarChart2, show: true, group: "soporte" },
    { to: "/manual", label: t("sidebar.nav.manual"), icon: BookOpen, show: true, group: "soporte" },
    { to: "/salud-datos", label: t("sidebar.nav.saludDatos"), icon: Database, show: true, group: "soporte" },
    { to: "/soporte", label: t("sidebar.nav.soporte"), icon: LifeBuoy, show: true, group: "soporte" },
    { to: "/solicitudes", label: t("sidebar.nav.solicitudesInternas"), icon: Send, show: true, group: "soporte" },
    {
      to: "/configuracion-sistema",
      label: t("sidebar.nav.preferenciasPersonales"),
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
              {t("sidebar.tagline")}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          className="md:hidden p-2 text-white/75 hover:text-white"
          aria-label={mobileOpen ? t("sidebar.closeNav") : t("sidebar.openNav")}
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
                {t("sidebar.yourAccess")}
              </p>
              <span className="sidebar-status" aria-hidden="true" />
            </div>
            <p className="mt-1.5 text-sm font-medium text-white">
              {NIVEL_LABEL[nivel]}
            </p>
            <p className="text-xs text-white/75 truncate">
              {organization?.congregation || t("sidebar.generalAccess")}
            </p>
            {organization?.pastor && (
              <p className="text-[11px] text-white/60 truncate">
                {t("sidebar.pastor")}: {organization.pastor}
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
                  {t("sidebar.changeRole")}
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
              <p className="sidebar-nav-label px-3 mb-2">{t("sidebar.loadingNav")}</p>
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
          <span>{t("sidebar.signOut")}</span>
        </button>
      </div>
    </aside>
  );
}
