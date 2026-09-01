import { useEffect, useState } from "react";
import { Heart, Plus, UsersRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";

const TIPO_ACTIVIDAD_LABELS = { visita: "Visita", social: "Social", espiritual: "Espiritual", otro: "Otro" };

export default function DamasDorcas() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [beneficiarias, setBeneficiarias] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [beneficiariaForm, setBeneficiariaForm] = useState({ nombres: "", apellidos: "", telefono: "", direccion: "", responsable_persona_id: "" });
  const [selectedActividadId, setSelectedActividadId] = useState(null);
  const [actividadForm, setActividadForm] = useState({ fecha: new Date().toISOString().slice(0, 10), tipo: "visita", descripcion: "", responsable_persona_id: "" });
  const [asistenciaMarcada, setAsistenciaMarcada] = useState({});

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError("Tu usuario no tiene una congregación local asignada.");
      return;
    }
    setLoading(true);
    setError(null);
    const [b, a, p] = await Promise.all([
      supabase.from("damas_dorcas_beneficiarias").select("id, nombres, apellidos, telefono, direccion, estado, responsable_persona_id, personas:responsable_persona_id(nombres, apellidos)").eq("congregacion_id", congregacionId).order("nombres"),
      supabase.from("damas_dorcas_actividades").select("id, fecha, tipo, descripcion, responsable_persona_id").eq("congregacion_id", congregacionId).order("fecha", { ascending: false }),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
    ]);
    const failed = [b, a, p].find((item) => item.error);
    if (failed) setError("No se pudo cargar Damas Dorcas. Intenta nuevamente o contacta al administrador.");
    setBeneficiarias(b.data ?? []);
    setActividades(a.data ?? []);
    setPersonas(p.data ?? []);
    setLoading(false);
  }

  async function createBeneficiaria(event) {
    event.preventDefault();
    if (!canEdit || !beneficiariaForm.nombres.trim() || !beneficiariaForm.apellidos.trim()) return;
    setSaving(true); setError(null);
    const result = await supabase.from("damas_dorcas_beneficiarias").insert({
      congregacion_id: congregacionId,
      nombres: beneficiariaForm.nombres.trim(),
      apellidos: beneficiariaForm.apellidos.trim(),
      telefono: beneficiariaForm.telefono.trim() || null,
      direccion: beneficiariaForm.direccion.trim() || null,
      responsable_persona_id: beneficiariaForm.responsable_persona_id || null,
    });
    setSaving(false);
    if (result.error) { setError("No se pudo registrar a la beneficiaria."); return; }
    setNotice("Beneficiaria registrada.");
    setBeneficiariaForm({ nombres: "", apellidos: "", telefono: "", direccion: "", responsable_persona_id: "" });
    load();
  }

  async function createActividad(event) {
    event.preventDefault();
    if (!canEdit) return;
    const activas = beneficiarias.filter((item) => item.estado === "activa");
    setSaving(true); setError(null);
    const actividadResult = await supabase.from("damas_dorcas_actividades").insert({
      congregacion_id: congregacionId,
      fecha: actividadForm.fecha,
      tipo: actividadForm.tipo,
      descripcion: actividadForm.descripcion.trim() || null,
      responsable_persona_id: actividadForm.responsable_persona_id || null,
    }).select("id").single();
    if (actividadResult.error) { setSaving(false); setError(`No se pudo registrar la actividad: ${actividadResult.error.message}`); return; }
    if (activas.length > 0) {
      const asistenciaResult = await supabase.from("damas_dorcas_asistencia").insert(
        activas.map((beneficiaria) => ({ actividad_id: actividadResult.data.id, beneficiaria_id: beneficiaria.id, asistio: Boolean(asistenciaMarcada[beneficiaria.id]) })),
      );
      if (asistenciaResult.error) { setSaving(false); setError(`La actividad se guardó, pero no se pudo registrar la asistencia individual: ${asistenciaResult.error.message}`); return; }
    }
    setSaving(false);
    setNotice("Actividad registrada con asistencia individual.");
    setActividadForm({ fecha: new Date().toISOString().slice(0, 10), tipo: "visita", descripcion: "", responsable_persona_id: "" });
    setAsistenciaMarcada({});
    load();
  }

  useEffect(() => { load(); }, [congregacionId]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "damas_dorcas.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando Damas Dorcas...</div>;

  const activas = beneficiarias.filter((item) => item.estado === "activa");
  const actividadesUltimoMes = actividades.filter((item) => item.fecha >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">Trabajo con mujeres</p>
        <h1 className="section-title">Damas Dorcas</h1>
        <p className="text-sm text-secondary mt-1">Trabajo evangelístico, social y espiritual con mujeres de la congregación y su entorno.</p>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {!canEdit && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Tienes acceso de consulta. Las altas y modificaciones requieren el permiso de edición de Damas Dorcas.</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Beneficiarias activas</p><p className="text-2xl font-semibold mt-3">{activas.length}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Actividades (30 días)</p><p className="text-2xl font-semibold mt-3">{actividadesUltimoMes.length}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Total registradas</p><p className="text-2xl font-semibold mt-3">{beneficiarias.length}</p></div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">Censo</p><h2 className="font-medium mt-1">Beneficiarias</h2></div>
            <UsersRound className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4 max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">Nombre</th><th className="py-2">Responsable</th><th className="py-2">Estado</th></tr></thead>
              <tbody>
                {beneficiarias.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="py-2 font-medium">{item.nombres} {item.apellidos}</td>
                    <td className="py-2 text-secondary">{item.personas ? `${item.personas.nombres} ${item.personas.apellidos}` : "Sin asignar"}</td>
                    <td className="py-2"><span className="text-xs px-2 py-1 rounded bg-accent-bg text-accent">{item.estado === "activa" ? "Activa" : "Inactiva"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!beneficiarias.length && <p className="text-sm text-secondary py-6 text-center">Aún no hay beneficiarias registradas.</p>}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow">Trabajo realizado</p><h2 className="font-medium mt-1">Actividades</h2></div>
            <Heart className="w-5 h-5 text-accent" />
          </div>
          <div className="flex flex-col divide-y divide-border mt-4 max-h-64 overflow-y-auto">
            {actividades.map((item) => (
              <div key={item.id} className="py-2">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{TIPO_ACTIVIDAD_LABELS[item.tipo] || item.tipo}</p>
                  <span className="text-xs text-secondary">{item.fecha}</span>
                </div>
                {item.descripcion && <p className="text-xs text-secondary mt-1">{item.descripcion}</p>}
              </div>
            ))}
            {!actividades.length && <p className="text-sm text-muted py-6">Aún no hay actividades registradas.</p>}
          </div>
          {canEdit && <form onSubmit={createActividad} className="border-t border-border mt-4 pt-4 grid gap-2">
            <p className="text-sm font-medium mb-1">Registrar actividad</p>
            <div className="grid grid-cols-2 gap-2">
              <input required type="date" className="input-field" value={actividadForm.fecha} onChange={(event) => setActividadForm({ ...actividadForm, fecha: event.target.value })} />
              <select className="input-field" value={actividadForm.tipo} onChange={(event) => setActividadForm({ ...actividadForm, tipo: event.target.value })}>
                {Object.entries(TIPO_ACTIVIDAD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <textarea className="input-field min-h-14" placeholder="Descripción" value={actividadForm.descripcion} onChange={(event) => setActividadForm({ ...actividadForm, descripcion: event.target.value })} />
            <select className="input-field" value={actividadForm.responsable_persona_id} onChange={(event) => setActividadForm({ ...actividadForm, responsable_persona_id: event.target.value })}>
              <option value="">Responsable</option>
              {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
            </select>
            {activas.length > 0 && <div>
              <p className="text-xs text-secondary mb-1">Asistencia individual</p>
              <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                {activas.map((beneficiaria) => <label key={beneficiaria.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[beneficiaria.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [beneficiaria.id]: event.target.checked })} />{beneficiaria.nombres} {beneficiaria.apellidos}</label>)}
              </div>
            </div>}
            <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />Registrar actividad</button>
          </form>}
        </div>
      </section>

      <form onSubmit={createBeneficiaria} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
        <h2 className="font-medium">Nueva beneficiaria</h2>
        <div className="grid grid-cols-2 gap-2">
          <input required className="input-field" placeholder="Nombres" value={beneficiariaForm.nombres} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, nombres: event.target.value })} />
          <input required className="input-field" placeholder="Apellidos" value={beneficiariaForm.apellidos} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, apellidos: event.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input-field" placeholder="Teléfono" value={beneficiariaForm.telefono} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, telefono: event.target.value })} />
          <input className="input-field" placeholder="Dirección" value={beneficiariaForm.direccion} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, direccion: event.target.value })} />
        </div>
        <select className="input-field" value={beneficiariaForm.responsable_persona_id} onChange={(event) => setBeneficiariaForm({ ...beneficiariaForm, responsable_persona_id: event.target.value })}>
          <option value="">Responsable de seguimiento</option>
          {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
        </select>
        <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> Registrar beneficiaria</button>
      </form>
    </div>
  );
}
