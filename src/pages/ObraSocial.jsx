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
import { AlertTriangle, HandHeart, Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import ChartEmpty from "../components/ChartEmpty";
import InfoTip from "../components/InfoTip";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

const TIPO_NECESIDAD_LABELS = { economica: "Económica", alimentaria: "Alimentaria", salud: "Salud", vivienda: "Vivienda", otra: "Otra" };
const PRIORIDAD_LABELS = { baja: "Baja", media: "Media", alta: "Alta" };
const ESTADO_LABELS = { identificada: "Identificada", en_apoyo: "En apoyo", resuelta: "Resuelta", cerrada: "Cerrada" };
const TIPO_AYUDA_LABELS = { material: "Material", economica: "Económica", acompanamiento: "Acompañamiento", otra: "Otra" };
const PERIODOS = [["30", "30 días"], ["180", "6 meses"], ["365", "12 meses"]];
const DIAS_ALERTA = 30;
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

export default function ObraSocial() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [casos, setCasos] = useState([]);
  const [ayudas, setAyudas] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [casosRedFamilias, setCasosRedFamilias] = useState([]);
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
  const [canEdit, setCanEdit] = useState(false);
  const [casoForm, setCasoForm] = useState({ familia_id: "", red_familias_caso_id: "", tipo_necesidad: "economica", prioridad: "media", responsable_persona_id: "", notas: "" });
  const [selectedCasoId, setSelectedCasoId] = useState(null);
  const [ayudaForm, setAyudaForm] = useState({ fecha: hoyBogota(), tipo: "material", descripcion: "", responsable_persona_id: "" });

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError("Tu usuario no tiene una congregación local asignada.");
      return;
    }
    setLoading(true);
    setError(null);
    const start = new Date();
    start.setDate(start.getDate() - Number(periodo));
    const [c, ay, p, f, rf] = await Promise.all([
      supabase.from("obra_social_casos").select("id, familia_id, red_familias_caso_id, tipo_necesidad, prioridad, estado, responsable_persona_id, fecha_apertura, notas, familias:familia_id(nombre_familia)").eq("congregacion_id", congregacionId).order("fecha_apertura", { ascending: false }),
      supabase.from("obra_social_ayudas").select("id, caso_id, fecha, tipo, descripcion, responsable_persona_id, obra_social_casos!inner(congregacion_id)").eq("obra_social_casos.congregacion_id", congregacionId).gte("fecha", fechaBogota(start)).order("fecha", { ascending: false }),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("familias").select("id, nombre_familia").eq("congregacion_id", congregacionId).order("nombre_familia"),
      supabase.from("red_familias_casos").select("id, familia_id, tipo_necesidad, estado, familias(nombre_familia)").eq("congregacion_id", congregacionId).order("fecha_apertura", { ascending: false }),
    ]);
    const failed = [c, ay, p, f, rf].find((item) => item.error);
    if (failed) setError("No se pudo cargar Obra Social. Intenta nuevamente o contacta al administrador.");
    setCasos(c.data ?? []);
    setAyudas(ay.data ?? []);
    setPersonas(p.data ?? []);
    setFamilias(f.data ?? []);
    setCasosRedFamilias(rf.data ?? []);
    setLoading(false);
  }

  async function createCaso(event) {
    event.preventDefault();
    if (!canEdit || !casoForm.familia_id) return;
    setSaving(true); setError(null);
    const result = await supabase.from("obra_social_casos").insert({
      congregacion_id: congregacionId,
      familia_id: casoForm.familia_id,
      red_familias_caso_id: casoForm.red_familias_caso_id || null,
      tipo_necesidad: casoForm.tipo_necesidad,
      prioridad: casoForm.prioridad,
      responsable_persona_id: casoForm.responsable_persona_id || null,
      notas: casoForm.notas.trim() || null,
    });
    setSaving(false);
    if (result.error) { setError(`No se pudo registrar el caso: ${result.error.message}`); return; }
    setNotice("Caso registrado.");
    setCasoForm({ familia_id: "", red_familias_caso_id: "", tipo_necesidad: "economica", prioridad: "media", responsable_persona_id: "", notas: "" });
    load();
  }

  async function actualizarEstado(caso, estado) {
    if (!canEdit) return;
    setSaving(true); setError(null);
    const result = await supabase.from("obra_social_casos").update({ estado }).eq("id", caso.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(`No se pudo actualizar el caso: ${result.error.message}`); return; }
    setNotice(`Caso marcado como ${ESTADO_LABELS[estado].toLowerCase()}.`);
    load();
  }

  async function createAyuda(event) {
    event.preventDefault();
    if (!canEdit || !selectedCasoId) return;
    setSaving(true); setError(null);
    const result = await supabase.from("obra_social_ayudas").insert({
      caso_id: selectedCasoId,
      fecha: ayudaForm.fecha,
      tipo: ayudaForm.tipo,
      descripcion: ayudaForm.descripcion.trim() || null,
      responsable_persona_id: ayudaForm.responsable_persona_id || null,
    });
    setSaving(false);
    if (result.error) { setError(`No se pudo registrar la ayuda: ${result.error.message}`); return; }
    setNotice("Ayuda registrada.");
    setAyudaForm({ fecha: hoyBogota(), tipo: "material", descripcion: "", responsable_persona_id: "" });
    load();
  }

  useEffect(() => { load(); }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "obra_social.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando Obra Social...</div>;

  const casosAbiertos = casos.filter((item) => ["identificada", "en_apoyo"].includes(item.estado));
  const casosResueltos = casos.filter((item) => ["resuelta", "cerrada"].includes(item.estado));
  const casosAltaPrioridad = casosAbiertos.filter((item) => item.prioridad === "alta");
  const ayudasUltimoMes = ayudas.filter((item) => item.fecha >= fechaBogota(new Date(Date.now() - 30 * 86400000)));

  const trend = [...new Set(ayudas.map((item) => item.fecha))].sort().map((fecha) => ({
    fecha,
    total: ayudas.filter((item) => item.fecha === fecha).length,
  }));

  const tiposConTotal = Object.entries(TIPO_NECESIDAD_LABELS).map(([value, label]) => ({
    label,
    total: casosAbiertos.filter((item) => item.tipo_necesidad === value).length,
  }));

  const ultimaAyudaPorCaso = new Map();
  ayudas.forEach((item) => {
    const actual = ultimaAyudaPorCaso.get(item.caso_id);
    if (!actual || item.fecha > actual) ultimaAyudaPorCaso.set(item.caso_id, item.fecha);
  });
  const hoy = new Date();
  const casosSinSeguimiento = casosAbiertos.filter((item) => {
    const ultima = ultimaAyudaPorCaso.get(item.id) || item.fecha_apertura;
    if (!ultima) return true;
    const dias = Math.floor((hoy - new Date(`${ultima}T00:00:00`)) / 86400000);
    return dias > DIAS_ALERTA;
  });

  const insightGeneral = casos.length
    ? `${casosAbiertos.length} caso(s) abiertos, ${casosAltaPrioridad.length} de prioridad alta. ${casosSinSeguimiento.length > 0 ? `${casosSinSeguimiento.length} sin seguimiento en más de ${DIAS_ALERTA} días.` : "Todos los casos abiertos tienen seguimiento reciente."}`
    : "Registra un caso para comenzar a medir la asistencia social de la congregación.";

  const chartData = trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: "Ayudas" });
  const tiposChartData = distributionDataset(tiposConTotal, { datasetLabel: "Casos abiertos" });

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Fundación Obra Social Unida</p>
          <h1 className="section-title flex items-center gap-2"><HandHeart className="w-6 h-6 text-accent" />Obra Social</h1>
          <p className="text-sm text-secondary mt-1">Asistencia socioeconómica a hermanos de la congregación que carecen de recursos.</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Periodo del análisis">
          {PERIODOS.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-ink text-white border-ink" : "border-border text-secondary"}`}>{label}</button>
          ))}
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {!canEdit && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Tienes acceso de consulta. Las altas y modificaciones requieren el permiso de edición de Obra Social.</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Casos abiertos" value={casosAbiertos.length} progress={casos.length ? Math.round((casosAbiertos.length / casos.length) * 100) : 0} detail={`${casos.length} registrados en total`} insight="Necesidades identificadas o en apoyo activo." />
        <Metric label="Prioridad alta" value={casosAltaPrioridad.length} tone={casosAltaPrioridad.length > 0 ? "text-danger" : "text-success"} progress={casosAbiertos.length ? Math.round((casosAltaPrioridad.length / casosAbiertos.length) * 100) : 0} detail="Casos abiertos urgentes" insight="Prioriza estos casos en la próxima jornada de apoyo." />
        <Metric label="Casos resueltos" value={casosResueltos.length} tone="text-success" progress={casos.length ? Math.round((casosResueltos.length / casos.length) * 100) : 0} detail={`${casos.length ? Math.round((casosResueltos.length / casos.length) * 100) : 0}% del total`} insight="Necesidad resuelta o caso cerrado." tip="Suma los casos marcados como Resuelta y como Cerrada, aunque no sean lo mismo: uno significa que se atendió la necesidad y el otro que el caso ya no sigue abierto." />
        <Metric label="Ayudas (30 días)" value={ayudasUltimoMes.length} progress={ayudasUltimoMes.length ? 100 : 0} detail={`${ayudas.length} en el periodo seleccionado`} insight="Cada ayuda entregada queda registrada por caso." />
      </section>

      <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightGeneral}</p>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">Apoyo brindado</p>
          <h2 className="font-medium mt-1">Tendencia de ayudas</h2>
          <div className="h-56 mt-4">
            {trend.length ? <Line data={chartData} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin ayudas registradas en el periodo." />}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">Composición</p>
          <h2 className="font-medium mt-1">Casos abiertos por tipo de necesidad</h2>
          <div className="h-56 mt-4">
            {casosAbiertos.length ? <Bar data={tiposChartData} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin casos abiertos todavía." />}
          </div>
        </div>
      </section>

      {casosSinSeguimiento.length > 0 && (
        <section className="card p-5 border-2 border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-medium">Casos sin seguimiento reciente</h2>
              <p className="text-xs text-secondary mt-1">Sin ayuda registrada en más de {DIAS_ALERTA} días.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
            {casosSinSeguimiento.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-3">
                <p className="text-sm font-medium">{item.familias?.nombre_familia}</p>
                <p className="text-xs text-secondary mt-1">{TIPO_NECESIDAD_LABELS[item.tipo_necesidad]} · {ultimaAyudaPorCaso.get(item.id) ? `Última ayuda: ${ultimaAyudaPorCaso.get(item.id)}` : `Abierto: ${item.fecha_apertura}`}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">Casos</p><h2 className="font-medium mt-1">Casos registrados</h2></div>
            <HandHeart className="w-5 h-5 text-accent" />
          </div>
          <div className="flex flex-col divide-y divide-border mt-4 max-h-96 overflow-y-auto">
            {casos.map((item) => (
              <button type="button" key={item.id} onClick={() => setSelectedCasoId(item.id)} className={`py-3 text-left ${selectedCasoId === item.id ? "bg-accent-bg -mx-2 px-2 rounded" : ""}`}>
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{item.familias?.nombre_familia}</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded ${item.prioridad === "alta" ? "bg-danger-bg text-danger" : "bg-surface-1"}`}>{PRIORIDAD_LABELS[item.prioridad]}</span>
                </div>
                <p className="text-xs text-secondary mt-1">{TIPO_NECESIDAD_LABELS[item.tipo_necesidad]} · {ESTADO_LABELS[item.estado]}{item.red_familias_caso_id ? " · Origen: Red de Familias" : ""}</p>
              </button>
            ))}
            {!casos.length && <p className="text-sm text-muted py-6">Aún no hay casos registrados.</p>}
          </div>
          {selectedCasoId && (() => {
            const caso = casos.find((item) => item.id === selectedCasoId);
            const ayudasCaso = ayudas.filter((item) => item.caso_id === selectedCasoId);
            if (!caso) return null;
            return <div className="border-t border-border mt-4 pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Ayudas para la familia {caso.familias?.nombre_familia}</p>
                {canEdit && <span className="flex items-center gap-1.5">
                  <select className="input-field text-xs py-1 w-auto" value={caso.estado} onChange={(event) => actualizarEstado(caso, event.target.value)}>
                    {Object.entries(ESTADO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <InfoTip texto="Resuelta: la necesidad ya se atendió. Cerrada: el caso se cierra aunque no se haya resuelto, por ejemplo si la familia ya no requiere seguimiento." />
                </span>}
              </div>
              {caso.notas && <p className="text-xs text-secondary mt-2">{caso.notas}</p>}
              {canEdit && <form onSubmit={createAyuda} className="grid gap-2 mt-3">
                <div className="grid grid-cols-2 gap-2">
                  <input required type="date" className="input-field" value={ayudaForm.fecha} onChange={(event) => setAyudaForm({ ...ayudaForm, fecha: event.target.value })} />
                  <select className="input-field" value={ayudaForm.tipo} onChange={(event) => setAyudaForm({ ...ayudaForm, tipo: event.target.value })}>
                    {Object.entries(TIPO_AYUDA_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <textarea className="input-field min-h-14" placeholder="Descripción de la ayuda" value={ayudaForm.descripcion} onChange={(event) => setAyudaForm({ ...ayudaForm, descripcion: event.target.value })} />
                <select className="input-field" value={ayudaForm.responsable_persona_id} onChange={(event) => setAyudaForm({ ...ayudaForm, responsable_persona_id: event.target.value })}>
                  <option value="">Responsable</option>
                  {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
                </select>
                <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />Registrar ayuda</button>
              </form>}
              {ayudasCaso.length ? <div className="divide-y divide-border mt-3">{ayudasCaso.map((ayuda) => <div key={ayuda.id} className="py-2"><div className="flex justify-between gap-3"><p className="text-sm">{TIPO_AYUDA_LABELS[ayuda.tipo]}</p><span className="text-xs text-secondary">{ayuda.fecha}</span></div>{ayuda.descripcion && <p className="text-xs text-secondary mt-1">{ayuda.descripcion}</p>}</div>)}</div> : <p className="text-xs text-muted mt-3">Aún no hay ayudas registradas para este caso.</p>}
            </div>;
          })()}
        </div>

        <form onSubmit={createCaso} className={`card p-5 flex flex-col gap-2 h-fit ${canEdit ? '' : 'hidden'}`}>
          <h2 className="font-medium">Nuevo caso</h2>
          <p className="text-xs text-secondary">El censo de familias es el mismo que administra Red de Familias. Si la necesidad ya se identificó allá, vincula ese caso para no perder el origen.</p>
          <select className="input-field" value={casoForm.red_familias_caso_id} onChange={(event) => {
            const casoOrigen = casosRedFamilias.find((item) => item.id === event.target.value);
            setCasoForm({ ...casoForm, red_familias_caso_id: event.target.value, familia_id: casoOrigen?.familia_id || casoForm.familia_id });
          }}>
            <option value="">Vincular caso de Red de Familias (opcional)</option>
            {casosRedFamilias.map((item) => <option key={item.id} value={item.id}>{item.familias?.nombre_familia} · {item.estado}</option>)}
          </select>
          <select required className="input-field" value={casoForm.familia_id} onChange={(event) => setCasoForm({ ...casoForm, familia_id: event.target.value })}>
            <option value="">Familia</option>
            {familias.map((familia) => <option key={familia.id} value={familia.id}>{familia.nombre_familia}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select className="input-field" value={casoForm.tipo_necesidad} onChange={(event) => setCasoForm({ ...casoForm, tipo_necesidad: event.target.value })}>
              {Object.entries(TIPO_NECESIDAD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="input-field" value={casoForm.prioridad} onChange={(event) => setCasoForm({ ...casoForm, prioridad: event.target.value })}>
              {Object.entries(PRIORIDAD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <select className="input-field" value={casoForm.responsable_persona_id} onChange={(event) => setCasoForm({ ...casoForm, responsable_persona_id: event.target.value })}>
            <option value="">Responsable</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
          <textarea className="input-field min-h-14" placeholder="Notas" value={casoForm.notas} onChange={(event) => setCasoForm({ ...casoForm, notas: event.target.value })} />
          <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> Registrar caso</button>
        </form>
      </section>
    </div>
  );
}
