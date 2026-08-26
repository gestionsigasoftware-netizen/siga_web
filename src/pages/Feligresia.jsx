import { useEffect, useState } from 'react'
import { BarChart3, HeartHandshake, Plus, Search, UsersRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

const ESTADOS = { activo: 'Activo', apartado: 'Apartado', trasladado: 'Trasladado', inactivo: 'Inactivo', fallecido: 'Fallecido' }

function Metric({ label, value, tone = 'default' }) {
  const text = tone === 'accent' ? 'text-accent-dark' : 'text-ink'
  const marker = tone === 'accent' ? 'bg-accent' : 'bg-muted'
  return <div className={`summary-card summary-card-${tone === 'accent' ? 'default' : 'muted'} stat-tile`}><div className="flex items-center justify-between gap-3"><p className="text-[10px] uppercase tracking-[0.16em] text-secondary">{label}</p><span className={`summary-marker ${marker}`} aria-hidden="true" /></div><p className={`text-3xl font-semibold tracking-tight mt-3 ${text}`}>{value}</p></div>
}

export default function Feligresia() {
  const { rolPrincipal } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const [personas, setPersonas] = useState([])
  const [familias, setFamilias] = useState([])
  const [comites, setComites] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('todos')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombres: '', apellidos: '', telefono: '', estado_membresia: 'activo', bautizado: false, fecha_bautismo: '', familia_id: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!congregacionId) return
    const [{ data: people, error: peopleError }, { data: familyData }, { data: committeeData }] = await Promise.all([
      supabase.from('personas').select('id, nombres, apellidos, telefono, estado_membresia, bautizado, fecha_bautismo, familia_id, familias(nombre_familia)').eq('congregacion_id', congregacionId).order('nombres'),
      supabase.from('familias').select('id, nombre_familia').eq('congregacion_id', congregacionId).order('nombre_familia'),
      supabase.from('comites').select('id, nombre, membresias_comite(id)').eq('congregacion_id', congregacionId).eq('activo', true).order('nombre'),
    ])
    if (peopleError) setError('No se pudo cargar el censo de feligresía.')
    setPersonas(people ?? []); setFamilias(familyData ?? []); setComites(committeeData ?? [])
  }
  useEffect(() => { load() }, [congregacionId])

  async function addPerson(event) {
    event.preventDefault(); setSaving(true); setError(null)
    const payload = { ...form, congregacion_id: congregacionId, bautizado: Boolean(form.bautizado), fecha_bautismo: form.fecha_bautismo || null, familia_id: form.familia_id || null }
    const { error: insertError } = await supabase.from('personas').insert(payload)
    setSaving(false)
    if (insertError) { setError('No se pudo guardar la persona.'); return }
    setForm({ nombres: '', apellidos: '', telefono: '', estado_membresia: 'activo', bautizado: false, fecha_bautismo: '', familia_id: '' }); setShowForm(false); load()
  }

  const filtered = personas.filter((person) => (estado === 'todos' || person.estado_membresia === estado) && `${person.nombres} ${person.apellidos}`.toLowerCase().includes(busqueda.toLowerCase()))
  const activos = personas.filter((person) => person.estado_membresia === 'activo').length
  const bautizados = personas.filter((person) => person.bautizado).length
  const apartados = personas.filter((person) => person.estado_membresia === 'apartado').length
  const familiasConMiembros = new Set(personas.map((person) => person.familia_id).filter(Boolean)).size

  return <div className="flex flex-col gap-6"><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Censo administrativo</p><h1 className="text-2xl font-semibold">Feligresía</h1><p className="text-sm text-secondary mt-1">Conoce, acompaña y administra la población de tu congregación.</p></div><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus className="w-4 h-4" /> Registrar persona</button></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric label="Personas activas" value={activos} tone="accent" /><Metric label="Bautizados" value={bautizados} /><Metric label="Apartados" value={apartados} /><Metric label="Familias" value={familiasConMiembros} /></div>{showForm && <form onSubmit={addPerson} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end"><label className="text-sm">Nombres<input required className="input-field mt-1.5" value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} /></label><label className="text-sm">Apellidos<input required className="input-field mt-1.5" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} /></label><label className="text-sm">Teléfono<input className="input-field mt-1.5" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></label><label className="text-sm">Estado<select className="input-field mt-1.5" value={form.estado_membresia} onChange={(e) => setForm({ ...form, estado_membresia: e.target.value })}>{Object.entries(ESTADOS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm">Familia<select className="input-field mt-1.5" value={form.familia_id} onChange={(e) => setForm({ ...form, familia_id: e.target.value })}><option value="">Sin familia</option>{familias.map((family) => <option key={family.id} value={family.id}>{family.nombre_familia}</option>)}</select></label><label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={form.bautizado} onChange={(e) => setForm({ ...form, bautizado: e.target.checked })} /> Bautizado</label><label className="text-sm">Fecha de bautismo<input type="date" className="input-field mt-1.5" value={form.fecha_bautismo} onChange={(e) => setForm({ ...form, fecha_bautismo: e.target.value })} /></label><button disabled={saving} className="btn-secondary justify-center lg:col-start-3">{saving ? 'Guardando...' : 'Guardar en el censo'}</button></form>}{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}<section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4"><div className="card overflow-hidden"><div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3"><div className="flex items-center gap-2 flex-1"><Search className="w-4 h-4 text-muted" /><input aria-label="Buscar en la feligresía" className="bg-transparent outline-none text-sm w-full" placeholder="Buscar persona..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div><select aria-label="Filtrar por estado" className="input-field sm:max-w-[160px]" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="todos">Todos los estados</option>{Object.entries(ESTADOS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{filtered.length ? <div className="divide-y divide-border">{filtered.map((person) => <div key={person.id} className="px-4 py-3 flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{person.nombres} {person.apellidos}</p><p className="text-xs text-secondary mt-1">{person.bautizado ? 'Bautizado' : 'En proceso'}{person.familias?.nombre_familia ? ` · ${person.familias.nombre_familia}` : ''}</p></div><span className={`text-xs px-2 py-1 rounded ${person.estado_membresia === 'activo' ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'}`}>{ESTADOS[person.estado_membresia]}</span></div>)}</div> : <div className="p-10 text-center"><UsersRound className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-sm text-secondary">No hay personas con estos filtros.</p></div>}</div><div className="flex flex-col gap-4"><div className="card p-5"><div className="flex items-center gap-3 mb-4"><BarChart3 className="w-5 h-5 text-accent" /><div><h2 className="font-medium">Lectura del censo</h2><p className="text-xs text-secondary mt-1">Señales para el acompañamiento local.</p></div></div><div className="flex flex-col gap-3 text-sm"><p className="flex justify-between"><span className="text-secondary">Bautizados</span><strong>{personas.length ? Math.round((bautizados / personas.length) * 100) : 0}%</strong></p><p className="flex justify-between"><span className="text-secondary">Con familia asociada</span><strong>{personas.length ? Math.round((familiasConMiembros / personas.length) * 100) : 0}%</strong></p><p className="flex justify-between"><span className="text-secondary">Personas apartadas</span><strong>{personas.length ? Math.round((apartados / personas.length) * 100) : 0}%</strong></p></div></div><div className="card p-5"><div className="flex items-center gap-3 mb-3"><HeartHandshake className="w-5 h-5 text-success" /><h2 className="font-medium">Comités activos</h2></div>{comites.length ? <div className="flex flex-col gap-2">{comites.map((committee) => <div key={committee.id} className="flex justify-between text-sm"><span>{committee.nombre}</span><span className="text-muted">{committee.membresias_comite?.length ?? 0} integrantes</span></div>)}</div> : <p className="text-sm text-muted">Aún no hay comités registrados.</p>}</div></div></section></div>
}
