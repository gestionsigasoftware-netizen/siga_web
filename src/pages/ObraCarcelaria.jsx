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
import {
  AlertTriangle,
  ArrowRightLeft,
  Church,
  HeartHandshake,
  LockKeyhole,
  Plus,
  UserCheck,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import ChartEmpty from "../components/ChartEmpty";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

const ESTADO_INTERNO_LABELS = { activo: "Activo", liberado: "Liberado", trasladado: "Trasladado", inactivo: "Inactivo" };
const TIPO_APOYO_LABELS = { visita: "Visita", consejeria: "Consejería", espiritual: "Espiritual", material: "Material", otro: "Otro" };
const ESTADO_REINSERCION_LABELS = { asignado: "Asignado", contactado: "Contactado", activo: "Activo", inactivo: "Inactivo", reincidencia: "Reincidencia" };
const PERIODOS = [["30", "30 días"], ["180", "6 meses"], ["365", "12 meses"]];
const DIAS_ALERTA_INPEC = 30;
const CHART_OPTIONS = chartOptions();

const EMPTY_INTERNO = { nombres: "", apellidos: "", centro_id: "", patio: "", fecha_ingreso_ministerio: new Date().toISOString().slice(0, 10), observaciones: "" };
const EMPTY_DELEGADO = { persona_id: "", centro_id: "", permiso_inpec_vigente: false, permiso_inpec_vencimiento: "", observaciones: "" };
const EMPTY_CULTO = { centro_id: "", fecha: new Date().toISOString().slice(0, 10), patio: "", asistentes_total: "", estudios_biblicos_entregados: "", responsable_persona_id: "", notas: "" };
const EMPTY_FAMILIAR = { interno_id: "", familia_id: "", contacto_nombre: "", parentesco: "", telefono: "", fecha_visita: new Date().toISOString().slice(0, 10), tipo_apoyo: "visita", responsable_persona_id: "", notas: "" };

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

function Empty({ text }) {
  return <div className="p-8 text-center text-sm text-secondary bg-surface-1 rounded-card border border-dashed border-border">{text}</div>;
}

export default function ObraCarcelaria() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [tab, setTab] = useState("internos");
  const [periodo, setPeriodo] = useState("180");
  const [centros, setCentros] = useState([]);
  const [internos, setInternos] = useState([]);
  const [delegados, setDelegados] = useState([]);
  const [cultos, setCultos] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);
  const [reinserciones, setReinserciones] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const [editingInternoId, setEditingInternoId] = useState(null);
  const [internoForm, setInternoForm] = useState(EMPTY_INTERNO);
  const [editingDelegadoId, setEditingDelegadoId] = useState(null);
  const [delegadoForm, setDelegadoForm] = useState(EMPTY_DELEGADO);
  const [cultoForm, setCultoForm] = useState(EMPTY_CULTO);
  const [asistenciaMarcada, setAsistenciaMarcada] = useState({});
  const [familiarForm, setFamiliarForm] = useState(EMPTY_FAMILIAR);

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
    const [cong, cen, i, d, cu, a, sf, r, p, f] = await Promise.all([
      supabase.from("congregaciones").select("distrito_id").eq("id", congregacionId).single(),
      supabase.from("centros_reclusion").select("id, nombre, tipo, ciudad, activo").eq("activo", true).order("nombre"),
      supabase.from("obra_carcelaria_internos").select("id, nombres, apellidos, centro_id, patio, fecha_ingreso_ministerio, estado, bautizado, fecha_bautismo, sellado, fecha_sellado, fecha_liberacion, observaciones, centros_reclusion(nombre)").eq("congregacion_id", congregacionId).order("nombres"),
      supabase.from("obra_carcelaria_delegados").select("id, persona_id, centro_id, permiso_inpec_vigente, permiso_inpec_vencimiento, observaciones, activo, personas(nombres, apellidos), centros_reclusion(nombre)").eq("congregacion_id", congregacionId).order("created_at", { ascending: false }),
      supabase.from("obra_carcelaria_cultos").select("id, centro_id, fecha, patio, asistentes_total, estudios_biblicos_entregados, responsable_persona_id, notas, centros_reclusion(nombre)").eq("congregacion_id", congregacionId).gte("fecha", start.toISOString().slice(0, 10)).order("fecha", { ascending: false }),
      supabase.from("obra_carcelaria_asistencia").select("id, culto_id, interno_id, asistio, obra_carcelaria_cultos!inner(congregacion_id, fecha)").eq("obra_carcelaria_cultos.congregacion_id", congregacionId).eq("asistio", true),
      supabase.from("obra_carcelaria_seguimiento_familiar").select("id, interno_id, familia_id, contacto_nombre, parentesco, telefono, fecha_visita, tipo_apoyo, responsable_persona_id, notas, obra_carcelaria_internos(nombres, apellidos)").eq("congregacion_id", congregacionId).order("fecha_visita", { ascending: false }),
      supabase.from("obra_carcelaria_reinsercion").select("id, interno_id, congregacion_origen_id, congregacion_destino_id, fecha_asignacion, estado, notas, obra_carcelaria_internos(nombres, apellidos), origen:congregacion_origen_id(nombre), destino:congregacion_destino_id(nombre)").or(`congregacion_origen_id.eq.${congregacionId},congregacion_destino_id.eq.${congregacionId}`).order("fecha_asignacion", { ascending: false }),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("familias").select("id, nombre_familia").eq("congregacion_id", congregacionId).order("nombre_familia"),
    ]);
    const failed = [cong, cen, i, d, cu, a, sf, r, p, f].find((item) => item.error);
    if (failed) setError("No se pudo cargar Obra Carcelaria. Intenta nuevamente o contacta al administrador.");
    setCentros(cen.data ?? []);
    setInternos(i.data ?? []);
    setDelegados(d.data ?? []);
    setCultos(cu.data ?? []);
    setAsistencias(a.data ?? []);
    setSeguimientos(sf.data ?? []);
    setReinserciones(r.data ?? []);
    setPersonas(p.data ?? []);
    setFamilias(f.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "obra_carcelaria.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  function resetInternoForm() { setEditingInternoId(null); setInternoForm(EMPTY_INTERNO); }
  function editInterno(item) {
    setEditingInternoId(item.id);
    setInternoForm({ nombres: item.nombres, apellidos: item.apellidos, centro_id: item.centro_id || "", patio: item.patio || "", fecha_ingreso_ministerio: item.fecha_ingreso_ministerio, observaciones: item.observaciones || "" });
  }
  async function saveInterno(event) {
    event.preventDefault();
    if (!canEdit || !internoForm.nombres.trim() || !internoForm.apellidos.trim()) return;
    setSaving(true); setError(null);
    const payload = { nombres: internoForm.nombres.trim(), apellidos: internoForm.apellidos.trim(), centro_id: internoForm.centro_id || null, patio: internoForm.patio.trim() || null, fecha_ingreso_ministerio: internoForm.fecha_ingreso_ministerio, observaciones: internoForm.observaciones.trim() || null };
    const result = editingInternoId
      ? await supabase.from("obra_carcelaria_internos").update(payload).eq("id", editingInternoId)
      : await supabase.from("obra_carcelaria_internos").insert({ ...payload, congregacion_id: congregacionId });
    setSaving(false);
    if (result.error) { setError(`No se pudo guardar la ficha: ${result.error.message}`); return; }
    setNotice(editingInternoId ? "Ficha actualizada." : "Interno registrado."); resetInternoForm(); load();
  }
  async function marcarHito(interno, campo, fechaCampo) {
    if (!canEdit) return;
    setSaving(true); setError(null);
    const hoy = new Date().toISOString().slice(0, 10);
    const result = await supabase.from("obra_carcelaria_internos").update({ [campo]: true, [fechaCampo]: hoy }).eq("id", interno.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(`No se pudo actualizar la ficha: ${result.error.message}`); return; }
    setNotice("Ficha actualizada."); load();
  }
  async function marcarEstado(interno, estado) {
    if (!canEdit) return;
    setSaving(true); setError(null);
    const payload = { estado, fecha_liberacion: estado === "liberado" ? new Date().toISOString().slice(0, 10) : interno.fecha_liberacion };
    const result = await supabase.from("obra_carcelaria_internos").update(payload).eq("id", interno.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(`No se pudo actualizar el estado: ${result.error.message}`); return; }
    setNotice(`Interno marcado como ${ESTADO_INTERNO_LABELS[estado].toLowerCase()}.`); load();
  }

  function resetDelegadoForm() { setEditingDelegadoId(null); setDelegadoForm(EMPTY_DELEGADO); }
  function editDelegado(item) {
    setEditingDelegadoId(item.id);
    setDelegadoForm({ persona_id: item.persona_id, centro_id: item.centro_id || "", permiso_inpec_vigente: item.permiso_inpec_vigente, permiso_inpec_vencimiento: item.permiso_inpec_vencimiento || "", observaciones: item.observaciones || "" });
  }
  async function saveDelegado(event) {
    event.preventDefault();
    if (!canEdit || !delegadoForm.persona_id) return;
    setSaving(true); setError(null);
    const payload = { persona_id: delegadoForm.persona_id, centro_id: delegadoForm.centro_id || null, permiso_inpec_vigente: delegadoForm.permiso_inpec_vigente, permiso_inpec_vencimiento: delegadoForm.permiso_inpec_vencimiento || null, observaciones: delegadoForm.observaciones.trim() || null };
    const result = editingDelegadoId
      ? await supabase.from("obra_carcelaria_delegados").update(payload).eq("id", editingDelegadoId)
      : await supabase.from("obra_carcelaria_delegados").insert({ ...payload, congregacion_id: congregacionId });
    setSaving(false);
    if (result.error) { setError(`No se pudo guardar el delegado: ${result.error.message}`); return; }
    setNotice(editingDelegadoId ? "Delegado actualizado." : "Delegado habilitado."); resetDelegadoForm(); load();
  }

  async function createCulto(event) {
    event.preventDefault();
    if (!canEdit) return;
    const activos = internos.filter((item) => item.estado === "activo");
    setSaving(true); setError(null);
    const cultoResult = await supabase.from("obra_carcelaria_cultos").insert({
      congregacion_id: congregacionId,
      centro_id: cultoForm.centro_id || null,
      fecha: cultoForm.fecha,
      patio: cultoForm.patio.trim() || null,
      asistentes_total: Number(cultoForm.asistentes_total || 0),
      estudios_biblicos_entregados: Number(cultoForm.estudios_biblicos_entregados || 0),
      responsable_persona_id: cultoForm.responsable_persona_id || null,
      notas: cultoForm.notas.trim() || null,
    }).select("id").single();
    if (cultoResult.error) { setSaving(false); setError(`No se pudo registrar el culto: ${cultoResult.error.message}`); return; }
    if (activos.length > 0) {
      const asistResult = await supabase.from("obra_carcelaria_asistencia").insert(
        activos.map((interno) => ({ culto_id: cultoResult.data.id, interno_id: interno.id, asistio: Boolean(asistenciaMarcada[interno.id]) })),
      );
      if (asistResult.error) { setSaving(false); setError(`El culto se guardó, pero no se pudo registrar la asistencia individual: ${asistResult.error.message}`); return; }
    }
    setSaving(false);
    setNotice("Culto registrado con asistencia individual.");
    setCultoForm(EMPTY_CULTO); setAsistenciaMarcada({}); load();
  }

  async function saveFamiliar(event) {
    event.preventDefault();
    if (!canEdit || !familiarForm.interno_id || !familiarForm.contacto_nombre.trim()) return;
    setSaving(true); setError(null);
    const result = await supabase.from("obra_carcelaria_seguimiento_familiar").insert({
      congregacion_id: congregacionId,
      interno_id: familiarForm.interno_id,
      familia_id: familiarForm.familia_id || null,
      contacto_nombre: familiarForm.contacto_nombre.trim(),
      parentesco: familiarForm.parentesco.trim() || null,
      telefono: familiarForm.telefono.trim() || null,
      fecha_visita: familiarForm.fecha_visita,
      tipo_apoyo: familiarForm.tipo_apoyo,
      responsable_persona_id: familiarForm.responsable_persona_id || null,
      notas: familiarForm.notas.trim() || null,
    });
    setSaving(false);
    if (result.error) { setError(`No se pudo registrar el seguimiento: ${result.error.message}`); return; }
    setNotice("Seguimiento familiar registrado."); setFamiliarForm(EMPTY_FAMILIAR); load();
  }

  async function actualizarReinsercion(item, estado) {
    setSaving(true); setError(null);
    const result = await supabase.from("obra_carcelaria_reinsercion").update({ estado }).eq("id", item.id);
    setSaving(false);
    if (result.error) { setError(`No se pudo actualizar la reinserción: ${result.error.message}`); return; }
    setNotice(`Reinserción marcada como ${ESTADO_REINSERCION_LABELS[estado].toLowerCase()}.`); load();
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando Obra Carcelaria...</div>;

  const activos = internos.filter((item) => item.estado === "activo");
  const bautizados = internos.filter((item) => item.bautizado);
  const sellados = internos.filter((item) => item.sellado);
  const liberados = internos.filter((item) => item.estado === "liberado");
  const delegadosHabilitados = delegados.filter((item) => item.activo && item.permiso_inpec_vigente);
  const hoy = new Date();
  const en30dias = new Date(Date.now() + DIAS_ALERTA_INPEC * 86400000).toISOString().slice(0, 10);
  const delegadosAlerta = delegados.filter((item) => item.activo && (!item.permiso_inpec_vigente || !item.permiso_inpec_vencimiento || item.permiso_inpec_vencimiento <= en30dias));

  const cultosUltimoMes = cultos.filter((item) => item.fecha >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const estudiosUltimoMes = cultosUltimoMes.reduce((sum, item) => sum + Number(item.estudios_biblicos_entregados || 0), 0);
  const asistenciaAcumulada = cultos.reduce((sum, item) => sum + Number(item.asistentes_total || 0), 0);

  const trend = [...new Set(cultos.map((item) => item.fecha))].sort().map((fecha) => ({
    fecha,
    total: cultos.filter((item) => item.fecha === fecha).reduce((sum, item) => sum + Number(item.asistentes_total || 0), 0),
  }));
  const mitad = Math.floor(trend.length / 2) || 1;
  const primeraMitad = trend.slice(0, mitad).reduce((sum, item) => sum + item.total, 0);
  const segundaMitad = trend.slice(mitad).reduce((sum, item) => sum + item.total, 0);
  const tendenciaVariacion = primeraMitad ? Math.round(((segundaMitad - primeraMitad) / primeraMitad) * 100) : null;

  const ultimaVisitaPorInterno = new Map();
  seguimientos.forEach((item) => {
    const actual = ultimaVisitaPorInterno.get(item.interno_id);
    if (!actual || item.fecha_visita > actual) ultimaVisitaPorInterno.set(item.interno_id, item.fecha_visita);
  });

  const insightGeneral = activos.length
    ? `${delegadosAlerta.length > 0 ? `${delegadosAlerta.length} delegado(s) con permiso INPEC vencido o por vencer. ` : "Todos los delegados activos tienen permiso INPEC vigente. "}${bautizados.length} de ${activos.length} internos activos ya se han bautizado en el centro.`
    : "Registra internos y delegados para construir una lectura del trabajo carcelario.";

  const chartData = trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: "Asistencia" });
  const poblacionChartData = distributionDataset(
    [
      { label: "Asistencia acumulada", total: asistenciaAcumulada },
      { label: "Bautizados", total: bautizados.length },
      { label: "Sellados", total: sellados.length },
    ],
    { datasetLabel: "Total" }
  );

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Comité de evangelismo</p>
          <h1 className="section-title flex items-center gap-2"><LockKeyhole className="w-6 h-6 text-accent" />Obra Carcelaria</h1>
          <p className="text-sm text-secondary mt-1">Asistencia interna en el centro de reclusión, seguimiento familiar externo y reinserción eclesial post-penitenciaria.</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Periodo del análisis">
          {PERIODOS.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-ink text-white border-ink" : "border-border text-secondary"}`}>{label}</button>
          ))}
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {!canEdit && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Tienes acceso de consulta. Las altas y modificaciones requieren el permiso de edición de Obra Carcelaria.</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Internos activos" value={activos.length} progress={activos.length ? 100 : 0} detail={`${internos.length} registrados en total`} insight="Población atendida actualmente dentro del centro." />
        <Metric label="Bautizados" value={bautizados.length} progress={activos.length ? Math.round((bautizados.length / activos.length) * 100) : 0} detail={`${activos.length ? Math.round((bautizados.length / activos.length) * 100) : 0}% de los activos`} insight="Membresía interna formal tras las rejas." />
        <Metric label="Sellados" value={sellados.length} progress={activos.length ? Math.round((sellados.length / activos.length) * 100) : 0} detail="Con el Espíritu Santo" insight="Hito espiritual registrado durante la reclusión." />
        <Metric label="Delegados habilitados" value={delegadosHabilitados.length} tone={delegadosAlerta.length > 0 ? "text-danger" : "text-success"} progress={delegados.length ? Math.round((delegadosHabilitados.length / delegados.length) * 100) : 0} detail={`${delegadosAlerta.length} con permiso por revisar`} insight="Voluntarios con ingreso autorizado por el INPEC." />
      </section>

      <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightGeneral}</p>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">Asistencia interna</p>
          <h2 className="font-medium mt-1">Tendencia de asistencia a cultos</h2>
          <div className="h-56 mt-4">
            {trend.length ? <Line data={chartData} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin cultos registrados en el periodo." />}
          </div>
          <p className="text-xs text-secondary mt-2">{tendenciaVariacion === null ? "Aún no hay suficiente historial para comparar." : `${tendenciaVariacion >= 0 ? "Creció" : "Bajó"} ${Math.abs(tendenciaVariacion)}% frente a la primera mitad del periodo.`} {estudiosUltimoMes} estudios REFAM entregados en los últimos 30 días.</p>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">Población flotante vs. membresía interna</p>
          <h2 className="font-medium mt-1">Asistencia vs. hitos espirituales</h2>
          <div className="h-56 mt-4">
            {cultos.length ? <Bar data={poblacionChartData} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin datos registrados todavía." />}
          </div>
        </div>
      </section>

      {delegadosAlerta.length > 0 && (
        <section className="card p-5 border-2 border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div><h2 className="font-medium">Delegados con permiso INPEC por revisar</h2><p className="text-xs text-secondary mt-1">Vencido, sin fecha registrada, o vence en los próximos {DIAS_ALERTA_INPEC} días.</p></div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
            {delegadosAlerta.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-3">
                <p className="text-sm font-medium">{item.personas?.nombres} {item.personas?.apellidos}</p>
                <p className="text-xs text-secondary mt-1">{item.permiso_inpec_vencimiento ? `Vence: ${item.permiso_inpec_vencimiento}` : "Sin fecha de vencimiento registrada"}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <nav className="flex gap-1 border-b border-border overflow-x-auto" aria-label="Secciones de Obra Carcelaria" role="tablist">
        {[["internos", "Internos", LockKeyhole], ["cultos", "Cultos y REFAM", Church], ["delegados", "Delegados", UserCheck], ["familiar", "Seguimiento familiar", HeartHandshake], ["reinsercion", "Reinserción", ArrowRightLeft]].map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 ${tab === key ? "border-accent text-accent" : "border-transparent text-secondary"}`}><Icon className="w-4 h-4" />{label}</button>
        ))}
      </nav>

      {tab === "internos" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="eyebrow">Censo</p><h2 className="font-medium mt-1">Internos</h2>
            <div className="overflow-x-auto mt-4 max-h-96 overflow-y-auto">
              {internos.length ? internos.map((item) => (
                <div key={item.id} className="border-b border-border py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.nombres} {item.apellidos}</p>
                      <p className="text-xs text-secondary mt-1">{item.centros_reclusion?.nombre || "Sin centro"}{item.patio ? ` · Patio ${item.patio}` : ""}</p>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-surface-1">{ESTADO_INTERNO_LABELS[item.estado]}</span>
                        {item.bautizado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">Bautizado</span>}
                        {item.sellado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">Sellado</span>}
                      </div>
                    </div>
                    {canEdit && <button type="button" className="text-xs text-accent flex-shrink-0" onClick={() => editInterno(item)}>Editar</button>}
                  </div>
                  {canEdit && item.estado === "activo" && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {!item.bautizado && <button type="button" className="text-xs btn-secondary px-2 py-1" onClick={() => marcarHito(item, "bautizado", "fecha_bautismo")}>Marcar bautizado</button>}
                      {!item.sellado && <button type="button" className="text-xs btn-secondary px-2 py-1" onClick={() => marcarHito(item, "sellado", "fecha_sellado")}>Marcar sellado</button>}
                      <button type="button" className="text-xs btn-secondary px-2 py-1" onClick={() => marcarEstado(item, "liberado")}>Marcar liberado</button>
                    </div>
                  )}
                </div>
              )) : <Empty text="Aún no hay internos registrados." />}
            </div>
          </div>

          {canEdit && (
            <form onSubmit={saveInterno} className="card p-5 flex flex-col gap-2 h-fit">
              <div className="flex items-center justify-between"><h2 className="font-medium">{editingInternoId ? "Editar interno" : "Nuevo interno"}</h2>{editingInternoId && <button type="button" className="text-xs text-secondary" onClick={resetInternoForm}>Cancelar</button>}</div>
              <div className="grid grid-cols-2 gap-2">
                <input required className="input-field" placeholder="Nombres" value={internoForm.nombres} onChange={(event) => setInternoForm({ ...internoForm, nombres: event.target.value })} />
                <input required className="input-field" placeholder="Apellidos" value={internoForm.apellidos} onChange={(event) => setInternoForm({ ...internoForm, apellidos: event.target.value })} />
              </div>
              <select className="input-field" value={internoForm.centro_id} onChange={(event) => setInternoForm({ ...internoForm, centro_id: event.target.value })}>
                <option value="">Centro de reclusión</option>
                {centros.map((centro) => <option key={centro.id} value={centro.id}>{centro.nombre}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input className="input-field" placeholder="Patio / pabellón" value={internoForm.patio} onChange={(event) => setInternoForm({ ...internoForm, patio: event.target.value })} />
                <input required type="date" className="input-field" value={internoForm.fecha_ingreso_ministerio} onChange={(event) => setInternoForm({ ...internoForm, fecha_ingreso_ministerio: event.target.value })} />
              </div>
              <textarea className="input-field min-h-14" placeholder="Observaciones" value={internoForm.observaciones} onChange={(event) => setInternoForm({ ...internoForm, observaciones: event.target.value })} />
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {editingInternoId ? "Guardar cambios" : "Registrar interno"}</button>
            </form>
          )}
        </section>
      )}

      {tab === "cultos" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="eyebrow">Historial</p><h2 className="font-medium mt-1">Cultos registrados</h2>
            <div className="flex flex-col divide-y divide-border mt-4 max-h-96 overflow-y-auto">
              {cultos.length ? cultos.map((item) => (
                <div key={item.id} className="py-2">
                  <div className="flex justify-between gap-3"><p className="text-sm font-medium">{item.centros_reclusion?.nombre || "Sin centro"}{item.patio ? ` · Patio ${item.patio}` : ""}</p><span className="text-xs text-secondary">{item.fecha}</span></div>
                  <p className="text-xs text-secondary mt-1">{item.asistentes_total} asistentes · {item.estudios_biblicos_entregados} estudios REFAM entregados</p>
                  {item.notas && <p className="text-xs text-muted mt-1">{item.notas}</p>}
                </div>
              )) : <Empty text="Aún no hay cultos registrados en el periodo." />}
            </div>
          </div>

          {canEdit && (
            <form onSubmit={createCulto} className="card p-5 flex flex-col gap-2 h-fit">
              <h2 className="font-medium">Registrar culto</h2>
              <div className="grid grid-cols-2 gap-2">
                <select className="input-field" value={cultoForm.centro_id} onChange={(event) => setCultoForm({ ...cultoForm, centro_id: event.target.value })}>
                  <option value="">Centro de reclusión</option>
                  {centros.map((centro) => <option key={centro.id} value={centro.id}>{centro.nombre}</option>)}
                </select>
                <input required type="date" className="input-field" value={cultoForm.fecha} onChange={(event) => setCultoForm({ ...cultoForm, fecha: event.target.value })} />
              </div>
              <input className="input-field" placeholder="Patio / pabellón" value={cultoForm.patio} onChange={(event) => setCultoForm({ ...cultoForm, patio: event.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-secondary">Asistentes totales<input type="number" min="0" placeholder="0" className="input-field mt-1" value={cultoForm.asistentes_total} onChange={(event) => setCultoForm({ ...cultoForm, asistentes_total: event.target.value })} /></label>
                <label className="text-xs text-secondary">Estudios REFAM entregados<input type="number" min="0" placeholder="0" className="input-field mt-1" value={cultoForm.estudios_biblicos_entregados} onChange={(event) => setCultoForm({ ...cultoForm, estudios_biblicos_entregados: event.target.value })} /></label>
              </div>
              <select className="input-field" value={cultoForm.responsable_persona_id} onChange={(event) => setCultoForm({ ...cultoForm, responsable_persona_id: event.target.value })}>
                <option value="">Responsable</option>
                {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
              </select>
              <textarea className="input-field min-h-14" placeholder="Notas" value={cultoForm.notas} onChange={(event) => setCultoForm({ ...cultoForm, notas: event.target.value })} />
              {activos.length > 0 && <div>
                <p className="text-xs text-secondary mb-1">Asistencia individual (internos con ficha)</p>
                <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                  {activos.map((interno) => <label key={interno.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[interno.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [interno.id]: event.target.checked })} />{interno.nombres} {interno.apellidos}</label>)}
                </div>
              </div>}
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> Registrar culto</button>
            </form>
          )}
        </section>
      )}

      {tab === "delegados" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-border"><p className="eyebrow">Habilitación de voluntarios</p><h2 className="font-medium mt-1">Delegados</h2></div>
            {delegados.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Delegado</th><th className="font-normal px-4 py-2.5">Centro</th><th className="font-normal px-4 py-2.5">Permiso INPEC</th><th className="font-normal px-4 py-2.5"></th></tr></thead>
                  <tbody>
                    {delegados.map((item) => {
                      const vencido = !item.permiso_inpec_vigente || !item.permiso_inpec_vencimiento || item.permiso_inpec_vencimiento <= en30dias;
                      return (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-4 py-2.5 font-medium">{item.personas?.nombres} {item.personas?.apellidos}</td>
                          <td className="px-4 py-2.5 text-secondary">{item.centros_reclusion?.nombre || "—"}</td>
                          <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${vencido ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}>{item.permiso_inpec_vencimiento ? `Vence ${item.permiso_inpec_vencimiento}` : "Sin fecha"}</span></td>
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
              <select className="input-field" value={delegadoForm.centro_id} onChange={(event) => setDelegadoForm({ ...delegadoForm, centro_id: event.target.value })}>
                <option value="">Centro de reclusión</option>
                {centros.map((centro) => <option key={centro.id} value={centro.id}>{centro.nombre}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={delegadoForm.permiso_inpec_vigente} onChange={(event) => setDelegadoForm({ ...delegadoForm, permiso_inpec_vigente: event.target.checked })} />Permiso INPEC vigente</label>
              <label className="text-xs text-secondary">Vencimiento del permiso<input type="date" className="input-field mt-1" value={delegadoForm.permiso_inpec_vencimiento} onChange={(event) => setDelegadoForm({ ...delegadoForm, permiso_inpec_vencimiento: event.target.value })} /></label>
              <textarea className="input-field min-h-14" placeholder="Observaciones" value={delegadoForm.observaciones} onChange={(event) => setDelegadoForm({ ...delegadoForm, observaciones: event.target.value })} />
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {editingDelegadoId ? "Guardar cambios" : "Habilitar delegado"}</button>
            </form>
          )}
        </section>
      )}

      {tab === "familiar" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="eyebrow">Asistencia externa</p><h2 className="font-medium mt-1">Seguimiento familiar</h2>
            <div className="flex flex-col divide-y divide-border mt-4 max-h-96 overflow-y-auto">
              {seguimientos.length ? seguimientos.map((item) => (
                <div key={item.id} className="py-2">
                  <div className="flex justify-between gap-3"><p className="text-sm font-medium">{item.obra_carcelaria_internos?.nombres} {item.obra_carcelaria_internos?.apellidos}</p><span className="text-xs text-secondary">{item.fecha_visita}</span></div>
                  <p className="text-xs text-secondary mt-1">{TIPO_APOYO_LABELS[item.tipo_apoyo]} · {item.contacto_nombre}{item.parentesco ? ` (${item.parentesco})` : ""}</p>
                  {item.notas && <p className="text-xs text-muted mt-1">{item.notas}</p>}
                </div>
              )) : <Empty text="Aún no hay seguimiento familiar registrado." />}
            </div>
          </div>

          {canEdit && (
            <form onSubmit={saveFamiliar} className="card p-5 flex flex-col gap-2 h-fit">
              <h2 className="font-medium">Registrar seguimiento familiar</h2>
              <select required className="input-field" value={familiarForm.interno_id} onChange={(event) => setFamiliarForm({ ...familiarForm, interno_id: event.target.value })}>
                <option value="">Interno</option>
                {internos.map((interno) => <option key={interno.id} value={interno.id}>{interno.nombres} {interno.apellidos}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input required className="input-field" placeholder="Nombre del contacto" value={familiarForm.contacto_nombre} onChange={(event) => setFamiliarForm({ ...familiarForm, contacto_nombre: event.target.value })} />
                <input className="input-field" placeholder="Parentesco" value={familiarForm.parentesco} onChange={(event) => setFamiliarForm({ ...familiarForm, parentesco: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input-field" placeholder="Teléfono" value={familiarForm.telefono} onChange={(event) => setFamiliarForm({ ...familiarForm, telefono: event.target.value })} />
                <input required type="date" className="input-field" value={familiarForm.fecha_visita} onChange={(event) => setFamiliarForm({ ...familiarForm, fecha_visita: event.target.value })} />
              </div>
              <select className="input-field" value={familiarForm.tipo_apoyo} onChange={(event) => setFamiliarForm({ ...familiarForm, tipo_apoyo: event.target.value })}>
                {Object.entries(TIPO_APOYO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select className="input-field" value={familiarForm.familia_id} onChange={(event) => setFamiliarForm({ ...familiarForm, familia_id: event.target.value })}>
                <option value="">Vincular con familia censada (opcional)</option>
                {familias.map((familia) => <option key={familia.id} value={familia.id}>{familia.nombre_familia}</option>)}
              </select>
              <select className="input-field" value={familiarForm.responsable_persona_id} onChange={(event) => setFamiliarForm({ ...familiarForm, responsable_persona_id: event.target.value })}>
                <option value="">Responsable</option>
                {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
              </select>
              <textarea className="input-field min-h-14" placeholder="Notas" value={familiarForm.notas} onChange={(event) => setFamiliarForm({ ...familiarForm, notas: event.target.value })} />
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> Registrar seguimiento</button>
            </form>
          )}
        </section>
      )}

      {tab === "reinsercion" && (
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border"><p className="eyebrow">Post-penitenciario</p><h2 className="font-medium mt-1">Reinserción eclesial</h2><p className="text-sm text-secondary mt-1">La asignación de un liberado a una congregación la realiza el coordinador distrital desde Pastoral Distrital. Aquí puedes ver el resultado y, si tu congregación es la receptora, actualizar el estado de integración.</p></div>
          {reinserciones.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Interno</th><th className="font-normal px-4 py-2.5">Origen</th><th className="font-normal px-4 py-2.5">Destino</th><th className="font-normal px-4 py-2.5">Estado</th><th className="font-normal px-4 py-2.5"></th></tr></thead>
                <tbody>
                  {reinserciones.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.obra_carcelaria_internos?.nombres} {item.obra_carcelaria_internos?.apellidos}</td>
                      <td className="px-4 py-2.5 text-secondary">{item.origen?.nombre}</td>
                      <td className="px-4 py-2.5 text-secondary">{item.destino?.nombre}</td>
                      <td className="px-4 py-2.5"><span className="text-xs px-2 py-1 rounded bg-surface-1">{ESTADO_REINSERCION_LABELS[item.estado]}</span></td>
                      <td className="px-4 py-2.5 text-right">
                        {canEdit && item.congregacion_destino_id === congregacionId && (
                          <select className="input-field text-xs py-1" value={item.estado} onChange={(event) => actualizarReinsercion(item, event.target.value)}>
                            {Object.entries(ESTADO_REINSERCION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="p-5 text-sm text-muted">{liberados.length > 0 ? "Hay internos liberados sin asignación de reinserción todavía." : "Aún no hay casos de reinserción."}</p>}
        </section>
      )}
    </div>
  );
}
