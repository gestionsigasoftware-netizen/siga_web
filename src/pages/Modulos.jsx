import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Edit3, Layers3, Plus, Power, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

export default function Modulos() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const [modulos, setModulos] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [nombre, setNombre] = useState('')
  const [actividad, setActividad] = useState('')
  const [caracter, setCaracter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingModuleId, setEditingModuleId] = useState(null)
  const [editingActivityId, setEditingActivityId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingActivityName, setEditingActivityName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    if (!congregacionId) return
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase.from('modulos').select('id, nombre_modulo, alcance, activo, tipos_actividad(id, nombre, caracter, activo)').eq('congregacion_id', congregacionId).order('created_at')
    if (loadError) setError(`No se pudieron cargar los módulos: ${loadError.message}`)
    const loaded = data ?? []
    setModulos(loaded)
    setSeleccionado((current) => loaded.find((module) => module.id === current?.id) ?? loaded[0] ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [congregacionId])

  const filteredModules = useMemo(() => modulos.filter((module) => module.nombre_modulo.toLowerCase().includes(searchTerm.toLowerCase())), [modulos, searchTerm])
  const activeModules = modulos.filter((module) => module.activo !== false).length
  const totalActivities = modulos.reduce((total, module) => total + (module.tipos_actividad?.filter((type) => type.activo !== false).length ?? 0), 0)
  const visibleActivities = seleccionado?.tipos_actividad?.filter((type) => type.activo !== false) ?? []

  async function agregarModulo(event) {
    event.preventDefault()
    const value = nombre.trim()
    if (!value) return
    if (modulos.some((module) => module.nombre_modulo.toLowerCase() === value.toLowerCase())) { setError('Ya existe un módulo con ese nombre.'); return }
    setSaving(true); setError(null)
    const { data, error: insertError } = await supabase.from('modulos').insert({ congregacion_id: congregacionId, nombre_modulo: value, alcance: 'interno' }).select('id, nombre_modulo, alcance, activo, tipos_actividad(id, nombre, caracter, activo)').single()
    setSaving(false)
    if (insertError) { setError(`No se pudo crear el módulo: ${insertError.message}`); return }
    setNombre(''); setModulos((current) => [...current, data]); setSeleccionado(data)
  }

  async function agregarActividad(event) {
    event.preventDefault()
    const value = actividad.trim()
    if (!seleccionado || !value) return
    if (seleccionado.tipos_actividad?.some((type) => type.nombre.toLowerCase() === value.toLowerCase())) { setError('Ya existe una actividad con ese nombre en este módulo.'); return }
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('tipos_actividad').insert({ modulo_id: seleccionado.id, nombre: value, caracter: caracter.trim() || null })
    setSaving(false)
    if (insertError) { setError(`No se pudo crear la actividad: ${insertError.message}`); return }
    setActividad(''); setCaracter(''); load()
  }

  async function saveModuleName(module) {
    const value = editingName.trim()
    if (!value) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('modulos').update({ nombre_modulo: value }).eq('id', module.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(`No se pudo actualizar el módulo: ${updateError.message}`); return }
    setEditingModuleId(null); load()
  }

  async function toggleModule(module) {
    if (!window.confirm(`${module.activo === false ? '¿Reactivar' : '¿Desactivar'} el módulo ${module.nombre_modulo}?`)) return
    const { error: updateError } = await supabase.from('modulos').update({ activo: module.activo === false }).eq('id', module.id).eq('congregacion_id', congregacionId)
    if (updateError) { setError(`No se pudo cambiar el estado: ${updateError.message}`); return }
    load()
  }

  async function saveActivity(type) {
    const value = editingActivityName.trim()
    if (!value) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('tipos_actividad').update({ nombre: value }).eq('id', type.id)
    setSaving(false)
    if (updateError) { setError(`No se pudo actualizar la actividad: ${updateError.message}`); return }
    setEditingActivityId(null); load()
  }

  async function toggleActivity(type) {
    const { error: updateError } = await supabase.from('tipos_actividad').update({ activo: type.activo === false }).eq('id', type.id)
    if (updateError) setError(`No se pudo cambiar el estado de la actividad: ${updateError.message}`)
    else load()
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando módulos y actividades...</div>

  return <div className="page-shell">
    <header><p className="eyebrow">Estructura operativa</p><h1 className="section-title">Módulos y actividades</h1><p className="text-sm text-secondary mt-1">Configura cómo se captura la información de tu congregación.</p></header>
    {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
    <section className="grid sm:grid-cols-3 gap-3"><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Módulos activos</p><p className="text-2xl font-semibold mt-3">{activeModules}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Actividades activas</p><p className="text-2xl font-semibold mt-3">{totalActivities}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Módulo seleccionado</p><p className="text-sm font-semibold mt-4 truncate">{seleccionado?.nombre_modulo || 'Ninguno'}</p></div></section>
    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
      <section className="card p-5"><div className="flex justify-between items-center mb-4"><div><h2 className="font-medium">Módulos activos</h2><p className="text-xs text-secondary mt-1">Organiza las áreas de captura.</p></div><Layers3 className="w-5 h-5 text-accent" /></div><form onSubmit={agregarModulo} className="flex gap-2 mb-3"><input required className="input-field" placeholder="Nuevo módulo" value={nombre} onChange={(event) => setNombre(event.target.value)} /><button disabled={saving} className="btn-primary px-3" aria-label="Agregar módulo"><Plus className="w-4 h-4" /></button></form><div className="flex items-center gap-2 border border-border rounded px-3 py-2 mb-4"><Search className="w-4 h-4 text-muted" /><input aria-label="Buscar módulos" className="bg-transparent outline-none text-sm w-full" placeholder="Buscar módulo..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div><div className="flex flex-col gap-2">{filteredModules.map((module) => <div key={module.id} className={`module-item ${seleccionado?.id === module.id ? 'module-item-active' : ''} ${module.activo === false ? 'opacity-55' : ''}`}><button type="button" onClick={() => setSeleccionado(module)} className="flex-1 text-left"><span className="flex justify-between items-center"><span className="text-sm font-medium">{module.nombre_modulo}</span><ChevronDown className="w-4 h-4 text-muted" /></span><span className="text-xs text-secondary">{module.tipos_actividad?.filter((type) => type.activo !== false).length ?? 0} actividades activas</span></button><div className="flex items-center gap-2 ml-2"><button type="button" aria-label={`Editar ${module.nombre_modulo}`} title="Editar módulo" onClick={() => { setEditingModuleId(module.id); setEditingName(module.nombre_modulo) }} className="text-muted hover:text-accent"><Edit3 className="w-4 h-4" /></button><button type="button" aria-label="Cambiar estado" title={module.activo === false ? 'Reactivar módulo' : 'Desactivar módulo'} onClick={() => toggleModule(module)} className={module.activo === false ? 'text-success' : 'text-muted hover:text-danger'}><Power className="w-4 h-4" /></button></div></div>)}</div>{filteredModules.length === 0 && <p className="text-sm text-muted text-center py-5">No hay módulos que coincidan.</p>}</section>
      <section className="card p-5"><h2 className="font-medium">{seleccionado?.nombre_modulo ?? 'Selecciona un módulo'}</h2><p className="text-xs text-secondary mt-1 mb-4">Tipos de actividad disponibles para el registro.</p>{seleccionado ? <><form onSubmit={agregarActividad} className="grid sm:grid-cols-[1fr_0.8fr_auto] gap-2 mb-4"><input required className="input-field" placeholder="Ej. Culto dominical" value={actividad} onChange={(event) => setActividad(event.target.value)} /><input className="input-field" placeholder="Característica (opcional)" value={caracter} onChange={(event) => setCaracter(event.target.value)} /><button disabled={saving} className="btn-secondary px-3" aria-label="Agregar actividad"><Plus className="w-4 h-4" /></button></form><div className="flex flex-col gap-2">{visibleActivities.map((type) => <div key={type.id} className="activity-item"><div className="min-w-0"><p className="text-sm font-medium truncate">{type.nombre}</p>{type.caracter && <span className="text-[10px] uppercase tracking-[0.1em] text-accent">{type.caracter}</span>}</div><div className="flex items-center gap-2"><button type="button" aria-label={`Editar ${type.nombre}`} title="Editar actividad" onClick={() => { setEditingActivityId(type.id); setEditingActivityName(type.nombre) }} className="text-muted hover:text-accent"><Edit3 className="w-4 h-4" /></button><button type="button" aria-label="Desactivar actividad" title="Desactivar actividad" onClick={() => toggleActivity(type)} className="text-muted hover:text-danger"><Power className="w-4 h-4" /></button></div></div>)}</div>{visibleActivities.length === 0 && <p className="text-sm text-muted py-8 text-center">Aún no hay actividades activas.</p>}</> : <div className="h-48 flex items-center justify-center text-sm text-muted border border-dashed border-border rounded">Elige un módulo de la lista</div>}</section>
    </div>
    {editingModuleId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveModuleName(modulos.find((module) => module.id === editingModuleId)) }} className="modal-panel"><h2 className="font-medium">Editar módulo</h2><input autoFocus required className="input-field mt-4" value={editingName} onChange={(event) => setEditingName(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingModuleId(null)} className="btn-secondary"><X className="w-4 h-4" />Cancelar</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />Guardar</button></div></form></div>}
    {editingActivityId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveActivity(seleccionado.tipos_actividad.find((type) => type.id === editingActivityId)) }} className="modal-panel"><h2 className="font-medium">Editar actividad</h2><input autoFocus required className="input-field mt-4" value={editingActivityName} onChange={(event) => setEditingActivityName(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingActivityId(null)} className="btn-secondary"><X className="w-4 h-4" />Cancelar</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />Guardar</button></div></form></div>}
  </div>
}