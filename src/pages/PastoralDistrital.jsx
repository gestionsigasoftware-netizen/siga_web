import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightLeft, Plus, Search, PencilLine, Users, Building2, UserRoundCheck, CircleDashed, MapPinned, GraduationCap, BookOpen, Trash2, LockKeyhole, ClipboardCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'
import Pager from '../components/Pager'

const TODAY = new Date().toISOString().slice(0, 10)
const CARGO_OPTIONS = ['Pastor local', 'Pastor asociado', 'Pastor auxiliar', 'Coordinador de congregación']
const LICENCIA_LABELS = { obrero: 'Obrero', local: 'Licencia Local', general: 'Licencia General', ordenacion: 'Ordenación Ministerial' }
const LICENCIA_SIGUIENTE = { obrero: 'local', local: 'general', general: 'ordenacion', ordenacion: null }
const TIPO_FORMACION_LABELS = { titulo: 'Título', curso: 'Curso', diplomado: 'Diplomado', especializacion: 'Especialización', maestria: 'Maestría', doctorado: 'Doctorado', seminario_biblico: 'Seminario bíblico', otro: 'Otro' }
const MADUREZ_LABELS = { mision_nacional: 'Misión Nacional', lugar_prediccion: 'Lugar de Predicación', iglesia_local: 'Iglesia Local (Constituida)' }
const EMPTY_FORM = {
  nombres: '',
  apellidos: '',
  telefono: '',
  email: '',
  familia_pastoral: '',
  congregacion_id: '',
  fecha_inicio: TODAY,
  cargo: 'Pastor local',
  observaciones: '',
  fecha_tarjeta_predicador: '',
  licencia: 'obrero',
}
const EMPTY_NEW_CONGREGATION = { nombre: '', ciudad: '', pastor_nombres: '', pastor_apellidos: '', pastor_telefono: '', pastor_email: '' }
const EMPTY_FORMACION = { pastor_id: '', tipo: 'diplomado', tipo_otro: '', nombre: '', institucion: '', fecha: '', observaciones: '' }
const EMPTY_CENTRO = { nombre: '', tipo: 'municipal', ciudad: '', direccion: '' }
const TIPO_CENTRO_LABELS = { maxima_seguridad: 'Máxima seguridad', mediana_seguridad: 'Mediana seguridad', municipal: 'Municipal', correccional_menores: 'Correccional de menores', otro: 'Otro' }
const CARGO_DISTRITAL_LABELS = { supervisor: 'Supervisor', secretario: 'Secretario', tesorero: 'Tesorero', presbitero_a: 'Presbítero A', presbitero_b: 'Presbítero B', veedor: 'Veedor', otro: 'Otro' }
const ESTADO_REINSERCION_LABELS = { asignado: 'Asignado', contactado: 'Contactado', activo: 'Activo', inactivo: 'Inactivo', reincidencia: 'Reincidencia' }

const formatDate = (value) => {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const getCurrentMonthTransfers = (assignments = []) => {
  const now = new Date()
  return assignments.filter((assignment) => {
    if (!assignment.fecha_inicio) return false
    const date = new Date(`${assignment.fecha_inicio}T12:00:00`)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }).length
}

// Idea profunda: checklist de continuidad pastoral. Ya existia
// transferir credenciales al finalizar una asignacion, pero no los
// pendientes reales de la congregacion que queda vacante — el riesgo de
// una transicion no es el acceso al sistema, es perder el hilo de a
// quien habia que visitar.
function ContinuidadPastoral({ vacantes }) {
  const [resumenes, setResumenes] = useState({})

  useEffect(() => {
    let active = true
    vacantes.forEach((congregacion) => {
      supabase.rpc('resumen_continuidad_congregacion', { p_congregacion_id: congregacion.id }).then(({ data }) => {
        if (!active || !data?.[0]) return
        setResumenes((current) => ({ ...current, [congregacion.id]: data[0] }))
      })
    })
    return () => { active = false }
  }, [vacantes])

  if (vacantes.length === 0) return null

  return (
    <section className="card overflow-hidden">
      <div className="p-5 border-b border-border">
        <h2 className="font-medium flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-accent" /> Continuidad pendiente</h2>
        <p className="text-sm text-secondary mt-1">Congregaciones sin pastor asignado ahora mismo — lo que el próximo pastor (o tú, mientras tanto) necesita saber que sigue abierto.</p>
      </div>
      <div className="divide-y divide-border">
        {vacantes.map((congregacion) => {
          const resumen = resumenes[congregacion.id]
          return (
            <div key={congregacion.id} className="p-4">
              <p className="text-sm font-medium">{congregacion.nombre}</p>
              {!resumen ? (
                <p className="text-xs text-muted mt-1">Cargando pendientes...</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${Number(resumen.seguimientos_pendientes) > 0 ? 'bg-warning-bg text-warning' : 'bg-surface-1 text-muted'}`}>{resumen.seguimientos_pendientes} seguimiento(s) pastoral(es) pendiente(s)</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${Number(resumen.casos_red_familias_activos) > 0 ? 'bg-warning-bg text-warning' : 'bg-surface-1 text-muted'}`}>{resumen.casos_red_familias_activos} caso(s) activo(s) de Red de Familias</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${Number(resumen.cargos_obligatorios_vacantes) > 0 ? 'bg-danger-bg text-danger' : 'bg-surface-1 text-muted'}`}>{resumen.cargos_obligatorios_vacantes} cargo(s) obligatorio(s) de comité sin cubrir</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function PastoralDistrital() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const distritoId = rolPrincipal?.distrito_id
  const isDistrictLeader = rolPrincipal?.nivel === 'distrital'

  const [pastors, setPastors] = useState([])
  const [congregations, setCongregations] = useState([])
  const [assignments, setAssignments] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [congregationFilter, setCongregationFilter] = useState('all')
  const [editingPastorId, setEditingPastorId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [transferForm, setTransferForm] = useState({
    pastor_id: '',
    congregacion_id: '',
    fecha: TODAY,
    observaciones: '',
  })
  const [finalizarForm, setFinalizarForm] = useState({ pastor_id: '', fecha: TODAY, observaciones: '' })
  const [finalizando, setFinalizando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  const [newCongregation, setNewCongregation] = useState(EMPTY_NEW_CONGREGATION)
  const [creatingCongregation, setCreatingCongregation] = useState(false)
  const [catalogoCongregaciones, setCatalogoCongregaciones] = useState([])
  const [catalogoSearchTerm, setCatalogoSearchTerm] = useState('')
  const [catalogoDropdownOpen, setCatalogoDropdownOpen] = useState(false)
  const [catalogoSeleccionadoId, setCatalogoSeleccionadoId] = useState(null)
  const catalogoFieldRef = useRef(null)
  const pastorFormRef = useRef(null)
  const transferFormRef = useRef(null)
  const [congregacionSearchTerm, setCongregacionSearchTerm] = useState('')
  const [congregacionDropdownOpen, setCongregacionDropdownOpen] = useState(false)
  const congregacionFieldRef = useRef(null)
  const licenciaOriginalRef = useRef('obrero')
  const [congregacionCorreccionCatalogoId, setCongregacionCorreccionCatalogoId] = useState(null)
  const [pastorProfileId, setPastorProfileId] = useState(null)
  const [resumenPorCongregacion, setResumenPorCongregacion] = useState(new Map())
  const [licenciaHistorial, setLicenciaHistorial] = useState([])
  const [licenciaForm, setLicenciaForm] = useState({ pastor_id: '', fecha: TODAY, observaciones: '' })
  const [ascendiendoLicencia, setAscendiendoLicencia] = useState(false)
  const [formaciones, setFormaciones] = useState([])
  const [formacionForm, setFormacionForm] = useState(EMPTY_FORMACION)
  const [resumenEscuelaDominical, setResumenEscuelaDominical] = useState([])
  const [resumenDamas, setResumenDamas] = useState([])
  const [savingFormacion, setSavingFormacion] = useState(false)
  const [centros, setCentros] = useState([])
  const [editingCentroId, setEditingCentroId] = useState(null)
  const [centroForm, setCentroForm] = useState(EMPTY_CENTRO)
  const [savingCentro, setSavingCentro] = useState(false)
  const [resumenCarcelaria, setResumenCarcelaria] = useState([])
  const [resumenReinsercion, setResumenReinsercion] = useState([])
  const [liberadosSinAsignar, setLiberadosSinAsignar] = useState([])
  const [reinsercionForm, setReinsercionForm] = useState({ interno_id: '', congregacion_destino: '' })
  const [savingReinsercion, setSavingReinsercion] = useState(false)
  const [resumenMusica, setResumenMusica] = useState([])
  const [resumenArtistica, setResumenArtistica] = useState([])
  const [resumenTeologica, setResumenTeologica] = useState([])
  const [resumenConquistadores, setResumenConquistadores] = useState([])
  const [resumenObraSocial, setResumenObraSocial] = useState([])
  const [resumenMisionJuvenil, setResumenMisionJuvenil] = useState([])
  const [resumenRedFamilias, setResumenRedFamilias] = useState([])
  const [personasDistrito, setPersonasDistrito] = useState([])
  const [cargosDistritales, setCargosDistritales] = useState([])
  const [cargoForm, setCargoForm] = useState({ persona_id: '', cargo: 'supervisor', fecha_inicio: new Date().toISOString().slice(0, 10) })
  const [savingCargo, setSavingCargo] = useState(false)
  const [tablePages, setTablePages] = useState({})

  const TABLE_PAGE_SIZE = 50
  function paginate(key, items) {
    const totalPages = Math.max(1, Math.ceil(items.length / TABLE_PAGE_SIZE))
    const page = Math.min(tablePages[key] || 0, totalPages - 1)
    const pageItems = items.slice(page * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE)
    const setPage = (updater) => setTablePages((prev) => ({ ...prev, [key]: typeof updater === 'function' ? updater(prev[key] || 0) : updater }))
    return { pageItems, page, totalPages, setPage }
  }

  const activeAssignments = useMemo(
    () => assignments.filter((assignment) => !assignment.fecha_fin),
    [assignments]
  )

  const activeByPastor = useMemo(
    () => new Map(activeAssignments.map((assignment) => [assignment.pastor_id, assignment])),
    [activeAssignments]
  )

  const stats = useMemo(() => {
    const activePastorIds = new Set(activeAssignments.map((assignment) => assignment.pastor_id))
    const activePastorCount = pastors.filter((pastor) => activePastorIds.has(pastor.id)).length
    const congregationsWithPastors = congregations.filter((congregation) => congregation.pastor_id).length
    const vacantCongregations = congregations.length - congregationsWithPastors

    return {
      totalPastors: pastors.length,
      activePastorCount,
      congregationsWithPastors,
      vacantCongregations,
      transfersThisMonth: getCurrentMonthTransfers(assignments),
    }
  }, [activeAssignments, pastors, congregations, assignments])

  const filteredPastors = useMemo(() => {
    return pastors.filter((pastor) => {
      const activeAssignment = activeByPastor.get(pastor.id)
      const congregation = congregations.find((item) => item.id === activeAssignment?.congregacion_id)
      const matchesSearch = !searchTerm || `${pastor.nombres} ${pastor.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase()) || (congregation?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && activeAssignment) || (statusFilter === 'vacant' && !activeAssignment)
      const matchesCongregation = congregationFilter === 'all' || activeAssignment?.congregacion_id === congregationFilter

      return matchesSearch && matchesStatus && matchesCongregation
    })
  }, [pastors, activeByPastor, congregations, searchTerm, statusFilter, congregationFilter])

  const filteredAssignments = useMemo(() => {
    return [...assignments].filter((assignment) => {
      const pastor = pastors.find((item) => item.id === assignment.pastor_id)
      const congregation = congregations.find((item) => item.id === assignment.congregacion_id)
      const matchesSearch = !searchTerm || `${pastor?.nombres || ''} ${pastor?.apellidos || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) || (congregation?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && !assignment.fecha_fin) || (statusFilter === 'vacant' && assignment.fecha_fin)
      const matchesCongregation = congregationFilter === 'all' || assignment.congregacion_id === congregationFilter
      return matchesSearch && matchesStatus && matchesCongregation
    })
  }, [assignments, pastors, congregations, searchTerm, statusFilter, congregationFilter])

  async function load() {
    if (!distritoId || !isDistrictLeader) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [pastorResult, congregationResult, assignmentResult, profileResult, resumenResult, licenciaResult, formacionResult, escuelaDominicalResult, damasResult, centrosResult, carcelariaResult, reinsercionResult, liberadosResult, musicaResult, artisticaResult, teologicaResult, conquistadoresResult, obraSocialResult, misionJuvenilResult, redFamiliasResult, personasResult, cargosResult] = await Promise.all([
      supabase
        .from('pastores')
        .select('id, nombres, apellidos, telefono, familia_pastoral, observaciones, distrito_id, persona_id, licencia, fecha_tarjeta_predicador')
        .eq('distrito_id', distritoId)
        .order('apellidos')
        .order('nombres'),
      supabase
        .from('congregaciones')
        .select('id, nombre, ciudad, pastor_id, pastor_nombre, estado, madurez')
        .eq('distrito_id', distritoId)
        .order('nombre'),
      supabase
        .from('asignaciones_pastorales')
        .select('id, pastor_id, congregacion_id, cargo, fecha_inicio, fecha_fin, observaciones')
        .eq('distrito_id', distritoId)
        .order('fecha_inicio', { ascending: false }),
      supabase.from('perfiles_acceso').select('id').eq('codigo', 'pastor').maybeSingle(),
      supabase.rpc('resumen_distrital', { p_distrito_id: distritoId }),
      supabase
        .from('historial_licencias_pastorales')
        .select('id, pastor_id, licencia_anterior, licencia_nueva, fecha, observaciones, tipo')
        .order('fecha', { ascending: false }),
      supabase
        .from('formacion_pastoral')
        .select('id, pastor_id, tipo, tipo_otro, nombre, institucion, fecha, observaciones')
        .order('fecha', { ascending: false }),
      supabase.rpc('resumen_escuela_dominical_distrital', { p_distrito_id: distritoId }),
      supabase.rpc('resumen_damas_distrital', { p_distrito_id: distritoId }),
      supabase.from('centros_reclusion').select('id, nombre, tipo, ciudad, direccion, activo').eq('distrito_id', distritoId).order('nombre'),
      supabase.rpc('resumen_carcelaria_distrital', { p_distrito_id: distritoId }),
      supabase.rpc('resumen_reinsercion_distrital', { p_distrito_id: distritoId }),
      supabase.rpc('internos_liberados_sin_asignar', { p_distrito_id: distritoId }),
      supabase.rpc('resumen_musica_distrital', { p_distrito_id: distritoId }),
      supabase.rpc('resumen_artistica_distrital', { p_distrito_id: distritoId }),
      supabase.rpc('resumen_teologica_distrital', { p_distrito_id: distritoId }),
      supabase.rpc('resumen_conquistadores_distrital', { p_distrito_id: distritoId }),
      supabase.rpc('resumen_obra_social_distrital', { p_distrito_id: distritoId }),
      supabase.rpc('resumen_mision_juvenil_distrital', { p_distrito_id: distritoId }),
      supabase.rpc('resumen_red_familias_distrital', { p_distrito_id: distritoId }),
      supabase.from('personas').select('id, nombres, apellidos, congregaciones!inner(distrito_id)').eq('congregaciones.distrito_id', distritoId).eq('estado_membresia', 'activo').order('nombres'),
      supabase.from('cargos_distritales').select('id, persona_id, nombres, apellidos, cargo, fecha_inicio, fecha_fin, observaciones').eq('distrito_id', distritoId).order('fecha_inicio', { ascending: false }),
    ])

    if (pastorResult.error || congregationResult.error || assignmentResult.error) {
      setError('No se pudo cargar la gestión pastoral distrital. Intenta nuevamente o contacta al administrador.')
    }

    setPastors(pastorResult.data ?? [])
    setCongregations(congregationResult.data ?? [])
    setAssignments(assignmentResult.data ?? [])
    setPastorProfileId(profileResult.data?.id ?? null)
    setResumenPorCongregacion(new Map((resumenResult.data ?? []).map((row) => [row.congregacion_id, row])))
    setLicenciaHistorial(licenciaResult.data ?? [])
    setFormaciones(formacionResult.data ?? [])
    setResumenEscuelaDominical(escuelaDominicalResult.data ?? [])
    setResumenDamas(damasResult.data ?? [])
    setCentros(centrosResult.data ?? [])
    setResumenCarcelaria(carcelariaResult.data ?? [])
    setResumenReinsercion(reinsercionResult.data ?? [])
    setLiberadosSinAsignar(liberadosResult.data ?? [])
    setResumenMusica(musicaResult.data ?? [])
    setResumenArtistica(artisticaResult.data ?? [])
    setResumenTeologica(teologicaResult.data ?? [])
    setResumenConquistadores(conquistadoresResult.data ?? [])
    setResumenObraSocial(obraSocialResult.data ?? [])
    setResumenMisionJuvenil(misionJuvenilResult.data ?? [])
    setResumenRedFamilias(redFamiliasResult.data ?? [])
    setPersonasDistrito(personasResult.data ?? [])
    setCargosDistritales(cargosResult.data ?? [])
    setLoading(false)
  }

  async function saveCargo(event) {
    event.preventDefault()
    if (!distritoId || !cargoForm.persona_id) return
    setSavingCargo(true)
    setError(null)
    const persona = personasDistrito.find((item) => item.id === cargoForm.persona_id)
    const result = await supabase.from('cargos_distritales').insert({
      distrito_id: distritoId,
      persona_id: cargoForm.persona_id,
      nombres: persona?.nombres || '',
      apellidos: persona?.apellidos || '',
      cargo: cargoForm.cargo,
      fecha_inicio: cargoForm.fecha_inicio,
    })
    setSavingCargo(false)
    if (result.error) {
      setError(result.error.code === '23505' ? 'Ya hay una persona vigente en ese cargo. Termina su periodo antes de asignar uno nuevo.' : 'No se pudo asignar el cargo.')
      return
    }
    setCargoForm({ persona_id: '', cargo: 'supervisor', fecha_inicio: new Date().toISOString().slice(0, 10) })
    load()
  }

  async function terminarCargo(item) {
    setSavingCargo(true)
    setError(null)
    const result = await supabase.from('cargos_distritales').update({ fecha_fin: new Date().toISOString().slice(0, 10) }).eq('id', item.id)
    setSavingCargo(false)
    if (result.error) { setError('No se pudo terminar el cargo.'); return }
    load()
  }

  function resetCentroForm() { setEditingCentroId(null); setCentroForm(EMPTY_CENTRO) }
  function editCentro(centro) {
    setEditingCentroId(centro.id)
    setCentroForm({ nombre: centro.nombre, tipo: centro.tipo, ciudad: centro.ciudad || '', direccion: centro.direccion || '' })
  }

  async function saveCentro(event) {
    event.preventDefault()
    if (!distritoId || !centroForm.nombre.trim()) { setError('El nombre del centro es obligatorio.'); return }
    setSavingCentro(true)
    setError(null)
    setNotice(null)
    const payload = { nombre: centroForm.nombre.trim(), tipo: centroForm.tipo, ciudad: centroForm.ciudad.trim() || null, direccion: centroForm.direccion.trim() || null }
    const result = editingCentroId
      ? await supabase.from('centros_reclusion').update(payload).eq('id', editingCentroId)
      : await supabase.from('centros_reclusion').insert({ ...payload, distrito_id: distritoId })
    setSavingCentro(false)
    if (result.error) { setError(`No se pudo guardar el centro de reclusión: ${result.error.message}`); return }
    setNotice(editingCentroId ? 'Centro de reclusión actualizado.' : 'Centro de reclusión creado.')
    resetCentroForm()
    await load()
  }

  async function asignarReinsercion(event) {
    event.preventDefault()
    if (!reinsercionForm.interno_id || !reinsercionForm.congregacion_destino) { setError('Selecciona el interno liberado y la congregación destino.'); return }
    setSavingReinsercion(true)
    setError(null)
    setNotice(null)
    const { error: asignarError } = await supabase.rpc('asignar_reinsercion', {
      p_interno_id: reinsercionForm.interno_id,
      p_congregacion_destino: reinsercionForm.congregacion_destino,
    })
    setSavingReinsercion(false)
    if (asignarError) { setError(`No se pudo asignar la reinserción: ${asignarError.message}`); return }
    setNotice('Reinserción asignada correctamente. La congregación destino podrá reportar el seguimiento.')
    setReinsercionForm({ interno_id: '', congregacion_destino: '' })
    await load()
  }

  async function createCongregation(event) {
    event.preventDefault()
    if (!distritoId) return
    if (!newCongregation.nombre.trim() || !newCongregation.pastor_nombres.trim() || !newCongregation.pastor_apellidos.trim() || !newCongregation.pastor_email.trim()) {
      setError('Completa el nombre de la congregación, el nombre del pastor y su correo.')
      return
    }
    setCreatingCongregation(true)
    setError(null)
    setNotice(null)
    try {
      const { data: created, error: createError } = await supabase.rpc('crear_congregacion_con_pastor', {
        p_distrito_id: distritoId,
        p_nombre_congregacion: newCongregation.nombre.trim(),
        p_pastor_nombres: newCongregation.pastor_nombres.trim(),
        p_pastor_apellidos: newCongregation.pastor_apellidos.trim(),
        p_pastor_telefono: newCongregation.pastor_telefono.trim() || null,
        p_ciudad: newCongregation.ciudad.trim() || null,
        p_catalogo_id: catalogoSeleccionadoId || null,
      })
      if (createError) throw new Error(`No se pudo crear la congregación: ${createError.message}`)
      const [{ congregacion_id: newCongregationId, persona_id: newPersonId }] = created

      const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invitar-usuario', {
        body: { personId: newPersonId, profileId: pastorProfileId, congregacionId: newCongregationId, email: newCongregation.pastor_email.trim() },
      })
      if (inviteError) {
        setNotice('La congregación y el pastor quedaron registrados, pero la invitación de acceso no se pudo enviar. Puedes reintentarla luego desde Equipo de trabajo una vez la congregación esté activa.')
      } else if (!inviteData?.ok) {
        setNotice('La congregación y el pastor quedaron registrados, pero la invitación no se confirmó. Revísala desde Equipo de trabajo.')
      } else {
        setNotice(inviteData.invitationSent ? 'Congregación creada. Se envió la invitación de acceso al pastor.' : 'Congregación creada. La cuenta existente del pastor quedó vinculada.')
      }
      setNewCongregation(EMPTY_NEW_CONGREGATION)
      setCatalogoSearchTerm('')
      setCatalogoSeleccionadoId(null)
      await Promise.all([load(), loadCatalogoCongregaciones()])
    } catch (err) {
      setError(err.message)
    } finally {
      setCreatingCongregation(false)
    }
  }

  async function loadCatalogoCongregaciones() {
    const distritoNumero = rolPrincipal?.distritos?.numero
    if (!distritoNumero) { setCatalogoCongregaciones([]); return }
    const { data } = await supabase
      .from('catalogo_congregaciones_ipuc')
      .select('id, nombre, ciudad, congregacion_id')
      .eq('distrito_numero', distritoNumero)
      .order('nombre')
    setCatalogoCongregaciones(data ?? [])
  }

  useEffect(() => {
    load()
  }, [distritoId, isDistrictLeader])

  useEffect(() => {
    loadCatalogoCongregaciones()
  }, [rolPrincipal?.distritos?.numero])

  useEffect(() => {
    function handleClickOutside(event) {
      if (catalogoFieldRef.current && !catalogoFieldRef.current.contains(event.target)) setCatalogoDropdownOpen(false)
      if (congregacionFieldRef.current && !congregacionFieldRef.current.contains(event.target)) setCongregacionDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const catalogoPendientes = useMemo(
    () => catalogoCongregaciones.filter((item) => !item.congregacion_id),
    [catalogoCongregaciones]
  )
  const catalogoSugerencias = useMemo(
    () => catalogoPendientes.filter((item) => item.nombre.toLowerCase().includes(catalogoSearchTerm.toLowerCase())),
    [catalogoPendientes, catalogoSearchTerm]
  )

  const congregacionesParaAsignar = useMemo(
    () => congregations
      .filter((congregation) => !congregation.pastor_id || congregation.id === form.congregacion_id)
      .filter((congregation) => congregation.nombre.toLowerCase().includes(congregacionSearchTerm.toLowerCase())),
    [congregations, form.congregacion_id, congregacionSearchTerm]
  )

  // En "Editar pastor" el buscador combina las congregaciones reales de
  // SIGAP (para trasladar a una que ya existe) con las de la lista
  // oficial de Debora que todavia no estan registradas (para corregir el
  // nombre de la congregacion actual, sin crear una nueva ni trasladar) --
  // asi el campo siempre fuerza a elegir de una lista oficial, nunca
  // texto libre.
  const opcionesCongregacionEditar = useMemo(() => {
    if (!editingPastorId) return []
    const reales = congregations
      .filter((congregation) => !congregation.pastor_id || congregation.id === form.congregacion_id)
      .map((congregation) => ({ tipo: 'real', id: congregation.id, nombre: congregation.nombre }))
    const oficialesPendientes = catalogoPendientes.map((item) => ({ tipo: 'oficial', id: item.id, nombre: item.nombre }))
    return [...reales, ...oficialesPendientes].filter((item) => item.nombre.toLowerCase().includes(congregacionSearchTerm.toLowerCase()))
  }, [editingPastorId, congregations, form.congregacion_id, catalogoPendientes, congregacionSearchTerm])

  const resetForm = () => {
    setEditingPastorId(null)
    setForm(EMPTY_FORM)
    setCongregacionSearchTerm('')
    setCongregacionCorreccionCatalogoId(null)
  }

  const openPastorEditor = (pastor) => {
    const activeAssignment = activeByPastor.get(pastor.id)
    const congregacionActual = congregations.find((congregation) => congregation.id === activeAssignment?.congregacion_id)
    setEditingPastorId(pastor.id)
    setForm({
      nombres: pastor.nombres || '',
      apellidos: pastor.apellidos || '',
      telefono: pastor.telefono || '',
      familia_pastoral: pastor.familia_pastoral || '',
      congregacion_id: activeAssignment?.congregacion_id || '',
      fecha_inicio: activeAssignment?.fecha_inicio || TODAY,
      cargo: activeAssignment?.cargo || 'Pastor local',
      observaciones: activeAssignment?.observaciones || pastor.observaciones || '',
      fecha_tarjeta_predicador: pastor.fecha_tarjeta_predicador || '',
      licencia: pastor.licencia || 'obrero',
    })
    licenciaOriginalRef.current = pastor.licencia || 'obrero'
    setCongregacionSearchTerm(congregacionActual?.nombre || '')
    setCongregacionCorreccionCatalogoId(null)
    pastorFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function savePastor(event) {
    event.preventDefault()

    if (!distritoId) {
      setError('No se pudo determinar el distrito del usuario activo.')
      return
    }

    if (!form.nombres.trim() || !form.apellidos.trim() || !form.congregacion_id) {
      setError('Completa nombres, apellidos y congregación.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      if (editingPastorId) {
        const { error: pastorError } = await supabase
          .from('pastores')
          .update({
            nombres: form.nombres.trim(),
            apellidos: form.apellidos.trim(),
            telefono: form.telefono.trim() || null,
            familia_pastoral: form.familia_pastoral.trim() || null,
            observaciones: form.observaciones.trim() || null,
            fecha_tarjeta_predicador: form.fecha_tarjeta_predicador || null,
          })
          .eq('id', editingPastorId)

        if (pastorError) {
          throw new Error(`No se pudo actualizar al pastor: ${pastorError.message}`)
        }

        if (form.licencia !== licenciaOriginalRef.current) {
          const { error: licenciaError } = await supabase.rpc('corregir_licencia_pastor', {
            p_pastor_id: editingPastorId,
            p_licencia: form.licencia,
          })
          if (licenciaError) {
            throw new Error(`El pastor se actualizó, pero la licencia no se pudo corregir: ${licenciaError.message}`)
          }
        }

        if (congregacionCorreccionCatalogoId) {
          const { error: nombreError } = await supabase.rpc('corregir_nombre_congregacion', {
            p_congregacion_id: form.congregacion_id,
            p_catalogo_id: congregacionCorreccionCatalogoId,
          })
          if (nombreError) {
            throw new Error(`El pastor se actualizó, pero el nombre de la congregación no se pudo corregir: ${nombreError.message}`)
          }
        }

        const { error: assignmentError } = await supabase
          .from('asignaciones_pastorales')
          .update({
            cargo: form.cargo,
            observaciones: form.observaciones.trim() || null,
          })
          .eq('pastor_id', editingPastorId)
          .is('fecha_fin', null)

        if (assignmentError) {
          throw new Error(`El pastor se actualizó, pero la asignación vigente no pudo guardarse: ${assignmentError.message}`)
        }

        const nombreCompleto = `${form.nombres.trim()} ${form.apellidos.trim()}`
        const currentAssignment = activeByPastor.get(editingPastorId)
        if (currentAssignment?.congregacion_id && currentAssignment.congregacion_id !== form.congregacion_id) {
          const { error: transferError } = await supabase.rpc('trasladar_pastor', {
            p_pastor_id: editingPastorId,
            p_congregacion_destino: form.congregacion_id,
            p_fecha: form.fecha_inicio || TODAY,
            p_observaciones: form.observaciones.trim() || null,
          })

          if (transferError) {
            throw new Error(`No se pudo mover la asignación del pastor: ${transferError.message}`)
          }
        }

        await supabase
          .from('congregaciones')
          .update({ pastor_id: editingPastorId, pastor_nombre: nombreCompleto })
          .eq('id', form.congregacion_id)

        setNotice('Pastor actualizado correctamente.')
      } else {
        if (!form.email.trim()) {
          throw new Error('El correo del pastor es obligatorio para darle acceso al sistema.')
        }

        const { data: created, error: registerError } = await supabase.rpc('registrar_pastor_con_acceso', {
          p_congregacion_id: form.congregacion_id,
          p_pastor_nombres: form.nombres.trim(),
          p_pastor_apellidos: form.apellidos.trim(),
          p_pastor_telefono: form.telefono.trim() || null,
          p_cargo: form.cargo,
        })
        if (registerError) throw new Error(`No se pudo registrar el pastor: ${registerError.message}`)
        const [{ persona_id: newPersonId }] = created

        const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invitar-usuario', {
          body: { personId: newPersonId, profileId: pastorProfileId, congregacionId: form.congregacion_id, email: form.email.trim() },
        })
        if (inviteError) {
          setNotice('El pastor quedó registrado y asignado, pero la invitación de acceso no se pudo enviar. Puedes reintentarla desde Equipo de trabajo.')
        } else if (!inviteData?.ok) {
          setNotice('El pastor quedó registrado y asignado, pero la invitación no se confirmó. Revísala desde Equipo de trabajo.')
        } else {
          setNotice(inviteData.invitationSent ? 'Pastor registrado, asignado y con invitación de acceso enviada.' : 'Pastor registrado y asignado. La cuenta existente quedó vinculada.')
        }
      }

      resetForm()
      await Promise.all([load(), loadCatalogoCongregaciones()])
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTransfer(event) {
    event.preventDefault()

    if (!transferForm.pastor_id || !transferForm.congregacion_id) {
      setError('Selecciona el pastor y la congregación de destino.')
      return
    }

    if (transferForm.congregacion_id === activeByPastor.get(transferForm.pastor_id)?.congregacion_id) {
      setError('El pastor ya está asignado a la congregación elegida.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const { error: transferError } = await supabase.rpc('trasladar_pastor', {
        p_pastor_id: transferForm.pastor_id,
        p_congregacion_destino: transferForm.congregacion_id,
        p_fecha: transferForm.fecha || TODAY,
        p_observaciones: transferForm.observaciones.trim() || null,
      })

      if (transferError) {
        throw new Error(transferError.message)
      }

      setTransferForm({
        pastor_id: '',
        congregacion_id: '',
        fecha: TODAY,
        observaciones: '',
      })
      setNotice('Traslado registrado correctamente.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleFinalizarAsignacion(event) {
    event.preventDefault()

    if (!finalizarForm.pastor_id) {
      setError('Selecciona el pastor cuya asignación quieres finalizar.')
      return
    }

    setFinalizando(true)
    setError(null)
    setNotice(null)

    try {
      const { error: finalizarError } = await supabase.rpc('finalizar_asignacion_pastoral', {
        p_pastor_id: finalizarForm.pastor_id,
        p_fecha: finalizarForm.fecha || TODAY,
        p_observaciones: finalizarForm.observaciones.trim() || null,
      })

      if (finalizarError) throw new Error(finalizarError.message)

      setFinalizarForm({ pastor_id: '', fecha: TODAY, observaciones: '' })
      setNotice('Asignación finalizada. La congregación quedó vacante para asignar un nuevo pastor.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setFinalizando(false)
    }
  }

  async function ascenderLicencia(event) {
    event.preventDefault()

    if (!licenciaForm.pastor_id) {
      setError('Selecciona el pastor a ascender.')
      return
    }

    setAscendiendoLicencia(true)
    setError(null)
    setNotice(null)

    try {
      const { data: nuevaLicencia, error: licenciaError } = await supabase.rpc('ascender_licencia_pastor', {
        p_pastor_id: licenciaForm.pastor_id,
        p_fecha: licenciaForm.fecha || TODAY,
        p_observaciones: licenciaForm.observaciones.trim() || null,
      })

      if (licenciaError) throw new Error(licenciaError.message)

      setLicenciaForm({ pastor_id: '', fecha: TODAY, observaciones: '' })
      setNotice(`Ascenso registrado: ahora tiene ${LICENCIA_LABELS[nuevaLicencia] || nuevaLicencia}.`)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAscendiendoLicencia(false)
    }
  }

  async function addFormacion(event) {
    event.preventDefault()

    if (!formacionForm.pastor_id || !formacionForm.nombre.trim()) {
      setError('Selecciona el pastor y el nombre de la preparación.')
      return
    }
    if (formacionForm.tipo === 'otro' && !formacionForm.tipo_otro.trim()) {
      setError('Especifica el tipo de preparación en "Otro".')
      return
    }

    setSavingFormacion(true)
    setError(null)
    setNotice(null)

    try {
      const { error: formacionError } = await supabase.from('formacion_pastoral').insert({
        pastor_id: formacionForm.pastor_id,
        tipo: formacionForm.tipo,
        tipo_otro: formacionForm.tipo === 'otro' ? formacionForm.tipo_otro.trim() : null,
        nombre: formacionForm.nombre.trim(),
        institucion: formacionForm.institucion.trim() || null,
        fecha: formacionForm.fecha || null,
        observaciones: formacionForm.observaciones.trim() || null,
      })

      if (formacionError) throw new Error(formacionError.message)

      setFormacionForm(EMPTY_FORMACION)
      setNotice('Preparación registrada correctamente.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingFormacion(false)
    }
  }

  async function updateMadurez(congregacionId, madurez) {
    setError(null)
    setNotice(null)
    const { error: updateError } = await supabase.from('congregaciones').update({ madurez }).eq('id', congregacionId)
    if (updateError) {
      setError('No se pudo actualizar la madurez de la sede.')
      return
    }
    setNotice('Madurez de la sede actualizada.')
    await load()
  }

  async function deleteFormacion(id) {
    setError(null)
    setNotice(null)
    const { error: deleteError } = await supabase.from('formacion_pastoral').delete().eq('id', id)
    if (deleteError) {
      setError('No se pudo eliminar el registro de preparación.')
      return
    }
    setNotice('Registro de preparación eliminado.')
    await load()
  }

  if (roleLoading || loading) {
    return <div className="module-loading" role="status"><span className="loading-dot" />Cargando gestión pastoral distrital...</div>
  }

  if (!isDistrictLeader) {
    return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Este módulo es exclusivo del líder distrital.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Administración distrital</p>
        <h1 className="text-2xl font-semibold">Gestión pastoral</h1>
        <p className="text-sm text-secondary mt-1">Controla pastores, asignaciones, traslados y trayectoria dentro del distrito.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>Total</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{stats.totalPastors}</p>
          <p className="text-sm text-secondary mt-1">Pastores registrados</p>
        </div>

        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>Activos</span>
            <UserRoundCheck className="w-4 h-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{stats.activePastorCount}</p>
          <p className="text-sm text-secondary mt-1">Asignaciones vigentes</p>
        </div>

        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>Congregaciones</span>
            <Building2 className="w-4 h-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{stats.congregationsWithPastors}</p>
          <p className="text-sm text-secondary mt-1">Con pastor asignado</p>
        </div>

        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>Vacantes</span>
            <CircleDashed className="w-4 h-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{stats.vacantCongregations}</p>
          <p className="text-sm text-secondary mt-1">Sin pastor actual</p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">Congregaciones del distrito</h2>
          <p className="text-sm text-secondary mt-1">Clasificación de madurez de la sede (Misión Nacional / Lugar de Predicación / Iglesia Local).</p>
        </div>
        {congregations.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aún no hay congregaciones registradas en tu distrito.</p>
        ) : (() => {
          const paged = paginate('congregations', congregations)
          return <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="font-normal px-5 py-3">Congregación</th>
                  <th className="font-normal px-5 py-3">Ciudad</th>
                  <th className="font-normal px-5 py-3">Madurez de la sede</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageItems.map((congregation) => (
                  <tr key={congregation.id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{congregation.nombre}</td>
                    <td className="px-5 py-3 text-secondary">{congregation.ciudad || '—'}</td>
                    <td className="px-5 py-3">
                      <select className="input-field" value={congregation.madurez || 'lugar_prediccion'} onChange={(event) => updateMadurez(congregation.id, event.target.value)}>
                        {Object.entries(MADUREZ_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={congregations.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
          </>
        })()}
      </section>

      <ContinuidadPastoral vacantes={congregations.filter((congregacion) => !congregacion.pastor_id)} />

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">Directiva distrital</h2>
          <p className="text-sm text-secondary mt-1">Censo de quién ejerce cada cargo de la junta distrital (Supervisor, Secretario, Tesorero, Presbíteros, Veedor), separado del acceso al software.</p>
        </div>
        {cargosDistritales.filter((item) => !item.fecha_fin).length === 0 ? (
          <p className="p-5 text-sm text-muted">Aún no hay cargos asignados en tu distrito.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="font-normal px-5 py-3">Cargo</th>
                  <th className="font-normal px-5 py-3">Persona</th>
                  <th className="font-normal px-5 py-3">Desde</th>
                  <th className="font-normal px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargosDistritales.filter((item) => !item.fecha_fin).map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{CARGO_DISTRITAL_LABELS[item.cargo] || item.cargo}</td>
                    <td className="px-5 py-3">{item.nombres} {item.apellidos}</td>
                    <td className="px-5 py-3 text-secondary">{item.fecha_inicio}</td>
                    <td className="px-5 py-3 text-right"><button type="button" disabled={savingCargo} className="text-danger text-xs" onClick={() => terminarCargo(item)}>Terminar periodo</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form onSubmit={saveCargo} className="p-5 border-t border-border grid sm:grid-cols-4 gap-2 items-end">
          <div className="sm:col-span-4">
            <p className="text-sm font-medium">Asignar cargo</p>
            <p className="text-xs text-secondary mt-1">La persona debe estar en el censo activo de alguna congregación de tu distrito.</p>
          </div>
          <select required className="input-field" value={cargoForm.persona_id} onChange={(event) => setCargoForm({ ...cargoForm, persona_id: event.target.value })}>
            <option value="">Persona...</option>
            {personasDistrito.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
          <select className="input-field" value={cargoForm.cargo} onChange={(event) => setCargoForm({ ...cargoForm, cargo: event.target.value })}>
            {Object.entries(CARGO_DISTRITAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input required type="date" className="input-field" value={cargoForm.fecha_inicio} onChange={(event) => setCargoForm({ ...cargoForm, fecha_inicio: event.target.value })} />
          <button disabled={savingCargo} className="btn-secondary justify-center"><Plus className="w-4 h-4" />{savingCargo ? 'Guardando...' : 'Asignar cargo'}</button>
        </form>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium">Escuela Dominical por congregación</h2>
            <p className="text-sm text-secondary mt-1">Comités administrados localmente, consolidado a nivel distrital.</p>
          </div>
          {resumenEscuelaDominical.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay datos de Escuela Dominical en tu distrito.</p>
          ) : (() => {
            const paged = paginate('escuelaDominical', resumenEscuelaDominical)
            return <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Clases</th><th className="font-normal px-4 py-2.5">Niños</th><th className="font-normal px-4 py-2.5">Maestros</th><th className="font-normal px-4 py-2.5">Lecciones (30d)</th></tr></thead>
                <tbody>
                  {paged.pageItems.map((item) => (
                    <tr key={item.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                      <td className="px-4 py-2.5">{item.clases_activas}</td>
                      <td className="px-4 py-2.5">{item.ninos_activos}</td>
                      <td className="px-4 py-2.5">{item.maestros_activos}</td>
                      <td className="px-4 py-2.5">{item.lecciones_ultimo_mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenEscuelaDominical.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
            </>
          })()}
        </section>

        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium">Damas Dorcas por congregación</h2>
            <p className="text-sm text-secondary mt-1">Comités administrados localmente, consolidado a nivel distrital.</p>
          </div>
          {resumenDamas.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay datos de Damas Dorcas en tu distrito.</p>
          ) : (() => {
            const paged = paginate('damasDorcas', resumenDamas)
            return <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Beneficiarias</th><th className="font-normal px-4 py-2.5">Actividades (30d)</th></tr></thead>
                <tbody>
                  {paged.pageItems.map((item) => (
                    <tr key={item.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                      <td className="px-4 py-2.5">{item.beneficiarias_activas}</td>
                      <td className="px-4 py-2.5">{item.actividades_ultimo_mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenDamas.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
            </>
          })()}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium flex items-center gap-2"><LockKeyhole className="w-4 h-4 text-accent" />Centros de reclusión</h2>
            <p className="text-sm text-secondary mt-1">Catálogo de cárceles y centros de reclusión de tu distrito. Las congregaciones locales eligen de esta lista al registrar cultos e internos.</p>
          </div>
          {centros.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay centros de reclusión registrados en tu distrito.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Nombre</th><th className="font-normal px-4 py-2.5">Tipo</th><th className="font-normal px-4 py-2.5">Ciudad</th><th className="font-normal px-4 py-2.5 text-right">Acciones</th></tr></thead>
                <tbody>
                  {centros.map((centro) => (
                    <tr key={centro.id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{centro.nombre}</td>
                      <td className="px-4 py-2.5 text-secondary">{TIPO_CENTRO_LABELS[centro.tipo]}</td>
                      <td className="px-4 py-2.5 text-secondary">{centro.ciudad || '—'}</td>
                      <td className="px-4 py-2.5 text-right"><button type="button" className="text-accent text-xs" onClick={() => editCentro(centro)}>Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form onSubmit={saveCentro} className="p-5 border-t border-border grid sm:grid-cols-2 gap-2">
            <div className="sm:col-span-2 flex items-center justify-between">
              <p className="text-sm font-medium">{editingCentroId ? 'Editar centro' : 'Nuevo centro de reclusión'}</p>
              {editingCentroId && <button type="button" className="text-xs text-secondary" onClick={resetCentroForm}>Cancelar</button>}
            </div>
            <input required className="input-field" placeholder="Nombre del centro" value={centroForm.nombre} onChange={(event) => setCentroForm({ ...centroForm, nombre: event.target.value })} />
            <select className="input-field" value={centroForm.tipo} onChange={(event) => setCentroForm({ ...centroForm, tipo: event.target.value })}>
              {Object.entries(TIPO_CENTRO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input className="input-field" placeholder="Ciudad" value={centroForm.ciudad} onChange={(event) => setCentroForm({ ...centroForm, ciudad: event.target.value })} />
            <input className="input-field" placeholder="Dirección" value={centroForm.direccion} onChange={(event) => setCentroForm({ ...centroForm, direccion: event.target.value })} />
            <button disabled={savingCentro} className="btn-primary justify-center sm:col-span-2"><Plus className="w-4 h-4" /> {editingCentroId ? 'Guardar cambios' : 'Crear centro'}</button>
          </form>
        </section>

        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium">Obra Carcelaria por congregación</h2>
            <p className="text-sm text-secondary mt-1">Asistencia interna en los centros de reclusión, consolidado a nivel distrital.</p>
          </div>
          {resumenCarcelaria.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay datos de Obra Carcelaria en tu distrito.</p>
          ) : (() => {
            const paged = paginate('carcelaria', resumenCarcelaria)
            return <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Internos activos</th><th className="font-normal px-4 py-2.5">Bautizados</th><th className="font-normal px-4 py-2.5">Sellados</th><th className="font-normal px-4 py-2.5">Delegados hábiles</th><th className="font-normal px-4 py-2.5">Cultos (30d)</th></tr></thead>
                <tbody>
                  {paged.pageItems.map((item) => (
                    <tr key={item.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                      <td className="px-4 py-2.5">{item.internos_activos}</td>
                      <td className="px-4 py-2.5">{item.bautizados}</td>
                      <td className="px-4 py-2.5">{item.sellados}</td>
                      <td className="px-4 py-2.5">{item.delegados_habilitados}</td>
                      <td className="px-4 py-2.5">{item.cultos_ultimo_mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenCarcelaria.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
            </>
          })()}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">Reinserción post-penitenciaria</h2>
          <p className="text-sm text-secondary mt-1">Al liberarse, un interno se asigna a una congregación cercana a su residencia para discipulado y evitar la reincidencia. La congregación destino reporta después si el liberado se integró.</p>
        </div>
        {resumenReinsercion.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aún no hay casos de reinserción en tu distrito.</p>
        ) : (() => {
          const paged = paginate('reinsercion', resumenReinsercion)
          return <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Interno</th><th className="font-normal px-4 py-2.5">Origen</th><th className="font-normal px-4 py-2.5">Destino</th><th className="font-normal px-4 py-2.5">Fecha</th><th className="font-normal px-4 py-2.5">Estado</th></tr></thead>
              <tbody>
                {paged.pageItems.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{item.interno_nombre}</td>
                    <td className="px-4 py-2.5 text-secondary">{item.congregacion_origen}</td>
                    <td className="px-4 py-2.5 text-secondary">{item.congregacion_destino}</td>
                    <td className="px-4 py-2.5 text-secondary">{item.fecha_asignacion}</td>
                    <td className="px-4 py-2.5"><span className="text-xs px-2 py-1 rounded bg-surface-1">{ESTADO_REINSERCION_LABELS[item.estado]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenReinsercion.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="casos" /></div>
          </>
        })()}
        {resumenReinsercion.length > 0 && (() => {
          const activos = resumenReinsercion.filter((item) => ['activo', 'inactivo', 'reincidencia'].includes(item.estado))
          const eficacia = activos.length ? Math.round((activos.filter((item) => item.estado === 'activo').length / activos.length) * 100) : null
          return eficacia !== null && (
            <p className="px-5 pb-4 text-xs text-secondary">Eficacia de reinserción eclesial: {eficacia}% de los liberados con seguimiento concluido siguen activos en su congregación destino.</p>
          )
        })()}
        <form onSubmit={asignarReinsercion} className="p-5 border-t border-border grid sm:grid-cols-3 gap-2 items-end">
          <div className="sm:col-span-3">
            <p className="text-sm font-medium">Asignar reinserción</p>
            <p className="text-xs text-secondary mt-1">Solo aparecen internos marcados como "liberado" que aún no tienen una reinserción en curso.</p>
          </div>
          <select required className="input-field" value={reinsercionForm.interno_id} onChange={(event) => setReinsercionForm({ ...reinsercionForm, interno_id: event.target.value })}>
            <option value="">Interno liberado...</option>
            {liberadosSinAsignar.map((interno) => <option key={interno.id} value={interno.id}>{interno.nombres} {interno.apellidos} · {interno.congregacion_origen}</option>)}
          </select>
          <select required className="input-field" value={reinsercionForm.congregacion_destino} onChange={(event) => setReinsercionForm({ ...reinsercionForm, congregacion_destino: event.target.value })}>
            <option value="">Congregación destino...</option>
            {congregations.map((congregacion) => <option key={congregacion.id} value={congregacion.id}>{congregacion.nombre}</option>)}
          </select>
          <button disabled={savingReinsercion || liberadosSinAsignar.length === 0} className="btn-primary justify-center"><ArrowRightLeft className="w-4 h-4" /> Asignar</button>
        </form>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium">Música por congregación</h2>
            <p className="text-sm text-secondary mt-1">FECP · Música y Alabanza, consolidado a nivel distrital.</p>
          </div>
          {resumenMusica.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay datos de Música en tu distrito.</p>
          ) : (() => {
            const paged = paginate('musica', resumenMusica)
            return <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Grupos</th><th className="font-normal px-4 py-2.5">Integrantes</th><th className="font-normal px-4 py-2.5">Sesiones (30d)</th></tr></thead>
                <tbody>
                  {paged.pageItems.map((item) => (
                    <tr key={item.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                      <td className="px-4 py-2.5">{item.grupos_activos}</td>
                      <td className="px-4 py-2.5">{item.integrantes_activos}</td>
                      <td className="px-4 py-2.5">{item.sesiones_ultimo_mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenMusica.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
            </>
          })()}
        </section>

        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium">Educación Artística por congregación</h2>
            <p className="text-sm text-secondary mt-1">FECP · Educación Artística, consolidado a nivel distrital.</p>
          </div>
          {resumenArtistica.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay datos de Educación Artística en tu distrito.</p>
          ) : (() => {
            const paged = paginate('artistica', resumenArtistica)
            return <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Grupos</th><th className="font-normal px-4 py-2.5">Integrantes</th><th className="font-normal px-4 py-2.5">Sesiones (30d)</th></tr></thead>
                <tbody>
                  {paged.pageItems.map((item) => (
                    <tr key={item.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                      <td className="px-4 py-2.5">{item.grupos_activos}</td>
                      <td className="px-4 py-2.5">{item.integrantes_activos}</td>
                      <td className="px-4 py-2.5">{item.sesiones_ultimo_mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenArtistica.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
            </>
          })()}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium">Educación Teológica por congregación</h2>
            <p className="text-sm text-secondary mt-1">FECP · Educación Teológica, consolidado a nivel distrital.</p>
          </div>
          {resumenTeologica.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay datos de Educación Teológica en tu distrito.</p>
          ) : (() => {
            const paged = paginate('teologica', resumenTeologica)
            return <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Grupos</th><th className="font-normal px-4 py-2.5">Integrantes</th><th className="font-normal px-4 py-2.5">Certificados</th><th className="font-normal px-4 py-2.5">Sesiones (30d)</th></tr></thead>
                <tbody>
                  {paged.pageItems.map((item) => (
                    <tr key={item.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                      <td className="px-4 py-2.5">{item.grupos_activos}</td>
                      <td className="px-4 py-2.5">{item.integrantes_activos}</td>
                      <td className="px-4 py-2.5">{item.certificados}</td>
                      <td className="px-4 py-2.5">{item.sesiones_ultimo_mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenTeologica.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
            </>
          })()}
        </section>

        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium">Conquistadores Pentecostales por congregación</h2>
            <p className="text-sm text-secondary mt-1">Jóvenes adultos de 18 a 40 años, consolidado a nivel distrital.</p>
          </div>
          {resumenConquistadores.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay datos de Conquistadores Pentecostales en tu distrito.</p>
          ) : (() => {
            const paged = paginate('conquistadores', resumenConquistadores)
            return <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Miembros</th><th className="font-normal px-4 py-2.5">Líderes</th><th className="font-normal px-4 py-2.5">Actividades (30d)</th></tr></thead>
                <tbody>
                  {paged.pageItems.map((item) => (
                    <tr key={item.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                      <td className="px-4 py-2.5">{item.miembros_activos}</td>
                      <td className="px-4 py-2.5">{item.lideres_activos}</td>
                      <td className="px-4 py-2.5">{item.actividades_ultimo_mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenConquistadores.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
            </>
          })()}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">Obra Social por congregación</h2>
          <p className="text-sm text-secondary mt-1">Asistencia socioeconómica a familias del censo, conectada con Red de Familias, consolidado a nivel distrital.</p>
        </div>
        {resumenObraSocial.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aún no hay datos de Obra Social en tu distrito.</p>
        ) : (() => {
          const paged = paginate('obraSocial', resumenObraSocial)
          return <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Casos abiertos</th><th className="font-normal px-4 py-2.5">Casos resueltos</th><th className="font-normal px-4 py-2.5">Ayudas (30d)</th></tr></thead>
              <tbody>
                {paged.pageItems.map((item) => (
                  <tr key={item.congregacion_id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                    <td className="px-4 py-2.5">{item.casos_abiertos}</td>
                    <td className="px-4 py-2.5">{item.casos_resueltos}</td>
                    <td className="px-4 py-2.5">{item.ayudas_ultimo_mes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenObraSocial.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
          </>
        })()}
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium">Misión Juvenil por congregación</h2>
            <p className="text-sm text-secondary mt-1">Colegios y universidades, consolidado a nivel distrital.</p>
          </div>
          {resumenMisionJuvenil.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay datos de Misión Juvenil en tu distrito.</p>
          ) : (() => {
            const paged = paginate('misionJuvenil', resumenMisionJuvenil)
            return <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Estudiantes</th><th className="font-normal px-4 py-2.5">Bautizados</th><th className="font-normal px-4 py-2.5">Instituciones</th><th className="font-normal px-4 py-2.5">Lecciones (30d)</th></tr></thead>
                <tbody>
                  {paged.pageItems.map((item) => (
                    <tr key={item.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                      <td className="px-4 py-2.5">{item.estudiantes_activos}</td>
                      <td className="px-4 py-2.5">{item.bautizados}</td>
                      <td className="px-4 py-2.5">{item.instituciones_impactadas}</td>
                      <td className="px-4 py-2.5">{item.lecciones_ultimo_mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenMisionJuvenil.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
            </>
          })()}
        </section>

        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium">Red de Familias por congregación</h2>
            <p className="text-sm text-secondary mt-1">Acompañamiento familiar y visitas domiciliarias, consolidado a nivel distrital.</p>
          </div>
          {resumenRedFamilias.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay datos de Red de Familias en tu distrito.</p>
          ) : (() => {
            const paged = paginate('redFamilias', resumenRedFamilias)
            return <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Casos activos</th><th className="font-normal px-4 py-2.5">Prioridad alta</th><th className="font-normal px-4 py-2.5">Cerrados (3m)</th><th className="font-normal px-4 py-2.5">Visitas pendientes</th></tr></thead>
                <tbody>
                  {paged.pageItems.map((item) => (
                    <tr key={item.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                      <td className="px-4 py-2.5">{item.casos_activos}</td>
                      <td className={`px-4 py-2.5 ${Number(item.casos_alta_prioridad) > 0 ? 'text-danger' : ''}`}>{item.casos_alta_prioridad}</td>
                      <td className="px-4 py-2.5">{item.casos_cerrados_3m}</td>
                      <td className="px-4 py-2.5">{item.visitas_pendientes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenRedFamilias.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
            </>
          })()}
        </section>
      </div>

      <form onSubmit={createCongregation} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end border-2 border-accent/30" style={{ backdropFilter: 'none' }}>
        <div className="sm:col-span-2 lg:col-span-5">
          <h2 className="font-medium flex items-center gap-2"><Building2 className="w-4 h-4 text-accent" />Registrar nueva congregación</h2>
          <p className="text-xs text-secondary mt-1">Crea la congregación en tu distrito y da acceso a su primer pastor local. Queda pendiente de aprobación hasta que la actives desde Aprobaciones.</p>
          {catalogoCongregaciones.length > 0 && (
            <p className="text-xs text-accent mt-1">Te faltan {catalogoPendientes.length} de {catalogoCongregaciones.length} congregaciones reales de tu distrito por registrar en SIGAP.</p>
          )}
        </div>
        <div className="text-sm relative sm:col-span-2 lg:col-span-5" ref={catalogoFieldRef}>
          Nombre de la congregación
          <input
            required
            className="input-field mt-1.5"
            placeholder="Escribe o elige de la lista oficial..."
            value={newCongregation.nombre}
            onChange={(event) => {
              setNewCongregation({ ...newCongregation, nombre: event.target.value })
              setCatalogoSeleccionadoId(null)
              setCatalogoSearchTerm(event.target.value)
              setCatalogoDropdownOpen(true)
            }}
            onFocus={() => setCatalogoDropdownOpen(true)}
          />
          {catalogoDropdownOpen && catalogoPendientes.length > 0 && (
            <div className="absolute z-30 mt-1 w-full bg-surface-2 border border-border rounded-card shadow-lg max-h-48 overflow-y-auto">
              {catalogoSugerencias.length === 0 ? (
                <p className="p-3 text-xs text-muted">Sin coincidencias en la lista oficial — puedes registrarla igual con el nombre que escribiste.</p>
              ) : catalogoSugerencias.slice(0, 30).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setNewCongregation({ ...newCongregation, nombre: item.nombre, ciudad: item.ciudad || newCongregation.ciudad })
                    setCatalogoSeleccionadoId(item.id)
                    setCatalogoSearchTerm(item.nombre)
                    setCatalogoDropdownOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-1 border-b border-border last:border-0"
                >
                  {item.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="text-sm">Ciudad/Municipio<input className="input-field mt-1.5" value={newCongregation.ciudad} onChange={(event) => setNewCongregation({ ...newCongregation, ciudad: event.target.value })} /></label>
        <label className="text-sm">Nombres del pastor<input required className="input-field mt-1.5" value={newCongregation.pastor_nombres} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_nombres: event.target.value })} /></label>
        <label className="text-sm">Apellidos del pastor<input required className="input-field mt-1.5" value={newCongregation.pastor_apellidos} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_apellidos: event.target.value })} /></label>
        <label className="text-sm">Teléfono del pastor<input className="input-field mt-1.5" value={newCongregation.pastor_telefono} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_telefono: event.target.value })} /></label>
        <label className="text-sm">Correo del pastor<input required type="email" className="input-field mt-1.5" value={newCongregation.pastor_email} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_email: event.target.value })} /></label>
        <button disabled={creatingCongregation} className="btn-primary lg:col-span-5"><Plus className="w-4 h-4" />{creatingCongregation ? 'Creando...' : 'Crear congregación e invitar pastor'}</button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <form ref={pastorFormRef} onSubmit={savePastor} className="card p-5 grid sm:grid-cols-2 gap-3 items-end" style={{ backdropFilter: 'none' }}>
          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            <h2 className="font-medium">{editingPastorId ? 'Editar pastor' : 'Registrar pastor'}</h2>
            {editingPastorId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancelar edición
              </button>
            )}
          </div>

          <label className="text-sm">
            Nombres
            <input
              required
              className="input-field mt-1.5"
              value={form.nombres}
              onChange={(event) => setForm({ ...form, nombres: event.target.value })}
            />
          </label>

          <label className="text-sm">
            Apellidos
            <input
              required
              className="input-field mt-1.5"
              value={form.apellidos}
              onChange={(event) => setForm({ ...form, apellidos: event.target.value })}
            />
          </label>

          <label className="text-sm">
            Teléfono
            <input
              className="input-field mt-1.5"
              value={form.telefono}
              onChange={(event) => setForm({ ...form, telefono: event.target.value })}
            />
          </label>

          <label className="text-sm">
            Familia pastoral
            <input
              className="input-field mt-1.5"
              placeholder="Cónyuge e hijos"
              value={form.familia_pastoral}
              onChange={(event) => setForm({ ...form, familia_pastoral: event.target.value })}
            />
          </label>

          {!editingPastorId && (
            <label className="text-sm">
              Correo (para invitar acceso)
              <input
                required
                type="email"
                className="input-field mt-1.5"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
          )}

          {editingPastorId && (
            <label className="text-sm">
              Licencia ministerial
              <select
                className="input-field mt-1.5"
                value={form.licencia}
                onChange={(event) => setForm({ ...form, licencia: event.target.value })}
              >
                {Object.entries(LICENCIA_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <span className="block text-xs text-muted mt-1">Corrige la licencia directamente (ej. un error de captura). Para un ascenso real, usa "Ascender licencia ministerial" más abajo.</span>
            </label>
          )}

          {editingPastorId && (
            <label className="text-sm">
              Tarjeta de predicador (obreros sin licencia)
              <input
                type="date"
                className="input-field mt-1.5"
                value={form.fecha_tarjeta_predicador}
                onChange={(event) => setForm({ ...form, fecha_tarjeta_predicador: event.target.value })}
              />
            </label>
          )}

          <div className="text-sm relative" ref={congregacionFieldRef}>
            Congregación
            <input
              required
              className="input-field mt-1.5"
              placeholder="Escribe para buscar en la lista oficial..."
              value={congregacionSearchTerm}
              onChange={(event) => {
                setCongregacionSearchTerm(event.target.value)
                setForm({ ...form, congregacion_id: editingPastorId ? form.congregacion_id : '' })
                setCongregacionCorreccionCatalogoId(null)
                setCongregacionDropdownOpen(true)
              }}
              onFocus={() => setCongregacionDropdownOpen(true)}
            />
            {editingPastorId && (
              <span className="block text-xs text-muted mt-1">Busca por el nombre oficial. Si eliges una que ya existe en SIGAP, se traslada; si eliges una oficial que aún no está registrada, se corrige el nombre de la congregación actual.</span>
            )}
            {congregacionDropdownOpen && (() => {
              const opciones = editingPastorId ? opcionesCongregacionEditar : congregacionesParaAsignar
              return (
                <div className="absolute z-30 mt-1 w-full bg-surface-2 border border-border rounded-card shadow-lg max-h-48 overflow-y-auto">
                  {opciones.length === 0 ? <p className="p-3 text-xs text-muted">Sin resultados.</p> : opciones.map((item) => (
                    <button
                      type="button"
                      key={`${item.tipo || 'real'}-${item.id}`}
                      onClick={() => {
                        if (!editingPastorId || item.tipo === 'real') {
                          setForm({ ...form, congregacion_id: item.id })
                          setCongregacionCorreccionCatalogoId(null)
                        } else {
                          setCongregacionCorreccionCatalogoId(item.id)
                        }
                        setCongregacionSearchTerm(item.nombre)
                        setCongregacionDropdownOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-1 border-b border-border last:border-0"
                    >
                      {item.nombre}
                      {item.tipo === 'oficial' && <span className="ml-2 text-[10px] uppercase tracking-wide text-accent">Oficial · sin registrar</span>}
                    </button>
                  ))}
                </div>
              )
            })()}
            {!editingPastorId && (
              <span className="block text-xs text-muted mt-1">Solo se muestran congregaciones sin pastor asignado.</span>
            )}
          </div>

          <label className="text-sm">
            Cargo
            <select
              className="input-field mt-1.5"
              value={form.cargo}
              onChange={(event) => setForm({ ...form, cargo: event.target.value })}
            >
              {CARGO_OPTIONS.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Desde
            <input
              required
              type="date"
              className="input-field mt-1.5"
              value={form.fecha_inicio}
              onChange={(event) => setForm({ ...form, fecha_inicio: event.target.value })}
            />
          </label>

          <button disabled={saving} className="btn-primary sm:col-span-2">
            {editingPastorId ? <PencilLine className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Guardando...' : editingPastorId ? 'Guardar cambios' : 'Registrar pastor'}
          </button>

          <label className="text-sm sm:col-span-2">
            Observaciones
            <textarea
              className="input-field mt-1.5"
              value={form.observaciones}
              onChange={(event) => setForm({ ...form, observaciones: event.target.value })}
            />
          </label>
        </form>

        <form ref={transferFormRef} onSubmit={handleTransfer} className="card p-5 grid gap-3 items-end">
          <h2 className="font-medium">Trasladar pastor</h2>

          <label className="text-sm">
            Pastor
            <select
              required
              className="input-field mt-1.5"
              value={transferForm.pastor_id}
              onChange={(event) =>
                setTransferForm({
                  ...transferForm,
                  pastor_id: event.target.value,
                  congregacion_id: '',
                })
              }
            >
              <option value="">Seleccionar...</option>
              {pastors.map((pastor) => (
                <option key={pastor.id} value={pastor.id}>
                  {pastor.nombres} {pastor.apellidos}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Nueva congregación
            <select
              required
              className="input-field mt-1.5"
              value={transferForm.congregacion_id}
              onChange={(event) => setTransferForm({ ...transferForm, congregacion_id: event.target.value })}
            >
              <option value="">Seleccionar...</option>
              {congregations
                .filter((congregation) => !congregation.pastor_id || congregation.pastor_id === transferForm.pastor_id)
                .map((congregation) => (
                  <option key={congregation.id} value={congregation.id}>
                    {congregation.nombre}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm">
            Fecha del traslado
            <input
              required
              type="date"
              className="input-field mt-1.5"
              value={transferForm.fecha}
              onChange={(event) => setTransferForm({ ...transferForm, fecha: event.target.value })}
            />
          </label>

          <label className="text-sm">
            Observaciones
            <textarea
              className="input-field mt-1.5"
              value={transferForm.observaciones}
              onChange={(event) => setTransferForm({ ...transferForm, observaciones: event.target.value })}
            />
          </label>

          <button disabled={saving} className="btn-secondary">
            <ArrowRightLeft className="w-4 h-4" />
            {saving ? 'Trasladando...' : 'Confirmar traslado'}
          </button>
        </form>
      </div>

      <form onSubmit={handleFinalizarAsignacion} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div className="sm:col-span-2 lg:col-span-4">
          <h2 className="font-medium">Finalizar asignación pastoral</h2>
          <p className="text-xs text-secondary mt-1">Cuando un pastor se retira o renuncia sin ir a otra congregación conocida en SIGAP: deja la congregación vacante y revoca su acceso, lista para asignar un nuevo pastor.</p>
        </div>
        <label className="text-sm">
          Pastor
          <select required className="input-field mt-1.5" value={finalizarForm.pastor_id} onChange={(event) => setFinalizarForm({ ...finalizarForm, pastor_id: event.target.value })}>
            <option value="">Seleccionar...</option>
            {pastors.filter((pastor) => activeByPastor.has(pastor.id)).map((pastor) => (
              <option key={pastor.id} value={pastor.id}>{pastor.nombres} {pastor.apellidos}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Fecha
          <input required type="date" className="input-field mt-1.5" value={finalizarForm.fecha} onChange={(event) => setFinalizarForm({ ...finalizarForm, fecha: event.target.value })} />
        </label>
        <label className="text-sm sm:col-span-2">
          Observaciones
          <input className="input-field mt-1.5" placeholder="Motivo (opcional)" value={finalizarForm.observaciones} onChange={(event) => setFinalizarForm({ ...finalizarForm, observaciones: event.target.value })} />
        </label>
        <button disabled={finalizando} className="btn-secondary sm:col-span-2 lg:col-span-4">
          {finalizando ? 'Finalizando...' : 'Finalizar asignación'}
        </button>
      </form>

      <form onSubmit={ascenderLicencia} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div className="sm:col-span-2 lg:col-span-4">
          <h2 className="font-medium flex items-center gap-2"><GraduationCap className="w-4 h-4 text-accent" />Ascender licencia ministerial</h2>
          <p className="text-xs text-secondary mt-1">Escalafón de la IPUC: Obrero → Licencia Local → Licencia General → Ordenación Ministerial. Un nivel a la vez.</p>
        </div>
        <label className="text-sm lg:col-span-2">
          Pastor
          <select
            required
            className="input-field mt-1.5"
            value={licenciaForm.pastor_id}
            onChange={(event) => setLicenciaForm({ ...licenciaForm, pastor_id: event.target.value })}
          >
            <option value="">Seleccionar...</option>
            {pastors.filter((pastor) => LICENCIA_SIGUIENTE[pastor.licencia]).map((pastor) => (
              <option key={pastor.id} value={pastor.id}>
                {pastor.nombres} {pastor.apellidos} — {LICENCIA_LABELS[pastor.licencia]} → {LICENCIA_LABELS[LICENCIA_SIGUIENTE[pastor.licencia]]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Fecha
          <input
            required
            type="date"
            className="input-field mt-1.5"
            value={licenciaForm.fecha}
            onChange={(event) => setLicenciaForm({ ...licenciaForm, fecha: event.target.value })}
          />
        </label>
        <label className="text-sm">
          Observaciones
          <input
            className="input-field mt-1.5"
            placeholder="Evaluación, Consistorio de Ancianos..."
            value={licenciaForm.observaciones}
            onChange={(event) => setLicenciaForm({ ...licenciaForm, observaciones: event.target.value })}
          />
        </label>
        <button disabled={ascendiendoLicencia} className="btn-primary lg:col-span-4">
          <GraduationCap className="w-4 h-4" />
          {ascendiendoLicencia ? 'Registrando...' : 'Registrar ascenso'}
        </button>
      </form>

      <form onSubmit={addFormacion} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div className="sm:col-span-2 lg:col-span-6">
          <h2 className="font-medium flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent" />Preparación académica y ministerial</h2>
          <p className="text-xs text-secondary mt-1">Títulos, cursos, diplomados y demás formación de cada pastor del distrito.</p>
        </div>
        <label className="text-sm lg:col-span-2">
          Pastor
          <select
            required
            className="input-field mt-1.5"
            value={formacionForm.pastor_id}
            onChange={(event) => setFormacionForm({ ...formacionForm, pastor_id: event.target.value })}
          >
            <option value="">Seleccionar...</option>
            {pastors.map((pastor) => (
              <option key={pastor.id} value={pastor.id}>{pastor.nombres} {pastor.apellidos}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Tipo
          <select
            className="input-field mt-1.5"
            value={formacionForm.tipo}
            onChange={(event) => setFormacionForm({ ...formacionForm, tipo: event.target.value })}
          >
            {Object.entries(TIPO_FORMACION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {formacionForm.tipo === 'otro' && (
          <label className="text-sm">
            Especifica el tipo
            <input required className="input-field mt-1.5" value={formacionForm.tipo_otro} onChange={(event) => setFormacionForm({ ...formacionForm, tipo_otro: event.target.value })} />
          </label>
        )}
        <label className="text-sm">
          Nombre
          <input required placeholder="Ej: Teología Pastoral" className="input-field mt-1.5" value={formacionForm.nombre} onChange={(event) => setFormacionForm({ ...formacionForm, nombre: event.target.value })} />
        </label>
        <label className="text-sm">
          Institución
          <input className="input-field mt-1.5" value={formacionForm.institucion} onChange={(event) => setFormacionForm({ ...formacionForm, institucion: event.target.value })} />
        </label>
        <label className="text-sm">
          Fecha
          <input type="date" className="input-field mt-1.5" value={formacionForm.fecha} onChange={(event) => setFormacionForm({ ...formacionForm, fecha: event.target.value })} />
        </label>
        <button disabled={savingFormacion} className="btn-primary lg:col-span-6">
          <Plus className="w-4 h-4" />
          {savingFormacion ? 'Guardando...' : 'Agregar preparación'}
        </button>
      </form>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-medium">Pastores y trayectoria</h2>
              <p className="text-sm text-secondary mt-1">Asignaciones vigentes e históricas del distrito.</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-secondary" />
                <input
                  className="input-field pl-9 min-w-[220px]"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar pastor o congregación"
                />
              </div>

              <select className="input-field min-w-[180px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="vacant">Históricos / sin asignación</option>
              </select>

              <select className="input-field min-w-[180px]" value={congregationFilter} onChange={(event) => setCongregationFilter(event.target.value)}>
                <option value="all">Todas las congregaciones</option>
                {congregations.map((congregation) => (
                  <option key={congregation.id} value={congregation.id}>
                    {congregation.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredPastors.map((pastor) => {
              const activeAssignment = activeByPastor.get(pastor.id)
              const congregation = congregations.find((item) => item.id === activeAssignment?.congregacion_id)
              const isAssigned = Boolean(activeAssignment)
              const resumenCongregacion = congregation ? resumenPorCongregacion.get(congregation.id) : null

              return (
                <article key={pastor.id} className="border border-border rounded-lg bg-surface-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-ink">{pastor.nombres} {pastor.apellidos}</h3>
                      <p className="text-xs text-secondary mt-1">{congregation?.nombre || 'Sin congregación asignada'}{congregation?.ciudad ? ` · ${congregation.ciudad}` : ''}</p>
                      <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-accent-bg text-accent">{LICENCIA_LABELS[pastor.licencia] || 'Obrero'}</span>
                      {pastor.licencia === 'obrero' && pastor.fecha_tarjeta_predicador && (
                        <span className="inline-block mt-1 ml-1.5 text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-surface-2 text-secondary">Tarjeta de predicador: {formatDate(pastor.fecha_tarjeta_predicador)}</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${isAssigned ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'}`}>
                        {isAssigned ? 'Activo' : 'Sin asignación'}
                      </span>
                      {!pastor.persona_id && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-danger-bg text-danger">Sin acceso vinculado</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-secondary">
                    {pastor.telefono && <p>Tel: {pastor.telefono}</p>}
                    {pastor.familia_pastoral && <p>Familia: {pastor.familia_pastoral}</p>}
                    {activeAssignment && <p>Cargo: {activeAssignment.cargo}</p>}
                    {resumenCongregacion && (
                      <p>{resumenCongregacion.personas_activas} personas activas · {resumenCongregacion.personas_nuevas_3m} nuevas (3 meses)</p>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button type="button" className="btn-secondary flex-1" onClick={() => openPastorEditor(pastor)}>
                      <PencilLine className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-primary flex-1"
                      onClick={() => {
                        setTransferForm({ pastor_id: pastor.id, congregacion_id: '', fecha: TODAY, observaciones: '' })
                        transferFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Trasladar
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {filteredPastors.length === 0 && (
            <p className="mt-4 text-sm text-muted">No hay pastores que coincidan con los filtros actuales.</p>
          )}
        </div>

        <div className="border-t border-border">
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <MapPinned className="w-4 h-4 text-accent" />
              Historial de asignaciones
            </div>

            {filteredAssignments.length ? (
              <div className="space-y-3">
                {filteredAssignments.map((assignment) => {
                  const pastor = pastors.find((item) => item.id === assignment.pastor_id)
                  const congregation = congregations.find((item) => item.id === assignment.congregacion_id)
                  const isActive = !assignment.fecha_fin

                  return (
                    <div key={assignment.id} className="flex items-start gap-3 border border-border rounded-lg bg-surface-1 p-3">
                      <ArrowRightLeft className="w-4 h-4 text-accent mt-1" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {pastor ? `${pastor.nombres} ${pastor.apellidos}` : 'Pastor'}
                          </p>
                          <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${isActive ? 'bg-success-bg text-success' : 'bg-surface-2 text-secondary'}`}>
                            {isActive ? 'Actual' : 'Histórico'}
                          </span>
                        </div>
                        <p className="text-xs text-secondary mt-1">
                          {assignment.cargo} · {congregation?.nombre || 'Congregación'}
                        </p>
                        <p className="text-xs text-secondary mt-1">
                          Desde {formatDate(assignment.fecha_inicio)}
                          {assignment.fecha_fin ? ` · Hasta ${formatDate(assignment.fecha_fin)}` : ' · Vigente'}
                        </p>
                        {assignment.observaciones && (
                          <p className="text-xs text-muted mt-1">Obs: {assignment.observaciones}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="p-4 text-sm text-muted">Aún no hay trayectoria pastoral registrada con los filtros actuales.</p>
            )}
          </div>
        </div>

        <div className="border-t border-border">
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <GraduationCap className="w-4 h-4 text-accent" />
              Historial de licencias ministeriales
            </div>

            {licenciaHistorial.length ? (
              <div className="space-y-3">
                {licenciaHistorial.map((item) => {
                  const pastor = pastors.find((entry) => entry.id === item.pastor_id)
                  return (
                    <div key={item.id} className="flex items-start gap-3 border border-border rounded-lg bg-surface-1 p-3">
                      <GraduationCap className="w-4 h-4 text-accent mt-1" />
                      <div className="flex-1">
                        <p className="text-sm font-medium flex items-center gap-2">
                          {pastor ? `${pastor.nombres} ${pastor.apellidos}` : 'Pastor'}
                          {item.tipo === 'correccion' && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-warning-bg text-warning">Corrección</span>}
                        </p>
                        <p className="text-xs text-secondary mt-1">{LICENCIA_LABELS[item.licencia_anterior] || item.licencia_anterior} → {LICENCIA_LABELS[item.licencia_nueva] || item.licencia_nueva}</p>
                        <p className="text-xs text-secondary mt-1">{formatDate(item.fecha)}</p>
                        {item.observaciones && <p className="text-xs text-muted mt-1">Obs: {item.observaciones}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="p-4 text-sm text-muted">Aún no hay ascensos de licencia registrados.</p>
            )}
          </div>
        </div>

        <div className="border-t border-border">
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <BookOpen className="w-4 h-4 text-accent" />
              Preparación académica y ministerial
            </div>

            {formaciones.length ? (
              <div className="space-y-3">
                {formaciones.map((item) => {
                  const pastor = pastors.find((entry) => entry.id === item.pastor_id)
                  const tipoLabel = item.tipo === 'otro' ? (item.tipo_otro || 'Otro') : TIPO_FORMACION_LABELS[item.tipo] || item.tipo
                  return (
                    <div key={item.id} className="flex items-start gap-3 border border-border rounded-lg bg-surface-1 p-3">
                      <BookOpen className="w-4 h-4 text-accent mt-1" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{pastor ? `${pastor.nombres} ${pastor.apellidos}` : 'Pastor'}</p>
                          <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-accent-bg text-accent">{tipoLabel}</span>
                        </div>
                        <p className="text-xs text-secondary mt-1">{item.nombre}{item.institucion ? ` · ${item.institucion}` : ''}</p>
                        {item.fecha && <p className="text-xs text-secondary mt-1">{formatDate(item.fecha)}</p>}
                        {item.observaciones && <p className="text-xs text-muted mt-1">Obs: {item.observaciones}</p>}
                      </div>
                      <button type="button" onClick={() => deleteFormacion(item.id)} className="text-muted hover:text-danger" aria-label="Eliminar registro de preparación">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="p-4 text-sm text-muted">Aún no hay preparación académica registrada.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
