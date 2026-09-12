import { useEffect, useState } from "react";
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

const TIPO_ACTIVIDAD_LABELS = { campamento: "Campamento", taller: "Taller", social: "Social", reunion: "Reunión", otro: "Otro" };
const PERIODOS = [["30", "30 días"], ["180", "6 meses"], ["365", "12 meses"]];
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
      setError("Tu usuario no tiene una congregación local asignada.");
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
    if (failed) setError("No se pudo cargar Conquistadores Pentecostales. Intenta nuevamente o contacta al administrador.");
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
    if (result.error) { setError("No se pudo registrar al miembro."); return; }
    setNotice("Miembro registrado.");
    setMiembroForm({ nombres: "", apellidos: "", telefono: "", rol: "miembro" });
    load();
  }

  async function marcarHito(miembro, campo, fechaCampo) {
    if (!canEdit) return;
    setSaving(true);
    const hoy = hoyBogota();
    const result = await supabase.from("conquistadores_miembros").update({ [campo]: true, [fechaCampo]: hoy }).eq("id", miembro.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(`No se pudo actualizar la ficha: ${result.error.message}`); return; }
    setNotice("Ficha actualizada.");
    load();
  }

  // Mismo mecanismo que ya usan Mision Juvenil y Obra Carcelaria: un
  // miembro de Conquistadores que no esta bautizado se conecta con el
  // seguimiento individual real (amigos + Ruta Evangelistica) -- entra a
  // BIS con un responsable, o si ya esta bautizado, queda listo para
  // incorporar a Feligresia sin pasar por ninguna estacion.
  async function vincularRutaEvangelistica(miembro) {
    if (!canEdit) return;
    if (!miembro.bautizado && !responsableVinculoId) { setError("Selecciona quién será el responsable de su seguimiento."); return; }
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
    if (amigoError) { setSaving(false); setError(`No se pudo vincular a la Ruta Evangelística: ${amigoError.message}`); return; }
    if (miembro.bautizado) {
      setSaving(false);
      setNotice(`${nombreCompleto} vinculado -- ya está bautizado, listo para incorporar a Feligresía desde Amigos.`);
      setVinculandoId(null); setResponsableVinculoId(""); load();
      return;
    }
    const { data: estacionBis, error: estacionError } = await getEstacion(congregacionId, "bis");
    if (estacionError || !estacionBis) { setSaving(false); setError("No se encontró la estación BIS de la congregación."); return; }
    const movResult = await iniciarOMoverEstacion({ congregacionId, estacionDestino: estacionBis, amigoId: amigo.id, responsablePersonaId: responsableVinculoId });
    setSaving(false);
    if (movResult.error) { setError(`Se creó el amigo pero no se pudo agregar a BIS: ${movResult.error.message}`); return; }
    setNotice(`${nombreCompleto} vinculado y agregado a BIS.`);
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
    if (actividadResult.error) { setSaving(false); setError(`No se pudo registrar la actividad: ${actividadResult.error.message}`); return; }
    if (activos.length > 0) {
      const asistenciaResult = await supabase.from("conquistadores_asistencia").insert(
        activos.map((miembro) => ({ actividad_id: actividadResult.data.id, miembro_id: miembro.id, asistio: Boolean(asistenciaMarcada[miembro.id]) })),
      );
      if (asistenciaResult.error) { setSaving(false); setError(`La actividad se guardó, pero no se pudo registrar la asistencia individual: ${asistenciaResult.error.message}`); return; }
    }
    setSaving(false);
    setNotice("Actividad registrada con asistencia individual.");
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

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando Conquistadores Pentecostales...</div>;

  const activos = miembros.filter((item) => item.estado === "activo");
  const lideres = activos.filter((item) => item.rol === "lider");
  const actividadesUltimoMes = actividades.filter((item) => item.fecha >= fechaBogota(new Date(Date.now() - 30 * 86400000)));

  const trend = [...new Set(actividades.map((item) => item.fecha))].sort().map((fecha) => ({
    fecha,
    total: actividades.filter((item) => item.fecha === fecha).length,
  }));
  const mitad = Math.floor(trend.length / 2) || 1;
  const primeraMitad = trend.slice(0, mitad).reduce((sum, item) => sum + item.total, 0);
  const segundaMitad = trend.slice(mitad).reduce((sum, item) => sum + item.total, 0);
  const tendenciaVariacion = primeraMitad ? Math.round(((segundaMitad - primeraMitad) / primeraMitad) * 100) : null;

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
    ? `${lideres.length} de ${activos.length} miembros activos son líderes en formación. ${miembrosSinSeguimiento.length > 0 ? `${miembrosSinSeguimiento.length} sin actividad reciente.` : "Todos con actividad reciente."}`
    : "Registra miembros de 18 a 40 años para construir una lectura del ministerio de jóvenes adultos.";

  const chartData = trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: "Actividades" });
  const tiposChartData = distributionDataset(tiposConTotal, { datasetLabel: "Actividades" });

  function exportResumen() {
    return {
      kpis: [
        { label: "Miembros activos", value: activos.length },
        { label: "Líderes en formación", value: lideres.length },
        { label: "Actividades (30 días)", value: actividadesUltimoMes.length },
        { label: "Sin seguimiento reciente", value: miembrosSinSeguimiento.length },
      ],
      desgloses: [{ titulo: "Actividades por tipo", items: tiposConTotal.map((item) => ({ label: item.label, valor: item.total })) }],
    };
  }
  function exportHeaders() {
    return {
      headers: ["Nombre", "Rol", "Estado", "Fecha de ingreso", "Última actividad"],
      rows: miembros.map((item) => [`${item.nombres || ""} ${item.apellidos || ""}`.trim(), item.rol === "lider" ? "Líder" : "Miembro", item.estado === "activo" ? "Activo" : "Inactivo", item.fecha_ingreso || "—", ultimaActividadPorMiembro.get(item.id) || "Sin registro"]),
    };
  }
  function exportCsv() { descargarCsv({ filename: `conquistadores-${hoyBogota()}.csv`, titulo: "Conquistadores Pentecostales — Miembros", ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `conquistadores-${hoyBogota()}.xlsx`, hoja: "Miembros", titulo: "Conquistadores Pentecostales — Miembros", resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `conquistadores-${hoyBogota()}.pdf`, titulo: "Conquistadores Pentecostales — Miembros", orientacion: "landscape", resumen: exportResumen(), ...exportHeaders() }); }

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Comité nacional · 18 a 40 años</p>
          <h1 className="section-title flex items-center gap-2"><Flag className="w-6 h-6 text-accent" />Conquistadores Pentecostales</h1>
          <p className="text-sm text-secondary mt-1">Formación de líderes jóvenes adultos comprometidos con la evangelización juvenil.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5" role="group" aria-label="Periodo del análisis">
            {PERIODOS.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-ink text-white border-ink" : "border-border text-secondary"}`}>{label}</button>
            ))}
          </div>
          <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {canEdit === false && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Tienes acceso de consulta. Las altas y modificaciones requieren el permiso de edición de Conquistadores Pentecostales.</p>}
      <Toast>{notice}</Toast>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Miembros activos" value={activos.length} progress={activos.length ? 100 : 0} detail={`${miembros.length} registrados en total`} insight={activos.length ? "Compara con la asistencia real para detectar continuidad." : "Registra el primer miembro para iniciar el trabajo."} />
        <Metric label="Líderes en formación" value={lideres.length} progress={activos.length ? Math.round((lideres.length / activos.length) * 100) : 0} detail={`${activos.length ? Math.round((lideres.length / activos.length) * 100) : 0}% de los activos`} insight="Líderes comprometidos con la evangelización juvenil del distrito." tip="Marcar a alguien como líder aquí es solo un registro del comité; no le da permisos adicionales en el sistema." />
        <Metric label="Actividades (30 días)" value={actividadesUltimoMes.length} tone={variacion30Dias === null || variacion30Dias >= 0 ? "text-success" : "text-danger"} progress={actividadesUltimoMes.length ? 100 : 0} detail={`${actividades.length} en el periodo seleccionado`} insight={variacion30Dias === null ? "Aún no hay suficiente historial para comparar." : `${variacion30Dias >= 0 ? "Creció" : "Bajó"} ${Math.abs(variacion30Dias)}% frente a los 30 días anteriores.`} />
        <Metric label="Sin seguimiento reciente" value={miembrosSinSeguimiento.length} tone={miembrosSinSeguimiento.length > 0 ? "text-danger" : "text-success"} progress={activos.length ? Math.round((miembrosSinSeguimiento.length / activos.length) * 100) : 0} detail={`Más de ${DIAS_INACTIVIDAD} días sin actividad`} insight={miembrosSinSeguimiento.length > 0 ? "Revisa la lista y programa un contacto." : "Todos los miembros tienen seguimiento reciente."} />
      </section>

      <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightGeneral}</p>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">Trabajo realizado</p>
          <h2 className="font-medium mt-1">Tendencia de actividades</h2>
          <div className="h-56 mt-4">
            {trend.length ? <Line data={chartData} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin actividades registradas en el periodo." />}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">Modalidad</p>
          <h2 className="font-medium mt-1">Actividades por tipo</h2>
          <div className="h-56 mt-4">
            {actividades.length ? <Bar data={tiposChartData} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin actividades registradas todavía." />}
          </div>
        </div>
      </section>

      {miembrosSinSeguimiento.length > 0 && (
        <section className="card p-5 border-2 border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-medium">Miembros sin seguimiento reciente</h2>
              <p className="text-xs text-secondary mt-1">Sin actividad registrada en más de {DIAS_INACTIVIDAD} días.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
            {miembrosSinSeguimiento.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-3">
                <p className="text-sm font-medium">{item.nombres} {item.apellidos}</p>
                <p className="text-xs text-secondary mt-1">{ultimaActividadPorMiembro.get(item.id) ? `Última actividad: ${ultimaActividadPorMiembro.get(item.id)}` : "Sin actividad registrada"}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">Censo</p><h2 className="font-medium mt-1">Miembros</h2></div>
            <UsersRound className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4 max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">Nombre</th><th className="py-2">Rol</th><th className="py-2">Hitos</th><th className="py-2"><span className="flex items-center gap-1">Ruta<InfoTip texto="Vincula a alguien aún no bautizado con el mismo seguimiento individual que usa toda la congregación: entra a BIS, o si ya está bautizado, queda listo para incorporar a Feligresía." /></span></th></tr></thead>
              <tbody>
                {miembros.map((item) => {
                  const yaVinculado = miembrosVinculados.has(item.id);
                  return (
                    <tr key={item.id} className="border-b border-border align-top">
                      <td className="py-2 font-medium">{item.nombres} {item.apellidos}</td>
                      <td className="py-2 text-secondary">{item.rol === "lider" ? "Líder" : "Miembro"}</td>
                      <td className="py-2">
                        <div className="flex gap-1 flex-wrap items-center">
                          {item.bautizado && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-bg text-accent">Bautizado</span>}
                          {item.sellado && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-bg text-accent">Sellado</span>}
                          {canEdit && !item.bautizado && <button type="button" className="text-[10px] btn-secondary px-1.5 py-0.5" onClick={() => marcarHito(item, "bautizado", "fecha_bautismo")}>+ Bautizado</button>}
                          {canEdit && !item.sellado && <button type="button" className="text-[10px] btn-secondary px-1.5 py-0.5" onClick={() => marcarHito(item, "sellado", "fecha_sellado")}>+ Sellado</button>}
                        </div>
                      </td>
                      <td className="py-2">
                        {yaVinculado ? <span className="text-xs text-success">Vinculado</span> : canEdit ? (
                          vinculandoId === item.id ? (
                            <div className="flex flex-col gap-1.5 min-w-[170px]">
                              <select className="input-field text-xs py-1" value={responsableVinculoId} onChange={(event) => setResponsableVinculoId(event.target.value)}>
                                <option value="">Responsable...</option>
                                {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
                              </select>
                              <div className="flex gap-1.5">
                                <button type="button" disabled={saving} className="btn-primary text-xs py-1 px-2 flex-1" onClick={() => vincularRutaEvangelistica(item)}>Confirmar</button>
                                <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => { setVinculandoId(null); setResponsableVinculoId(""); }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => (item.bautizado ? vincularRutaEvangelistica(item) : setVinculandoId(item.id))}>Vincular</button>
                          )
                        ) : <span className="text-xs text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!miembros.length && <p className="text-sm text-secondary py-6 text-center">Aún no hay miembros registrados.</p>}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">Trabajo realizado</p><h2 className="font-medium mt-1">Actividades</h2></div>
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
            {!actividades.length && <p className="text-sm text-muted py-6">Aún no hay actividades registradas.</p>}
          </div>
          {canEdit && <form onSubmit={createActividad} className="border-t border-border mt-4 pt-4 grid gap-2">
            <p className="text-sm font-medium mb-1">Registrar actividad</p>
            <div className="grid grid-cols-2 gap-2">
              <input required type="date" className="input-field" value={actividadForm.fecha} onChange={(event) => setActividadForm({ ...actividadForm, fecha: event.target.value })} />
              <select className="input-field" value={actividadForm.tipo} onChange={(event) => setActividadForm({ ...actividadForm, tipo: event.target.value })}>
                {Object.entries(TIPO_ACTIVIDAD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <textarea className="input-field min-h-14" placeholder="Descripción" value={actividadForm.descripcion} onChange={(event) => setActividadForm({ ...actividadForm, descripcion: event.target.value })} />
            <select className="input-field" value={actividadForm.responsable_persona_id} onChange={(event) => setActividadForm({ ...actividadForm, responsable_persona_id: event.target.value })}>
              <option value="">Responsable</option>
              {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
            </select>
            {activos.length > 0 && <div>
              <p className="text-xs text-secondary mb-1">Asistencia individual</p>
              <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                {activos.map((miembro) => <label key={miembro.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[miembro.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [miembro.id]: event.target.checked })} />{miembro.nombres} {miembro.apellidos}</label>)}
              </div>
            </div>}
            <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />Registrar actividad</button>
          </form>}
        </div>
      </section>

      <form onSubmit={createMiembro} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
        <h2 className="font-medium flex items-center gap-1.5">Nuevo miembro<InfoTip texto="No hace falta que ya esté en el censo de Feligresía -- Conquistadores administra jóvenes adultos convertidos y no convertidos. Si aún no está bautizado, usa 'Vincular' en la lista para conectarlo con la Ruta Evangelística." /></h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <input required className="input-field" placeholder="Nombres" value={miembroForm.nombres} onChange={(event) => setMiembroForm({ ...miembroForm, nombres: event.target.value })} />
          <input required className="input-field" placeholder="Apellidos" value={miembroForm.apellidos} onChange={(event) => setMiembroForm({ ...miembroForm, apellidos: event.target.value })} />
          <input className="input-field" placeholder="Teléfono (opcional)" value={miembroForm.telefono} onChange={(event) => setMiembroForm({ ...miembroForm, telefono: event.target.value })} />
        </div>
        <select className="input-field" value={miembroForm.rol} onChange={(event) => setMiembroForm({ ...miembroForm, rol: event.target.value })}>
          <option value="miembro">Miembro</option>
          <option value="lider">Líder</option>
        </select>
        <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> Registrar miembro</button>
      </form>
    </div>
  );
}
