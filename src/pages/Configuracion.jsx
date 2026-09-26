import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [valor, setValor] = useState('')
  const [bulkValor, setBulkValor] = useState('')
  return (
    <div className="card p-5">
      <h3 className="font-medium mb-3 flex items-center gap-1.5">{titulo}{info && <InfoTip texto={info} />}</h3>
      <div className="flex flex-col gap-1.5 mb-3">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between items-center text-sm py-1.5 px-2.5 bg-surface-1 rounded">
            <span>{item.nombre}</span>
            <button type="button" aria-label={t('configuracion.eliminarAria', { nombre: item.nombre })} title={t('configuracion.eliminarAria', { nombre: item.nombre })} disabled={busy} onClick={() => onRemove(item)} className="text-muted hover:text-danger disabled:opacity-50">
              <Trash2 className="w-[15px] h-[15px]" />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted">{t('configuracion.sinValores')}</p>}
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
          <summary className="text-xs text-accent cursor-pointer select-none">{t('configuracion.agregarVarias')}</summary>
          <div className="flex flex-col gap-2 mt-3">
            <p className="text-xs text-secondary">{t('configuracion.agregarVariasTip')}</p>
            <textarea className="input-field min-h-20" placeholder={'Damas\nJóvenes\nCaballeros'} value={bulkValor} onChange={(e) => setBulkValor(e.target.value)} />
            <button
              type="button"
              disabled={busy}
              onClick={async () => { if (bulkValor.trim() && await onAddBulk(bulkValor)) setBulkValor('') }}
              className="btn-secondary self-start px-3"
            >
              {t('configuracion.agregarLista')}
            </button>
          </div>
        </details>
      )}
    </div>
  )
}

function ListaCargosComite({ items, onAdd, onRemove, busy }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ nombre: '', codigo: '', requiere_sellado: false })
  return <div className="card p-5"><h3 className="font-medium mb-3">{t('configuracion.cargosComite')}</h3><p className="text-xs text-secondary mb-3">{t('configuracion.cargosComiteTip')}</p><div className="flex flex-col gap-1.5 mb-3">{items.map((item) => <div key={item.id} className="flex justify-between items-center text-sm py-1.5 px-2.5 bg-surface-1 rounded"><span>{item.nombre} <small className="text-muted">({item.codigo})</small>{item.requiere_sellado && <small className="text-accent ml-1.5">+ sellado</small>}</span><button type="button" aria-label={t('configuracion.eliminarAria', { nombre: item.nombre })} title={t('configuracion.eliminarAria', { nombre: item.nombre })} disabled={busy} onClick={() => onRemove(item)} className="text-muted hover:text-danger disabled:opacity-50"><Trash2 className="w-[15px] h-[15px]" /></button></div>)}{items.length === 0 && <p className="text-xs text-muted">{t('configuracion.sinCargos')}</p>}</div><div className="grid grid-cols-2 gap-2"><input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} placeholder={t('configuracion.nombreCargo')} className="input-field" /><input value={form.codigo} onChange={(event) => setForm({ ...form, codigo: event.target.value })} placeholder={t('configuracion.codigoCargoPlaceholder')} className="input-field" /></div><label className="flex items-center gap-2 text-xs text-secondary mt-2"><input type="checkbox" checked={form.requiere_sellado} onChange={(event) => setForm({ ...form, requiere_sellado: event.target.checked })} />{t('configuracion.requiereSellado')}</label><button type="button" disabled={busy} onClick={async () => { if (form.nombre.trim() && form.codigo.trim() && await onAdd(form)) setForm({ nombre: '', codigo: '', requiere_sellado: false }) }} className="btn-secondary mt-2"><Plus className="w-4 h-4" /> {t('configuracion.agregarCargo')}</button></div>
}

export default function Configuracion() {
  const { t } = useTranslation()
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
    const failedCatalog = cat.error ? t('configuracion.catalogoCategorias') : mod.error ? t('configuracion.catalogoModulos') : et.error ? t('configuracion.catalogoEtapas') : typeResult.error ? t('configuracion.catalogoTiposComite') : committeeCargoResult.error ? t('configuracion.catalogoCargosComite') : congregation.error ? t('configuracion.catalogoCongregacion') : null
    if (failedCatalog) setError(t('configuracion.errorCargarCatalogo', { catalogo: failedCatalog }))
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
      nuevaOrganizacion = { nombre: congregation.data.nombre, distrito: congregation.data.distritos?.numero ? t('configuracion.distritoLabel', { numero: congregation.data.distritos.numero }) : '', ciudad: congregation.data.ciudad ?? '', direccion: congregation.data.direccion ?? '', latitud: congregation.data.latitud ?? null, longitud: congregation.data.longitud ?? null }
      setOrganizacion(nuevaOrganizacion)
    }
    const { data: config, error: configError } = await supabase.from('configuracion_congregacion').select('umbral_alerta, modulo_predeterminado, exigir_responsable, exigir_novedades').eq('congregacion_id', congregacionId).maybeSingle()
    if (configError) setError(t('configuracion.errorCargarPreferencias'))
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
    if (!ubicacion) { setNotice(t('configuracion.errorDireccionNoEncontrada')); return }
    setOrganizacion((prev) => ({ ...prev, latitud: ubicacion.latitud, longitud: ubicacion.longitud }))
    setRecenterKey((key) => key + 1)
    setNotice(ubicacion.aproximado
      ? t('configuracion.ubicacionAproximada')
      : t('configuracion.ubicacionEncontrada'))
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
    if (organizationError) { setSaving(false); setError(t('configuracion.errorGuardarNombre', { mensaje: organizationError.message })); return }
    const { error } = await supabase.from('configuracion_congregacion').upsert({ ...preferencias, umbral_alerta: Number(preferencias.umbral_alerta) || 15, congregacion_id: congregacionId, modulo_predeterminado: preferencias.modulo_predeterminado || null })
    setSaving(false)
    if (error) setError(t('configuracion.errorGuardarConfiguracion', { mensaje: error.message }))
    else {
      window.dispatchEvent(new CustomEvent('siga:organizacion-actualizada', { detail: { congregation: organizacion.nombre.trim(), district: organizacion.distrito } }))
      if (organizacion.direccion.trim() && !Number.isFinite(organizacion.latitud)) {
        setNotice(t('configuracion.guardadoSinUbicacion'))
      } else {
        setNotice(t('configuracion.infoGuardada'))
      }
    }
  }

  useEffect(() => { loadAll() }, [congregacionId])

  const { pending: pendingUndo, registerDelete, undo } = useUndoDelete(loadAll)

  async function agregarCategoria(nombre) {
    const { error: insertError } = await supabase.from('categorias_demograficas').insert({ congregacion_id: congregacionId, nombre, orden: categorias.length + 1 })
    if (insertError) { setError(t('configuracion.errorAgregarCategoria', { mensaje: insertError.message })); return false }
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
    if (nombresNuevos.length === 0) { setError(t('configuracion.errorSinCategoriasNuevas')); return false }
    const { error: insertError } = await supabase.from('categorias_demograficas').insert(nombresNuevos.map((nombre, index) => ({ congregacion_id: congregacionId, nombre, orden: categorias.length + index + 1 })))
    if (insertError) { setError(t('configuracion.errorAgregarCategorias', { mensaje: insertError.message })); return false }
    await loadAll(); return true
  }
  async function quitarCategoria(item) {
    const { error: deleteError } = await supabase.from('categorias_demograficas').delete().eq('id', item.id)
    if (deleteError) { setError(t('configuracion.errorEliminarCategoria', { mensaje: deleteError.message })); return false }
    registerDelete('categorias_demograficas', { ...item, congregacion_id: congregacionId }, item.nombre)
    await loadAll(); return true
  }

  async function agregarEtapa(nombre) {
    const { error: insertError } = await supabase.from('etapas_seguimiento').insert({ congregacion_id: congregacionId, nombre, orden: etapas.length + 1 })
    if (insertError) { setError(t('configuracion.errorAgregarEtapa', { mensaje: insertError.message })); return false }
    await loadAll(); return true
  }
  async function quitarEtapa(item) {
    const { error: deleteError } = await supabase.from('etapas_seguimiento').delete().eq('id', item.id)
    if (deleteError) { setError(t('configuracion.errorEliminarEtapa', { mensaje: deleteError.message })); return false }
    registerDelete('etapas_seguimiento', { ...item, congregacion_id: congregacionId }, item.nombre)
    await loadAll(); return true
  }

  async function agregarTipoComite(nombre) { const codigo = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); const { error: insertError } = await supabase.from('tipos_comite').insert({ congregacion_id: congregacionId, nombre, codigo }); if (insertError) { setError(t('configuracion.errorAgregarTipo', { mensaje: insertError.message })); return false } await loadAll(); return true }
  async function quitarTipoComite(item) {
    const { error: deleteError } = await supabase.from('tipos_comite').delete().eq('id', item.id)
    if (deleteError) { setError(t('configuracion.errorEliminarTipo', { mensaje: deleteError.message })); return false }
    registerDelete('tipos_comite', { ...item, congregacion_id: congregacionId }, item.nombre)
    await loadAll(); return true
  }
  async function agregarCargoComite(values) { const { error: insertError } = await supabase.from('cargos_comite').insert({ congregacion_id: congregacionId, nombre: values.nombre.trim(), codigo: values.codigo.trim(), requiere_sellado: Boolean(values.requiere_sellado) }); if (insertError) { setError(t('configuracion.errorAgregarCargo', { mensaje: insertError.message })); return false } await loadAll(); return true }
  async function quitarCargoComite(item) {
    const { error: deleteError } = await supabase.from('cargos_comite').delete().eq('id', item.id)
    if (deleteError) { setError(t('configuracion.errorEliminarCargo', { mensaje: deleteError.message })); return false }
    registerDelete('cargos_comite', { ...item, congregacion_id: congregacionId }, item.nombre)
    await loadAll(); return true
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('configuracion.cargando')}</div>
  if (rolPrincipal?.nivel !== 'local' || (rolPrincipal.rol_local && rolPrincipal.rol_local !== 'pastor')) return <div className="card p-8 text-center text-sm text-secondary">{t('configuracion.sinPermisos')}</div>

  return (
    <div className="page-shell">
      <div>
        <p className="eyebrow">{t('configuracion.eyebrow')}</p>
        <h1 className="section-title">{t('configuracion.titulo')}</h1>
        <p className="text-sm text-secondary mt-0.5">
          {t('configuracion.subtitulo')}
        </p>
      </div>
      {error && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={loadAll} className="btn-secondary text-xs">{t('configuracion.reintentar')}</button></div>}

      <form onSubmit={guardarPreferencias} className="card p-5 max-w-3xl">
        <div className="mb-5"><h2 className="font-medium">{t('configuracion.identidadCongregacion')}</h2><p className="text-sm text-secondary mt-1">{t('configuracion.identidadSubtitulo')}</p></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">{t('configuracion.nombreCongregacion')}<input required maxLength={120} className="input-field mt-1.5" value={organizacion.nombre} onChange={(e) => setOrganizacion({ ...organizacion, nombre: e.target.value })} /></label>
          <label className="text-sm">{t('configuracion.distrito')}<input readOnly className="input-field mt-1.5 opacity-75 cursor-default" value={organizacion.distrito} /></label>
          <label className="text-sm">{t('configuracion.ciudadMunicipio')}<input maxLength={120} className="input-field mt-1.5" value={organizacion.ciudad} onChange={(e) => setOrganizacion({ ...organizacion, ciudad: e.target.value })} /></label>
          <label className="text-sm">{t('configuracion.direccion')}<input maxLength={200} placeholder={t('configuracion.direccionPlaceholder')} className="input-field mt-1.5" value={organizacion.direccion} onChange={(e) => setOrganizacion({ ...organizacion, direccion: e.target.value })} /></label>
        </div>
        <p className="text-xs text-muted mt-3">{t('configuracion.distritoNota')}</p>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <h3 className="text-sm font-medium">{t('configuracion.ubicacionExacta')}</h3>
            <button
              type="button"
              disabled={geocoding || (!organizacion.direccion.trim() && !organizacion.ciudad.trim())}
              onClick={buscarEnMapa}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              {geocoding ? t('configuracion.buscando') : t('configuracion.buscarDireccion')}
            </button>
          </div>
          <MapaUbicacionEditable
            latitud={organizacion.latitud}
            longitud={organizacion.longitud}
            onChange={(lat, lng) => setOrganizacion((prev) => ({ ...prev, latitud: lat, longitud: lng }))}
            recenterKey={recenterKey}
          />
          <p className="text-xs text-muted mt-2">
            {t('configuracion.ubicacionNota')}
          </p>
        </div>
        <div className="flex items-center gap-4 mt-5"><button disabled={saving} className="btn-primary">{saving ? t('configuracion.guardando') : t('configuracion.guardarInformacion')}</button></div>
      </form>

      <form onSubmit={guardarPreferencias} className="card p-5 max-w-3xl">
        <div className="mb-5"><h2 className="font-medium">{t('configuracion.preferenciasCongregacion')}</h2><p className="text-sm text-secondary mt-1">{t('configuracion.preferenciasSubtitulo')}</p></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm flex items-center gap-1">{t('configuracion.umbralAlerta')}<InfoTip texto={t('configuracion.umbralAlertaTip')} /><input type="number" min="1" max="100" required placeholder="15" className="input-field mt-1.5 w-full" value={preferencias.umbral_alerta} onChange={(e) => setPreferencias({ ...preferencias, umbral_alerta: e.target.value })} /></label>
          <label className="text-sm flex items-center gap-1">{t('configuracion.moduloPredeterminado')}<InfoTip texto={t('configuracion.moduloPredeterminadoTip')} /><select className="input-field mt-1.5 w-full" value={preferencias.modulo_predeterminado} onChange={(e) => setPreferencias({ ...preferencias, modulo_predeterminado: e.target.value })}><option value="">{t('configuracion.sinPreferencia')}</option>{modulos.filter((modulo) => modulo.activo !== false).map((modulo) => <option key={modulo.id} value={modulo.id}>{modulo.nombre}</option>)}</select></label>
        </div>
        <div className="flex flex-col gap-3 mt-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferencias.exigir_responsable} onChange={(e) => setPreferencias({ ...preferencias, exigir_responsable: e.target.checked })} /> {t('configuracion.exigirResponsable')}<InfoTip texto={t('configuracion.exigirResponsableTip')} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferencias.exigir_novedades} onChange={(e) => setPreferencias({ ...preferencias, exigir_novedades: e.target.checked })} /> {t('configuracion.exigirNovedades')}<InfoTip texto={t('configuracion.exigirNovedadesTip')} /></label></div>
        <div className="flex items-center gap-4 mt-5"><button disabled={saving} className="btn-primary">{saving ? t('configuracion.guardando') : t('configuracion.guardarPreferencias')}</button></div>
        <Toast>{notice}</Toast>
      </form>

      <div className="grid md:grid-cols-3 gap-4">
        <ListaCatalogo titulo={t('configuracion.categoriasDemograficas')} items={categorias} onAdd={agregarCategoria} onAddBulk={agregarCategoriasEnBloque} onRemove={quitarCategoria} placeholder={t('configuracion.placeholderCategoria')} busy={saving} />
        <div className="card p-5"><h3 className="font-medium mb-3">{t('configuracion.modulosTitulo')}</h3><p className="text-sm text-secondary leading-6">{t('configuracion.modulosDescPre')}<Link to="/modulos" className="text-accent">{t('configuracion.modulosLink')}</Link>{t('configuracion.modulosDescPost')}</p></div>
        <ListaCatalogo titulo={t('configuracion.etapasSeguimiento')} items={etapas} onAdd={agregarEtapa} onRemove={quitarEtapa} placeholder={t('configuracion.placeholderEtapa')} busy={saving} info={t('configuracion.etapasTip')} />
        <div className="card p-5"><h3 className="font-medium mb-3">{t('configuracion.zonasTitulo')}</h3><p className="text-sm text-secondary leading-6">{t('configuracion.zonasDescPre')}<Link to="/evangelismo" className="text-accent">{t('configuracion.zonasLink')}</Link>{t('configuracion.zonasDescPost')}</p></div>
        <ListaCatalogo titulo={t('configuracion.tiposComiteTitulo')} items={tiposComite} onAdd={agregarTipoComite} onRemove={quitarTipoComite} placeholder={t('configuracion.placeholderTipoComite')} busy={saving} />
        <ListaCargosComite items={cargosComite} onAdd={agregarCargoComite} onRemove={quitarCargoComite} busy={saving} />
      </div>

      <p className="text-xs text-muted">{t('configuracion.notaTiposActividadPre')}<strong className="text-secondary">{t('configuracion.notaTiposActividadNegrita')}</strong>{t('configuracion.notaTiposActividadPost')}</p>
      <UndoToast pending={pendingUndo} onUndo={undo} />
    </div>
  )
}
