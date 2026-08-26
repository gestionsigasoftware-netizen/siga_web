import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

function ListaCatalogo({ titulo, items, onAdd, onRemove, placeholder, busy }) {
  const [valor, setValor] = useState('')
  return (
    <div className="card p-5">
      <h3 className="font-medium mb-3">{titulo}</h3>
      <div className="flex flex-col gap-1.5 mb-3">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between items-center text-sm py-1.5 px-2.5 bg-surface-1 rounded">
            <span>{item.nombre}</span>
            <button type="button" aria-label={`Eliminar ${item.nombre}`} title={`Eliminar ${item.nombre}`} disabled={busy} onClick={() => onRemove(item.id, item.nombre)} className="text-muted hover:text-danger disabled:opacity-50">
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

export default function Configuracion() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id

  const [categorias, setCategorias] = useState([])
  const [modulos, setModulos] = useState([])
  const [etapas, setEtapas] = useState([])
  const [preferencias, setPreferencias] = useState({ umbral_alerta: 15, modulo_predeterminado: '', exigir_responsable: true, exigir_novedades: false })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function loadAll() {
    if (!congregacionId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const [cat, mod, et] = await Promise.all([
      supabase.from('categorias_demograficas').select('id, nombre').eq('congregacion_id', congregacionId).order('orden'),
      supabase.from('modulos').select('id, nombre_modulo, activo').eq('congregacion_id', congregacionId),
      supabase.from('etapas_seguimiento').select('id, nombre').eq('congregacion_id', congregacionId).order('orden'),
    ])
    const failedCatalog = cat.error ? 'categorías' : mod.error ? 'módulos' : et.error ? 'etapas' : null
    if (failedCatalog) setError(`No se pudieron cargar las ${failedCatalog}. Intenta nuevamente.`)
    setCategorias(cat.data ?? [])
    setModulos((mod.data ?? []).map((item) => ({ ...item, nombre: item.nombre_modulo })))
    setEtapas(et.data ?? [])
    const { data: config, error: configError } = await supabase.from('configuracion_congregacion').select('umbral_alerta, modulo_predeterminado, exigir_responsable, exigir_novedades').eq('congregacion_id', congregacionId).maybeSingle()
    if (configError) setError('No se pudieron cargar las preferencias de la congregación.')
    if (config) setPreferencias({ ...config, modulo_predeterminado: config.modulo_predeterminado ?? '' })
    setLoading(false)
  }

  async function guardarPreferencias(event) {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    const { error } = await supabase.from('configuracion_congregacion').upsert({ ...preferencias, congregacion_id: congregacionId, modulo_predeterminado: preferencias.modulo_predeterminado || null })
    setSaving(false)
    if (error) setError(`No se pudo guardar la configuración: ${error.message}`)
    else setNotice('Preferencias de la congregación guardadas.')
  }

  useEffect(() => { loadAll() }, [congregacionId])

  async function agregarCategoria(nombre) {
    const { error: insertError } = await supabase.from('categorias_demograficas').insert({ congregacion_id: congregacionId, nombre, orden: categorias.length + 1 })
    if (insertError) { setError(`No se pudo agregar la categoría: ${insertError.message}`); return false }
    await loadAll(); return true
  }
  async function quitarCategoria(id, nombre) {
    if (!window.confirm(`¿Eliminar la categoría ${nombre}? Si está usada en registros, la base de datos puede impedirlo.`)) return false
    const { error: deleteError } = await supabase.from('categorias_demograficas').delete().eq('id', id)
    if (deleteError) { setError(`No se pudo eliminar la categoría: ${deleteError.message}`); return false }
    await loadAll(); return true
  }

  async function agregarModulo(nombre) {
    const { error: insertError } = await supabase.from('modulos').insert({ congregacion_id: congregacionId, nombre_modulo: nombre, alcance: 'interno' })
    if (insertError) { setError(`No se pudo agregar el módulo: ${insertError.message}`); return false }
    await loadAll(); return true
  }
  async function quitarModulo(id, nombre) {
    if (!window.confirm(`¿Desactivar el módulo ${nombre}?`)) return false
    const { error: updateError } = await supabase.from('modulos').update({ activo: false }).eq('id', id)
    if (updateError) { setError(`No se pudo desactivar el módulo: ${updateError.message}`); return false }
    await loadAll(); return true
  }

  async function agregarEtapa(nombre) {
    const { error: insertError } = await supabase.from('etapas_seguimiento').insert({ congregacion_id: congregacionId, nombre, orden: etapas.length + 1 })
    if (insertError) { setError(`No se pudo agregar la etapa: ${insertError.message}`); return false }
    await loadAll(); return true
  }
  async function quitarEtapa(id, nombre) {
    if (!window.confirm(`¿Eliminar la etapa ${nombre}? Si tiene amigos asociados, la base de datos puede impedirlo.`)) return false
    const { error: deleteError } = await supabase.from('etapas_seguimiento').delete().eq('id', id)
    if (deleteError) { setError(`No se pudo eliminar la etapa: ${deleteError.message}`); return false }
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
        <div className="mb-5"><h2 className="font-medium">Preferencias de la congregación</h2><p className="text-sm text-secondary mt-1">Define cómo se comportan las alertas y los registros de tu equipo.</p></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">Umbral de alerta por disminución (%)<input type="number" min="1" max="100" required className="input-field mt-1.5" value={preferencias.umbral_alerta} onChange={(e) => setPreferencias({ ...preferencias, umbral_alerta: Number(e.target.value) })} /></label>
          <label className="text-sm">Módulo predeterminado<select className="input-field mt-1.5" value={preferencias.modulo_predeterminado} onChange={(e) => setPreferencias({ ...preferencias, modulo_predeterminado: e.target.value })}><option value="">Sin preferencia</option>{modulos.map((modulo) => <option key={modulo.id} value={modulo.id}>{modulo.nombre}</option>)}</select></label>
        </div>
        <div className="flex flex-col gap-3 mt-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferencias.exigir_responsable} onChange={(e) => setPreferencias({ ...preferencias, exigir_responsable: e.target.checked })} /> Exigir responsable al registrar asistencia</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferencias.exigir_novedades} onChange={(e) => setPreferencias({ ...preferencias, exigir_novedades: e.target.checked })} /> Solicitar novedades en cada registro</label></div>
        <div className="flex items-center gap-4 mt-5"><button disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar preferencias'}</button>{notice && <p role="status" className="text-sm text-success">{notice}</p>}</div>
      </form>

      <div className="grid md:grid-cols-3 gap-4">
        <ListaCatalogo titulo="Categorías demográficas" items={categorias} onAdd={agregarCategoria} onRemove={quitarCategoria} placeholder="Ej. Matrimonios" busy={saving} />
        <ListaCatalogo titulo="Módulos (Ujieres, Evangelismo...)" items={modulos.filter((modulo) => modulo.activo !== false)} onAdd={agregarModulo} onRemove={quitarModulo} placeholder="Ej. Misión Juvenil" busy={saving} />
        <ListaCatalogo titulo="Etapas de seguimiento de Amigos" items={etapas} onAdd={agregarEtapa} onRemove={quitarEtapa} placeholder="Ej. Bautizado" busy={saving} />
      </div>

      <p className="text-xs text-muted">Los tipos de actividad se administran desde <strong className="text-secondary">Módulos y actividades</strong>, donde puedes crearlos, editarlos y activarlos o desactivarlos.</p>
    </div>
  )
}
