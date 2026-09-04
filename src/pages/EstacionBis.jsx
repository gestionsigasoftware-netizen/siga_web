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
const UMBRAL = UMBRAL_DIAS_ESTACION.bis;

export default function EstacionBis() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [estacion, setEstacion] = useState(null);
  const [estaciones, setEstaciones] = useState([]);
  const [activos, setActivos] = useState([]);
  const [atencionesPorProceso, setAtencionesPorProceso] = useState({});
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
  const [atencionForm, setAtencionForm] = useState({ responsable_persona_id: "", fecha_visita: new Date().toISOString().slice(0, 10), primera_visita: true, recibimiento: "", necesidad_inmediata: "", contacto_posterior: "", resultado_contacto: "", integrado: false, derivado_a: "", notas: "" });

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function load() {
    if (!congregacionId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const estacionResult = await getEstacion(congregacionId, "bis");
    if (estacionResult.error || !estacionResult.data) { setError("No se encontró la estación BIS."); setLoading(false); return; }
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
      const { data: atencionesData } = await supabase.from("bis_atenciones").select("id, proceso_id, fecha_visita, primera_visita, recibimiento, necesidad_inmediata, contacto_posterior, resultado_contacto, integrado, derivado_a, notas, responsable_persona_id").in("proceso_id", procesoIds).order("fecha_visita", { ascending: false });
      const mapa = {};
      (atencionesData ?? []).forEach((item) => { if (!mapa[item.proceso_id]) mapa[item.proceso_id] = []; mapa[item.proceso_id].push(item); });
      setAtencionesPorProceso(mapa);
    } else {
      setAtencionesPorProceso({});
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

  const filas = useMemo(() => activos.map((row) => {
    const atenciones = atencionesPorProceso[row.id] || [];
    return { ...row, dias: diasDesde(row.fecha_inicio), atenciones, integrado: atenciones.some((item) => item.integrado) };
  }), [activos, atencionesPorProceso]);
  const candidatos = filas.filter((row) => (row.dias ?? 0) > UMBRAL || row.integrado);
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
    ? `${candidatos.length} amigo${candidatos.length === 1 ? "" : "s"} ya está${candidatos.length === 1 ? "" : "n"} integrado${candidatos.length === 1 ? "" : "s"} o lleva${candidatos.length === 1 ? "" : "n"} más de ${UMBRAL} días -- revisa si están listos para REFAM o el siguiente paso.`
    : filas.length
      ? `${filas.length} amigo${filas.length === 1 ? "" : "s"} en BIS, con un promedio de ${promedioDias} días.`
      : "Aún no hay amigos activos en BIS.";

  async function agregar(event) {
    event.preventDefault();
    if (!canEdit || !form.amigoId || !form.responsableId || !estacion) return;
    setSaving(true);
    setError(null);
    const result = await iniciarOMoverEstacion({ congregacionId, estacionDestino: estacion, amigoId: form.amigoId, responsablePersonaId: form.responsableId || null });
    setSaving(false);
    if (result.error) { setError(`No se pudo agregar a BIS: ${result.error.message}`); return; }
    setNotice(result.moved ? "Amigo trasladado a BIS." : "Amigo agregado a BIS.");
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
    setAtencionForm({ responsable_persona_id: "", fecha_visita: new Date().toISOString().slice(0, 10), primera_visita: (atencionesPorProceso[proceso.id] || []).length === 0, recibimiento: "", necesidad_inmediata: "", contacto_posterior: "", resultado_contacto: "", integrado: false, derivado_a: "", notas: "" });
  }

  async function guardarAtencion(event) {
    event.preventDefault();
    if (!canEdit || !selectedId) return;
    const proceso = filas.find((row) => row.id === selectedId);
    if (!proceso?.amigo_id) return;
    setSaving(true);
    setError(null);
    const payload = {
      congregacion_id: congregacionId,
      proceso_id: selectedId,
      amigo_id: proceso.amigo_id,
      responsable_persona_id: atencionForm.responsable_persona_id || null,
      fecha_visita: atencionForm.fecha_visita || new Date().toISOString().slice(0, 10),
      primera_visita: atencionForm.primera_visita,
      recibimiento: atencionForm.recibimiento.trim() || null,
      necesidad_inmediata: atencionForm.necesidad_inmediata.trim() || null,
      contacto_posterior: atencionForm.contacto_posterior || null,
      resultado_contacto: atencionForm.resultado_contacto.trim() || null,
      integrado: atencionForm.integrado,
      derivado_a: atencionForm.derivado_a.trim() || null,
      notas: atencionForm.notas.trim() || null,
    };
    const result = await supabase.from("bis_atenciones").insert(payload);
    setSaving(false);
    if (result.error) { setError(`No se pudo registrar la atención: ${result.error.message}`); return; }
    setNotice("Atención BIS registrada.");
    load();
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando BIS...</div>;
  const seleccionado = filas.find((row) => row.id === selectedId);

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link to="/misiones-evangelismo" className="btn-secondary mb-4"><ArrowLeft className="w-4 h-4" />Volver a Misiones y Evangelismo</Link>
          <p className="eyebrow">Estación 3 de 6</p>
          <h1 className="section-title">BIS</h1>
          <p className="text-sm text-secondary mt-1">{estacion?.descripcion || "Bienvenida, integración y seguimiento."}</p>
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
        <button disabled={saving} className="btn-primary justify-center sm:col-span-3"><Plus className="w-4 h-4" />{saving ? "Guardando..." : "Agregar a BIS"}</button>
      </form>}
      <section className="grid lg:grid-cols-[1.3fr_0.7fr] gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">Cobertura territorial</p>
          <h2 className="font-medium mt-1">Amigos en BIS por zona</h2>
          <div className="h-56 mt-4">{zonaRows.length ? <Bar data={distributionDataset(zonaRows, { labelKey: "nombre", valueKey: "total", datasetLabel: "Amigos" })} options={CHART_OPTIONS} /> : <p className="text-sm text-muted py-10 text-center">Aún no hay datos.</p>}</div>
        </div>
        <div className="card p-5">
          <div className="flex items-start gap-3"><span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0"><UsersRound className="w-4 h-4" /></span><div><p className="eyebrow">Seguimiento</p><h2 className="font-medium mt-1">Atenciones BIS</h2><p className="text-xs text-secondary mt-1">Bienvenida, contacto posterior e integración de cada amigo.</p></div></div>
        </div>
      </section>
      <section className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-border"><div><p className="eyebrow">Tablero</p><h2 className="font-medium mt-1">Amigos activos en BIS</h2></div></div>
          {filas.length === 0 ? <p className="text-sm text-secondary py-6">Aún no hay amigos en esta estación.</p> : <div className="divide-y divide-border">{filas.map((row) => (
            <div key={row.id} className={`py-4 flex flex-col gap-2 ${selectedId === row.id ? "bg-accent-bg/40 -mx-5 px-5" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => seleccionar(row)} className="text-left"><p className="font-medium text-sm">{row.amigos?.nombres || "Sin nombre"}</p><p className="text-xs text-secondary mt-0.5">{row.amigos?.zonas?.nombre || "Sin zona"} · {row.dias ?? 0} días{row.integrado ? " · Integrado" : ""} · {row.atenciones.length} atención{row.atenciones.length === 1 ? "" : "es"}</p></button>
                {((row.dias ?? 0) > UMBRAL || row.integrado) && <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded-full bg-warning-bg text-warning whitespace-nowrap">Listo para trasladar</span>}
              </div>
              {canEdit && <div className="flex items-center gap-2"><select aria-label="Trasladar a" className="input-field text-xs flex-1" value={trasladoDestino[row.id] || ""} onChange={(event) => setTrasladoDestino({ ...trasladoDestino, [row.id]: event.target.value })}><option value="">Trasladar a...</option>{estaciones.filter((item) => item.codigo !== "bis" && item.codigo !== "metodos").map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><button type="button" aria-label="Confirmar traslado a otra estación" onClick={() => trasladar(row)} disabled={saving} className="btn-secondary px-3"><ArrowRightLeft className="w-3.5 h-3.5" /></button></div>}
            </div>
          ))}</div>}
        </div>
        <div className="card p-5">
          {selectedId ? <form onSubmit={guardarAtencion} className="grid gap-3">
            <p className="eyebrow">Nueva atención BIS — {seleccionado?.amigos?.nombres}</p>
            <label className="text-sm">Fecha de visita<input required disabled={!canEdit} type="date" className="input-field mt-1.5" value={atencionForm.fecha_visita} onChange={(event) => setAtencionForm({ ...atencionForm, fecha_visita: event.target.value })} /></label>
            <label className="text-sm">Responsable<select disabled={!canEdit} className="input-field mt-1.5" value={atencionForm.responsable_persona_id} onChange={(event) => setAtencionForm({ ...atencionForm, responsable_persona_id: event.target.value })}><option value="">Sin asignar</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select></label>
            <label className="flex items-center gap-2 text-sm"><input disabled={!canEdit} type="checkbox" checked={atencionForm.primera_visita} onChange={(event) => setAtencionForm({ ...atencionForm, primera_visita: event.target.checked })} /> Primera visita</label>
            <label className="text-sm">Recibimiento<input disabled={!canEdit} className="input-field mt-1.5" value={atencionForm.recibimiento} onChange={(event) => setAtencionForm({ ...atencionForm, recibimiento: event.target.value })} /></label>
            <label className="text-sm">Necesidad inmediata<input disabled={!canEdit} className="input-field mt-1.5" value={atencionForm.necesidad_inmediata} onChange={(event) => setAtencionForm({ ...atencionForm, necesidad_inmediata: event.target.value })} /></label>
            <label className="text-sm">Próximo contacto<input disabled={!canEdit} type="date" className="input-field mt-1.5" value={atencionForm.contacto_posterior} onChange={(event) => setAtencionForm({ ...atencionForm, contacto_posterior: event.target.value })} /></label>
            <label className="text-sm">Resultado del contacto<input disabled={!canEdit} className="input-field mt-1.5" value={atencionForm.resultado_contacto} onChange={(event) => setAtencionForm({ ...atencionForm, resultado_contacto: event.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm"><input disabled={!canEdit} type="checkbox" checked={atencionForm.integrado} onChange={(event) => setAtencionForm({ ...atencionForm, integrado: event.target.checked })} /> Quedó integrado</label>
            <label className="text-sm">Derivado a<input disabled={!canEdit} className="input-field mt-1.5" value={atencionForm.derivado_a} onChange={(event) => setAtencionForm({ ...atencionForm, derivado_a: event.target.value })} /></label>
            <label className="text-sm">Notas<textarea disabled={!canEdit} className="input-field mt-1.5 min-h-16" value={atencionForm.notas} onChange={(event) => setAtencionForm({ ...atencionForm, notas: event.target.value })} /></label>
            {canEdit && <button disabled={saving} className="btn-primary justify-center">{saving ? "Guardando..." : "Registrar atención"}</button>}
            {seleccionado?.atenciones.length > 0 && <div className="border-t border-border pt-3 mt-1"><p className="text-xs font-medium text-secondary mb-2">Historial</p><div className="divide-y divide-border">{seleccionado.atenciones.map((atencion) => <div key={atencion.id} className="py-2"><p className="text-xs font-medium">{atencion.fecha_visita}{atencion.primera_visita ? " · Primera visita" : ""}{atencion.integrado ? " · Integrado" : ""}</p>{atencion.notas && <p className="text-xs text-muted mt-0.5">{atencion.notas}</p>}</div>)}</div></div>}
          </form> : <p className="text-sm text-secondary">Selecciona un amigo de la lista para registrar su atención BIS.</p>}
        </div>
      </section>
    </div>
  );
}
