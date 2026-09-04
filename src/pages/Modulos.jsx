import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Edit3, GraduationCap, HeartHandshake, Layers3, Plus, Power, Search, Sparkles, UsersRound, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

// Estos módulos los siembran sus propias migraciones y sus pantallas los
// ubican por nombre exacto (ver Evangelismo.jsx y MisionJuvenil.jsx). No deben
// renombrarse ni desactivarse desde aquí porque eso las deja sin módulo.
const SYSTEM_MODULE_NAMES = ['evangelismo', 'mision juvenil']
const esModuloSistema = (module) => SYSTEM_MODULE_NAMES.includes(module.nombre_modulo.trim().toLowerCase())

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
  const [caracteresCulto, setCaracteresCulto] = useState([])
  const [nuevoCaracterCulto, setNuevoCaracterCulto] = useState('')
  const [editingCaracterCultoId, setEditingCaracterCultoId] = useState(null)
  const [editingCaracterCultoName, setEditingCaracterCultoName] = useState('')
  const [refamLecciones, setRefamLecciones] = useState([])
  const [nuevaLeccionRefamTitulo, setNuevaLeccionRefamTitulo] = useState('')
  const [nuevaLeccionRefamDescripcion, setNuevaLeccionRefamDescripcion] = useState('')
  const [editingLeccionRefamId, setEditingLeccionRefamId] = useState(null)
  const [editingLeccionRefamTitulo, setEditingLeccionRefamTitulo] = useState('')
  const [editingLeccionRefamDescripcion, setEditingLeccionRefamDescripcion] = useState('')
  const [esfobLecciones, setEsfobLecciones] = useState([])
  const [nuevaLeccionEsfobTitulo, setNuevaLeccionEsfobTitulo] = useState('')
  const [nuevaLeccionEsfobDescripcion, setNuevaLeccionEsfobDescripcion] = useState('')
  const [editingLeccionEsfobId, setEditingLeccionEsfobId] = useState(null)
  const [editingLeccionEsfobTitulo, setEditingLeccionEsfobTitulo] = useState('')
  const [editingLeccionEsfobDescripcion, setEditingLeccionEsfobDescripcion] = useState('')
  const [ujieres, setUjieres] = useState([])
  const [nuevoUjier, setNuevoUjier] = useState('')
  const [bulkUjieres, setBulkUjieres] = useState('')
  const [editingUjierId, setEditingUjierId] = useState(null)
  const [editingUjierName, setEditingUjierName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    if (!congregacionId) return
    setLoading(true)
    setError(null)
    const [modulosResult, caracteresResult, ujieresResult, refamLeccionesResult, esfobLeccionesResult] = await Promise.all([
      supabase.from('modulos').select('id, nombre_modulo, alcance, activo, tipos_actividad(id, nombre, caracter, activo)').eq('congregacion_id', congregacionId).order('created_at'),
      supabase.from('caracteres_culto').select('id, nombre, activo').eq('congregacion_id', congregacionId).order('nombre'),
      supabase.from('ujieres_congregacion').select('id, nombre, activo').eq('congregacion_id', congregacionId).order('nombre'),
      supabase.from('refam_lecciones').select('id, numero, titulo, descripcion, activo').eq('congregacion_id', congregacionId).order('numero'),
      supabase.from('esfob_lecciones').select('id, numero, titulo, descripcion, activo').eq('congregacion_id', congregacionId).order('numero'),
    ])
    if (modulosResult.error) setError(`No se pudieron cargar los módulos: ${modulosResult.error.message}`)
    const loaded = modulosResult.data ?? []
    setModulos(loaded)
    setSeleccionado((current) => loaded.find((module) => module.id === current?.id) ?? loaded[0] ?? null)
    setCaracteresCulto(caracteresResult.data ?? [])
    setUjieres(ujieresResult.data ?? [])
    setRefamLecciones(refamLeccionesResult.data ?? [])
    setEsfobLecciones(esfobLeccionesResult.data ?? [])
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
    if (esModuloSistema(module)) { setError('Este módulo se administra desde su propia pantalla (Evangelismo o Misión Juvenil).'); return }
    const value = editingName.trim()
    if (!value) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('modulos').update({ nombre_modulo: value }).eq('id', module.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(`No se pudo actualizar el módulo: ${updateError.message}`); return }
    setEditingModuleId(null); load()
  }

  async function toggleModule(module) {
    if (esModuloSistema(module)) { setError('Este módulo se administra desde su propia pantalla (Evangelismo o Misión Juvenil).'); return }
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

  async function agregarCaracterCulto(event) {
    event.preventDefault()
    const value = nuevoCaracterCulto.trim()
    if (!value) return
    if (caracteresCulto.some((item) => item.nombre.toLowerCase() === value.toLowerCase())) { setError('Ya existe un carácter de culto con ese nombre.'); return }
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('caracteres_culto').insert({ congregacion_id: congregacionId, nombre: value })
    setSaving(false)
    if (insertError) { setError(`No se pudo crear el carácter: ${insertError.message}`); return }
    setNuevoCaracterCulto(''); load()
  }

  async function saveCaracterCulto(item) {
    const value = editingCaracterCultoName.trim()
    if (!value) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('caracteres_culto').update({ nombre: value }).eq('id', item.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(`No se pudo actualizar el carácter: ${updateError.message}`); return }
    setEditingCaracterCultoId(null); load()
  }

  async function toggleCaracterCulto(item) {
    const { error: updateError } = await supabase.from('caracteres_culto').update({ activo: item.activo === false }).eq('id', item.id).eq('congregacion_id', congregacionId)
    if (updateError) setError(`No se pudo cambiar el estado del carácter: ${updateError.message}`)
    else load()
  }

  async function agregarUjier(event) {
    event.preventDefault()
    const value = nuevoUjier.trim()
    if (!value) return
    if (ujieres.some((item) => item.nombre.toLowerCase() === value.toLowerCase())) { setError('Ya existe un ujier con ese nombre.'); return }
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('ujieres_congregacion').insert({ congregacion_id: congregacionId, nombre: value })
    setSaving(false)
    if (insertError) { setError(`No se pudo agregar el ujier: ${insertError.message}`); return }
    setNuevoUjier(''); load()
  }

  async function agregarUjieresEnBloque(event) {
    event.preventDefault()
    const existentes = new Set(ujieres.map((item) => item.nombre.toLowerCase()))
    const nombresNuevos = [...new Set(
      bulkUjieres.split('\n').map((line) => line.trim()).filter(Boolean)
    )].filter((nombreLinea) => !existentes.has(nombreLinea.toLowerCase()))
    if (nombresNuevos.length === 0) { setError('No hay nombres nuevos para agregar (revisa que no estén ya en la lista).'); return }
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('ujieres_congregacion').insert(nombresNuevos.map((nombreUjier) => ({ congregacion_id: congregacionId, nombre: nombreUjier })))
    setSaving(false)
    if (insertError) { setError(`No se pudieron agregar los ujieres: ${insertError.message}`); return }
    setBulkUjieres(''); load()
  }

  async function saveUjier(item) {
    const value = editingUjierName.trim()
    if (!value) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('ujieres_congregacion').update({ nombre: value }).eq('id', item.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(`No se pudo actualizar el ujier: ${updateError.message}`); return }
    setEditingUjierId(null); load()
  }

  async function toggleUjier(item) {
    const { error: updateError } = await supabase.from('ujieres_congregacion').update({ activo: item.activo === false }).eq('id', item.id).eq('congregacion_id', congregacionId)
    if (updateError) setError(`No se pudo cambiar el estado del ujier: ${updateError.message}`)
    else load()
  }

  async function agregarLeccionRefam(event) {
    event.preventDefault()
    const titulo = nuevaLeccionRefamTitulo.trim()
    if (!titulo) return
    const numero = Math.max(0, ...refamLecciones.map((item) => item.numero)) + 1
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('refam_lecciones').insert({ congregacion_id: congregacionId, numero, titulo, descripcion: nuevaLeccionRefamDescripcion.trim() || null })
    setSaving(false)
    if (insertError) { setError(`No se pudo crear la lección: ${insertError.message}`); return }
    setNuevaLeccionRefamTitulo(''); setNuevaLeccionRefamDescripcion(''); load()
  }

  async function saveLeccionRefam(item) {
    const titulo = editingLeccionRefamTitulo.trim()
    if (!titulo) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('refam_lecciones').update({ titulo, descripcion: editingLeccionRefamDescripcion.trim() || null }).eq('id', item.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(`No se pudo actualizar la lección: ${updateError.message}`); return }
    setEditingLeccionRefamId(null); load()
  }

  async function toggleLeccionRefam(item) {
    const { error: updateError } = await supabase.from('refam_lecciones').update({ activo: item.activo === false }).eq('id', item.id).eq('congregacion_id', congregacionId)
    if (updateError) setError(`No se pudo cambiar el estado de la lección: ${updateError.message}`)
    else load()
  }

  async function agregarLeccionEsfob(event) {
    event.preventDefault()
    const titulo = nuevaLeccionEsfobTitulo.trim()
    if (!titulo) return
    const numero = Math.max(0, ...esfobLecciones.map((item) => item.numero)) + 1
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('esfob_lecciones').insert({ congregacion_id: congregacionId, numero, titulo, descripcion: nuevaLeccionEsfobDescripcion.trim() || null })
    setSaving(false)
    if (insertError) { setError(`No se pudo crear la lección: ${insertError.message}`); return }
    setNuevaLeccionEsfobTitulo(''); setNuevaLeccionEsfobDescripcion(''); load()
  }

  async function saveLeccionEsfob(item) {
    const titulo = editingLeccionEsfobTitulo.trim()
    if (!titulo) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('esfob_lecciones').update({ titulo, descripcion: editingLeccionEsfobDescripcion.trim() || null }).eq('id', item.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(`No se pudo actualizar la lección: ${updateError.message}`); return }
    setEditingLeccionEsfobId(null); load()
  }

  async function toggleLeccionEsfob(item) {
    const { error: updateError } = await supabase.from('esfob_lecciones').update({ activo: item.activo === false }).eq('id', item.id).eq('congregacion_id', congregacionId)
    if (updateError) setError(`No se pudo cambiar el estado de la lección: ${updateError.message}`)
    else load()
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando módulos y actividades...</div>
  if (rolPrincipal?.nivel !== 'local' || (rolPrincipal.rol_local && rolPrincipal.rol_local !== 'pastor')) return <div className="card p-8 text-center text-sm text-secondary">No tienes permisos para administrar módulos y actividades.</div>

  return <div className="page-shell">
    <header><p className="eyebrow">Estructura operativa</p><h1 className="section-title">Módulos y actividades</h1><p className="text-sm text-secondary mt-1">Configura cómo se captura la información de tu congregación.</p></header>
    {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
    <section className="grid sm:grid-cols-3 gap-3"><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Módulos activos</p><p className="text-2xl font-semibold mt-3">{activeModules}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Actividades activas</p><p className="text-2xl font-semibold mt-3">{totalActivities}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Módulo seleccionado</p><p className="text-sm font-semibold mt-4 truncate">{seleccionado?.nombre_modulo || 'Ninguno'}</p></div></section>
    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
      <section className="card p-5"><div className="flex justify-between items-center mb-4"><div><h2 className="font-medium">Módulos activos</h2><p className="text-xs text-secondary mt-1">Organiza las áreas de captura.</p></div><Layers3 className="w-5 h-5 text-accent" /></div><form onSubmit={agregarModulo} className="flex gap-2 mb-3"><input required className="input-field" placeholder="Nuevo módulo" value={nombre} onChange={(event) => setNombre(event.target.value)} /><button disabled={saving} className="btn-primary px-3" aria-label="Agregar módulo"><Plus className="w-4 h-4" /></button></form><div className="flex items-center gap-2 border border-border rounded px-3 py-2 mb-4"><Search className="w-4 h-4 text-muted" /><input aria-label="Buscar módulos" className="bg-transparent outline-none text-sm w-full" placeholder="Buscar módulo..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div><div className="flex flex-col gap-2">{filteredModules.map((module) => { const bloqueado = esModuloSistema(module); return <div key={module.id} className={`module-item ${seleccionado?.id === module.id ? 'module-item-active' : ''} ${module.activo === false ? 'opacity-55' : ''}`}><button type="button" onClick={() => setSeleccionado(module)} className="flex-1 text-left"><span className="flex justify-between items-center"><span className="text-sm font-medium">{module.nombre_modulo}</span><ChevronDown className="w-4 h-4 text-muted" /></span><span className="text-xs text-secondary">{bloqueado ? 'Administrado desde su propio módulo · ' : ''}{module.tipos_actividad?.filter((type) => type.activo !== false).length ?? 0} actividades activas</span></button><div className="flex items-center gap-2 ml-2">{bloqueado ? null : <><button type="button" aria-label={`Editar ${module.nombre_modulo}`} title="Editar módulo" onClick={() => { setEditingModuleId(module.id); setEditingName(module.nombre_modulo) }} className="text-muted hover:text-accent"><Edit3 className="w-4 h-4" /></button><button type="button" aria-label="Cambiar estado" title={module.activo === false ? 'Reactivar módulo' : 'Desactivar módulo'} onClick={() => toggleModule(module)} className={module.activo === false ? 'text-success' : 'text-muted hover:text-danger'}><Power className="w-4 h-4" /></button></>}</div></div> })}</div>{filteredModules.length === 0 && <p className="text-sm text-muted text-center py-5">No hay módulos que coincidan.</p>}</section>
      <section className="card p-5"><h2 className="font-medium">{seleccionado?.nombre_modulo ?? 'Selecciona un módulo'}</h2><p className="text-xs text-secondary mt-1 mb-4">Tipos de actividad disponibles para el registro.</p>{seleccionado ? <><form onSubmit={agregarActividad} className="grid sm:grid-cols-[1fr_0.8fr_auto] gap-2 mb-4"><input required className="input-field" placeholder="Ej. Culto dominical" value={actividad} onChange={(event) => setActividad(event.target.value)} /><input className="input-field" placeholder="Característica (opcional)" value={caracter} onChange={(event) => setCaracter(event.target.value)} /><button disabled={saving} className="btn-secondary px-3" aria-label="Agregar actividad"><Plus className="w-4 h-4" /></button></form><div className="flex flex-col gap-2">{visibleActivities.map((type) => <div key={type.id} className="activity-item"><div className="min-w-0"><p className="text-sm font-medium truncate">{type.nombre}</p>{type.caracter && <span className="text-[10px] uppercase tracking-[0.1em] text-accent">{type.caracter}</span>}</div><div className="flex items-center gap-2"><button type="button" aria-label={`Editar ${type.nombre}`} title="Editar actividad" onClick={() => { setEditingActivityId(type.id); setEditingActivityName(type.nombre) }} className="text-muted hover:text-accent"><Edit3 className="w-4 h-4" /></button><button type="button" aria-label="Desactivar actividad" title="Desactivar actividad" onClick={() => toggleActivity(type)} className="text-muted hover:text-danger"><Power className="w-4 h-4" /></button></div></div>)}</div>{visibleActivities.length === 0 && <p className="text-sm text-muted py-8 text-center">Aún no hay actividades activas.</p>}</> : <div className="h-48 flex items-center justify-center text-sm text-muted border border-dashed border-border rounded">Elige un módulo de la lista</div>}</section>
    </div>
    <section className="card p-5">
      <div className="flex justify-between items-center mb-1"><div><h2 className="font-medium">Caracteres de culto</h2><p className="text-xs text-secondary mt-1">Ej. Enseñanza, Alabanza, Evangelismo. Se eligen al capturar la asistencia, sin importar el módulo — así "Culto Martes" puede ser "Enseñanza" una semana y "Alabanza" otra.</p></div><Sparkles className="w-5 h-5 text-accent flex-shrink-0" /></div>
      <form onSubmit={agregarCaracterCulto} className="flex gap-2 my-4"><input required className="input-field" placeholder="Nuevo carácter (ej. Alabanza)" value={nuevoCaracterCulto} onChange={(event) => setNuevoCaracterCulto(event.target.value)} /><button disabled={saving} className="btn-primary px-3" aria-label="Agregar carácter de culto"><Plus className="w-4 h-4" /></button></form>
      <div className="flex flex-wrap gap-2">{caracteresCulto.map((item) => <div key={item.id} className={`flex items-center gap-2 rounded-full border border-border pl-3 pr-1.5 py-1.5 ${item.activo === false ? 'opacity-50' : ''}`}><span className="text-sm">{item.nombre}</span><button type="button" aria-label={`Editar ${item.nombre}`} title="Editar" onClick={() => { setEditingCaracterCultoId(item.id); setEditingCaracterCultoName(item.nombre) }} className="text-muted hover:text-accent p-1"><Edit3 className="w-3.5 h-3.5" /></button><button type="button" aria-label="Cambiar estado" title={item.activo === false ? 'Reactivar' : 'Desactivar'} onClick={() => toggleCaracterCulto(item)} className={`p-1 ${item.activo === false ? 'text-success' : 'text-muted hover:text-danger'}`}><Power className="w-3.5 h-3.5" /></button></div>)}</div>
      {caracteresCulto.length === 0 && <p className="text-sm text-muted text-center py-4">Aún no hay caracteres de culto configurados.</p>}
    </section>
    <section className="card p-5">
      <div className="flex justify-between items-center mb-1"><div><h2 className="font-medium">Ujieres</h2><p className="text-xs text-secondary mt-1">Lista fija de quienes prestan el servicio de ujier. Al registrar la asistencia se elige cuál de ellos fue el responsable de ese culto — no depende de qué cuenta esté usando el celular.</p></div><UsersRound className="w-5 h-5 text-accent flex-shrink-0" /></div>
      <form onSubmit={agregarUjier} className="flex gap-2 my-4"><input required className="input-field" placeholder="Nombre del ujier" value={nuevoUjier} onChange={(event) => setNuevoUjier(event.target.value)} /><button disabled={saving} className="btn-primary px-3" aria-label="Agregar ujier"><Plus className="w-4 h-4" /></button></form>
      <details className="mb-4">
        <summary className="text-xs text-accent cursor-pointer select-none">Agregar varios a la vez (pegar una lista)</summary>
        <form onSubmit={agregarUjieresEnBloque} className="flex flex-col gap-2 mt-3">
          <textarea className="input-field min-h-24" placeholder={'Un nombre por línea, ej:\nJuan Pérez\nPepito Pérez'} value={bulkUjieres} onChange={(event) => setBulkUjieres(event.target.value)} />
          <button disabled={saving} className="btn-secondary self-start px-3">Agregar lista</button>
        </form>
      </details>
      <div className="flex flex-wrap gap-2">{ujieres.map((item) => <div key={item.id} className={`flex items-center gap-2 rounded-full border border-border pl-3 pr-1.5 py-1.5 ${item.activo === false ? 'opacity-50' : ''}`}><span className="text-sm">{item.nombre}</span><button type="button" aria-label={`Editar ${item.nombre}`} title="Editar" onClick={() => { setEditingUjierId(item.id); setEditingUjierName(item.nombre) }} className="text-muted hover:text-accent p-1"><Edit3 className="w-3.5 h-3.5" /></button><button type="button" aria-label="Cambiar estado" title={item.activo === false ? 'Reactivar' : 'Desactivar'} onClick={() => toggleUjier(item)} className={`p-1 ${item.activo === false ? 'text-success' : 'text-muted hover:text-danger'}`}><Power className="w-3.5 h-3.5" /></button></div>)}</div>
      {ujieres.length === 0 && <p className="text-sm text-muted text-center py-4">Aún no hay ujieres registrados.</p>}
    </section>
    <section className="card p-5">
      <div className="flex justify-between items-center mb-1"><div><h2 className="font-medium">Lecciones REFAM</h2><p className="text-xs text-secondary mt-1">Currículo compartido de la congregación. Cada persona en REFAM avanza lección por lección, sin saltarse ninguna, hasta completarlo.</p></div><HeartHandshake className="w-5 h-5 text-accent flex-shrink-0" /></div>
      <form onSubmit={agregarLeccionRefam} className="grid sm:grid-cols-[auto_1fr_auto] gap-2 my-4 items-start">
        <span className="input-field w-14 text-center text-sm text-muted flex items-center justify-center">#{Math.max(0, ...refamLecciones.map((item) => item.numero)) + 1}</span>
        <div className="grid gap-2">
          <input required className="input-field" placeholder="Título de la lección" value={nuevaLeccionRefamTitulo} onChange={(event) => setNuevaLeccionRefamTitulo(event.target.value)} />
          <textarea className="input-field min-h-16" placeholder="Descripción corta (opcional)" value={nuevaLeccionRefamDescripcion} onChange={(event) => setNuevaLeccionRefamDescripcion(event.target.value)} />
        </div>
        <button disabled={saving} className="btn-primary px-3 self-start" aria-label="Agregar lección REFAM"><Plus className="w-4 h-4" /></button>
      </form>
      <div className="flex flex-col gap-2">{refamLecciones.map((item) => <div key={item.id} className={`border border-border rounded-card p-3 flex items-start justify-between gap-3 ${item.activo === false ? 'opacity-50' : ''}`}>
        <div className="min-w-0"><p className="text-sm font-medium">#{item.numero} — {item.titulo}</p>{item.descripcion && <p className="text-xs text-secondary mt-1">{item.descripcion}</p>}</div>
        <div className="flex items-center gap-2 flex-shrink-0"><button type="button" aria-label={`Editar lección ${item.numero}`} title="Editar" onClick={() => { setEditingLeccionRefamId(item.id); setEditingLeccionRefamTitulo(item.titulo); setEditingLeccionRefamDescripcion(item.descripcion || '') }} className="text-muted hover:text-accent"><Edit3 className="w-3.5 h-3.5" /></button><button type="button" aria-label="Cambiar estado" title={item.activo === false ? 'Reactivar' : 'Desactivar'} onClick={() => toggleLeccionRefam(item)} className={item.activo === false ? 'text-success' : 'text-muted hover:text-danger'}><Power className="w-3.5 h-3.5" /></button></div>
      </div>)}</div>
      {refamLecciones.length === 0 && <p className="text-sm text-muted text-center py-4">Aún no hay lecciones de REFAM configuradas.</p>}
    </section>
    <section className="card p-5">
      <div className="flex justify-between items-center mb-1"><div><h2 className="font-medium">Lecciones ESFOB / EFOB</h2><p className="text-xs text-secondary mt-1">Currículo compartido de formación bautismal. El responsable marca cada lección completada antes de avanzar a la siguiente.</p></div><GraduationCap className="w-5 h-5 text-accent flex-shrink-0" /></div>
      <form onSubmit={agregarLeccionEsfob} className="grid sm:grid-cols-[auto_1fr_auto] gap-2 my-4 items-start">
        <span className="input-field w-14 text-center text-sm text-muted flex items-center justify-center">#{Math.max(0, ...esfobLecciones.map((item) => item.numero)) + 1}</span>
        <div className="grid gap-2">
          <input required className="input-field" placeholder="Título de la lección" value={nuevaLeccionEsfobTitulo} onChange={(event) => setNuevaLeccionEsfobTitulo(event.target.value)} />
          <textarea className="input-field min-h-16" placeholder="Descripción corta (opcional)" value={nuevaLeccionEsfobDescripcion} onChange={(event) => setNuevaLeccionEsfobDescripcion(event.target.value)} />
        </div>
        <button disabled={saving} className="btn-primary px-3 self-start" aria-label="Agregar lección ESFOB"><Plus className="w-4 h-4" /></button>
      </form>
      <div className="flex flex-col gap-2">{esfobLecciones.map((item) => <div key={item.id} className={`border border-border rounded-card p-3 flex items-start justify-between gap-3 ${item.activo === false ? 'opacity-50' : ''}`}>
        <div className="min-w-0"><p className="text-sm font-medium">#{item.numero} — {item.titulo}</p>{item.descripcion && <p className="text-xs text-secondary mt-1">{item.descripcion}</p>}</div>
        <div className="flex items-center gap-2 flex-shrink-0"><button type="button" aria-label={`Editar lección ${item.numero}`} title="Editar" onClick={() => { setEditingLeccionEsfobId(item.id); setEditingLeccionEsfobTitulo(item.titulo); setEditingLeccionEsfobDescripcion(item.descripcion || '') }} className="text-muted hover:text-accent"><Edit3 className="w-3.5 h-3.5" /></button><button type="button" aria-label="Cambiar estado" title={item.activo === false ? 'Reactivar' : 'Desactivar'} onClick={() => toggleLeccionEsfob(item)} className={item.activo === false ? 'text-success' : 'text-muted hover:text-danger'}><Power className="w-3.5 h-3.5" /></button></div>
      </div>)}</div>
      {esfobLecciones.length === 0 && <p className="text-sm text-muted text-center py-4">Aún no hay lecciones de ESFOB configuradas.</p>}
    </section>
    {editingModuleId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveModuleName(modulos.find((module) => module.id === editingModuleId)) }} className="modal-panel"><h2 className="font-medium">Editar módulo</h2><input autoFocus required className="input-field mt-4" value={editingName} onChange={(event) => setEditingName(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingModuleId(null)} className="btn-secondary"><X className="w-4 h-4" />Cancelar</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />Guardar</button></div></form></div>}
    {editingActivityId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveActivity(seleccionado.tipos_actividad.find((type) => type.id === editingActivityId)) }} className="modal-panel"><h2 className="font-medium">Editar actividad</h2><input autoFocus required className="input-field mt-4" value={editingActivityName} onChange={(event) => setEditingActivityName(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingActivityId(null)} className="btn-secondary"><X className="w-4 h-4" />Cancelar</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />Guardar</button></div></form></div>}
    {editingCaracterCultoId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveCaracterCulto(caracteresCulto.find((item) => item.id === editingCaracterCultoId)) }} className="modal-panel"><h2 className="font-medium">Editar carácter de culto</h2><input autoFocus required className="input-field mt-4" value={editingCaracterCultoName} onChange={(event) => setEditingCaracterCultoName(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingCaracterCultoId(null)} className="btn-secondary"><X className="w-4 h-4" />Cancelar</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />Guardar</button></div></form></div>}
    {editingUjierId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveUjier(ujieres.find((item) => item.id === editingUjierId)) }} className="modal-panel"><h2 className="font-medium">Editar ujier</h2><input autoFocus required className="input-field mt-4" value={editingUjierName} onChange={(event) => setEditingUjierName(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingUjierId(null)} className="btn-secondary"><X className="w-4 h-4" />Cancelar</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />Guardar</button></div></form></div>}
    {editingLeccionRefamId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveLeccionRefam(refamLecciones.find((item) => item.id === editingLeccionRefamId)) }} className="modal-panel"><h2 className="font-medium">Editar lección REFAM</h2><input autoFocus required className="input-field mt-4" value={editingLeccionRefamTitulo} onChange={(event) => setEditingLeccionRefamTitulo(event.target.value)} /><textarea className="input-field mt-2 min-h-20" placeholder="Descripción corta (opcional)" value={editingLeccionRefamDescripcion} onChange={(event) => setEditingLeccionRefamDescripcion(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingLeccionRefamId(null)} className="btn-secondary"><X className="w-4 h-4" />Cancelar</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />Guardar</button></div></form></div>}
    {editingLeccionEsfobId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveLeccionEsfob(esfobLecciones.find((item) => item.id === editingLeccionEsfobId)) }} className="modal-panel"><h2 className="font-medium">Editar lección ESFOB</h2><input autoFocus required className="input-field mt-4" value={editingLeccionEsfobTitulo} onChange={(event) => setEditingLeccionEsfobTitulo(event.target.value)} /><textarea className="input-field mt-2 min-h-20" placeholder="Descripción corta (opcional)" value={editingLeccionEsfobDescripcion} onChange={(event) => setEditingLeccionEsfobDescripcion(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingLeccionEsfobId(null)} className="btn-secondary"><X className="w-4 h-4" />Cancelar</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />Guardar</button></div></form></div>}
  </div>
}