import { useEffect, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { ShieldAlert, UserCheck, Plus, CalendarClock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import { descargarCsv, descargarExcel, descargarPdf } from "../lib/reportExport";
import ChartEmpty from "../components/ChartEmpty";
import ExportButtons from "../components/ExportButtons";
import InfoTip from "../components/InfoTip";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);
const sepriCache = new Map();
const CHART_OPTIONS = chartOptions();

const PLAZO_DIAS = 30;
const ESTADO_LABELS = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" };
const ESTADO_TONO = { pendiente: "bg-warning-bg text-warning", aprobado: "bg-success-bg text-success", rechazado: "bg-danger-bg text-danger" };
const UBICACION_LABELS = { dentro_templo: "Dentro del templo", fuera_templo: "Fuera del templo" };

const EMPTY_SOLICITUD = { nombre_evento: "", fecha_evento: "", ubicacion: "fuera_templo", lugar: "", asistentes_esperados: "", poliza_contratada: false, responsable_persona_id: "", descripcion: "" };
const EMPTY_DELEGADO = { persona_id: "", certificacion_vigente: false, fecha_vencimiento_certificacion: "", observaciones: "" };

function Metric({ label, value, tone = "", detail, info }) {
  return (
    <div className="stat-tile">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1">{label}{info && <InfoTip texto={info} />}</p>
      <p className={`text-2xl font-semibold mt-3 ${tone}`}>{value}</p>
      {detail && <p className="text-xs text-muted mt-1">{detail}</p>}
    </div>
  );
}

function Empty({ text }) {
  return <div className="p-8 text-center text-sm text-secondary bg-surface-1 rounded-card border border-dashed border-border">{text}</div>;
}

function diasAnticipacion(fechaEvento, creadoEn) {
  const evento = new Date(`${fechaEvento}T00:00:00Z`);
  const creado = new Date(creadoEn);
  return Math.round((evento.getTime() - Date.UTC(creado.getUTCFullYear(), creado.getUTCMonth(), creado.getUTCDate())) / 86400000);
}

export default function Sepri() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [tab, setTab] = useState("solicitudes");
  const [solicitudes, setSolicitudes] = useState([]);
  const [delegados, setDelegados] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(null); // null = todavia no se confirma el permiso
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [solicitudForm, setSolicitudForm] = useState(EMPTY_SOLICITUD);
  const [editingDelegadoId, setEditingDelegadoId] = useState(null);
  const [delegadoForm, setDelegadoForm] = useState(EMPTY_DELEGADO);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function load() {
    if (!congregacionId) { setLoading(false); setError("Tu usuario no tiene una congregación local asignada."); return; }
    const cacheKey = congregacionId;
    const cached = sepriCache.get(cacheKey);
    if (cached) {
      setSolicitudes(cached.solicitudes);
      setDelegados(cached.delegados);
      setPersonas(cached.personas);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    const [s, d, p] = await Promise.all([
      supabase.from("sepri_solicitudes_evento").select("id, nombre_evento, fecha_evento, ubicacion, lugar, asistentes_esperados, poliza_contratada, estado, notas_distrital, created_at, personas(nombres, apellidos)").eq("congregacion_id", congregacionId).order("created_at", { ascending: false }),
      supabase.from("sepri_delegados").select("id, persona_id, certificacion_vigente, fecha_vencimiento_certificacion, activo, observaciones, personas(nombres, apellidos)").eq("congregacion_id", congregacionId).order("created_at", { ascending: false }),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
    ]);
    const failed = [s, d, p].find((item) => item.error);
    if (failed) setError("No se pudo cargar SEPRI. Intenta nuevamente o contacta al administrador.");
    const freshSolicitudes = s.data ?? [];
    const freshDelegados = d.data ?? [];
    const freshPersonas = p.data ?? [];
    setSolicitudes(freshSolicitudes);
    setDelegados(freshDelegados);
    setPersonas(freshPersonas);
    setLoading(false);
    sepriCache.set(cacheKey, { solicitudes: freshSolicitudes, delegados: freshDelegados, personas: freshPersonas });
  }

  useEffect(() => { load(); }, [congregacionId]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "sepri.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  async function saveSolicitud(event) {
    event.preventDefault();
    if (!canEdit || !solicitudForm.nombre_evento.trim() || !solicitudForm.fecha_evento) return;
    setSaving(true); setError(null);
    const [{ data: cong }, { data: userData }] = await Promise.all([
      supabase.from("congregaciones").select("distrito_id").eq("id", congregacionId).single(),
      supabase.auth.getUser(),
    ]);
    const result = await supabase.from("sepri_solicitudes_evento").insert({
      congregacion_id: congregacionId,
      distrito_id: cong?.distrito_id,
      creado_por: userData?.user?.id,
      nombre_evento: solicitudForm.nombre_evento.trim(),
      fecha_evento: solicitudForm.fecha_evento,
      ubicacion: solicitudForm.ubicacion,
      lugar: solicitudForm.lugar.trim() || null,
      asistentes_esperados: solicitudForm.asistentes_esperados ? Number(solicitudForm.asistentes_esperados) : null,
      poliza_contratada: solicitudForm.poliza_contratada,
      responsable_persona_id: solicitudForm.responsable_persona_id || null,
      descripcion: solicitudForm.descripcion.trim() || null,
    });
    setSaving(false);
    if (result.error) { setError(`No se pudo enviar la solicitud: ${result.error.message}`); return; }
    setNotice("Solicitud enviada a la Secretaría Distrital."); setSolicitudForm(EMPTY_SOLICITUD); load();
  }

  function resetDelegadoForm() { setEditingDelegadoId(null); setDelegadoForm(EMPTY_DELEGADO); }
  function editDelegado(item) {
    setEditingDelegadoId(item.id);
    setDelegadoForm({ persona_id: item.persona_id, certificacion_vigente: item.certificacion_vigente, fecha_vencimiento_certificacion: item.fecha_vencimiento_certificacion || "", observaciones: item.observaciones || "" });
  }
  async function saveDelegado(event) {
    event.preventDefault();
    if (!canEdit || !delegadoForm.persona_id) return;
    setSaving(true); setError(null);
    const payload = { persona_id: delegadoForm.persona_id, certificacion_vigente: delegadoForm.certificacion_vigente, fecha_vencimiento_certificacion: delegadoForm.fecha_vencimiento_certificacion || null, observaciones: delegadoForm.observaciones.trim() || null };
    const result = editingDelegadoId
      ? await supabase.from("sepri_delegados").update(payload).eq("id", editingDelegadoId)
      : await supabase.from("sepri_delegados").insert({ ...payload, congregacion_id: congregacionId });
    setSaving(false);
    if (result.error) { setError(`No se pudo guardar el delegado: ${result.error.message}`); return; }
    setNotice(editingDelegadoId ? "Delegado actualizado." : "Delegado registrado."); resetDelegadoForm(); load();
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando SEPRI...</div>;

  const pendientes = solicitudes.filter((item) => item.estado === "pendiente");
  const aprobadas12m = solicitudes.filter((item) => item.estado === "aprobado" && item.created_at >= fechaBogota(new Date(Date.now() - 365 * 86400000)));
  const solicitudesConAnticipacion = solicitudes.map((item) => ({ ...item, dias: diasAnticipacion(item.fecha_evento, item.created_at) }));
  const evaluables = solicitudesConAnticipacion.filter((item) => item.created_at >= fechaBogota(new Date(Date.now() - 365 * 86400000)));
  const aTiempo = evaluables.filter((item) => item.dias >= PLAZO_DIAS);
  const cumplimiento = evaluables.length ? Math.round((aTiempo.length / evaluables.length) * 100) : null;
  const delegadosActivos = delegados.filter((item) => item.activo);
  const delegadosVencidos = delegadosActivos.filter((item) => !item.certificacion_vigente || !item.fecha_vencimiento_certificacion || item.fecha_vencimiento_certificacion <= hoyBogota());

  const porMes = new Map();
  solicitudes.forEach((item) => {
    const clave = item.created_at.slice(0, 7);
    porMes.set(clave, (porMes.get(clave) || 0) + 1);
  });
  const mesesOrdenados = [...porMes.keys()].sort();
  const trendData = trendDataset(
    mesesOrdenados.map((mes) => new Date(`${mes}-01T00:00:00`).toLocaleDateString("es-CO", { month: "short", year: "2-digit" })),
    mesesOrdenados.map((mes) => porMes.get(mes)),
    { label: "Solicitudes" }
  );
  const distribucionEstado = distributionDataset(
    Object.entries(ESTADO_LABELS).map(([key, label]) => ({ label, total: solicitudes.filter((item) => item.estado === key).length })).filter((item) => item.total > 0),
    { datasetLabel: "Solicitudes" }
  );
  const rechazadas = solicitudes.filter((item) => item.estado === "rechazado").length;
  const insightGeneral = solicitudes.length
    ? `${cumplimiento === null ? "Aún no hay suficientes solicitudes resueltas para medir cumplimiento del plazo. " : cumplimiento >= 70 ? `${cumplimiento}% de las solicitudes cumplen el plazo de 30 días. ` : `Solo ${cumplimiento}% de las solicitudes cumplen el plazo de 30 días -- reforzar la planeación con anticipación. `}${rechazadas > 0 ? `${rechazadas} solicitud${rechazadas === 1 ? "" : "es"} rechazada${rechazadas === 1 ? "" : "s"}. ` : ""}${delegadosVencidos.length > 0 ? `${delegadosVencidos.length} delegado(s) con certificación por revisar.` : "Todos los delegados activos tienen certificación vigente."}`
    : "Registra solicitudes y delegados para construir una lectura de la gestión de riesgo.";

  function exportResumen() {
    const porEstado = {};
    solicitudes.forEach((item) => { const label = ESTADO_LABELS[item.estado]; porEstado[label] = (porEstado[label] || 0) + 1; });
    return {
      kpis: [
        { label: "Solicitudes pendientes", value: pendientes.length },
        { label: "Aprobadas (12 meses)", value: aprobadas12m.length },
        { label: "Cumplimiento del plazo de 30 días", value: cumplimiento === null ? "Sin datos" : `${cumplimiento}%` },
        { label: "Delegados activos", value: delegadosActivos.length },
      ],
      desgloses: [{ titulo: "Solicitudes por estado", items: Object.entries(porEstado).map(([label, valor]) => ({ label, valor })) }],
    };
  }
  function exportHeaders() {
    return {
      headers: ["Evento", "Fecha del evento", "Ubicación", "Días de anticipación", "Estado", "Solicitado"],
      rows: solicitudesConAnticipacion.map((item) => [item.nombre_evento, item.fecha_evento, UBICACION_LABELS[item.ubicacion], item.dias, ESTADO_LABELS[item.estado], item.created_at.slice(0, 10)]),
    };
  }
  function exportCsv() { descargarCsv({ filename: `sepri-${hoyBogota()}.csv`, titulo: "SEPRI — Solicitudes de eventos", ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `sepri-${hoyBogota()}.xlsx`, hoja: "Solicitudes", titulo: "SEPRI — Solicitudes de eventos", resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `sepri-${hoyBogota()}.pdf`, titulo: "SEPRI — Solicitudes de eventos", orientacion: "landscape", resumen: exportResumen(), ...exportHeaders() }); }

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Seguridad y Prevención del Riesgo</p>
          <h1 className="section-title flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-accent" />SEPRI</h1>
          <p className="text-sm text-secondary mt-1 flex items-center gap-1.5">Solicitudes de aprobación de eventos y delegados de seguridad.<InfoTip texto="Toda actividad fuera del templo debe presentarse a la Secretaría Distrital con al menos 30 días de anticipación para su aprobación -- fuera de ese plazo, la iglesia no responde por lo que ocurra en el evento." /></p>
        </div>
        <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {canEdit === false && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Tienes acceso de consulta. Enviar solicitudes y gestionar delegados requiere el permiso de edición de SEPRI.</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Solicitudes pendientes" value={pendientes.length} tone={pendientes.length ? "text-warning" : ""} />
        <Metric label="Aprobadas (12 meses)" value={aprobadas12m.length} />
        <Metric label="Cumplimiento del plazo" value={cumplimiento === null ? "—" : `${cumplimiento}%`} tone={cumplimiento === null ? "" : cumplimiento < 70 ? "text-danger" : "text-success"} info="Porcentaje de solicitudes de los últimos 12 meses presentadas con 30 días de anticipación o más, como exige el protocolo." />
        <Metric label="Delegados activos" value={delegadosActivos.length} tone={!delegadosActivos.length ? "" : delegadosVencidos.length ? "text-danger" : "text-success"} detail={delegadosVencidos.length ? `${delegadosVencidos.length} con certificación por revisar` : undefined} />
      </section>

      <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightGeneral}</p>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">Historial</p>
          <h2 className="font-medium mt-1">Solicitudes por mes</h2>
          <div className="h-56 mt-4">
            {mesesOrdenados.length ? <Line data={trendData} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin solicitudes registradas todavía." />}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">Estado actual</p>
          <h2 className="font-medium mt-1">Solicitudes por estado</h2>
          <div className="h-56 mt-4">
            {solicitudes.length ? <Bar data={distribucionEstado} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin solicitudes registradas todavía." />}
          </div>
        </div>
      </section>

      <nav className="flex gap-1 border-b border-border overflow-x-auto" aria-label="Secciones de SEPRI" role="tablist">
        {[["solicitudes", "Solicitudes de eventos", CalendarClock], ["delegados", "Delegados", UserCheck]].map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 ${tab === key ? "border-accent text-accent" : "border-transparent text-secondary"}`}><Icon className="w-4 h-4" />{label}</button>
        ))}
      </nav>

      {tab === "solicitudes" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-border"><p className="eyebrow">Historial</p><h2 className="font-medium mt-1 flex items-center gap-1.5">Solicitudes enviadas<InfoTip texto="Una vez la Secretaría Distrital aprueba o rechaza, no puedes volver a editarla -- si necesitas corregir algo mientras sigue 'Pendiente', sí puedes hacerlo." /></h2></div>
            {solicitudesConAnticipacion.length ? (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Evento</th><th className="font-normal px-4 py-2.5">Fecha</th><th className="font-normal px-4 py-2.5">Anticipación</th><th className="font-normal px-4 py-2.5">Estado</th></tr></thead>
                  <tbody>
                    {solicitudesConAnticipacion.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-4 py-2.5 font-medium">{item.nombre_evento}<p className="text-xs text-secondary font-normal">{UBICACION_LABELS[item.ubicacion]}</p></td>
                        <td className="px-4 py-2.5 text-secondary">{item.fecha_evento}</td>
                        <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${item.dias >= PLAZO_DIAS ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{item.dias} días</span></td>
                        <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${ESTADO_TONO[item.estado]}`}>{ESTADO_LABELS[item.estado]}</span>{item.notas_distrital && <p className="text-xs text-secondary mt-1">{item.notas_distrital}</p>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty text="Aún no se ha enviado ninguna solicitud." />}
          </div>

          {canEdit && (
            <form onSubmit={saveSolicitud} className="card p-5 flex flex-col gap-2 h-fit">
              <h2 className="font-medium">Nueva solicitud de evento</h2>
              <input required className="input-field" placeholder="Nombre del evento" value={solicitudForm.nombre_evento} onChange={(event) => setSolicitudForm({ ...solicitudForm, nombre_evento: event.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-secondary">Fecha del evento<input required type="date" className="input-field mt-1" value={solicitudForm.fecha_evento} onChange={(event) => setSolicitudForm({ ...solicitudForm, fecha_evento: event.target.value })} /></label>
                <label className="text-xs text-secondary">Asistentes esperados<input type="number" min="0" className="input-field mt-1" value={solicitudForm.asistentes_esperados} onChange={(event) => setSolicitudForm({ ...solicitudForm, asistentes_esperados: event.target.value })} /></label>
              </div>
              <label className="text-xs text-secondary">Ubicación<select className="input-field mt-1" value={solicitudForm.ubicacion} onChange={(event) => setSolicitudForm({ ...solicitudForm, ubicacion: event.target.value })}><option value="fuera_templo">Fuera del templo</option><option value="dentro_templo">Dentro del templo</option></select></label>
              <input className="input-field" placeholder="Lugar / dirección" value={solicitudForm.lugar} onChange={(event) => setSolicitudForm({ ...solicitudForm, lugar: event.target.value })} />
              <label className="text-xs text-secondary">Responsable del evento<select className="input-field mt-1" value={solicitudForm.responsable_persona_id} onChange={(event) => setSolicitudForm({ ...solicitudForm, responsable_persona_id: event.target.value })}><option value="">Seleccionar...</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={solicitudForm.poliza_contratada} onChange={(event) => setSolicitudForm({ ...solicitudForm, poliza_contratada: event.target.checked })} />Póliza de seguros contratada<InfoTip texto="El protocolo sugiere contratar una póliza para los participantes, especialmente en eventos fuera del templo." /></label>
              <textarea className="input-field min-h-14" placeholder="Descripción / medidas de seguridad previstas" value={solicitudForm.descripcion} onChange={(event) => setSolicitudForm({ ...solicitudForm, descripcion: event.target.value })} />
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> Enviar solicitud</button>
            </form>
          )}
        </section>
      )}

      {tab === "delegados" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-border"><p className="eyebrow">Habilitación</p><h2 className="font-medium mt-1">Delegados de seguridad</h2></div>
            {delegados.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Delegado</th><th className="font-normal px-4 py-2.5">Certificación</th><th className="font-normal px-4 py-2.5"></th></tr></thead>
                  <tbody>
                    {delegados.map((item) => {
                      const vencido = !item.certificacion_vigente || !item.fecha_vencimiento_certificacion || item.fecha_vencimiento_certificacion <= hoyBogota();
                      return (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-4 py-2.5 font-medium">{item.personas?.nombres} {item.personas?.apellidos}</td>
                          <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${vencido ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}>{item.fecha_vencimiento_certificacion ? `Vence ${item.fecha_vencimiento_certificacion}` : "Sin fecha"}</span></td>
                          <td className="px-4 py-2.5 text-right">{canEdit && <button type="button" className="text-xs text-accent" onClick={() => editDelegado(item)}>Editar</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <Empty text="Aún no hay delegados registrados." />}
          </div>

          {canEdit && (
            <form onSubmit={saveDelegado} className="card p-5 flex flex-col gap-2 h-fit">
              <div className="flex items-center justify-between"><h2 className="font-medium">{editingDelegadoId ? "Editar delegado" : "Nuevo delegado"}</h2>{editingDelegadoId && <button type="button" className="text-xs text-secondary" onClick={resetDelegadoForm}>Cancelar</button>}</div>
              <select required className="input-field" value={delegadoForm.persona_id} onChange={(event) => setDelegadoForm({ ...delegadoForm, persona_id: event.target.value })}>
                <option value="">Persona</option>
                {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={delegadoForm.certificacion_vigente} onChange={(event) => setDelegadoForm({ ...delegadoForm, certificacion_vigente: event.target.checked })} />Certificación vigente</label>
              <label className="text-xs text-secondary">Vencimiento de la certificación<input type="date" className="input-field mt-1" value={delegadoForm.fecha_vencimiento_certificacion} onChange={(event) => setDelegadoForm({ ...delegadoForm, fecha_vencimiento_certificacion: event.target.value })} /></label>
              <textarea className="input-field min-h-14" placeholder="Observaciones" value={delegadoForm.observaciones} onChange={(event) => setDelegadoForm({ ...delegadoForm, observaciones: event.target.value })} />
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {editingDelegadoId ? "Guardar cambios" : "Registrar delegado"}</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
