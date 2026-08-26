import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  MapPinned,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";

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
};
const FRIEND_FIELDS =
  "id, nombres, telefono, direccion, sector, invitado_por, fecha_primer_contacto, etapa_id, zona_id, evangelismo_metodologia_id, convertido, categoria_asignada_id, created_at, etapas_seguimiento(nombre, orden), zonas(nombre)";

export default function Amigos() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [etapas, setEtapas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [metodologias, setMetodologias] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [amigos, setAmigos] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const notesRequest = useRef(0);

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError("Tu usuario no tiene una congregación local asignada.");
      return;
    }
    setLoading(true);
    setError(null);
    const [stageResult, zoneResult, categoryResult, methodResult, friendResult] =
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
        supabase
          .from("amigos")
          .select(FRIEND_FIELDS)
          .eq("congregacion_id", congregacionId)
          .order("created_at", { ascending: false }),
      ]);
    if (
      stageResult.error ||
      zoneResult.error ||
      categoryResult.error ||
      methodResult.error ||
      friendResult.error
    )
      setError("No se pudo cargar la ruta de seguimiento.");
    setEtapas(stageResult.data ?? []);
    setZonas(zoneResult.data ?? []);
    setCategorias(categoryResult.data ?? []);
    setMetodologias(methodResult.data ?? []);
    setAmigos(friendResult.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [congregacionId]);

  const filtrados = useMemo(
    () =>
      amigos.filter((friend) => {
        const matchesStage = filtro === "todos" || friend.etapa_id === filtro;
        const text =
          `${friend.nombres} ${friend.sector || ""} ${friend.telefono || ""}`.toLowerCase();
        return matchesStage && text.includes(busqueda.toLowerCase());
      }),
    [amigos, filtro, busqueda],
  );
  const converted = amigos.filter((friend) => friend.convertido).length;
  const active = amigos.length - converted;

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
    });
    setNotes([]);
    setNewNote("");
    setNotesLoading(true);
    setError(null);
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
  }

  async function createFriend(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      etapa_id: form.etapa_id || null,
      zona_id: form.zona_id || null,
      evangelismo_metodologia_id: form.evangelismo_metodologia_id || null,
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
    if (!selected) return;
    setSaving(true);
    setError(null);
    const payload = {
      ...editForm,
      etapa_id: editForm.etapa_id || null,
      zona_id: editForm.zona_id || null,
      evangelismo_metodologia_id: editForm.evangelismo_metodologia_id || null,
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

  async function markConverted() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const values = {
      convertido: !selected.convertido,
      categoria_asignada_id: selected.convertido
        ? null
        : selected.categoria_asignada_id || null,
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

  async function removeFriend() {
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
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Ruta de integración</p>
          <h1 className="section-title">Amigos en ruta</h1>
          <p className="text-sm text-secondary mt-1">
            Acompaña cada historia desde el primer contacto hasta su
            integración.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          {showForm ? "Cerrar registro" : "Registrar amigo"}
        </button>
      </header>
      {error && (
        <p
          role="alert"
          className="text-sm text-danger bg-danger-bg rounded p-3"
        >
          {error}
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
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">
            Etapas configuradas
          </p>
          <p className="text-2xl font-semibold mt-3">{etapas.length}</p>
        </div>
      </section>
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
          <aside className="card p-5 lg:sticky lg:top-24">
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
            <div className="mt-4 grid gap-2">
              <label className="text-sm">
                Categoría al convertir
                <select
                  className="input-field mt-1.5"
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
              <button
                type="button"
                disabled={saving}
                onClick={markConverted}
                className="btn-secondary justify-center"
              >
                <CheckCircle2 className="w-4 h-4" />
                {selected.convertido
                  ? "Reabrir seguimiento"
                  : "Marcar como convertido"}
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
                        {new Date(note.created_at).toLocaleString("es-CO")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted py-3">Aún no hay notas.</p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
