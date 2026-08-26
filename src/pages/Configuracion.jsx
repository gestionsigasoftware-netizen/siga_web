import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

function ListaCatalogo({ titulo, items, onAdd, onRemove, placeholder }) {
  const [valor, setValor] = useState('')
  return (
    <div className="card p-5">
      <h3 className="font-medium mb-3">{titulo}</h3>
      <div className="flex flex-col gap-1.5 mb-3">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between items-center text-sm py-1.5 px-2.5 bg-surface-1 rounded">
            <span>{item.nombre}</span>
            <button onClick={() => onRemove(item.id)} className="text-muted hover:text-danger">
              <Trash2 className="w-[15px] h-[15px]" />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted">Sin valores aún.</p>}
      </div>
      <div className="flex gap-2">
        <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={placeholder} className="input-field flex-1" />
        <button
          onClick={() => { if (valor.trim()) { onAdd(valor.trim()); setValor('') } }}
          className="btn-secondary px-3"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function Configuracion() {
  const { rolPrincipal } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id

  const [categorias, setCategorias] = useState([])
  const [modulos, setModulos] = useState([])
  const [etapas, setEtapas] = useState([])
  const [preferencias, setPreferencias] = useState({ umbral_alerta: 15, modulo_predeterminado: '', exigir_responsable: true, exigir_novedades: false })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  async function loadAll() {
    if (!congregacionId) return
    const [cat, mod, et] = await Promise.all([
      supabase.from('categorias_demograficas').select('id, nombre').eq('congregacion_id', congregacionId).order('orden'),
      supabase.from('modulos').select('id, nombre_modulo as nombre').eq('congregacion_id', congregacionId),
      supabase.from('etapas_seguimiento').select('id, nombre').eq('congregacion_id', congregacionId).order('orden'),
    ])
    setCategorias(cat.data ?? [])
    setModulos(mod.data ?? [])
    setEtapas(et.data ?? [])
    const { data: config } = await supabase.from('configuracion_congregacion').select('umbral_alerta, modulo_predeterminado, exigir_responsable, exigir_novedades').eq('congregacion_id', congregacionId).maybeSingle()
    if (config) setPreferencias({ ...config, modulo_predeterminado: config.modulo_predeterminado ?? '' })
  }

  async function guardarPreferencias(event) {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    const { error } = await supabase.from('configuracion_congregacion').upsert({ ...preferencias, congregacion_id: congregacionId, modulo_predeterminado: preferencias.modulo_predeterminado || null })
    setSaving(false)
    setNotice(error ? 'No se pudo guardar la configuración.' : 'Preferencias de la congregación guardadas.')
  }

  useEffect(() => { loadAll() }, [congregacionId])

  async function agregarCategoria(nombre) {
    await supabase.from('categorias_demograficas').insert({ congregacion_id: congregacionId, nombre, orden: categorias.length + 1 })
    loadAll()
  }
  async function quitarCategoria(id) {
    await supabase.from('categorias_demograficas').delete().eq('id', id)
    loadAll()
  }

  async function agregarModulo(nombre) {
    await supabase.from('modulos').insert({ congregacion_id: congregacionId, nombre_modulo: nombre, alcance: 'interno' })
    loadAll()
  }
  async function quitarModulo(id) {
    await supabase.from('modulos').update({ activo: false }).eq('id', id)
    loadAll()
  }

  async function agregarEtapa(nombre) {
    await supabase.from('etapas_seguimiento').insert({ congregacion_id: congregacionId, nombre, orden: etapas.length + 1 })
    loadAll()
  }
  async function quitarEtapa(id) {
    await supabase.from('etapas_seguimiento').delete().eq('id', id)
    loadAll()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium">Configuración</h1>
        <p className="text-sm text-secondary mt-0.5">
          Catálogos propios de tu congregación — cada congregación de la IPUC configura los suyos de forma independiente.
        </p>
      </div>

      <form onSubmit={guardarPreferencias} className="card p-5 max-w-3xl">
        <div className="mb-5"><h2 className="font-medium">Preferencias de la congregación</h2><p className="text-sm text-secondary mt-1">Define cómo se comportan las alertas y los registros de tu equipo.</p></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">Umbral de alerta por disminución (%)<input type="number" min="1" max="100" required className="input-field mt-1.5" value={preferencias.umbral_alerta} onChange={(e) => setPreferencias({ ...preferencias, umbral_alerta: Number(e.target.value) })} /></label>
          <label className="text-sm">Módulo predeterminado<select className="input-field mt-1.5" value={preferencias.modulo_predeterminado} onChange={(e) => setPreferencias({ ...preferencias, modulo_predeterminado: e.target.value })}><option value="">Sin preferencia</option>{modulos.map((modulo) => <option key={modulo.id} value={modulo.id}>{modulo.nombre}</option>)}</select></label>
        </div>
        <div className="flex flex-col gap-3 mt-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferencias.exigir_responsable} onChange={(e) => setPreferencias({ ...preferencias, exigir_responsable: e.target.checked })} /> Exigir responsable al registrar asistencia</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferencias.exigir_novedades} onChange={(e) => setPreferencias({ ...preferencias, exigir_novedades: e.target.checked })} /> Solicitar novedades en cada registro</label></div>
        <div className="flex items-center gap-4 mt-5"><button disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar preferencias'}</button>{notice && <p role="status" className="text-sm text-success">{notice}</p>}</div>
      </form>

      <div className="grid grid-cols-3 gap-4">
        <ListaCatalogo titulo="Categorías demográficas" items={categorias} onAdd={agregarCategoria} onRemove={quitarCategoria} placeholder="Ej. Matrimonios" />
        <ListaCatalogo titulo="Módulos (Ujieres, Evangelismo...)" items={modulos} onAdd={agregarModulo} onRemove={quitarModulo} placeholder="Ej. Misión Juvenil" />
        <ListaCatalogo titulo="Etapas de seguimiento de Amigos" items={etapas} onAdd={agregarEtapa} onRemove={quitarEtapa} placeholder="Ej. Bautizado" />
      </div>

      <p className="text-xs text-muted">
        Los tipos de actividad (ej. "Culto Martes") se configuran dentro de cada módulo — próximamente en esta misma
        pantalla, por ahora edítalos directo en la tabla <code>tipos_actividad</code> desde Supabase.
      </p>
    </div>
  )
}
