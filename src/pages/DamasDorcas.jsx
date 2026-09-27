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
import { AlertTriangle, Heart, Plus, UsersRound } from "lucide-react";
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

const PERIODOS = ["30", "180", "365"];
const DIAS_INACTIVIDAD = 60;
const CHART_OPTIONS = chartOptions();

const damasDorcasCache = new Map();

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

export default function DamasDorcas() {
  const { t } = useTranslation();
  const TIPO_ACTIVIDAD_LABELS = t("damasDorcas.tipos", { returnObjects: true });
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [beneficiarias, setBeneficiarias] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [personas, setPersonas] = useState([]);
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
  const [beneficiariaForm, setBeneficiariaForm] = useState({ nombres: "", apellidos: "", telefono: "", direccion: "", responsable_persona_id: "" });
  const [actividadForm, setActividadForm] = useState({ fecha: hoyBogota(), tipo: "visita", descripcion: "", responsable_persona_id: "" });
  const [asistenciaMarcada, setAsistenciaMarcada] = useState({});

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError(t("damasDorcas.errorSinCongregacion"));
      return;
    }
    const cacheKey = `${congregacionId}:${periodo}`;
    const cached = damasDorcasCache.get(cacheKey);
    if (cached) {
      setBeneficiarias(cached.beneficiarias);
      setActividades(cached.actividades);
      setAsistencias(cached.asistencias);
      setPersonas(cached.personas);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    const start = new Date();
    start.setDate(start.getDate() - Number(periodo));
    const [b, a, s, p] = await Promise.all([
      supabase.from("damas_dorcas_beneficiarias").select("id, nombres, apellidos, telefono, direccion, estado, responsable_persona_id, bautizado, fecha_bautismo, sellado, fecha_sellado, created_at, personas:responsable_persona_id(nombres, apellidos)").eq("congregacion_id", congregacionId).order("nombres"),
      supabase.from("damas_dorcas_actividades").select("id, fecha, tipo, descripcion, responsable_persona_id").eq("congregacion_id", congregacionId).gte("fecha", fechaBogota(start)).order("fecha", { ascending: false }),
      supabase.from("damas_dorcas_asistencia").select("id, actividad_id, beneficiaria_id, asistio, damas_dorcas_actividades!inner(congregacion_id, fecha)").eq("damas_dorcas_actividades.congregacion_id", congregacionId).eq("asistio", true),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
    ]);
    const failed = [b, a, s, p].find((item) => item.error);
    if (failed) setError(t("damasDorcas.errorCargar"));
    const newBeneficiarias = b.data ?? [];
    const newActividades = a.data ?? [];
    const newAsistencias = s.data ?? [];
    const newPersonas = p.data ?? [];
    setBeneficiarias(newBeneficiarias);
    setActividades(newActividades);
    setAsistencias(newAsistencias);
    setPersonas(newPersonas);
    setLoading(false);
    damasDorcasCache.set(cacheKey, { beneficiarias: newBeneficiarias, actividades: newActividades, asistencias: newAsistencias, personas: newPersonas });
  }

  async function createBeneficiaria(event) {
    event.preventDefault();
    if (!canEdit || !beneficiariaForm.nombres.trim() || !beneficiariaForm.apellidos.trim()) return;
    setSaving(true); setError(null);
    const result = await supabase.from("damas_dorcas_beneficiarias").insert({
      congregacion_id: congregacionId,
      nombres: beneficiariaForm.nombres.trim(),
      apellidos: beneficiariaForm.apellidos.trim(),
      telefono: beneficiariaForm.telefono.trim() || null,
      direccion: beneficiariaForm.direccion.trim() || null,
      responsable_persona_id: beneficiariaForm.responsable_persona_id || null,
    });
    setSaving(false);
    if (result.error) { setError(t("damasDorcas.errorRegistrarBeneficiaria")); return; }
    setNotice(t("damasDorcas.noticeBeneficiariaRegistrada"));
    setBeneficiariaForm({ nombres: "", apellidos: "", telefono: "", direccion: "", responsable_persona_id: "" });
    load();
  }

  async function createActividad(event) {
    event.preventDefault();
    if (!canEdit) return;
    const activas = beneficiarias.filter((item) => item.estado === "activa");
    setSaving(true); setError(null);
    const actividadResult = await supabase.from("damas_dorcas_actividades").insert({
      congregacion_id: congregacionId,
      fecha: actividadForm.fecha,
      tipo: actividadForm.tipo,
      descripcion: actividadForm.descripcion.trim() || null,
      responsable_persona_id: actividadForm.responsable_persona_id || null,
    }).select("id").single();
    if (actividadResult.error) { setSaving(false); setError(t("damasDorcas.errorRegistrarActividad", { mensaje: actividadResult.error.message })); return; }
    if (activas.length > 0) {
      const asistenciaResult = await supabase.from("damas_dorcas_asistencia").insert(
        activas.map((beneficiaria) => ({ actividad_id: actividadResult.data.id, beneficiaria_id: beneficiaria.id, asistio: Boolean(asistenciaMarcada[beneficiaria.id]) })),
      );
      if (asistenciaResult.error) { setSaving(false); setError(t("damasDorcas.errorAsistenciaIndividual", { mensaje: asistenciaResult.error.message })); return; }
    }
    setSaving(false);
    setNotice(t("damasDorcas.noticeActividadRegistrada"));
    setActividadForm({ fecha: hoyBogota(), tipo: "visita", descripcion: "", responsable_persona_id: "" });
    setAsistenciaMarcada({});
    load();
  }

  async function marcarHito(beneficiaria, campo, fechaCampo) {
    if (!canEdit) return;
    setSaving(true); setError(null);
    const hoy = hoyBogota();
    const result = await supabase.from("damas_dorcas_beneficiarias").update({ [campo]: true, [fechaCampo]: hoy }).eq("id", beneficiaria.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(t("damasDorcas.errorActualizarFicha", { mensaje: result.error.message })); return; }
    setNotice(t("damasDorcas.noticeFichaActualizada"));
    load();
  }

  useEffect(() => { load(); }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "damas_dorcas.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t("damasDorcas.cargando")}</div>;

  const activas = beneficiarias.filter((item) => item.estado === "activa");
  const bautizadas = activas.filter((item) => item.bautizado);
  const selladas = activas.filter((item) => item.sellado);
  const actividadesUltimoMes = actividades.filter((item) => item.fecha >= fechaBogota(new Date(Date.now() - 30 * 86400000)));

  // Tendencia: actividades por fecha en el periodo
  const trend = [...new Set(actividades.map((item) => item.fecha))].sort().map((fecha) => ({
    fecha,
    total: actividades.filter((item) => item.fecha === fecha).length,
  }));
  const hace30 = fechaBogota(new Date(Date.now() - 30 * 86400000));
  const hace60 = fechaBogota(new Date(Date.now() - 60 * 86400000));
  const actividadesPenultimoMes = actividades.filter((item) => item.fecha >= hace60 && item.fecha < hace30).length;
  const variacion30Dias = actividadesPenultimoMes
    ? Math.round(((actividadesUltimoMes.length - actividadesPenultimoMes) / actividadesPenultimoMes) * 100)
    : null;

  // Distribución por tipo de actividad
  const tiposConTotal = Object.entries(TIPO_ACTIVIDAD_LABELS).map(([value, label]) => ({
    label,
    total: actividades.filter((item) => item.tipo === value).length,
  }));

  // Beneficiarias sin actividad reciente (alerta de seguimiento)
  const hoy = new Date();
  const ultimaActividadPorBeneficiaria = new Map();
  asistencias.forEach((item) => {
    const fecha = item.damas_dorcas_actividades?.fecha;
    if (!fecha) return;
    const actual = ultimaActividadPorBeneficiaria.get(item.beneficiaria_id);
    if (!actual || fecha > actual) ultimaActividadPorBeneficiaria.set(item.beneficiaria_id, fecha);
  });
  const beneficiariasSinSeguimiento = activas.filter((item) => {
    const ultima = ultimaActividadPorBeneficiaria.get(item.id);
    if (!ultima) {
      if (!item.created_at) return true;
      const diasDesdeIngreso = Math.floor((hoy - new Date(item.created_at)) / 86400000);
      return diasDesdeIngreso > DIAS_INACTIVIDAD;
    }
    const dias = Math.floor((hoy - new Date(`${ultima}T00:00:00`)) / 86400000);
    return dias > DIAS_INACTIVIDAD;
  });

  const insightGeneral = activas.length
    ? t("damasDorcas.insightGeneralConDatos", {
        count: beneficiariasSinSeguimiento.length,
        total: activas.length,
        dias: DIAS_INACTIVIDAD,
        extra: beneficiariasSinSeguimiento.length > 0 ? t("damasDorcas.insightExtraPrioriza") : t("damasDorcas.insightExtraAlDia"),
      })
    : t("damasDorcas.insightVacio");

  const chartData = trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: t("damasDorcas.datasetActividades") });
  const tiposChartData = distributionDataset(tiposConTotal, { datasetLabel: t("damasDorcas.datasetActividades") });

  function exportResumen() {
    return {
      kpis: [
        { label: t("damasDorcas.exportKpiBeneficiariasActivas"), value: activas.length },
        { label: t("damasDorcas.exportKpiActividades30"), value: actividadesUltimoMes.length },
        { label: t("damasDorcas.exportKpiSinSeguimiento"), value: beneficiariasSinSeguimiento.length },
        { label: t("damasDorcas.exportKpiBautizadas"), value: bautizadas.length },
      ],
      desgloses: [{ titulo: t("damasDorcas.exportDesgloseTitulo"), items: tiposConTotal.map((item) => ({ label: item.label, valor: item.total })) }],
    };
  }
  function exportHeaders() {
    return {
      headers: [t("damasDorcas.thNombre"), t("damasDorcas.exportHeaderEstado"), t("damasDorcas.exportHeaderResponsable"), t("damasDorcas.exportHeaderBautizada"), t("damasDorcas.exportHeaderSellada"), t("damasDorcas.exportHeaderUltimaActividad")],
      rows: beneficiarias.map((item) => [`${item.nombres} ${item.apellidos}`, item.estado === "activa" ? t("damasDorcas.estadoActiva") : t("damasDorcas.estadoInactiva"), item.personas ? `${item.personas.nombres} ${item.personas.apellidos}` : t("damasDorcas.sinAsignar"), item.bautizado ? t("damasDorcas.si") : t("damasDorcas.no"), item.sellado ? t("damasDorcas.si") : t("damasDorcas.no"), ultimaActividadPorBeneficiaria.get(item.id) || t("damasDorcas.sinRegistro")]),
    };
  }
  function exportCsv() { descargarCsv({ filename: `damas-dorcas-${hoyBogota()}.csv`, titulo: t("damasDorcas.exportTitulo"), ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `damas-dorcas-${hoyBogota()}.xlsx`, hoja: "Beneficiarias", titulo: t("damasDorcas.exportTitulo"), resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `damas-dorcas-${hoyBogota()}.pdf`, titulo: t("damasDorcas.exportTitulo"), orientacion: "landscape", resumen: exportResumen(), ...exportHeaders() }); }

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("damasDorcas.eyebrow")}</p>
          <h1 className="section-title">{t("damasDorcas.titulo")}</h1>
          <p className="text-sm text-secondary mt-1">{t("damasDorcas.subtitulo")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5" role="group" aria-label={t("damasDorcas.ariaPeriodo")}>
            {PERIODOS.map((value, index) => (
              <button key={value} type="button" onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-night text-white border-night" : "border-border text-secondary"}`}>{t(`damasDorcas.${["periodo30", "periodo6m", "periodo12m"][index]}`)}</button>
            ))}
          </div>
          <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {canEdit === false && <p className="text-sm text-secondary bg-surface-1 rounded p-3">{t("damasDorcas.soloConsulta")}</p>}
      <Toast>{notice}</Toast>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label={t("damasDorcas.metricBeneficiariasActivas")} value={activas.length} progress={activas.length ? 100 : 0} detail={t("damasDorcas.metricBeneficiariasActivasDetalle", { count: beneficiarias.length })} insight={activas.length ? t("damasDorcas.metricBeneficiariasActivasInsight") : t("damasDorcas.metricBeneficiariasActivasInsightVacio")} />
        <Metric label={t("damasDorcas.metricActividades30")} value={actividadesUltimoMes.length} tone={variacion30Dias === null || variacion30Dias >= 0 ? "text-success" : "text-danger"} progress={actividadesUltimoMes.length ? 100 : 0} detail={t("damasDorcas.metricActividades30Detalle", { count: actividades.length })} insight={variacion30Dias === null ? t("damasDorcas.metricActividadesInsightSinHistorial") : t("damasDorcas.metricActividadesInsightVariacion", { direccion: variacion30Dias >= 0 ? t("damasDorcas.direccionCrecio") : t("damasDorcas.direccionBajo"), porcentaje: Math.abs(variacion30Dias) })} />
        <Metric label={t("damasDorcas.metricSinSeguimiento")} value={beneficiariasSinSeguimiento.length} tone={beneficiariasSinSeguimiento.length > 0 ? "text-danger" : "text-success"} progress={activas.length ? Math.round((beneficiariasSinSeguimiento.length / activas.length) * 100) : 0} detail={t("damasDorcas.metricSinSeguimientoDetalle", { dias: DIAS_INACTIVIDAD })} insight={beneficiariasSinSeguimiento.length > 0 ? t("damasDorcas.metricSinSeguimientoInsightPendiente") : t("damasDorcas.metricSinSeguimientoInsightOk")} />
        <Metric label={t("damasDorcas.metricTipoTrabajoLider")} value={actividades.length ? (tiposConTotal.sort((a, b) => b.total - a.total)[0]?.label ?? "—") : "—"} progress={actividades.length ? Math.round((tiposConTotal.sort((a, b) => b.total - a.total)[0]?.total || 0) / actividades.length * 100) : 0} detail={t("damasDorcas.metricTipoTrabajoLiderDetalle", { count: tiposConTotal.sort((a, b) => b.total - a.total)[0]?.total || 0 })} insight={actividades.length ? t("damasDorcas.metricTipoTrabajoLiderInsight") : t("damasDorcas.metricTipoTrabajoLiderInsightVacio")} />
        <Metric label={t("damasDorcas.metricBautizadas")} value={bautizadas.length} progress={activas.length ? Math.round((bautizadas.length / activas.length) * 100) : 0} detail={t("damasDorcas.metricBautizadasDetalle", { pct: activas.length ? Math.round((bautizadas.length / activas.length) * 100) : 0 })} insight={t("damasDorcas.metricBautizadasInsight")} />
        <Metric label={t("damasDorcas.metricSelladas")} value={selladas.length} progress={activas.length ? Math.round((selladas.length / activas.length) * 100) : 0} detail={t("damasDorcas.metricSelladasDetalle")} insight={t("damasDorcas.metricSelladasInsight")} />
      </section>

      <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightGeneral}</p>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("damasDorcas.eyebrowTrabajoRealizado")}</p>
          <h2 className="font-medium mt-1">{t("damasDorcas.tituloTendenciaActividades")}</h2>
          <div className="h-56 mt-4">
            {trend.length ? <Line data={chartData} options={CHART_OPTIONS} /> : <ChartEmpty message={t("damasDorcas.chartEmptySinActividadesPeriodo")} />}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("damasDorcas.eyebrowModalidad")}</p>
          <h2 className="font-medium mt-1">{t("damasDorcas.tituloActividadesPorTipo")}</h2>
          <div className="h-56 mt-4">
            {actividades.length ? <Bar data={tiposChartData} options={CHART_OPTIONS} /> : <ChartEmpty message={t("damasDorcas.chartEmptySinActividades")} />}
          </div>
        </div>
      </section>

      {beneficiariasSinSeguimiento.length > 0 && (
        <section className="card p-5 border-2 border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-medium">{t("damasDorcas.tituloBeneficiariasSinSeguimiento")}</h2>
              <p className="text-xs text-secondary mt-1">{t("damasDorcas.descripcionSinSeguimiento", { dias: DIAS_INACTIVIDAD })}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
            {beneficiariasSinSeguimiento.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-3">
                <p className="text-sm font-medium">{item.nombres} {item.apellidos}</p>
                <p className="text-xs text-secondary mt-1">{ultimaActividadPorBeneficiaria.get(item.id) ? t("damasDorcas.ultimaActividadTexto", { fecha: ultimaActividadPorBeneficiaria.get(item.id) }) : t("damasDorcas.sinActividadRegistrada")}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">{t("damasDorcas.eyebrowCenso")}</p><h2 className="font-medium mt-1">{t("damasDorcas.tituloBeneficiarias")}</h2></div>
            <UsersRound className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4 max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">{t("damasDorcas.thNombre")}</th><th className="py-2">{t("damasDorcas.thResponsable")}</th><th className="py-2">{t("damasDorcas.thEstado")}</th><th className="py-2"><span className="inline-flex items-center gap-1">{t("damasDorcas.thHitos")}<InfoTip texto={t("damasDorcas.infoHitos")} /></span></th></tr></thead>
              <tbody>
                {beneficiarias.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="py-2 font-medium">{item.nombres} {item.apellidos}</td>
                    <td className="py-2 text-secondary">{item.personas ? `${item.personas.nombres} ${item.personas.apellidos}` : t("damasDorcas.sinAsignar")}</td>
                    <td className="py-2"><span className="text-xs px-2 py-1 rounded bg-accent-bg text-accent">{item.estado === "activa" ? t("damasDorcas.estadoActiva") : t("damasDorcas.estadoInactiva")}</span></td>
                    <td className="py-2">
                      <div className="flex gap-1.5 flex-wrap items-center">
                        {item.bautizado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">{t("damasDorcas.badgeBautizada")}</span>}
                        {item.sellado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">{t("damasDorcas.badgeSellada")}</span>}
                        {canEdit && !item.bautizado && <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => marcarHito(item, "bautizado", "fecha_bautismo")}>{t("damasDorcas.botonMarcarBautizada")}</button>}
                        {canEdit && !item.sellado && <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => marcarHito(item, "sellado", "fecha_sellado")}>{t("damasDorcas.botonMarcarSellada")}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!beneficiarias.length && <p className="text-sm text-secondary py-6 text-center">{t("damasDorcas.sinBeneficiariasRegistradas")}</p>}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">{t("damasDorcas.eyebrowTrabajoRealizado")}</p><h2 className="font-medium mt-1">{t("damasDorcas.tituloActividadesPanel")}</h2></div>
            <Heart className="w-5 h-5 text-accent" />
          </div>
          <div className="flex flex-col divide-y divide-border mt-4 max-h-64 overflow-y-auto">
            {actividades.map((item) => (
              <div key={item.id} className="py-2">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{TIPO_ACTIVIDAD_LABELS[item.tipo] || item.tipo}</p>
                  <span className="text-xs text-secondary">{item.fecha}</span>
                </div>
                {item.descripcion && <p className="text-xs text-secondary mt-1">{item.descripcion}</p>}
              </div>
            ))}
            {!actividades.length && <p className="text-sm text-muted py-6">{t("damasDorcas.sinActividadesRegistradas")}</p>}
          </div>
          {canEdit && <form onSubmit={createActividad} className="border-t border-border mt-4 pt-4 grid gap-2">
            <p className="text-sm font-medium mb-1">{t("damasDorcas.tituloRegistrarActividad")}</p>
            <div className="grid grid-cols-2 gap-2">
              <input required type="date" className="input-field" value={actividadForm.fecha} onChange={(event) => setActividadForm({ ...actividadForm, fecha: event.target.value })} />
              <select className="input-field" value={actividadForm.tipo} onChange={(event) => setActividadForm({ ...actividadForm, tipo: event.target.value })}>
                {Object.entries(TIPO_ACTIVIDAD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <textarea className="input-field min-h-14" placeholder={t("damasDorcas.placeholderDescripcionActividad")} value={actividadForm.descripcion} onChange={(event) => setActividadForm({ ...actividadForm, descripcion: event.target.value })} />
            <select className="input-field" value={actividadForm.responsable_persona_id} onChange={(event) => setActividadForm({ ...actividadForm, responsable_persona_id: event.target.value })}>
              <option value="">{t("damasDorcas.opcionResponsableSimple")}</option>
              {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
            </select>
            {activas.length > 0 && <div>
              <p className="text-xs text-secondary mb-1">{t("damasDorcas.asistenciaIndividualLabel")}</p>
              <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                {activas.map((beneficiaria) => <label key={beneficiaria.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[beneficiaria.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [beneficiaria.id]: event.target.checked })} />{beneficiaria.nombres} {beneficiaria.apellidos}</label>)}
              </div>
            </div>}
            <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />{t("damasDorcas.botonRegistrarActividad")}</button>
          </form>}
        </div>
      </section>

      <form onSubmit={createBeneficiaria} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
        <h2 className="font-medium">{t("damasDorcas.tituloNuevaBeneficiaria")}</h2>
        <div className="grid grid-cols-2 gap-2">
          <input required className="input-field" placeholder={t("damasDorcas.placeholderNombres")} value={beneficiariaForm.nombres} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, nombres: event.target.value })} />
          <input required className="input-field" placeholder={t("damasDorcas.placeholderApellidos")} value={beneficiariaForm.apellidos} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, apellidos: event.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input-field" placeholder={t("damasDorcas.placeholderTelefono")} value={beneficiariaForm.telefono} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, telefono: event.target.value })} />
          <input className="input-field" placeholder={t("damasDorcas.placeholderDireccion")} value={beneficiariaForm.direccion} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, direccion: event.target.value })} />
        </div>
        <label className="text-xs text-secondary flex items-center gap-1">
          {t("damasDorcas.labelResponsableSeguimiento")}
          <InfoTip texto={t("damasDorcas.infoResponsableSeguimiento")} />
          <select className="input-field mt-1 w-full" value={beneficiariaForm.responsable_persona_id} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, responsable_persona_id: event.target.value })}>
            <option value="">{t("damasDorcas.opcionSeleccionaPersona")}</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
        </label>
        <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {t("damasDorcas.botonRegistrarBeneficiaria")}</button>
      </form>
    </div>
  );
}
