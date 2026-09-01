import { useEffect, useState } from 'react'
import { MapPin, Plus, PencilLine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

const ALLOWED_LEVELS = ['nacional', 'super_admin']
const EMPTY_FORM = { numero: '', nombre: '' }

export default function GestionDistritos() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const [distritos, setDistritos] = useState([])
  const [conteos, setConteos] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  async function load() {
    setLoading(true)
    setError(null)
    const [{ data: distritosData, error: distritosError }, { data: congregacionesData, error: congregacionesError }] = await Promise.all([
      supabase.from('distritos').select('id, numero, nombre, created_at').order('numero', { ascending: true, nullsFirst: false }).order('nombre'),
      supabase.from('congregaciones').select('distrito_id'),
    ])
    if (distritosError || congregacionesError) setError('No se pudieron cargar los distritos.')
    setDistritos(distritosData ?? [])
    const mapaConteos = new Map()
    for (const congregacion of congregacionesData ?? []) {
      mapaConteos.set(congregacion.distrito_id, (mapaConteos.get(congregacion.distrito_id) || 0) + 1)
    }
    setConteos(mapaConteos)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function editDistrito(distrito) {
    setEditingId(distrito.id)
    setForm({ numero: distrito.numero ?? '', nombre: distrito.nombre })
  }

  async function saveDistrito(event) {
    event.preventDefault()
    if (!form.nombre.trim()) {
      setError('El nombre del distrito es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    const payload = { nombre: form.nombre.trim(), numero: form.numero === '' ? null : Number(form.numero) }
    const { error: saveError } = editingId
      ? await supabase.from('distritos').update(payload).eq('id', editingId)
      : await supabase.from('distritos').insert(payload)
    setSaving(false)
    if (saveError) {
      setError(saveError.code === '23505' ? 'Ese número de distrito ya está en uso.' : 'No se pudo guardar el distrito.')
      return
    }
    setNotice(editingId ? 'Distrito actualizado correctamente.' : 'Distrito creado correctamente.')
    resetForm()
    await load()
  }

  if (roleLoading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando catálogo de distritos...</div>
  if (!ALLOWED_LEVELS.includes(rolPrincipal?.nivel)) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Este catálogo es exclusivo de nacional/super_admin.</p>

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">Administración nacional</p>
        <h1 className="section-title">Catálogo de distritos</h1>
        <p className="text-sm text-secondary mt-0.5">Los 36 distritos de la IPUC, identificados por número. Cada congregación pertenece a uno de estos distritos.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <form onSubmit={saveDistrito} className="card p-5 grid sm:grid-cols-4 gap-3 items-end">
        <div className="sm:col-span-4 flex items-center justify-between gap-3">
          <h2 className="font-medium">{editingId ? 'Editar distrito' : 'Nuevo distrito'}</h2>
          {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancelar edición</button>}
        </div>
        <label className="text-sm">Número<input type="number" min="1" max="36" className="input-field mt-1.5" value={form.numero} onChange={(event) => setForm({ ...form, numero: event.target.value })} /></label>
        <label className="text-sm sm:col-span-2">Nombre<input required className="input-field mt-1.5" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label>
        <button disabled={saving} className="btn-primary">
          {editingId ? <PencilLine className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear distrito'}
        </button>
      </form>

      <section className="card overflow-hidden">
        {loading ? (
          <div className="module-loading" role="status"><span className="loading-dot" />Cargando distritos...</div>
        ) : distritos.length === 0 ? (
          <div className="p-10 text-center"><MapPin className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-sm text-secondary">Aún no hay distritos registrados.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="font-normal px-5 py-3">Número</th>
                  <th className="font-normal px-5 py-3">Nombre</th>
                  <th className="font-normal px-5 py-3">Congregaciones</th>
                  <th className="font-normal px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {distritos.map((distrito) => (
                  <tr key={distrito.id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{distrito.numero ?? '—'}</td>
                    <td className="px-5 py-3">{distrito.nombre}</td>
                    <td className="px-5 py-3 text-secondary">{conteos.get(distrito.id) || 0}</td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" className="text-accent text-xs" onClick={() => editDistrito(distrito)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
