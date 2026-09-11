import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightLeft, Download, Plus, Search, PencilLine, Users, Building2, UserRoundCheck, CircleDashed, MapPinned, GraduationCap, BookOpen, Trash2, LockKeyhole, ClipboardCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { hoyBogota } from "../lib/fechaBogota";
import { useMiRol } from '../hooks/useMiRol'
import Pager from '../components/Pager'
import InfoTip from '../components/InfoTip'
import { descargarPdf } from '../lib/reportExport'
import { ETIQUETA_TRIMESTRE, limitesInformeTrimestral, trimestreCerradoMasReciente } from '../lib/trimestre'

const pastoralDistritalCache = new Map()

const TODAY = hoyBogota()
const CARGO_OPTIONS = ['Pastor local', 'Pastor asociado', 'Pastor auxiliar', 'Coordinador de congregación']
const LICENCIA_LABELS = { obrero: 'Obrero', local: 'Licencia Local', general: 'Licencia General', ordenacion: 'Ordenación Ministerial' }
const LICENCIA_SIGUIENTE = { obrero: 'local', local: 'general', general: 'ordenacion', ordenacion: null }
const TIPO_FORMACION_LABELS = { titulo: 'Título', curso: 'Curso', diplomado: 'Diplomado', especializacion: 'Especialización', maestria: 'Maestría', doctorado: 'Doctorado', seminario_biblico: 'Seminario bíblico', otro: 'Otro' }
const MADUREZ_LABELS = { mision_nacional: 'Misión Nacional', lugar_prediccion: 'Lugar de Predicación', iglesia_local: 'Iglesia Local (Constituida)' }
const INFORME_SORT_LABELS = { bautizados_nuevos: 'Bautizados', sellados_nuevos: 'Sellados', reconciliados_actual: 'Reconciliados', entregados_nuevos: 'Entregados nuevos' }
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
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${Number(resumen.cargos_obligatorios_vacantes) > 0 ? 'bg-danger-bg text-danger' : 'bg-surface-1 text-muted'}`}>{resumen.cargos_obligatorios_vacantes} cargo(s) obligatorio(s) de comité sin cubrir<InfoTip texto="Cargos locales (de comités como Escuela Dominical, Damas Dorcas, etc.) que toda congregación debe tener cubiertos. No son los 6 cargos de la junta distrital." /></span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// Las ~11 tablas "por congregacion" (Escuela Dominical, Damas Dorcas,
// Obra Carcelaria, Musica, Ed. Artistica, Ed. Teologica, Conquistadores,
// Obra Social, Mision Juvenil, Red de Familias, Ruta Evangelistica)
// venian como una tabla plana ordenada solo alfabeticamente (order by
// nombre en el SQL), sin ningun KPI agregado del distrito, sin poder
// ordenar por metrica, y con casi ninguna celda senalando un problema
// real -- muy distinto del resto de la app, donde un valor en cero en
// una metrica de cobertura ya se resalta. Este componente unifica las
// 11 en un solo patron: tarjetas KPI (suma sobre TODO el distrito, no
// solo la pagina visible), selector de orden, tono de alerta por
// metrica (definido por cada seccion segun lo que de verdad importa
// ahi), y el mismo insight de "quien lidera" que ya usan Evangelismo/
// Conquistadores/etc en sus propias pantallas locales.
function ResumenComiteDistrital({ icon: Icon, titulo, infoTitulo, descripcion, data, pageKey, emptyMessage, metrics, unidadLider, paginate }) {
  const primary = metrics.find((metric) => metric.primary) || metrics[0]
  const [sortKey, setSortKey] = useState(primary.key)
  const sorted = useMemo(
    () => [...data].sort((a, b) => Number(b[sortKey] || 0) - Number(a[sortKey] || 0)),
    [data, sortKey]
  )
  const totales = useMemo(() => {
    const result = {}
    metrics.forEach((metric) => {
      if (metric.kpi) result[metric.key] = data.reduce((sum, row) => sum + Number(row[metric.key] || 0), 0)
    })
    return result
  }, [data, metrics])
  const kpiMetrics = metrics.filter((metric) => metric.kpi)
  const lider = sorted[0]

  return (
    <section className="card overflow-hidden">
      <div className="p-5 border-b border-border">
        <h2 className="font-medium flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-accent" />}{titulo}{infoTitulo && <InfoTip texto={infoTitulo} />}</h2>
        <p className="text-sm text-secondary mt-1">{descripcion}</p>
      </div>
      {data.length === 0 ? (
        <p className="p-5 text-sm text-muted">{emptyMessage}</p>
      ) : (() => {
        const paged = paginate(pageKey, sorted)
        return <>
        {kpiMetrics.length > 0 && (
          <div className="grid gap-3 p-5 border-b border-border" style={{ gridTemplateColumns: `repeat(${kpiMetrics.length}, minmax(0,1fr))` }}>
            {kpiMetrics.map((metric) => (
              <div key={metric.key} className="stat-tile">
                <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{metric.label}</p>
                <p className="mt-2 text-xl font-semibold">{totales[metric.key]}</p>
              </div>
            ))}
          </div>
        )}
        {lider && Number(lider[primary.key] || 0) > 0 && (
          <p className="px-5 pt-4 text-sm text-secondary">{lider.nombre} lidera con {lider[primary.key]} {unidadLider}.</p>
        )}
        <div className="px-5 pt-4 flex justify-end">
          <select className="input-field text-xs" value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
            {metrics.map((metric) => <option key={metric.key} value={metric.key}>Ordenar por {metric.label}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted bg-surface-1">
                <th className="font-normal px-4 py-2.5">Congregación</th>
                {metrics.map((metric) => (
                  <th key={metric.key} className="font-normal px-4 py-2.5">
                    <span className="flex items-center gap-1.5">{metric.label}{metric.info && <InfoTip texto={metric.info} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.pageItems.map((item) => (
                <tr key={item.congregacion_id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                  {metrics.map((metric) => (
                    <td key={metric.key} className={`px-4 py-2.5 ${metric.tone ? metric.tone(item[metric.key]) : ''}`}>{item[metric.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={sorted.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
        </>
      })()}
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
  const [resumenRuta, setResumenRuta] = useState([])
  const [personasDistrito, setPersonasDistrito] = useState([])
  const [cargosDistritales, setCargosDistritales] = useState([])
  const [sepriSolicitudes, setSepriSolicitudes] = useState([])
  const [sepriResumen, setSepriResumen] = useState([])
  const [sepriNotas, setSepriNotas] = useState({})
  const [cargoForm, setCargoForm] = useState({ persona_id: '', cargo: 'supervisor', fecha_inicio: hoyBogota() })
  const [savingCargo, setSavingCargo] = useState(false)
  const [tablePages, setTablePages] = useState({})
  const informeTrimestralCerrado = trimestreCerradoMasReciente()
  const [informeAnio, setInformeAnio] = useState(informeTrimestralCerrado.anio)
  const [informeTrimestre, setInformeTrimestre] = useState(informeTrimestralCerrado.trimestre)
  const [resumenInformeTrimestral, setResumenInformeTrimestral] = useState([])
  const [loadingInformeTrimestral, setLoadingInformeTrimestral] = useState(true)
  const [informeSortKey, setInformeSortKey] = useState('bautizados_nuevos')
  const filasInformeOrdenadas = useMemo(
    () => [...resumenInformeTrimestral].sort((a, b) => Number(b[informeSortKey] || 0) - Number(a[informeSortKey] || 0)),
    [resumenInformeTrimestral, informeSortKey]
  )

  async function descargarInformeTrimestralDistrital() {
    if (!filasInformeOrdenadas.length) return
    const etiqueta = `${ETIQUETA_TRIMESTRE[informeTrimestre]} ${informeAnio}`
    const distritoLabel = rolPrincipal?.distritos?.numero ? `Distrito ${rolPrincipal.distritos.numero}` : 'Distrito'
    const sumar = (campo) => filasInformeOrdenadas.reduce((total, item) => total + Number(item[campo] || 0), 0)
    await descargarPdf({
      filename: `informe-trimestral-distrital-${informeAnio}-t${informeTrimestre}.pdf`,
      titulo: `Informe trimestral por congregación · ${etiqueta}`,
      orientacion: 'landscape',
      meta: [distritoLabel, `Trimestre: ${etiqueta}`, `Ordenado por: ${INFORME_SORT_LABELS[informeSortKey]}`],
      resumen: {
        kpis: [
          { label: 'Bautizados nuevos (distrito)', value: sumar('bautizados_nuevos') },
          { label: 'Sellados nuevos (distrito)', value: sumar('sellados_nuevos') },
          { label: 'Reconciliados (distrito)', value: sumar('reconciliados_actual') },
          { label: 'Entregados nuevos (distrito)', value: sumar('entregados_nuevos') },
        ],
      },
      headers: ['Congregación', 'Bautizados', '+Nuevos', 'Sellados', '+Nuevos', 'Reconciliados', 'Antes', 'Entregados', '+Nuevos'],
      rows: filasInformeOrdenadas.map((item) => [
        item.nombre,
        item.bautizados_total_actual, item.bautizados_nuevos,
        item.sellados_total_actual, item.sellados_nuevos,
        item.reconciliados_actual, item.reconciliados_anterior,
        item.entregados_total_actual, item.entregados_nuevos,
      ]),
    })
  }

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

  // Antes se pasaba `congregations.filter(...)` inline como prop, creando
  // un array nuevo en cada render del padre -- el useEffect de
  // ContinuidadPastoral (dependiente de ese array) volvia a disparar todas
  // sus consultas resumen_continuidad_congregacion en cada interaccion de
  // la pantalla (escribir en el buscador, editar una nota SEPRI, etc.),
  // no solo cuando la lista de vacantes cambiaba de verdad.
  const vacantesCongregaciones = useMemo(
    () => congregations.filter((congregacion) => !congregacion.pastor_id),
    [congregations]
  )

  const stats = useMemo(() => {
    const activePastorIds = new Set(activeAssignments.map((assignment) => assignment.pastor_id))
    const activePastorCount = pastors.filter((pastor) => activePastorIds.has(pastor.id)).length
    const congregationsWithPastors = congregations.filter((congregation) => congregation.pastor_id).length
    const vacantCongregations = congregations.length - congregationsWithPastors
    const vacantPercent = congregations.length ? Math.round((vacantCongregations / congregations.length) * 100) : 0

    return {
      totalPastors: pastors.length,
      activePastorCount,
      congregationsWithPastors,
      vacantCongregations,
      vacantPercent,
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

    const cacheKey = distritoId
    const cached = pastoralDistritalCache.get(cacheKey)
    if (cached) {
      setPastors(cached.pastors)
      setCongregations(cached.congregations)
      setAssignments(cached.assignments)
      setPastorProfileId(cached.pastorProfileId)
      setResumenPorCongregacion(cached.resumenPorCongregacion)
      setLicenciaHistorial(cached.licenciaHistorial)
      setFormaciones(cached.formaciones)
      setResumenEscuelaDominical(cached.resumenEscuelaDominical)
      setResumenDamas(cached.resumenDamas)
      setCentros(cached.centros)
      setResumenCarcelaria(cached.resumenCarcelaria)
      setResumenReinsercion(cached.resumenReinsercion)
      setLiberadosSinAsignar(cached.liberadosSinAsignar)
      setResumenMusica(cached.resumenMusica)
      setResumenArtistica(cached.resumenArtistica)
      setResumenTeologica(cached.resumenTeologica)
      setResumenConquistadores(cached.resumenConquistadores)
      setResumenObraSocial(cached.resumenObraSocial)
      setResumenMisionJuvenil(cached.resumenMisionJuvenil)
      setResumenRedFamilias(cached.resumenRedFamilias)
      setResumenRuta(cached.resumenRuta)
      setPersonasDistrito(cached.personasDistrito)
      setCargosDistritales(cached.cargosDistritales)
      setSepriSolicitudes(cached.sepriSolicitudes)
      setSepriResumen(cached.sepriResumen)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    const [pastorResult, congregationResult, assignmentResult, profileResult, resumenResult, licenciaResult, formacionResult, escuelaDominicalResult, damasResult, centrosResult, carcelariaResult, reinsercionResult, liberadosResult, musicaResult, artisticaResult, teologicaResult, conquistadoresResult, obraSocialResult, misionJuvenilResult, redFamiliasResult, rutaResult, personasResult, cargosResult, sepriResult, sepriResumenResult] = await Promise.all([
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
      supabase.rpc('resumen_ruta_evangelistica_distrital', { p_distrito_id: distritoId }),
      supabase.from('personas').select('id, nombres, apellidos, congregaciones!inner(distrito_id)').eq('congregaciones.distrito_id', distritoId).eq('estado_membresia', 'activo').order('nombres'),
      supabase.from('cargos_distritales').select('id, persona_id, nombres, apellidos, cargo, fecha_inicio, fecha_fin, observaciones').eq('distrito_id', distritoId).order('fecha_inicio', { ascending: false }),
      supabase.from('sepri_solicitudes_evento').select('id, congregacion_id, nombre_evento, fecha_evento, ubicacion, lugar, asistentes_esperados, poliza_contratada, estado, notas_distrital, descripcion, created_at, congregaciones(nombre)').eq('distrito_id', distritoId).order('created_at', { ascending: false }),
      supabase.rpc('resumen_sepri_distrital', { p_distrito_id: distritoId }),
    ])

    if (pastorResult.error || congregationResult.error || assignmentResult.error) {
      setError('No se pudo cargar la gestión pastoral distrital. Intenta nuevamente o contacta al administrador.')
    }

    const freshData = {
      pastors: pastorResult.data ?? [],
      congregations: congregationResult.data ?? [],
      assignments: assignmentResult.data ?? [],
      pastorProfileId: profileResult.data?.id ?? null,
      resumenPorCongregacion: new Map((resumenResult.data ?? []).map((row) => [row.congregacion_id, row])),
      licenciaHistorial: licenciaResult.data ?? [],
      formaciones: formacionResult.data ?? [],
      resumenEscuelaDominical: escuelaDominicalResult.data ?? [],
      resumenDamas: damasResult.data ?? [],
      centros: centrosResult.data ?? [],
      resumenCarcelaria: carcelariaResult.data ?? [],
      resumenReinsercion: reinsercionResult.data ?? [],
      liberadosSinAsignar: liberadosResult.data ?? [],
      resumenMusica: musicaResult.data ?? [],
      resumenArtistica: artisticaResult.data ?? [],
      resumenTeologica: teologicaResult.data ?? [],
      resumenConquistadores: conquistadoresResult.data ?? [],
      resumenObraSocial: obraSocialResult.data ?? [],
      resumenMisionJuvenil: misionJuvenilResult.data ?? [],
      resumenRedFamilias: redFamiliasResult.data ?? [],
      resumenRuta: rutaResult.data ?? [],
      personasDistrito: personasResult.data ?? [],
      cargosDistritales: cargosResult.data ?? [],
      sepriSolicitudes: sepriResult.data ?? [],
      sepriResumen: sepriResumenResult.data ?? [],
    }
    setPastors(freshData.pastors)
    setCongregations(freshData.congregations)
    setAssignments(freshData.assignments)
    setPastorProfileId(freshData.pastorProfileId)
    setResumenPorCongregacion(freshData.resumenPorCongregacion)
    setLicenciaHistorial(freshData.licenciaHistorial)
    setFormaciones(freshData.formaciones)
    setResumenEscuelaDominical(freshData.resumenEscuelaDominical)
    setResumenDamas(freshData.resumenDamas)
    setCentros(freshData.centros)
    setResumenCarcelaria(freshData.resumenCarcelaria)
    setResumenReinsercion(freshData.resumenReinsercion)
    setLiberadosSinAsignar(freshData.liberadosSinAsignar)
    setResumenMusica(freshData.resumenMusica)
    setResumenArtistica(freshData.resumenArtistica)
    setResumenTeologica(freshData.resumenTeologica)
    setResumenConquistadores(freshData.resumenConquistadores)
    setResumenObraSocial(freshData.resumenObraSocial)
    setResumenMisionJuvenil(freshData.resumenMisionJuvenil)
    setResumenRedFamilias(freshData.resumenRedFamilias)
    setResumenRuta(freshData.resumenRuta)
    setPersonasDistrito(freshData.personasDistrito)
    setCargosDistritales(freshData.cargosDistritales)
    setSepriSolicitudes(freshData.sepriSolicitudes)
    setSepriResumen(freshData.sepriResumen)
    setLoading(false)
    pastoralDistritalCache.set(cacheKey, freshData)
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
    setCargoForm({ persona_id: '', cargo: 'supervisor', fecha_inicio: hoyBogota() })
    load()
  }

  async function terminarCargo(item) {
    setSavingCargo(true)
    setError(null)
    const result = await supabase.from('cargos_distritales').update({ fecha_fin: hoyBogota() }).eq('id', item.id)
    setSavingCargo(false)
    if (result.error) { setError('No se pudo terminar el cargo.'); return }
    load()
  }

  async function resolverSepri(item, estado) {
    setError(null)
    const result = await supabase.from('sepri_solicitudes_evento').update({ estado, notas_distrital: sepriNotas[item.id]?.trim() || null }).eq('id', item.id)
    if (result.error) { setError(`No se pudo actualizar la solicitud: ${result.error.message}`); return }
    setNotice(`Solicitud ${estado === 'aprobado' ? 'aprobada' : 'rechazada'}.`)
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
    if (!distritoId) {
      setError('No se pudo determinar tu distrito. Recarga la página o cambia de rol desde el Sidebar e intenta de nuevo; si el problema sigue, contacta a soporte.')
      return
    }
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

  // Aparte del load() general -- depende de un rango de fechas que cambia
  // con el selector de trimestre, no tiene sentido recalcularlo en cada
  // accion no relacionada de esta pantalla.
  useEffect(() => {
    if (!distritoId || !isDistrictLeader) return
    setLoadingInformeTrimestral(true)
    supabase
      .rpc('resumen_informe_trimestral_distrital', { p_distrito_id: distritoId, ...limitesInformeTrimestral(informeAnio, informeTrimestre) })
      .then(({ data, error }) => { setLoadingInformeTrimestral(false); setResumenInformeTrimestral(error ? [] : data ?? []) })
  }, [distritoId, isDistrictLeader, informeAnio, informeTrimestre])

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
          <p className={`mt-3 text-2xl font-semibold ${stats.vacantCongregations ? 'text-warning' : ''}`}>{stats.vacantCongregations}</p>
          <p className="text-sm text-secondary mt-1">Sin pastor actual{stats.vacantCongregations ? ` · ${stats.vacantPercent}% del distrito` : ''}</p>
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
                  <th className="font-normal px-5 py-3"><span className="flex items-center gap-1.5">Madurez de la sede<InfoTip texto="Etapa de desarrollo de la congregación: Misión Nacional (recién plantada), Lugar de Predicación (en crecimiento) o Iglesia Local Constituida (ya establecida)." /></span></th>
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

      <ContinuidadPastoral vacantes={vacantesCongregaciones} />

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
        <ResumenComiteDistrital
          titulo="Escuela Dominical por congregación"
          descripcion="Comités administrados localmente, consolidado a nivel distrital."
          data={resumenEscuelaDominical}
          pageKey="escuelaDominical"
          emptyMessage="Aún no hay datos de Escuela Dominical en tu distrito."
          unidadLider="niños activos"
          paginate={paginate}
          metrics={[
            { key: 'clases_activas', label: 'Clases', kpi: true },
            { key: 'ninos_activos', label: 'Niños', kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'maestros_activos', label: 'Maestros', kpi: true },
            { key: 'lecciones_ultimo_mes', label: 'Lecciones (30d)', tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />

        <ResumenComiteDistrital
          titulo="Damas Dorcas por congregación"
          descripcion="Comités administrados localmente, consolidado a nivel distrital."
          data={resumenDamas}
          pageKey="damasDorcas"
          emptyMessage="Aún no hay datos de Damas Dorcas en tu distrito."
          unidadLider="beneficiarias activas"
          paginate={paginate}
          metrics={[
            { key: 'beneficiarias_activas', label: 'Beneficiarias', kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'actividades_ultimo_mes', label: 'Actividades (30d)', tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />
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

        <ResumenComiteDistrital
          icon={LockKeyhole}
          titulo="Obra Carcelaria por congregación"
          descripcion="Asistencia interna en los centros de reclusión, consolidado a nivel distrital."
          data={resumenCarcelaria}
          pageKey="carcelaria"
          emptyMessage="Aún no hay datos de Obra Carcelaria en tu distrito."
          unidadLider="internos activos"
          paginate={paginate}
          metrics={[
            { key: 'internos_activos', label: 'Internos activos', kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'bautizados', label: 'Bautizados', kpi: true },
            { key: 'sellados', label: 'Sellados', kpi: true },
            { key: 'delegados_habilitados', label: 'Delegados hábiles', tone: (v) => Number(v) === 0 ? 'text-danger' : '', info: 'Voluntarios ya autorizados para entrar a un centro de reclusión, no el total de personas que quisieran servir en Obra Carcelaria.' },
            { key: 'cultos_ultimo_mes', label: 'Cultos (30d)', tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />
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
            <p className="px-5 pb-4 text-xs text-secondary flex items-center gap-1.5">Eficacia de reinserción eclesial: {eficacia}% de los liberados con seguimiento concluido siguen activos en su congregación destino.<InfoTip texto="Se calcula solo sobre los casos que ya tuvieron seguimiento (activo, inactivo o con reincidencia); no cuenta los que siguen recién asignados y aún sin evaluar." /></p>
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
        <ResumenComiteDistrital
          titulo="Música por congregación"
          descripcion="FECP · Música y Alabanza, consolidado a nivel distrital."
          data={resumenMusica}
          pageKey="musica"
          emptyMessage="Aún no hay datos de Música en tu distrito."
          unidadLider="integrantes activos"
          paginate={paginate}
          metrics={[
            { key: 'grupos_activos', label: 'Grupos', kpi: true },
            { key: 'integrantes_activos', label: 'Integrantes', kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'sesiones_ultimo_mes', label: 'Sesiones (30d)', tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />

        <ResumenComiteDistrital
          titulo="Educación Artística por congregación"
          descripcion="FECP · Educación Artística, consolidado a nivel distrital."
          data={resumenArtistica}
          pageKey="artistica"
          emptyMessage="Aún no hay datos de Educación Artística en tu distrito."
          unidadLider="integrantes activos"
          paginate={paginate}
          metrics={[
            { key: 'grupos_activos', label: 'Grupos', kpi: true },
            { key: 'integrantes_activos', label: 'Integrantes', kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'sesiones_ultimo_mes', label: 'Sesiones (30d)', tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ResumenComiteDistrital
          titulo="Educación Teológica por congregación"
          descripcion="FECP · Educación Teológica, consolidado a nivel distrital."
          data={resumenTeologica}
          pageKey="teologica"
          emptyMessage="Aún no hay datos de Educación Teológica en tu distrito."
          unidadLider="integrantes activos"
          paginate={paginate}
          metrics={[
            { key: 'grupos_activos', label: 'Grupos', kpi: true },
            { key: 'integrantes_activos', label: 'Integrantes', kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'certificados', label: 'Certificados', kpi: true },
            { key: 'sesiones_ultimo_mes', label: 'Sesiones (30d)', tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />

        <ResumenComiteDistrital
          titulo="Conquistadores Pentecostales por congregación"
          descripcion="Jóvenes adultos de 18 a 40 años, consolidado a nivel distrital."
          data={resumenConquistadores}
          pageKey="conquistadores"
          emptyMessage="Aún no hay datos de Conquistadores Pentecostales en tu distrito."
          unidadLider="miembros activos"
          paginate={paginate}
          metrics={[
            { key: 'miembros_activos', label: 'Miembros', kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'lideres_activos', label: 'Líderes', kpi: true, tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
            { key: 'actividades_ultimo_mes', label: 'Actividades (30d)', tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />
      </div>

      <ResumenComiteDistrital
        titulo="Obra Social por congregación"
        descripcion="Asistencia socioeconómica a familias del censo, conectada con Red de Familias, consolidado a nivel distrital."
        data={resumenObraSocial}
        pageKey="obraSocial"
        emptyMessage="Aún no hay datos de Obra Social en tu distrito."
        unidadLider="casos abiertos"
        paginate={paginate}
        metrics={[
          { key: 'casos_abiertos', label: 'Casos abiertos', kpi: true, primary: true },
          { key: 'casos_resueltos', label: 'Casos resueltos', kpi: true },
          { key: 'ayudas_ultimo_mes', label: 'Ayudas (30d)' },
        ]}
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <ResumenComiteDistrital
          titulo="Misión Juvenil por congregación"
          descripcion="Colegios y universidades, consolidado a nivel distrital."
          data={resumenMisionJuvenil}
          pageKey="misionJuvenil"
          emptyMessage="Aún no hay datos de Misión Juvenil en tu distrito."
          unidadLider="estudiantes activos"
          paginate={paginate}
          metrics={[
            { key: 'estudiantes_activos', label: 'Estudiantes', kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'bautizados', label: 'Bautizados', kpi: true },
            { key: 'instituciones_impactadas', label: 'Instituciones', kpi: true },
            { key: 'lecciones_ultimo_mes', label: 'Lecciones (30d)', tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />

        <ResumenComiteDistrital
          titulo="Red de Familias por congregación"
          descripcion="Acompañamiento familiar y visitas domiciliarias, consolidado a nivel distrital."
          data={resumenRedFamilias}
          pageKey="redFamilias"
          emptyMessage="Aún no hay datos de Red de Familias en tu distrito."
          unidadLider="casos activos"
          paginate={paginate}
          metrics={[
            { key: 'casos_activos', label: 'Casos activos', kpi: true, primary: true },
            { key: 'casos_alta_prioridad', label: 'Prioridad alta', tone: (v) => Number(v) > 0 ? 'text-danger' : '' },
            { key: 'casos_cerrados_3m', label: 'Cerrados (3m)', kpi: true },
            { key: 'visitas_pendientes', label: 'Visitas pendientes', tone: (v) => Number(v) > 0 ? 'text-warning' : '' },
          ]}
        />
      </div>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-medium flex items-center gap-1.5">Informe trimestral por congregación<InfoTip texto="Bautizados, sellados, reconciliados y entregados de cada congregación del distrito, para el trimestre elegido. Reemplaza el reporte manual por WhatsApp/correo -- se calcula solo a partir de lo que cada congregación ya registra en SIGAP." /></h2>
            <p className="text-sm text-secondary mt-1">Ordena por indicador para ver qué congregación está en mayor crecimiento.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input-field" value={informeAnio} onChange={(event) => setInformeAnio(Number(event.target.value))}>{[informeTrimestralCerrado.anio, informeTrimestralCerrado.anio - 1, informeTrimestralCerrado.anio - 2].map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select className="input-field" value={informeTrimestre} onChange={(event) => setInformeTrimestre(Number(event.target.value))}>{Object.entries(ETIQUETA_TRIMESTRE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select className="input-field" value={informeSortKey} onChange={(event) => setInformeSortKey(event.target.value)}>
              <option value="bautizados_nuevos">Ordenar por Bautizados</option>
              <option value="sellados_nuevos">Ordenar por Sellados</option>
              <option value="reconciliados_actual">Ordenar por Reconciliados</option>
              <option value="entregados_nuevos">Ordenar por Entregados nuevos</option>
            </select>
            <button type="button" onClick={descargarInformeTrimestralDistrital} disabled={!filasInformeOrdenadas.length} className="btn-secondary"><Download className="w-4 h-4" /> Descargar PDF</button>
          </div>
        </div>
        {loadingInformeTrimestral ? (
          <p className="p-5 text-sm text-muted">Cargando informe trimestral...</p>
        ) : resumenInformeTrimestral.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aún no hay datos del informe trimestral en tu distrito.</p>
        ) : (() => {
          const filasOrdenadas = filasInformeOrdenadas
          const paged = paginate('informe', filasOrdenadas)
          return <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Bautizados</th><th className="font-normal px-4 py-2.5">Sellados</th><th className="font-normal px-4 py-2.5">Reconciliados</th><th className="font-normal px-4 py-2.5">Entregados</th></tr></thead>
              <tbody>
                {paged.pageItems.map((item, index) => (
                  <tr key={item.congregacion_id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{paged.page === 0 && index === 0 && <span className="text-[10px] uppercase tracking-wide text-success mr-1.5">●</span>}{item.nombre}</td>
                    <td className="px-4 py-2.5">{item.bautizados_total_actual} <span className="text-xs text-success">(+{item.bautizados_nuevos})</span></td>
                    <td className="px-4 py-2.5">{item.sellados_total_actual} <span className="text-xs text-success">(+{item.sellados_nuevos})</span></td>
                    <td className="px-4 py-2.5">{item.reconciliados_actual} <span className="text-xs text-muted">({item.reconciliados_anterior} antes)</span></td>
                    <td className="px-4 py-2.5">{item.entregados_total_actual} <span className="text-xs text-success">(+{item.entregados_nuevos} nuevos)</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={filasOrdenadas.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
          </>
        })()}
      </section>

      <ResumenComiteDistrital
        titulo="Ruta Evangelística por congregación"
        infoTitulo="Estaciones en orden: Uno Más (contacto inicial) → BIS → REFAM → ESFOB → Discipulado. Cada columna muestra cuántas personas están activas en esa etapa; el bautismo es el resultado final de la ruta."
        descripcion="Personas activas en cada estación, consolidado a nivel distrital."
        data={resumenRuta}
        pageKey="ruta"
        emptyMessage="Aún no hay datos de la Ruta Evangelística en tu distrito."
        unidadLider="bautismos en los últimos 3 meses"
        paginate={paginate}
        metrics={[
          { key: 'uno_mas', label: 'Uno Más', kpi: true },
          { key: 'bis', label: 'BIS', kpi: true },
          { key: 'refam', label: 'REFAM', kpi: true },
          { key: 'esfob', label: 'ESFOB' },
          { key: 'discipulado', label: 'Discipulado' },
          { key: 'bautismos_3m', label: 'Bautismos (3m)', kpi: true, primary: true, tone: (v) => Number(v) > 0 ? 'text-success font-medium' : '', info: 'Personas que completaron la Ruta Evangelística y se bautizaron en los últimos 3 meses. Es el número que mide si la ruta realmente está dando fruto.' },
        ]}
      />

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium flex items-center gap-1.5">SEPRI — Solicitudes de eventos<InfoTip texto="Toda actividad fuera del templo debe presentarse con 30 días de anticipación para tu aprobación. La columna 'Anticipación' te muestra de un vistazo si la congregación cumplió ese plazo." /></h2>
          <p className="text-sm text-secondary mt-1">Aprobación de eventos de las congregaciones de tu distrito.</p>
        </div>
        {sepriSolicitudes.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aún no hay solicitudes SEPRI en tu distrito.</p>
        ) : (() => {
          const paged = paginate('sepriSolicitudes', sepriSolicitudes)
          return <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Evento</th><th className="font-normal px-4 py-2.5">Fecha</th><th className="font-normal px-4 py-2.5">Anticipación</th><th className="font-normal px-4 py-2.5">Estado</th><th className="font-normal px-4 py-2.5"></th></tr></thead>
              <tbody>
                {paged.pageItems.map((item) => {
                  const evento = new Date(`${item.fecha_evento}T00:00:00Z`)
                  const creado = new Date(item.created_at)
                  const dias = Math.round((evento.getTime() - Date.UTC(creado.getUTCFullYear(), creado.getUTCMonth(), creado.getUTCDate())) / 86400000)
                  return (
                    <tr key={item.id} className="border-t border-border align-top">
                      <td className="px-4 py-2.5 font-medium">{item.congregaciones?.nombre}</td>
                      <td className="px-4 py-2.5">{item.nombre_evento}<p className="text-xs text-secondary">{item.ubicacion === 'dentro_templo' ? 'Dentro del templo' : 'Fuera del templo'}{item.lugar ? ` · ${item.lugar}` : ''}{item.poliza_contratada ? ' · Con póliza' : ''}</p></td>
                      <td className="px-4 py-2.5 text-secondary">{item.fecha_evento}</td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${dias >= 30 ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>{dias} días</span></td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${item.estado === 'pendiente' ? 'bg-warning-bg text-warning' : item.estado === 'aprobado' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>{item.estado === 'pendiente' ? 'Pendiente' : item.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}</span></td>
                      <td className="px-4 py-2.5">
                        {item.estado === 'pendiente' ? (
                          <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <input className="input-field text-xs py-1" placeholder="Notas (opcional)" value={sepriNotas[item.id] ?? ''} onChange={(event) => setSepriNotas({ ...sepriNotas, [item.id]: event.target.value })} />
                            <div className="flex gap-1.5">
                              <button type="button" className="btn-primary text-xs py-1 px-2 flex-1" onClick={() => resolverSepri(item, 'aprobado')}>Aprobar</button>
                              <button type="button" className="btn-secondary text-xs py-1 px-2 flex-1" onClick={() => resolverSepri(item, 'rechazado')}>Rechazar</button>
                            </div>
                          </div>
                        ) : item.notas_distrital ? <p className="text-xs text-secondary max-w-[180px]">{item.notas_distrital}</p> : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={sepriSolicitudes.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="solicitudes" /></div>
          </>
        })()}
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium flex items-center gap-1.5">SEPRI por congregación<InfoTip texto="Cumplimiento del plazo de 30 días medido sobre las solicitudes de los últimos 12 meses en cada congregación. Un número bajo frente al total de solicitudes es una señal para reforzar la planeación con anticipación." /></h2>
          <p className="text-sm text-secondary mt-1">Consolidado de gestión de riesgo por congregación de tu distrito.</p>
        </div>
        {sepriResumen.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aún no hay datos de SEPRI en tu distrito.</p>
        ) : (() => {
          const paged = paginate('sepri', sepriResumen)
          return <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Pendientes</th><th className="font-normal px-4 py-2.5">Aprobadas (12m)</th><th className="font-normal px-4 py-2.5">A tiempo (12m)</th><th className="font-normal px-4 py-2.5">Delegados activos</th></tr></thead>
              <tbody>
                {paged.pageItems.map((item) => (
                  <tr key={item.congregacion_id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{item.congregacion_nombre}</td>
                    <td className={`px-4 py-2.5 ${Number(item.solicitudes_pendientes) > 0 ? 'text-warning' : ''}`}>{item.solicitudes_pendientes}</td>
                    <td className="px-4 py-2.5">{item.solicitudes_aprobadas_12m}</td>
                    <td className="px-4 py-2.5">{item.solicitudes_a_tiempo_12m}</td>
                    <td className={`px-4 py-2.5 ${Number(item.delegados_activos) === 0 ? 'text-danger' : ''}`}>{item.delegados_activos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={sepriResumen.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label="congregaciones" /></div>
          </>
        })()}
      </section>

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
              <span className="flex items-center gap-1">Tarjeta de predicador (obreros sin licencia)<InfoTip texto="Fecha de expedición de la credencial que autoriza a predicar a un obrero que todavía no tiene licencia ministerial." /></span>
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
          <h2 className="font-medium flex items-center gap-1.5">Trasladar pastor<InfoTip texto="Mueve al pastor a la nueva congregación de inmediato: la congregación anterior queda vacante y el pastor pasa a figurar en la nueva." /></h2>

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
