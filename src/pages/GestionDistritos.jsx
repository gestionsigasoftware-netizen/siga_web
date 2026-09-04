import { useEffect, useState } from 'react'
import { MapPin, Plus, PencilLine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'
import Pager from '../components/Pager'
import GeoMap from '../components/charts/GeoMap'
import InfoTip from '../components/InfoTip'

const CONG_PAGE_SIZE = 50

const ALLOWED_LEVELS = ['nacional', 'super_admin']
const EMPTY_FORM = { numero: '', nombre: '' }

function formatDistrictLabel(nombre, numero) {
  if (!nombre) return null
  return numero ? `Distrito ${numero} · ${nombre}` : nombre
}

export default function GestionDistritos() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const [distritos, setDistritos] = useState([])
  const [conteos, setConteos] = useState(new Map())
  const [congregaciones, setCongregaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busqueda, setBusqueda] = useState('')
  const [cambios, setCambios] = useState({})
  const [moviendoId, setMoviendoId] = useState(null)
  const [congPage, setCongPage] = useState(0)

  async function load() {
    setLoading(true)
    setError(null)
    const [{ data: distritosData, error: distritosError }, { data: congregacionesData, error: congregacionesError }] = await Promise.all([
      supabase.from('distritos').select('id, numero, nombre, created_at').order('numero', { ascending: true, nullsFirst: false }).order('nombre'),
      supabase.from('congregaciones').select('id, nombre, ciudad, latitud, longitud, distrito_id, distritos(nombre, numero)').order('nombre'),
    ])
    if (distritosError || congregacionesError) setError('No se pudieron cargar los distritos.')
    setDistritos(distritosData ?? [])
    setCongregaciones(congregacionesData ?? [])
    const mapaConteos = new Map()
    for (const congregacion of congregacionesData ?? []) {
      mapaConteos.set(congregacion.distrito_id, (mapaConteos.get(congregacion.distrito_id) || 0) + 1)
    }
    setConteos(mapaConteos)
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setCongPage(0) }, [busqueda])

  async function moverCongregacion(congregacionId) {
    const nuevoDistritoId = cambios[congregacionId]
    if (!nuevoDistritoId) return
    setMoviendoId(congregacionId)
    setError(null)
    setNotice(null)
    const { error: moveError } = await supabase.rpc('mover_congregacion_distrito', {
      p_congregacion_id: congregacionId,
      p_distrito_destino: nuevoDistritoId,
    })
    setMoviendoId(null)
    if (moveError) {
      setError('No se pudo mover la congregación: ' + moveError.message)
      return
    }
    setNotice('Congregación reasignada correctamente.')
    setCambios((previo) => { const copia = { ...previo }; delete copia[congregacionId]; return copia })
    await load()
  }

  const congregacionesFiltradas = congregaciones.filter((congregacion) =>
    congregacion.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
  )
  const congPageCount = Math.max(1, Math.ceil(congregacionesFiltradas.length / CONG_PAGE_SIZE))
  const congPageSafe = Math.min(congPage, congPageCount - 1)
  const congregacionesPagina = congregacionesFiltradas.slice(congPageSafe * CONG_PAGE_SIZE, congPageSafe * CONG_PAGE_SIZE + CONG_PAGE_SIZE)

  const porCiudad = (() => {
    const mapa = new Map()
    for (const congregacion of congregaciones) {
      const ciudad = (congregacion.ciudad || '').trim()
      if (!ciudad) continue
      const clave = ciudad.toLowerCase()
      if (!mapa.has(clave)) mapa.set(clave, { ciudad, congregaciones: 0, distritos: new Set() })
      const entrada = mapa.get(clave)
      entrada.congregaciones += 1
      if (congregacion.distritos?.numero) entrada.distritos.add(congregacion.distritos.numero)
    }
    return [...mapa.values()].map((item) => ({ ...item, distritos: item.distritos.size })).sort((a, b) => b.congregaciones - a.congregaciones)
  })()
  const sinCiudad = congregaciones.filter((congregacion) => !congregacion.ciudad?.trim()).length
  const puntosMapa = congregaciones.map((congregacion) => ({
    id: congregacion.id,
    label: congregacion.nombre,
    valor: 1,
    latitud: congregacion.latitud,
    longitud: congregacion.longitud,
    detalle: [congregacion.ciudad, formatDistrictLabel(congregacion.distritos?.nombre, congregacion.distritos?.numero)].filter(Boolean).join(' · '),
  }))

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
        <label className="text-sm"><span className="flex items-center gap-1">Número<InfoTip texto="Número oficial del distrito dentro de los 36 de la IPUC en Colombia. No puede repetirse entre distritos." /></span><input type="number" min="1" max="36" className="input-field mt-1.5" value={form.numero} onChange={(event) => setForm({ ...form, numero: event.target.value })} /></label>
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

      <section className="card overflow-hidden">
        <header className="p-5 pb-0 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-medium">Congregaciones por distrito</h2>
            <p className="text-sm text-secondary mt-0.5">Reasigna una congregación a su distrito real cuando quedó bajo uno incorrecto (por ejemplo, un distrito de prueba).</p>
          </div>
          <input
            className="input-field w-full sm:w-64"
            placeholder="Buscar congregación..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </header>
        {loading ? (
          <div className="module-loading" role="status"><span className="loading-dot" />Cargando congregaciones...</div>
        ) : congregacionesFiltradas.length === 0 ? (
          <div className="p-10 text-center"><MapPin className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-sm text-secondary">No hay congregaciones que coincidan.</p></div>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="font-normal px-5 py-3">Congregación</th>
                  <th className="font-normal px-5 py-3">Distrito actual</th>
                  <th className="font-normal px-5 py-3">Nuevo distrito</th>
                  <th className="font-normal px-5 py-3 text-right"><span className="flex items-center justify-end gap-1.5">Acciones<InfoTip texto="Al mover una congregación, sus estadísticas y comités empiezan a contar para el distrito nuevo, no para el actual." /></span></th>
                </tr>
              </thead>
              <tbody>
                {congregacionesPagina.map((congregacion) => {
                  const distritoActual = formatDistrictLabel(congregacion.distritos?.nombre, congregacion.distritos?.numero) || '—'
                  const cambioPendiente = cambios[congregacion.id]
                  return (
                    <tr key={congregacion.id} className="border-t border-border">
                      <td className="px-5 py-3 font-medium">{congregacion.nombre}{congregacion.ciudad ? <span className="text-muted font-normal"> · {congregacion.ciudad}</span> : null}</td>
                      <td className="px-5 py-3 text-secondary">{distritoActual}</td>
                      <td className="px-5 py-3">
                        <select
                          className="input-field"
                          value={cambioPendiente ?? congregacion.distrito_id ?? ''}
                          onChange={(event) => setCambios((previo) => ({ ...previo, [congregacion.id]: event.target.value }))}
                        >
                          {distritos.map((distrito) => (
                            <option key={distrito.id} value={distrito.id}>{formatDistrictLabel(distrito.nombre, distrito.numero)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={!cambioPendiente || cambioPendiente === congregacion.distrito_id || moviendoId === congregacion.id}
                          onClick={() => moverCongregacion(congregacion.id)}
                        >
                          {moviendoId === congregacion.id ? 'Moviendo...' : 'Mover'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 border-t border-border">
          <Pager page={congPageSafe} totalPages={congPageCount} total={congregacionesFiltradas.length} onPrev={() => setCongPage((current) => current - 1)} onNext={() => setCongPage((current) => current + 1)} label="congregaciones" />
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <header className="p-5 pb-3">
            <h2 className="font-medium">Congregaciones por ciudad</h2>
            <p className="text-sm text-secondary mt-0.5">Cuántas congregaciones hay en cada ciudad, y de cuántos distritos distintos vienen — útil cuando una misma ciudad tiene congregaciones de varios distritos (ej. Cali).{sinCiudad > 0 && ` ${sinCiudad} congregación(es) sin ciudad registrada no aparecen aquí.`}</p>
          </header>
          {porCiudad.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">Aún no hay congregaciones con ciudad registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted bg-surface-1">
                    <th className="font-normal px-5 py-3">Ciudad</th>
                    <th className="font-normal px-5 py-3 text-right">Congregaciones</th>
                    <th className="font-normal px-5 py-3 text-right">Distritos</th>
                  </tr>
                </thead>
                <tbody>
                  {porCiudad.map((item) => (
                    <tr key={item.ciudad} className="border-t border-border">
                      <td className="px-5 py-3 font-medium">{item.ciudad}</td>
                      <td className="px-5 py-3 text-right">{item.congregaciones}</td>
                      <td className="px-5 py-3 text-right text-secondary">{item.distritos || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-medium">Mapa nacional de congregaciones</h2>
          <p className="text-sm text-secondary mt-0.5">Ubicación aproximada, según la dirección que cada congregación registró en Configuración local.</p>
          <div className="mt-4">
            <GeoMap points={puntosMapa} height={420} />
          </div>
        </div>
      </section>
    </div>
  )
}
