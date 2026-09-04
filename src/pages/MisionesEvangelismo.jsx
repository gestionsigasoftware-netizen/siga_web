import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, CheckCircle2, Compass, GraduationCap, HeartHandshake, MapPinned, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import { SkeletonCard, SkeletonStatTiles } from "../components/Skeleton";

const metricsCache = new Map();

const SUBMODULES = [
  {
    to: "/evangelismo",
    title: "Métodos y territorio",
    description: "Caracterización local, zonas, metodologías y resultados evangelísticos.",
    label: "Métodos",
    icon: MapPinned,
    codigo: "metodos",
  },
  {
    to: "/uno-mas",
    title: "Uno Más",
    description: "Activa a cada creyente para adoptar en oración y contacto personal a una persona.",
    label: "Sensibilización y tarea de todos",
    icon: UsersRound,
    codigo: "uno_mas",
  },
  {
    to: "/bis",
    title: "BIS",
    description: "Registra la bienvenida, atención, contacto posterior e integración de cada amigo.",
    label: "Bienvenida, integración y seguimiento",
    icon: UsersRound,
    codigo: "bis",
  },
  {
    to: "/refam",
    title: "REFAM",
    description: "Reunión Familiar y de Amistad como estrategia de Misiones y Evangelismo.",
    label: "Reunión Familiar y de Amistad",
    icon: HeartHandshake,
    codigo: "refam",
  },
  {
    to: "/esfob",
    title: "ESFOB / EFOB",
    description: "Prepara doctrinalmente a la persona para el pacto del bautismo.",
    label: "Formación bautismal",
    icon: GraduationCap,
    codigo: "esfob",
  },
  {
    to: "/discipulado",
    title: "Discipulado",
    description: "Acompaña la maduración espiritual y prepara para el servicio.",
    label: "Formar para enviar",
    icon: Compass,
    codigo: "discipulado",
  },
];

const ROUTE_STATIONS = [
  { codigo: "metodos", nombre: "Métodos", color: "bg-accent" },
  { codigo: "uno_mas", nombre: "Uno Más", color: "bg-warning" },
  { codigo: "bis", nombre: "BIS", color: "bg-success" },
  { codigo: "refam", nombre: "REFAM", color: "bg-accent" },
  { codigo: "esfob", nombre: "ESFOB / EFOB", color: "bg-warning" },
  { codigo: "discipulado", nombre: "Discipulado", color: "bg-success" },
];

const INITIAL_METRICS = {
  active: 0,
  completed: 0,
  friends: 0,
  refamAttendance: 0,
  esfobActive: 0,
  discipuladoActive: 0,
  stationCounts: {},
};

export default function MisionesEvangelismo() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadMetrics() {
      if (!congregacionId) {
        setLoading(false);
        return;
      }
      const cached = metricsCache.get(congregacionId);
      if (cached) {
        setMetrics(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);
      const [processResult, friendsResult, refamResult, esfobResult, discipuladoResult] = await Promise.all([
        supabase
          .from("ruta_procesos")
          .select("estado, estacion:ruta_estaciones!ruta_procesos_estacion_id_fkey(codigo)")
          .eq("congregacion_id", congregacionId),
        supabase
          .from("amigos")
          .select("id", { count: "exact", head: true })
          .eq("congregacion_id", congregacionId)
          .eq("convertido", false),
        supabase
          .from("refam_reuniones")
          .select("asistentes")
          .eq("congregacion_id", congregacionId),
        supabase
          .from("esfob_procesos")
          .select("id", { count: "exact", head: true })
          .eq("congregacion_id", congregacionId)
          .eq("estado", "en_formacion"),
        supabase
          .from("discipulado_procesos")
          .select("id", { count: "exact", head: true })
          .eq("congregacion_id", congregacionId)
          .eq("estado", "activo"),
      ]);
      const failed = [processResult, friendsResult, refamResult, esfobResult, discipuladoResult].find((result) => result.error);
      if (failed) {
        setError("No se pudieron cargar las métricas de la Ruta. Intenta nuevamente o contacta al administrador.");
        setLoading(false);
        return;
      }
      const stationCounts = (processResult.data ?? []).reduce((totals, process) => {
        const code = process.estacion?.codigo;
        if (code) totals[code] = (totals[code] || 0) + 1;
        return totals;
      }, {});
      const newMetrics = {
        active: (processResult.data ?? []).filter((process) => process.estado === "activo").length,
        completed: (processResult.data ?? []).filter((process) => process.estado === "completado").length,
        friends: friendsResult.count ?? 0,
        refamAttendance: (refamResult.data ?? []).reduce((total, meeting) => total + Number(meeting.asistentes || 0), 0),
        esfobActive: esfobResult.count ?? 0,
        discipuladoActive: discipuladoResult.count ?? 0,
        stationCounts,
      };
      metricsCache.set(congregacionId, newMetrics);
      setMetrics(newMetrics);
      setLoading(false);
    }
    loadMetrics();
  }, [congregacionId]);

  const maxStationCount = Math.max(1, ...ROUTE_STATIONS.map((station) => metrics.stationCounts[station.codigo] || 0));
  const totalProcesses = metrics.active + metrics.completed;
  const activeRate = totalProcesses ? Math.round((metrics.active / totalProcesses) * 100) : 0;
  const completedRate = totalProcesses ? Math.round((metrics.completed / totalProcesses) * 100) : 0;
  const refamRate = metrics.friends ? Math.min(100, Math.round((metrics.refamAttendance / metrics.friends) * 100)) : 0;
  const esfobRate = metrics.friends ? Math.min(100, Math.round((metrics.esfobActive / metrics.friends) * 100)) : 0;
  const discipuladoRate = metrics.esfobActive ? Math.min(100, Math.round((metrics.discipuladoActive / metrics.esfobActive) * 100)) : 0;
  const decision = metrics.discipuladoActive
    ? { title: "Sostén el discipulado", text: `${metrics.discipuladoActive} persona${metrics.discipuladoActive === 1 ? " está" : "s están"} en acompañamiento. Revisa mentoría, objetivos y servicio actual para mantener su crecimiento.`, to: "/discipulado", action: "Abrir Discipulado" }
    : metrics.esfobActive
      ? { title: "Prepara el siguiente paso", text: `${metrics.esfobActive} persona${metrics.esfobActive === 1 ? " está" : "s están"} en formación bautismal. Revisa su avance y fecha prevista para acompañar la continuidad.`, to: "/esfob", action: "Abrir ESFOB / EFOB" }
      : metrics.friends
        ? { title: "Activa el acompañamiento", text: `${metrics.friends} amigo${metrics.friends === 1 ? " requiere" : "s requieren"} seguimiento. Prioriza la próxima acción y registra su avance en la ruta.`, to: "/amigos", action: "Abrir Amigos en ruta" }
        : { title: "Inicia la ruta", text: "Aún no hay personas en proceso. Registra el primer contacto para comenzar el acompañamiento.", to: "/uno-mas", action: "Registrar primer contacto" };

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Ruta Evangelística</p>
          <h1 className="section-title">Misiones y Evangelismo</h1>
          <p className="text-sm text-secondary mt-1 max-w-2xl">
            Gestiona el acompañamiento de cada persona desde el primer contacto hasta su formación y crecimiento.
          </p>
        </div>
        <span className="chart-highlight">6 estaciones · una ruta</span>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {roleLoading || loading ? (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="Cargando indicadores de la ruta">
            <SkeletonStatTiles count={6} />
          </section>
          <SkeletonCard lines={6} />
        </>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="Indicadores de la ruta">
            <Metric icon={BarChart3} label="Procesos activos" value={metrics.active} progress={activeRate} detail={`${activeRate}% del total`} insight={metrics.active ? "Trabajo que requiere seguimiento." : "Aún no hay procesos abiertos."} />
            <Metric icon={CheckCircle2} label="Procesos completados" value={metrics.completed} tone="text-success" progress={completedRate} detail={`${completedRate}% del total`} insight={metrics.completed ? "Resultados que ya alcanzaron una salida." : "Todavía no hay cierres registrados."} />
            <Metric icon={UsersRound} label="Amigos en ruta" value={metrics.friends} progress={metrics.friends ? 100 : 0} detail="Personas por acompañar" insight={metrics.friends ? "Prioriza contacto y próxima acción." : "Registra el primer contacto."} />
            <Metric icon={HeartHandshake} label="Asistencias REFAM" value={metrics.refamAttendance} progress={refamRate} detail={`${refamRate}% frente a amigos`} insight={metrics.refamAttendance ? "Mide la continuidad en hogares." : "Aún no hay reuniones registradas."} />
            <Metric icon={MapPinned} label="En ESFOB / EFOB" value={metrics.esfobActive} progress={esfobRate} detail={`${esfobRate}% frente a amigos`} insight={metrics.esfobActive ? "Personas en preparación bautismal." : "Revisa derivaciones desde REFAM."} />
            <Metric icon={UsersRound} label="En Discipulado" value={metrics.discipuladoActive} progress={discipuladoRate} detail={`${discipuladoRate}% frente a ESFOB`} insight={metrics.discipuladoActive ? "Acompañamiento posterior activo." : "Fortalece la continuidad después del bautismo."} />
          </section>
          <section className="card p-5">
            <div className="flex items-start gap-3 pb-4 border-b border-border">
              <span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </span>
              <div>
                <p className="eyebrow">Lectura para decidir</p>
                <h2 className="font-medium mt-1">Personas por estación</h2>
                <p className="text-xs text-secondary mt-1">Identifica dónde se concentra el trabajo y dónde se está deteniendo la ruta.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {ROUTE_STATIONS.map((station) => {
                const count = metrics.stationCounts[station.codigo] || 0;
                return (
                  <div key={station.codigo} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
                    <span className="text-secondary">{station.nombre}</span>
                    <div className="h-2 bg-surface-2 rounded overflow-hidden" aria-hidden="true">
                      <div className={`h-full ${station.color} transition-all`} style={{ width: `${(count / maxStationCount) * 100}%` }} />
                    </div>
                    <span className="text-right font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 rounded-card border border-accent/20 bg-accent-bg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Prioridad sugerida</p>
                <h3 className="font-medium mt-1">{decision.title}</h3>
                <p className="text-sm text-secondary mt-1 max-w-2xl">{decision.text}</p>
              </div>
              <Link to={decision.to} className="btn-secondary whitespace-nowrap">
                {decision.action}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        </>
      )}
      <section className="grid md:grid-cols-2 gap-4" aria-label="Submódulos de Misiones y Evangelismo">
        {SUBMODULES.map(({ to, title, description, label, icon: Icon }) => {
          const content = (
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <div>
                <p className="eyebrow">{label}</p>
                <h2 className="font-medium mt-1">{title}</h2>
                <p className="text-sm text-secondary mt-2">{description}</p>
              </div>
            </div>
          );
          return to ? (
            <Link key={title} to={to} className="card p-5 hover:border-accent transition-colors">
              {content}
            </Link>
          ) : (
            <div key={title} className="card p-5 border-dashed">
              {content}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = "text-ink", progress = 0, detail, insight }) {
  return (
    <div className="card p-4">
      <Icon className="w-4 h-4 text-accent" />
      <p className="text-xs text-secondary mt-3">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</p>
      <div className="mt-3 h-1.5 rounded-full bg-surface-2 overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <p className="text-[10px] text-muted mt-2">{detail}</p>
      <p className="text-[11px] text-secondary leading-4 mt-2">{insight}</p>
    </div>
  );
}
