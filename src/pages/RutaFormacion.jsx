import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, Plus, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";

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
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState([]);
  const [friends, setFriends] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    subjectId: "",
    responsibleId: "",
    program: config.defaultProgram,
    date: TODAY,
    lessonsTotal: "12",
    lessonsCompleted: "0",
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
    const [processResult, peopleResult, friendsResult] = await Promise.all([
      supabase.from(config.table).select("*").eq("congregacion_id", congregacionId).order("fecha_inicio", { ascending: false }),
      supabase.from("personas").select("id, nombres, apellidos, bautizado").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("amigos").select("id, nombres").eq("congregacion_id", congregacionId).eq("convertido", false).order("nombres"),
    ]);
    const failed = [processResult, peopleResult, friendsResult].find((result) => result.error);
    if (failed) setError(`No se pudo cargar ${config.title}. Intenta nuevamente o contacta al administrador.`);
    setRows(processResult.data ?? []);
    setPeople((peopleResult.data ?? []).filter((person) => mode === "esfob" || person.bautizado));
    setFriends(friendsResult.data ?? []);
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
    if (!canEdit || !form.subjectId) return;
    setSaving(true);
    setError(null);
    const stationResult = await supabase.from("ruta_estaciones").select("id").eq("congregacion_id", congregacionId).eq("codigo", mode).single();
    if (stationResult.error) {
      setError("No se encontró la estación. Intenta nuevamente o contacta al administrador.");
      setSaving(false);
      return;
    }
    const processPayload = {
      congregacion_id: congregacionId,
      estacion_id: stationResult.data.id,
      responsable_persona_id: form.responsibleId || null,
      fecha_inicio: form.date,
      estado: config.activeState,
      notas: form.notes || null,
    };
    if (mode === "esfob") processPayload.amigo_id = form.subjectId;
    else processPayload.persona_id = form.subjectId;
    const processResult = await supabase.from("ruta_procesos").insert(processPayload).select("id").single();
    if (processResult.error) {
      setError(`No se pudo iniciar el proceso: ${processResult.error.message}`);
      setSaving(false);
      return;
    }
    const detailPayload = mode === "esfob"
      ? {
          congregacion_id: congregacionId,
          proceso_id: processResult.data.id,
          amigo_id: form.subjectId,
          responsable_persona_id: form.responsibleId || null,
          programa: form.program,
          lecciones_total: Number(form.lessonsTotal) || 1,
          lecciones_completadas: Number(form.lessonsCompleted) || 0,
          fecha_inicio: form.date,
          notas: form.notes || null,
        }
      : {
          congregacion_id: congregacionId,
          proceso_id: processResult.data.id,
          persona_id: form.subjectId,
          mentor_persona_id: form.responsibleId || null,
          programa: form.program,
          fecha_inicio: form.date,
          servicio_actual: form.service || null,
          notas: form.notes || null,
        };
    const detailResult = await supabase.from(config.table).insert(detailPayload);
    if (detailResult.error) {
      await supabase.from("ruta_procesos").delete().eq("id", processResult.data.id);
      setError(`No se pudo guardar el detalle: ${detailResult.error.message}`);
    } else {
      setNotice(`${config.title} iniciado correctamente.`);
      setShowForm(false);
      setForm({ subjectId: "", responsibleId: "", program: config.defaultProgram, date: TODAY, lessonsTotal: "12", lessonsCompleted: "0", service: "", notes: "" });
      load();
    }
    setSaving(false);
  }

  const active = rows.filter((row) => row.estado === config.activeState).length;
  const completed = rows.filter((row) => row.estado === "completado" || row.estado === "aprobado").length;
  const totalLessons = rows.reduce((total, row) => total + Number(row.lecciones_completadas || 0), 0);
  const findName = (id) => people.find((person) => person.id === id);
  const findFriend = (id) => friends.find((friend) => friend.id === id);

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
        <label className="text-sm text-secondary">{mode === "esfob" ? "Responsable" : "Mentor"}<select className="input-field mt-1" value={form.responsibleId} onChange={(event) => updateForm("responsibleId", event.target.value)}><option value="">Sin asignar</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select></label>
        <label className="text-sm text-secondary">Programa<input className="input-field mt-1" value={form.program} onChange={(event) => updateForm("program", event.target.value)} required /></label>
        <label className="text-sm text-secondary">Fecha de inicio<input type="date" className="input-field mt-1" value={form.date} onChange={(event) => updateForm("date", event.target.value)} required /></label>
        {mode === "esfob" ? <>
          <label className="text-sm text-secondary">Lecciones totales<input type="number" min="1" className="input-field mt-1" value={form.lessonsTotal} onChange={(event) => updateForm("lessonsTotal", event.target.value)} required /></label>
          <label className="text-sm text-secondary">Lecciones completadas<input type="number" min="0" className="input-field mt-1" value={form.lessonsCompleted} onChange={(event) => updateForm("lessonsCompleted", event.target.value)} required /></label>
        </> : <label className="text-sm text-secondary">Servicio actual<input className="input-field mt-1" value={form.service} onChange={(event) => updateForm("service", event.target.value)} placeholder="Ej. apoyo en evangelismo" /></label>}
        <label className="text-sm text-secondary md:col-span-2">Notas<textarea className="input-field mt-1 min-h-20" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} /></label>
        <div className="md:col-span-2 flex justify-end"><button className="btn-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar proceso"}</button></div>
      </form>}
      <section className="grid sm:grid-cols-3 gap-3">
        <Metric label={config.activeLabel} value={active} />
        <Metric label="Completados" value={completed} tone="text-success" />
        <Metric label={mode === "esfob" ? "Lecciones completadas" : "Personas acompañadas"} value={mode === "esfob" ? totalLessons : rows.length} />
      </section>
      <section className="card p-5">
        <div className="flex items-start gap-3 pb-4 border-b border-border"><span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center"><BookOpen className="w-4 h-4" /></span><div><p className="eyebrow">Seguimiento operativo</p><h2 className="font-medium mt-1">Procesos registrados</h2></div></div>
        {rows.length === 0 ? <p className="text-sm text-secondary py-6">Aún no hay procesos registrados.</p> : <div className="divide-y divide-border">{rows.map((row) => { const person = mode === "esfob" ? findFriend(row.amigo_id) : findName(row.persona_id); const responsible = findName(row.responsable_persona_id || row.mentor_persona_id); return <div key={row.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><p className="font-medium">{person?.nombres} {person?.apellidos || ""}</p><p className="text-xs text-secondary">{row.programa} · Inicio: {row.fecha_inicio}{responsible ? ` · Responsable: ${responsible.nombres} ${responsible.apellidos}` : ""}</p></div><span className="text-xs px-2 py-1 rounded bg-accent-bg text-accent">{row.estado}</span></div>; })}</div>}
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "text-ink" }) {
  return <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{label}</p><p className={`text-2xl font-semibold mt-3 ${tone}`}>{value}</p></div>;
}
