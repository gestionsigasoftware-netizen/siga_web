import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'
import { useUndoDelete } from '../hooks/useUndoDelete'
import { geocodeAddress } from '../lib/geocoding'
import UndoToast from '../components/UndoToast'
import InfoTip from '../components/InfoTip'

function ListaCatalogo({ titulo, items, onAdd, onRemove, placeholder, busy }) {
  const [valor, setValor] = useState('')
  return (
    <div className="card p-5">
      <h3 className="font-medium mb-3">{titulo}</h3>
      <div className="flex flex-col gap-1.5 mb-3">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between items-center text-sm py-1.5 px-2.5 bg-surface-1 rounded">
            <span>{item.nombre}</span>
            <button type="button" aria-label={`Eliminar ${item.nombre}`} title={`Eliminar ${item.nombre}`} disabled={busy} onClick={() => onRemove(item)} className="text-muted hover:text-danger disabled:opacity-50">
              <Trash2 className="w-[15px] h-[15px]" />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted">Sin valores aún.</p>}
      </div>
      <div className="flex gap-2">
        <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={placeholder} className="input-field flex-1" />
        <button
          type="button"
          disabled={busy}
          onClick={async () => { if (valor.trim() && await onAdd(valor.trim())) setValor('') }}
          className="btn-secondary px-3"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function ListaCargosComite({ items, onAdd, onRemove, busy }) {
  const [form, setForm] = useState({ nombre: '', codigo: '', requiere_sellado: false })
  return <div className="card p-5"><h3 className="font-medium mb-3">Cargos de comité</h3><p className="text-xs text-secondary mb-3">Estar bautizado es obligatorio para cualquier cargo. Marca "Requiere sellado" para cargos que además exigen estar sellado con el Espíritu Santo (ej. presidente, secretario, tesorero, músico).</p><div className="flex flex-col gap-1.5 mb-3">{items.map((item) => <div key={item.id} className="flex justify-between items-center text-sm py-1.5 px-2.5 bg-surface-1 rounded"><span>{item.nombre} <small className="text-muted">({item.codigo})</small>{item.requiere_sellado && <small className="text-accent ml-1.5">+ sellado</small>}</span><button type="button" aria-label={`Eliminar ${item.nombre}`} title={`Eliminar ${item.nombre}`} disabled={busy} onClick={() => onRemove(item)} className="text-muted hover:text-danger disabled:opacity-50"><Trash2 className="w-[15px] h-[15px]" /></button></div>)}{items.length === 0 && <p className="text-xs text-muted">Sin cargos aún.</p>}</div><div className="grid grid-cols-2 gap-2"><input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} placeholder="Nombre del cargo" className="input-field" /><input value={form.codigo} onChange={(event) => setForm({ ...form, codigo: event.target.value })} placeholder="Código" className="input-field" /></div><label className="flex items-center gap-2 text-xs text-secondary mt-2"><input type="checkbox" checked={form.requiere_sellado} onChange={(event) => setForm({ ...form, requiere_sellado: event.target.checked })} />Requiere estar sellado con el Espíritu Santo</label><button type="button" disabled={busy} onClick={async () => { if (form.nombre.trim() && form.codigo.trim() && await onAdd(form)) setForm({ nombre: '', codigo: '', requiere_sellado: false }) }} className="btn-secondary mt-2"><Plus className="w-4 h-4" /> Agregar cargo</button></div>
}

export default function Configuracion() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id

  const [categorias, setCategorias] = useState([])
  const [modulos, setModulos] = useState([])
  const [etapas, setEtapas] = useState([])
  const [tiposComite, setTiposComite] = useState([])
  const [cargosComite, setCargosComite] = useState([])
  const [organizacion, setOrganizacion] = useState({ nombre: '', distrito: '', ciudad: '', direccion: '' })
  const [preferencias, setPreferencias] = useState({ umbral_alerta: 15, modulo_predeterminado: '', exigir_responsable: true, exigir_novedades: false })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function loadAll() {
    if (!congregacionId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const [cat, mod, et, congregation, typeResult, committeeCargoResult] = await Promise.all([
      supabase.from('categorias_demograficas').select('id, nombre, orden').eq('congregacion_id', congregacionId).order('orden'),
      supabase.from('modulos').select('id, nombre_modulo, activo').eq('congregacion_id', congregacionId),
      supabase.from('etapas_seguimiento').select('id, nombre, orden').eq('congregacion_id', congregacionId).order('orden'),
      supabase.from('congregaciones').select('id, nombre, distrito_id, ciudad, direccion, distritos(nombre)').eq('id', congregacionId).single(),
      supabase.from('tipos_comite').select('id, nombre, codigo').eq('congregacion_id', congregacionId).order('nombre'),
      supabase.from('cargos_comite').select('id, nombre, codigo, requiere_sellado').eq('congregacion_id', congregacionId).order('orden').order('nombre'),
    ])
    const failedCatalog = cat.error ? 'categorías' : mod.error ? 'módulos' : et.error ? 'etapas' : typeResult.error ? 'tipos de comité' : committeeCargoResult.error ? 'cargos de comité' : congregation.error ? 'la información de la congregación' : null
    if (failedCatalog) setError(`No se pudieron cargar las ${failedCatalog}. Intenta nuevamente.`)
    setCategorias(cat.data ?? [])
    setModulos((mod.data ?? []).map((item) => ({ ...item, nombre: item.nombre_modulo })))
    setEtapas(et.data ?? [])
    setTiposComite(typeResult.data ?? [])
    setCargosComite(committeeCargoResult.data ?? [])
    if (congregation.data) setOrganizacion({ nombre: congregation.data.nombre, distrito: congregation.data.distritos?.nombre ?? '', ciudad: congregation.data.ciudad ?? '', direccion: congregation.data.direccion ?? '' })
    const { data: config, error: configError } = await supabase.from('configuracion_congregacion').select('umbral_alerta, modulo_predeterminado, exigir_responsable, exigir_novedades').eq('congregacion_id', congregacionId).maybeSingle()
    if (configError) setError('No se pudieron cargar las preferencias de la congregación.')
    if (config) setPreferencias({ ...config, modulo_predeterminado: config.modulo_predeterminado ?? '' })
    setLoading(false)
  }

  async function guardarPreferencias(event) {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    const { data: congregation, error: congregationError } = await supabase.from('congregaciones').select('distrito_id').eq('id', congregacionId).single()
    if (congregationError) { setSaving(false); setError(`No se pudo cargar la congregación: ${congregationError.message}`); return }
    const ubicacion = organizacion.direccion.trim() ? await geocodeAddress(organizacion.direccion.trim(), organizacion.ciudad.trim()) : null
    const { error: organizationError } = await supabase.from('congregaciones').update({
      nombre: organizacion.nombre.trim(),
      ciudad: organizacion.ciudad.trim() || null,
      direccion: organizacion.direccion.trim() || null,
      latitud: ubicacion?.latitud ?? null,
      longitud: ubicacion?.longitud ?? null,
    }).eq('id', congregacionId)
    if (organizationError) { setSaving(false); setError(`No se pudo guardar el nombre de la congregación: ${organizationError.message}`); return }
    const { error } = await supabase.from('configuracion_congregacion').upsert({ ...preferencias, congregacion_id: congregacionId, modulo_predeterminado: preferencias.modulo_predeterminado || null })
    setSaving(false)
    if (error) setError(`No se pudo guardar la configuración: ${error.message}`)
    else {
      window.dispatchEvent(new CustomEvent('siga:organizacion-actualizada', { detail: { congregation: organizacion.nombre.trim(), district: organizacion.distrito } }))
      setNotice('Información y preferencias de la congregación guardadas.')
    }
  }

  useEffect(() => { loadAll() }, [congregacionId])

  const { pending: pendingUndo, registerDelete, undo } = useUndoDelete(loadAll)

  async function agregarCategoria(nombre) {
    const { error: insertError } = await supabase.from('categorias_demograficas').insert({ congregacion_id: congregacionId, nombre, orden: categorias.length + 1 })
    if (insertError) { setError(`No se pudo agregar la categoría: ${insertError.message}`); return false }
    await loadAll(); return true
  }
  async function quitarCategoria(item) {
    const { error: deleteError } = await supabase.from('categorias_demograficas').delete().eq('id', item.id)
    if (deleteError) { setError(`No se pudo eliminar la categoría: ${deleteError.message}`); return false }
    registerDelete('categorias_demograficas', { ...item, congregacion_id: congregacionId }, item.nombre)
    await loadAll(); return true
  }

  async function agregarEtapa(nombre) {
    const { error: insertError } = await supabase.from('etapas_seguimiento').insert({ congregacion_id: congregacionId, nombre, orden: etapas.length + 1 })
    if (insertError) { setError(`No se pudo agregar la etapa: ${insertError.message}`); return false }
    await loadAll(); return true
  }
  async function quitarEtapa(item) {
    const { error: deleteError } = await supabase.from('etapas_seguimiento').delete().eq('id', item.id)
    if (deleteError) { setError(`No se pudo eliminar la etapa: ${deleteError.message}`); return false }
    registerDelete('etapas_seguimiento', { ...item, congregacion_id: congregacionId }, item.nombre)
    await loadAll(); return true
  }

  async function agregarTipoComite(nombre) { const codigo = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); const { error: insertError } = await supabase.from('tipos_comite').insert({ congregacion_id: congregacionId, nombre, codigo }); if (insertError) { setError(`No se pudo agregar el tipo: ${insertError.message}`); return false } await loadAll(); return true }
  async function quitarTipoComite(item) {
    const { error: deleteError } = await supabase.from('tipos_comite').delete().eq('id', item.id)
    if (deleteError) { setError(`No se pudo eliminar el tipo: ${deleteError.message}`); return false }
    registerDelete('tipos_comite', { ...item, congregacion_id: congregacionId }, item.nombre)
    await loadAll(); return true
  }
  async function agregarCargoComite(values) { const { error: insertError } = await supabase.from('cargos_comite').insert({ congregacion_id: congregacionId, nombre: values.nombre.trim(), codigo: values.codigo.trim(), requiere_sellado: Boolean(values.requiere_sellado) }); if (insertError) { setError(`No se pudo agregar el cargo: ${insertError.message}`); return false } await loadAll(); return true }
  async function quitarCargoComite(item) {
    const { error: deleteError } = await supabase.from('cargos_comite').delete().eq('id', item.id)
    if (deleteError) { setError(`No se pudo eliminar el cargo: ${deleteError.message}`); return false }
    registerDelete('cargos_comite', { ...item, congregacion_id: congregacionId }, item.nombre)
    await loadAll(); return true
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando configuración...</div>
  if (rolPrincipal?.nivel !== 'local' || (rolPrincipal.rol_local && rolPrincipal.rol_local !== 'pastor')) return <div className="card p-8 text-center text-sm text-secondary">No tienes permisos para administrar la configuración de la congregación.</div>

  return (
    <div className="page-shell">
      <div>
        <p className="eyebrow">Administración local</p>
        <h1 className="section-title">Configuración</h1>
        <p className="text-sm text-secondary mt-0.5">
          Catálogos propios de tu congregación — cada congregación de la IPUC configura los suyos de forma independiente.
        </p>
      </div>
      {error && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={loadAll} className="btn-secondary text-xs">Reintentar</button></div>}

      <form onSubmit={guardarPreferencias} className="card p-5 max-w-3xl">
        <div className="mb-5"><h2 className="font-medium">Identidad de la congregación</h2><p className="text-sm text-secondary mt-1">Estos nombres aparecen en el encabezado del equipo de trabajo.</p></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">Nombre de la congregación<input required maxLength={120} className="input-field mt-1.5" value={organizacion.nombre} onChange={(e) => setOrganizacion({ ...organizacion, nombre: e.target.value })} /></label>
          <label className="text-sm">Distrito<input readOnly className="input-field mt-1.5 opacity-75 cursor-default" value={organizacion.distrito} /></label>
          <label className="text-sm">Ciudad/Municipio<input maxLength={120} className="input-field mt-1.5" value={organizacion.ciudad} onChange={(e) => setOrganizacion({ ...organizacion, ciudad: e.target.value })} /></label>
          <label className="text-sm">Dirección<input maxLength={200} placeholder="Calle 5 #23-10, Barrio San Fernando" className="input-field mt-1.5" value={organizacion.direccion} onChange={(e) => setOrganizacion({ ...organizacion, direccion: e.target.value })} /></label>
        </div>
        <p className="text-xs text-muted mt-3">El distrito se muestra como referencia y se administra desde el nivel correspondiente. La dirección se usa para ubicar aproximadamente tu congregación en el mapa nacional.</p>
        <div className="flex items-center gap-4 mt-5"><button disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar información'}</button></div>
      </form>

      <form onSubmit={guardarPreferencias} className="card p-5 max-w-3xl">
        <div className="mb-5"><h2 className="font-medium">Preferencias de la congregación</h2><p className="text-sm text-secondary mt-1">Define cómo se comportan las alertas y los registros de tu equipo.</p></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm flex items-center gap-1">Umbral de alerta por disminución (%)<InfoTip texto="Si la asistencia baja este porcentaje o más frente al registro anterior, el sistema genera una alerta para que la revises." /><input type="number" min="1" max="100" required className="input-field mt-1.5 w-full" value={preferencias.umbral_alerta} onChange={(e) => setPreferencias({ ...preferencias, umbral_alerta: Number(e.target.value) })} /></label>
          <label className="text-sm flex items-center gap-1">Módulo predeterminado<InfoTip texto="El módulo que se abre primero al entrar a registrar asistencia, para ahorrar clics al equipo que más lo usa." /><select className="input-field mt-1.5 w-full" value={preferencias.modulo_predeterminado} onChange={(e) => setPreferencias({ ...preferencias, modulo_predeterminado: e.target.value })}><option value="">Sin preferencia</option>{modulos.filter((modulo) => modulo.activo !== false).map((modulo) => <option key={modulo.id} value={modulo.id}>{modulo.nombre}</option>)}</select></label>
        </div>
        <div className="flex flex-col gap-3 mt-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferencias.exigir_responsable} onChange={(e) => setPreferencias({ ...preferencias, exigir_responsable: e.target.checked })} /> Exigir responsable al registrar asistencia<InfoTip texto="Si lo activas, nadie podrá guardar un registro de asistencia sin indicar quién lo hizo." /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferencias.exigir_novedades} onChange={(e) => setPreferencias({ ...preferencias, exigir_novedades: e.target.checked })} /> Solicitar novedades en cada registro<InfoTip texto="Si lo activas, cada registro de asistencia deberá incluir una nota (aunque sea 'sin novedad') antes de poder guardarse." /></label></div>
        <div className="flex items-center gap-4 mt-5"><button disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar preferencias'}</button>{notice && <p role="status" className="text-sm text-success">{notice}</p>}</div>
      </form>

      <div className="grid md:grid-cols-3 gap-4">
        <ListaCatalogo titulo="Categorías demográficas" items={categorias} onAdd={agregarCategoria} onRemove={quitarCategoria} placeholder="Ej. Matrimonios" busy={saving} />
        <div className="card p-5"><h3 className="font-medium mb-3">Módulos (Ujieres, Evangelismo...)</h3><p className="text-sm text-secondary leading-6">Crear, renombrar y activar o desactivar módulos y sus tipos de actividad se hace ahora desde <Link to="/modulos" className="text-accent">Módulos y actividades</Link>, donde también se administran sus tipos de actividad.</p></div>
        <ListaCatalogo titulo="Etapas de seguimiento de Amigos" items={etapas} onAdd={agregarEtapa} onRemove={quitarEtapa} placeholder="Ej. Bautizado" busy={saving} />
        <div className="card p-5"><h3 className="font-medium mb-3">Zonas de Evangelismo</h3><p className="text-sm text-secondary leading-6">Crear y editar zonas con su responsable se hace ahora desde <Link to="/evangelismo" className="text-accent">Evangelismo</Link>, donde quedan vinculadas al módulo correcto.</p></div>
        <ListaCatalogo titulo="Tipos de comité" items={tiposComite} onAdd={agregarTipoComite} onRemove={quitarTipoComite} placeholder="Ej. Servicio" busy={saving} />
        <ListaCargosComite items={cargosComite} onAdd={agregarCargoComite} onRemove={quitarCargoComite} busy={saving} />
      </div>

      <p className="text-xs text-muted">Los tipos de actividad se administran desde <strong className="text-secondary">Módulos y actividades</strong>, donde puedes crearlos, editarlos y activarlos o desactivarlos.</p>
      <UndoToast pending={pendingUndo} onUndo={undo} />
    </div>
  )
}
