import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { ArrowLeft, ArrowRightLeft, HeartHandshake, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, distributionDataset } from "../lib/chartTheme";
import { UMBRAL_DIAS_ESTACION, diasDesde, getEstacion, getEstacionActivos, iniciarOMoverEstacion } from "../lib/rutaEvangelistica";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);
const CHART_OPTIONS = chartOptions();
const UMBRAL = UMBRAL_DIAS_ESTACION.refam;

export default function EstacionRefam() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [estacion, setEstacion] = useState(null);
  const [estaciones, setEstaciones] = useState([]);
  const [activos, setActivos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [amigosDisponibles, setAmigosDisponibles] = useState([]);
  const [refamGrupos, setRefamGrupos] = useState([]);
  const [refamLecciones, setRefamLecciones] = useState([]);
  const [refamGrupoForm, setRefamGrupoForm] = useState({ nombre: "", zona_id: "", anfitrion_persona_id: "", lider_persona_id: "", direccion: "", dia_reunion: "" });
  const [selectedRefamGrupoId, setSelectedRefamGrupoId] = useState(null);
  const [refamParticipantes, setRefamParticipantes] = useState([]);
  const [refamReuniones, setRefamReuniones] = useState([]);
  const [asistenciaPorParticipante, setAsistenciaPorParticipante] = useState({});
  const [progresoPorParticipante, setProgresoPorParticipante] = useState({});
  const [refamParticipanteForm, setRefamParticipanteForm] = useState({ tipo: "amigo", sujeto_id: "", responsableId: "" });
  const [refamReunionForm, setRefamReunionForm] = useState({ fecha: new Date().toISOString().slice(0, 10), numero_leccion: "1", tema: "", asistentes: "0", visitantes: "0", resultado: "", novedades: "" });
  const [asistenciaRefamMarcada, setAsistenciaRefamMarcada] = useState({});
  const [trasladoDestino, setTrasladoDestino] = useState({});
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function load() {
    if (!congregacionId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const estacionResult = await getEstacion(congregacionId, "refam");
    if (estacionResult.error || !estacionResult.data) { setError("No se encontró la estación REFAM."); setLoading(false); return; }
    const [activosResult, zonasResult, personasResult, amigosResult, gruposResult, estacionesResult, leccionesResult] = await Promise.all([
      getEstacionActivos(congregacionId, estacionResult.data.id),
      supabase.from("zonas").select("id, nombre").eq("congregacion_id", congregacionId).order("nombre"),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("amigos").select("id, nombres, zona_id, zonas(nombre)").eq("congregacion_id", congregacionId).eq("convertido", false).order("nombres"),
      supabase.from("refam_grupos").select("id, nombre, direccion, dia_reunion, activo, zona_id, anfitrion_persona_id, lider_persona_id, zonas(nombre), anfitrion:anfitrion_persona_id(nombres, apellidos), lider:lider_persona_id(nombres, apellidos)").eq("congregacion_id", congregacionId).order("nombre"),
      supabase.from("ruta_estaciones").select("id, codigo, nombre, orden").eq("congregacion_id", congregacionId).order("orden"),
      supabase.from("refam_lecciones").select("id, numero, titulo, descripcion").eq("congregacion_id", congregacionId).eq("activo", true).order("numero"),
    ]);
    if (activosResult.error || zonasResult.error || personasResult.error || amigosResult.error || gruposResult.error) { setError("No se pudo cargar la estación REFAM."); setLoading(false); return; }
    setEstacion(estacionResult.data);
    setActivos(activosResult.data ?? []);
    setZonas(zonasResult.data ?? []);
    setPersonas(personasResult.data ?? []);
    setAmigosDisponibles(amigosResult.data ?? []);
    setRefamGrupos(gruposResult.data ?? []);
    setEstaciones(estacionesResult.data ?? []);
    setRefamLecciones(leccionesResult.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [congregacionId]);

  useEffect(() => {
    if (!congregacionId) return;
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "ruta_evangelistica.editar" }).then(({ data }) => {
      setCanEdit((rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura") || Boolean(data));
    });
  }, [congregacionId, rolPrincipal]);

  const filas = useMemo(() => activos.map((row) => ({
    ...row,
    dias: diasDesde(row.fecha_inicio),
    nombre: row.amigos?.nombres || (row.persona ? `${row.persona.nombres} ${row.persona.apellidos || ""}` : "Sin nombre"),
    zonaNombre: row.amigos?.zonas?.nombre || "Sin zona",
  })), [activos]);
  const candidatos = filas.filter((row) => (row.dias ?? 0) > UMBRAL);
  const zonaRows = useMemo(() => {
    const conteo = new Map();
    filas.forEach((row) => conteo.set(row.zonaNombre, (conteo.get(row.zonaNombre) || 0) + 1));
    return [...conteo.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);
  }, [filas]);
  const promedioDias = filas.length ? Math.round(filas.reduce((sum, row) => sum + (row.dias || 0), 0) / filas.length) : 0;
  const insight = candidatos.length
    ? `${candidatos.length} persona${candidatos.length === 1 ? "" : "s"} lleva${candidatos.length === 1 ? "" : "n"} más de ${UMBRAL} días en REFAM -- revisa si están listas para ESFOB.`
    : filas.length
      ? `${filas.length} persona${filas.length === 1 ? "" : "s"} en REFAM, con un promedio de ${promedioDias} días.`
      : "Aún no hay personas activas en REFAM.";

  async function createRefamGrupo(event) {
    event.preventDefault();
    if (!canEdit || !refamGrupoForm.nombre.trim()) return;
    setError(null);
    const result = await supabase.from("refam_grupos").insert({
      congregacion_id: congregacionId,
      nombre: refamGrupoForm.nombre.trim(),
      zona_id: refamGrupoForm.zona_id || null,
      anfitrion_persona_id: refamGrupoForm.anfitrion_persona_id || null,
      lider_persona_id: refamGrupoForm.lider_persona_id || null,
      direccion: refamGrupoForm.direccion.trim() || null,
      dia_reunion: refamGrupoForm.dia_reunion.trim() || null,
    });
    if (result.error) { setError(`No se pudo crear el grupo REFAM: ${result.error.message}`); return; }
    setNotice("Grupo REFAM creado.");
    setRefamGrupoForm({ nombre: "", zona_id: "", anfitrion_persona_id: "", lider_persona_id: "", direccion: "", dia_reunion: "" });
    load();
  }

  async function loadRefamGrupoDetail(grupoId) {
    setSelectedRefamGrupoId(grupoId);
    setRefamParticipantes([]);
    setRefamReuniones([]);
    if (!grupoId) return;
    const [participantesResult, reunionesResult] = await Promise.all([
      supabase.from("refam_participantes").select("id, amigo_id, persona_id, fecha_ingreso, estado, leccion_actual_id, amigos:amigo_id(nombres), personas:persona_id(nombres, apellidos), leccion_actual:refam_lecciones(numero, titulo)").eq("grupo_id", grupoId).order("fecha_ingreso", { ascending: false }),
      supabase.from("refam_reuniones").select("id, fecha, numero_leccion, tema, asistentes, visitantes, resultado, novedades").eq("grupo_id", grupoId).order("fecha", { ascending: false }),
    ]);
    const participantes = participantesResult.data ?? [];
    setRefamParticipantes(participantes);
    setRefamReuniones(reunionesResult.data ?? []);
    setAsistenciaRefamMarcada(Object.fromEntries(participantes.map((item) => [item.id, true])));
    if (participantes.length) {
      const [asistenciaResult, progresoResult] = await Promise.all([
        supabase.from("refam_asistencia_participante").select("participante_id, asistio").in("participante_id", participantes.map((item) => item.id)).eq("asistio", true),
        supabase.from("refam_progreso_leccion").select("participante_id").in("participante_id", participantes.map((item) => item.id)),
      ]);
      const conteo = {};
      (asistenciaResult.data ?? []).forEach((item) => { conteo[item.participante_id] = (conteo[item.participante_id] || 0) + 1; });
      setAsistenciaPorParticipante(conteo);
      const conteoProgreso = {};
      (progresoResult.data ?? []).forEach((item) => { conteoProgreso[item.participante_id] = (conteoProgreso[item.participante_id] || 0) + 1; });
      setProgresoPorParticipante(conteoProgreso);
    } else {
      setAsistenciaPorParticipante({});
      setProgresoPorParticipante({});
    }
  }

  async function marcarLeccionCompletada(participante) {
    if (!canEdit || !participante.leccion_actual_id) return;
    setSaving(true);
    setError(null);
    const grupo = refamGrupos.find((item) => item.id === selectedRefamGrupoId);
    const result = await supabase.from("refam_progreso_leccion").insert({
      participante_id: participante.id,
      leccion_id: participante.leccion_actual_id,
      responsable_persona_id: grupo?.lider_persona_id || null,
    });
    if (result.error) { setSaving(false); setError(`No se pudo marcar la lección completada: ${result.error.message}`); return; }
    const siguiente = refamLecciones.find((item) => item.numero === (participante.leccion_actual?.numero || 0) + 1);
    const updateResult = await supabase.from("refam_participantes").update({ leccion_actual_id: siguiente?.id || null }).eq("id", participante.id);
    setSaving(false);
    if (updateResult.error) { setError(`Se registró la lección, pero no se pudo avanzar a la siguiente: ${updateResult.error.message}`); return; }
    setNotice(siguiente ? `Lección completada. Avanzó a la lección #${siguiente.numero}.` : "Lección completada. Terminó el currículo de REFAM.");
    loadRefamGrupoDetail(selectedRefamGrupoId);
  }

  async function addRefamParticipante(event) {
    event.preventDefault();
    if (!canEdit || !selectedRefamGrupoId || !refamParticipanteForm.sujeto_id || !refamParticipanteForm.responsableId || !estacion) return;
    setError(null);
    setSaving(true);
    const payload = {
      congregacion_id: congregacionId,
      grupo_id: selectedRefamGrupoId,
      fecha_ingreso: new Date().toISOString().slice(0, 10),
      amigo_id: refamParticipanteForm.tipo === "amigo" ? refamParticipanteForm.sujeto_id : null,
      persona_id: refamParticipanteForm.tipo === "persona" ? refamParticipanteForm.sujeto_id : null,
      leccion_actual_id: refamLecciones[0]?.id || null,
    };
    const result = await supabase.from("refam_participantes").insert(payload);
    if (result.error) { setSaving(false); setError(`No se pudo agregar el participante: ${result.error.message}`); return; }
    // Sincroniza con la ruta evangelistica -- sin esto, la persona queda en el
    // grupo REFAM pero el sistema (y funnel_refam en el BI distrital) no
    // refleja que esta activa en esta estacion.
    const rutaResult = await iniciarOMoverEstacion({
      congregacionId,
      estacionDestino: estacion,
      amigoId: payload.amigo_id,
      personaId: payload.persona_id,
      responsablePersonaId: refamParticipanteForm.responsableId,
    });
    setSaving(false);
    if (rutaResult.error) { setError(`El participante se agregó al grupo, pero no se pudo sincronizar con la Ruta Evangelística: ${rutaResult.error.message}`); }
    else setNotice("Participante agregado al grupo y activo en la estación REFAM.");
    setRefamParticipanteForm({ tipo: "amigo", sujeto_id: "", responsableId: "" });
    loadRefamGrupoDetail(selectedRefamGrupoId);
    load();
  }

  async function addRefamReunion(event) {
    event.preventDefault();
    if (!canEdit || !selectedRefamGrupoId) return;
    setError(null);
    const result = await supabase.from("refam_reuniones").insert({
      congregacion_id: congregacionId,
      grupo_id: selectedRefamGrupoId,
      fecha: refamReunionForm.fecha,
      numero_leccion: Number(refamReunionForm.numero_leccion) || 1,
      tema: refamReunionForm.tema.trim() || null,
      asistentes: Number(refamReunionForm.asistentes) || 0,
      visitantes: Number(refamReunionForm.visitantes) || 0,
      resultado: refamReunionForm.resultado.trim() || null,
      novedades: refamReunionForm.novedades.trim() || null,
    }).select("id").single();
    if (result.error) { setError(`No se pudo registrar la reunión: ${result.error.message}`); return; }
    if (refamParticipantes.length) {
      const asistenciaPayload = refamParticipantes.map((item) => ({
        reunion_id: result.data.id,
        participante_id: item.id,
        asistio: Boolean(asistenciaRefamMarcada[item.id]),
      }));
      const asistenciaResult = await supabase.from("refam_asistencia_participante").insert(asistenciaPayload);
      if (asistenciaResult.error) { setError(`La reunión se registró, pero no se pudo guardar la asistencia individual: ${asistenciaResult.error.message}`); loadRefamGrupoDetail(selectedRefamGrupoId); return; }
    }
    setNotice("Reunión REFAM registrada.");
    setRefamReunionForm({ fecha: new Date().toISOString().slice(0, 10), numero_leccion: "1", tema: "", asistentes: "0", visitantes: "0", resultado: "", novedades: "" });
    loadRefamGrupoDetail(selectedRefamGrupoId);
  }

  async function trasladar(proceso) {
    if (!canEdit) return;
    const destinoId = trasladoDestino[proceso.id];
    const destino = estaciones.find((item) => item.id === destinoId);
    if (!destino) { setError("Selecciona a qué estación trasladar."); return; }
    setSaving(true);
    setError(null);
    const result = await iniciarOMoverEstacion({ congregacionId, estacionDestino: destino, amigoId: proceso.amigo_id, personaId: proceso.persona_id, responsablePersonaId: proceso.responsable_persona_id });
    if (!result.error && proceso.amigo_id) {
      await supabase.from("refam_participantes").update({ estado: "completado" }).eq("amigo_id", proceso.amigo_id).eq("estado", "activo");
    } else if (!result.error && proceso.persona_id) {
      await supabase.from("refam_participantes").update({ estado: "completado" }).eq("persona_id", proceso.persona_id).eq("estado", "activo");
    }
    setSaving(false);
    if (result.error) { setError(`No se pudo trasladar: ${result.error.message}`); return; }
    setNotice(`Trasladado a ${destino.nombre}.`);
    load();
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando REFAM...</div>;

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link to="/misiones-evangelismo" className="btn-secondary mb-4"><ArrowLeft className="w-4 h-4" />Volver a Misiones y Evangelismo</Link>
          <p className="eyebrow">Estación 4 de 6</p>
          <h1 className="section-title">REFAM</h1>
          <p className="text-sm text-secondary mt-1">{estacion?.descripcion || "Evangelismo en los hogares mediante lecciones."}</p>
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}
      <section className="grid sm:grid-cols-3 gap-3">
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Activos</p><p className="text-2xl font-semibold mt-3">{filas.length}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Candidatos a trasladar</p><p className="text-2xl font-semibold mt-3 text-warning">{candidatos.length}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Promedio de días</p><p className="text-2xl font-semibold mt-3">{promedioDias}</p></div>
      </section>
      <p className={`text-sm rounded p-3 ${candidatos.length ? "text-warning bg-warning-bg" : "text-secondary bg-surface-1"}`}>{insight}</p>
      <section className="card chart-card p-5">
        <p className="eyebrow">Cobertura territorial</p>
        <h2 className="font-medium mt-1">Personas en REFAM por zona</h2>
        <div className="h-56 mt-4">{zonaRows.length ? <Bar data={distributionDataset(zonaRows, { labelKey: "nombre", valueKey: "total", datasetLabel: "Personas" })} options={CHART_OPTIONS} /> : <p className="text-sm text-muted py-10 text-center">Aún no hay datos.</p>}</div>
      </section>
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-border"><div><p className="eyebrow">Tablero</p><h2 className="font-medium mt-1">Personas activas en REFAM</h2></div></div>
        {filas.length === 0 ? <p className="text-sm text-secondary py-6">Aún no hay personas en esta estación.</p> : <div className="divide-y divide-border">{filas.map((row) => (
          <div key={row.id} className="py-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-medium text-sm">{row.nombre}</p><p className="text-xs text-secondary mt-0.5">{row.zonaNombre} · {row.dias ?? 0} días</p></div>
              {(row.dias ?? 0) > UMBRAL && <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded-full bg-warning-bg text-warning whitespace-nowrap">Listo para trasladar</span>}
            </div>
            {canEdit && <div className="flex items-center gap-2"><select aria-label="Trasladar a" className="input-field text-xs flex-1" value={trasladoDestino[row.id] || ""} onChange={(event) => setTrasladoDestino({ ...trasladoDestino, [row.id]: event.target.value })}><option value="">Trasladar a...</option>{estaciones.filter((item) => item.codigo !== "refam" && item.codigo !== "metodos").map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><button type="button" aria-label="Confirmar traslado a otra estación" onClick={() => trasladar(row)} disabled={saving} className="btn-secondary px-3"><ArrowRightLeft className="w-3.5 h-3.5" /></button></div>}
          </div>
        ))}</div>}
      </section>
      <section className="card p-5">
        <div className="mb-4 flex items-start gap-3"><span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0"><HeartHandshake className="w-4 h-4" /></span><div><p className="eyebrow">Metodología</p><h2 className="font-medium mt-1">Grupos, participantes y reuniones</h2><p className="text-xs text-secondary mt-1">Reunión Familiar y de Amistad. No sustituye a Red de Familias.</p></div></div>
        {canEdit && <form onSubmit={createRefamGrupo} className="grid md:grid-cols-3 gap-3 mb-5">
          <label className="text-sm">Nombre del grupo<input required className="input-field mt-1.5" value={refamGrupoForm.nombre} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, nombre: event.target.value })} /></label>
          <label className="text-sm">Zona<select className="input-field mt-1.5" value={refamGrupoForm.zona_id} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, zona_id: event.target.value })}><option value="">Sin zona</option>{zonas.map((zona) => <option key={zona.id} value={zona.id}>{zona.nombre}</option>)}</select></label>
          <label className="text-sm">Día de reunión<input className="input-field mt-1.5" placeholder="Ej. Martes" value={refamGrupoForm.dia_reunion} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, dia_reunion: event.target.value })} /></label>
          <label className="text-sm">Anfitrión<select className="input-field mt-1.5" value={refamGrupoForm.anfitrion_persona_id} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, anfitrion_persona_id: event.target.value })}><option value="">Sin anfitrión</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select></label>
          <label className="text-sm">Líder<select className="input-field mt-1.5" value={refamGrupoForm.lider_persona_id} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, lider_persona_id: event.target.value })}><option value="">Sin líder</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select></label>
          <label className="text-sm">Dirección<input className="input-field mt-1.5" value={refamGrupoForm.direccion} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, direccion: event.target.value })} /></label>
          <div className="md:col-span-3 flex justify-end"><button className="btn-primary"><Plus className="w-4 h-4" />Crear grupo REFAM</button></div>
        </form>}
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
          <div className="flex flex-col gap-2">{refamGrupos.map((grupo) => <button type="button" key={grupo.id} onClick={() => loadRefamGrupoDetail(grupo.id)} className={`text-left border rounded-card p-3 ${selectedRefamGrupoId === grupo.id ? "border-accent bg-accent-bg" : "border-border"}`}><p className="text-sm font-medium">{grupo.nombre}</p><p className="text-xs text-secondary mt-1">{grupo.zonas?.nombre || "Sin zona"}{grupo.dia_reunion ? ` · ${grupo.dia_reunion}` : ""}</p>{grupo.lider && <p className="text-xs text-muted mt-1">Líder: {grupo.lider.nombres} {grupo.lider.apellidos}</p>}</button>)}{refamGrupos.length === 0 && <p className="text-sm text-muted">Aún no hay grupos REFAM.</p>}</div>
          <div>
            {selectedRefamGrupoId ? <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Participantes</h3>
                {canEdit && <form onSubmit={addRefamParticipante} className="flex flex-wrap gap-2 mb-2"><select aria-label="Tipo de participante" className="input-field" value={refamParticipanteForm.tipo} onChange={(event) => setRefamParticipanteForm({ ...refamParticipanteForm, tipo: event.target.value, sujeto_id: "" })}><option value="amigo">Amigo</option><option value="persona">Persona</option></select><select aria-label="Participante" required className="input-field flex-1" value={refamParticipanteForm.sujeto_id} onChange={(event) => setRefamParticipanteForm({ ...refamParticipanteForm, sujeto_id: event.target.value })}><option value="">Selecciona...</option>{(refamParticipanteForm.tipo === "amigo" ? amigosDisponibles : personas).map((item) => <option key={item.id} value={item.id}>{item.nombres} {item.apellidos || ""}</option>)}</select><select aria-label="Responsable del participante" required className="input-field flex-1" value={refamParticipanteForm.responsableId} onChange={(event) => setRefamParticipanteForm({ ...refamParticipanteForm, responsableId: event.target.value })}><option value="">Responsable...</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select><button aria-label="Agregar participante" disabled={saving} className="btn-secondary px-3"><Plus className="w-4 h-4" /></button></form>}
                {refamParticipantes.length ? <div className="divide-y divide-border">{refamParticipantes.map((item) => <div key={item.id} className="py-2 text-sm flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate">{item.personas ? `${item.personas.nombres} ${item.personas.apellidos}` : item.amigos?.nombres || "Sin nombre"} <span className="text-xs text-muted">· {item.estado}</span></p>
                    <p className="text-xs text-muted">{item.leccion_actual ? `Lección #${item.leccion_actual.numero} — ${item.leccion_actual.titulo}` : refamLecciones.length ? "Currículo completado" : "Sin catálogo de lecciones configurado"} · {progresoPorParticipante[item.id] || 0}/{refamLecciones.length} completadas · {asistenciaPorParticipante[item.id] || 0} reuniones</p>
                  </div>
                  {canEdit && item.leccion_actual_id && <button type="button" onClick={() => marcarLeccionCompletada(item)} disabled={saving} className="btn-secondary px-2 py-1 text-xs whitespace-nowrap">Marcar completada</button>}
                </div>)}</div> : <p className="text-xs text-muted">Sin participantes aún.</p>}
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Reuniones</h3>
                {canEdit && <form onSubmit={addRefamReunion} className="grid grid-cols-2 gap-2 mb-2">
                  <input required type="date" className="input-field" value={refamReunionForm.fecha} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, fecha: event.target.value })} />
                  <input type="number" min="1" className="input-field" placeholder="N.° lección" value={refamReunionForm.numero_leccion} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, numero_leccion: event.target.value })} />
                  <input className="input-field col-span-2" placeholder="Tema" value={refamReunionForm.tema} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, tema: event.target.value })} />
                  <input type="number" min="0" className="input-field" placeholder="Asistentes" value={refamReunionForm.asistentes} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, asistentes: event.target.value })} />
                  <input type="number" min="0" className="input-field" placeholder="Visitantes" value={refamReunionForm.visitantes} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, visitantes: event.target.value })} />
                  <input className="input-field col-span-2" placeholder="Resultado" value={refamReunionForm.resultado} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, resultado: event.target.value })} />
                  {refamParticipantes.length > 0 && <div className="col-span-2 border border-border rounded-card p-2"><p className="text-xs font-medium mb-1.5">Asistencia individual (estudio entregado)</p>{refamParticipantes.map((item) => <label key={item.id} className="flex items-center gap-2 text-xs py-0.5"><input type="checkbox" checked={Boolean(asistenciaRefamMarcada[item.id])} onChange={(event) => setAsistenciaRefamMarcada({ ...asistenciaRefamMarcada, [item.id]: event.target.checked })} />{item.personas ? `${item.personas.nombres} ${item.personas.apellidos}` : item.amigos?.nombres || "Sin nombre"}</label>)}</div>}
                  <button className="btn-secondary col-span-2 justify-center">Registrar reunión</button>
                </form>}
                {refamReuniones.length ? <div className="divide-y divide-border">{refamReuniones.map((item) => <div key={item.id} className="py-1.5 text-sm">{item.fecha} · Lección {item.numero_leccion} · {item.asistentes} asistentes{item.visitantes ? ` (${item.visitantes} visitantes)` : ""}</div>)}</div> : <p className="text-xs text-muted">Sin reuniones registradas.</p>}
              </div>
            </div> : <p className="text-sm text-muted">Selecciona un grupo para ver sus participantes y reuniones.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
