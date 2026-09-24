import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'
import { useUndoDelete } from '../hooks/useUndoDelete'
import { geocodeAddress } from '../lib/geocoding'
import MapaUbicacionEditable from '../components/charts/MapaUbicacionEditable'
import UndoToast from '../components/UndoToast'
import InfoTip from '../components/InfoTip'
import Toast from '../components/Toast'

const configuracionCache = new Map()

function ListaCatalogo({ titulo, items, onAdd, onRemove, onAddBulk, placeholder, busy, info }) {
  const [valor, setValor] = useState('')
  const [bulkValor, setBulkValor] = useState('')
  return (
    <div className="card p-5">
      <h3 className="font-medium mb-3 flex items-center gap-1.5">{titulo}{info && <InfoTip texto={info} />}</h3>
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
      {onAddBulk && (
        <details className="mt-3">
          <summary className="text-xs text-accent cursor-pointer select-none">Agregar varias a la vez (pegar una lista)</summary>
          <div className="flex flex-col gap-2 mt-3">
            <p className="text-xs text-secondary">Un nombre por línea (Enter) o separados por punto y coma <span className="font-mono">;</span> — nunca con coma. Ejemplo: <span className="font-mono">Damas; Jóvenes; Caballeros</span></p>
            <textarea className="input-field min-h-20" placeholder={'Damas\nJóvenes\nCaballeros'} value={bulkValor} onChange={(e) => setBulkValor(e.target.value)} />
            <button
              type="button"
              disabled={busy}
              onClick={async () => { if (bulkValor.trim() && await onAddBulk(bulkValor)) setBulkValor('') }}
              className="btn-secondary self-start px-3"
            >
              Agregar lista
            </button>
          </div>
        </details>
      )}
    </div>
  )
}

function ListaCargosComite({ items, onAdd, onRemove, busy }) {
  const [form, setForm] = useState({ nombre: '', codigo: '', requiere_sellado: false })
  return <div className="card p-5"><h3 className="font-medium mb-3">Cargos de comité</h3><p className="text-xs text-secondary mb-3">Estar bautizado es obligatorio para cualquier cargo. Marca "Requiere sellado" para cargos que además exigen estar sellado con el Espíritu Santo (ej. presidente, secretario, tesorero, músico).</p><div className="flex flex-col gap-1.5 mb-3">{items.map((item) => <div key={item.id} className="flex justify-between items-center text-sm py-1.5 px-2.5 bg-surface-1 rounded"><span>{item.nombre} <small className="text-muted">({item.codigo})</small>{item.requiere_sellado && <small className="text-accent ml-1.5">+ sellado</small>}</span><button type="button" aria-label={`Eliminar ${item.nombre}`} title={`Eliminar ${item.nombre}`} disabled={busy} onClick={() => onRemove(item)} className="text-muted hover:text-danger disabled:opacity-50"><Trash2 className="w-[15px] h-[15px]" /></button></div>)}{items.length === 0 && <p className="text-xs text-muted">Sin cargos aún.</p>}</div><div className="grid grid-cols-2 gap-2"><input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} placeholder="Nombre del cargo" className="input-field" /><input value={form.codigo} onChange={(event) => setForm({ ...form, codigo: event.target.value })} placeholder="Ej: PRES (código corto, sin espacios)" className="input-field" /></div><label className="flex items-center gap-2 text-xs text-secondary mt-2"><input type="checkbox" checked={form.requiere_sellado} onChange={(event) => setForm({ ...form, requiere_sellado: event.target.checked })} />Requiere estar sellado con el Espíritu Santo</label><button type="button" disabled={busy} onClick={async () => { if (form.nombre.trim() && form.codigo.trim() && await onAdd(form)) setForm({ nombre: '', codigo: '', requiere_sellado: false }) }} className="btn-secondary mt-2"><Plus className="w-4 h-4" /> Agregar cargo</button></div>
}

export default function Configuracion() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id

  const [categorias, setCategorias] = useState([])
  const [modulos, setModulos] = useState([])
  const [etapas, setEtapas] = useState([])
  const [tiposComite, setTiposComite] = useState([])
  const [cargosComite, setCargosComite] = useState([])
  const [organizacion, setOrganizacion] = useState({ nombre: '', distrito: '', ciudad: '', direccion: '', latitud: null, longitud: null })
  const [preferencias, setPreferencias] = useState({ umbral_alerta: 15, modulo_predeterminado: '', exigir_responsable: true, exigir_novedades: false })
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [recenterKey, setRecenterKey] = useState(0)
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
    const cacheKey = congregacionId
    const cached = configuracionCache.get(cacheKey)
    if (cached) {
      setCategorias(cached.categorias)
      setModulos(cached.modulos)
      setEtapas(cached.etapas)
      setTiposComite(cached.tiposComite)
      setCargosComite(cached.cargosComite)
      setOrganizacion(cached.organizacion)
      setPreferencias(cached.preferencias)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    const [cat, mod, et, congregation, typeResult, committeeCargoResult] = await Promise.all([
      supabase.from('categorias_demograficas').select('id, nombre, orden').eq('congregacion_id', congregacionId).order('orden'),
      supabase.from('modulos').select('id, nombre_modulo, activo').eq('congregacion_id', congregacionId),
      supabase.from('etapas_seguimiento').select('id, nombre, orden').eq('congregacion_id', congregacionId).order('orden'),
      supabase.from('congregaciones').select('id, nombre, distrito_id, ciudad, direccion, latitud, longitud, distritos(numero)').eq('id', congregacionId).single(),
      supabase.from('tipos_comite').select('id, nombre, codigo').eq('congregacion_id', congregacionId).order('nombre'),
      supabase.from('cargos_comite').select('id, nombre, codigo, requiere_sellado').eq('congregacion_id', congregacionId).order('orden').order('nombre'),
    ])
    const failedCatalog = cat.error ? 'categorías' : mod.error ? 'módulos' : et.error ? 'etapas' : typeResult.error ? 'tipos de comité' : committeeCargoResult.error ? 'cargos de comité' : congregation.error ? 'la información de la congregación' : null
    if (failedCatalog) setError(`No se pudieron cargar las ${failedCatalog}. Intenta nuevamente.`)
    const nuevasCategorias = cat.data ?? []
    const nuevosModulos = (mod.data ?? []).map((item) => ({ ...item, nombre: item.nombre_modulo }))
    const nuevasEtapas = et.data ?? []
    const nuevosTiposComite = typeResult.data ?? []
    const nuevosCargosComite = committeeCargoResult.data ?? []
    setCategorias(nuevasCategorias)
    setModulos(nuevosModulos)
    setEtapas(nuevasEtapas)
    setTiposComite(nuevosTiposComite)
    setCargosComite(nuevosCargosComite)
    let nuevaOrganizacion = organizacion
    if (congregation.data) {
      nuevaOrganizacion = { nombre: congregation.data.nombre, distrito: congregation.data.distritos?.numero ? `Distrito ${congregation.data.distritos.numero}` : '', ciudad: congregation.data.ciudad ?? '', direccion: congregation.data.direccion ?? '', latitud: congregation.data.latitud ?? null, longitud: congregation.data.longitud ?? null }
      setOrganizacion(nuevaOrganizacion)
    }
    const { data: config, error: configError } = await supabase.from('configuracion_congregacion').select('umbral_alerta, modulo_predeterminado, exigir_responsable, exigir_novedades').eq('congregacion_id', congregacionId).maybeSingle()
    if (configError) setError('No se pudieron cargar las preferencias de la congregación.')
    let nuevasPreferencias = preferencias
    if (config) {
      nuevasPreferencias = { ...config, modulo_predeterminado: config.modulo_predeterminado ?? '' }
      setPreferencias(nuevasPreferencias)
    }
    setLoading(false)
    configuracionCache.set(cacheKey, {
      categorias: nuevasCategorias,
      modulos: nuevosModulos,
      etapas: nuevasEtapas,
      tiposComite: nuevosTiposComite,
      cargosComite: nuevosCargosComite,
      organizacion: nuevaOrganizacion,
      preferencias: nuevasPreferencias,
    })
  }

  // La geocodificacion automatica (Nominatim, via geocodeAddress) solo da
  // un punto de partida -- no siempre tiene el detalle de calle de
  // poblaciones pequeñas. Se dispara solo con este boton (nunca en cada
  // guardado) para respetar el uso justo de Nominatim y porque el pin que
  // realmente se guarda es el que quede en el mapa, ajustado a mano si
  // hace falta -- ver MapaUbicacionEditable.
  async function buscarEnMapa() {
    if (!organizacion.direccion.trim() && !organizacion.ciudad.trim()) return
    setGeocoding(true)
    const ubicacion = await geocodeAddress(organizacion.direccion.trim(), organizacion.ciudad.trim())
    setGeocoding(false)
    if (!ubicacion) { setNotice('No se pudo encontrar esa dirección. Marca el punto exacto haciendo clic en el mapa.'); return }
    setOrganizacion((prev) => ({ ...prev, latitud: ubicacion.latitud, longitud: ubicacion.longitud }))
    setRecenterKey((key) => key + 1)
    setNotice(ubicacion.aproximado
      ? 'Se encontró solo una ubicación aproximada por ciudad -- ajusta el pin a la dirección exacta antes de guardar.'
      : 'Ubicación encontrada -- revisa que el pin quede exactamente sobre la congregación y ajústalo si hace falta.')
  }

  async function guardarPreferencias(event) {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    const { error: organizationError } = await supabase.from('congregaciones').update({
      nombre: organizacion.nombre.trim(),
      ciudad: organizacion.ciudad.trim() || null,
      direccion: organizacion.direccion.trim() || null,
      latitud: organizacion.latitud ?? null,
      longitud: organizacion.longitud ?? null,
    }).eq('id', congregacionId)
    if (organizationError) { setSaving(false); setError(`No se pudo guardar el nombre de la congregación: ${organizationError.message}`); return }
    const { error } = await supabase.from('configuracion_congregacion').upsert({ ...preferencias, umbral_alerta: Number(preferencias.umbral_alerta) || 15, congregacion_id: congregacionId, modulo_predeterminado: preferencias.modulo_predeterminado || null })
    setSaving(false)
    if (error) setError(`No se pudo guardar la configuración: ${error.message}`)
    else {
      window.dispatchEvent(new CustomEvent('siga:organizacion-actualizada', { detail: { congregation: organizacion.nombre.trim(), district: organizacion.distrito } }))
      if (organizacion.direccion.trim() && !Number.isFinite(organizacion.latitud)) {
        setNotice('Guardado, pero aún no hay ubicación en el mapa -- usa "Buscar en el mapa" o haz clic directamente en el mapa para marcarla.')
      } else {
        setNotice('Información y preferencias de la congregación guardadas.')
      }
    }
  }

  useEffect(() => { loadAll() }, [congregacionId])

  const { pending: pendingUndo, registerDelete, undo } = useUndoDelete(loadAll)

  async function agregarCategoria(nombre) {
    const { error: insertError } = await supabase.from('categorias_demograficas').insert({ congregacion_id: congregacionId, nombre, orden: categorias.length + 1 })
    if (insertError) { setError(`No se pudo agregar la categoría: ${insertError.message}`); return false }
    await loadAll(); return true
  }
  // Mismo separador que "pegar una lista" de Ujieres (Modulos.jsx):
  // salto de línea o punto y coma, nunca coma (un nombre real podría
  // venir como "Adultos, mayores" y una coma lo partiría en dos).
  async function agregarCategoriasEnBloque(texto) {
    const existentes = new Set(categorias.map((item) => item.nombre.toLowerCase()))
    const nombresNuevos = [...new Set(
      texto.split(/[\n;]+/).map((linea) => linea.trim()).filter(Boolean)
    )].filter((nombre) => !existentes.has(nombre.toLowerCase()))
    if (nombresNuevos.length === 0) { setError('No hay categorías nuevas para agregar (revisa que no estén ya en la lista).'); return false }
    const { error: insertError } = await supabase.from('categorias_demograficas').insert(nombresNuevos.map((nombre, index) => ({ congregacion_id: congregacionId, nombre, orden: categorias.length + index + 1 })))
    if (insertError) { setError(`No se pudieron agregar las categorías: ${insertError.message}`); return false }
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
        <p className="text-xs text-muted mt-3">El distrito se muestra como referencia y se administra desde el nivel correspondiente.</p>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <h3 className="text-sm font-medium">Ubicación exacta en el mapa</h3>
            <button
              type="button"
              disabled={geocoding || (!organizacion.direccion.trim() && !organizacion.ciudad.trim())}
              onClick={buscarEnMapa}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              {geocoding ? 'Buscando...' : 'Buscar dirección en el mapa'}
            </button>
          </div>
          <MapaUbicacionEditable
            latitud={organizacion.latitud}
            longitud={organizacion.longitud}
            onChange={(lat, lng) => setOrganizacion((prev) => ({ ...prev, latitud: lat, longitud: lng }))}
            recenterKey={recenterKey}
          />
          <p className="text-xs text-muted mt-2">
            La dirección de arriba es solo texto de referencia. Lo que ubica a tu congregación en el mapa nacional/distrital es el pin: usa el botón para partir de una sugerencia automática, y haz clic en cualquier punto del mapa para moverlo a la ubicación exacta.
          </p>
        </div>
        <div className="flex items-center gap-4 mt-5"><button disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar información'}</button></div>
      </form>

      <form onSubmit={guardarPreferencias} className="card p-5 max-w-3xl">
        <div className="mb-5"><h2 className="font-medium">Preferencias de la congregación</h2><p className="text-sm text-secondary mt-1">Define cómo se comportan las alertas y los registros de tu equipo.</p></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm flex items-center gap-1">Umbral de alerta por disminución (%)<InfoTip texto="Si la asistencia baja este porcentaje o más frente al registro anterior, el sistema genera una alerta para que la revises." /><input type="number" min="1" max="100" required placeholder="15" className="input-field mt-1.5 w-full" value={preferencias.umbral_alerta} onChange={(e) => setPreferencias({ ...preferencias, umbral_alerta: e.target.value })} /></label>
          <label className="text-sm flex items-center gap-1">Módulo predeterminado<InfoTip texto="El módulo que se abre primero al entrar a registrar asistencia, para ahorrar clics al equipo que más lo usa." /><select className="input-field mt-1.5 w-full" value={preferencias.modulo_predeterminado} onChange={(e) => setPreferencias({ ...preferencias, modulo_predeterminado: e.target.value })}><option value="">Sin preferencia</option>{modulos.filter((modulo) => modulo.activo !== false).map((modulo) => <option key={modulo.id} value={modulo.id}>{modulo.nombre}</option>)}</select></label>
        </div>
        <div className="flex flex-col gap-3 mt-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferencias.exigir_responsable} onChange={(e) => setPreferencias({ ...preferencias, exigir_responsable: e.target.checked })} /> Exigir responsable al registrar asistencia<InfoTip texto="Si lo activas, nadie podrá guardar un registro de asistencia sin indicar quién lo hizo." /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferencias.exigir_novedades} onChange={(e) => setPreferencias({ ...preferencias, exigir_novedades: e.target.checked })} /> Solicitar novedades en cada registro<InfoTip texto="Si lo activas, cada registro de asistencia deberá incluir una nota (aunque sea 'sin novedad') antes de poder guardarse." /></label></div>
        <div className="flex items-center gap-4 mt-5"><button disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar preferencias'}</button></div>
        <Toast>{notice}</Toast>
      </form>

      <div className="grid md:grid-cols-3 gap-4">
        <ListaCatalogo titulo="Categorías demográficas" items={categorias} onAdd={agregarCategoria} onAddBulk={agregarCategoriasEnBloque} onRemove={quitarCategoria} placeholder="Ej. Matrimonios" busy={saving} />
        <div className="card p-5"><h3 className="font-medium mb-3">Módulos (Ujieres, Evangelismo...)</h3><p className="text-sm text-secondary leading-6">Crear, renombrar y activar o desactivar módulos y sus tipos de actividad se hace ahora desde <Link to="/modulos" className="text-accent">Módulos y actividades</Link>, donde también se administran sus tipos de actividad.</p></div>
        <ListaCatalogo titulo="Etapas de seguimiento de Amigos" items={etapas} onAdd={agregarEtapa} onRemove={quitarEtapa} placeholder="Ej. Bautizado" busy={saving} info="Es un dato opcional y secundario. El seguimiento real del día a día ahora se hace por 'estación' en la Ruta Evangelística (Uno Más, BIS, REFAM, ESFOB, Discipulado), que se gestiona desde Amigos en ruta, no aquí." />
        <div className="card p-5"><h3 className="font-medium mb-3">Zonas de Evangelismo</h3><p className="text-sm text-secondary leading-6">Crear y editar zonas con su responsable se hace ahora desde <Link to="/evangelismo" className="text-accent">Evangelismo</Link>, donde quedan vinculadas al módulo correcto.</p></div>
        <ListaCatalogo titulo="Tipos de comité" items={tiposComite} onAdd={agregarTipoComite} onRemove={quitarTipoComite} placeholder="Ej. Servicio" busy={saving} />
        <ListaCargosComite items={cargosComite} onAdd={agregarCargoComite} onRemove={quitarCargoComite} busy={saving} />
      </div>

      <p className="text-xs text-muted">Los tipos de actividad se administran desde <strong className="text-secondary">Módulos y actividades</strong>, donde puedes crearlos, editarlos y activarlos o desactivarlos.</p>
      <UndoToast pending={pendingUndo} onUndo={undo} />
    </div>
  )
}
