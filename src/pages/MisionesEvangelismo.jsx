import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, CheckCircle2, Compass, GraduationCap, HeartHandshake, MapPinned, Route, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import { SkeletonCard, SkeletonStatTiles } from "../components/Skeleton";
import InfoTip from "../components/InfoTip";

const metricsCache = new Map();

const SUBMODULE_DEFS = [
  { to: "/evangelismo", key: "metodos", icon: MapPinned, codigo: "metodos" },
  { to: "/uno-mas", key: "unoMas", icon: UsersRound, codigo: "uno_mas" },
  { to: "/bis", key: "bis", icon: UsersRound, codigo: "bis" },
  { to: "/refam", key: "refam", icon: HeartHandshake, codigo: "refam" },
  { to: "/esfob", key: "esfob", icon: GraduationCap, codigo: "esfob" },
  { to: "/discipulado", key: "discipulado", icon: Compass, codigo: "discipulado" },
];

const STATION_CODES = [
  { codigo: "metodos", key: "metodos", color: "bg-accent" },
  { codigo: "uno_mas", key: "unoMas", color: "bg-warning" },
  { codigo: "bis", key: "bis", color: "bg-success" },
  { codigo: "refam", key: "refam", color: "bg-accent" },
  { codigo: "esfob", key: "esfob", color: "bg-warning" },
  { codigo: "discipulado", key: "discipulado", color: "bg-success" },
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
  const { t } = useTranslation();
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
        setError(t('misionesEvangelismo.errorCargar'));
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

  const ROUTE_STATIONS = STATION_CODES.map((station) => ({ ...station, nombre: t(`misionesEvangelismo.estaciones.${station.key}`) }));
  const SUBMODULES = SUBMODULE_DEFS.map((mod) => ({
    ...mod,
    title: t(`misionesEvangelismo.submodulos.${mod.key}.title`),
    description: t(`misionesEvangelismo.submodulos.${mod.key}.description`),
    label: t(`misionesEvangelismo.submodulos.${mod.key}.label`),
    info: t(`misionesEvangelismo.submodulos.${mod.key}.info`, ''),
  }));

  const maxStationCount = Math.max(1, ...ROUTE_STATIONS.map((station) => metrics.stationCounts[station.codigo] || 0));
  const totalProcesses = metrics.active + metrics.completed;
  const activeRate = totalProcesses ? Math.round((metrics.active / totalProcesses) * 100) : 0;
  const completedRate = totalProcesses ? Math.round((metrics.completed / totalProcesses) * 100) : 0;
  const refamRate = metrics.friends ? Math.min(100, Math.round((metrics.refamAttendance / metrics.friends) * 100)) : 0;
  const esfobRate = metrics.friends ? Math.min(100, Math.round((metrics.esfobActive / metrics.friends) * 100)) : 0;
  const discipuladoRate = metrics.esfobActive ? Math.min(100, Math.round((metrics.discipuladoActive / metrics.esfobActive) * 100)) : 0;
  const decision = metrics.discipuladoActive
    ? { title: t('misionesEvangelismo.decisionDiscipulado.titulo'), text: t('misionesEvangelismo.decisionDiscipulado.texto', { count: metrics.discipuladoActive }), to: "/discipulado", action: t('misionesEvangelismo.decisionDiscipulado.accion') }
    : metrics.esfobActive
      ? { title: t('misionesEvangelismo.decisionEsfob.titulo'), text: t('misionesEvangelismo.decisionEsfob.texto', { count: metrics.esfobActive }), to: "/esfob", action: t('misionesEvangelismo.decisionEsfob.accion') }
      : metrics.friends
        ? { title: t('misionesEvangelismo.decisionAmigos.titulo'), text: t('misionesEvangelismo.decisionAmigos.texto', { count: metrics.friends }), to: "/amigos", action: t('misionesEvangelismo.decisionAmigos.accion') }
        : { title: t('misionesEvangelismo.decisionInicio.titulo'), text: t('misionesEvangelismo.decisionInicio.texto'), to: "/uno-mas", action: t('misionesEvangelismo.decisionInicio.accion') };

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-1.5">{t('misionesEvangelismo.eyebrow')}<InfoTip texto={t('misionesEvangelismo.eyebrowTip')} /></p>
          <h1 className="section-title">{t('misionesEvangelismo.titulo')}</h1>
          <p className="text-sm text-secondary mt-1 max-w-2xl">
            {t('misionesEvangelismo.subtitulo')}
          </p>
        </div>
        <span className="chart-highlight">{t('misionesEvangelismo.seisEstaciones')}</span>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {roleLoading || loading ? (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" aria-label={t('misionesEvangelismo.ariaCargandoIndicadores')}>
            <SkeletonStatTiles count={6} />
          </section>
          <SkeletonCard lines={6} />
        </>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" aria-label={t('misionesEvangelismo.ariaIndicadores')}>
            <Metric icon={BarChart3} label={t('misionesEvangelismo.procesosActivos')} value={metrics.active} progress={activeRate} detail={t('misionesEvangelismo.delTotal', { pct: activeRate })} insight={metrics.active ? t('misionesEvangelismo.insightActivosCon') : t('misionesEvangelismo.insightActivosSin')} />
            <Metric icon={CheckCircle2} label={t('misionesEvangelismo.procesosCompletados')} value={metrics.completed} tone="text-success" progress={completedRate} detail={t('misionesEvangelismo.delTotal', { pct: completedRate })} insight={metrics.completed ? t('misionesEvangelismo.insightCompletadosCon') : t('misionesEvangelismo.insightCompletadosSin')} />
            <Metric icon={UsersRound} label={t('misionesEvangelismo.amigosEnRuta')} value={metrics.friends} progress={metrics.friends ? 100 : 0} detail={t('misionesEvangelismo.personasPorAcompanar')} insight={metrics.friends ? t('misionesEvangelismo.insightAmigosCon') : t('misionesEvangelismo.insightAmigosSin')} />
            <Metric icon={HeartHandshake} label={t('misionesEvangelismo.asistenciasRefam')} value={metrics.refamAttendance} progress={refamRate} detail={t('misionesEvangelismo.frenteAAmigos', { pct: refamRate })} insight={metrics.refamAttendance ? t('misionesEvangelismo.insightRefamCon') : t('misionesEvangelismo.insightRefamSin')} />
            <Metric icon={MapPinned} label={t('misionesEvangelismo.enEsfob')} value={metrics.esfobActive} progress={esfobRate} detail={t('misionesEvangelismo.frenteAAmigos', { pct: esfobRate })} insight={metrics.esfobActive ? t('misionesEvangelismo.insightEsfobCon') : t('misionesEvangelismo.insightEsfobSin')} />
            <Metric icon={UsersRound} label={t('misionesEvangelismo.enDiscipulado')} value={metrics.discipuladoActive} progress={discipuladoRate} detail={t('misionesEvangelismo.frenteAEsfob', { pct: discipuladoRate })} insight={metrics.discipuladoActive ? t('misionesEvangelismo.insightDiscipuladoCon') : t('misionesEvangelismo.insightDiscipuladoSin')} />
          </section>
          <section className="card p-5">
            <div className="flex items-start gap-3 pb-4 border-b border-border">
              <span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </span>
              <div>
                <p className="eyebrow">{t('misionesEvangelismo.lecturaDecidir')}</p>
                <h2 className="font-medium mt-1 flex items-center gap-1.5">{t('misionesEvangelismo.personasPorEstacion')}<InfoTip texto={t('misionesEvangelismo.personasPorEstacionTip')} /></h2>
                <p className="text-xs text-secondary mt-1">{t('misionesEvangelismo.personasPorEstacionSubtitulo')}</p>
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
                <p className="eyebrow">{t('misionesEvangelismo.prioridadSugerida')}</p>
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
      <Link to="/amigos" className="card p-5 flex items-center justify-between gap-4 hover:border-accent transition-colors">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0">
            <Route className="w-5 h-5" />
          </span>
          <div>
            <p className="eyebrow">{t('misionesEvangelismo.listadoMaestro')}</p>
            <h2 className="font-medium mt-1">{t('misionesEvangelismo.amigosEnRutaTitulo')}</h2>
            <p className="text-sm text-secondary mt-2 max-w-xl">{t('misionesEvangelismo.amigosEnRutaDesc')}</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted flex-shrink-0" />
      </Link>
      <section className="grid md:grid-cols-2 gap-4" aria-label={t('misionesEvangelismo.ariaSubmodulos')}>
        {SUBMODULES.map(({ to, title, description, label, icon: Icon, info }) => {
          const content = (
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <div>
                <p className="eyebrow">{label}</p>
                <h2 className="font-medium mt-1 flex items-center gap-1.5">{title}{info && <InfoTip texto={info} />}</h2>
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
