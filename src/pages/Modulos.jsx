import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Check, ChevronDown, Edit3, GraduationCap, HeartHandshake, Layers3, Plus, Power, Search, Sparkles, Trash2, UsersRound, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'
import { useUndoDelete } from '../hooks/useUndoDelete'
import InfoTip from '../components/InfoTip'
import UndoToast from '../components/UndoToast'

// Estos módulos los siembran sus propias migraciones y sus pantallas los
// ubican por nombre exacto (ver Evangelismo.jsx y MisionJuvenil.jsx). No deben
// renombrarse ni desactivarse desde aquí porque eso las deja sin módulo.
const SYSTEM_MODULE_NAMES = ['evangelismo', 'mision juvenil']
const esModuloSistema = (module) => SYSTEM_MODULE_NAMES.includes(module.nombre_modulo.trim().toLowerCase())

const modulosCache = new Map()

export default function Modulos() {
  const { t } = useTranslation()
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const { pending: pendingUndo, registerDelete, undo } = useUndoDelete(load)
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
  const [discipuladoLecciones, setDiscipuladoLecciones] = useState([])
  const [nuevaLeccionDiscipuladoTitulo, setNuevaLeccionDiscipuladoTitulo] = useState('')
  const [nuevaLeccionDiscipuladoDescripcion, setNuevaLeccionDiscipuladoDescripcion] = useState('')
  const [editingLeccionDiscipuladoId, setEditingLeccionDiscipuladoId] = useState(null)
  const [editingLeccionDiscipuladoTitulo, setEditingLeccionDiscipuladoTitulo] = useState('')
  const [editingLeccionDiscipuladoDescripcion, setEditingLeccionDiscipuladoDescripcion] = useState('')
  const [comites, setComites] = useState([])
  const [rangosEdad, setRangosEdad] = useState([])
  const RANGO_EDAD_VACIO = { nombre: '', edad_desde: '', edad_hasta: '', genero: '', estado_civil: '', comite_id: '' }
  const [nuevoRangoEdad, setNuevoRangoEdad] = useState(RANGO_EDAD_VACIO)
  const [editingRangoEdadId, setEditingRangoEdadId] = useState(null)
  const [editingRangoEdad, setEditingRangoEdad] = useState(RANGO_EDAD_VACIO)
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
    const cacheKey = congregacionId
    const cached = modulosCache.get(cacheKey)
    if (cached) {
      setModulos(cached.modulos)
      setSeleccionado((current) => cached.modulos.find((module) => module.id === current?.id) ?? cached.modulos[0] ?? null)
      setCaracteresCulto(cached.caracteresCulto)
      setUjieres(cached.ujieres)
      setRefamLecciones(cached.refamLecciones)
      setEsfobLecciones(cached.esfobLecciones)
      setDiscipuladoLecciones(cached.discipuladoLecciones)
      setComites(cached.comites)
      setRangosEdad(cached.rangosEdad)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    const [modulosResult, caracteresResult, ujieresResult, refamLeccionesResult, esfobLeccionesResult, discipuladoLeccionesResult, comitesResult, rangosEdadResult] = await Promise.all([
      supabase.from('modulos').select('id, nombre_modulo, alcance, activo, tipos_actividad(id, nombre, caracter, activo)').eq('congregacion_id', congregacionId).order('created_at'),
      supabase.from('caracteres_culto').select('id, nombre, activo').eq('congregacion_id', congregacionId).order('nombre'),
      supabase.from('ujieres_congregacion').select('id, nombre, activo').eq('congregacion_id', congregacionId).order('nombre'),
      supabase.from('refam_lecciones').select('id, numero, titulo, descripcion, activo').eq('congregacion_id', congregacionId).order('numero'),
      supabase.from('esfob_lecciones').select('id, numero, titulo, descripcion, activo').eq('congregacion_id', congregacionId).order('numero'),
      supabase.from('discipulado_lecciones').select('id, numero, titulo, descripcion, activo').eq('congregacion_id', congregacionId).order('numero'),
      supabase.from('comites').select('id, nombre').eq('congregacion_id', congregacionId).eq('activo', true).order('nombre'),
      supabase.from('rangos_edad_comite').select('id, nombre, edad_desde, edad_hasta, genero, estado_civil, comite_id, activo, comites(nombre)').eq('congregacion_id', congregacionId).order('edad_desde'),
    ])
    if (modulosResult.error) setError(t('modulos.errores.cargarModulos', { mensaje: modulosResult.error.message }))
    const loaded = modulosResult.data ?? []
    const freshData = {
      modulos: loaded,
      caracteresCulto: caracteresResult.data ?? [],
      ujieres: ujieresResult.data ?? [],
      refamLecciones: refamLeccionesResult.data ?? [],
      esfobLecciones: esfobLeccionesResult.data ?? [],
      discipuladoLecciones: discipuladoLeccionesResult.data ?? [],
      comites: comitesResult.data ?? [],
      rangosEdad: rangosEdadResult.data ?? [],
    }
    setModulos(freshData.modulos)
    setSeleccionado((current) => loaded.find((module) => module.id === current?.id) ?? loaded[0] ?? null)
    setCaracteresCulto(freshData.caracteresCulto)
    setUjieres(freshData.ujieres)
    setRefamLecciones(freshData.refamLecciones)
    setEsfobLecciones(freshData.esfobLecciones)
    setDiscipuladoLecciones(freshData.discipuladoLecciones)
    setComites(freshData.comites)
    setRangosEdad(freshData.rangosEdad)
    setLoading(false)
    modulosCache.set(cacheKey, freshData)
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
    if (modulos.some((module) => module.nombre_modulo.toLowerCase() === value.toLowerCase())) { setError(t('modulos.moduloNombreDuplicado')); return }
    setSaving(true); setError(null)
    const { data, error: insertError } = await supabase.from('modulos').insert({ congregacion_id: congregacionId, nombre_modulo: value, alcance: 'interno' }).select('id, nombre_modulo, alcance, activo, tipos_actividad(id, nombre, caracter, activo)').single()
    setSaving(false)
    if (insertError) { setError(t('modulos.errores.crearModulo', { mensaje: insertError.message })); return }
    setNombre(''); setModulos((current) => [...current, data]); setSeleccionado(data)
  }

  async function agregarActividad(event) {
    event.preventDefault()
    const value = actividad.trim()
    if (!seleccionado || !value) return
    if (seleccionado.tipos_actividad?.some((type) => type.nombre.toLowerCase() === value.toLowerCase())) { setError(t('modulos.actividadNombreDuplicada')); return }
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('tipos_actividad').insert({ modulo_id: seleccionado.id, nombre: value, caracter: caracter.trim() || null })
    setSaving(false)
    if (insertError) { setError(t('modulos.errores.crearActividad', { mensaje: insertError.message })); return }
    setActividad(''); setCaracter(''); load()
  }

  async function saveModuleName(module) {
    if (esModuloSistema(module)) { setError(t('modulos.moduloBloqueadoAviso')); return }
    const value = editingName.trim()
    if (!value) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('modulos').update({ nombre_modulo: value }).eq('id', module.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(t('modulos.errores.actualizarModulo', { mensaje: updateError.message })); return }
    setEditingModuleId(null); load()
  }

  async function toggleModule(module) {
    if (esModuloSistema(module)) { setError(t('modulos.moduloBloqueadoAviso')); return }
    if (!window.confirm(t(module.activo === false ? 'modulos.confirmReactivarModulo' : 'modulos.confirmDesactivarModulo', { nombre: module.nombre_modulo }))) return
    const { error: updateError } = await supabase.from('modulos').update({ activo: module.activo === false }).eq('id', module.id).eq('congregacion_id', congregacionId)
    if (updateError) { setError(t('modulos.errores.cambiarEstado', { mensaje: updateError.message })); return }
    load()
  }

  async function saveActivity(type) {
    const value = editingActivityName.trim()
    if (!value) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('tipos_actividad').update({ nombre: value }).eq('id', type.id)
    setSaving(false)
    if (updateError) { setError(t('modulos.errores.actualizarActividad', { mensaje: updateError.message })); return }
    setEditingActivityId(null); load()
  }

  async function toggleActivity(type) {
    const { error: updateError } = await supabase.from('tipos_actividad').update({ activo: type.activo === false }).eq('id', type.id)
    if (updateError) setError(t('modulos.errores.cambiarEstadoActividad', { mensaje: updateError.message }))
    else load()
  }

  async function agregarCaracterCulto(event) {
    event.preventDefault()
    const value = nuevoCaracterCulto.trim()
    if (!value) return
    if (caracteresCulto.some((item) => item.nombre.toLowerCase() === value.toLowerCase())) { setError(t('modulos.caracterNombreDuplicado')); return }
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('caracteres_culto').insert({ congregacion_id: congregacionId, nombre: value })
    setSaving(false)
    if (insertError) { setError(t('modulos.errores.crearCaracter', { mensaje: insertError.message })); return }
    setNuevoCaracterCulto(''); load()
  }

  async function saveCaracterCulto(item) {
    const value = editingCaracterCultoName.trim()
    if (!value) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('caracteres_culto').update({ nombre: value }).eq('id', item.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(t('modulos.errores.actualizarCaracter', { mensaje: updateError.message })); return }
    setEditingCaracterCultoId(null); load()
  }

  async function toggleCaracterCulto(item) {
    const { error: updateError } = await supabase.from('caracteres_culto').update({ activo: item.activo === false }).eq('id', item.id).eq('congregacion_id', congregacionId)
    if (updateError) setError(t('modulos.errores.cambiarEstadoCaracter', { mensaje: updateError.message }))
    else load()
  }

  async function agregarUjier(event) {
    event.preventDefault()
    const value = nuevoUjier.trim()
    if (!value) return
    if (ujieres.some((item) => item.nombre.toLowerCase() === value.toLowerCase())) { setError(t('modulos.ujierNombreDuplicado')); return }
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('ujieres_congregacion').insert({ congregacion_id: congregacionId, nombre: value })
    setSaving(false)
    if (insertError) { setError(t('modulos.errores.agregarUjier', { mensaje: insertError.message })); return }
    setNuevoUjier(''); load()
  }

  async function agregarUjieresEnBloque(event) {
    event.preventDefault()
    const existentes = new Set(ujieres.map((item) => item.nombre.toLowerCase()))
    // Acepta un nombre por línea (Enter) O separados por punto y coma --
    // nunca coma, porque un nombre real puede venir escrito "Apellido,
    // Nombre" y partirlo por coma rompería ese nombre en dos.
    const nombresNuevos = [...new Set(
      bulkUjieres.split(/[\n;]+/).map((line) => line.trim()).filter(Boolean)
    )].filter((nombreLinea) => !existentes.has(nombreLinea.toLowerCase()))
    if (nombresNuevos.length === 0) { setError(t('modulos.ujieresBloqueSinNuevos')); return }
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('ujieres_congregacion').insert(nombresNuevos.map((nombreUjier) => ({ congregacion_id: congregacionId, nombre: nombreUjier })))
    setSaving(false)
    if (insertError) { setError(t('modulos.errores.agregarUjieresBloque', { mensaje: insertError.message })); return }
    setBulkUjieres(''); load()
  }

  async function saveUjier(item) {
    const value = editingUjierName.trim()
    if (!value) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('ujieres_congregacion').update({ nombre: value }).eq('id', item.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(t('modulos.errores.actualizarUjier', { mensaje: updateError.message })); return }
    setEditingUjierId(null); load()
  }

  async function toggleUjier(item) {
    const { error: updateError } = await supabase.from('ujieres_congregacion').update({ activo: item.activo === false }).eq('id', item.id).eq('congregacion_id', congregacionId)
    if (updateError) setError(t('modulos.errores.cambiarEstadoUjier', { mensaje: updateError.message }))
    else load()
  }

  // Borrado real (no solo desactivar), pensado para corregir errores al
  // escribir o al pegar una lista -- con "deshacer" 8s en vez de un
  // window.confirm(), igual que el resto de catálogos de esta pantalla
  // (Configuracion.jsx). Si el ujier ya tomó asistencia antes,
  // registros_actividad.ujier_responsable_id queda en null (así está
  // definido el on delete de esa columna) -- el registro de asistencia
  // en sí no se borra, solo deja de decir quién fue el responsable.
  async function quitarUjier(item) {
    const { error: deleteError } = await supabase.from('ujieres_congregacion').delete().eq('id', item.id).eq('congregacion_id', congregacionId)
    if (deleteError) { setError(t('modulos.errores.eliminarUjier', { mensaje: deleteError.message })); return }
    registerDelete('ujieres_congregacion', { ...item, congregacion_id: congregacionId }, item.nombre)
    load()
  }

  async function agregarLeccionRefam(event) {
    event.preventDefault()
    const titulo = nuevaLeccionRefamTitulo.trim()
    if (!titulo) return
    const numero = Math.max(0, ...refamLecciones.map((item) => item.numero)) + 1
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('refam_lecciones').insert({ congregacion_id: congregacionId, numero, titulo, descripcion: nuevaLeccionRefamDescripcion.trim() || null })
    setSaving(false)
    if (insertError) { setError(t('modulos.errores.crearLeccion', { mensaje: insertError.message })); return }
    setNuevaLeccionRefamTitulo(''); setNuevaLeccionRefamDescripcion(''); load()
  }

  async function saveLeccionRefam(item) {
    const titulo = editingLeccionRefamTitulo.trim()
    if (!titulo) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('refam_lecciones').update({ titulo, descripcion: editingLeccionRefamDescripcion.trim() || null }).eq('id', item.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(t('modulos.errores.actualizarLeccion', { mensaje: updateError.message })); return }
    setEditingLeccionRefamId(null); load()
  }

  async function toggleLeccionRefam(item) {
    const { error: updateError } = await supabase.from('refam_lecciones').update({ activo: item.activo === false }).eq('id', item.id).eq('congregacion_id', congregacionId)
    if (updateError) setError(t('modulos.errores.cambiarEstadoLeccion', { mensaje: updateError.message }))
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
    if (insertError) { setError(t('modulos.errores.crearLeccion', { mensaje: insertError.message })); return }
    setNuevaLeccionEsfobTitulo(''); setNuevaLeccionEsfobDescripcion(''); load()
  }

  async function saveLeccionEsfob(item) {
    const titulo = editingLeccionEsfobTitulo.trim()
    if (!titulo) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('esfob_lecciones').update({ titulo, descripcion: editingLeccionEsfobDescripcion.trim() || null }).eq('id', item.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(t('modulos.errores.actualizarLeccion', { mensaje: updateError.message })); return }
    setEditingLeccionEsfobId(null); load()
  }

  async function toggleLeccionEsfob(item) {
    const { error: updateError } = await supabase.from('esfob_lecciones').update({ activo: item.activo === false }).eq('id', item.id).eq('congregacion_id', congregacionId)
    if (updateError) setError(t('modulos.errores.cambiarEstadoLeccion', { mensaje: updateError.message }))
    else load()
  }

  async function agregarLeccionDiscipulado(event) {
    event.preventDefault()
    const titulo = nuevaLeccionDiscipuladoTitulo.trim()
    if (!titulo) return
    const numero = Math.max(0, ...discipuladoLecciones.map((item) => item.numero)) + 1
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('discipulado_lecciones').insert({ congregacion_id: congregacionId, numero, titulo, descripcion: nuevaLeccionDiscipuladoDescripcion.trim() || null })
    setSaving(false)
    if (insertError) { setError(t('modulos.errores.crearLeccion', { mensaje: insertError.message })); return }
    setNuevaLeccionDiscipuladoTitulo(''); setNuevaLeccionDiscipuladoDescripcion(''); load()
  }

  async function saveLeccionDiscipulado(item) {
    const titulo = editingLeccionDiscipuladoTitulo.trim()
    if (!titulo) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('discipulado_lecciones').update({ titulo, descripcion: editingLeccionDiscipuladoDescripcion.trim() || null }).eq('id', item.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(t('modulos.errores.actualizarLeccion', { mensaje: updateError.message })); return }
    setEditingLeccionDiscipuladoId(null); load()
  }

  async function toggleLeccionDiscipulado(item) {
    const { error: updateError } = await supabase.from('discipulado_lecciones').update({ activo: item.activo === false }).eq('id', item.id).eq('congregacion_id', congregacionId)
    if (updateError) setError(t('modulos.errores.cambiarEstadoLeccion', { mensaje: updateError.message }))
    else load()
  }

  async function agregarRangoEdad(event) {
    event.preventDefault()
    if (!nuevoRangoEdad.nombre.trim() || nuevoRangoEdad.edad_desde === '' || !nuevoRangoEdad.comite_id) return
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('rangos_edad_comite').insert({
      congregacion_id: congregacionId,
      nombre: nuevoRangoEdad.nombre.trim(),
      edad_desde: Number(nuevoRangoEdad.edad_desde),
      edad_hasta: nuevoRangoEdad.edad_hasta === '' ? null : Number(nuevoRangoEdad.edad_hasta),
      genero: nuevoRangoEdad.genero || null,
      estado_civil: nuevoRangoEdad.estado_civil || null,
      comite_id: nuevoRangoEdad.comite_id,
    })
    setSaving(false)
    if (insertError) { setError(t('modulos.errores.crearRango', { mensaje: insertError.message })); return }
    setNuevoRangoEdad(RANGO_EDAD_VACIO); load()
  }

  function editarRangoEdad(item) {
    setEditingRangoEdadId(item.id)
    setEditingRangoEdad({
      nombre: item.nombre,
      edad_desde: String(item.edad_desde),
      edad_hasta: item.edad_hasta === null ? '' : String(item.edad_hasta),
      genero: item.genero || '',
      estado_civil: item.estado_civil || '',
      comite_id: item.comite_id,
    })
  }

  async function guardarRangoEdad(item) {
    if (!editingRangoEdad.nombre.trim() || editingRangoEdad.edad_desde === '' || !editingRangoEdad.comite_id) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('rangos_edad_comite').update({
      nombre: editingRangoEdad.nombre.trim(),
      edad_desde: Number(editingRangoEdad.edad_desde),
      edad_hasta: editingRangoEdad.edad_hasta === '' ? null : Number(editingRangoEdad.edad_hasta),
      genero: editingRangoEdad.genero || null,
      estado_civil: editingRangoEdad.estado_civil || null,
      comite_id: editingRangoEdad.comite_id,
    }).eq('id', item.id).eq('congregacion_id', congregacionId)
    setSaving(false)
    if (updateError) { setError(t('modulos.errores.actualizarRango', { mensaje: updateError.message })); return }
    setEditingRangoEdadId(null); load()
  }

  async function toggleRangoEdad(item) {
    const { error: updateError } = await supabase.from('rangos_edad_comite').update({ activo: item.activo === false }).eq('id', item.id).eq('congregacion_id', congregacionId)
    if (updateError) setError(t('modulos.errores.cambiarEstadoRango', { mensaje: updateError.message }))
    else load()
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('modulos.cargando')}</div>
  if (rolPrincipal?.nivel !== 'local' || (rolPrincipal.rol_local && rolPrincipal.rol_local !== 'pastor')) return <div className="card p-8 text-center text-sm text-secondary">{t('modulos.sinPermiso')}</div>

  return <div className="page-shell">
    <header><p className="eyebrow">{t('modulos.eyebrow')}</p><h1 className="section-title">{t('modulos.titulo')}</h1><p className="text-sm text-secondary mt-1">{t('modulos.subtitulo')}</p></header>
    {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
    <section className="grid sm:grid-cols-3 gap-3"><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{t('modulos.statModulosActivos')}</p><p className="text-2xl font-semibold mt-3">{activeModules}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{t('modulos.statActividadesActivas')}</p><p className="text-2xl font-semibold mt-3">{totalActivities}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{t('modulos.statModuloSeleccionado')}</p><p className="text-sm font-semibold mt-4 truncate">{seleccionado?.nombre_modulo || t('modulos.ninguno')}</p></div></section>
    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
      <section className="card p-5"><div className="flex justify-between items-center mb-4"><div><h2 className="font-medium">{t('modulos.panelModulosTitulo')}</h2><p className="text-xs text-secondary mt-1">{t('modulos.panelModulosSubtitulo')}</p></div><Layers3 className="w-5 h-5 text-accent" /></div><form onSubmit={agregarModulo} className="flex gap-2 mb-3"><input required className="input-field" placeholder={t('modulos.placeholderNuevoModulo')} value={nombre} onChange={(event) => setNombre(event.target.value)} /><button disabled={saving} className="btn-primary px-3" aria-label={t('modulos.ariaAgregarModulo')}><Plus className="w-4 h-4" /></button></form><div className="flex items-center gap-2 border border-border rounded px-3 py-2 mb-4"><Search className="w-4 h-4 text-muted" /><input aria-label={t('modulos.ariaBuscarModulos')} className="bg-transparent outline-none text-sm w-full" placeholder={t('modulos.placeholderBuscarModulo')} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div><div className="flex flex-col gap-2">{filteredModules.map((module) => { const bloqueado = esModuloSistema(module); return <div key={module.id} className={`module-item ${seleccionado?.id === module.id ? 'module-item-active' : ''} ${module.activo === false ? 'opacity-55' : ''}`}><button type="button" onClick={() => setSeleccionado(module)} className="flex-1 text-left"><span className="flex justify-between items-center"><span className="text-sm font-medium">{module.nombre_modulo}</span><ChevronDown className="w-4 h-4 text-muted" /></span><span className="text-xs text-secondary">{bloqueado ? t('modulos.administradoPropioModulo') : ''}{t('modulos.actividadesActivasCount', { count: module.tipos_actividad?.filter((type) => type.activo !== false).length ?? 0 })}</span></button><div className="flex items-center gap-2 ml-2">{bloqueado ? null : <><button type="button" aria-label={t('modulos.ariaEditarNombre', { nombre: module.nombre_modulo })} title={t('modulos.tituloEditarModulo')} onClick={() => { setEditingModuleId(module.id); setEditingName(module.nombre_modulo) }} className="text-muted hover:text-accent"><Edit3 className="w-4 h-4" /></button><button type="button" aria-label={t('modulos.ariaCambiarEstado')} title={module.activo === false ? t('modulos.reactivarModulo') : t('modulos.desactivarModulo')} onClick={() => toggleModule(module)} className={module.activo === false ? 'text-success' : 'text-muted hover:text-danger'}><Power className="w-4 h-4" /></button></>}</div></div> })}</div>{filteredModules.length === 0 && <p className="text-sm text-muted text-center py-5">{t('modulos.textoSinModulos')}</p>}</section>
      <section className="card p-5"><h2 className="font-medium">{seleccionado?.nombre_modulo ?? t('modulos.seleccionaModulo')}</h2><p className="text-xs text-secondary mt-1 mb-4">{t('modulos.panelActividadesSubtitulo')}</p>{seleccionado ? <><form onSubmit={agregarActividad} className="grid sm:grid-cols-[1fr_0.8fr_auto] gap-2 mb-4"><input required className="input-field" placeholder={t('modulos.placeholderActividad')} value={actividad} onChange={(event) => setActividad(event.target.value)} /><input className="input-field" placeholder={t('modulos.placeholderCaracter')} value={caracter} onChange={(event) => setCaracter(event.target.value)} /><button disabled={saving} className="btn-secondary px-3" aria-label={t('modulos.ariaAgregarActividad')}><Plus className="w-4 h-4" /></button></form><div className="flex flex-col gap-2">{visibleActivities.map((type) => <div key={type.id} className="activity-item"><div className="min-w-0"><p className="text-sm font-medium truncate">{type.nombre}</p>{type.caracter && <span className="text-[10px] uppercase tracking-[0.1em] text-accent">{type.caracter}</span>}</div><div className="flex items-center gap-2"><button type="button" aria-label={t('modulos.ariaEditarNombre', { nombre: type.nombre })} title={t('modulos.tituloEditarActividad')} onClick={() => { setEditingActivityId(type.id); setEditingActivityName(type.nombre) }} className="text-muted hover:text-accent"><Edit3 className="w-4 h-4" /></button><button type="button" aria-label={t('modulos.tituloDesactivarActividad')} title={t('modulos.tituloDesactivarActividad')} onClick={() => toggleActivity(type)} className="text-muted hover:text-danger"><Power className="w-4 h-4" /></button></div></div>)}</div>{visibleActivities.length === 0 && <p className="text-sm text-muted py-8 text-center">{t('modulos.sinActividades')}</p>}</> : <div className="h-48 flex items-center justify-center text-sm text-muted border border-dashed border-border rounded">{t('modulos.eligeModulo')}</div>}</section>
    </div>
    <section className="card p-5">
      <div className="flex justify-between items-center mb-1"><div><h2 className="font-medium">{t('modulos.caracteresTitulo')}</h2><p className="text-xs text-secondary mt-1">{t('modulos.caracteresDescripcion')}</p></div><Sparkles className="w-5 h-5 text-accent flex-shrink-0" /></div>
      <form onSubmit={agregarCaracterCulto} className="flex gap-2 my-4"><input required className="input-field" placeholder={t('modulos.placeholderNuevoCaracter')} value={nuevoCaracterCulto} onChange={(event) => setNuevoCaracterCulto(event.target.value)} /><button disabled={saving} className="btn-primary px-3" aria-label={t('modulos.ariaAgregarCaracter')}><Plus className="w-4 h-4" /></button></form>
      <div className="flex flex-wrap gap-2">{caracteresCulto.map((item) => <div key={item.id} className={`flex items-center gap-2 rounded-full border border-border pl-3 pr-1.5 py-1.5 ${item.activo === false ? 'opacity-50' : ''}`}><span className="text-sm">{item.nombre}</span><button type="button" aria-label={t('modulos.ariaEditarNombre', { nombre: item.nombre })} title={t('modulos.editarGenerico')} onClick={() => { setEditingCaracterCultoId(item.id); setEditingCaracterCultoName(item.nombre) }} className="text-muted hover:text-accent p-1"><Edit3 className="w-3.5 h-3.5" /></button><button type="button" aria-label={t('modulos.ariaCambiarEstado')} title={item.activo === false ? t('modulos.reactivar') : t('modulos.desactivar')} onClick={() => toggleCaracterCulto(item)} className={`p-1 ${item.activo === false ? 'text-success' : 'text-muted hover:text-danger'}`}><Power className="w-3.5 h-3.5" /></button></div>)}</div>
      {caracteresCulto.length === 0 && <p className="text-sm text-muted text-center py-4">{t('modulos.sinCaracteres')}</p>}
    </section>
    <section className="card p-5">
      <div className="flex justify-between items-center mb-1"><div><h2 className="font-medium">{t('modulos.ujieresTitulo')}</h2><p className="text-xs text-secondary mt-1">{t('modulos.ujieresDescripcion')}</p></div><UsersRound className="w-5 h-5 text-accent flex-shrink-0" /></div>
      <form onSubmit={agregarUjier} className="flex gap-2 my-4"><input required className="input-field" placeholder={t('modulos.placeholderNombreUjier')} value={nuevoUjier} onChange={(event) => setNuevoUjier(event.target.value)} /><button disabled={saving} className="btn-primary px-3" aria-label={t('modulos.ariaAgregarUjier')}><Plus className="w-4 h-4" /></button></form>
      <details className="mb-4">
        <summary className="text-xs text-accent cursor-pointer select-none">{t('modulos.bulkAgregarVarios')}</summary>
        <form onSubmit={agregarUjieresEnBloque} className="flex flex-col gap-2 mt-3">
          <p className="text-xs text-secondary">{t('modulos.bulkDescripcionPre')} <span className="font-mono">;</span> {t('modulos.bulkDescripcionPost')} <span className="font-mono">{t('modulos.bulkEjemploNombres')}</span></p>
          <textarea className="input-field min-h-24" placeholder={t('modulos.placeholderBulkTextarea')} value={bulkUjieres} onChange={(event) => setBulkUjieres(event.target.value)} />
          <button disabled={saving} className="btn-secondary self-start px-3">{t('modulos.botonAgregarLista')}</button>
        </form>
      </details>
      <div className="flex flex-wrap gap-2">{ujieres.map((item) => <div key={item.id} className={`flex items-center gap-2 rounded-full border border-border pl-3 pr-1.5 py-1.5 ${item.activo === false ? 'opacity-50' : ''}`}><span className="text-sm">{item.nombre}</span><button type="button" aria-label={t('modulos.ariaEditarNombre', { nombre: item.nombre })} title={t('modulos.editarGenerico')} onClick={() => { setEditingUjierId(item.id); setEditingUjierName(item.nombre) }} className="text-muted hover:text-accent p-1"><Edit3 className="w-3.5 h-3.5" /></button><button type="button" aria-label={t('modulos.ariaCambiarEstado')} title={item.activo === false ? t('modulos.reactivar') : t('modulos.desactivar')} onClick={() => toggleUjier(item)} className={`p-1 ${item.activo === false ? 'text-success' : 'text-muted hover:text-danger'}`}><Power className="w-3.5 h-3.5" /></button><button type="button" aria-label={t('modulos.ariaEliminarUjier', { nombre: item.nombre })} title={t('modulos.tituloEliminarUjier')} onClick={() => quitarUjier(item)} className="text-muted hover:text-danger p-1"><Trash2 className="w-3.5 h-3.5" /></button></div>)}</div>
      {ujieres.length === 0 && <p className="text-sm text-muted text-center py-4">{t('modulos.sinUjieres')}</p>}
    </section>
    <section className="card p-5">
      <div className="flex justify-between items-center mb-1"><div><h2 className="font-medium">{t('modulos.refamTitulo')}</h2><p className="text-xs text-secondary mt-1">{t('modulos.refamDescripcion')}</p></div><HeartHandshake className="w-5 h-5 text-accent flex-shrink-0" /></div>
      <form onSubmit={agregarLeccionRefam} className="grid sm:grid-cols-[auto_1fr_auto] gap-2 my-4 items-start">
        <span className="input-field w-16 text-center text-sm text-muted flex items-center justify-center gap-1">#{Math.max(0, ...refamLecciones.map((item) => item.numero)) + 1}<InfoTip texto={t('modulos.infoNumeroAutomatico')} /></span>
        <div className="grid gap-2">
          <input required className="input-field" placeholder={t('modulos.placeholderTituloLeccion')} value={nuevaLeccionRefamTitulo} onChange={(event) => setNuevaLeccionRefamTitulo(event.target.value)} />
          <textarea className="input-field min-h-16" placeholder={t('modulos.placeholderDescripcionLeccion')} value={nuevaLeccionRefamDescripcion} onChange={(event) => setNuevaLeccionRefamDescripcion(event.target.value)} />
        </div>
        <button disabled={saving} className="btn-primary px-3 self-start" aria-label={t('modulos.ariaAgregarLeccionRefam')}><Plus className="w-4 h-4" /></button>
      </form>
      <div className="flex flex-col gap-2">{refamLecciones.map((item) => <div key={item.id} className={`border border-border rounded-card p-3 flex items-start justify-between gap-3 ${item.activo === false ? 'opacity-50' : ''}`}>
        <div className="min-w-0"><p className="text-sm font-medium">#{item.numero} — {item.titulo}</p>{item.descripcion && <p className="text-xs text-secondary mt-1">{item.descripcion}</p>}</div>
        <div className="flex items-center gap-2 flex-shrink-0"><button type="button" aria-label={t('modulos.ariaEditarLeccionNumero', { numero: item.numero })} title={t('modulos.editarGenerico')} onClick={() => { setEditingLeccionRefamId(item.id); setEditingLeccionRefamTitulo(item.titulo); setEditingLeccionRefamDescripcion(item.descripcion || '') }} className="text-muted hover:text-accent"><Edit3 className="w-3.5 h-3.5" /></button><button type="button" aria-label={t('modulos.ariaCambiarEstado')} title={item.activo === false ? t('modulos.reactivar') : t('modulos.desactivar')} onClick={() => toggleLeccionRefam(item)} className={item.activo === false ? 'text-success' : 'text-muted hover:text-danger'}><Power className="w-3.5 h-3.5" /></button></div>
      </div>)}</div>
      {refamLecciones.length === 0 && <p className="text-sm text-muted text-center py-4">{t('modulos.sinLeccionesRefam')}</p>}
    </section>
    <section className="card p-5">
      <div className="flex justify-between items-center mb-1"><div><h2 className="font-medium">{t('modulos.esfobTitulo')}</h2><p className="text-xs text-secondary mt-1">{t('modulos.esfobDescripcion')}</p></div><GraduationCap className="w-5 h-5 text-accent flex-shrink-0" /></div>
      <form onSubmit={agregarLeccionEsfob} className="grid sm:grid-cols-[auto_1fr_auto] gap-2 my-4 items-start">
        <span className="input-field w-16 text-center text-sm text-muted flex items-center justify-center gap-1">#{Math.max(0, ...esfobLecciones.map((item) => item.numero)) + 1}<InfoTip texto={t('modulos.infoNumeroAutomatico')} /></span>
        <div className="grid gap-2">
          <input required className="input-field" placeholder={t('modulos.placeholderTituloLeccion')} value={nuevaLeccionEsfobTitulo} onChange={(event) => setNuevaLeccionEsfobTitulo(event.target.value)} />
          <textarea className="input-field min-h-16" placeholder={t('modulos.placeholderDescripcionLeccion')} value={nuevaLeccionEsfobDescripcion} onChange={(event) => setNuevaLeccionEsfobDescripcion(event.target.value)} />
        </div>
        <button disabled={saving} className="btn-primary px-3 self-start" aria-label={t('modulos.ariaAgregarLeccionEsfob')}><Plus className="w-4 h-4" /></button>
      </form>
      <div className="flex flex-col gap-2">{esfobLecciones.map((item) => <div key={item.id} className={`border border-border rounded-card p-3 flex items-start justify-between gap-3 ${item.activo === false ? 'opacity-50' : ''}`}>
        <div className="min-w-0"><p className="text-sm font-medium">#{item.numero} — {item.titulo}</p>{item.descripcion && <p className="text-xs text-secondary mt-1">{item.descripcion}</p>}</div>
        <div className="flex items-center gap-2 flex-shrink-0"><button type="button" aria-label={t('modulos.ariaEditarLeccionNumero', { numero: item.numero })} title={t('modulos.editarGenerico')} onClick={() => { setEditingLeccionEsfobId(item.id); setEditingLeccionEsfobTitulo(item.titulo); setEditingLeccionEsfobDescripcion(item.descripcion || '') }} className="text-muted hover:text-accent"><Edit3 className="w-3.5 h-3.5" /></button><button type="button" aria-label={t('modulos.ariaCambiarEstado')} title={item.activo === false ? t('modulos.reactivar') : t('modulos.desactivar')} onClick={() => toggleLeccionEsfob(item)} className={item.activo === false ? 'text-success' : 'text-muted hover:text-danger'}><Power className="w-3.5 h-3.5" /></button></div>
      </div>)}</div>
      {esfobLecciones.length === 0 && <p className="text-sm text-muted text-center py-4">{t('modulos.sinLeccionesEsfob')}</p>}
    </section>
    <section className="card p-5">
      <div className="flex justify-between items-center mb-1"><div><h2 className="font-medium">{t('modulos.discipuladoTitulo')}</h2><p className="text-xs text-secondary mt-1">{t('modulos.discipuladoDescripcion')}</p></div><BookOpen className="w-5 h-5 text-accent flex-shrink-0" /></div>
      <form onSubmit={agregarLeccionDiscipulado} className="grid sm:grid-cols-[auto_1fr_auto] gap-2 my-4 items-start">
        <span className="input-field w-16 text-center text-sm text-muted flex items-center justify-center gap-1">#{Math.max(0, ...discipuladoLecciones.map((item) => item.numero)) + 1}<InfoTip texto={t('modulos.infoNumeroAutomatico')} /></span>
        <div className="grid gap-2">
          <input required className="input-field" placeholder={t('modulos.placeholderTituloLeccion')} value={nuevaLeccionDiscipuladoTitulo} onChange={(event) => setNuevaLeccionDiscipuladoTitulo(event.target.value)} />
          <textarea className="input-field min-h-16" placeholder={t('modulos.placeholderDescripcionLeccion')} value={nuevaLeccionDiscipuladoDescripcion} onChange={(event) => setNuevaLeccionDiscipuladoDescripcion(event.target.value)} />
        </div>
        <button disabled={saving} className="btn-primary px-3 self-start" aria-label={t('modulos.ariaAgregarLeccionDiscipulado')}><Plus className="w-4 h-4" /></button>
      </form>
      <div className="flex flex-col gap-2">{discipuladoLecciones.map((item) => <div key={item.id} className={`border border-border rounded-card p-3 flex items-start justify-between gap-3 ${item.activo === false ? 'opacity-50' : ''}`}>
        <div className="min-w-0"><p className="text-sm font-medium">#{item.numero} — {item.titulo}</p>{item.descripcion && <p className="text-xs text-secondary mt-1">{item.descripcion}</p>}</div>
        <div className="flex items-center gap-2 flex-shrink-0"><button type="button" aria-label={t('modulos.ariaEditarLeccionNumero', { numero: item.numero })} title={t('modulos.editarGenerico')} onClick={() => { setEditingLeccionDiscipuladoId(item.id); setEditingLeccionDiscipuladoTitulo(item.titulo); setEditingLeccionDiscipuladoDescripcion(item.descripcion || '') }} className="text-muted hover:text-accent"><Edit3 className="w-3.5 h-3.5" /></button><button type="button" aria-label={t('modulos.ariaCambiarEstado')} title={item.activo === false ? t('modulos.reactivar') : t('modulos.desactivar')} onClick={() => toggleLeccionDiscipulado(item)} className={item.activo === false ? 'text-success' : 'text-muted hover:text-danger'}><Power className="w-3.5 h-3.5" /></button></div>
      </div>)}</div>
      {discipuladoLecciones.length === 0 && <p className="text-sm text-muted text-center py-4">{t('modulos.sinLeccionesDiscipulado')}</p>}
    </section>
    <section className="card p-5">
      <div className="flex justify-between items-center mb-1"><div><h2 className="font-medium">{t('modulos.rangosTitulo')}</h2><p className="text-xs text-secondary mt-1">{t('modulos.rangosDescripcion')}</p></div><UsersRound className="w-5 h-5 text-accent flex-shrink-0" /></div>
      {comites.length === 0 && <p className="text-xs text-warning bg-warning-bg rounded p-2 my-3">{t('modulos.sinComitesAviso')}</p>}
      <form onSubmit={agregarRangoEdad} className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2 my-4 items-end">
        <label className="text-xs text-secondary lg:col-span-2">{t('modulos.labelNombreRango')}<input required className="input-field mt-1" placeholder={t('modulos.placeholderNombreRango')} value={nuevoRangoEdad.nombre} onChange={(event) => setNuevoRangoEdad({ ...nuevoRangoEdad, nombre: event.target.value })} /></label>
        <label className="text-xs text-secondary">{t('modulos.labelEdadDesde')}<input required type="number" min="0" className="input-field mt-1" value={nuevoRangoEdad.edad_desde} onChange={(event) => setNuevoRangoEdad({ ...nuevoRangoEdad, edad_desde: event.target.value })} /></label>
        <label className="text-xs text-secondary flex items-center gap-1">{t('modulos.labelEdadHasta')}<InfoTip texto={t('modulos.infoEdadHasta')} /><input type="number" min="0" className="input-field mt-1 w-full" placeholder={t('modulos.placeholderSinTope')} value={nuevoRangoEdad.edad_hasta} onChange={(event) => setNuevoRangoEdad({ ...nuevoRangoEdad, edad_hasta: event.target.value })} /></label>
        <label className="text-xs text-secondary">{t('modulos.labelGenero')}<select className="input-field mt-1" value={nuevoRangoEdad.genero} onChange={(event) => setNuevoRangoEdad({ ...nuevoRangoEdad, genero: event.target.value })}><option value="">{t('modulos.opcionCualquiera')}</option><option value="masculino">{t('modulos.opcionMasculino')}</option><option value="femenino">{t('modulos.opcionFemenino')}</option></select></label>
        <label className="text-xs text-secondary">{t('modulos.labelEstadoCivil')}<select className="input-field mt-1" value={nuevoRangoEdad.estado_civil} onChange={(event) => setNuevoRangoEdad({ ...nuevoRangoEdad, estado_civil: event.target.value })}><option value="">{t('modulos.opcionCualquiera')}</option><option value="soltero">{t('modulos.opcionSoltero')}</option><option value="casado">{t('modulos.opcionCasado')}</option><option value="union_libre">{t('modulos.opcionUnionLibre')}</option><option value="divorciado">{t('modulos.opcionDivorciado')}</option><option value="viudo">{t('modulos.opcionViudo')}</option></select></label>
        <label className="text-xs text-secondary lg:col-span-2">{t('modulos.labelComite')}<select required className="input-field mt-1" value={nuevoRangoEdad.comite_id} onChange={(event) => setNuevoRangoEdad({ ...nuevoRangoEdad, comite_id: event.target.value })}><option value="">{t('modulos.placeholderSeleccionaComite')}</option>{comites.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <button disabled={saving || comites.length === 0} className="btn-primary justify-center lg:col-span-1"><Plus className="w-4 h-4" />{t('modulos.agregar')}</button>
      </form>
      <div className="flex flex-col gap-2">{rangosEdad.map((item) => <div key={item.id} className={`border border-border rounded-card p-3 flex items-start justify-between gap-3 ${item.activo === false ? 'opacity-50' : ''}`}>
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.nombre} <span className="text-xs text-muted font-normal">→ {item.comites?.nombre || t('modulos.comiteEliminado')}</span></p>
          <p className="text-xs text-secondary mt-1">{item.edad_hasta === null ? t('modulos.edadDesdeSinTope', { desde: item.edad_desde }) : t('modulos.edadRango', { desde: item.edad_desde, hasta: item.edad_hasta })}{item.genero ? ` · ${item.genero}` : ''}{item.estado_civil ? ` · ${item.estado_civil}` : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0"><button type="button" aria-label={t('modulos.ariaEditarNombre', { nombre: item.nombre })} title={t('modulos.editarGenerico')} onClick={() => editarRangoEdad(item)} className="text-muted hover:text-accent"><Edit3 className="w-3.5 h-3.5" /></button><button type="button" aria-label={t('modulos.ariaCambiarEstado')} title={item.activo === false ? t('modulos.reactivar') : t('modulos.desactivar')} onClick={() => toggleRangoEdad(item)} className={item.activo === false ? 'text-success' : 'text-muted hover:text-danger'}><Power className="w-3.5 h-3.5" /></button></div>
      </div>)}</div>
      {rangosEdad.length === 0 && <p className="text-sm text-muted text-center py-4">{t('modulos.sinRangos')}</p>}
    </section>
    {editingModuleId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveModuleName(modulos.find((module) => module.id === editingModuleId)) }} className="modal-panel"><h2 className="font-medium">{t('modulos.modalEditarModulo')}</h2><input autoFocus required className="input-field mt-4" value={editingName} onChange={(event) => setEditingName(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingModuleId(null)} className="btn-secondary"><X className="w-4 h-4" />{t('modulos.cancelar')}</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />{t('modulos.guardar')}</button></div></form></div>}
    {editingActivityId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveActivity(seleccionado.tipos_actividad.find((type) => type.id === editingActivityId)) }} className="modal-panel"><h2 className="font-medium">{t('modulos.modalEditarActividad')}</h2><input autoFocus required className="input-field mt-4" value={editingActivityName} onChange={(event) => setEditingActivityName(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingActivityId(null)} className="btn-secondary"><X className="w-4 h-4" />{t('modulos.cancelar')}</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />{t('modulos.guardar')}</button></div></form></div>}
    {editingCaracterCultoId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveCaracterCulto(caracteresCulto.find((item) => item.id === editingCaracterCultoId)) }} className="modal-panel"><h2 className="font-medium">{t('modulos.modalEditarCaracter')}</h2><input autoFocus required className="input-field mt-4" value={editingCaracterCultoName} onChange={(event) => setEditingCaracterCultoName(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingCaracterCultoId(null)} className="btn-secondary"><X className="w-4 h-4" />{t('modulos.cancelar')}</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />{t('modulos.guardar')}</button></div></form></div>}
    {editingUjierId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveUjier(ujieres.find((item) => item.id === editingUjierId)) }} className="modal-panel"><h2 className="font-medium">{t('modulos.modalEditarUjier')}</h2><input autoFocus required className="input-field mt-4" value={editingUjierName} onChange={(event) => setEditingUjierName(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingUjierId(null)} className="btn-secondary"><X className="w-4 h-4" />{t('modulos.cancelar')}</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />{t('modulos.guardar')}</button></div></form></div>}
    {editingLeccionRefamId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveLeccionRefam(refamLecciones.find((item) => item.id === editingLeccionRefamId)) }} className="modal-panel"><h2 className="font-medium">{t('modulos.modalEditarLeccionRefam')}</h2><input autoFocus required className="input-field mt-4" value={editingLeccionRefamTitulo} onChange={(event) => setEditingLeccionRefamTitulo(event.target.value)} /><textarea className="input-field mt-2 min-h-20" placeholder={t('modulos.placeholderDescripcionLeccion')} value={editingLeccionRefamDescripcion} onChange={(event) => setEditingLeccionRefamDescripcion(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingLeccionRefamId(null)} className="btn-secondary"><X className="w-4 h-4" />{t('modulos.cancelar')}</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />{t('modulos.guardar')}</button></div></form></div>}
    {editingLeccionEsfobId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveLeccionEsfob(esfobLecciones.find((item) => item.id === editingLeccionEsfobId)) }} className="modal-panel"><h2 className="font-medium">{t('modulos.modalEditarLeccionEsfob')}</h2><input autoFocus required className="input-field mt-4" value={editingLeccionEsfobTitulo} onChange={(event) => setEditingLeccionEsfobTitulo(event.target.value)} /><textarea className="input-field mt-2 min-h-20" placeholder={t('modulos.placeholderDescripcionLeccion')} value={editingLeccionEsfobDescripcion} onChange={(event) => setEditingLeccionEsfobDescripcion(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingLeccionEsfobId(null)} className="btn-secondary"><X className="w-4 h-4" />{t('modulos.cancelar')}</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />{t('modulos.guardar')}</button></div></form></div>}
    {editingLeccionDiscipuladoId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); saveLeccionDiscipulado(discipuladoLecciones.find((item) => item.id === editingLeccionDiscipuladoId)) }} className="modal-panel"><h2 className="font-medium">{t('modulos.modalEditarLeccionDiscipulado')}</h2><input autoFocus required className="input-field mt-4" value={editingLeccionDiscipuladoTitulo} onChange={(event) => setEditingLeccionDiscipuladoTitulo(event.target.value)} /><textarea className="input-field mt-2 min-h-20" placeholder={t('modulos.placeholderDescripcionLeccion')} value={editingLeccionDiscipuladoDescripcion} onChange={(event) => setEditingLeccionDiscipuladoDescripcion(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingLeccionDiscipuladoId(null)} className="btn-secondary"><X className="w-4 h-4" />{t('modulos.cancelar')}</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />{t('modulos.guardar')}</button></div></form></div>}
    {editingRangoEdadId && <div className="modal-backdrop"><form onSubmit={(event) => { event.preventDefault(); guardarRangoEdad(rangosEdad.find((item) => item.id === editingRangoEdadId)) }} className="modal-panel"><h2 className="font-medium">{t('modulos.modalEditarRango')}</h2>
      <label className="text-sm mt-4 block">{t('modulos.modalNombreLabel')}<input autoFocus required className="input-field mt-1.5" value={editingRangoEdad.nombre} onChange={(event) => setEditingRangoEdad({ ...editingRangoEdad, nombre: event.target.value })} /></label>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <label className="text-sm">{t('modulos.labelEdadDesde')}<input required type="number" min="0" className="input-field mt-1.5" value={editingRangoEdad.edad_desde} onChange={(event) => setEditingRangoEdad({ ...editingRangoEdad, edad_desde: event.target.value })} /></label>
        <label className="text-sm">{t('modulos.labelEdadHasta')}<input type="number" min="0" className="input-field mt-1.5" placeholder={t('modulos.placeholderSinTope')} value={editingRangoEdad.edad_hasta} onChange={(event) => setEditingRangoEdad({ ...editingRangoEdad, edad_hasta: event.target.value })} /></label>
        <label className="text-sm">{t('modulos.labelGenero')}<select className="input-field mt-1.5" value={editingRangoEdad.genero} onChange={(event) => setEditingRangoEdad({ ...editingRangoEdad, genero: event.target.value })}><option value="">{t('modulos.opcionCualquiera')}</option><option value="masculino">{t('modulos.opcionMasculino')}</option><option value="femenino">{t('modulos.opcionFemenino')}</option></select></label>
        <label className="text-sm">{t('modulos.labelEstadoCivil')}<select className="input-field mt-1.5" value={editingRangoEdad.estado_civil} onChange={(event) => setEditingRangoEdad({ ...editingRangoEdad, estado_civil: event.target.value })}><option value="">{t('modulos.opcionCualquiera')}</option><option value="soltero">{t('modulos.opcionSoltero')}</option><option value="casado">{t('modulos.opcionCasado')}</option><option value="union_libre">{t('modulos.opcionUnionLibre')}</option><option value="divorciado">{t('modulos.opcionDivorciado')}</option><option value="viudo">{t('modulos.opcionViudo')}</option></select></label>
      </div>
      <label className="text-sm mt-3 block">{t('modulos.labelComite')}<select required className="input-field mt-1.5" value={editingRangoEdad.comite_id} onChange={(event) => setEditingRangoEdad({ ...editingRangoEdad, comite_id: event.target.value })}>{comites.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
      <div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingRangoEdadId(null)} className="btn-secondary"><X className="w-4 h-4" />{t('modulos.cancelar')}</button><button disabled={saving} className="btn-primary"><Check className="w-4 h-4" />{t('modulos.guardar')}</button></div>
    </form></div>}
    <UndoToast pending={pendingUndo} onUndo={undo} />
  </div>
}