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
import { AlertTriangle, Heart, Plus, UsersRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import ChartEmpty from "../components/ChartEmpty";
import InfoTip from "../components/InfoTip";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

const TIPO_ACTIVIDAD_LABELS = { visita: "Visita", social: "Social", espiritual: "Espiritual", otro: "Otro" };
const PERIODOS = [["30", "30 días"], ["180", "6 meses"], ["365", "12 meses"]];
const DIAS_INACTIVIDAD = 60;
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

export default function DamasDorcas() {
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
  const [canEdit, setCanEdit] = useState(false);
  const [beneficiariaForm, setBeneficiariaForm] = useState({ nombres: "", apellidos: "", telefono: "", direccion: "", responsable_persona_id: "" });
  const [actividadForm, setActividadForm] = useState({ fecha: hoyBogota(), tipo: "visita", descripcion: "", responsable_persona_id: "" });
  const [asistenciaMarcada, setAsistenciaMarcada] = useState({});

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
    const [b, a, s, p] = await Promise.all([
      supabase.from("damas_dorcas_beneficiarias").select("id, nombres, apellidos, telefono, direccion, estado, responsable_persona_id, bautizado, fecha_bautismo, sellado, fecha_sellado, personas:responsable_persona_id(nombres, apellidos)").eq("congregacion_id", congregacionId).order("nombres"),
      supabase.from("damas_dorcas_actividades").select("id, fecha, tipo, descripcion, responsable_persona_id").eq("congregacion_id", congregacionId).gte("fecha", fechaBogota(start)).order("fecha", { ascending: false }),
      supabase.from("damas_dorcas_asistencia").select("id, actividad_id, beneficiaria_id, asistio, damas_dorcas_actividades!inner(congregacion_id, fecha)").eq("damas_dorcas_actividades.congregacion_id", congregacionId).eq("asistio", true),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
    ]);
    const failed = [b, a, s, p].find((item) => item.error);
    if (failed) setError("No se pudo cargar Damas Dorcas. Intenta nuevamente o contacta al administrador.");
    setBeneficiarias(b.data ?? []);
    setActividades(a.data ?? []);
    setAsistencias(s.data ?? []);
    setPersonas(p.data ?? []);
    setLoading(false);
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
    if (result.error) { setError("No se pudo registrar a la beneficiaria."); return; }
    setNotice("Beneficiaria registrada.");
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
    if (actividadResult.error) { setSaving(false); setError(`No se pudo registrar la actividad: ${actividadResult.error.message}`); return; }
    if (activas.length > 0) {
      const asistenciaResult = await supabase.from("damas_dorcas_asistencia").insert(
        activas.map((beneficiaria) => ({ actividad_id: actividadResult.data.id, beneficiaria_id: beneficiaria.id, asistio: Boolean(asistenciaMarcada[beneficiaria.id]) })),
      );
      if (asistenciaResult.error) { setSaving(false); setError(`La actividad se guardó, pero no se pudo registrar la asistencia individual: ${asistenciaResult.error.message}`); return; }
    }
    setSaving(false);
    setNotice("Actividad registrada con asistencia individual.");
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
    if (result.error) { setError(`No se pudo actualizar la ficha: ${result.error.message}`); return; }
    setNotice("Ficha actualizada.");
    load();
  }

  useEffect(() => { load(); }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "damas_dorcas.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando Damas Dorcas...</div>;

  const activas = beneficiarias.filter((item) => item.estado === "activa");
  const bautizadas = activas.filter((item) => item.bautizado);
  const selladas = activas.filter((item) => item.sellado);
  const actividadesUltimoMes = actividades.filter((item) => item.fecha >= fechaBogota(new Date(Date.now() - 30 * 86400000)));

  // Tendencia: actividades por fecha en el periodo
  const trend = [...new Set(actividades.map((item) => item.fecha))].sort().map((fecha) => ({
    fecha,
    total: actividades.filter((item) => item.fecha === fecha).length,
  }));
  const mitad = Math.floor(trend.length / 2) || 1;
  const primeraMitad = trend.slice(0, mitad).reduce((sum, item) => sum + item.total, 0);
  const segundaMitad = trend.slice(mitad).reduce((sum, item) => sum + item.total, 0);
  const tendenciaVariacion = primeraMitad ? Math.round(((segundaMitad - primeraMitad) / primeraMitad) * 100) : null;

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
    if (!ultima) return true;
    const dias = Math.floor((hoy - new Date(`${ultima}T00:00:00`)) / 86400000);
    return dias > DIAS_INACTIVIDAD;
  });

  const insightGeneral = activas.length
    ? `${beneficiariasSinSeguimiento.length} de ${activas.length} beneficiarias activas no han tenido actividad en más de ${DIAS_INACTIVIDAD} días. ${beneficiariasSinSeguimiento.length > 0 ? "Prioriza visitarlas esta semana." : "El seguimiento está al día."}`
    : "Registra beneficiarias para construir una lectura del trabajo con mujeres.";

  const chartData = trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: "Actividades" });
  const tiposChartData = distributionDataset(tiposConTotal, { datasetLabel: "Actividades" });

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Trabajo con mujeres</p>
          <h1 className="section-title">Damas Dorcas</h1>
          <p className="text-sm text-secondary mt-1">Trabajo evangelístico, social y espiritual con mujeres de la congregación y su entorno.</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Periodo del análisis">
          {PERIODOS.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-ink text-white border-ink" : "border-border text-secondary"}`}>{label}</button>
          ))}
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {!canEdit && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Tienes acceso de consulta. Las altas y modificaciones requieren el permiso de edición de Damas Dorcas.</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Beneficiarias activas" value={activas.length} progress={activas.length ? 100 : 0} detail={`${beneficiarias.length} registradas en total`} insight={activas.length ? "Cada beneficiaria debe tener una responsable de seguimiento." : "Registra la primera beneficiaria para iniciar el trabajo."} />
        <Metric label="Actividades (30 días)" value={actividadesUltimoMes.length} tone={tendenciaVariacion === null || tendenciaVariacion >= 0 ? "text-success" : "text-danger"} progress={actividadesUltimoMes.length ? 100 : 0} detail={`${actividades.length} en el periodo seleccionado`} insight={tendenciaVariacion === null ? "Aún no hay suficiente historial para comparar." : `${tendenciaVariacion >= 0 ? "Creció" : "Bajó"} ${Math.abs(tendenciaVariacion)}% frente a la primera mitad del periodo.`} />
        <Metric label="Sin seguimiento reciente" value={beneficiariasSinSeguimiento.length} tone={beneficiariasSinSeguimiento.length > 0 ? "text-danger" : "text-success"} progress={activas.length ? Math.round((beneficiariasSinSeguimiento.length / activas.length) * 100) : 0} detail={`Más de ${DIAS_INACTIVIDAD} días sin actividad`} insight={beneficiariasSinSeguimiento.length > 0 ? "Revisa la lista y programa una visita." : "Todas las beneficiarias tienen seguimiento reciente."} />
        <Metric label="Tipo de trabajo líder" value={tiposConTotal.sort((a, b) => b.total - a.total)[0]?.label || "—"} progress={actividades.length ? Math.round((tiposConTotal.sort((a, b) => b.total - a.total)[0]?.total || 0) / actividades.length * 100) : 0} detail={`${tiposConTotal.sort((a, b) => b.total - a.total)[0]?.total || 0} actividades`} insight="Compara con las demás modalidades para balancear el trabajo." />
        <Metric label="Bautizadas" value={bautizadas.length} progress={activas.length ? Math.round((bautizadas.length / activas.length) * 100) : 0} detail={`${activas.length ? Math.round((bautizadas.length / activas.length) * 100) : 0}% de las activas`} insight="Bautizado y sellado son hitos independientes: compara con la métrica de selladas." />
        <Metric label="Selladas" value={selladas.length} progress={activas.length ? Math.round((selladas.length / activas.length) * 100) : 0} detail="Con el Espíritu Santo" insight="Puede pasar antes o después del bautismo en agua." />
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

      {beneficiariasSinSeguimiento.length > 0 && (
        <section className="card p-5 border-2 border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-medium">Beneficiarias sin seguimiento reciente</h2>
              <p className="text-xs text-secondary mt-1">Sin actividad registrada en más de {DIAS_INACTIVIDAD} días.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
            {beneficiariasSinSeguimiento.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-3">
                <p className="text-sm font-medium">{item.nombres} {item.apellidos}</p>
                <p className="text-xs text-secondary mt-1">{ultimaActividadPorBeneficiaria.get(item.id) ? `Última actividad: ${ultimaActividadPorBeneficiaria.get(item.id)}` : "Sin actividad registrada"}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">Censo</p><h2 className="font-medium mt-1">Beneficiarias</h2></div>
            <UsersRound className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4 max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">Nombre</th><th className="py-2">Responsable</th><th className="py-2">Estado</th><th className="py-2"><span className="inline-flex items-center gap-1">Hitos<InfoTip texto="Bautizada y sellada se marcan una sola vez con la fecha de hoy; no hay botón para deshacerlo desde aquí." /></span></th></tr></thead>
              <tbody>
                {beneficiarias.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="py-2 font-medium">{item.nombres} {item.apellidos}</td>
                    <td className="py-2 text-secondary">{item.personas ? `${item.personas.nombres} ${item.personas.apellidos}` : "Sin asignar"}</td>
                    <td className="py-2"><span className="text-xs px-2 py-1 rounded bg-accent-bg text-accent">{item.estado === "activa" ? "Activa" : "Inactiva"}</span></td>
                    <td className="py-2">
                      <div className="flex gap-1.5 flex-wrap items-center">
                        {item.bautizado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">Bautizada</span>}
                        {item.sellado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">Sellada</span>}
                        {canEdit && !item.bautizado && <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => marcarHito(item, "bautizado", "fecha_bautismo")}>Marcar bautizada</button>}
                        {canEdit && !item.sellado && <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => marcarHito(item, "sellado", "fecha_sellado")}>Marcar sellada</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!beneficiarias.length && <p className="text-sm text-secondary py-6 text-center">Aún no hay beneficiarias registradas.</p>}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">Trabajo realizado</p><h2 className="font-medium mt-1">Actividades</h2></div>
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
            {activas.length > 0 && <div>
              <p className="text-xs text-secondary mb-1">Asistencia individual</p>
              <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                {activas.map((beneficiaria) => <label key={beneficiaria.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[beneficiaria.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [beneficiaria.id]: event.target.checked })} />{beneficiaria.nombres} {beneficiaria.apellidos}</label>)}
              </div>
            </div>}
            <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />Registrar actividad</button>
          </form>}
        </div>
      </section>

      <form onSubmit={createBeneficiaria} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
        <h2 className="font-medium">Nueva beneficiaria</h2>
        <div className="grid grid-cols-2 gap-2">
          <input required className="input-field" placeholder="Nombres" value={beneficiariaForm.nombres} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, nombres: event.target.value })} />
          <input required className="input-field" placeholder="Apellidos" value={beneficiariaForm.apellidos} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, apellidos: event.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input-field" placeholder="Teléfono" value={beneficiariaForm.telefono} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, telefono: event.target.value })} />
          <input className="input-field" placeholder="Dirección" value={beneficiariaForm.direccion} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, direccion: event.target.value })} />
        </div>
        <label className="text-xs text-secondary flex items-center gap-1">
          Responsable de seguimiento
          <InfoTip texto="Sin alguien asignado, es más fácil que esta beneficiaria quede sin visitas de seguimiento." />
          <select className="input-field mt-1 w-full" value={beneficiariaForm.responsable_persona_id} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, responsable_persona_id: event.target.value })}>
            <option value="">Selecciona una persona</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
        </label>
        <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> Registrar beneficiaria</button>
      </form>
    </div>
  );
}
