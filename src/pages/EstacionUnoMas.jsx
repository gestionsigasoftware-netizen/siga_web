import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { ArrowLeft, ArrowRightLeft, Plus, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, distributionDataset } from "../lib/chartTheme";
import { UMBRAL_DIAS_ESTACION, diasDesde, getEstacion, getEstacionActivos, iniciarOMoverEstacion } from "../lib/rutaEvangelistica";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);
const CHART_OPTIONS = chartOptions();
const COMPROMISO_ESTADOS = { activo: "Activo", cumplido: "Cumplido", pausado: "Pausado", cerrado: "Cerrado" };
const UMBRAL = UMBRAL_DIAS_ESTACION.uno_mas;

export default function EstacionUnoMas() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [estacion, setEstacion] = useState(null);
  const [estaciones, setEstaciones] = useState([]);
  const [activos, setActivos] = useState([]);
  const [compromisos, setCompromisos] = useState({});
  const [amigosDisponibles, setAmigosDisponibles] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({ amigoId: "", responsableId: "" });
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [trasladoDestino, setTrasladoDestino] = useState({});
  const [compromisoForm, setCompromisoForm] = useState({ miembro_id: "", fecha_ultimo_contacto: "", estado: "activo", resultado: "", notas: "" });

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function load() {
    if (!congregacionId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const estacionResult = await getEstacion(congregacionId, "uno_mas");
    if (estacionResult.error || !estacionResult.data) { setError("No se encontró la estación Uno Más."); setLoading(false); return; }
    const [activosResult, amigosResult, personasResult, estacionesResult] = await Promise.all([
      getEstacionActivos(congregacionId, estacionResult.data.id),
      supabase.from("amigos").select("id, nombres, zona_id, zonas(nombre)").eq("congregacion_id", congregacionId).eq("convertido", false).order("nombres"),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("ruta_estaciones").select("id, codigo, nombre, orden").eq("congregacion_id", congregacionId).order("orden"),
    ]);
    if (activosResult.error || amigosResult.error || personasResult.error) { setError("No se pudo cargar la estación. Intenta nuevamente."); setLoading(false); return; }
    setEstacion(estacionResult.data);
    setActivos(activosResult.data ?? []);
    setAmigosDisponibles(amigosResult.data ?? []);
    setPersonas(personasResult.data ?? []);
    setEstaciones(estacionesResult.data ?? []);
    const procesoIds = (activosResult.data ?? []).map((row) => row.id);
    if (procesoIds.length) {
      const { data: compromisosData } = await supabase.from("uno_mas_compromisos").select("id, proceso_id, miembro_id, estado, fecha_ultimo_contacto, resultado, notas").in("proceso_id", procesoIds).order("created_at", { ascending: false });
      const mapa = {};
      (compromisosData ?? []).forEach((item) => { if (!mapa[item.proceso_id]) mapa[item.proceso_id] = item; });
      setCompromisos(mapa);
    } else {
      setCompromisos({});
    }
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
    compromiso: compromisos[row.id] || null,
  })), [activos, compromisos]);
  const candidatos = filas.filter((row) => (row.dias ?? 0) > UMBRAL || row.compromiso?.estado === "cumplido");
  const zonaRows = useMemo(() => {
    const conteo = new Map();
    filas.forEach((row) => {
      const nombre = row.amigos?.zonas?.nombre || "Sin zona";
      conteo.set(nombre, (conteo.get(nombre) || 0) + 1);
    });
    return [...conteo.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);
  }, [filas]);
  const promedioDias = filas.length ? Math.round(filas.reduce((sum, row) => sum + (row.dias || 0), 0) / filas.length) : 0;
  const insight = candidatos.length
    ? `${candidatos.length} amigo${candidatos.length === 1 ? "" : "s"} lleva${candidatos.length === 1 ? "" : "n"} más de ${UMBRAL} días o ya cumplió su compromiso -- revisa si están listos para pasar a BIS o REFAM.`
    : filas.length
      ? `${filas.length} amigo${filas.length === 1 ? "" : "s"} en Uno Más, con un promedio de ${promedioDias} días en la estación.`
      : "Aún no hay amigos activos en Uno Más. Agrega el primero desde el formulario.";

  async function agregar(event) {
    event.preventDefault();
    if (!canEdit || !form.amigoId || !form.responsableId || !estacion) return;
    setSaving(true);
    setError(null);
    const result = await iniciarOMoverEstacion({ congregacionId, estacionDestino: estacion, amigoId: form.amigoId, responsablePersonaId: form.responsableId || null });
    setSaving(false);
    if (result.error) { setError(`No se pudo agregar a Uno Más: ${result.error.message}`); return; }
    setNotice(result.moved ? "Amigo trasladado a Uno Más." : "Amigo agregado a Uno Más.");
    setForm({ amigoId: "", responsableId: "" });
    load();
  }

  async function trasladar(proceso) {
    if (!canEdit) return;
    const destinoId = trasladoDestino[proceso.id];
    const destino = estaciones.find((item) => item.id === destinoId);
    if (!destino) { setError("Selecciona a qué estación trasladar."); return; }
    setSaving(true);
    setError(null);
    const result = await iniciarOMoverEstacion({ congregacionId, estacionDestino: destino, amigoId: proceso.amigo_id, responsablePersonaId: proceso.responsable_persona_id });
    setSaving(false);
    if (result.error) { setError(`No se pudo trasladar: ${result.error.message}`); return; }
    setNotice(`Trasladado a ${destino.nombre}.`);
    load();
  }

  function seleccionar(proceso) {
    setSelectedId(proceso.id);
    const compromiso = compromisos[proceso.id];
    setCompromisoForm(compromiso ? {
      miembro_id: compromiso.miembro_id || "",
      fecha_ultimo_contacto: compromiso.fecha_ultimo_contacto || "",
      estado: compromiso.estado,
      resultado: compromiso.resultado || "",
      notas: compromiso.notas || "",
    } : { miembro_id: "", fecha_ultimo_contacto: "", estado: "activo", resultado: "", notas: "" });
  }

  async function guardarCompromiso(event) {
    event.preventDefault();
    if (!canEdit || !selectedId || !compromisoForm.miembro_id) return;
    setSaving(true);
    setError(null);
    const existente = compromisos[selectedId];
    const payload = {
      congregacion_id: congregacionId,
      proceso_id: selectedId,
      miembro_id: compromisoForm.miembro_id,
      fecha_ultimo_contacto: compromisoForm.fecha_ultimo_contacto || null,
      estado: compromisoForm.estado,
      resultado: compromisoForm.resultado.trim() || null,
      notas: compromisoForm.notas.trim() || null,
    };
    const result = existente
      ? await supabase.from("uno_mas_compromisos").update(payload).eq("id", existente.id)
      : await supabase.from("uno_mas_compromisos").insert(payload);
    setSaving(false);
    if (result.error) { setError(`No se pudo guardar el compromiso: ${result.error.message}`); return; }
    setNotice("Compromiso de Uno Más guardado.");
    load();
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando Uno Más...</div>;

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link to="/misiones-evangelismo" className="btn-secondary mb-4"><ArrowLeft className="w-4 h-4" />Volver a Misiones y Evangelismo</Link>
          <p className="eyebrow">Estación 2 de 6</p>
          <h1 className="section-title">Uno Más</h1>
          <p className="text-sm text-secondary mt-1">{estacion?.descripcion || "Sensibilización y tarea de todos."}</p>
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
      {canEdit && <form onSubmit={agregar} className="card p-5 grid sm:grid-cols-3 gap-3 items-end">
        <label className="text-sm sm:col-span-2">Amigo<select required className="input-field mt-1.5" value={form.amigoId} onChange={(event) => setForm({ ...form, amigoId: event.target.value })}><option value="">Selecciona un amigo</option>{amigosDisponibles.map((amigo) => <option key={amigo.id} value={amigo.id}>{amigo.nombres}{amigo.zonas?.nombre ? ` — ${amigo.zonas.nombre}` : ""}</option>)}</select></label>
        <label className="text-sm">Responsable<select required className="input-field mt-1.5" value={form.responsableId} onChange={(event) => setForm({ ...form, responsableId: event.target.value })}><option value="">Selecciona un responsable</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select></label>
        <button disabled={saving} className="btn-primary justify-center sm:col-span-3"><Plus className="w-4 h-4" />{saving ? "Guardando..." : "Agregar a Uno Más"}</button>
      </form>}
      <section className="grid lg:grid-cols-[1.3fr_0.7fr] gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">Cobertura territorial</p>
          <h2 className="font-medium mt-1">Amigos en Uno Más por zona</h2>
          <div className="h-56 mt-4">{zonaRows.length ? <Bar data={distributionDataset(zonaRows, { labelKey: "nombre", valueKey: "total", datasetLabel: "Amigos" })} options={CHART_OPTIONS} /> : <p className="text-sm text-muted py-10 text-center">Aún no hay datos.</p>}</div>
        </div>
        <div className="card p-5">
          <div className="flex items-start gap-3"><span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0"><UsersRound className="w-4 h-4" /></span><div><p className="eyebrow">Seguimiento</p><h2 className="font-medium mt-1">Compromisos de Uno Más</h2><p className="text-xs text-secondary mt-1">Cada creyente adopta en oración y contacto personal a un amigo.</p></div></div>
        </div>
      </section>
      <section className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-border"><div><p className="eyebrow">Tablero</p><h2 className="font-medium mt-1">Amigos activos en Uno Más</h2></div></div>
          {filas.length === 0 ? <p className="text-sm text-secondary py-6">Aún no hay amigos en esta estación.</p> : <div className="divide-y divide-border">{filas.map((row) => (
            <div key={row.id} className={`py-4 flex flex-col gap-2 ${selectedId === row.id ? "bg-accent-bg/40 -mx-5 px-5" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => seleccionar(row)} className="text-left"><p className="font-medium text-sm">{row.amigos?.nombres || "Sin nombre"}</p><p className="text-xs text-secondary mt-0.5">{row.amigos?.zonas?.nombre || "Sin zona"} · {row.dias ?? 0} días{row.compromiso ? ` · ${COMPROMISO_ESTADOS[row.compromiso.estado] || row.compromiso.estado}` : ""}</p></button>
                {(row.dias ?? 0) > UMBRAL || row.compromiso?.estado === "cumplido" ? <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded-full bg-warning-bg text-warning whitespace-nowrap">Listo para trasladar</span> : null}
              </div>
              {canEdit && <div className="flex items-center gap-2"><select aria-label="Trasladar a" className="input-field text-xs flex-1" value={trasladoDestino[row.id] || ""} onChange={(event) => setTrasladoDestino({ ...trasladoDestino, [row.id]: event.target.value })}><option value="">Trasladar a...</option>{estaciones.filter((item) => item.codigo !== "uno_mas" && item.codigo !== "metodos").map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><button type="button" aria-label="Confirmar traslado a otra estación" onClick={() => trasladar(row)} disabled={saving} className="btn-secondary px-3"><ArrowRightLeft className="w-3.5 h-3.5" /></button></div>}
            </div>
          ))}</div>}
        </div>
        <div className="card p-5">
          {selectedId ? <form onSubmit={guardarCompromiso} className="grid gap-3">
            <p className="eyebrow">Compromiso de Uno Más</p>
            <label className="text-sm">Miembro comprometido<select required disabled={!canEdit} className="input-field mt-1.5" value={compromisoForm.miembro_id} onChange={(event) => setCompromisoForm({ ...compromisoForm, miembro_id: event.target.value })}><option value="">Selecciona un miembro</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select></label>
            <label className="text-sm">Último contacto<input disabled={!canEdit} type="date" className="input-field mt-1.5" value={compromisoForm.fecha_ultimo_contacto} onChange={(event) => setCompromisoForm({ ...compromisoForm, fecha_ultimo_contacto: event.target.value })} /></label>
            <label className="text-sm">Estado<select disabled={!canEdit} className="input-field mt-1.5" value={compromisoForm.estado} onChange={(event) => setCompromisoForm({ ...compromisoForm, estado: event.target.value })}>{Object.entries(COMPROMISO_ESTADOS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="text-sm">Resultado<input disabled={!canEdit} className="input-field mt-1.5" value={compromisoForm.resultado} onChange={(event) => setCompromisoForm({ ...compromisoForm, resultado: event.target.value })} /></label>
            <label className="text-sm">Notas<textarea disabled={!canEdit} className="input-field mt-1.5 min-h-16" value={compromisoForm.notas} onChange={(event) => setCompromisoForm({ ...compromisoForm, notas: event.target.value })} /></label>
            {canEdit && <button disabled={saving} className="btn-primary justify-center">{saving ? "Guardando..." : "Guardar compromiso"}</button>}
          </form> : <p className="text-sm text-secondary">Selecciona un amigo de la lista para registrar su compromiso de Uno Más.</p>}
        </div>
      </section>
    </div>
  );
}
