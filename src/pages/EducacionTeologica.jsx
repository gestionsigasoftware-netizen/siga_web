import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, Line } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { BookOpenCheck, GraduationCap, Plus, Target, UsersRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import ChartEmpty from "../components/ChartEmpty";
import InfoTip from "../components/InfoTip";
import ExportButtons from "../components/ExportButtons";
import Toast from "../components/Toast";
import { descargarCsv, descargarExcel, descargarPdf } from "../lib/reportExport";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);
const educacionTeologicaCache = new Map();

const PERIODOS = ["30", "180", "365"];
const CHART_OPTIONS = chartOptions();

function Metric({ label, value, detail, insight, progress = 0, tone = "" }) {
  return (
    <div className="stat-tile h-full min-h-[220px] flex flex-col">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary min-h-[2rem] flex items-start">{label}</p>
      <p className={`text-2xl font-semibold mt-3 min-h-[2.25rem] ${tone}`}>{value}</p>
      <div className="mt-3 h-1.5 w-full rounded-full bg-surface-2 overflow-hidden flex-shrink-0" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <p className="text-xs text-muted mt-1 min-h-[1rem]">{detail || " "}</p>
      <p className="text-[11px] text-secondary leading-4 mt-2 min-h-[2rem]">{insight || " "}</p>
    </div>
  );
}

export default function EducacionTeologica() {
  const { t } = useTranslation();
  const NIVELES = t("educacionTeologica.niveles", { returnObjects: true });
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [grupos, setGrupos] = useState([]);
  const [integrantes, setIntegrantes] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [todasSesiones, setTodasSesiones] = useState([]);
  const [periodo, setPeriodo] = useState("180");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const [canEdit, setCanEdit] = useState(null); // null = todavia no se confirma el permiso
  const [grupoForm, setGrupoForm] = useState({ nombre: "", nivel: "curso", instructor_persona_id: "" });
  const [integranteForm, setIntegranteForm] = useState({ persona_id: "", grupo_id: "" });
  const [selectedGrupoId, setSelectedGrupoId] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [sesionForm, setSesionForm] = useState({ tema: "", fecha: hoyBogota(), notas: "" });
  const [asistenciaMarcada, setAsistenciaMarcada] = useState({});

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError(t("educacionTeologica.errorSinCongregacion"));
      return;
    }
    const cacheKey = `${congregacionId}:${periodo}`;
    const cached = educacionTeologicaCache.get(cacheKey);
    if (cached) {
      setGrupos(cached.grupos);
      setIntegrantes(cached.integrantes);
      setPersonas(cached.personas);
      setTodasSesiones(cached.todasSesiones);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    const start = new Date();
    start.setDate(start.getDate() - Number(periodo));
    const [g, i, p, s] = await Promise.all([
      supabase.from("teologica_grupos").select("id, nombre, nivel, instructor_persona_id, sesion_actual, activo, personas:instructor_persona_id(nombres, apellidos)").eq("congregacion_id", congregacionId).order("nombre"),
      supabase.from("teologica_integrantes").select("id, persona_id, grupo_id, estado, certificado, fecha_certificado, personas(nombres, apellidos)").eq("congregacion_id", congregacionId),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("teologica_sesiones").select("id, grupo_id, numero, tema, fecha, asistentes, teologica_grupos!inner(congregacion_id, nombre)").eq("teologica_grupos.congregacion_id", congregacionId).gte("fecha", fechaBogota(start)).order("fecha"),
    ]);
    const failed = [g, i, p, s].find((item) => item.error);
    if (failed) setError(t("educacionTeologica.errorCargar"));
    const freshGrupos = g.data ?? [];
    const freshIntegrantes = i.data ?? [];
    const freshPersonas = p.data ?? [];
    const freshTodasSesiones = s.data ?? [];
    setGrupos(freshGrupos);
    setIntegrantes(freshIntegrantes);
    setPersonas(freshPersonas);
    setTodasSesiones(freshTodasSesiones);
    setLoading(false);
    educacionTeologicaCache.set(cacheKey, { grupos: freshGrupos, integrantes: freshIntegrantes, personas: freshPersonas, todasSesiones: freshTodasSesiones });
  }

  async function loadSesiones(grupoId) {
    setSelectedGrupoId(grupoId);
    setSesiones([]);
    setAsistenciaMarcada({});
    if (!grupoId) return;
    const { data, error: sesionesError } = await supabase.from("teologica_sesiones").select("id, numero, tema, fecha, asistentes, notas").eq("grupo_id", grupoId).order("numero", { ascending: false });
    if (sesionesError) setError(t("educacionTeologica.errorHistorialSesiones"));
    setSesiones(data ?? []);
  }

  async function createSesion(event) {
    event.preventDefault();
    if (!canEdit || !selectedGrupoId) return;
    const grupo = grupos.find((item) => item.id === selectedGrupoId);
    const integrantesGrupo = integrantes.filter((item) => item.grupo_id === selectedGrupoId && item.estado === "activo");
    const asistentesCount = integrantesGrupo.filter((item) => asistenciaMarcada[item.id]).length;
    setSaving(true);
    setError(null);
    const proximoNumero = (sesiones[0]?.numero || 0) + 1;
    const sesionResult = await supabase.from("teologica_sesiones").insert({
      grupo_id: selectedGrupoId,
      numero: proximoNumero,
      tema: sesionForm.tema.trim(),
      fecha: sesionForm.fecha,
      asistentes: asistentesCount,
      notas: sesionForm.notas.trim() || null,
    }).select("id").single();
    if (sesionResult.error) { setSaving(false); setError(t("educacionTeologica.errorRegistrarSesion", { mensaje: sesionResult.error.message })); return; }
    if (integrantesGrupo.length > 0) {
      const asistenciaResult = await supabase.from("teologica_asistencia").insert(
        integrantesGrupo.map((item) => ({ sesion_id: sesionResult.data.id, integrante_id: item.id, asistio: Boolean(asistenciaMarcada[item.id]) })),
      );
      if (asistenciaResult.error) { setSaving(false); setError(t("educacionTeologica.errorAsistenciaIndividual", { mensaje: asistenciaResult.error.message })); return; }
    }
    if (proximoNumero > (grupo?.sesion_actual || 0)) {
      await supabase.from("teologica_grupos").update({ sesion_actual: proximoNumero }).eq("id", selectedGrupoId).eq("congregacion_id", congregacionId);
    }
    setSaving(false);
    setNotice(t("educacionTeologica.noticeSesionRegistrada"));
    setSesionForm({ tema: "", fecha: hoyBogota(), notas: "" });
    setAsistenciaMarcada({});
    loadSesiones(selectedGrupoId);
    load();
  }

  async function createGrupo(event) {
    event.preventDefault();
    if (!canEdit || !grupoForm.nombre.trim()) return;
    setSaving(true); setError(null);
    const result = await supabase.from("teologica_grupos").insert({
      congregacion_id: congregacionId,
      nombre: grupoForm.nombre.trim(),
      nivel: grupoForm.nivel,
      instructor_persona_id: grupoForm.instructor_persona_id || null,
    });
    setSaving(false);
    if (result.error) { setError(t("educacionTeologica.errorRegistrarGrupo")); return; }
    setNotice(t("educacionTeologica.noticeGrupoRegistrado"));
    setGrupoForm({ nombre: "", nivel: "curso", instructor_persona_id: "" });
    load();
  }

  async function createIntegrante(event) {
    event.preventDefault();
    if (!canEdit || !integranteForm.persona_id) return;
    setSaving(true); setError(null);
    const result = await supabase.from("teologica_integrantes").insert({
      congregacion_id: congregacionId,
      persona_id: integranteForm.persona_id,
      grupo_id: integranteForm.grupo_id || null,
    });
    setSaving(false);
    if (result.error) { setError(result.error.code === "23505" ? t("educacionTeologica.errorIntegranteDuplicado") : t("educacionTeologica.errorRegistrarIntegrante")); return; }
    setNotice(t("educacionTeologica.noticeIntegranteRegistrado"));
    setIntegranteForm({ persona_id: "", grupo_id: "" });
    load();
  }

  async function toggleIntegrante(integrante) {
    const result = await supabase.from("teologica_integrantes").update({ estado: integrante.estado === "activo" ? "inactivo" : "activo" }).eq("id", integrante.id).eq("congregacion_id", congregacionId);
    if (result.error) { setError(t("educacionTeologica.errorCambiarEstadoIntegrante")); return; }
    load();
  }

  async function marcarCertificado(integrante) {
    if (!canEdit) return;
    setSaving(true); setError(null);
    const result = await supabase.from("teologica_integrantes").update({ certificado: true, fecha_certificado: hoyBogota() }).eq("id", integrante.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(t("educacionTeologica.errorRegistrarCertificacion", { mensaje: result.error.message })); return; }
    setNotice(t("educacionTeologica.noticeCertificacionRegistrada"));
    load();
  }

  useEffect(() => { load(); }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "teologica.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t("educacionTeologica.cargando")}</div>;

  const integrantesActivos = integrantes.filter((i) => i.estado === "activo");
  const certificados = integrantes.filter((i) => i.certificado);
  const gruposActivos = grupos.filter((g) => g.activo !== false);
  const integrantesPorGrupo = gruposActivos.length ? Math.round(integrantesActivos.length / gruposActivos.length) : 0;

  const trend = [...new Set(todasSesiones.map((s) => s.fecha))].sort().map((fecha) => ({
    fecha,
    total: todasSesiones.filter((s) => s.fecha === fecha).reduce((sum, s) => sum + Number(s.asistentes || 0), 0),
  }));
  const totalAsistenciaPeriodo = trend.reduce((sum, item) => sum + item.total, 0);
  const promedioSesion = todasSesiones.length ? Math.round(totalAsistenciaPeriodo / todasSesiones.length) : 0;
  const mitad = Math.floor(trend.length / 2) || 1;
  const primeraMitad = trend.slice(0, mitad).reduce((sum, item) => sum + item.total, 0);
  const segundaMitad = trend.slice(mitad).reduce((sum, item) => sum + item.total, 0);
  const tendenciaVariacion = trend.length >= 2 && primeraMitad ? Math.round(((segundaMitad - primeraMitad) / primeraMitad) * 100) : null;

  const nivelesConTotal = Object.entries(NIVELES).map(([value, label]) => ({
    label,
    total: integrantesActivos.filter((i) => grupos.find((g) => g.id === i.grupo_id)?.nivel === value).length,
  })).filter((item) => item.total > 0);

  const gruposConDatos = gruposActivos.map((grupo) => {
    const integrantesDeGrupo = integrantesActivos.filter((i) => i.grupo_id === grupo.id);
    const sesionesDeGrupo = todasSesiones.filter((s) => s.grupo_id === grupo.id);
    const asistenciaPromedio = sesionesDeGrupo.length ? Math.round(sesionesDeGrupo.reduce((sum, s) => sum + Number(s.asistentes || 0), 0) / sesionesDeGrupo.length) : 0;
    return { ...grupo, integrantesCount: integrantesDeGrupo.length, asistenciaPromedio };
  }).sort((a, b) => b.integrantesCount - a.integrantesCount);
  const grupoSinInstructor = gruposActivos.filter((g) => !g.instructor_persona_id).length;

  const topGrupo = gruposConDatos[0];
  const insightGeneral = topGrupo?.integrantesCount
    ? t("educacionTeologica.insightGeneralConDatos", {
        grupo: topGrupo.nombre,
        count: topGrupo.integrantesCount,
        extra: t("educacionTeologica.insightExtraCertificados", { count: certificados.length }),
      })
    : t("educacionTeologica.insightVacio");

  const chartData = trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: t("educacionTeologica.datasetAsistentes") });
  const nivelesChartData = distributionDataset(nivelesConTotal, { datasetLabel: t("educacionTeologica.datasetIntegrantes") });

  function exportResumen() {
    return {
      kpis: [
        { label: t("educacionTeologica.exportKpiGruposActivos"), value: gruposActivos.length },
        { label: t("educacionTeologica.exportKpiIntegrantesActivos"), value: integrantesActivos.length },
        { label: t("educacionTeologica.exportKpiCertificados"), value: certificados.length },
        { label: t("educacionTeologica.exportKpiSesionesRegistradas"), value: todasSesiones.length },
      ],
      desgloses: [{ titulo: t("educacionTeologica.exportDesgloseTitulo"), items: nivelesConTotal.map((item) => ({ label: item.label, valor: item.total })) }],
    };
  }
  function exportHeaders() {
    return {
      headers: [t("educacionTeologica.thGrupo"), t("educacionTeologica.thNivel"), t("educacionTeologica.thIntegrantes"), t("educacionTeologica.exportHeaderAsistenciaPromedio"), t("educacionTeologica.exportHeaderInstructor")],
      rows: gruposConDatos.map((grupo) => [grupo.nombre, NIVELES[grupo.nivel] || grupo.nivel, grupo.integrantesCount, grupo.asistenciaPromedio, grupo.personas ? `${grupo.personas.nombres} ${grupo.personas.apellidos}` : t("educacionTeologica.exportSinAsignar")]),
    };
  }
  function exportCsv() { descargarCsv({ filename: `educacion-teologica-${hoyBogota()}.csv`, titulo: t("educacionTeologica.exportTitulo"), ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `educacion-teologica-${hoyBogota()}.xlsx`, hoja: "Grupos", titulo: t("educacionTeologica.exportTitulo"), resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `educacion-teologica-${hoyBogota()}.pdf`, titulo: t("educacionTeologica.exportTitulo"), orientacion: "landscape", resumen: exportResumen(), ...exportHeaders() }); }

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("educacionTeologica.eyebrow")}</p>
          <h1 className="section-title flex items-center gap-2"><BookOpenCheck className="w-6 h-6 text-accent" />{t("educacionTeologica.titulo")}</h1>
          <p className="text-sm text-secondary mt-1">{t("educacionTeologica.subtitulo")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5" role="group" aria-label={t("educacionTeologica.ariaPeriodo")}>
            {PERIODOS.map((value, index) => (
              <button key={value} type="button" onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-night text-white border-night" : "border-border text-secondary"}`}>{t(`educacionTeologica.${["periodo30", "periodo6m", "periodo12m"][index]}`)}</button>
            ))}
          </div>
          <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {canEdit === false && <p className="text-sm text-secondary bg-surface-1 rounded p-3">{t("educacionTeologica.soloConsulta")}</p>}
      <Toast>{notice}</Toast>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label={t("educacionTeologica.metricGruposActivos")} value={gruposActivos.length} progress={gruposActivos.length ? 100 : 0} detail={t("educacionTeologica.metricGruposActivosDetalle", { count: grupoSinInstructor })} insight={grupoSinInstructor ? t("educacionTeologica.metricGruposActivosInsightPendiente") : t("educacionTeologica.metricGruposActivosInsightOk")} />
        <Metric label={t("educacionTeologica.metricIntegrantesActivos")} value={integrantesActivos.length} progress={integrantesActivos.length ? 100 : 0} detail={t("educacionTeologica.metricIntegrantesActivosDetalle", { count: integrantesPorGrupo })} insight={integrantesActivos.length ? t("educacionTeologica.metricIntegrantesActivosInsight") : t("educacionTeologica.metricIntegrantesActivosInsightVacio")} />
        <Metric label={t("educacionTeologica.metricCertificados")} value={certificados.length} tone={certificados.length ? "text-success" : ""} progress={integrantesActivos.length ? Math.round((certificados.length / integrantesActivos.length) * 100) : 0} detail={t("educacionTeologica.metricCertificadosDetalle", { pct: integrantesActivos.length ? Math.round((certificados.length / integrantesActivos.length) * 100) : 0 })} insight={t("educacionTeologica.metricCertificadosInsight")} />
        <Metric label={t("educacionTeologica.metricAsistenciaPromedio")} value={promedioSesion} tone={tendenciaVariacion === null || tendenciaVariacion >= 0 ? "text-success" : "text-danger"} progress={integrantesActivos.length ? Math.min(100, Math.round((promedioSesion / integrantesActivos.length) * 100)) : 0} detail={t("educacionTeologica.metricAsistenciaDetalle", { count: todasSesiones.length })} insight={tendenciaVariacion === null ? t("educacionTeologica.metricAsistenciaInsightSinHistorial") : t("educacionTeologica.metricAsistenciaInsightVariacion", { direccion: tendenciaVariacion >= 0 ? t("educacionTeologica.direccionCrecio") : t("educacionTeologica.direccionBajo"), porcentaje: Math.abs(tendenciaVariacion) })} />
        <Metric label={t("educacionTeologica.metricSesionesRegistradas")} value={todasSesiones.length} progress={todasSesiones.length ? 100 : 0} detail={t("educacionTeologica.metricSesionesDetalle", { count: totalAsistenciaPeriodo })} insight={todasSesiones.length ? t("educacionTeologica.metricSesionesInsight") : t("educacionTeologica.metricSesionesInsightVacio")} />
        <Metric label={t("educacionTeologica.metricNivelLider")} value={integrantesActivos.length ? (nivelesConTotal.sort((a, b) => b.total - a.total)[0]?.label ?? "—") : "—"} progress={integrantesActivos.length ? Math.round((nivelesConTotal.sort((a, b) => b.total - a.total)[0]?.total || 0) / integrantesActivos.length * 100) : 0} detail={t("educacionTeologica.metricNivelLiderDetalle", { count: nivelesConTotal.sort((a, b) => b.total - a.total)[0]?.total || 0 })} insight={integrantesActivos.length ? t("educacionTeologica.metricNivelLiderInsight") : t("educacionTeologica.metricNivelLiderInsightVacio")} />
      </section>

      <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightGeneral}</p>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("educacionTeologica.eyebrowAsistenciaRegistrada")}</p>
          <h2 className="font-medium mt-1">{t("educacionTeologica.tituloTendenciaAsistencia")}</h2>
          <div className="h-56 mt-4">
            {trend.length ? <Line data={chartData} options={CHART_OPTIONS} /> : <ChartEmpty message={t("educacionTeologica.chartEmptySinSesiones")} />}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("educacionTeologica.eyebrowComposicion")}</p>
          <h2 className="font-medium mt-1">{t("educacionTeologica.tituloIntegrantesPorNivel")}</h2>
          <div className="h-56 mt-4">
            {nivelesConTotal.length ? <Bar data={nivelesChartData} options={CHART_OPTIONS} /> : <ChartEmpty message={t("educacionTeologica.chartEmptySinIntegrantes")} />}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="eyebrow">{t("educacionTeologica.eyebrowComparativa")}</p><h2 className="font-medium mt-1">{t("educacionTeologica.tituloGruposPorImpacto")}</h2><p className="text-xs text-secondary mt-1">{t("educacionTeologica.descripcionGruposPorImpacto")}</p></div>
          <Target className="w-5 h-5 text-accent" />
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">{t("educacionTeologica.thGrupo")}</th><th className="py-2">{t("educacionTeologica.thNivel")}</th><th className="py-2 text-right">{t("educacionTeologica.thIntegrantes")}</th><th className="py-2 text-right">{t("educacionTeologica.thAsistenciaProm")}</th></tr></thead>
            <tbody>
              {gruposConDatos.map((grupo) => (
                <tr key={grupo.id} className="border-b border-border">
                  <td className="py-2 font-medium">{grupo.nombre}</td>
                  <td className="py-2 text-secondary">{NIVELES[grupo.nivel]}</td>
                  <td className="py-2 text-right">{grupo.integrantesCount}</td>
                  <td className="py-2 text-right">{grupo.asistenciaPromedio}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!gruposConDatos.length && <p className="text-sm text-secondary py-6 text-center">{t("educacionTeologica.sinGruposComparar")}</p>}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">{t("educacionTeologica.eyebrowGrupos")}</p><h2 className="font-medium mt-1">{t("educacionTeologica.tituloGruposYSesiones")}</h2></div>
            <BookOpenCheck className="w-5 h-5 text-accent" />
          </div>
          <div className="flex flex-col divide-y divide-border mt-4">
            {grupos.map((grupo) => (
              <div role="button" tabIndex={0} key={grupo.id} onClick={() => loadSesiones(grupo.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); loadSesiones(grupo.id); } }} className={`py-3 text-left cursor-pointer ${selectedGrupoId === grupo.id ? "bg-accent-bg -mx-2 px-2 rounded" : ""}`}>
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{grupo.nombre}</p>
                  <span className="text-xs text-accent flex items-center gap-1">{t("educacionTeologica.sesionNumero", { numero: grupo.sesion_actual })}<InfoTip texto={t("educacionTeologica.infoSesionActual")} /></span>
                </div>
                <p className="text-xs text-secondary mt-1">{NIVELES[grupo.nivel]} · {grupo.personas ? `${grupo.personas.nombres} ${grupo.personas.apellidos}` : t("educacionTeologica.sinInstructor")}</p>
              </div>
            ))}
            {!grupos.length && <p className="text-sm text-muted py-6">{t("educacionTeologica.sinGruposRegistrados")}</p>}
          </div>
          {selectedGrupoId && (() => {
            const grupoSeleccionado = grupos.find((item) => item.id === selectedGrupoId);
            const integrantesGrupo = integrantesActivos.filter((item) => item.grupo_id === selectedGrupoId);
            return <div className="border-t border-border mt-4 pt-4">
              <p className="text-sm font-medium mb-2">{t("educacionTeologica.sesionesDeGrupo", { nombre: grupoSeleccionado?.nombre })}</p>
              {canEdit && <form onSubmit={createSesion} className="grid gap-2 mb-3">
                <div className="grid grid-cols-2 gap-2">
                  <input required className="input-field" placeholder={t("educacionTeologica.placeholderTemaSesion")} value={sesionForm.tema} onChange={(event) => setSesionForm({ ...sesionForm, tema: event.target.value })} />
                  <input required type="date" className="input-field" value={sesionForm.fecha} onChange={(event) => setSesionForm({ ...sesionForm, fecha: event.target.value })} />
                </div>
                <textarea className="input-field min-h-14" placeholder={t("educacionTeologica.placeholderNotasOpcional")} value={sesionForm.notas} onChange={(event) => setSesionForm({ ...sesionForm, notas: event.target.value })} />
                {integrantesGrupo.length > 0 && <div>
                  <p className="text-xs text-secondary mb-1">{t("educacionTeologica.asistenciaIndividualLabel")}</p>
                  <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                    {integrantesGrupo.map((item) => <label key={item.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[item.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [item.id]: event.target.checked })} />{item.personas?.nombres} {item.personas?.apellidos}</label>)}
                  </div>
                </div>}
                <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />{t("educacionTeologica.botonRegistrarSesion")}</button>
              </form>}
              {sesiones.length ? <div className="divide-y divide-border">{sesiones.map((sesion) => <div key={sesion.id} className="py-2"><p className="text-sm">{t("educacionTeologica.sesionHistorialLinea", { numero: sesion.numero, tema: sesion.tema })}</p><p className="text-xs text-secondary">{t("educacionTeologica.sesionHistorialDetalle", { fecha: sesion.fecha, count: sesion.asistentes })}</p></div>)}</div> : <p className="text-xs text-muted">{t("educacionTeologica.sinSesionesGrupo")}</p>}
            </div>;
          })()}
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">{t("educacionTeologica.eyebrowCenso")}</p><h2 className="font-medium mt-1">{t("educacionTeologica.tituloIntegrantesEducacionTeologica")}</h2></div>
            <GraduationCap className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4 max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">{t("educacionTeologica.thIntegrante")}</th><th className="py-2">{t("educacionTeologica.thGrupo")}</th><th className="py-2"><span className="inline-flex items-center gap-1">{t("educacionTeologica.thCertificacion")}<InfoTip texto={t("educacionTeologica.infoCertificacion")} /></span></th></tr></thead>
              <tbody>
                {integrantes.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="py-2 font-medium">{item.personas?.nombres} {item.personas?.apellidos}{item.certificado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent ml-2">{t("educacionTeologica.badgeCertificado")}</span>}</td>
                    <td className="py-2 text-secondary">{grupos.find((g) => g.id === item.grupo_id)?.nombre || t("educacionTeologica.sinGrupo")}</td>
                    <td className="py-2 text-right flex justify-end gap-2">
                      {canEdit && !item.certificado && <button type="button" onClick={() => marcarCertificado(item)} className="text-xs text-accent">{t("educacionTeologica.botonCertificar")}</button>}
                      {canEdit && <button type="button" onClick={() => toggleIntegrante(item)} className={`text-xs ${item.estado === "activo" ? "text-danger" : "text-accent"}`}>{item.estado === "activo" ? t("educacionTeologica.botonDesactivar") : t("educacionTeologica.botonReactivar")}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!integrantes.length && <p className="text-sm text-secondary py-6 text-center">{t("educacionTeologica.sinIntegrantesRegistrados")}</p>}
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <form onSubmit={createGrupo} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
          <h2 className="font-medium">{t("educacionTeologica.tituloNuevoGrupo")}</h2>
          <input required className="input-field" placeholder={t("educacionTeologica.placeholderNombreGrupo")} value={grupoForm.nombre} onChange={(event) => setGrupoForm({ ...grupoForm, nombre: event.target.value })} />
          <select className="input-field" value={grupoForm.nivel} onChange={(event) => setGrupoForm({ ...grupoForm, nivel: event.target.value })}>
            {Object.entries(NIVELES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="input-field" value={grupoForm.instructor_persona_id} onChange={(event) => setGrupoForm({ ...grupoForm, instructor_persona_id: event.target.value })}>
            <option value="">{t("educacionTeologica.opcionInstructor")}</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
          <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {t("educacionTeologica.botonRegistrarGrupo")}</button>
        </form>
        <form onSubmit={createIntegrante} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
          <h2 className="font-medium">{t("educacionTeologica.tituloNuevoIntegrante")}</h2>
          <select required className="input-field" value={integranteForm.persona_id} onChange={(event) => setIntegranteForm({ ...integranteForm, persona_id: event.target.value })}>
            <option value="">{t("educacionTeologica.opcionPersona")}</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
          <select className="input-field" value={integranteForm.grupo_id} onChange={(event) => setIntegranteForm({ ...integranteForm, grupo_id: event.target.value })}>
            <option value="">{t("educacionTeologica.opcionGrupo")}</option>
            {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>)}
          </select>
          <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" /> {t("educacionTeologica.botonRegistrarIntegrante")}</button>
        </form>
      </section>
    </div>
  );
}
