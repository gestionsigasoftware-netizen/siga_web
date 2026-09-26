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
import { AlertTriangle, Flag, Plus, UsersRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import ChartEmpty from "../components/ChartEmpty";
import InfoTip from "../components/InfoTip";
import ExportButtons from "../components/ExportButtons";
import Toast from "../components/Toast";
import { descargarCsv, descargarExcel, descargarPdf } from "../lib/reportExport";
import { getEstacion, iniciarOMoverEstacion } from "../lib/rutaEvangelistica";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

const conquistadoresCache = new Map();

const PERIODOS = ["30", "180", "365"];
const DIAS_INACTIVIDAD = 60;
const CHART_OPTIONS = chartOptions();

function Metric({ label, value, detail, insight, progress = 0, tone = "", tip }) {
  return (
    <div className="stat-tile h-full min-h-[220px] flex flex-col">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary min-h-[2rem] flex items-start gap-1.5">{label}{tip && <InfoTip texto={tip} />}</p>
      <p className={`text-2xl font-semibold mt-3 min-h-[2.25rem] ${tone}`}>{value}</p>
      <div className="mt-3 h-1.5 w-full rounded-full bg-surface-2 overflow-hidden flex-shrink-0" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <p className="text-xs text-muted mt-1 min-h-[1rem]">{detail || " "}</p>
      <p className="text-[11px] text-secondary leading-4 mt-2 min-h-[2rem]">{insight || " "}</p>
    </div>
  );
}

export default function Conquistadores() {
  const { t } = useTranslation();
  const TIPO_ACTIVIDAD_LABELS = t("conquistadores.tipos", { returnObjects: true });
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [miembros, setMiembros] = useState([]);
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
  const [miembroForm, setMiembroForm] = useState({ nombres: "", apellidos: "", telefono: "", rol: "miembro" });
  const [actividadForm, setActividadForm] = useState({ fecha: hoyBogota(), tipo: "reunion", descripcion: "", responsable_persona_id: "" });
  const [asistenciaMarcada, setAsistenciaMarcada] = useState({});
  const [miembrosVinculados, setMiembrosVinculados] = useState(new Set());
  const [vinculandoId, setVinculandoId] = useState(null);
  const [responsableVinculoId, setResponsableVinculoId] = useState("");

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError(t("conquistadores.errorSinCongregacion"));
      return;
    }
    const cacheKey = `${congregacionId}:${periodo}`;
    const cached = conquistadoresCache.get(cacheKey);
    if (cached) {
      setMiembros(cached.miembros);
      setActividades(cached.actividades);
      setAsistencias(cached.asistencias);
      setPersonas(cached.personas);
      setMiembrosVinculados(cached.miembrosVinculados);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    const start = new Date();
    start.setDate(start.getDate() - Number(periodo));
    const [m, a, s, p, am] = await Promise.all([
      supabase.from("conquistadores_miembros").select("id, persona_id, nombres, apellidos, rol, estado, fecha_ingreso, bautizado, fecha_bautismo, sellado, fecha_sellado").eq("congregacion_id", congregacionId).order("fecha_ingreso", { ascending: false }),
      supabase.from("conquistadores_actividades").select("id, fecha, tipo, descripcion, responsable_persona_id").eq("congregacion_id", congregacionId).gte("fecha", fechaBogota(start)).order("fecha", { ascending: false }),
      supabase.from("conquistadores_asistencia").select("id, actividad_id, miembro_id, asistio, conquistadores_actividades!inner(congregacion_id, fecha)").eq("conquistadores_actividades.congregacion_id", congregacionId).eq("asistio", true),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("amigos").select("conquistadores_miembro_id").eq("congregacion_id", congregacionId).not("conquistadores_miembro_id", "is", null),
    ]);
    const failed = [m, a, s, p, am].find((item) => item.error);
    if (failed) setError(t("conquistadores.errorCargar"));
    const nuevosMiembros = m.data ?? [];
    const nuevasActividades = a.data ?? [];
    const nuevasAsistencias = s.data ?? [];
    const nuevasPersonas = p.data ?? [];
    const nuevosVinculados = new Set((am.data ?? []).map((row) => row.conquistadores_miembro_id));
    setMiembros(nuevosMiembros);
    setActividades(nuevasActividades);
    setAsistencias(nuevasAsistencias);
    setPersonas(nuevasPersonas);
    setMiembrosVinculados(nuevosVinculados);
    setLoading(false);
    conquistadoresCache.set(cacheKey, {
      miembros: nuevosMiembros,
      actividades: nuevasActividades,
      asistencias: nuevasAsistencias,
      personas: nuevasPersonas,
      miembrosVinculados: nuevosVinculados,
    });
  }

  async function createMiembro(event) {
    event.preventDefault();
    if (!canEdit || !miembroForm.nombres.trim() || !miembroForm.apellidos.trim()) return;
    setSaving(true); setError(null);
    const result = await supabase.from("conquistadores_miembros").insert({
      congregacion_id: congregacionId,
      nombres: miembroForm.nombres.trim(),
      apellidos: miembroForm.apellidos.trim(),
      telefono: miembroForm.telefono.trim() || null,
      rol: miembroForm.rol,
    });
    setSaving(false);
    if (result.error) { setError(t("conquistadores.errorRegistrarMiembro")); return; }
    setNotice(t("conquistadores.noticeMiembroRegistrado"));
    setMiembroForm({ nombres: "", apellidos: "", telefono: "", rol: "miembro" });
    load();
  }

  async function marcarHito(miembro, campo, fechaCampo) {
    if (!canEdit) return;
    setSaving(true);
    const hoy = hoyBogota();
    const result = await supabase.from("conquistadores_miembros").update({ [campo]: true, [fechaCampo]: hoy }).eq("id", miembro.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(t("conquistadores.errorActualizarFicha", { mensaje: result.error.message })); return; }
    setNotice(t("conquistadores.noticeFichaActualizada"));
    load();
  }

  // Mismo mecanismo que ya usan Mision Juvenil y Obra Carcelaria: un
  // miembro de Conquistadores que no esta bautizado se conecta con el
  // seguimiento individual real (amigos + Ruta Evangelistica) -- entra a
  // BIS con un responsable, o si ya esta bautizado, queda listo para
  // incorporar a Feligresia sin pasar por ninguna estacion.
  async function vincularRutaEvangelistica(miembro) {
    if (!canEdit) return;
    if (!miembro.bautizado && !responsableVinculoId) { setError(t("conquistadores.errorSeleccionaResponsable")); return; }
    setSaving(true); setError(null);
    const nombreCompleto = `${miembro.nombres} ${miembro.apellidos}`.trim();
    const { data: amigo, error: amigoError } = await supabase.from("amigos").insert({
      congregacion_id: congregacionId,
      nombres: nombreCompleto,
      telefono: miembro.telefono || null,
      fecha_primer_contacto: hoyBogota(),
      conquistadores_miembro_id: miembro.id,
      ...(miembro.bautizado ? { estado_espiritual: "bautizado", bautizado: true, fecha_bautismo: miembro.fecha_bautismo } : {}),
    }).select("id").single();
    if (amigoError) { setSaving(false); setError(t("conquistadores.errorVincularRuta", { mensaje: amigoError.message })); return; }
    if (miembro.bautizado) {
      setSaving(false);
      setNotice(t("conquistadores.noticeVinculadoBautizado", { nombre: nombreCompleto }));
      setVinculandoId(null); setResponsableVinculoId(""); load();
      return;
    }
    const { data: estacionBis, error: estacionError } = await getEstacion(congregacionId, "bis");
    if (estacionError || !estacionBis) { setSaving(false); setError(t("conquistadores.errorEstacionBisNoEncontrada")); return; }
    const movResult = await iniciarOMoverEstacion({ congregacionId, estacionDestino: estacionBis, amigoId: amigo.id, responsablePersonaId: responsableVinculoId });
    setSaving(false);
    if (movResult.error) { setError(t("conquistadores.errorAgregarBis", { mensaje: movResult.error.message })); return; }
    setNotice(t("conquistadores.noticeVinculadoBis", { nombre: nombreCompleto }));
    setVinculandoId(null); setResponsableVinculoId(""); load();
  }

  async function createActividad(event) {
    event.preventDefault();
    if (!canEdit) return;
    const activos = miembros.filter((item) => item.estado === "activo");
    setSaving(true); setError(null);
    const actividadResult = await supabase.from("conquistadores_actividades").insert({
      congregacion_id: congregacionId,
      fecha: actividadForm.fecha,
      tipo: actividadForm.tipo,
      descripcion: actividadForm.descripcion.trim() || null,
      responsable_persona_id: actividadForm.responsable_persona_id || null,
    }).select("id").single();
    if (actividadResult.error) { setSaving(false); setError(t("conquistadores.errorRegistrarActividad", { mensaje: actividadResult.error.message })); return; }
    if (activos.length > 0) {
      const asistenciaResult = await supabase.from("conquistadores_asistencia").insert(
        activos.map((miembro) => ({ actividad_id: actividadResult.data.id, miembro_id: miembro.id, asistio: Boolean(asistenciaMarcada[miembro.id]) })),
      );
      if (asistenciaResult.error) { setSaving(false); setError(t("conquistadores.errorAsistenciaIndividual", { mensaje: asistenciaResult.error.message })); return; }
    }
    setSaving(false);
    setNotice(t("conquistadores.noticeActividadRegistrada"));
    setActividadForm({ fecha: hoyBogota(), tipo: "reunion", descripcion: "", responsable_persona_id: "" });
    setAsistenciaMarcada({});
    load();
  }

  useEffect(() => { load(); }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "conquistadores.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t("conquistadores.cargando")}</div>;

  const activos = miembros.filter((item) => item.estado === "activo");
  const lideres = activos.filter((item) => item.rol === "lider");
  const actividadesUltimoMes = actividades.filter((item) => item.fecha >= fechaBogota(new Date(Date.now() - 30 * 86400000)));

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

  const tiposConTotal = Object.entries(TIPO_ACTIVIDAD_LABELS).map(([value, label]) => ({
    label,
    total: actividades.filter((item) => item.tipo === value).length,
  }));

  const ultimaActividadPorMiembro = new Map();
  asistencias.forEach((item) => {
    const fecha = item.conquistadores_actividades?.fecha;
    if (!fecha) return;
    const actual = ultimaActividadPorMiembro.get(item.miembro_id);
    if (!actual || fecha > actual) ultimaActividadPorMiembro.set(item.miembro_id, fecha);
  });
  const hoy = new Date();
  const miembrosSinSeguimiento = activos.filter((item) => {
    const ultima = ultimaActividadPorMiembro.get(item.id);
    if (!ultima) {
      if (!item.fecha_ingreso) return true;
      const diasDesdeIngreso = Math.floor((hoy - new Date(`${item.fecha_ingreso}T00:00:00`)) / 86400000);
      return diasDesdeIngreso > DIAS_INACTIVIDAD;
    }
    const dias = Math.floor((hoy - new Date(`${ultima}T00:00:00`)) / 86400000);
    return dias > DIAS_INACTIVIDAD;
  });

  const insightGeneral = activos.length
    ? t("conquistadores.insightGeneralConDatos", {
        lideres: lideres.length,
        activos: activos.length,
        extra: miembrosSinSeguimiento.length > 0
          ? t("conquistadores.insightExtraSinSeguimiento", { count: miembrosSinSeguimiento.length })
          : t("conquistadores.insightExtraTodosConActividad"),
      })
    : t("conquistadores.insightVacio");

  const chartData = trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: t("conquistadores.datasetActividades") });
  const tiposChartData = distributionDataset(tiposConTotal, { datasetLabel: t("conquistadores.datasetActividades") });

  function exportResumen() {
    return {
      kpis: [
        { label: t("conquistadores.exportKpiMiembrosActivos"), value: activos.length },
        { label: t("conquistadores.exportKpiLideres"), value: lideres.length },
        { label: t("conquistadores.exportKpiActividades30"), value: actividadesUltimoMes.length },
        { label: t("conquistadores.exportKpiSinSeguimiento"), value: miembrosSinSeguimiento.length },
      ],
      desgloses: [{ titulo: t("conquistadores.tituloActividadesPorTipo"), items: tiposConTotal.map((item) => ({ label: item.label, valor: item.total })) }],
    };
  }
  function exportHeaders() {
    return {
      headers: [t("conquistadores.thNombre"), t("conquistadores.thRol"), t("conquistadores.headerEstado"), t("conquistadores.headerFechaIngreso"), t("conquistadores.headerUltimaActividad")],
      rows: miembros.map((item) => [`${item.nombres || ""} ${item.apellidos || ""}`.trim(), item.rol === "lider" ? t("conquistadores.rolLider") : t("conquistadores.rolMiembro"), item.estado === "activo" ? t("conquistadores.estadoActivo") : t("conquistadores.estadoInactivo"), item.fecha_ingreso || "—", ultimaActividadPorMiembro.get(item.id) || t("conquistadores.sinRegistro")]),
    };
  }
  function exportCsv() { descargarCsv({ filename: `conquistadores-${hoyBogota()}.csv`, titulo: t("conquistadores.exportTitulo"), ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `conquistadores-${hoyBogota()}.xlsx`, hoja: "Miembros", titulo: t("conquistadores.exportTitulo"), resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `conquistadores-${hoyBogota()}.pdf`, titulo: t("conquistadores.exportTitulo"), orientacion: "landscape", resumen: exportResumen(), ...exportHeaders() }); }

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("conquistadores.eyebrow")}</p>
          <h1 className="section-title flex items-center gap-2"><Flag className="w-6 h-6 text-accent" />{t("conquistadores.titulo")}</h1>
          <p className="text-sm text-secondary mt-1">{t("conquistadores.subtitulo")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5" role="group" aria-label={t("conquistadores.ariaPeriodo")}>
            {PERIODOS.map((value, index) => (
              <button key={value} type="button" onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-night text-white border-night" : "border-border text-secondary"}`}>{t(`conquistadores.${["periodo30", "periodo6m", "periodo12m"][index]}`)}</button>
            ))}
          </div>
          <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {canEdit === false && <p className="text-sm text-secondary bg-surface-1 rounded p-3">{t("conquistadores.soloConsulta")}</p>}
      <Toast>{notice}</Toast>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label={t("conquistadores.metricMiembrosActivos")} value={activos.length} progress={activos.length ? 100 : 0} detail={t("conquistadores.metricMiembrosActivosDetalle", { count: miembros.length })} insight={activos.length ? t("conquistadores.metricMiembrosActivosInsight") : t("conquistadores.metricMiembrosActivosInsightVacio")} />
        <Metric label={t("conquistadores.metricLideres")} value={lideres.length} progress={activos.length ? Math.round((lideres.length / activos.length) * 100) : 0} detail={t("conquistadores.metricLideresDetalle", { pct: activos.length ? Math.round((lideres.length / activos.length) * 100) : 0 })} insight={t("conquistadores.metricLideresInsight")} tip={t("conquistadores.metricLideresTip")} />
        <Metric label={t("conquistadores.metricActividades30")} value={actividadesUltimoMes.length} tone={variacion30Dias === null || variacion30Dias >= 0 ? "text-success" : "text-danger"} progress={actividadesUltimoMes.length ? 100 : 0} detail={t("conquistadores.metricActividades30Detalle", { count: actividades.length })} insight={variacion30Dias === null ? t("conquistadores.metricActividadesInsightSinHistorial") : t("conquistadores.metricActividadesInsightVariacion", { direccion: variacion30Dias >= 0 ? t("conquistadores.direccionCrecio") : t("conquistadores.direccionBajo"), porcentaje: Math.abs(variacion30Dias) })} />
        <Metric label={t("conquistadores.metricSinSeguimiento")} value={miembrosSinSeguimiento.length} tone={miembrosSinSeguimiento.length > 0 ? "text-danger" : "text-success"} progress={activos.length ? Math.round((miembrosSinSeguimiento.length / activos.length) * 100) : 0} detail={t("conquistadores.metricSinSeguimientoDetalle", { dias: DIAS_INACTIVIDAD })} insight={miembrosSinSeguimiento.length > 0 ? t("conquistadores.metricSinSeguimientoInsightPendiente") : t("conquistadores.metricSinSeguimientoInsightOk")} />
      </section>

      <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightGeneral}</p>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("conquistadores.eyebrowTrabajoRealizado")}</p>
          <h2 className="font-medium mt-1">{t("conquistadores.tituloTendenciaActividades")}</h2>
          <div className="h-56 mt-4">
            {trend.length ? <Line data={chartData} options={CHART_OPTIONS} /> : <ChartEmpty message={t("conquistadores.chartEmptySinActividadesPeriodo")} />}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("conquistadores.eyebrowModalidad")}</p>
          <h2 className="font-medium mt-1">{t("conquistadores.tituloActividadesPorTipo")}</h2>
          <div className="h-56 mt-4">
            {actividades.length ? <Bar data={tiposChartData} options={CHART_OPTIONS} /> : <ChartEmpty message={t("conquistadores.chartEmptySinActividades")} />}
          </div>
        </div>
      </section>

      {miembrosSinSeguimiento.length > 0 && (
        <section className="card p-5 border-2 border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-medium">{t("conquistadores.tituloMiembrosSinSeguimiento")}</h2>
              <p className="text-xs text-secondary mt-1">{t("conquistadores.descripcionSinSeguimiento", { dias: DIAS_INACTIVIDAD })}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
            {miembrosSinSeguimiento.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-3">
                <p className="text-sm font-medium">{item.nombres} {item.apellidos}</p>
                <p className="text-xs text-secondary mt-1">{ultimaActividadPorMiembro.get(item.id) ? t("conquistadores.ultimaActividadTexto", { fecha: ultimaActividadPorMiembro.get(item.id) }) : t("conquistadores.sinActividadRegistrada")}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">{t("conquistadores.eyebrowCenso")}</p><h2 className="font-medium mt-1">{t("conquistadores.tituloMiembros")}</h2></div>
            <UsersRound className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4 max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">{t("conquistadores.thNombre")}</th><th className="py-2">{t("conquistadores.thRol")}</th><th className="py-2">{t("conquistadores.thHitos")}</th><th className="py-2"><span className="flex items-center gap-1">{t("conquistadores.thRuta")}<InfoTip texto={t("conquistadores.infoRuta")} /></span></th></tr></thead>
              <tbody>
                {miembros.map((item) => {
                  const yaVinculado = miembrosVinculados.has(item.id);
                  return (
                    <tr key={item.id} className="border-b border-border align-top">
                      <td className="py-2 font-medium">{item.nombres} {item.apellidos}</td>
                      <td className="py-2 text-secondary">{item.rol === "lider" ? t("conquistadores.rolLider") : t("conquistadores.rolMiembro")}</td>
                      <td className="py-2">
                        <div className="flex gap-1 flex-wrap items-center">
                          {item.bautizado && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-bg text-accent">{t("conquistadores.badgeBautizado")}</span>}
                          {item.sellado && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-bg text-accent">{t("conquistadores.badgeSellado")}</span>}
                          {canEdit && !item.bautizado && <button type="button" className="text-[10px] btn-secondary px-1.5 py-0.5" onClick={() => marcarHito(item, "bautizado", "fecha_bautismo")}>{t("conquistadores.botonMasBautizado")}</button>}
                          {canEdit && !item.sellado && <button type="button" className="text-[10px] btn-secondary px-1.5 py-0.5" onClick={() => marcarHito(item, "sellado", "fecha_sellado")}>{t("conquistadores.botonMasSellado")}</button>}
                        </div>
                      </td>
                      <td className="py-2">
                        {yaVinculado ? <span className="text-xs text-success">{t("conquistadores.vinculadoTexto")}</span> : canEdit ? (
                          vinculandoId === item.id ? (
                            <div className="flex flex-col gap-1.5 min-w-[170px]">
                              <select className="input-field text-xs py-1" value={responsableVinculoId} onChange={(event) => setResponsableVinculoId(event.target.value)}>
                                <option value="">{t("conquistadores.opcionResponsableConPuntos")}</option>
                                {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
                              </select>
                              <div className="flex gap-1.5">
                                <button type="button" disabled={saving} className="btn-primary text-xs py-1 px-2 flex-1" onClick={() => vincularRutaEvangelistica(item)}>{t("conquistadores.botonConfirmar")}</button>
                                <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => { setVinculandoId(null); setResponsableVinculoId(""); }}>{t("conquistadores.botonCancelar")}</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => (item.bautizado ? vincularRutaEvangelistica(item) : setVinculandoId(item.id))}>{t("conquistadores.botonVincular")}</button>
                          )
                        ) : <span className="text-xs text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!miembros.length && <p className="text-sm text-secondary py-6 text-center">{t("conquistadores.sinMiembrosRegistrados")}</p>}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">{t("conquistadores.eyebrowTrabajoRealizado")}</p><h2 className="font-medium mt-1">{t("conquistadores.tituloActividadesPanel")}</h2></div>
            <Flag className="w-5 h-5 text-accent" />
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
            {!actividades.length && <p className="text-sm text-muted py-6">{t("conquistadores.sinActividadesRegistradas")}</p>}
          </div>
          {canEdit && <form onSubmit={createActividad} className="border-t border-border mt-4 pt-4 grid gap-2">
            <p className="text-sm font-medium mb-1">{t("conquistadores.tituloRegistrarActividad")}</p>
            <div className="grid grid-cols-2 gap-2">
              <input required type="date" className="input-field" value={actividadForm.fecha} onChange={(event) => setActividadForm({ ...actividadForm, fecha: event.target.value })} />
              <select className="input-field" value={actividadForm.tipo} onChange={(event) => setActividadForm({ ...actividadForm, tipo: event.target.value })}>
                {Object.entries(TIPO_ACTIVIDAD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <textarea className="input-field min-h-14" placeholder={t("conquistadores.placeholderDescripcionActividad")} value={actividadForm.descripcion} onChange={(event) => setActividadForm({ ...actividadForm, descripcion: event.target.value })} />
            <select className="input-field" value={actividadForm.responsable_persona_id} onChange={(event) => setActividadForm({ ...actividadForm, responsable_persona_id: event.target.value })}>
              <option value="">{t("conquistadores.opcionResponsableSimple")}</option>
              {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
            </select>
            {activos.length > 0 && <div>
              <p className="text-xs text-secondary mb-1">{t("conquistadores.asistenciaIndividualLabel")}</p>
              <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                {activos.map((miembro) => <label key={miembro.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[miembro.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [miembro.id]: event.target.checked })} />{miembro.nombres} {miembro.apellidos}</label>)}
              </div>
            </div>}
            <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />{t("conquistadores.botonRegistrarActividad")}</button>
          </form>}
        </div>
      </section>

      <form onSubmit={createMiembro} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
        <h2 className="font-medium flex items-center gap-1.5">{t("conquistadores.tituloNuevoMiembro")}<InfoTip texto={t("conquistadores.infoNuevoMiembro")} /></h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <input required className="input-field" placeholder={t("conquistadores.placeholderNombres")} value={miembroForm.nombres} onChange={(event) => setMiembroForm({ ...miembroForm, nombres: event.target.value })} />
          <input required className="input-field" placeholder={t("conquistadores.placeholderApellidos")} value={miembroForm.apellidos} onChange={(event) => setMiembroForm({ ...miembroForm, apellidos: event.target.value })} />
          <input className="input-field" placeholder={t("conquistadores.placeholderTelefono")} value={miembroForm.telefono} onChange={(event) => setMiembroForm({ ...miembroForm, telefono: event.target.value })} />
        </div>
        <select className="input-field" value={miembroForm.rol} onChange={(event) => setMiembroForm({ ...miembroForm, rol: event.target.value })}>
          <option value="miembro">{t("conquistadores.rolMiembro")}</option>
          <option value="lider">{t("conquistadores.rolLider")}</option>
        </select>
        <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {t("conquistadores.botonRegistrarMiembro")}</button>
      </form>
    </div>
  );
}
