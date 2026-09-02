import { useEffect, useState } from 'react'
import { Plus, Search, UserRound, Phone, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

export default function Personas() {
  const pageSize = 50
  const { rolPrincipal } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const [personas, setPersonas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(0)
  const [totalPersonas, setTotalPersonas] = useState(0)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nombres: '', apellidos: '', telefono: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!congregacionId) return
    let query = supabase.from('personas').select('id, nombres, apellidos, telefono, created_at', { count: 'exact' }).eq('congregacion_id', congregacionId).order('nombres').order('id').range(page * pageSize, page * pageSize + pageSize - 1)
    if (busqueda.trim()) query = query.or(`nombres.ilike.%${busqueda.trim()}%,apellidos.ilike.%${busqueda.trim()}%`)
    const { data, count, error: loadError } = await query
    if (loadError) setError('No se pudieron cargar las personas.')
    setPersonas(data ?? [])
    setTotalPersonas(count ?? 0)
  }

  useEffect(() => { load() }, [congregacionId, page, busqueda])
  useEffect(() => { setPage(0) }, [busqueda])

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

  const totalPages = Math.max(1, Math.ceil(totalPersonas / pageSize))
  const filtradas = personas

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Directorio</p>
          <h1 className="section-title">Personas</h1>
          <p className="text-sm text-secondary mt-1">Miembros y responsables de tu congregación.</p>
        </div>
        <button onClick={() => setMostrarForm(!mostrarForm)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Registrar persona
        </button>
      </header>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Total</p>
          <p className="mt-3 text-2xl font-semibold">{totalPersonas}</p>
        </div>
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Coincidencias</p>
          <p className="mt-3 text-2xl font-semibold">{totalPersonas}</p>
        </div>
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Con teléfono</p>
          <p className="mt-3 text-2xl font-semibold">{personas.filter((person) => person.telefono).length}</p>
        </div>
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Sin teléfono</p>
          <p className="mt-3 text-2xl font-semibold">{personas.filter((person) => !person.telefono).length}</p>
        </div>
      </section>

      {mostrarForm && (
        <form onSubmit={agregarPersona} className="card p-5 grid sm:grid-cols-3 gap-3 items-end">
          <label className="text-sm">
            Nombres
            <input required className="input-field mt-1.5" value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} />
          </label>
          <label className="text-sm">
            Apellidos
            <input required className="input-field mt-1.5" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
          </label>
          <label className="text-sm">
            Teléfono
            <input className="input-field mt-1.5" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </label>
          <button disabled={saving} className="btn-secondary sm:col-start-3 justify-center">{saving ? 'Guardando...' : 'Guardar persona'}</button>
        </form>
      )}

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Search className="w-4 h-4 text-muted" />
          <input aria-label="Buscar personas" className="bg-transparent outline-none text-sm flex-1" placeholder="Buscar por nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <span className="text-xs text-muted">{totalPersonas} personas</span>
        </div>

        {filtradas.length === 0 ? (
          <div className="p-10 text-center">
            <UserRound className="w-8 h-8 text-muted mx-auto mb-3" />
            <p className="text-sm text-secondary">Aún no hay personas registradas o no coinciden con la búsqueda.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtradas.map((persona) => (
              <div key={persona.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-1 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-bg text-accent flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{persona.nombres} {persona.apellidos}</p>
                    <p className="text-xs text-secondary mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {persona.telefono || 'Sin teléfono'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-[0.14em] text-secondary">Miembro</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {totalPersonas > 0 && <div className="flex items-center justify-between gap-3 text-xs text-secondary"><span>Página {page + 1} de {totalPages}</span><div className="flex gap-2"><button type="button" disabled={page === 0} onClick={() => setPage((current) => current - 1)} className="btn-secondary px-3">Anterior</button><button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((current) => current + 1)} className="btn-secondary px-3">Siguiente</button></div></div>}
    </div>
  )
}
