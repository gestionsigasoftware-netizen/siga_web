import { useEffect, useState } from 'react'
import { Layers3, Plus, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

export default function Modulos() {
  const { rolPrincipal } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const [modulos, setModulos] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [nombre, setNombre] = useState('')
  const [actividad, setActividad] = useState('')
  const [error, setError] = useState(null)

  async function load() {
    if (!congregacionId) return
    const { data, error: loadError } = await supabase.from('modulos').select('id, nombre_modulo, alcance, activo, tipos_actividad(id, nombre, caracter, activo)').eq('congregacion_id', congregacionId).order('created_at')
    if (loadError) setError('No se pudieron cargar los módulos.')
    setModulos(data ?? [])
  }

  useEffect(() => { load() }, [congregacionId])

  async function agregarModulo(event) {
    event.preventDefault()
    const { error: insertError } = await supabase.from('modulos').insert({ congregacion_id: congregacionId, nombre_modulo: nombre, alcance: 'interno' })
    if (insertError) { setError('No se pudo crear el módulo.'); return }
    setNombre('')
    load()
  }

  async function agregarActividad(event) {
    event.preventDefault()
    if (!seleccionado) return
    const { error: insertError } = await supabase.from('tipos_actividad').insert({ modulo_id: seleccionado.id, nombre: actividad })
    if (insertError) { setError('No se pudo crear la actividad.'); return }
    setActividad('')
    load()
  }

  return <div className="page-shell">
    <div><p className="eyebrow">Estructura operativa</p><h1 className="section-title">Módulos y actividades</h1><p className="text-sm text-secondary mt-1">Configura cómo se captura la información de tu congregación.</p></div>
    {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
      <section className="card p-5"><div className="flex justify-between items-center mb-4"><div><h2 className="font-medium">Módulos activos</h2><p className="text-xs text-secondary mt-1">Ujieres, Evangelismo y más.</p></div><Layers3 className="w-5 h-5 text-accent" /></div>
        <form onSubmit={agregarModulo} className="flex gap-2 mb-4"><input required className="input-field" placeholder="Nuevo módulo" value={nombre} onChange={(e) => setNombre(e.target.value)} /><button className="btn-primary px-3" aria-label="Agregar módulo"><Plus className="w-4 h-4" /></button></form>
        <div className="flex flex-col gap-2">{modulos.map((modulo) => <button key={modulo.id} onClick={() => setSeleccionado(modulo)} className={`text-left p-3 rounded border transition-colors ${seleccionado?.id === modulo.id ? 'border-accent bg-accent-bg' : 'border-border hover:border-accent'}`}><span className="flex justify-between items-center"><span className="text-sm font-medium">{modulo.nombre_modulo}</span><ChevronDown className="w-4 h-4 text-muted" /></span><span className="text-xs text-secondary">{modulo.tipos_actividad?.length ?? 0} actividades configuradas</span></button>)}</div>
        {modulos.length === 0 && <p className="text-sm text-muted text-center py-5">Crea tu primer módulo para comenzar.</p>}
      </section>
      <section className="card p-5"><h2 className="font-medium">{seleccionado?.nombre_modulo ?? 'Selecciona un módulo'}</h2><p className="text-xs text-secondary mt-1 mb-4">Tipos de actividad disponibles para el registro.</p>{seleccionado ? <><form onSubmit={agregarActividad} className="flex gap-2 mb-4"><input required className="input-field" placeholder="Ej. Culto dominical" value={actividad} onChange={(e) => setActividad(e.target.value)} /><button className="btn-secondary px-3" aria-label="Agregar actividad"><Plus className="w-4 h-4" /></button></form><div className="flex flex-col gap-2">{(seleccionado.tipos_actividad ?? []).map((tipo) => <div key={tipo.id} className="p-3 bg-surface-1 rounded text-sm">{tipo.nombre}</div>)}</div>{seleccionado.tipos_actividad?.length === 0 && <p className="text-sm text-muted">Aún no hay actividades.</p>}</> : <div className="h-48 flex items-center justify-center text-sm text-muted border border-dashed border-border rounded">Elige un módulo de la lista</div>}</section>
    </div>
  </div>
}
