import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Download,
  MapPinned,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import { usePreferencias } from "../hooks/usePreferencias";
import { formatFecha } from "../lib/dateFormat";
import { diasDesde } from "../lib/rutaEvangelistica";
import { descargarPdf } from "../lib/reportExport";
import InfoTip from "../components/InfoTip";

const RUTA_ESTACION_PATH = { uno_mas: "/uno-mas", bis: "/bis", refam: "/refam", esfob: "/esfob", discipulado: "/discipulado" };
const TONO_ETAPA = [
  "bg-surface-1 text-secondary",
  "bg-warning-bg text-warning",
  "bg-accent-bg text-accent",
  "bg-warning-bg text-warning",
  "bg-success-bg text-success",
];
const EMPTY_FORM = {
  nombres: "",
  telefono: "",
  direccion: "",
  sector: "",
  invitado_por: "",
  fecha_primer_contacto: new Date().toISOString().slice(0, 10),
  etapa_id: "",
  zona_id: "",
  evangelismo_metodologia_id: "",
  fecha_nacimiento: "",
  estado_civil: "soltero",
};
const FRIEND_FIELDS =
  "id, nombres, telefono, direccion, sector, invitado_por, fecha_primer_contacto, etapa_id, zona_id, evangelismo_metodologia_id, convertido, estado_espiritual, persona_id, categoria_asignada_id, fecha_nacimiento, estado_civil, created_at, bautizado, fecha_bautismo, sellado, fecha_sellado, etapas_seguimiento(nombre, orden), zonas(nombre)";

export default function Amigos() {
  const pageSize = 50;
  const [searchParams] = useSearchParams();
  const station = searchParams.get("station");
  const isBis = station === "bis";
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const { formato_fecha } = usePreferencias();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [etapas, setEtapas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [metodologias, setMetodologias] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [amigos, setAmigos] = useState([]);
  const [analysisAmigos, setAnalysisAmigos] = useState([]);
  const [page, setPage] = useState(0);
  const [totalAmigos, setTotalAmigos] = useState(0);
  const [totalConvertidos, setTotalConvertidos] = useState(0);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [transferName, setTransferName] = useState({ nombres: "", apellidos: "" });
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [stageHistory, setStageHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
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
  const [routeProcess, setRouteProcess] = useState(null);
  const [routeHistory, setRouteHistory] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const notesRequest = useRef(0);

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError("Tu usuario no tiene una congregación local asignada.");
      return;
    }
    setLoading(true);
    setError(null);
    const [stageResult, zoneResult, categoryResult, methodResult, friendResult, convertedResult, analysisResult] =
      await Promise.all([
        supabase
          .from("etapas_seguimiento")
          .select("id, nombre, orden")
          .eq("congregacion_id", congregacionId)
          .order("orden"),
        supabase
          .from("zonas")
          .select("id, nombre")
          .eq("congregacion_id", congregacionId)
          .order("nombre"),
        supabase
          .from("categorias_demograficas")
          .select("id, nombre")
          .eq("congregacion_id", congregacionId)
          .order("orden"),
        supabase
          .from("tipos_actividad")
          .select("id, nombre, modulos!inner(congregacion_id, nombre_modulo)")
          .eq("modulos.congregacion_id", congregacionId)
          .ilike("modulos.nombre_modulo", "Evangelismo")
          .order("nombre"),
        (() => {
          let query = supabase
            .from("amigos")
            .select(FRIEND_FIELDS, { count: "exact" })
            .eq("congregacion_id", congregacionId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(page * pageSize, page * pageSize + pageSize - 1);
          if (filtro !== "todos") query = query.eq("etapa_id", filtro);
          if (busqueda.trim()) query = query.or(`nombres.ilike.%${busqueda.trim()}%,sector.ilike.%${busqueda.trim()}%,telefono.ilike.%${busqueda.trim()}%`);
          return query;
        })(),
        supabase.from("amigos").select("id", { count: "exact", head: true }).eq("congregacion_id", congregacionId).eq("convertido", true),
        supabase.from("amigos").select("id, etapa_id, zona_id, evangelismo_metodologia_id, convertido, fecha_primer_contacto, sellado").eq("congregacion_id", congregacionId),
      ]);
    if (
      stageResult.error ||
      zoneResult.error ||
      categoryResult.error ||
      methodResult.error ||
      friendResult.error ||
      convertedResult.error
      || analysisResult.error
    )
      setError("No se pudo cargar la ruta de seguimiento.");
    setEtapas(stageResult.data ?? []);
    setZonas(zoneResult.data ?? []);
    setCategorias(categoryResult.data ?? []);
    setMetodologias(methodResult.data ?? []);
    setAmigos(friendResult.data ?? []);
    setTotalAmigos(friendResult.count ?? 0);
    setTotalConvertidos(convertedResult.count ?? 0);
    setAnalysisAmigos(analysisResult.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [congregacionId, page, filtro, busqueda]);

  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "evangelismo.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  useEffect(() => {
    setPage(0);
  }, [filtro, busqueda]);

  const totalPages = Math.max(1, Math.ceil(totalAmigos / pageSize));
  const filtrados = useMemo(() => amigos, [amigos]);
  const converted = totalConvertidos;
  const active = Math.max(totalAmigos - converted, 0);

  function selectFriend(friend) {
    notesRequest.current += 1;
    setSelected(friend);
    setEditForm({
      nombres: friend.nombres || "",
      telefono: friend.telefono || "",
      direccion: friend.direccion || "",
      sector: friend.sector || "",
      invitado_por: friend.invitado_por || "",
      fecha_primer_contacto: friend.fecha_primer_contacto || "",
      etapa_id: friend.etapa_id || "",
      zona_id: friend.zona_id || "",
      evangelismo_metodologia_id: friend.evangelismo_metodologia_id || "",
      fecha_nacimiento: friend.fecha_nacimiento || "",
      estado_civil: friend.estado_civil || "soltero",
    });
    const nameParts = (friend.nombres || "").trim().split(/\s+/);
    setTransferName({ nombres: nameParts.slice(0, -1).join(" ") || friend.nombres || "", apellidos: nameParts.slice(-1).join("") });
    setNotes([]);
    setStageHistory([]);
    setNewNote("");
    setNotesLoading(true);
    setHistoryLoading(true);
    setRouteLoading(true);
    setRouteProcess(null);
    setRouteHistory([]);
    setError(null);
    setNotice(null);
    const requestId = notesRequest.current;
    supabase
      .from("amigos_notas")
      .select("id, nota, created_at")
      .eq("amigo_id", friend.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: notesError }) => {
        if (requestId !== notesRequest.current) return;
        if (notesError) setError("No se pudieron cargar las notas.");
        setNotes(data ?? []);
        setNotesLoading(false);
      });
    supabase
      .from("historial_amigos")
      .select("id, etapa_anterior_id, etapa_nueva_id, observacion, usuario_id, creado_en, etapa_anterior:etapas_seguimiento!historial_amigos_etapa_anterior_id_fkey(nombre), etapa_nueva:etapas_seguimiento!historial_amigos_etapa_nueva_id_fkey(nombre)")
      .eq("amigo_id", friend.id)
      .order("creado_en", { ascending: false })
      .then(({ data, error: historyError }) => {
        if (requestId !== notesRequest.current) return;
        if (historyError) setError("No se pudo cargar el historial de etapas.");
        setStageHistory(data ?? []);
        setHistoryLoading(false);
      });
    supabase
      .from("ruta_procesos")
      .select("id, estado, fecha_inicio, fecha_cierre, resultado, estacion_id, estacion:ruta_estaciones!ruta_procesos_estacion_id_fkey(id, codigo, nombre, orden), responsable:personas!ruta_procesos_responsable_persona_id_fkey(nombres, apellidos)")
      .eq("amigo_id", friend.id)
      .order("fecha_inicio", { ascending: true })
      .then(({ data, error: routeError }) => {
        if (requestId !== notesRequest.current) return;
        if (routeError) setError("No se pudo cargar la ruta actual.");
        const historial = data ?? [];
        setRouteHistory(historial);
        setRouteProcess(historial.find((row) => row.estado === "activo" || row.estado === "pausado") ?? null);
        setRouteLoading(false);
      });
  }

  async function createFriend(event) {
    event.preventDefault();
    if (!canEdit) { setError("Tu perfil solo permite consultar Amigos en ruta."); return; }
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      etapa_id: form.etapa_id || null,
      zona_id: form.zona_id || null,
      evangelismo_metodologia_id: form.evangelismo_metodologia_id || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      congregacion_id: congregacionId,
    };
    const { data, error: insertError } = await supabase
      .from("amigos")
      .insert(payload)
      .select(FRIEND_FIELDS)
      .single();
    setSaving(false);
    if (insertError) {
      setError(`No se pudo registrar el amigo: ${insertError.message}`);
      return;
    }
    setAmigos((current) => [data, ...current]);
    setForm({
      ...EMPTY_FORM,
      fecha_primer_contacto: new Date().toISOString().slice(0, 10),
    });
    setShowForm(false);
    selectFriend(data);
  }

  async function saveFriend(event) {
    event.preventDefault();
    if (!canEdit) { setError("Tu perfil solo permite consultar Amigos en ruta."); return; }
    if (!selected) return;
    setSaving(true);
    setError(null);
    const payload = {
      ...editForm,
      etapa_id: editForm.etapa_id || null,
      zona_id: editForm.zona_id || null,
      evangelismo_metodologia_id: editForm.evangelismo_metodologia_id || null,
      fecha_nacimiento: editForm.fecha_nacimiento || null,
    };
    const { data, error: updateError } = await supabase
      .from("amigos")
      .update(payload)
      .eq("id", selected.id)
      .eq("congregacion_id", congregacionId)
      .select(FRIEND_FIELDS)
      .single();
    setSaving(false);
    if (updateError) {
      setError(`No se pudo actualizar el seguimiento: ${updateError.message}`);
      return;
    }
    setAmigos((current) =>
      current.map((friend) => (friend.id === data.id ? data : friend)),
    );
    setSelected(data);
    setEditForm({
      ...payload,
      etapa_id: data.etapa_id || "",
      zona_id: data.zona_id || "",
      evangelismo_metodologia_id: data.evangelismo_metodologia_id || "",
    });
  }

  async function markBaptized() {
    if (!selected) return;
    if (!canEdit) { setError("Tu perfil no permite modificar el estado espiritual."); return; }
    if (selected.persona_id) {
      setError("La persona ya está incorporada a Feligresía y no puede volver a estado en ruta desde aquí.");
      return;
    }
    setSaving(true);
    setError(null);
    const becomingBaptized = selected.estado_espiritual !== "bautizado";
    const values = {
      estado_espiritual: becomingBaptized ? "bautizado" : "en_ruta",
      convertido: becomingBaptized,
      ...(becomingBaptized ? { bautizado: true, fecha_bautismo: selected.fecha_bautismo || new Date().toISOString().slice(0, 10) } : {}),
    };
    const { error: updateError } = await supabase
      .from("amigos")
      .update(values)
      .eq("id", selected.id)
      .eq("congregacion_id", congregacionId);
    setSaving(false);
    if (updateError) {
      setError(`No se pudo actualizar la conversión: ${updateError.message}`);
      return;
    }
    setAmigos((current) =>
      current.map((friend) =>
        friend.id === selected.id ? { ...friend, ...values } : friend,
      ),
    );
    setSelected((current) => ({ ...current, ...values }));
  }

  async function markSealed() {
    if (!selected || selected.sellado) return;
    if (!canEdit) { setError("Tu perfil no permite modificar el estado espiritual."); return; }
    setSaving(true);
    setError(null);
    const values = { sellado: true, fecha_sellado: new Date().toISOString().slice(0, 10) };
    const { error: updateError } = await supabase
      .from("amigos")
      .update(values)
      .eq("id", selected.id)
      .eq("congregacion_id", congregacionId);
    setSaving(false);
    if (updateError) { setError(`No se pudo actualizar el sellado: ${updateError.message}`); return; }
    setAmigos((current) => current.map((friend) => (friend.id === selected.id ? { ...friend, ...values } : friend)));
    setSelected((current) => ({ ...current, ...values }));
  }

  async function incorporateIntoFeligresia() {
    if (!selected || selected.estado_espiritual !== "bautizado") return;
    if (!canEdit) { setError("Tu perfil no permite incorporar personas a Feligresía."); return; }
    if (!editForm.fecha_nacimiento) {
      setError("Registra la fecha de nacimiento antes de incorporar a Feligresía.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data: personaId, error: transferError } = await supabase.rpc("incorporar_amigo_bautizado", {
      p_amigo_id: selected.id,
      p_nombres: transferName.nombres,
      p_apellidos: transferName.apellidos,
      p_fecha_nacimiento: editForm.fecha_nacimiento || null,
      p_estado_civil: editForm.estado_civil || "soltero",
      p_fecha_ingreso: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    if (transferError) {
      setError(`No se pudo incorporar a Feligresía: ${transferError.message}`);
      return;
    }
    setSelected((current) => ({ ...current, persona_id: personaId }));
    setAmigos((current) => current.map((friend) => friend.id === selected.id ? { ...friend, persona_id: personaId } : friend));
  }

  async function exportarRecorrido() {
    if (!selected || !routeHistory.length) return;
    await descargarPdf({
      filename: `recorrido-${selected.nombres.replace(/\s+/g, "-").toLowerCase()}.pdf`,
      titulo: `Recorrido de la Ruta Evangelística — ${selected.nombres}`,
      meta: [`Primer contacto: ${formatFecha(selected.fecha_primer_contacto, { formato: formato_fecha })}`, selected.convertido ? "Estado: convertido" : "Estado: en ruta"],
      headers: ["Estación", "Inicio", "Cierre", "Responsable"],
      rows: routeHistory.map((row) => [
        row.estacion?.nombre || "Sin nombre",
        formatFecha(row.fecha_inicio, { formato: formato_fecha }),
        row.fecha_cierre ? formatFecha(row.fecha_cierre, { formato: formato_fecha }) : "En curso",
        row.responsable ? `${row.responsable.nombres} ${row.responsable.apellidos}` : "Sin asignar",
      ]),
    });
  }

  async function removeFriend() {
    if (!canEdit) { setError("Tu perfil no permite eliminar seguimientos."); return; }
    if (
      !selected ||
      !window.confirm(
        `¿Eliminar el seguimiento de ${selected.nombres}? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setSaving(true);
    const { error: deleteError } = await supabase
      .from("amigos")
      .delete()
      .eq("id", selected.id)
      .eq("congregacion_id", congregacionId);
    setSaving(false);
    if (deleteError) {
      setError(`No se pudo eliminar el seguimiento: ${deleteError.message}`);
      return;
    }
    setAmigos((current) =>
      current.filter((friend) => friend.id !== selected.id),
    );
    setSelected(null);
  }

  async function addNote(event) {
    event.preventDefault();
    if (!canEdit) { setError("Tu perfil no permite registrar notas."); return; }
    if (!selected || !newNote.trim()) return;
    setSaving(true);
    const { data, error: noteError } = await supabase
      .from("amigos_notas")
      .insert({ amigo_id: selected.id, nota: newNote.trim() })
      .select("id, nota, created_at")
      .single();
    setSaving(false);
    if (noteError) {
      setError("No se pudo guardar la nota.");
      return;
    }
    setNotes((current) => [data, ...current]);
    setNewNote("");
  }

  if (roleLoading || loading)
    return (
      <div className="module-loading" role="status">
        <span className="loading-dot" />
        Cargando ruta de seguimiento...
      </div>
    );
  if (!congregacionId)
    return (
      <div className="card p-8 text-center text-sm text-secondary">{error}</div>
    );

  return (
    <div className={`page-shell ${canEdit ? "" : "amigos-read-only"}`}>
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link to="/misiones-evangelismo" className="btn-secondary mb-4">
            <ArrowLeft className="w-4 h-4" />
            Volver a Misiones y Evangelismo
          </Link>
          <p className="eyebrow">Ruta de integración</p>
          <h1 className="section-title">Amigos en ruta</h1>
          <p className="text-sm text-secondary mt-1">
            Acompaña cada historia desde el primer contacto hasta su
            integración.
          </p>
        </div>
        {canEdit && !isBis && <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          {showForm ? "Cerrar registro" : "Registrar amigo"}
        </button>}
      </header>
      {isBis && <p className="text-sm text-secondary bg-accent-bg rounded p-3">BIS trabaja sobre amigos ya registrados en Uno Más. Selecciona una ficha para registrar bienvenida, seguimiento e integración; no crees un nuevo amigo desde esta estación.</p>}
      {error && (
        <p
          role="alert"
          className="text-sm text-danger bg-danger-bg rounded p-3"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="text-sm text-success bg-success-bg rounded p-3"
        >
          {notice}
        </p>
      )}
      <section className="grid sm:grid-cols-3 gap-3">
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">
            En acompañamiento
          </p>
          <p className="text-2xl font-semibold mt-3">{active}</p>
        </div>
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">
            Convertidos
          </p>
          <p className="text-2xl font-semibold mt-3 text-success">
            {converted}
          </p>
        </div>
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">
            Etapas configuradas
            <InfoTip texto="La 'etapa' es un paso interno de seguimiento dentro de esta ficha (por ejemplo, primer contacto o visita). Es distinta de la 'estación' de la Ruta Evangelística, que es más general (Uno Más, BIS, REFAM, etc.)." />
          </p>
          <p className="text-2xl font-semibold mt-3">{etapas.length}</p>
        </div>
      </section>
      <FriendInsights amigos={analysisAmigos} etapas={etapas} zonas={zonas} metodologias={metodologias} />
      {showForm && (
        <form
          onSubmit={createFriend}
          className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
        >
          <label className="text-sm">
            Nombre completo
            <input
              required
              className="input-field mt-1.5"
              value={form.nombres}
              onChange={(event) =>
                setForm({ ...form, nombres: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Teléfono
            <input
              className="input-field mt-1.5"
              value={form.telefono}
              onChange={(event) =>
                setForm({ ...form, telefono: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Dirección
            <input
              className="input-field mt-1.5"
              value={form.direccion}
              onChange={(event) =>
                setForm({ ...form, direccion: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Sector
            <input
              className="input-field mt-1.5"
              value={form.sector}
              onChange={(event) =>
                setForm({ ...form, sector: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Invitado por
            <input
              className="input-field mt-1.5"
              value={form.invitado_por}
              onChange={(event) =>
                setForm({ ...form, invitado_por: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Primer contacto
            <input
              type="date"
              className="input-field mt-1.5"
              value={form.fecha_primer_contacto}
              onChange={(event) =>
                setForm({ ...form, fecha_primer_contacto: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Etapa inicial
            <select
              className="input-field mt-1.5"
              value={form.etapa_id}
              onChange={(event) =>
                setForm({ ...form, etapa_id: event.target.value })
              }
            >
              <option value="">Sin etapa</option>
              {etapas.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Zona responsable
            <select
              className="input-field mt-1.5"
              value={form.zona_id}
              onChange={(event) =>
                setForm({ ...form, zona_id: event.target.value })
              }
            >
              <option value="">Sin zona</option>
              {zonas.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Metodología de Evangelismo
            <select
              className="input-field mt-1.5"
              value={form.evangelismo_metodologia_id}
              onChange={(event) =>
                setForm({ ...form, evangelismo_metodologia_id: event.target.value })
              }
            >
              <option value="">Sin metodología</option>
              {metodologias.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.nombre}
                </option>
              ))}
            </select>
          </label>
          <button disabled={saving} className="btn-secondary justify-center">
            {saving ? "Guardando..." : "Guardar amigo"}
          </button>
        </form>
      )}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex items-center gap-2 border border-border rounded px-3 py-2 w-full sm:w-64 focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent">
          <Search className="w-4 h-4 text-muted" />
          <input
            aria-label="Buscar amigos"
            className="bg-transparent outline-none text-sm w-full"
            placeholder="Buscar amigo..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </div>
        <div
          role="group"
          aria-label="Filtrar por etapa"
          className="flex gap-2 flex-wrap"
        >
          <button
            type="button"
            aria-pressed={filtro === "todos"}
            onClick={() => setFiltro("todos")}
            className={`text-xs px-3 py-1.5 rounded-full border ${filtro === "todos" ? "bg-accent-bg text-accent border-accent/20" : "border-border text-secondary"}`}
          >
            Todos
          </button>
          {etapas.map((stage) => (
            <button
              type="button"
              key={stage.id}
              aria-pressed={filtro === stage.id}
              onClick={() => setFiltro(stage.id)}
              className={`text-xs px-3 py-1.5 rounded-full border ${filtro === stage.id ? "bg-accent-bg text-accent border-accent/20" : "border-border text-secondary"}`}
            >
              {stage.nombre}
            </button>
          ))}
        </div>
      </div>
      {totalAmigos > 0 && <div className="flex items-center justify-between gap-3 text-xs text-secondary"><span>Página {page + 1} de {totalPages} · {totalAmigos} amigos</span><div className="flex gap-2"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)} className="btn-secondary px-3">Anterior</button><button type="button" disabled={page >= totalPages - 1 || loading} onClick={() => setPage((current) => current + 1)} className="btn-secondary px-3">Siguiente</button></div></div>}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div>
          {filtrados.length === 0 ? (
            <div className="card p-8 text-center text-sm text-secondary">
              <MapPinned className="w-8 h-8 text-muted mx-auto mb-3" />
              No hay amigos que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="grid xl:grid-cols-2 gap-3">
              {filtrados.map((friend) => (
                <button
                  type="button"
                  key={friend.id}
                  onClick={() => selectFriend(friend)}
                  className={`card p-4 text-left flex justify-between items-center gap-3 hover:border-accent transition-colors ${selected?.id === friend.id ? "border-accent ring-1 ring-accent/20" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-accent-bg text-accent flex items-center justify-center flex-shrink-0">
                      <UserRound className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {friend.nombres}
                      </p>
                      <p className="text-xs text-secondary truncate">
                        {friend.sector ||
                          friend.zonas?.nombre ||
                          "Sin sector asignado"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-[0.12em] px-2.5 py-1.5 rounded-full whitespace-nowrap ${TONO_ETAPA[Math.max(0, (friend.etapas_seguimiento?.orden - 1) % TONO_ETAPA.length)] ?? TONO_ETAPA[0]}`}
                  >
                    {friend.convertido
                      ? "Convertido"
                      : (friend.etapas_seguimiento?.nombre ?? "Sin etapa")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selected && (
          <aside className="card p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Ficha de acompañamiento</p>
                <h2 className="text-lg font-semibold mt-1">
                  {selected.nombres}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1.5 text-muted hover:text-ink"
                aria-label="Cerrar ficha"
                title="Cerrar ficha"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveFriend} className="grid gap-3 mt-5">
              <label className="text-sm">
                Nombre completo
                <input
                  required
                  className="input-field mt-1.5"
                  value={editForm.nombres}
                  onChange={(event) =>
                    setEditForm({ ...editForm, nombres: event.target.value })
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Teléfono
                  <input
                    className="input-field mt-1.5"
                    value={editForm.telefono}
                    onChange={(event) =>
                      setEditForm({ ...editForm, telefono: event.target.value })
                    }
                  />
                </label>
                <label className="text-sm">
                  Sector
                  <input
                    className="input-field mt-1.5"
                    value={editForm.sector}
                    onChange={(event) =>
                      setEditForm({ ...editForm, sector: event.target.value })
                    }
                  />
                </label>
              </div>
              <label className="text-sm">
                Dirección
                <input
                  className="input-field mt-1.5"
                  value={editForm.direccion}
                  onChange={(event) =>
                    setEditForm({ ...editForm, direccion: event.target.value })
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Etapa
                  <select
                    className="input-field mt-1.5"
                    value={editForm.etapa_id}
                    onChange={(event) =>
                      setEditForm({ ...editForm, etapa_id: event.target.value })
                    }
                  >
                    <option value="">Sin etapa</option>
                    {etapas.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Zona
                  <select
                    className="input-field mt-1.5"
                    value={editForm.zona_id}
                    onChange={(event) =>
                      setEditForm({ ...editForm, zona_id: event.target.value })
                    }
                  >
                    <option value="">Sin zona</option>
                    {zonas.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Metodología
                  <select
                    className="input-field mt-1.5"
                    value={editForm.evangelismo_metodologia_id}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        evangelismo_metodologia_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Sin metodología</option>
                    {metodologias.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="text-sm">
                Invitado por
                <input
                  className="input-field mt-1.5"
                  value={editForm.invitado_por}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      invitado_por: event.target.value,
                    })
                  }
                />
              </label>
              <label className="text-sm">
                Primer contacto
                <input
                  type="date"
                  className="input-field mt-1.5"
                  value={editForm.fecha_primer_contacto}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      fecha_primer_contacto: event.target.value,
                    })
                  }
                />
              </label>
              <button disabled={saving} className="btn-primary justify-center">
                <Pencil className="w-4 h-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
              <section className="mt-5 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <MapPinned className="w-4 h-4 text-accent" />
                  <div>
                    <p className="eyebrow">Ruta Evangelística</p>
                    <h3 className="font-medium text-sm mt-1 flex items-center gap-1.5">Estación de acompañamiento<InfoTip texto="La estación indica en qué parte de la Ruta Evangelística está esta persona ahora mismo. Puede moverse a cualquier estación según su situación real, no tiene que ser en orden." /></h3>
                  </div>
                </div>
                {routeLoading ? (
                  <p className="text-xs text-muted mt-3">Cargando estación...</p>
                ) : routeProcess ? (
                  <p className="text-sm text-secondary mt-3">
                    Estación actual: <span className="font-medium text-ink">{routeProcess.estacion?.nombre || "Sin nombre"}</span>
                    {" · "}{diasDesde(routeProcess.fecha_inicio) ?? 0} días.{" "}
                    {RUTA_ESTACION_PATH[routeProcess.estacion?.codigo] && (
                      <Link to={RUTA_ESTACION_PATH[routeProcess.estacion.codigo]} className="text-accent">
                        Gestionar en {routeProcess.estacion?.nombre} <ArrowRight className="inline w-3 h-3" />
                      </Link>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-secondary mt-3">
                    Esta persona todavía no tiene una estación iniciada. Agrégala desde{" "}
                    <Link to="/uno-mas" className="text-accent">Uno Más <ArrowRight className="inline w-3 h-3" /></Link>
                    {" "}o directamente en la estación que corresponda según su situación real.
                  </p>
                )}
                {routeHistory.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-xs font-medium text-secondary uppercase tracking-[0.08em] flex items-center gap-1.5">Recorrido completo<InfoTip texto="Muestra por cuáles estaciones ha pasado esta persona, cuándo y quién la acompañó en cada una." /></h4>
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={exportarRecorrido} className="text-xs text-accent inline-flex items-center gap-1">
                          <Download className="w-3.5 h-3.5" /> Exportar
                        </button>
                        <InfoTip texto="Descarga en PDF el recorrido completo de esta persona por la Ruta Evangelística, listo para imprimir o compartir." />
                      </span>
                    </div>
                    <div className="mt-2.5 space-y-2.5">
                      {routeHistory.map((row) => (
                        <div key={row.id} className="flex items-start gap-2 text-xs">
                          <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${row.fecha_cierre ? "bg-muted" : "bg-success"}`} />
                          <div>
                            <p className="font-medium text-ink">{row.estacion?.nombre || "Sin nombre"}</p>
                            <p className="text-secondary">
                              {formatFecha(row.fecha_inicio, { formato: formato_fecha })} → {row.fecha_cierre ? formatFecha(row.fecha_cierre, { formato: formato_fecha }) : "en curso"}
                              {row.responsable ? ` · ${row.responsable.nombres} ${row.responsable.apellidos}` : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            <div className="mt-4 grid gap-2">
              <p className="text-xs text-secondary">Confirma cómo aparecerá la persona en el censo ministerial.</p>
              <label className="text-sm">Nombres para Feligresía<input className="input-field mt-1.5" value={transferName.nombres} onChange={(event) => setTransferName({ ...transferName, nombres: event.target.value })} /></label>
              <label className="text-sm">Apellidos para Feligresía<input className="input-field mt-1.5" value={transferName.apellidos} onChange={(event) => setTransferName({ ...transferName, apellidos: event.target.value })} /></label>
              <label className="text-sm">
                Fecha de nacimiento para Feligresía
                <input
                  type="date"
                  className="input-field mt-1.5"
                  value={editForm.fecha_nacimiento}
                  onChange={(event) => setEditForm({ ...editForm, fecha_nacimiento: event.target.value })}
                />
              </label>
              <label className="text-sm">
                Estado civil para Feligresía
                <select className="input-field mt-1.5" value={editForm.estado_civil} onChange={(event) => setEditForm({ ...editForm, estado_civil: event.target.value })}>
                  <option value="soltero">Soltero/a</option>
                  <option value="casado">Casado/a</option>
                  <option value="union_libre">Unión libre</option>
                  <option value="divorciado">Divorciado/a</option>
                  <option value="viudo">Viudo/a</option>
                </select>
              </label>
              <label className="text-sm flex items-center gap-1">
                Categoría al convertir
                <InfoTip texto="Grupo demográfico con el que quedará registrada la persona en Feligresía (por ejemplo, niño, joven o adulto)." />
                <select
                  className="input-field mt-1.5 w-full"
                  value={selected.categoria_asignada_id || ""}
                  onChange={(event) =>
                    setSelected({
                      ...selected,
                      categoria_asignada_id: event.target.value || null,
                    })
                  }
                >
                  <option value="">Sin categoría</option>
                  {categorias.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-secondary flex items-center gap-1.5 mt-1">
                Hitos espirituales
                <InfoTip texto="Bautizado y sellado son hitos independientes entre sí. Incorporar a Feligresía sí es definitivo: crea el registro oficial de membresía y esta ficha deja de poder volver a estado en ruta." />
              </p>
              <button
                type="button"
                disabled={saving || Boolean(selected.persona_id)}
                onClick={markBaptized}
                className="btn-secondary justify-center"
              >
                <CheckCircle2 className="w-4 h-4" />
                {selected.persona_id
                  ? "Ya está en Feligresía"
                  : selected.estado_espiritual === "bautizado"
                  ? "Volver a estado en ruta"
                  : "Marcar como bautizado"}
              </button>
              {selected.estado_espiritual === "bautizado" && (
                <button type="button" disabled={saving || Boolean(selected.persona_id)} onClick={incorporateIntoFeligresia} className="btn-primary justify-center">
                  {selected.persona_id ? "Ya está en Feligresía" : "Incorporar a Feligresía"}
                </button>
              )}
              <button type="button" disabled={saving || selected.sellado} onClick={markSealed} className="btn-secondary justify-center">
                <CheckCircle2 className="w-4 h-4" />
                {selected.sellado ? `Sellado el ${selected.fecha_sellado}` : "Marcar sellado con el Espíritu Santo"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={removeFriend}
                className="text-xs text-danger hover:underline inline-flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar seguimiento
              </button>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="w-4 h-4 text-accent" />
                <h3 className="font-medium text-sm">Notas de acompañamiento</h3>
              </div>
              <form
                onSubmit={addNote}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  required
                  className="input-field"
                  placeholder="Registrar una nota..."
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                />
                <button
                  disabled={saving}
                  className="btn-primary px-3 sm:w-auto"
                  aria-label="Guardar nota"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
              <div className="divide-y divide-border mt-3">
                {notesLoading ? (
                  <p className="text-xs text-muted py-3">Cargando notas...</p>
                ) : notes.length ? (
                  notes.map((note) => (
                    <div key={note.id} className="py-3">
                      <p className="text-sm">{note.nota}</p>
                      <p className="text-[10px] text-muted mt-1">
                        {formatFecha(note.created_at, { formato: formato_fecha, conHora: true })}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted py-3">Aún no hay notas.</p>
                )}
              </div>
            </div>
            <FriendStageHistory history={stageHistory} loading={historyLoading} />
          </aside>
        )}
      </div>
    </div>
  );
}

function FriendStageHistory({ history, loading }) {
  const { formato_fecha } = usePreferencias()
  return <section className="mt-5 border-t border-border pt-4"><div className="flex items-center justify-between gap-3"><h3 className="font-medium text-sm">Historial de etapas</h3><span className="text-[10px] text-muted">{history.length} cambios</span></div>{loading ? <p className="text-xs text-muted mt-3">Cargando historial...</p> : history.length ? <div className="divide-y divide-border mt-2">{history.map((item) => <div key={item.id} className="py-2"><p className="text-xs font-medium">{item.etapa_anterior?.nombre || 'Inicio'} <span className="text-muted">→</span> {item.etapa_nueva?.nombre || 'Sin etapa'}</p><p className="text-[10px] text-muted mt-1">{formatFecha(item.creado_en, { formato: formato_fecha, conHora: true })}{item.usuario_id ? ` · ${item.usuario_id}` : ''}</p>{item.observacion && <p className="text-xs text-secondary mt-1">{item.observacion}</p>}</div>)}</div> : <p className="text-xs text-muted mt-3">Aún no hay cambios de etapa registrados.</p>}</section>
}

function FriendInsights({ amigos, etapas, zonas, metodologias }) {
  const oldContactDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const withoutRecentContact = amigos.filter((friend) => !friend.convertido && friend.fecha_primer_contacto && friend.fecha_primer_contacto < oldContactDate).length
  const sealedNotBaptized = amigos.filter((friend) => !friend.convertido && friend.sellado).length
  const countBy = (key, items) => items.map((item) => ({ ...item, total: amigos.filter((friend) => friend[key] === item.id && !friend.convertido).length })).filter((item) => item.total > 0).sort((left, right) => right.total - left.total)
  const stageTotals = countBy('etapa_id', etapas)
  const zoneTotals = countBy('zona_id', zonas)
  const methodTotals = countBy('evangelismo_metodologia_id', metodologias)
  return <section className="card p-5"><div><h2 className="font-medium">Lectura de la ruta</h2><p className="text-xs text-secondary mt-1">Resumen global de personas no convertidas; una demora sugiere revisar contacto y contexto, no juzgar compromiso.</p></div><div className="grid md:grid-cols-3 gap-4 mt-5"><InsightList title="Por etapa" items={stageTotals} /><InsightList title="Por zona" items={zoneTotals} /><InsightList title="Por metodología" items={methodTotals} /></div>{withoutRecentContact > 0 && <p className="summary-insight mt-5">{withoutRecentContact} persona{withoutRecentContact === 1 ? '' : 's'} lleva más de 30 días desde el primer contacto. Conviene revisar la agenda, disponibilidad y próximo paso.</p>}{sealedNotBaptized > 0 && <p className="summary-insight mt-3">{sealedNotBaptized} amigo{sealedNotBaptized === 1 ? '' : 's'} en ruta ya {sealedNotBaptized === 1 ? 'fue sellado' : 'fueron sellados'} con el Espíritu Santo aunque aún no se {sealedNotBaptized === 1 ? 'ha bautizado' : 'han bautizado'} — el bautismo y el sellado son hitos independientes.</p>}</section>
}

function InsightList({ title, items }) {
  return <div><h3 className="text-sm font-medium">{title}</h3>{items.length ? items.slice(0, 5).map((item) => <div key={item.id} className="flex justify-between gap-3 text-xs text-secondary mt-2"><span>{item.nombre}</span><strong className="text-ink">{item.total}</strong></div>) : <p className="text-xs text-muted mt-2">Sin datos disponibles.</p>}</div>
}
