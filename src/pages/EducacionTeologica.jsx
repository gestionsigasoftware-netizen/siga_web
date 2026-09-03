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
import { BookOpenCheck, GraduationCap, Plus, Target, UsersRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import ChartEmpty from "../components/ChartEmpty";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

const NIVELES = { titulo: "Título", curso: "Curso", diplomado: "Diplomado", especializacion: "Especialización", maestria: "Maestría", doctorado: "Doctorado", seminario_biblico: "Seminario bíblico", otro: "Otro" };
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

export default function EducacionTeologica() {
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
  const [canEdit, setCanEdit] = useState(false);
  const [grupoForm, setGrupoForm] = useState({ nombre: "", nivel: "curso", instructor_persona_id: "" });
  const [integranteForm, setIntegranteForm] = useState({ persona_id: "", grupo_id: "" });
  const [selectedGrupoId, setSelectedGrupoId] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [sesionForm, setSesionForm] = useState({ tema: "", fecha: new Date().toISOString().slice(0, 10), notas: "" });
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
    const [g, i, p, s] = await Promise.all([
      supabase.from("teologica_grupos").select("id, nombre, nivel, instructor_persona_id, sesion_actual, activo, personas:instructor_persona_id(nombres, apellidos)").eq("congregacion_id", congregacionId).order("nombre"),
      supabase.from("teologica_integrantes").select("id, persona_id, grupo_id, estado, certificado, fecha_certificado, personas(nombres, apellidos)").eq("congregacion_id", congregacionId),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("teologica_sesiones").select("id, grupo_id, numero, tema, fecha, asistentes, teologica_grupos!inner(congregacion_id, nombre)").eq("teologica_grupos.congregacion_id", congregacionId).gte("fecha", start.toISOString().slice(0, 10)).order("fecha"),
    ]);
    const failed = [g, i, p, s].find((item) => item.error);
    if (failed) setError("No se pudo cargar Educación Teológica. Intenta nuevamente o contacta al administrador.");
    setGrupos(g.data ?? []);
    setIntegrantes(i.data ?? []);
    setPersonas(p.data ?? []);
    setTodasSesiones(s.data ?? []);
    setLoading(false);
  }

  async function loadSesiones(grupoId) {
    setSelectedGrupoId(grupoId);
    setSesiones([]);
    setAsistenciaMarcada({});
    if (!grupoId) return;
    const { data, error: sesionesError } = await supabase.from("teologica_sesiones").select("id, numero, tema, fecha, asistentes, notas").eq("grupo_id", grupoId).order("numero", { ascending: false });
    if (sesionesError) setError("No se pudo cargar el historial de sesiones.");
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
    if (sesionResult.error) { setSaving(false); setError(`No se pudo registrar la sesión: ${sesionResult.error.message}`); return; }
    if (integrantesGrupo.length > 0) {
      const asistenciaResult = await supabase.from("teologica_asistencia").insert(
        integrantesGrupo.map((item) => ({ sesion_id: sesionResult.data.id, integrante_id: item.id, asistio: Boolean(asistenciaMarcada[item.id]) })),
      );
      if (asistenciaResult.error) { setSaving(false); setError(`La sesión se guardó, pero no se pudo registrar la asistencia individual: ${asistenciaResult.error.message}`); return; }
    }
    if (proximoNumero > (grupo?.sesion_actual || 0)) {
      await supabase.from("teologica_grupos").update({ sesion_actual: proximoNumero }).eq("id", selectedGrupoId).eq("congregacion_id", congregacionId);
    }
    setSaving(false);
    setNotice("Sesión registrada con asistencia individual.");
    setSesionForm({ tema: "", fecha: new Date().toISOString().slice(0, 10), notas: "" });
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
    if (result.error) { setError("No se pudo registrar el grupo."); return; }
    setNotice("Grupo registrado.");
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
    if (result.error) { setError(result.error.code === "23505" ? "Esta persona ya está registrada en ese grupo." : "No se pudo registrar al integrante."); return; }
    setNotice("Integrante registrado.");
    setIntegranteForm({ persona_id: "", grupo_id: "" });
    load();
  }

  async function toggleIntegrante(integrante) {
    const result = await supabase.from("teologica_integrantes").update({ estado: integrante.estado === "activo" ? "inactivo" : "activo" }).eq("id", integrante.id).eq("congregacion_id", congregacionId);
    if (result.error) { setError("No se pudo cambiar el estado del integrante."); return; }
    load();
  }

  async function marcarCertificado(integrante) {
    if (!canEdit) return;
    setSaving(true); setError(null);
    const result = await supabase.from("teologica_integrantes").update({ certificado: true, fecha_certificado: new Date().toISOString().slice(0, 10) }).eq("id", integrante.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(`No se pudo registrar la certificación: ${result.error.message}`); return; }
    setNotice("Certificación registrada.");
    load();
  }

  useEffect(() => { load(); }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "teologica.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando Educación Teológica...</div>;

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
  const tendenciaVariacion = primeraMitad ? Math.round(((segundaMitad - primeraMitad) / primeraMitad) * 100) : null;

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
    ? `${topGrupo.nombre} concentra ${topGrupo.integrantesCount} integrantes. ${certificados.length} persona(s) ya se han certificado.`
    : "Registra grupos e integrantes para construir una lectura de la formación bíblica de la congregación.";

  const chartData = trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: "Asistentes" });
  const nivelesChartData = distributionDataset(nivelesConTotal, { datasetLabel: "Integrantes" });

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">FECP · Educación Teológica</p>
          <h1 className="section-title flex items-center gap-2"><BookOpenCheck className="w-6 h-6 text-accent" />Educación Teológica</h1>
          <p className="text-sm text-secondary mt-1">Formación bíblica y doctrinal de la membresía — distinta de la formación ministerial de pastores.</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Periodo del análisis">
          {PERIODOS.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-ink text-white border-ink" : "border-border text-secondary"}`}>{label}</button>
          ))}
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {!canEdit && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Tienes acceso de consulta. Las altas y modificaciones requieren el permiso de edición de Educación Teológica.</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label="Grupos activos" value={gruposActivos.length} progress={gruposActivos.length ? 100 : 0} detail={`${grupoSinInstructor} sin instructor`} insight={grupoSinInstructor ? "Asigna un instructor a cada grupo." : "Todos los grupos tienen instructor."} />
        <Metric label="Integrantes activos" value={integrantesActivos.length} progress={integrantesActivos.length ? 100 : 0} detail={`${integrantesPorGrupo} por grupo`} insight={integrantesActivos.length ? "Compara con la asistencia real para detectar continuidad." : "Registra el primer integrante para iniciar."} />
        <Metric label="Certificados" value={certificados.length} tone="text-success" progress={integrantesActivos.length ? Math.round((certificados.length / integrantesActivos.length) * 100) : 0} detail={`${integrantesActivos.length ? Math.round((certificados.length / integrantesActivos.length) * 100) : 0}% de los activos`} insight="Hito de graduación del proceso formativo." />
        <Metric label="Asistencia promedio" value={promedioSesion} tone={tendenciaVariacion === null || tendenciaVariacion >= 0 ? "text-success" : "text-danger"} progress={integrantesActivos.length ? Math.min(100, Math.round((promedioSesion / integrantesActivos.length) * 100)) : 0} detail={`${todasSesiones.length} sesiones en el periodo`} insight={tendenciaVariacion === null ? "Aún no hay suficiente historial para comparar." : `${tendenciaVariacion >= 0 ? "Creció" : "Bajó"} ${Math.abs(tendenciaVariacion)}% frente a la primera mitad del periodo.`} />
        <Metric label="Sesiones registradas" value={todasSesiones.length} progress={todasSesiones.length ? 100 : 0} detail={`${totalAsistenciaPeriodo} asistentes acumulados`} insight={todasSesiones.length ? "Usa la tendencia para identificar crecimiento o disminución." : "Aún no hay sesiones registradas en el periodo."} />
        <Metric label="Nivel líder" value={nivelesConTotal.sort((a, b) => b.total - a.total)[0]?.label || "—"} progress={integrantesActivos.length ? Math.round((nivelesConTotal.sort((a, b) => b.total - a.total)[0]?.total || 0) / integrantesActivos.length * 100) : 0} detail={`${nivelesConTotal.sort((a, b) => b.total - a.total)[0]?.total || 0} integrantes`} insight="Compara niveles para planear la siguiente oferta formativa." />
      </section>

      <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightGeneral}</p>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">Asistencia registrada</p>
          <h2 className="font-medium mt-1">Tendencia de asistencia</h2>
          <div className="h-56 mt-4">
            {trend.length ? <Line data={chartData} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin sesiones registradas en el periodo." />}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">Composición</p>
          <h2 className="font-medium mt-1">Integrantes por nivel</h2>
          <div className="h-56 mt-4">
            {nivelesConTotal.length ? <Bar data={nivelesChartData} options={CHART_OPTIONS} /> : <ChartEmpty message="Sin integrantes registrados todavía." />}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="eyebrow">Comparativa</p><h2 className="font-medium mt-1">Grupos por impacto</h2><p className="text-xs text-secondary mt-1">Integrantes y asistencia promedio por grupo.</p></div>
          <Target className="w-5 h-5 text-accent" />
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">Grupo</th><th className="py-2">Nivel</th><th className="py-2 text-right">Integrantes</th><th className="py-2 text-right">Asistencia prom.</th></tr></thead>
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
          {!gruposConDatos.length && <p className="text-sm text-secondary py-6 text-center">Aún no hay grupos para comparar.</p>}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">Grupos</p><h2 className="font-medium mt-1">Grupos y sesiones</h2></div>
            <BookOpenCheck className="w-5 h-5 text-accent" />
          </div>
          <div className="flex flex-col divide-y divide-border mt-4">
            {grupos.map((grupo) => (
              <button type="button" key={grupo.id} onClick={() => loadSesiones(grupo.id)} className={`py-3 text-left ${selectedGrupoId === grupo.id ? "bg-accent-bg -mx-2 px-2 rounded" : ""}`}>
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{grupo.nombre}</p>
                  <span className="text-xs text-accent">Sesión {grupo.sesion_actual}</span>
                </div>
                <p className="text-xs text-secondary mt-1">{NIVELES[grupo.nivel]} · {grupo.personas ? `${grupo.personas.nombres} ${grupo.personas.apellidos}` : "Sin instructor"}</p>
              </button>
            ))}
            {!grupos.length && <p className="text-sm text-muted py-6">Aún no hay grupos registrados.</p>}
          </div>
          {selectedGrupoId && (() => {
            const grupoSeleccionado = grupos.find((item) => item.id === selectedGrupoId);
            const integrantesGrupo = integrantesActivos.filter((item) => item.grupo_id === selectedGrupoId);
            return <div className="border-t border-border mt-4 pt-4">
              <p className="text-sm font-medium mb-2">Sesiones de {grupoSeleccionado?.nombre}</p>
              {canEdit && <form onSubmit={createSesion} className="grid gap-2 mb-3">
                <div className="grid grid-cols-2 gap-2">
                  <input required className="input-field" placeholder="Tema de la sesión" value={sesionForm.tema} onChange={(event) => setSesionForm({ ...sesionForm, tema: event.target.value })} />
                  <input required type="date" className="input-field" value={sesionForm.fecha} onChange={(event) => setSesionForm({ ...sesionForm, fecha: event.target.value })} />
                </div>
                <textarea className="input-field min-h-14" placeholder="Notas (opcional)" value={sesionForm.notas} onChange={(event) => setSesionForm({ ...sesionForm, notas: event.target.value })} />
                {integrantesGrupo.length > 0 && <div>
                  <p className="text-xs text-secondary mb-1">Asistencia individual</p>
                  <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                    {integrantesGrupo.map((item) => <label key={item.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[item.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [item.id]: event.target.checked })} />{item.personas?.nombres} {item.personas?.apellidos}</label>)}
                  </div>
                </div>}
                <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />Registrar sesión</button>
              </form>}
              {sesiones.length ? <div className="divide-y divide-border">{sesiones.map((sesion) => <div key={sesion.id} className="py-2"><p className="text-sm">Sesión {sesion.numero}: {sesion.tema}</p><p className="text-xs text-secondary">{sesion.fecha} · {sesion.asistentes} asistentes</p></div>)}</div> : <p className="text-xs text-muted">Aún no hay sesiones registradas para este grupo.</p>}
            </div>;
          })()}
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">Censo</p><h2 className="font-medium mt-1">Integrantes de Educación Teológica</h2></div>
            <GraduationCap className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4 max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">Integrante</th><th className="py-2">Grupo</th><th className="py-2"></th></tr></thead>
              <tbody>
                {integrantes.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="py-2 font-medium">{item.personas?.nombres} {item.personas?.apellidos}{item.certificado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent ml-2">Certificado</span>}</td>
                    <td className="py-2 text-secondary">{grupos.find((g) => g.id === item.grupo_id)?.nombre || "Sin grupo"}</td>
                    <td className="py-2 text-right flex justify-end gap-2">
                      {canEdit && !item.certificado && <button type="button" onClick={() => marcarCertificado(item)} className="text-xs text-accent">Certificar</button>}
                      {canEdit && <button type="button" onClick={() => toggleIntegrante(item)} className={`text-xs ${item.estado === "activo" ? "text-danger" : "text-accent"}`}>{item.estado === "activo" ? "Desactivar" : "Reactivar"}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!integrantes.length && <p className="text-sm text-secondary py-6 text-center">Aún no hay integrantes registrados.</p>}
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <form onSubmit={createGrupo} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
          <h2 className="font-medium">Nuevo grupo</h2>
          <input required className="input-field" placeholder="Nombre del grupo" value={grupoForm.nombre} onChange={(event) => setGrupoForm({ ...grupoForm, nombre: event.target.value })} />
          <select className="input-field" value={grupoForm.nivel} onChange={(event) => setGrupoForm({ ...grupoForm, nivel: event.target.value })}>
            {Object.entries(NIVELES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="input-field" value={grupoForm.instructor_persona_id} onChange={(event) => setGrupoForm({ ...grupoForm, instructor_persona_id: event.target.value })}>
            <option value="">Instructor</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
          <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> Registrar grupo</button>
        </form>
        <form onSubmit={createIntegrante} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
          <h2 className="font-medium">Nuevo integrante</h2>
          <select required className="input-field" value={integranteForm.persona_id} onChange={(event) => setIntegranteForm({ ...integranteForm, persona_id: event.target.value })}>
            <option value="">Persona</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
          <select className="input-field" value={integranteForm.grupo_id} onChange={(event) => setIntegranteForm({ ...integranteForm, grupo_id: event.target.value })}>
            <option value="">Grupo</option>
            {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>)}
          </select>
          <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" /> Registrar integrante</button>
        </form>
      </section>
    </div>
  );
}
