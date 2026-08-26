import { useEffect, useState } from 'react'
import { Plus, Search, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

export default function Personas() {
  const { rolPrincipal } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const [personas, setPersonas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nombres: '', apellidos: '', telefono: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!congregacionId) return
    const { data, error: loadError } = await supabase.from('personas').select('id, nombres, apellidos, telefono, created_at').eq('congregacion_id', congregacionId).order('nombres')
    if (loadError) setError('No se pudieron cargar las personas.')
    setPersonas(data ?? [])
  }

  useEffect(() => { load() }, [congregacionId])

  async function agregarPersona(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const { error: insertError } = await supabase.from('personas').insert({ ...form, congregacion_id: congregacionId })
    setSaving(false)
    if (insertError) { setError('No se pudo guardar la persona.'); return }
    setForm({ nombres: '', apellidos: '', telefono: '' })
    setMostrarForm(false)
    load()
  }

  const filtradas = personas.filter((persona) => `${persona.nombres} ${persona.apellidos}`.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Directorio</p><h1 className="text-2xl font-semibold">Personas</h1><p className="text-sm text-secondary mt-1">Miembros y responsables de tu congregación.</p></div>
        <button onClick={() => setMostrarForm(!mostrarForm)} className="btn-primary"><Plus className="w-4 h-4" /> Nueva persona</button>
      </div>

      {mostrarForm && <form onSubmit={agregarPersona} className="card p-5 grid sm:grid-cols-3 gap-3 items-end">
        <label className="text-sm">Nombres<input required className="input-field mt-1.5" value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} /></label>
        <label className="text-sm">Apellidos<input required className="input-field mt-1.5" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} /></label>
        <label className="text-sm">Teléfono<input className="input-field mt-1.5" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></label>
        <button disabled={saving} className="btn-secondary sm:col-start-3 justify-center">{saving ? 'Guardando...' : 'Guardar persona'}</button>
      </form>}

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2"><Search className="w-4 h-4 text-muted" /><input aria-label="Buscar personas" className="bg-transparent outline-none text-sm flex-1" placeholder="Buscar por nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /><span className="text-xs text-muted">{filtradas.length} personas</span></div>
        {filtradas.length === 0 ? <div className="p-10 text-center"><UserRound className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-sm text-secondary">Aún no hay personas registradas.</p></div> : <div className="divide-y divide-border">{filtradas.map((persona) => <div key={persona.id} className="px-4 py-3 flex justify-between"><div><p className="text-sm font-medium">{persona.nombres} {persona.apellidos}</p><p className="text-xs text-secondary mt-0.5">{persona.telefono || 'Sin teléfono'}</p></div><span className="text-xs text-muted">Miembro</span></div>)}</div>}
      </div>
    </div>
  )
}
