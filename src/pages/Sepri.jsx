import { useEffect, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { ShieldAlert, UserCheck, Plus, CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import { descargarCsv, descargarExcel, descargarPdf } from "../lib/reportExport";
import ChartEmpty from "../components/ChartEmpty";
import Empty from "../components/Empty";
import ExportButtons from "../components/ExportButtons";
import InfoTip from "../components/InfoTip";
import Toast from "../components/Toast";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);
const sepriCache = new Map();
const CHART_OPTIONS = chartOptions();

const PLAZO_DIAS = 30;

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


function diasAnticipacion(fechaEvento, creadoEn) {
  const evento = new Date(`${fechaEvento}T00:00:00Z`);
  const creado = new Date(creadoEn);
  return Math.round((evento.getTime() - Date.UTC(creado.getUTCFullYear(), creado.getUTCMonth(), creado.getUTCDate())) / 86400000);
}

export default function Sepri() {
  const { t } = useTranslation();
  const ESTADO_LABELS = t('sepri.estadoLabels', { returnObjects: true });
  const ESTADO_TONO = { pendiente: "bg-warning-bg text-warning", aprobado: "bg-success-bg text-success", rechazado: "bg-danger-bg text-danger" };
  const UBICACION_LABELS = t('sepri.ubicacionLabels', { returnObjects: true });
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
    if (!congregacionId) { setLoading(false); setError(t('sepri.sinCongregacion')); return; }
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
    if (failed) setError(t('sepri.errorCargar'));
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
    if (result.error) { setError(t('sepri.errorEnviarSolicitud', { mensaje: result.error.message })); return; }
    setNotice(t('sepri.solicitudEnviada')); setSolicitudForm(EMPTY_SOLICITUD); load();
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
    if (result.error) { setError(t('sepri.errorGuardarDelegado', { mensaje: result.error.message })); return; }
    setNotice(editingDelegadoId ? t('sepri.delegadoActualizado') : t('sepri.delegadoRegistrado')); resetDelegadoForm(); load();
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('sepri.cargando')}</div>;

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
    { label: t('sepri.tabSolicitudes') }
  );
  const distribucionEstado = distributionDataset(
    Object.entries(ESTADO_LABELS).map(([key, label]) => ({ label, total: solicitudes.filter((item) => item.estado === key).length })).filter((item) => item.total > 0),
    { datasetLabel: t('sepri.tabSolicitudes') }
  );
  const rechazadas = solicitudes.filter((item) => item.estado === "rechazado").length;
  const insightGeneral = solicitudes.length
    ? `${cumplimiento === null ? t('sepri.insightSinAnticipacion') : cumplimiento >= 70 ? t('sepri.insightCumplimientoBueno', { pct: cumplimiento }) : t('sepri.insightCumplimientoBajo', { pct: cumplimiento })}${rechazadas > 0 ? t('sepri.insightRechazadas', { count: rechazadas }) : ""}${delegadosVencidos.length > 0 ? t('sepri.insightDelegadosVencidos', { count: delegadosVencidos.length }) : t('sepri.insightSinVencidos')}`
    : t('sepri.insightSinDatos');

  function exportResumen() {
    const porEstado = {};
    solicitudes.forEach((item) => { const label = ESTADO_LABELS[item.estado]; porEstado[label] = (porEstado[label] || 0) + 1; });
    return {
      kpis: [
        { label: t('sepri.export.solicitudesPendientes'), value: pendientes.length },
        { label: t('sepri.export.aprobadas12m'), value: aprobadas12m.length },
        { label: t('sepri.export.cumplimientoPlazo30'), value: cumplimiento === null ? t('sepri.export.sinDatos') : `${cumplimiento}%` },
        { label: t('sepri.export.delegadosActivos'), value: delegadosActivos.length },
      ],
      desgloses: [{ titulo: t('sepri.export.solicitudesPorEstado'), items: Object.entries(porEstado).map(([label, valor]) => ({ label, valor })) }],
    };
  }
  function exportHeaders() {
    return {
      headers: [t('sepri.export.colEvento'), t('sepri.export.colFechaEvento'), t('sepri.export.colUbicacion'), t('sepri.export.colDiasAnticipacion'), t('sepri.export.colEstado'), t('sepri.export.colSolicitado')],
      rows: solicitudesConAnticipacion.map((item) => [item.nombre_evento, item.fecha_evento, UBICACION_LABELS[item.ubicacion], item.dias, ESTADO_LABELS[item.estado], item.created_at.slice(0, 10)]),
    };
  }
  function exportCsv() { descargarCsv({ filename: `sepri-${hoyBogota()}.csv`, titulo: t('sepri.export.tituloReporte'), ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `sepri-${hoyBogota()}.xlsx`, hoja: t('sepri.export.hoja'), titulo: t('sepri.export.tituloReporte'), resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `sepri-${hoyBogota()}.pdf`, titulo: t('sepri.export.tituloReporte'), orientacion: "landscape", resumen: exportResumen(), ...exportHeaders() }); }

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t('sepri.eyebrow')}</p>
          <h1 className="section-title flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-accent" />SEPRI</h1>
          <p className="text-sm text-secondary mt-1 flex items-center gap-1.5">{t('sepri.subtitulo')}<InfoTip texto={t('sepri.subtituloTip')} /></p>
        </div>
        <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {canEdit === false && <p className="text-sm text-secondary bg-surface-1 rounded p-3">{t('sepri.soloLectura')}</p>}
      <Toast>{notice}</Toast>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label={t('sepri.solicitudesPendientes')} value={pendientes.length} tone={pendientes.length ? "text-warning" : ""} />
        <Metric label={t('sepri.aprobadas12m')} value={aprobadas12m.length} />
        <Metric label={t('sepri.cumplimientoPlazo')} value={cumplimiento === null ? "—" : `${cumplimiento}%`} tone={cumplimiento === null ? "" : cumplimiento < 70 ? "text-danger" : "text-success"} info={t('sepri.cumplimientoTip')} />
        <Metric label={t('sepri.delegadosActivos')} value={delegadosActivos.length} tone={!delegadosActivos.length ? "" : delegadosVencidos.length ? "text-danger" : "text-success"} detail={delegadosVencidos.length ? t('sepri.delegadosPorRevisar', { count: delegadosVencidos.length }) : undefined} />
      </section>

      <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightGeneral}</p>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">{t('sepri.historial')}</p>
          <h2 className="font-medium mt-1">{t('sepri.solicitudesPorMes')}</h2>
          <div className="h-56 mt-4">
            {mesesOrdenados.length ? <Line data={trendData} options={CHART_OPTIONS} /> : <ChartEmpty message={t('sepri.sinSolicitudes')} />}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">{t('sepri.estadoActual')}</p>
          <h2 className="font-medium mt-1">{t('sepri.solicitudesPorEstado')}</h2>
          <div className="h-56 mt-4">
            {solicitudes.length ? <Bar data={distribucionEstado} options={CHART_OPTIONS} /> : <ChartEmpty message={t('sepri.sinSolicitudes')} />}
          </div>
        </div>
      </section>

      <nav className="flex gap-1 border-b border-border overflow-x-auto" aria-label={t('sepri.ariaSecciones')} role="tablist">
        {[["solicitudes", t('sepri.tabSolicitudes'), CalendarClock], ["delegados", t('sepri.tabDelegados'), UserCheck]].map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 ${tab === key ? "border-accent text-accent" : "border-transparent text-secondary"}`}><Icon className="w-4 h-4" />{label}</button>
        ))}
      </nav>

      {tab === "solicitudes" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-border"><p className="eyebrow">{t('sepri.historial')}</p><h2 className="font-medium mt-1 flex items-center gap-1.5">{t('sepri.solicitudesEnviadas')}<InfoTip texto={t('sepri.solicitudesEnviadasTip')} /></h2></div>
            {solicitudesConAnticipacion.length ? (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">{t('sepri.colEvento')}</th><th className="font-normal px-4 py-2.5">{t('sepri.colFecha')}</th><th className="font-normal px-4 py-2.5">{t('sepri.colAnticipacion')}</th><th className="font-normal px-4 py-2.5">{t('sepri.colEstado')}</th></tr></thead>
                  <tbody>
                    {solicitudesConAnticipacion.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-4 py-2.5 font-medium">{item.nombre_evento}<p className="text-xs text-secondary font-normal">{UBICACION_LABELS[item.ubicacion]}</p></td>
                        <td className="px-4 py-2.5 text-secondary">{item.fecha_evento}</td>
                        <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${item.dias >= PLAZO_DIAS ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{t('sepri.diasCantidad', { cantidad: item.dias })}</span></td>
                        <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${ESTADO_TONO[item.estado]}`}>{ESTADO_LABELS[item.estado]}</span>{item.notas_distrital && <p className="text-xs text-secondary mt-1">{item.notas_distrital}</p>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty text={t('sepri.sinSolicitudesEnviadas')} />}
          </div>

          {canEdit && (
            <form onSubmit={saveSolicitud} className="card p-5 flex flex-col gap-2 h-fit">
              <h2 className="font-medium">{t('sepri.nuevaSolicitud')}</h2>
              <input required className="input-field" placeholder={t('sepri.nombreEventoPlaceholder')} value={solicitudForm.nombre_evento} onChange={(event) => setSolicitudForm({ ...solicitudForm, nombre_evento: event.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-secondary">{t('sepri.fechaEvento')}<input required type="date" className="input-field mt-1" value={solicitudForm.fecha_evento} onChange={(event) => setSolicitudForm({ ...solicitudForm, fecha_evento: event.target.value })} /></label>
                <label className="text-xs text-secondary">{t('sepri.asistentesEsperados')}<input type="number" min="0" className="input-field mt-1" value={solicitudForm.asistentes_esperados} onChange={(event) => setSolicitudForm({ ...solicitudForm, asistentes_esperados: event.target.value })} /></label>
              </div>
              <label className="text-xs text-secondary">{t('sepri.ubicacion')}<select className="input-field mt-1" value={solicitudForm.ubicacion} onChange={(event) => setSolicitudForm({ ...solicitudForm, ubicacion: event.target.value })}><option value="fuera_templo">{t('sepri.ubicacionLabels.fuera_templo')}</option><option value="dentro_templo">{t('sepri.ubicacionLabels.dentro_templo')}</option></select></label>
              <input className="input-field" placeholder={t('sepri.lugarPlaceholder')} value={solicitudForm.lugar} onChange={(event) => setSolicitudForm({ ...solicitudForm, lugar: event.target.value })} />
              <label className="text-xs text-secondary">{t('sepri.responsableEvento')}<select className="input-field mt-1" value={solicitudForm.responsable_persona_id} onChange={(event) => setSolicitudForm({ ...solicitudForm, responsable_persona_id: event.target.value })}><option value="">{t('sepri.seleccionar')}</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={solicitudForm.poliza_contratada} onChange={(event) => setSolicitudForm({ ...solicitudForm, poliza_contratada: event.target.checked })} />{t('sepri.polizaContratada')}<InfoTip texto={t('sepri.polizaTip')} /></label>
              <textarea className="input-field min-h-14" placeholder={t('sepri.descripcionPlaceholder')} value={solicitudForm.descripcion} onChange={(event) => setSolicitudForm({ ...solicitudForm, descripcion: event.target.value })} />
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {t('sepri.enviarSolicitud')}</button>
            </form>
          )}
        </section>
      )}

      {tab === "delegados" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-border"><p className="eyebrow">{t('sepri.habilitacion')}</p><h2 className="font-medium mt-1">{t('sepri.delegadosSeguridad')}</h2></div>
            {delegados.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">{t('sepri.colDelegado')}</th><th className="font-normal px-4 py-2.5">{t('sepri.colCertificacion')}</th><th className="font-normal px-4 py-2.5"></th></tr></thead>
                  <tbody>
                    {delegados.map((item) => {
                      const vencido = !item.certificacion_vigente || !item.fecha_vencimiento_certificacion || item.fecha_vencimiento_certificacion <= hoyBogota();
                      return (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-4 py-2.5 font-medium">{item.personas?.nombres} {item.personas?.apellidos}</td>
                          <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${vencido ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}>{item.fecha_vencimiento_certificacion ? t('sepri.venceEn', { fecha: item.fecha_vencimiento_certificacion }) : t('sepri.sinFecha')}</span></td>
                          <td className="px-4 py-2.5 text-right">{canEdit && <button type="button" className="text-xs text-accent" onClick={() => editDelegado(item)}>{t('sepri.editar')}</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <Empty text={t('sepri.sinDelegados')} illustration="equipo" />}
          </div>

          {canEdit && (
            <form onSubmit={saveDelegado} className="card p-5 flex flex-col gap-2 h-fit">
              <div className="flex items-center justify-between"><h2 className="font-medium">{editingDelegadoId ? t('sepri.editarDelegado') : t('sepri.nuevoDelegado')}</h2>{editingDelegadoId && <button type="button" className="text-xs text-secondary" onClick={resetDelegadoForm}>{t('sepri.cancelar')}</button>}</div>
              <select required className="input-field" value={delegadoForm.persona_id} onChange={(event) => setDelegadoForm({ ...delegadoForm, persona_id: event.target.value })}>
                <option value="">{t('sepri.persona')}</option>
                {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={delegadoForm.certificacion_vigente} onChange={(event) => setDelegadoForm({ ...delegadoForm, certificacion_vigente: event.target.checked })} />{t('sepri.certificacionVigente')}</label>
              <label className="text-xs text-secondary">{t('sepri.vencimientoCertificacion')}<input type="date" className="input-field mt-1" value={delegadoForm.fecha_vencimiento_certificacion} onChange={(event) => setDelegadoForm({ ...delegadoForm, fecha_vencimiento_certificacion: event.target.value })} /></label>
              <textarea className="input-field min-h-14" placeholder={t('sepri.observacionesPlaceholder')} value={delegadoForm.observaciones} onChange={(event) => setDelegadoForm({ ...delegadoForm, observaciones: event.target.value })} />
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {editingDelegadoId ? t('sepri.guardarCambios') : t('sepri.registrarDelegado')}</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
