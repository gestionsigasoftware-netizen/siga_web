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
import { BookOpen, GraduationCap, Plus, Target, UsersRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import ChartEmpty from "../components/ChartEmpty";
import InfoTip from "../components/InfoTip";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

const ETAPAS = ["Cuna", "Párvulos", "Primarios", "Preadolescentes"];
const PERIODOS = [["30", "30 días"], ["180", "6 meses"], ["365", "12 meses"]];
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

export default function EscuelaDominical() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [clases, setClases] = useState([]);
  const [ninos, setNinos] = useState([]);
  const [maestros, setMaestros] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [todasLecciones, setTodasLecciones] = useState([]);
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
  const [claseForm, setClaseForm] = useState({ nombre: "", etapa: ETAPAS[0], metodologia: "", maestro_lider_persona_id: "" });
  const [ninoForm, setNinoForm] = useState({ nombres: "", apellidos: "", clase_id: "", fecha_nacimiento: "", acudiente_nombre: "", acudiente_telefono: "" });
  const [maestroForm, setMaestroForm] = useState({ persona_id: "", rol: "maestro" });
  const [selectedClaseId, setSelectedClaseId] = useState(null);
  const [lecciones, setLecciones] = useState([]);
  const [leccionForm, setLeccionForm] = useState({ tema: "", fecha: hoyBogota(), notas: "" });
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
    const [c, n, m, p, l] = await Promise.all([
      supabase.from("escuela_dominical_clases").select("id, nombre, etapa, metodologia, maestro_lider_persona_id, leccion_actual, activo, personas:maestro_lider_persona_id(nombres, apellidos)").eq("congregacion_id", congregacionId).order("nombre"),
      supabase.from("escuela_dominical_ninos").select("id, nombres, apellidos, clase_id, fecha_nacimiento, acudiente_nombre, acudiente_telefono, estado, bautizado, fecha_bautismo, sellado, fecha_sellado").eq("congregacion_id", congregacionId).order("nombres"),
      supabase.from("escuela_dominical_maestros").select("id, persona_id, rol, activo, personas(nombres, apellidos)").eq("congregacion_id", congregacionId).order("created_at", { ascending: false }),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("escuela_dominical_lecciones").select("id, clase_id, numero, tema, fecha, asistentes, escuela_dominical_clases!inner(congregacion_id, nombre)").eq("escuela_dominical_clases.congregacion_id", congregacionId).gte("fecha", fechaBogota(start)).order("fecha"),
    ]);
    const failed = [c, n, m, p, l].find((item) => item.error);
    if (failed) setError("No se pudo cargar Escuela Dominical. Intenta nuevamente o contacta al administrador.");
    setClases(c.data ?? []);
    setNinos(n.data ?? []);
    setMaestros(m.data ?? []);
    setPersonas(p.data ?? []);
    setTodasLecciones(l.data ?? []);
    setLoading(false);
  }

  async function loadLecciones(claseId) {
    setSelectedClaseId(claseId);
    setLecciones([]);
    setAsistenciaMarcada({});
    if (!claseId) return;
    const { data, error: leccionesError } = await supabase.from("escuela_dominical_lecciones").select("id, numero, tema, fecha, asistentes, notas").eq("clase_id", claseId).order("numero", { ascending: false });
    if (leccionesError) setError("No se pudo cargar el historial de lecciones.");
    setLecciones(data ?? []);
  }

  async function createLeccion(event) {
    event.preventDefault();
    if (!canEdit || !selectedClaseId) return;
    const clase = clases.find((item) => item.id === selectedClaseId);
    const ninosClase = ninos.filter((nino) => nino.clase_id === selectedClaseId && nino.estado === "activo");
    const asistentesCount = ninosClase.filter((nino) => asistenciaMarcada[nino.id]).length;
    setSaving(true);
    setError(null);
    const proximoNumero = (lecciones[0]?.numero || 0) + 1;
    const leccionResult = await supabase.from("escuela_dominical_lecciones").insert({
      clase_id: selectedClaseId,
      numero: proximoNumero,
      tema: leccionForm.tema.trim(),
      fecha: leccionForm.fecha,
      asistentes: asistentesCount,
      notas: leccionForm.notas.trim() || null,
    }).select("id").single();
    if (leccionResult.error) { setSaving(false); setError(`No se pudo registrar la lección: ${leccionResult.error.message}`); return; }
    if (ninosClase.length > 0) {
      const asistenciaResult = await supabase.from("escuela_dominical_asistencia").insert(
        ninosClase.map((nino) => ({ leccion_id: leccionResult.data.id, nino_id: nino.id, asistio: Boolean(asistenciaMarcada[nino.id]) })),
      );
      if (asistenciaResult.error) { setSaving(false); setError(`La lección se guardó, pero no se pudo registrar la asistencia individual: ${asistenciaResult.error.message}`); return; }
    }
    if (proximoNumero > (clase?.leccion_actual || 0)) {
      await supabase.from("escuela_dominical_clases").update({ leccion_actual: proximoNumero }).eq("id", selectedClaseId).eq("congregacion_id", congregacionId);
    }
    setSaving(false);
    setNotice("Lección registrada con asistencia individual.");
    setLeccionForm({ tema: "", fecha: hoyBogota(), notas: "" });
    setAsistenciaMarcada({});
    loadLecciones(selectedClaseId);
    load();
  }

  async function createClase(event) {
    event.preventDefault();
    if (!canEdit || !claseForm.nombre.trim()) return;
    setSaving(true); setError(null);
    const result = await supabase.from("escuela_dominical_clases").insert({
      congregacion_id: congregacionId,
      nombre: claseForm.nombre.trim(),
      etapa: claseForm.etapa || null,
      metodologia: claseForm.metodologia.trim() || null,
      maestro_lider_persona_id: claseForm.maestro_lider_persona_id || null,
    });
    setSaving(false);
    if (result.error) { setError("No se pudo registrar la clase."); return; }
    setNotice("Clase registrada.");
    setClaseForm({ nombre: "", etapa: ETAPAS[0], metodologia: "", maestro_lider_persona_id: "" });
    load();
  }

  async function createNino(event) {
    event.preventDefault();
    if (!canEdit || !ninoForm.nombres.trim() || !ninoForm.apellidos.trim()) return;
    setSaving(true); setError(null);
    const result = await supabase.from("escuela_dominical_ninos").insert({
      congregacion_id: congregacionId,
      clase_id: ninoForm.clase_id || null,
      nombres: ninoForm.nombres.trim(),
      apellidos: ninoForm.apellidos.trim(),
      fecha_nacimiento: ninoForm.fecha_nacimiento || null,
      acudiente_nombre: ninoForm.acudiente_nombre.trim() || null,
      acudiente_telefono: ninoForm.acudiente_telefono.trim() || null,
    });
    setSaving(false);
    if (result.error) { setError("No se pudo registrar al niño."); return; }
    setNotice("Niño registrado en Escuela Dominical.");
    setNinoForm({ nombres: "", apellidos: "", clase_id: "", fecha_nacimiento: "", acudiente_nombre: "", acudiente_telefono: "" });
    load();
  }

  async function createMaestro(event) {
    event.preventDefault();
    if (!canEdit || !maestroForm.persona_id) return;
    setSaving(true); setError(null);
    const result = await supabase.from("escuela_dominical_maestros").insert({ congregacion_id: congregacionId, persona_id: maestroForm.persona_id, rol: maestroForm.rol.trim() || "maestro" });
    setSaving(false);
    if (result.error) { setError(result.error.code === "23505" ? "Esta persona ya está registrada como maestro." : "No se pudo registrar el maestro."); return; }
    setNotice("Maestro registrado.");
    setMaestroForm({ persona_id: "", rol: "maestro" });
    load();
  }

  async function marcarHito(nino, campo, fechaCampo) {
    if (!canEdit) return;
    setSaving(true); setError(null);
    const hoy = hoyBogota();
    const result = await supabase.from("escuela_dominical_ninos").update({ [campo]: true, [fechaCampo]: hoy }).eq("id", nino.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(`No se pudo actualizar la ficha: ${result.error.message}`); return; }
    setNotice("Ficha actualizada.");
    load();
  }

  async function toggleMaestro(maestro) {
    const result = await supabase.from("escuela_dominical_maestros").update({ activo: maestro.activo === false }).eq("id", maestro.id).eq("congregacion_id", congregacionId);
    if (result.error) { setError("No se pudo cambiar el estado del maestro."); return; }
    load();
  }

  useEffect(() => { load(); }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "escuela_dominical.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando Escuela Dominical...</div>;

  const ninosActivos = ninos.filter((n) => n.estado === "activo");
  const ninosBautizados = ninosActivos.filter((n) => n.bautizado);
  const ninosSellados = ninosActivos.filter((n) => n.sellado);
  const clasesActivas = clases.filter((c) => c.activo !== false);
  const maestrosActivos = maestros.filter((m) => m.activo !== false);
  const ninosPorClase = clasesActivas.length ? Math.round(ninosActivos.length / clasesActivas.length) : 0;

  // Tendencia de asistencia por fecha (todas las clases, período seleccionado)
  const trend = [...new Set(todasLecciones.map((l) => l.fecha))].sort().map((fecha) => ({
    fecha,
    total: todasLecciones.filter((l) => l.fecha === fecha).reduce((sum, l) => sum + Number(l.asistentes || 0), 0),
  }));
  const totalAsistenciaPeriodo = trend.reduce((sum, item) => sum + item.total, 0);
  const promedioLeccion = todasLecciones.length ? Math.round(totalAsistenciaPeriodo / todasLecciones.length) : 0;
  const mitad = Math.floor(trend.length / 2) || 1;
  const primeraMitad = trend.slice(0, mitad).reduce((sum, item) => sum + item.total, 0);
  const segundaMitad = trend.slice(mitad).reduce((sum, item) => sum + item.total, 0);
  const tendenciaVariacion = primeraMitad ? Math.round(((segundaMitad - primeraMitad) / primeraMitad) * 100) : null;

  // Distribución por etapa
  const etapasConTotal = ETAPAS.map((etapa) => ({
    etapa,
    total: ninosActivos.filter((n) => clases.find((c) => c.id === n.clase_id)?.etapa === etapa).length,
  }));

  // Ranking de clases por niños
  const clasesConDatos = clasesActivas.map((clase) => {
    const ninosDeClase = ninosActivos.filter((n) => n.clase_id === clase.id);
    const leccionesDeClase = todasLecciones.filter((l) => l.clase_id === clase.id);
    const asistenciaPromedio = leccionesDeClase.length ? Math.round(leccionesDeClase.reduce((sum, l) => sum + Number(l.asistentes || 0), 0) / leccionesDeClase.length) : 0;
    return { ...clase, ninosCount: ninosDeClase.length, asistenciaPromedio };
  }).sort((a, b) => b.ninosCount - a.ninosCount);
  const claseSinMaestro = clasesActivas.filter((c) => !c.maestro_lider_persona_id).length;

  const topClase = clasesConDatos[0];
  const insightGeneral = topClase?.ninosCount
    ? `${topClase.nombre} concentra ${topClase.ninosCount} niños. ${claseSinMaestro > 0 ? `${claseSinMaestro} clase(s) aún no tienen maestro líder asignado.` : "Todas las clases tienen maestro líder."}`
    : "Registra clases y niños para construir una lectura de impacto infantil.";

  const chartData = trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: "Asistentes" });
  const etapasChartData = distributionDataset(etapasConTotal, { labelKey: "etapa", datasetLabel: "Niños" });

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Misión Infantil</p>
          <h1 className="section-title">Escuela Dominical</h1>
          <p className="text-sm text-secondary mt-1">Niños por edades y etapas, metodologías de trabajo y censo de maestros.</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Periodo del análisis">
          {PERIODOS.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-ink text-white border-ink" : "border-border text-secondary"}`}>{label}</button>
          ))}
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {!canEdit && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Tienes acceso de consulta. Las altas y modificaciones requieren el permiso de edición de Escuela Dominical.</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Clases activas" value={clasesActivas.length} progress={clasesActivas.length ? 100 : 0} detail={`${claseSinMaestro} sin maestro líder`} insight={claseSinMaestro ? "Asigna un maestro líder a cada clase para dar continuidad." : "Todas las clases tienen maestro líder."} />
        <Metric label="Niños activos" value={ninosActivos.length} progress={ninosActivos.length ? 100 : 0} detail={`${ninosPorClase} niños por clase`} insight={ninosActivos.length ? "Compara con la asistencia real para detectar continuidad." : "Registra el primer niño para iniciar el trabajo."} />
        <Metric label="Maestros activos" value={maestrosActivos.length} progress={maestrosActivos.length ? Math.min(100, maestrosActivos.length * 20) : 0} detail={`${clasesActivas.length ? Math.round(maestrosActivos.length / clasesActivas.length * 100) : 0}% cobertura por clase`} insight={maestrosActivos.length < clasesActivas.length ? "Hay menos maestros que clases activas: revisa cobertura." : "Cobertura de maestros adecuada."} />
        <Metric label="Asistencia promedio" value={promedioLeccion} tone={tendenciaVariacion === null || tendenciaVariacion >= 0 ? "text-success" : "text-danger"} progress={ninosActivos.length ? Math.min(100, Math.round((promedioLeccion / ninosActivos.length) * 100)) : 0} detail={`${todasLecciones.length} lecciones en el periodo`} insight={tendenciaVariacion === null ? "Aún no hay suficiente historial para comparar." : `${tendenciaVariacion >= 0 ? "Creció" : "Bajó"} ${Math.abs(tendenciaVariacion)}% frente a la primera mitad del periodo.`} />
        <Metric label="Lecciones registradas" value={todasLecciones.length} progress={todasLecciones.length ? 100 : 0} detail={`${totalAsistenciaPeriodo} asistentes acumulados`} insight={todasLecciones.length ? "Usa la tendencia para identificar crecimiento o disminución." : "Aún no hay lecciones registradas en el periodo."} />
        <Metric label="Niños por etapa líder" value={etapasConTotal.sort((a, b) => b.total - a.total)[0]?.etapa || "—"} progress={ninosActivos.length ? Math.round((etapasConTotal.sort((a, b) => b.total - a.total)[0]?.total || 0) / ninosActivos.length * 100) : 0} detail={`${etapasConTotal.sort((a, b) => b.total - a.total)[0]?.total || 0} niños`} insight="Concentra materiales y capacitación según la etapa con más niños." />
        <Metric label="Bautizados" value={ninosBautizados.length} progress={ninosActivos.length ? Math.round((ninosBautizados.length / ninosActivos.length) * 100) : 0} detail={`${ninosActivos.length ? Math.round((ninosBautizados.length / ninosActivos.length) * 100) : 0}% de los activos`} insight="Bautizado y sellado son hitos independientes: compáralos con la métrica de sellados." />
        <Metric label="Sellados" value={ninosSellados.length} progress={ninosActivos.length ? Math.round((ninosSellados.length / ninosActivos.length) * 100) : 0} detail="Con el Espíritu Santo" insight="Puede pasar antes o después del bautismo en agua." />
      </section>

      <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightGeneral}</p>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">Asistencia registrada</p>
          <h2 className="font-medium mt-1">Tendencia de asistencia</h2>
          <div className="h-56 mt-4">
            {trend.length ? <Line data={chartData} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin lecciones registradas en el periodo." />}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">Crecimiento</p>
          <h2 className="font-medium mt-1">Niños por etapa</h2>
          <div className="h-56 mt-4">
            {ninosActivos.length ? <Bar data={etapasChartData} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin niños registrados todavía." />}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="eyebrow">Comparativa</p><h2 className="font-medium mt-1">Clases por impacto</h2><p className="text-xs text-secondary mt-1">Niños y asistencia promedio por clase, para priorizar recursos y maestros.</p></div>
          <Target className="w-5 h-5 text-accent" />
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">Clase</th><th className="py-2">Etapa</th><th className="py-2 text-right">Niños</th><th className="py-2 text-right">Asistencia prom.</th></tr></thead>
            <tbody>
              {clasesConDatos.map((clase) => (
                <tr key={clase.id} className="border-b border-border">
                  <td className="py-2 font-medium">{clase.nombre}</td>
                  <td className="py-2 text-secondary">{clase.etapa || "Sin etapa"}</td>
                  <td className="py-2 text-right">{clase.ninosCount}</td>
                  <td className="py-2 text-right">{clase.asistenciaPromedio}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!clasesConDatos.length && <p className="text-sm text-secondary py-6 text-center">Aún no hay clases para comparar.</p>}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">Clases</p><h2 className="font-medium mt-1">Clases y lecciones</h2></div>
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <div className="flex flex-col divide-y divide-border mt-4">
            {clases.map((clase) => (
              <div role="button" tabIndex={0} key={clase.id} onClick={() => loadLecciones(clase.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); loadLecciones(clase.id); } }} className={`py-3 text-left cursor-pointer ${selectedClaseId === clase.id ? "bg-accent-bg -mx-2 px-2 rounded" : ""}`}>
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{clase.nombre}</p>
                  <span className="text-xs text-accent flex items-center gap-1">Lección {clase.leccion_actual}<InfoTip texto="Se actualiza sola cada vez que registras una lección nueva; no se puede editar a mano." /></span>
                </div>
                <p className="text-xs text-secondary mt-1">{clase.etapa || "Sin etapa"} · {clase.personas ? `${clase.personas.nombres} ${clase.personas.apellidos}` : "Sin maestro líder"}</p>
              </div>
            ))}
            {!clases.length && <p className="text-sm text-muted py-6">Aún no hay clases registradas.</p>}
          </div>
          {selectedClaseId && (() => {
            const claseSeleccionada = clases.find((item) => item.id === selectedClaseId);
            const ninosClase = ninos.filter((nino) => nino.clase_id === selectedClaseId && nino.estado === "activo");
            return <div className="border-t border-border mt-4 pt-4">
              <p className="text-sm font-medium mb-2">Lecciones de {claseSeleccionada?.nombre}</p>
              {canEdit && <form onSubmit={createLeccion} className="grid gap-2 mb-3">
                <div className="grid grid-cols-2 gap-2">
                  <input required className="input-field" placeholder="Tema de la lección" value={leccionForm.tema} onChange={(event) => setLeccionForm({ ...leccionForm, tema: event.target.value })} />
                  <input required type="date" className="input-field" value={leccionForm.fecha} onChange={(event) => setLeccionForm({ ...leccionForm, fecha: event.target.value })} />
                </div>
                <textarea className="input-field min-h-14" placeholder="Notas (opcional)" value={leccionForm.notas} onChange={(event) => setLeccionForm({ ...leccionForm, notas: event.target.value })} />
                {ninosClase.length > 0 && <div>
                  <p className="text-xs text-secondary mb-1">Asistencia individual</p>
                  <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                    {ninosClase.map((nino) => <label key={nino.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[nino.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [nino.id]: event.target.checked })} />{nino.nombres} {nino.apellidos}</label>)}
                  </div>
                </div>}
                <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />Registrar lección</button>
              </form>}
              {lecciones.length ? <div className="divide-y divide-border">{lecciones.map((leccion) => <div key={leccion.id} className="py-2"><p className="text-sm">Lección {leccion.numero}: {leccion.tema}</p><p className="text-xs text-secondary">{leccion.fecha} · {leccion.asistentes} asistentes</p></div>)}</div> : <p className="text-xs text-muted">Aún no hay lecciones registradas para esta clase.</p>}
            </div>;
          })()}
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">Censo</p><h2 className="font-medium mt-1">Niños de Escuela Dominical</h2></div>
            <UsersRound className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4 max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">Niño</th><th className="py-2">Clase</th><th className="py-2">Acudiente</th><th className="py-2"><span className="inline-flex items-center gap-1">Hitos<InfoTip texto="Bautizado y sellado se marcan una sola vez con la fecha de hoy; no hay botón para deshacerlo desde aquí." /></span></th></tr></thead>
              <tbody>
                {ninos.map((nino) => (
                  <tr key={nino.id} className="border-b border-border">
                    <td className="py-2 font-medium">{nino.nombres} {nino.apellidos}</td>
                    <td className="py-2 text-secondary">{clases.find((c) => c.id === nino.clase_id)?.nombre || "Sin clase"}</td>
                    <td className="py-2 text-secondary">{nino.acudiente_nombre || "Sin dato"}</td>
                    <td className="py-2">
                      <div className="flex gap-1.5 flex-wrap items-center">
                        {nino.bautizado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">Bautizado</span>}
                        {nino.sellado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">Sellado</span>}
                        {canEdit && !nino.bautizado && <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => marcarHito(nino, "bautizado", "fecha_bautismo")}>Marcar bautizado</button>}
                        {canEdit && !nino.sellado && <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => marcarHito(nino, "sellado", "fecha_sellado")}>Marcar sellado</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!ninos.length && <p className="text-sm text-secondary py-6 text-center">Aún no hay niños registrados.</p>}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div><p className="eyebrow">Equipo</p><h2 className="font-medium mt-1">Maestros de Escuela Dominical</h2></div>
          <GraduationCap className="w-5 h-5 text-accent" />
        </div>
        {canEdit && <form onSubmit={createMaestro} className="grid sm:grid-cols-3 gap-2 mb-4">
          <select required className="input-field" value={maestroForm.persona_id} onChange={(event) => setMaestroForm({ ...maestroForm, persona_id: event.target.value })}>
            <option value="">Selecciona una persona</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
          <input className="input-field" placeholder="Rol (ej. maestro, auxiliar)" value={maestroForm.rol} onChange={(event) => setMaestroForm({ ...maestroForm, rol: event.target.value })} />
          <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />Registrar maestro</button>
        </form>}
        <div className="divide-y divide-border">{maestrosActivos.map((maestro) => <div key={maestro.id} className="py-2 flex items-center justify-between gap-3"><div><p className="text-sm">{maestro.personas?.nombres} {maestro.personas?.apellidos}</p><p className="text-xs text-secondary">{maestro.rol}</p></div>{canEdit && <button type="button" onClick={() => toggleMaestro(maestro)} className="text-xs text-danger">Desactivar</button>}</div>)}{maestrosActivos.length === 0 && <p className="text-sm text-muted py-4">Aún no hay maestros registrados.</p>}</div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <form onSubmit={createClase} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
          <h2 className="font-medium">Nueva clase</h2>
          <input required className="input-field" placeholder="Nombre de la clase" value={claseForm.nombre} onChange={(event) => setClaseForm({ ...claseForm, nombre: event.target.value })} />
          <select className="input-field" value={claseForm.etapa} onChange={(event) => setClaseForm({ ...claseForm, etapa: event.target.value })}>
            {ETAPAS.map((etapa) => <option key={etapa} value={etapa}>{etapa}</option>)}
          </select>
          <input className="input-field" placeholder="Metodología de trabajo" value={claseForm.metodologia} onChange={(event) => setClaseForm({ ...claseForm, metodologia: event.target.value })} />
          <select className="input-field" value={claseForm.maestro_lider_persona_id} onChange={(event) => setClaseForm({ ...claseForm, maestro_lider_persona_id: event.target.value })}>
            <option value="">Maestro líder</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
          <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> Registrar clase</button>
        </form>
        <form onSubmit={createNino} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
          <h2 className="font-medium">Nuevo niño</h2>
          <div className="grid grid-cols-2 gap-2">
            <input required className="input-field" placeholder="Nombres" value={ninoForm.nombres} onChange={(event) => setNinoForm({ ...ninoForm, nombres: event.target.value })} />
            <input required className="input-field" placeholder="Apellidos" value={ninoForm.apellidos} onChange={(event) => setNinoForm({ ...ninoForm, apellidos: event.target.value })} />
          </div>
          <select className="input-field" value={ninoForm.clase_id} onChange={(event) => setNinoForm({ ...ninoForm, clase_id: event.target.value })}>
            <option value="">Clase</option>
            {clases.map((clase) => <option key={clase.id} value={clase.id}>{clase.nombre}</option>)}
          </select>
          <input type="date" className="input-field" placeholder="Fecha de nacimiento" value={ninoForm.fecha_nacimiento} onChange={(event) => setNinoForm({ ...ninoForm, fecha_nacimiento: event.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input-field" placeholder="Nombre del acudiente" value={ninoForm.acudiente_nombre} onChange={(event) => setNinoForm({ ...ninoForm, acudiente_nombre: event.target.value })} />
            <input className="input-field" placeholder="Teléfono del acudiente" value={ninoForm.acudiente_telefono} onChange={(event) => setNinoForm({ ...ninoForm, acudiente_telefono: event.target.value })} />
          </div>
          <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" /> Registrar niño</button>
        </form>
      </section>
    </div>
  );
}
