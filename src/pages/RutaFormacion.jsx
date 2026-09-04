import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { ArrowLeft, ArrowRightLeft, BookOpen, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, distributionDataset } from "../lib/chartTheme";
import { UMBRAL_DIAS_ESTACION, diasDesde, getEstacion, iniciarOMoverEstacion } from "../lib/rutaEvangelistica";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);
const CHART_OPTIONS = chartOptions();
const TODAY = new Date().toISOString().slice(0, 10);

const CONFIG = {
  esfob: {
    title: "ESFOB / EFOB",
    eyebrow: "Formación bautismal",
    description: "Acompaña la preparación doctrinal antes del pacto del bautismo.",
    table: "esfob_procesos",
    defaultProgram: "ESFOB",
    activeState: "en_formacion",
    activeLabel: "En formación",
  },
  discipulado: {
    title: "Discipulado",
    eyebrow: "Formar para enviar",
    description: "Acompaña al nuevo bautizado en su maduración y preparación para servir.",
    table: "discipulado_procesos",
    defaultProgram: "Discipulado Crecer",
    activeState: "activo",
    activeLabel: "Activos",
  },
};

export default function RutaFormacion({ mode }) {
  const config = CONFIG[mode];
  const umbral = UMBRAL_DIAS_ESTACION[mode];
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState([]);
  const [friends, setFriends] = useState([]);
  const [estaciones, setEstaciones] = useState([]);
  const [esfobLecciones, setEsfobLecciones] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [trasladoDestino, setTrasladoDestino] = useState({});

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const [form, setForm] = useState({
    subjectId: "",
    responsibleId: "",
    program: config.defaultProgram,
    date: TODAY,
    service: "",
    notes: "",
  });

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [processResult, peopleResult, friendsResult, estacionesResult, leccionesResult] = await Promise.all([
      supabase.from(config.table).select(mode === "esfob" ? "*, leccion_actual:esfob_lecciones(numero, titulo)" : "*").eq("congregacion_id", congregacionId).order("fecha_inicio", { ascending: false }),
      supabase.from("personas").select("id, nombres, apellidos, bautizado").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("amigos").select("id, nombres, zona_id, zonas(nombre)").eq("congregacion_id", congregacionId).eq("convertido", false).order("nombres"),
      supabase.from("ruta_estaciones").select("id, codigo, nombre, orden").eq("congregacion_id", congregacionId).order("orden"),
      mode === "esfob" ? supabase.from("esfob_lecciones").select("id, numero, titulo, descripcion").eq("congregacion_id", congregacionId).eq("activo", true).order("numero") : Promise.resolve({ data: [] }),
    ]);
    const failed = [processResult, peopleResult, friendsResult].find((result) => result.error);
    if (failed) setError(`No se pudo cargar ${config.title}. Intenta nuevamente o contacta al administrador.`);
    setRows(processResult.data ?? []);
    setPeople((peopleResult.data ?? []).filter((person) => mode === "esfob" || person.bautizado));
    setFriends(friendsResult.data ?? []);
    setEstaciones(estacionesResult.data ?? []);
    setEsfobLecciones(leccionesResult.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [congregacionId, mode]);

  useEffect(() => {
    if (!congregacionId) return;
    const permission = "ruta_evangelistica.editar";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: permission }).then(({ data }) => {
      setCanEdit((rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura") || Boolean(data));
    });
  }, [congregacionId, rolPrincipal]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createProcess(event) {
    event.preventDefault();
    if (!canEdit || !form.subjectId || !form.responsibleId) return;
    setSaving(true);
    setError(null);
    const stationResult = await getEstacion(congregacionId, mode);
    if (stationResult.error) {
      setError("No se encontró la estación. Intenta nuevamente o contacta al administrador.");
      setSaving(false);
      return;
    }
    const rutaResult = await iniciarOMoverEstacion({
      congregacionId,
      estacionDestino: stationResult.data,
      amigoId: mode === "esfob" ? form.subjectId : null,
      personaId: mode === "discipulado" ? form.subjectId : null,
      responsablePersonaId: form.responsibleId || null,
      fechaInicio: form.date,
    });
    if (rutaResult.error) {
      setError(`No se pudo iniciar el proceso: ${rutaResult.error.message}`);
      setSaving(false);
      return;
    }
    const detailPayload = mode === "esfob"
      ? {
          congregacion_id: congregacionId,
          proceso_id: rutaResult.data.id,
          amigo_id: form.subjectId,
          responsable_persona_id: form.responsibleId || null,
          programa: form.program,
          lecciones_total: esfobLecciones.length || 1,
          lecciones_completadas: 0,
          leccion_actual_id: esfobLecciones[0]?.id || null,
          fecha_inicio: form.date,
          notas: form.notes || null,
        }
      : {
          congregacion_id: congregacionId,
          proceso_id: rutaResult.data.id,
          persona_id: form.subjectId,
          mentor_persona_id: form.responsibleId || null,
          programa: form.program,
          fecha_inicio: form.date,
          servicio_actual: form.service || null,
          notas: form.notes || null,
        };
    const detailResult = await supabase.from(config.table).insert(detailPayload);
    if (detailResult.error) {
      setError(`No se pudo guardar el detalle: ${detailResult.error.message}`);
    } else {
      setNotice(`${config.title} iniciado correctamente.`);
      setShowForm(false);
      setForm({ subjectId: "", responsibleId: "", program: config.defaultProgram, date: TODAY, service: "", notes: "" });
      load();
    }
    setSaving(false);
  }

  async function trasladar(row) {
    if (!canEdit) return;
    const destinoId = trasladoDestino[row.id];
    const destino = estaciones.find((item) => item.id === destinoId);
    if (!destino) { setError("Selecciona a qué estación trasladar."); return; }
    setSaving(true);
    setError(null);
    const result = await iniciarOMoverEstacion({
      congregacionId,
      estacionDestino: destino,
      amigoId: mode === "esfob" ? row.amigo_id : null,
      personaId: mode === "discipulado" ? row.persona_id : null,
      responsablePersonaId: row.responsable_persona_id || row.mentor_persona_id || null,
    });
    setSaving(false);
    if (result.error) { setError(`No se pudo trasladar: ${result.error.message}`); return; }
    setNotice(`Trasladado a ${destino.nombre}.`);
    load();
  }

  async function marcarLeccionEsfob(row) {
    if (!canEdit || !row.leccion_actual_id) return;
    setSaving(true);
    setError(null);
    const insertResult = await supabase.from("esfob_progreso_leccion").insert({
      esfob_proceso_id: row.id,
      leccion_id: row.leccion_actual_id,
      responsable_persona_id: row.responsable_persona_id || null,
    });
    if (insertResult.error) { setSaving(false); setError(`No se pudo marcar la lección completada: ${insertResult.error.message}`); return; }
    const siguiente = esfobLecciones.find((item) => item.numero === (row.leccion_actual?.numero || 0) + 1);
    const updateResult = await supabase.from("esfob_procesos").update({
      leccion_actual_id: siguiente?.id || null,
      lecciones_completadas: Math.min(Number(row.lecciones_total || esfobLecciones.length || 1), Number(row.lecciones_completadas || 0) + 1),
    }).eq("id", row.id);
    setSaving(false);
    if (updateResult.error) { setError(`Se registró la lección, pero no se pudo avanzar a la siguiente: ${updateResult.error.message}`); return; }
    setNotice(siguiente ? `Lección completada. Avanzó a la lección #${siguiente.numero}.` : "Lección completada. Terminó el currículo de ESFOB.");
    load();
  }

  const active = rows.filter((row) => row.estado === config.activeState).length;
  const completed = rows.filter((row) => row.estado === "completado" || row.estado === "aprobado").length;
  const totalLessons = rows.reduce((total, row) => total + Number(row.lecciones_completadas || 0), 0);
  const findName = (id) => people.find((person) => person.id === id);
  const findFriend = (id) => friends.find((friend) => friend.id === id);

  const filas = useMemo(() => rows.filter((row) => row.estado === config.activeState).map((row) => {
    const person = mode === "esfob" ? findFriend(row.amigo_id) : findName(row.persona_id);
    const dias = diasDesde(row.fecha_inicio);
    const listo = mode === "esfob"
      ? Number(row.lecciones_completadas || 0) >= Number(row.lecciones_total || 1)
      : (dias ?? 0) > umbral;
    return { ...row, person, dias, listo, zonaNombre: person?.zonas?.nombre || "Sin zona" };
  }), [rows, friends, people, mode, umbral]);
  const candidatos = filas.filter((row) => row.listo);
  const zonaRows = useMemo(() => {
    if (mode !== "esfob") return [];
    const conteo = new Map();
    filas.forEach((row) => conteo.set(row.zonaNombre, (conteo.get(row.zonaNombre) || 0) + 1));
    return [...conteo.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);
  }, [filas, mode]);
  const promedioDias = filas.length ? Math.round(filas.reduce((sum, row) => sum + (row.dias || 0), 0) / filas.length) : 0;
  const insight = candidatos.length
    ? mode === "esfob"
      ? `${candidatos.length} persona${candidatos.length === 1 ? "" : "s"} ya completó sus lecciones -- revisa si están listas para el bautismo.`
      : `${candidatos.length} persona${candidatos.length === 1 ? "" : "s"} lleva${candidatos.length === 1 ? "" : "n"} más de ${umbral} días en discipulado -- conviene revisar continuidad, mentoría y servicio actual.`
    : filas.length
      ? `${filas.length} persona${filas.length === 1 ? "" : "s"} activa${filas.length === 1 ? "" : "s"}, con un promedio de ${promedioDias} días.`
      : "Aún no hay procesos activos.";

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando {config.title}...</div>;

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link to="/misiones-evangelismo" className="btn-secondary mb-4"><ArrowLeft className="w-4 h-4" />Volver a Misiones y Evangelismo</Link>
          <p className="eyebrow">{config.eyebrow}</p>
          <h1 className="section-title">{config.title}</h1>
          <p className="text-sm text-secondary mt-1">{config.description}</p>
        </div>
        {canEdit && <button type="button" className="btn-primary" onClick={() => setShowForm((current) => !current)}><Plus className="w-4 h-4" />{showForm ? "Cerrar registro" : "Iniciar proceso"}</button>}
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}
      {!canEdit && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Tienes acceso de consulta. El inicio y actualización de procesos requiere permiso de edición.</p>}
      {showForm && <form onSubmit={createProcess} className="card p-5 grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><p className="eyebrow">Nuevo proceso</p><h2 className="font-medium mt-1">Registrar {config.title}</h2></div>
        <label className="text-sm text-secondary">{mode === "esfob" ? "Amigo en ruta" : "Persona bautizada"}<select className="input-field mt-1" value={form.subjectId} onChange={(event) => updateForm("subjectId", event.target.value)} required><option value="">Selecciona una persona</option>{(mode === "esfob" ? friends : people).map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos || ""}</option>)}</select></label>
        <label className="text-sm text-secondary">{mode === "esfob" ? "Responsable" : "Mentor"}<select required className="input-field mt-1" value={form.responsibleId} onChange={(event) => updateForm("responsibleId", event.target.value)}><option value="">Selecciona un responsable</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select></label>
        <label className="text-sm text-secondary">Programa<input className="input-field mt-1" value={form.program} onChange={(event) => updateForm("program", event.target.value)} required /></label>
        <label className="text-sm text-secondary">Fecha de inicio<input type="date" className="input-field mt-1" value={form.date} onChange={(event) => updateForm("date", event.target.value)} required /></label>
        {mode === "esfob" ? (
          <p className="text-sm text-secondary md:col-span-2 bg-surface-1 rounded p-3">
            {esfobLecciones.length
              ? `Empezará en la lección #1 (${esfobLecciones[0].titulo}) de las ${esfobLecciones.length} del catálogo. Se marcan completadas desde la lista de abajo.`
              : "Aún no hay catálogo de lecciones ESFOB configurado -- ve a Módulos y actividades para crearlo. El proceso igual se puede iniciar."}
          </p>
        ) : <label className="text-sm text-secondary">Servicio actual<input className="input-field mt-1" value={form.service} onChange={(event) => updateForm("service", event.target.value)} placeholder="Ej. apoyo en evangelismo" /></label>}
        <label className="text-sm text-secondary md:col-span-2">Notas<textarea className="input-field mt-1 min-h-20" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} /></label>
        <div className="md:col-span-2 flex justify-end"><button className="btn-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar proceso"}</button></div>
      </form>}
      <section className="grid sm:grid-cols-4 gap-3">
        <Metric label={config.activeLabel} value={active} />
        <Metric label="Completados" value={completed} tone="text-success" />
        <Metric label={mode === "esfob" ? "Lecciones completadas" : "Personas acompañadas"} value={mode === "esfob" ? totalLessons : rows.length} />
        <Metric label="Candidatos a trasladar" value={candidatos.length} tone="text-warning" />
      </section>
      <p className={`text-sm rounded p-3 ${candidatos.length ? "text-warning bg-warning-bg" : "text-secondary bg-surface-1"}`}>{insight}</p>
      {mode === "esfob" && <section className="card chart-card p-5">
        <p className="eyebrow">Cobertura territorial</p>
        <h2 className="font-medium mt-1">Personas en ESFOB por zona</h2>
        <div className="h-56 mt-4">{zonaRows.length ? <Bar data={distributionDataset(zonaRows, { labelKey: "nombre", valueKey: "total", datasetLabel: "Personas" })} options={CHART_OPTIONS} /> : <p className="text-sm text-muted py-10 text-center">Aún no hay datos.</p>}</div>
      </section>}
      <section className="card p-5">
        <div className="flex items-start gap-3 pb-4 border-b border-border"><span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center"><BookOpen className="w-4 h-4" /></span><div><p className="eyebrow">Seguimiento operativo</p><h2 className="font-medium mt-1">Procesos activos</h2></div></div>
        {filas.length === 0 ? <p className="text-sm text-secondary py-6">Aún no hay procesos activos.</p> : <div className="divide-y divide-border">{filas.map((row) => { const responsible = findName(row.responsable_persona_id || row.mentor_persona_id); return <div key={row.id} className="py-4 flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="font-medium">{row.person?.nombres} {row.person?.apellidos || ""}</p>
              <p className="text-xs text-secondary">{row.programa} · {row.dias ?? 0} días{responsible ? ` · Responsable: ${responsible.nombres} ${responsible.apellidos}` : ""}</p>
              {mode === "esfob" && <p className="text-xs text-secondary mt-0.5">{row.leccion_actual ? `Lección #${row.leccion_actual.numero} — ${row.leccion_actual.titulo}` : esfobLecciones.length ? "Currículo completado" : "Sin catálogo de lecciones"} · {row.lecciones_completadas}/{row.lecciones_total} completadas</p>}
            </div>
            <div className="flex items-center gap-2">{row.listo && <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded-full bg-warning-bg text-warning whitespace-nowrap">Listo para trasladar</span>}<span className="text-xs px-2 py-1 rounded bg-accent-bg text-accent">{row.estado}</span></div>
          </div>
          {canEdit && <div className="flex flex-wrap items-center gap-2">
            {mode === "esfob" && row.leccion_actual_id && <button type="button" onClick={() => marcarLeccionEsfob(row)} disabled={saving} className="btn-secondary px-2 py-1 text-xs">Marcar lección completada</button>}
            <select aria-label="Trasladar a" className="input-field text-xs flex-1" value={trasladoDestino[row.id] || ""} onChange={(event) => setTrasladoDestino({ ...trasladoDestino, [row.id]: event.target.value })}><option value="">Trasladar a...</option>{estaciones.filter((item) => item.codigo !== mode && item.codigo !== "metodos").map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
            <button type="button" aria-label="Confirmar traslado a otra estación" onClick={() => trasladar(row)} disabled={saving} className="btn-secondary px-3"><ArrowRightLeft className="w-3.5 h-3.5" /></button>
          </div>}
        </div>; })}</div>}
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "text-ink" }) {
  return <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{label}</p><p className={`text-2xl font-semibold mt-3 ${tone}`}>{value}</p></div>;
}
