import { useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { ArrowLeft, ArrowRightLeft, BookOpen, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { hoyBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, distributionDataset, trendDataset } from "../lib/chartTheme";
import { DETALLE_ESTACION, UMBRAL_DIAS_ESTACION, diasDesde, getComitesActivos, getEstacion, iniciarOMoverEstacion, trasladarEstacion } from "../lib/rutaEvangelistica";
import ChartEmpty from "../components/ChartEmpty";
import InfoTip from "../components/InfoTip";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);
const CHART_OPTIONS = chartOptions();
const TODAY = hoyBogota();
const ESTADOS_DISCIPULADO = { activo: "Activo", completado: "Completado", pausado: "Pausado", retirado: "Retirado" };

const CONFIG = {
  esfob: {
    title: "ESFOB / EFOB",
    eyebrow: "Formación bautismal",
    description: "Acompaña la preparación doctrinal antes del pacto del bautismo.",
    table: "esfob_procesos",
    leccionesTabla: "esfob_lecciones",
    progresoTabla: "esfob_progreso_leccion",
    progresoColumna: "esfob_proceso_id",
    notasTabla: "esfob_notas_leccion",
    notasColumna: "esfob_proceso_id",
    responsablePersonaCampo: "responsable_persona_id",
    responsableComiteCampo: "responsable_comite_id",
    defaultProgram: "ESFOB",
    activeState: "en_formacion",
    activeLabel: "En formación",
  },
  discipulado: {
    title: "Discipulado",
    eyebrow: "Formar para enviar",
    description: "Acompaña al nuevo bautizado en su maduración y preparación para servir.",
    table: "discipulado_procesos",
    leccionesTabla: "discipulado_lecciones",
    progresoTabla: "discipulado_progreso_leccion",
    progresoColumna: "discipulado_proceso_id",
    notasTabla: "discipulado_notas_leccion",
    notasColumna: "discipulado_proceso_id",
    responsablePersonaCampo: "mentor_persona_id",
    responsableComiteCampo: "mentor_comite_id",
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
  const [lecciones, setLecciones] = useState([]);
  const [comites, setComites] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [trasladoDestino, setTrasladoDestino] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [progreso, setProgreso] = useState([]);
  const [seguimientoForm, setSeguimientoForm] = useState({ servicio_actual: "", siguiente_accion: "", notas: "" });
  const [leccionParaAsignar, setLeccionParaAsignar] = useState("");
  const [notasLeccion, setNotasLeccion] = useState([]);
  const [nuevaNota, setNuevaNota] = useState("");
  const [nuevaNotaResponsable, setNuevaNotaResponsable] = useState("");

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
  const [trasladoComite, setTrasladoComite] = useState({});

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [processResult, peopleResult, friendsResult, estacionesResult, leccionesResult, comitesResult] = await Promise.all([
      supabase.from(config.table).select(`*, leccion_actual:${config.leccionesTabla}(numero, titulo), responsable_comite:comites!${config.table}_${config.responsableComiteCampo}_fkey(nombre)`).eq("congregacion_id", congregacionId).order("fecha_inicio", { ascending: false }),
      supabase.from("personas").select("id, nombres, apellidos, bautizado").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("amigos").select("id, nombres, zona_id, zonas(nombre)").eq("congregacion_id", congregacionId).eq("convertido", false).order("nombres"),
      supabase.from("ruta_estaciones").select("id, codigo, nombre, orden").eq("congregacion_id", congregacionId).order("orden"),
      supabase.from(config.leccionesTabla).select("id, numero, titulo, descripcion").eq("congregacion_id", congregacionId).eq("activo", true).order("numero"),
      getComitesActivos(congregacionId),
    ]);
    const failed = [processResult, peopleResult, friendsResult].find((result) => result.error);
    if (failed) setError(`No se pudo cargar ${config.title}. Intenta nuevamente o contacta al administrador.`);
    setRows(processResult.data ?? []);
    setPeople((peopleResult.data ?? []).filter((person) => mode === "esfob" || person.bautizado));
    setFriends(friendsResult.data ?? []);
    setEstaciones(estacionesResult.data ?? []);
    setLecciones(leccionesResult.data ?? []);
    setComites(comitesResult.data ?? []);
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
      responsableComiteId: form.responsibleId || null,
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
          responsable_comite_id: rutaResult.responsableComiteId || null,
          programa: form.program,
          lecciones_total: lecciones.length || 1,
          lecciones_completadas: 0,
          leccion_actual_id: lecciones[0]?.id || null,
          fecha_inicio: form.date,
          notas: form.notes || null,
        }
      : {
          congregacion_id: congregacionId,
          proceso_id: rutaResult.data.id,
          persona_id: form.subjectId,
          mentor_comite_id: rutaResult.responsableComiteId || null,
          programa: form.program,
          leccion_actual_id: lecciones[0]?.id || null,
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
    const nuevoComiteId = trasladoComite[row.id];
    const responsableActualPersonaId = row[config.responsablePersonaCampo];
    const responsableActualComiteId = row[config.responsableComiteCampo];
    const result = await trasladarEstacion({
      congregacionId,
      estacionOrigenCodigo: mode,
      estacionDestino: destino,
      amigoId: mode === "esfob" ? row.amigo_id : null,
      personaId: mode === "discipulado" ? row.persona_id : null,
      responsablePersonaId: nuevoComiteId ? null : responsableActualPersonaId,
      responsableComiteId: nuevoComiteId || responsableActualComiteId || null,
    });
    setSaving(false);
    if (result.error) { setError(`No se pudo trasladar: ${result.error.message}`); return; }
    setNotice(result.avisoRefam ? `Trasladado a ${destino.nombre} -- ve a REFAM y agrégala a un grupo para que aparezca en su lista.` : `Trasladado a ${destino.nombre}.`);
    load();
  }

  async function marcarBautizado(row) {
    if (!canEdit || mode !== "esfob") return;
    setSaving(true);
    setError(null);
    const fecha = TODAY;
    const amigoResult = await supabase
      .from("amigos")
      .update({ estado_espiritual: "bautizado", convertido: true, bautizado: true, fecha_bautismo: fecha })
      .eq("id", row.amigo_id);
    if (amigoResult.error) { setSaving(false); setError(`No se pudo registrar el bautismo: ${amigoResult.error.message}`); return; }
    const procesoResult = await supabase.from("esfob_procesos").update({ estado: "aprobado", fecha_aprobacion: fecha }).eq("id", row.id);
    setSaving(false);
    if (procesoResult.error) { setError(`Se registró el bautismo, pero no se pudo cerrar el proceso de ESFOB: ${procesoResult.error.message}`); return; }
    setNotice("Bautismo registrado. Ahora incorpórala a Feligresía desde Amigos para poder iniciar su Discipulado.");
    load();
  }

  async function marcarLeccion(row) {
    if (!canEdit || !row.leccion_actual_id) return;
    setSaving(true);
    setError(null);
    const insertResult = await supabase.from(config.progresoTabla).insert({
      [config.progresoColumna]: row.id,
      leccion_id: row.leccion_actual_id,
      responsable_persona_id: row.responsable_persona_id || row.mentor_persona_id || null,
    });
    if (insertResult.error) { setSaving(false); setError(`No se pudo marcar la lección completada: ${insertResult.error.message}`); return; }
    const siguiente = lecciones.find((item) => item.numero === (row.leccion_actual?.numero || 0) + 1);
    const updatePayload = mode === "esfob"
      ? { leccion_actual_id: siguiente?.id || null, lecciones_completadas: Math.min(Number(row.lecciones_total || lecciones.length || 1), Number(row.lecciones_completadas || 0) + 1) }
      : { leccion_actual_id: siguiente?.id || null, lecciones_completadas: Number(row.lecciones_completadas || 0) + 1 };
    const updateResult = await supabase.from(config.table).update(updatePayload).eq("id", row.id);
    setSaving(false);
    if (updateResult.error) { setError(`Se registró la lección, pero no se pudo avanzar a la siguiente: ${updateResult.error.message}`); return; }
    setNotice(siguiente ? `Lección completada. Avanzó a la lección #${siguiente.numero}.` : `Lección completada. Terminó el currículo de ${config.title}.`);
    if (row.id === selectedId) refrescarProgreso(row.id);
    load();
  }

  async function refrescarProgreso(procesoId) {
    const { data } = await supabase
      .from(config.progresoTabla)
      .select(`id, fecha_completada, leccion:${config.leccionesTabla}(numero, titulo)`)
      .eq(config.progresoColumna, procesoId)
      .order("fecha_completada", { ascending: false });
    setProgreso(data ?? []);
  }

  async function refrescarNotas(procesoId) {
    const { data } = await supabase
      .from(config.notasTabla)
      .select(`id, nota, created_at, leccion:${config.leccionesTabla}(numero, titulo), responsable:personas(nombres, apellidos)`)
      .eq(config.notasColumna, procesoId)
      .order("created_at", { ascending: false });
    setNotasLeccion(data ?? []);
  }

  function seleccionarFicha(row) {
    setSelectedId(row.id);
    setSeguimientoForm({ servicio_actual: row.servicio_actual || "", siguiente_accion: row.siguiente_accion || "", notas: row.notas || "" });
    setLeccionParaAsignar("");
    setNuevaNota("");
    setNuevaNotaResponsable(row.responsable_persona_id || row.mentor_persona_id || "");
    refrescarProgreso(row.id);
    refrescarNotas(row.id);
  }

  async function agregarNota(event) {
    event.preventDefault();
    if (!canEdit || !selectedId || !nuevaNota.trim() || !seleccionado?.leccion_actual_id) return;
    setSaving(true);
    setError(null);
    const result = await supabase.from(config.notasTabla).insert({
      [config.notasColumna]: selectedId,
      leccion_id: seleccionado.leccion_actual_id,
      nota: nuevaNota.trim(),
      responsable_persona_id: nuevaNotaResponsable || null,
    });
    setSaving(false);
    if (result.error) { setError(`No se pudo guardar la nota: ${result.error.message}`); return; }
    setNuevaNota("");
    refrescarNotas(selectedId);
  }

  // Cubre el caso de procesos que se crearon cuando el catalogo de
  // lecciones aun estaba vacio (leccion_actual_id quedo en null para
  // siempre) -- deja elegir con cual lección seguir en vez de asumir
  // siempre la #1, por si el responsable ya cubrió contenido antes.
  async function asignarLeccion(row, leccionId) {
    if (!canEdit || !leccionId) return;
    setSaving(true);
    setError(null);
    const result = await supabase.from(config.table).update({ leccion_actual_id: leccionId }).eq("id", row.id);
    setSaving(false);
    if (result.error) { setError(`No se pudo asignar la lección: ${result.error.message}`); return; }
    setNotice("Lección asignada.");
    setLeccionParaAsignar("");
    load();
  }

  async function guardarSeguimiento(event) {
    event.preventDefault();
    if (!canEdit || !selectedId) return;
    setSaving(true);
    setError(null);
    const result = await supabase.from(config.table).update({
      servicio_actual: seguimientoForm.servicio_actual.trim() || null,
      siguiente_accion: seguimientoForm.siguiente_accion.trim() || null,
      notas: seguimientoForm.notas.trim() || null,
    }).eq("id", selectedId);
    setSaving(false);
    if (result.error) { setError(`No se pudo guardar el seguimiento: ${result.error.message}`); return; }
    setNotice("Seguimiento actualizado.");
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
  const seleccionado = filas.find((row) => row.id === selectedId);
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

  // Analitica de Discipulado: tendencia de inicios, distribucion por
  // estado y tasa de exito -- calculadas sobre `rows`, que ya trae TODO
  // el historico (no solo los activos), sin necesidad de otra consulta.
  const discipuladoStats = useMemo(() => {
    if (mode !== "discipulado") return null;
    const porMes = new Map();
    rows.forEach((row) => {
      const clave = row.fecha_inicio?.slice(0, 7);
      if (clave) porMes.set(clave, (porMes.get(clave) || 0) + 1);
    });
    const meses = [...porMes.keys()].sort();
    const trend = trendDataset(
      meses.map((mes) => new Date(`${mes}-01T00:00:00`).toLocaleDateString("es-CO", { month: "short", year: "2-digit" })),
      meses.map((mes) => porMes.get(mes)),
      { label: "Discipulados iniciados" }
    );
    const distribucion = distributionDataset(
      Object.entries(ESTADOS_DISCIPULADO).map(([key, label]) => ({ label, total: rows.filter((row) => row.estado === key).length })).filter((item) => item.total > 0),
      { datasetLabel: "Personas" }
    );
    const finalizados = rows.filter((row) => row.estado === "completado" || row.estado === "retirado");
    const tasaExito = finalizados.length ? Math.round((rows.filter((row) => row.estado === "completado").length / finalizados.length) * 100) : null;
    return { meses, trend, distribucion, tasaExito };
  }, [rows, mode]);
  const insightLecciones = mode === "discipulado" && lecciones.length
    ? `Currículo de Discipulado con ${lecciones.length} lección${lecciones.length === 1 ? "" : "es"} activa${lecciones.length === 1 ? "" : "s"}. ${totalLessons} completada${totalLessons === 1 ? "" : "s"} en total entre todas las personas.`
    : null;

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
        <label className="text-sm text-secondary flex items-center gap-1">{mode === "esfob" ? "Comité responsable" : "Comité mentor"}<InfoTip texto={`Qué comité local le va a dar seguimiento a esta persona en ${config.title} (por ejemplo, el comité que corresponda a su población). Es obligatorio para que siempre haya un comité encargado.`} /><select required className="input-field mt-1 w-full" value={form.responsibleId} onChange={(event) => updateForm("responsibleId", event.target.value)}><option value="">Selecciona un comité...</option>{comites.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <label className="text-sm text-secondary">Programa<input className="input-field mt-1" value={form.program} onChange={(event) => updateForm("program", event.target.value)} required /></label>
        <label className="text-sm text-secondary">Fecha de inicio<input type="date" className="input-field mt-1" value={form.date} onChange={(event) => updateForm("date", event.target.value)} required /></label>
        {mode === "discipulado" && <label className="text-sm text-secondary">Servicio actual<input className="input-field mt-1" value={form.service} onChange={(event) => updateForm("service", event.target.value)} placeholder="Ej. apoyo en evangelismo" /></label>}
        <p className="text-sm text-secondary md:col-span-2 bg-surface-1 rounded p-3">
          {lecciones.length
            ? `Empezará en la lección #1 (${lecciones[0].titulo}) de las ${lecciones.length} del catálogo. Se marcan completadas desde la lista de abajo.`
            : `Aún no hay catálogo de lecciones de ${config.title} configurado -- ve a Módulos y actividades para crearlo. El proceso igual se puede iniciar.`}
        </p>
        <label className="text-sm text-secondary md:col-span-2">Notas<textarea className="input-field mt-1 min-h-20" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} /></label>
        <div className="md:col-span-2 flex justify-end"><button className="btn-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar proceso"}</button></div>
      </form>}
      <section className={mode === "discipulado" ? "grid sm:grid-cols-3 lg:grid-cols-6 gap-3" : "grid sm:grid-cols-4 gap-3"}>
        <Metric label={config.activeLabel} value={active} />
        <Metric label="Completados" value={completed} tone="text-success" />
        {mode === "discipulado" && <Metric label="Personas acompañadas" value={rows.length} />}
        <Metric label="Lecciones completadas" value={totalLessons} />
        <Metric label={mode === "esfob" ? "Candidatos a trasladar" : "Requieren seguimiento"} value={candidatos.length} tone="text-warning" tip={mode === "esfob" ? "Personas que ya completaron todas las lecciones del catálogo -- revisa si están listas para el bautismo." : `Personas que llevan más de ${umbral} días en discipulado -- conviene revisar continuidad, mentoría y servicio actual.`} />
        {mode === "discipulado" && <Metric label="Tasa de éxito" value={discipuladoStats.tasaExito === null ? "—" : `${discipuladoStats.tasaExito}%`} tone={discipuladoStats.tasaExito !== null && discipuladoStats.tasaExito < 70 ? "text-danger" : "text-success"} tip="De los procesos ya finalizados (completados o retirados), qué porcentaje terminó como 'Completado'. Sin procesos finalizados todavía se muestra '—'." />}
      </section>
      <p className={`text-sm rounded p-3 ${candidatos.length ? "text-warning bg-warning-bg" : "text-secondary bg-surface-1"}`}>{insight}</p>
      {insightLecciones && <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightLecciones}</p>}
      {mode === "esfob" && <section className="card chart-card p-5">
        <p className="eyebrow">Cobertura territorial</p>
        <h2 className="font-medium mt-1">Personas en ESFOB por zona</h2>
        <div className="h-56 mt-4">{zonaRows.length ? <Bar data={distributionDataset(zonaRows, { labelKey: "nombre", valueKey: "total", datasetLabel: "Personas" })} options={CHART_OPTIONS} /> : <p className="text-sm text-muted py-10 text-center">Aún no hay datos.</p>}</div>
      </section>}
      {mode === "discipulado" && <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">Historial</p>
          <h2 className="font-medium mt-1">Discipulados iniciados por mes</h2>
          <div className="h-56 mt-4">{discipuladoStats.meses.length ? <Line data={discipuladoStats.trend} options={CHART_OPTIONS} /> : <ChartEmpty message="Aún no hay procesos registrados." />}</div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">Estado actual</p>
          <h2 className="font-medium mt-1">Personas por estado</h2>
          <div className="h-56 mt-4">{rows.length ? <Bar data={discipuladoStats.distribucion} options={CHART_OPTIONS} /> : <ChartEmpty message="Aún no hay procesos registrados." />}</div>
        </div>
      </section>}
      <section className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
          <div className="card p-5">
            <div className="flex items-start gap-3 pb-4 border-b border-border"><span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center"><BookOpen className="w-4 h-4" /></span><div><p className="eyebrow">Seguimiento operativo</p><h2 className="font-medium mt-1 flex items-center gap-1.5">Procesos activos<InfoTip texto={mode === "esfob" ? "Elige una persona para ver su ficha: ahí se marca su lección actual, se ve el historial, se registran notas, y puedes trasladarla o marcarla bautizada." : "Elige una persona para ver su ficha: ahí se marca su lección actual, se ve el historial de lecciones y se registra su seguimiento (servicio, próxima acción, notas)."} /></h2></div></div>
            {filas.length === 0 ? <p className="text-sm text-secondary py-6">Aún no hay procesos activos.</p> : <div className="divide-y divide-border">{filas.map((row) => { const responsible = findName(row.responsable_persona_id || row.mentor_persona_id); const responsibleComite = row.responsable_comite; return (
              <button key={row.id} type="button" onClick={() => seleccionarFicha(row)} className={`w-full text-left py-4 flex flex-col gap-1 ${selectedId === row.id ? "bg-accent-bg/40 -mx-5 px-5" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{row.person?.nombres} {row.person?.apellidos || ""}</p>
                  {row.listo && <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded-full bg-warning-bg text-warning whitespace-nowrap">{mode === "esfob" ? "Listo para trasladar" : "Revisar continuidad"}</span>}
                </div>
                <p className="text-xs text-secondary">{row.programa} · {row.dias ?? 0} días{responsibleComite ? ` · ${mode === "esfob" ? "Responsable" : "Mentor"}: Comité ${responsibleComite.nombre}` : responsible ? ` · ${mode === "esfob" ? "Responsable" : "Mentor"}: ${responsible.nombres} ${responsible.apellidos}` : ""}</p>
                <p className="text-xs text-secondary">{row.leccion_actual ? `Lección #${row.leccion_actual.numero} — ${row.leccion_actual.titulo}` : lecciones.length ? "Sin lección asignada" : "Sin catálogo de lecciones"} · {row.lecciones_completadas || 0} completada{row.lecciones_completadas === 1 ? "" : "s"}</p>
              </button>
            ); })}</div>}
          </div>
          <div className="card p-5">
            {selectedId && seleccionado ? (
              <>
                <p className="eyebrow">Ficha de seguimiento</p>
                <h2 className="font-medium mt-1">{seleccionado.person?.nombres} {seleccionado.person?.apellidos || ""}</h2>
                <div className="mt-3 p-3 bg-surface-1 rounded">
                  {seleccionado.leccion_actual_id ? (
                    <>
                      <p className="text-sm font-medium">Lección #{seleccionado.leccion_actual?.numero} — {seleccionado.leccion_actual?.titulo}</p>
                      <p className="text-xs text-secondary mt-1">{seleccionado.lecciones_completadas || 0} lección{seleccionado.lecciones_completadas === 1 ? "" : "es"} completada{seleccionado.lecciones_completadas === 1 ? "" : "s"}</p>
                      {canEdit && <button type="button" onClick={() => marcarLeccion(seleccionado)} disabled={saving} className="btn-secondary px-2 py-1 text-xs mt-2">Marcar lección completada</button>}
                    </>
                  ) : lecciones.length ? (
                    <>
                      <p className="text-sm font-medium">Sin lección asignada</p>
                      <p className="text-xs text-secondary mt-1">{seleccionado.lecciones_completadas || 0} lección{seleccionado.lecciones_completadas === 1 ? "" : "es"} completada{seleccionado.lecciones_completadas === 1 ? "" : "s"} antes. Elige con cuál sigue:</p>
                      {canEdit && <div className="flex items-center gap-2 mt-2">
                        <select aria-label="Asignar lección" className="input-field text-xs flex-1" value={leccionParaAsignar} onChange={(event) => setLeccionParaAsignar(event.target.value)}>
                          <option value="">Selecciona una lección...</option>
                          {lecciones.map((item) => <option key={item.id} value={item.id}>#{item.numero} — {item.titulo}</option>)}
                        </select>
                        <button type="button" onClick={() => asignarLeccion(seleccionado, leccionParaAsignar)} disabled={saving || !leccionParaAsignar} className="btn-primary px-3 text-xs whitespace-nowrap">Asignar</button>
                      </div>}
                    </>
                  ) : (
                    <p className="text-sm text-secondary">Aún no hay catálogo de lecciones -- créalo desde Módulos y actividades.</p>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2">Historial de lecciones</p>
                  {progreso.length ? <ul className="flex flex-col gap-1.5">{progreso.map((item) => <li key={item.id} className="text-xs text-secondary">#{item.leccion?.numero} — {item.leccion?.titulo} <span className="text-muted">· {item.fecha_completada}</span></li>)}</ul> : <p className="text-xs text-muted">Aún no hay lecciones completadas.</p>}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2 flex items-center gap-1">Bitácora de la lección actual<InfoTip texto="Cada nota queda guardada con su autor y fecha, sin borrar las anteriores -- útil si cambia el responsable o si varias personas acompañan a la vez." /></p>
                  {canEdit && (seleccionado.leccion_actual_id ? (
                    <form onSubmit={agregarNota} className="flex flex-col gap-2 mb-3">
                      <textarea className="input-field text-sm min-h-16" placeholder="Ej. Le costó el tema de hoy, repasar la próxima vez..." value={nuevaNota} onChange={(event) => setNuevaNota(event.target.value)} />
                      <div className="flex items-center gap-2">
                        <select aria-label="Quién anota" className="input-field text-xs flex-1" value={nuevaNotaResponsable} onChange={(event) => setNuevaNotaResponsable(event.target.value)}>
                          <option value="">Sin autor</option>
                          {people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}
                        </select>
                        <button type="submit" disabled={saving || !nuevaNota.trim()} className="btn-secondary px-3 text-xs whitespace-nowrap">Agregar nota</button>
                      </div>
                    </form>
                  ) : <p className="text-xs text-muted mb-3">Asigna una lección arriba para poder anotar.</p>)}
                  {notasLeccion.length ? <ul className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">{notasLeccion.map((item) => (
                    <li key={item.id} className="text-xs bg-surface-1 rounded p-2.5">
                      <p className="text-secondary">{item.nota}</p>
                      <p className="text-muted mt-1">#{item.leccion?.numero} — {item.leccion?.titulo} · {item.responsable ? `${item.responsable.nombres} ${item.responsable.apellidos}` : "Sin autor"} · {new Date(item.created_at).toLocaleDateString("es-CO")}</p>
                    </li>
                  ))}</ul> : <p className="text-xs text-muted">Aún no hay notas registradas.</p>}
                </div>
                {mode === "esfob" ? (
                  canEdit && <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                    {seleccionado.listo && <button type="button" onClick={() => marcarBautizado(seleccionado)} disabled={saving} className="btn-primary justify-center">Marcar bautizado</button>}
                    <div className="flex flex-wrap items-center gap-2">
                      <select aria-label="Trasladar a" className="input-field text-xs flex-1" value={trasladoDestino[seleccionado.id] || ""} onChange={(event) => setTrasladoDestino({ ...trasladoDestino, [seleccionado.id]: event.target.value })}><option value="">Trasladar a...</option>{estaciones.filter((item) => item.codigo !== mode && item.codigo !== "metodos" && DETALLE_ESTACION[item.codigo]?.requiere !== "persona").map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
                      <select aria-label="Reasignar a un comité (opcional)" title="Reasignar a un comité (opcional)" className="input-field text-xs w-40" value={trasladoComite[seleccionado.id] || ""} onChange={(event) => setTrasladoComite({ ...trasladoComite, [seleccionado.id]: event.target.value })}><option value="">Mantener responsable</option>{comites.map((item) => <option key={item.id} value={item.id}>Comité: {item.nombre}</option>)}</select>
                      <button type="button" aria-label="Confirmar traslado a otra estación" onClick={() => trasladar(seleccionado)} disabled={saving} className="btn-secondary px-3"><ArrowRightLeft className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={guardarSeguimiento} className="grid gap-3 mt-4 pt-4 border-t border-border">
                    <label className="text-sm">Servicio actual<input disabled={!canEdit} className="input-field mt-1.5" placeholder="Ej. apoyo en evangelismo" value={seguimientoForm.servicio_actual} onChange={(event) => setSeguimientoForm({ ...seguimientoForm, servicio_actual: event.target.value })} /></label>
                    <label className="text-sm">Próxima acción<input disabled={!canEdit} className="input-field mt-1.5" placeholder="Ej. presentarlo al líder de zona" value={seguimientoForm.siguiente_accion} onChange={(event) => setSeguimientoForm({ ...seguimientoForm, siguiente_accion: event.target.value })} /></label>
                    <label className="text-sm flex items-center gap-1">Notas generales<InfoTip texto="Un resumen general de la persona, distinto de la bitácora por lección de arriba -- este campo se sobreescribe cada vez que lo edites." /><textarea disabled={!canEdit} className="input-field mt-1.5 min-h-20 w-full" value={seguimientoForm.notas} onChange={(event) => setSeguimientoForm({ ...seguimientoForm, notas: event.target.value })} /></label>
                    {canEdit && <button disabled={saving} className="btn-primary justify-center">{saving ? "Guardando..." : "Guardar seguimiento"}</button>}
                  </form>
                )}
              </>
            ) : <div className="h-48 flex items-center justify-center text-sm text-muted border border-dashed border-border rounded">Selecciona una persona de la lista</div>}
          </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "text-ink", tip }) {
  return <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">{label}{tip && <InfoTip texto={tip} />}</p><p className={`text-2xl font-semibold mt-3 ${tone}`}>{value}</p></div>;
}
