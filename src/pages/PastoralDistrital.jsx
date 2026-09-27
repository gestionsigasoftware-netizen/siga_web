import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRightLeft, Download, Plus, Search, PencilLine, Users, Building2, UserRoundCheck, CircleDashed, MapPinned, GraduationCap, BookOpen, Trash2, LockKeyhole, ClipboardCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { hoyBogota } from "../lib/fechaBogota";
import { useMiRol } from '../hooks/useMiRol'
import Pager from '../components/Pager'
import InfoTip from '../components/InfoTip'
import Toast from '../components/Toast'
import { descargarPdf } from '../lib/reportExport'
import { ETIQUETA_TRIMESTRE, limitesInformeTrimestral, trimestreCerradoMasReciente } from '../lib/trimestre'
import { CARGO_DISTRITAL_LABELS } from '../lib/cargosDistritales'
import i18n from '../i18n'

const pastoralDistritalCache = new Map()

const TODAY = hoyBogota()
const CARGO_OPTIONS = ['Pastor local', 'Pastor asociado', 'Pastor auxiliar', 'Coordinador de congregación']
const LICENCIA_SIGUIENTE = { obrero: 'local', local: 'general', general: 'ordenacion', ordenacion: null }
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

const formatDate = (value) => {
  if (!value) return i18n.t('pastoralDistrital.sinFecha')
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'pt' ? 'pt-BR' : 'es-CO'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
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
  const { t } = useTranslation()
  const [resumenes, setResumenes] = useState({})
  const [errores, setErrores] = useState({})

  useEffect(() => {
    let active = true
    vacantes.forEach((congregacion) => {
      supabase.rpc('resumen_continuidad_congregacion', { p_congregacion_id: congregacion.id }).then(({ data, error }) => {
        if (!active) return
        if (error) { setErrores((current) => ({ ...current, [congregacion.id]: true })); return }
        if (!data?.[0]) return
        setResumenes((current) => ({ ...current, [congregacion.id]: data[0] }))
      })
    })
    return () => { active = false }
  }, [vacantes])

  if (vacantes.length === 0) return null

  return (
    <section className="card overflow-hidden">
      <div className="p-5 border-b border-border">
        <h2 className="font-medium flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-accent" /> {t('pastoralDistrital.continuidadTitulo')}</h2>
        <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.continuidadDescripcion')}</p>
      </div>
      <div className="divide-y divide-border">
        {vacantes.map((congregacion) => {
          const resumen = resumenes[congregacion.id]
          return (
            <div key={congregacion.id} className="p-4">
              <p className="text-sm font-medium">{congregacion.nombre}</p>
              {errores[congregacion.id] ? (
                <p className="text-xs text-danger mt-1">{t('pastoralDistrital.continuidadErrorCarga')}</p>
              ) : !resumen ? (
                <p className="text-xs text-muted mt-1">{t('pastoralDistrital.continuidadCargando')}</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${Number(resumen.seguimientos_pendientes) > 0 ? 'bg-warning-bg text-warning' : 'bg-surface-1 text-muted'}`}>{t('pastoralDistrital.continuidadSeguimientos', { count: resumen.seguimientos_pendientes })}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${Number(resumen.casos_red_familias_activos) > 0 ? 'bg-warning-bg text-warning' : 'bg-surface-1 text-muted'}`}>{t('pastoralDistrital.continuidadCasosRedFamilias', { count: resumen.casos_red_familias_activos })}</span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${Number(resumen.cargos_obligatorios_vacantes) > 0 ? 'bg-danger-bg text-danger' : 'bg-surface-1 text-muted'}`}>{t('pastoralDistrital.continuidadCargosVacantes', { count: resumen.cargos_obligatorios_vacantes })}<InfoTip texto={t('pastoralDistrital.infoCargosVacantes')} /></span>
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
  const { t } = useTranslation()
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
          <p className="px-5 pt-4 text-sm text-secondary">{t('pastoralDistrital.liderConMetrica', { nombre: lider.nombre, valor: lider[primary.key], unidad: unidadLider })}</p>
        )}
        <div className="px-5 pt-4 flex justify-end">
          <select className="input-field text-xs" value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
            {metrics.map((metric) => <option key={metric.key} value={metric.key}>{t('pastoralDistrital.ordenarPorGenerico', { label: metric.label })}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted bg-surface-1">
                <th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thCongregacion')}</th>
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
        <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={sorted.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label={t('pastoralDistrital.etiquetaPaginadorCongregaciones')} /></div>
        </>
      })()}
    </section>
  )
}

export default function PastoralDistrital() {
  const { t } = useTranslation()
  const CARGO_LABELS = t('pastoralDistrital.cargoLabels', { returnObjects: true })
  const LICENCIA_LABELS = t('pastoralDistrital.licencias', { returnObjects: true })
  const TIPO_FORMACION_LABELS = t('pastoralDistrital.tiposFormacion', { returnObjects: true })
  const MADUREZ_LABELS = t('pastoralDistrital.madurez', { returnObjects: true })
  const TIPO_CENTRO_LABELS = t('pastoralDistrital.tiposCentro', { returnObjects: true })
  const ESTADO_REINSERCION_LABELS = t('pastoralDistrital.estadosReinsercion', { returnObjects: true })
  const INFORME_SORT_LABELS = t('pastoralDistrital.informeSort', { returnObjects: true })
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
    const distritoLabel = rolPrincipal?.distritos?.numero ? `${t('pastoralDistrital.distritoGenerico')} ${rolPrincipal.distritos.numero}` : t('pastoralDistrital.distritoGenerico')
    const sumar = (campo) => filasInformeOrdenadas.reduce((total, item) => total + Number(item[campo] || 0), 0)
    await descargarPdf({
      filename: `informe-trimestral-distrital-${informeAnio}-t${informeTrimestre}.pdf`,
      titulo: `${t('pastoralDistrital.informeTitulo')} · ${etiqueta}`,
      orientacion: 'landscape',
      meta: [distritoLabel, t('pastoralDistrital.trimestrePrefix', { etiqueta }), t('pastoralDistrital.ordenadoPorPrefix', { criterio: INFORME_SORT_LABELS[informeSortKey] })],
      resumen: {
        kpis: [
          { label: `${t('pastoralDistrital.thBautizados')} nuevos (distrito)`, value: sumar('bautizados_nuevos') },
          { label: `${t('pastoralDistrital.thSellados')} nuevos (distrito)`, value: sumar('sellados_nuevos') },
          { label: `${t('pastoralDistrital.thReconciliados')} (distrito)`, value: sumar('reconciliados_actual') },
          { label: `${t('pastoralDistrital.thEntregados')} nuevos (distrito)`, value: sumar('entregados_nuevos') },
        ],
      },
      headers: [t('pastoralDistrital.thCongregacion'), t('pastoralDistrital.thBautizados'), t('pastoralDistrital.colMasNuevos'), t('pastoralDistrital.thSellados'), t('pastoralDistrital.colMasNuevos'), t('pastoralDistrital.thReconciliados'), t('pastoralDistrital.colAntes'), t('pastoralDistrital.thEntregados'), t('pastoralDistrital.colMasNuevos')],
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
        .select('id, pastor_id, licencia_anterior, licencia_nueva, fecha, observaciones, tipo, pastores!inner(distrito_id)')
        .eq('pastores.distrito_id', distritoId)
        .order('fecha', { ascending: false }),
      supabase
        .from('formacion_pastoral')
        .select('id, pastor_id, tipo, tipo_otro, nombre, institucion, fecha, observaciones, pastores!inner(distrito_id)')
        .eq('pastores.distrito_id', distritoId)
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
      supabase.from('personas').select('id, nombres, apellidos, congregaciones!personas_congregacion_id_fkey!inner(distrito_id)').eq('congregaciones.distrito_id', distritoId).eq('estado_membresia', 'activo').order('nombres'),
      supabase.from('cargos_distritales').select('id, persona_id, nombres, apellidos, cargo, fecha_inicio, fecha_fin, observaciones').eq('distrito_id', distritoId).order('fecha_inicio', { ascending: false }),
      supabase.from('sepri_solicitudes_evento').select('id, congregacion_id, nombre_evento, fecha_evento, ubicacion, lugar, asistentes_esperados, poliza_contratada, estado, notas_distrital, descripcion, created_at, congregaciones(nombre)').eq('distrito_id', distritoId).order('created_at', { ascending: false }),
      supabase.rpc('resumen_sepri_distrital', { p_distrito_id: distritoId }),
    ])

    if (pastorResult.error || congregationResult.error || assignmentResult.error) {
      setError(t('pastoralDistrital.errores.cargar'))
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
      setError(result.error.code === '23505' ? t('pastoralDistrital.errores.cargoOcupado') : t('pastoralDistrital.errores.asignarCargo'))
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
    if (result.error) { setError(t('pastoralDistrital.errores.terminarCargo')); return }
    load()
  }

  async function resolverSepri(item, estado) {
    setError(null)
    const result = await supabase.from('sepri_solicitudes_evento').update({ estado, notas_distrital: sepriNotas[item.id]?.trim() || null }).eq('id', item.id)
    if (result.error) { setError(t('pastoralDistrital.errores.actualizarSolicitud', { mensaje: result.error.message })); return }
    setNotice(estado === 'aprobado' ? t('pastoralDistrital.notices.solicitudAprobada') : t('pastoralDistrital.notices.solicitudRechazada'))
    load()
  }

  function resetCentroForm() { setEditingCentroId(null); setCentroForm(EMPTY_CENTRO) }
  function editCentro(centro) {
    setEditingCentroId(centro.id)
    setCentroForm({ nombre: centro.nombre, tipo: centro.tipo, ciudad: centro.ciudad || '', direccion: centro.direccion || '' })
  }

  async function saveCentro(event) {
    event.preventDefault()
    if (!distritoId || !centroForm.nombre.trim()) { setError(t('pastoralDistrital.errores.nombreCentroObligatorio')); return }
    setSavingCentro(true)
    setError(null)
    setNotice(null)
    const payload = { nombre: centroForm.nombre.trim(), tipo: centroForm.tipo, ciudad: centroForm.ciudad.trim() || null, direccion: centroForm.direccion.trim() || null }
    const result = editingCentroId
      ? await supabase.from('centros_reclusion').update(payload).eq('id', editingCentroId)
      : await supabase.from('centros_reclusion').insert({ ...payload, distrito_id: distritoId })
    setSavingCentro(false)
    if (result.error) { setError(t('pastoralDistrital.errores.guardarCentro', { mensaje: result.error.message })); return }
    setNotice(editingCentroId ? t('pastoralDistrital.notices.centroActualizado') : t('pastoralDistrital.notices.centroCreado'))
    resetCentroForm()
    await load()
  }

  async function asignarReinsercion(event) {
    event.preventDefault()
    if (!reinsercionForm.interno_id || !reinsercionForm.congregacion_destino) { setError(t('pastoralDistrital.errores.seleccionaInternoCongregacion')); return }
    setSavingReinsercion(true)
    setError(null)
    setNotice(null)
    const { error: asignarError } = await supabase.rpc('asignar_reinsercion', {
      p_interno_id: reinsercionForm.interno_id,
      p_congregacion_destino: reinsercionForm.congregacion_destino,
    })
    setSavingReinsercion(false)
    if (asignarError) { setError(t('pastoralDistrital.errores.asignarReinsercion', { mensaje: asignarError.message })); return }
    setNotice(t('pastoralDistrital.notices.reinsercionAsignada'))
    setReinsercionForm({ interno_id: '', congregacion_destino: '' })
    await load()
  }

  async function createCongregation(event) {
    event.preventDefault()
    if (!distritoId) {
      setError(t('pastoralDistrital.errores.sinDistrito'))
      return
    }
    if (!newCongregation.nombre.trim() || !newCongregation.pastor_nombres.trim() || !newCongregation.pastor_apellidos.trim() || !newCongregation.pastor_email.trim()) {
      setError(t('pastoralDistrital.errores.completaCongregacionPastorCorreo'))
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
      if (createError) throw new Error(t('pastoralDistrital.errores.crearCongregacion', { mensaje: createError.message }))
      const [{ congregacion_id: newCongregationId, persona_id: newPersonId }] = created

      const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invitar-usuario', {
        body: { personId: newPersonId, profileId: pastorProfileId, congregacionId: newCongregationId, email: newCongregation.pastor_email.trim() },
      })
      if (inviteError) {
        setNotice(t('pastoralDistrital.notices.invitacionNoEnviadaCongregacion'))
      } else if (!inviteData?.ok) {
        setNotice(t('pastoralDistrital.notices.invitacionNoConfirmadaCongregacion'))
      } else {
        setNotice(inviteData.invitationSent ? t('pastoralDistrital.notices.congregacionCreadaInvitacionEnviada') : t('pastoralDistrital.notices.congregacionCreadaCuentaVinculada'))
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
      .then(({ data, error }) => {
        setLoadingInformeTrimestral(false)
        if (error) { setError(t('pastoralDistrital.errores.cargarInformeTrimestral')); setResumenInformeTrimestral([]); return }
        setResumenInformeTrimestral(data ?? [])
      })
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
      setError(t('pastoralDistrital.errores.sinDistritoUsuario'))
      return
    }

    if (!form.nombres.trim() || !form.apellidos.trim() || !form.congregacion_id) {
      setError(t('pastoralDistrital.errores.completaNombresApellidosCongregacion'))
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
          throw new Error(t('pastoralDistrital.errores.actualizarPastor', { mensaje: pastorError.message }))
        }

        if (form.licencia !== licenciaOriginalRef.current) {
          const { error: licenciaError } = await supabase.rpc('corregir_licencia_pastor', {
            p_pastor_id: editingPastorId,
            p_licencia: form.licencia,
          })
          if (licenciaError) {
            throw new Error(t('pastoralDistrital.errores.corregirLicencia', { mensaje: licenciaError.message }))
          }
        }

        if (congregacionCorreccionCatalogoId) {
          const { error: nombreError } = await supabase.rpc('corregir_nombre_congregacion', {
            p_congregacion_id: form.congregacion_id,
            p_catalogo_id: congregacionCorreccionCatalogoId,
          })
          if (nombreError) {
            throw new Error(t('pastoralDistrital.errores.corregirNombreCongregacion', { mensaje: nombreError.message }))
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
          throw new Error(t('pastoralDistrital.errores.guardarAsignacionVigente', { mensaje: assignmentError.message }))
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
            throw new Error(t('pastoralDistrital.errores.moverAsignacion', { mensaje: transferError.message }))
          }
        }

        await supabase
          .from('congregaciones')
          .update({ pastor_id: editingPastorId, pastor_nombre: nombreCompleto })
          .eq('id', form.congregacion_id)

        setNotice(t('pastoralDistrital.notices.pastorActualizado'))
      } else {
        if (!form.email.trim()) {
          throw new Error(t('pastoralDistrital.errores.correoObligatorio'))
        }

        const { data: created, error: registerError } = await supabase.rpc('registrar_pastor_con_acceso', {
          p_congregacion_id: form.congregacion_id,
          p_pastor_nombres: form.nombres.trim(),
          p_pastor_apellidos: form.apellidos.trim(),
          p_pastor_telefono: form.telefono.trim() || null,
          p_cargo: form.cargo,
        })
        if (registerError) throw new Error(t('pastoralDistrital.errores.registrarPastor', { mensaje: registerError.message }))
        const [{ persona_id: newPersonId }] = created

        const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invitar-usuario', {
          body: { personId: newPersonId, profileId: pastorProfileId, congregacionId: form.congregacion_id, email: form.email.trim() },
        })
        if (inviteError) {
          setNotice(t('pastoralDistrital.notices.invitacionNoEnviadaPastor'))
        } else if (!inviteData?.ok) {
          setNotice(t('pastoralDistrital.notices.invitacionNoConfirmadaPastor'))
        } else {
          setNotice(inviteData.invitationSent ? t('pastoralDistrital.notices.pastorRegistradoInvitacionEnviada') : t('pastoralDistrital.notices.pastorRegistradoCuentaVinculada'))
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
      setError(t('pastoralDistrital.errores.seleccionaPastorCongregacion'))
      return
    }

    if (transferForm.congregacion_id === activeByPastor.get(transferForm.pastor_id)?.congregacion_id) {
      setError(t('pastoralDistrital.errores.yaAsignado'))
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
      setNotice(t('pastoralDistrital.notices.trasladoRegistrado'))
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
      setError(t('pastoralDistrital.errores.seleccionaPastorFinalizar'))
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
      setNotice(t('pastoralDistrital.notices.asignacionFinalizada'))
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
      setError(t('pastoralDistrital.errores.seleccionaPastorAscender'))
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
      setNotice(t('pastoralDistrital.notices.ascensoRegistrado', { licencia: LICENCIA_LABELS[nuevaLicencia] || nuevaLicencia }))
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
      setError(t('pastoralDistrital.errores.seleccionaPastorFormacion'))
      return
    }
    if (formacionForm.tipo === 'otro' && !formacionForm.tipo_otro.trim()) {
      setError(t('pastoralDistrital.errores.especificaTipoOtro'))
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
      setNotice(t('pastoralDistrital.notices.preparacionRegistrada'))
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
      setError(t('pastoralDistrital.errores.actualizarMadurez'))
      return
    }
    setNotice(t('pastoralDistrital.notices.madurezActualizada'))
    await load()
  }

  async function deleteFormacion(id) {
    setError(null)
    setNotice(null)
    const { error: deleteError } = await supabase.from('formacion_pastoral').delete().eq('id', id)
    if (deleteError) {
      setError(t('pastoralDistrital.errores.eliminarFormacion'))
      return
    }
    setNotice(t('pastoralDistrital.notices.preparacionEliminada'))
    await load()
  }

  if (roleLoading || loading) {
    return <div className="module-loading" role="status"><span className="loading-dot" />{t('pastoralDistrital.cargando')}</div>
  }

  if (!isDistrictLeader) {
    return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{t('pastoralDistrital.soloDistrital')}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">{t('pastoralDistrital.eyebrow')}</p>
        <h1 className="text-2xl font-semibold">{t('pastoralDistrital.titulo')}</h1>
        <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.subtitulo')}</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      <Toast>{notice}</Toast>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>{t('pastoralDistrital.statTotal')}</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{stats.totalPastors}</p>
          <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.statTotalDetalle')}</p>
        </div>

        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>{t('pastoralDistrital.statActivos')}</span>
            <UserRoundCheck className="w-4 h-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{stats.activePastorCount}</p>
          <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.statActivosDetalle')}</p>
        </div>

        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>{t('pastoralDistrital.statCongregaciones')}</span>
            <Building2 className="w-4 h-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{stats.congregationsWithPastors}</p>
          <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.statCongregacionesDetalle')}</p>
        </div>

        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>{t('pastoralDistrital.statVacantes')}</span>
            <CircleDashed className="w-4 h-4" />
          </div>
          <p className={`mt-3 text-2xl font-semibold ${stats.vacantCongregations ? 'text-warning' : ''}`}>{stats.vacantCongregations}</p>
          <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.statVacantesSinPastor')}{stats.vacantCongregations ? t('pastoralDistrital.statVacantesPorcentaje', { porcentaje: stats.vacantPercent }) : ''}</p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">{t('pastoralDistrital.congregacionesTitulo')}</h2>
          <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.congregacionesDescripcion')}</p>
        </div>
        {congregations.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t('pastoralDistrital.congregacionesSinRegistros')}</p>
        ) : (() => {
          const paged = paginate('congregations', congregations)
          return <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="font-normal px-5 py-3">{t('pastoralDistrital.thCongregacion')}</th>
                  <th className="font-normal px-5 py-3">{t('pastoralDistrital.thCiudad')}</th>
                  <th className="font-normal px-5 py-3"><span className="flex items-center gap-1.5">{t('pastoralDistrital.thMadurezSede')}<InfoTip texto={t('pastoralDistrital.infoMadurezSede')} /></span></th>
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
          <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={congregations.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label={t('pastoralDistrital.etiquetaPaginadorCongregaciones')} /></div>
          </>
        })()}
      </section>

      <ContinuidadPastoral vacantes={vacantesCongregaciones} />

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">{t('pastoralDistrital.directivaTitulo')}</h2>
          <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.directivaDescripcion')}</p>
        </div>
        {cargosDistritales.filter((item) => !item.fecha_fin).length === 0 ? (
          <p className="p-5 text-sm text-muted">{t('pastoralDistrital.directivaSinCargos')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="font-normal px-5 py-3">{t('pastoralDistrital.thCargo')}</th>
                  <th className="font-normal px-5 py-3">{t('pastoralDistrital.thPersona')}</th>
                  <th className="font-normal px-5 py-3">{t('pastoralDistrital.thDesde')}</th>
                  <th className="font-normal px-5 py-3 text-right">{t('pastoralDistrital.thAcciones')}</th>
                </tr>
              </thead>
              <tbody>
                {cargosDistritales.filter((item) => !item.fecha_fin).map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{CARGO_DISTRITAL_LABELS[item.cargo] || item.cargo}</td>
                    <td className="px-5 py-3">{item.nombres} {item.apellidos}</td>
                    <td className="px-5 py-3 text-secondary">{item.fecha_inicio}</td>
                    <td className="px-5 py-3 text-right"><button type="button" disabled={savingCargo} className="text-danger text-xs" onClick={() => terminarCargo(item)}>{t('pastoralDistrital.botonTerminarPeriodo')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form onSubmit={saveCargo} className="p-5 border-t border-border grid sm:grid-cols-4 gap-2 items-end">
          <div className="sm:col-span-4">
            <p className="text-sm font-medium">{t('pastoralDistrital.directivaFormTitulo')}</p>
            <p className="text-xs text-secondary mt-1">{t('pastoralDistrital.directivaFormDescripcion')}</p>
          </div>
          <select required className="input-field" value={cargoForm.persona_id} onChange={(event) => setCargoForm({ ...cargoForm, persona_id: event.target.value })}>
            <option value="">{t('pastoralDistrital.opcionPersonaSeleccionar')}</option>
            {personasDistrito.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
          <select className="input-field" value={cargoForm.cargo} onChange={(event) => setCargoForm({ ...cargoForm, cargo: event.target.value })}>
            {Object.entries(CARGO_DISTRITAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input required type="date" className="input-field" value={cargoForm.fecha_inicio} onChange={(event) => setCargoForm({ ...cargoForm, fecha_inicio: event.target.value })} />
          <button disabled={savingCargo} className="btn-secondary justify-center"><Plus className="w-4 h-4" />{savingCargo ? t('pastoralDistrital.botonGuardando') : t('pastoralDistrital.botonAsignarCargo')}</button>
        </form>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <ResumenComiteDistrital
          titulo={t('pastoralDistrital.comiteEscuelaDominicalTitulo')}
          descripcion={t('pastoralDistrital.comiteDescripcionGenerica')}
          data={resumenEscuelaDominical}
          pageKey="escuelaDominical"
          emptyMessage={t('pastoralDistrital.comiteEscuelaDominicalEmpty')}
          unidadLider={t('pastoralDistrital.unidadNinosActivos')}
          paginate={paginate}
          metrics={[
            { key: 'clases_activas', label: t('pastoralDistrital.metricClases'), kpi: true },
            { key: 'ninos_activos', label: t('pastoralDistrital.metricNinos'), kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'maestros_activos', label: t('pastoralDistrital.metricMaestros'), kpi: true },
            { key: 'lecciones_ultimo_mes', label: t('pastoralDistrital.metricLecciones30d'), tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />

        <ResumenComiteDistrital
          titulo={t('pastoralDistrital.comiteDamasTitulo')}
          descripcion={t('pastoralDistrital.comiteDescripcionGenerica')}
          data={resumenDamas}
          pageKey="damasDorcas"
          emptyMessage={t('pastoralDistrital.comiteDamasEmpty')}
          unidadLider={t('pastoralDistrital.unidadBeneficiariasActivas')}
          paginate={paginate}
          metrics={[
            { key: 'beneficiarias_activas', label: t('pastoralDistrital.metricBeneficiarias'), kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'actividades_ultimo_mes', label: t('pastoralDistrital.metricActividades30d'), tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium flex items-center gap-2"><LockKeyhole className="w-4 h-4 text-accent" />{t('pastoralDistrital.centrosTitulo')}</h2>
            <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.centrosDescripcion')}</p>
          </div>
          {centros.length === 0 ? (
            <p className="p-5 text-sm text-muted">{t('pastoralDistrital.centrosSinRegistros')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thNombre')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thTipo')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thCiudad')}</th><th className="font-normal px-4 py-2.5 text-right">{t('pastoralDistrital.thAcciones')}</th></tr></thead>
                <tbody>
                  {centros.map((centro) => (
                    <tr key={centro.id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{centro.nombre}</td>
                      <td className="px-4 py-2.5 text-secondary">{TIPO_CENTRO_LABELS[centro.tipo]}</td>
                      <td className="px-4 py-2.5 text-secondary">{centro.ciudad || '—'}</td>
                      <td className="px-4 py-2.5 text-right"><button type="button" className="text-accent text-xs" onClick={() => editCentro(centro)}>{t('pastoralDistrital.botonEditar')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form onSubmit={saveCentro} className="p-5 border-t border-border grid sm:grid-cols-2 gap-2">
            <div className="sm:col-span-2 flex items-center justify-between">
              <p className="text-sm font-medium">{editingCentroId ? t('pastoralDistrital.centrosFormTituloEditar') : t('pastoralDistrital.centrosFormTituloNuevo')}</p>
              {editingCentroId && <button type="button" className="text-xs text-secondary" onClick={resetCentroForm}>{t('pastoralDistrital.botonCancelar')}</button>}
            </div>
            <input required className="input-field" placeholder={t('pastoralDistrital.placeholderNombreCentro')} value={centroForm.nombre} onChange={(event) => setCentroForm({ ...centroForm, nombre: event.target.value })} />
            <select className="input-field" value={centroForm.tipo} onChange={(event) => setCentroForm({ ...centroForm, tipo: event.target.value })}>
              {Object.entries(TIPO_CENTRO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input className="input-field" placeholder={t('pastoralDistrital.placeholderCiudadOpcional')} value={centroForm.ciudad} onChange={(event) => setCentroForm({ ...centroForm, ciudad: event.target.value })} />
            <input className="input-field" placeholder={t('pastoralDistrital.placeholderDireccionOpcional')} value={centroForm.direccion} onChange={(event) => setCentroForm({ ...centroForm, direccion: event.target.value })} />
            <button disabled={savingCentro} className="btn-primary justify-center sm:col-span-2"><Plus className="w-4 h-4" /> {editingCentroId ? t('pastoralDistrital.botonGuardarCambios') : t('pastoralDistrital.botonCrearCentro')}</button>
          </form>
        </section>

        <ResumenComiteDistrital
          icon={LockKeyhole}
          titulo={t('pastoralDistrital.comiteCarcelariaTitulo')}
          descripcion={t('pastoralDistrital.comiteCarcelariaDescripcion')}
          data={resumenCarcelaria}
          pageKey="carcelaria"
          emptyMessage={t('pastoralDistrital.comiteCarcelariaEmpty')}
          unidadLider={t('pastoralDistrital.unidadInternosActivos')}
          paginate={paginate}
          metrics={[
            { key: 'internos_activos', label: t('pastoralDistrital.metricInternosActivos'), kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'bautizados', label: t('pastoralDistrital.metricBautizados'), kpi: true },
            { key: 'sellados', label: t('pastoralDistrital.metricSellados'), kpi: true },
            { key: 'delegados_habilitados', label: t('pastoralDistrital.metricDelegadosHabiles'), tone: (v) => Number(v) === 0 ? 'text-danger' : '', info: t('pastoralDistrital.infoDelegadosHabiles') },
            { key: 'cultos_ultimo_mes', label: t('pastoralDistrital.metricCultos30d'), tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />
      </div>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">{t('pastoralDistrital.reinsercionTitulo')}</h2>
          <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.reinsercionDescripcion')}</p>
        </div>
        {resumenReinsercion.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t('pastoralDistrital.reinsercionSinCasos')}</p>
        ) : (() => {
          const paged = paginate('reinsercion', resumenReinsercion)
          return <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thInterno')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thOrigen')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thDestino')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thFecha')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thEstado')}</th></tr></thead>
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
          <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={resumenReinsercion.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label={t('pastoralDistrital.etiquetaPaginadorCasos')} /></div>
          </>
        })()}
        {resumenReinsercion.length > 0 && (() => {
          const activos = resumenReinsercion.filter((item) => ['activo', 'inactivo', 'reincidencia'].includes(item.estado))
          const eficacia = activos.length ? Math.round((activos.filter((item) => item.estado === 'activo').length / activos.length) * 100) : null
          return eficacia !== null && (
            <p className="px-5 pb-4 text-xs text-secondary flex items-center gap-1.5">{t('pastoralDistrital.reinsercionEficacia', { eficacia })}<InfoTip texto={t('pastoralDistrital.infoReinsercionEficacia')} /></p>
          )
        })()}
        <form onSubmit={asignarReinsercion} className="p-5 border-t border-border grid sm:grid-cols-3 gap-2 items-end">
          <div className="sm:col-span-3">
            <p className="text-sm font-medium">{t('pastoralDistrital.reinsercionFormTitulo')}</p>
            <p className="text-xs text-secondary mt-1">{t('pastoralDistrital.reinsercionFormDescripcion')}</p>
          </div>
          <select required className="input-field" value={reinsercionForm.interno_id} onChange={(event) => setReinsercionForm({ ...reinsercionForm, interno_id: event.target.value })}>
            <option value="">{t('pastoralDistrital.opcionInternoLiberado')}</option>
            {liberadosSinAsignar.map((interno) => <option key={interno.id} value={interno.id}>{interno.nombres} {interno.apellidos} · {interno.congregacion_origen}</option>)}
          </select>
          <select required className="input-field" value={reinsercionForm.congregacion_destino} onChange={(event) => setReinsercionForm({ ...reinsercionForm, congregacion_destino: event.target.value })}>
            <option value="">{t('pastoralDistrital.opcionCongregacionDestino')}</option>
            {congregations.map((congregacion) => <option key={congregacion.id} value={congregacion.id}>{congregacion.nombre}</option>)}
          </select>
          <button disabled={savingReinsercion || liberadosSinAsignar.length === 0} className="btn-primary justify-center"><ArrowRightLeft className="w-4 h-4" /> {t('pastoralDistrital.botonAsignar')}</button>
        </form>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <ResumenComiteDistrital
          titulo={t('pastoralDistrital.comiteMusicaTitulo')}
          descripcion={t('pastoralDistrital.comiteMusicaDescripcion')}
          data={resumenMusica}
          pageKey="musica"
          emptyMessage={t('pastoralDistrital.comiteMusicaEmpty')}
          unidadLider={t('pastoralDistrital.unidadIntegrantesActivos')}
          paginate={paginate}
          metrics={[
            { key: 'grupos_activos', label: t('pastoralDistrital.metricGrupos'), kpi: true },
            { key: 'integrantes_activos', label: t('pastoralDistrital.metricIntegrantes'), kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'sesiones_ultimo_mes', label: t('pastoralDistrital.metricSesiones30d'), tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />

        <ResumenComiteDistrital
          titulo={t('pastoralDistrital.comiteArtisticaTitulo')}
          descripcion={t('pastoralDistrital.comiteArtisticaDescripcion')}
          data={resumenArtistica}
          pageKey="artistica"
          emptyMessage={t('pastoralDistrital.comiteArtisticaEmpty')}
          unidadLider={t('pastoralDistrital.unidadIntegrantesActivos')}
          paginate={paginate}
          metrics={[
            { key: 'grupos_activos', label: t('pastoralDistrital.metricGrupos'), kpi: true },
            { key: 'integrantes_activos', label: t('pastoralDistrital.metricIntegrantes'), kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'sesiones_ultimo_mes', label: t('pastoralDistrital.metricSesiones30d'), tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ResumenComiteDistrital
          titulo={t('pastoralDistrital.comiteTeologicaTitulo')}
          descripcion={t('pastoralDistrital.comiteTeologicaDescripcion')}
          data={resumenTeologica}
          pageKey="teologica"
          emptyMessage={t('pastoralDistrital.comiteTeologicaEmpty')}
          unidadLider={t('pastoralDistrital.unidadIntegrantesActivos')}
          paginate={paginate}
          metrics={[
            { key: 'grupos_activos', label: t('pastoralDistrital.metricGrupos'), kpi: true },
            { key: 'integrantes_activos', label: t('pastoralDistrital.metricIntegrantes'), kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'certificados', label: t('pastoralDistrital.metricCertificados'), kpi: true },
            { key: 'sesiones_ultimo_mes', label: t('pastoralDistrital.metricSesiones30d'), tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />

        <ResumenComiteDistrital
          titulo={t('pastoralDistrital.comiteConquistadoresTitulo')}
          descripcion={t('pastoralDistrital.comiteConquistadoresDescripcion')}
          data={resumenConquistadores}
          pageKey="conquistadores"
          emptyMessage={t('pastoralDistrital.comiteConquistadoresEmpty')}
          unidadLider={t('pastoralDistrital.unidadMiembrosActivos')}
          paginate={paginate}
          metrics={[
            { key: 'miembros_activos', label: t('pastoralDistrital.metricMiembros'), kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'lideres_activos', label: t('pastoralDistrital.metricLideres'), kpi: true, tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
            { key: 'actividades_ultimo_mes', label: t('pastoralDistrital.metricActividades30d'), tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />
      </div>

      <ResumenComiteDistrital
        titulo={t('pastoralDistrital.comiteObraSocialTitulo')}
        descripcion={t('pastoralDistrital.comiteObraSocialDescripcion')}
        data={resumenObraSocial}
        pageKey="obraSocial"
        emptyMessage={t('pastoralDistrital.comiteObraSocialEmpty')}
        unidadLider={t('pastoralDistrital.unidadCasosAbiertos')}
        paginate={paginate}
        metrics={[
          { key: 'casos_abiertos', label: t('pastoralDistrital.metricCasosAbiertos'), kpi: true, primary: true },
          { key: 'casos_resueltos', label: t('pastoralDistrital.metricCasosResueltos'), kpi: true },
          { key: 'ayudas_ultimo_mes', label: t('pastoralDistrital.metricAyudas30d') },
        ]}
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <ResumenComiteDistrital
          titulo={t('pastoralDistrital.comiteMisionJuvenilTitulo')}
          descripcion={t('pastoralDistrital.comiteMisionJuvenilDescripcion')}
          data={resumenMisionJuvenil}
          pageKey="misionJuvenil"
          emptyMessage={t('pastoralDistrital.comiteMisionJuvenilEmpty')}
          unidadLider={t('pastoralDistrital.unidadEstudiantesActivos')}
          paginate={paginate}
          metrics={[
            { key: 'estudiantes_activos', label: t('pastoralDistrital.metricEstudiantes'), kpi: true, primary: true, tone: (v) => Number(v) === 0 ? 'text-danger' : '' },
            { key: 'bautizados', label: t('pastoralDistrital.metricBautizados'), kpi: true },
            { key: 'instituciones_impactadas', label: t('pastoralDistrital.metricInstituciones'), kpi: true },
            { key: 'lecciones_ultimo_mes', label: t('pastoralDistrital.metricLecciones30d'), tone: (v) => Number(v) === 0 ? 'text-warning' : '' },
          ]}
        />

        <ResumenComiteDistrital
          titulo={t('pastoralDistrital.comiteRedFamiliasTitulo')}
          descripcion={t('pastoralDistrital.comiteRedFamiliasDescripcion')}
          data={resumenRedFamilias}
          pageKey="redFamilias"
          emptyMessage={t('pastoralDistrital.comiteRedFamiliasEmpty')}
          unidadLider={t('pastoralDistrital.unidadCasosActivos')}
          paginate={paginate}
          metrics={[
            { key: 'casos_activos', label: t('pastoralDistrital.metricCasosActivos'), kpi: true, primary: true },
            { key: 'casos_alta_prioridad', label: t('pastoralDistrital.metricPrioridadAlta'), tone: (v) => Number(v) > 0 ? 'text-danger' : '' },
            { key: 'casos_cerrados_3m', label: t('pastoralDistrital.metricCerrados3m'), kpi: true },
            { key: 'visitas_pendientes', label: t('pastoralDistrital.metricVisitasPendientes'), tone: (v) => Number(v) > 0 ? 'text-warning' : '' },
          ]}
        />
      </div>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-medium flex items-center gap-1.5">{t('pastoralDistrital.informeTitulo')}<InfoTip texto={t('pastoralDistrital.infoInformeTitulo')} /></h2>
            <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.informeDescripcion')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input-field" value={informeAnio} onChange={(event) => setInformeAnio(Number(event.target.value))}>{[informeTrimestralCerrado.anio, informeTrimestralCerrado.anio - 1, informeTrimestralCerrado.anio - 2].map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select className="input-field" value={informeTrimestre} onChange={(event) => setInformeTrimestre(Number(event.target.value))}>{Object.entries(ETIQUETA_TRIMESTRE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select className="input-field" value={informeSortKey} onChange={(event) => setInformeSortKey(event.target.value)}>
              <option value="bautizados_nuevos">{t('pastoralDistrital.ordenarPorBautizados')}</option>
              <option value="sellados_nuevos">{t('pastoralDistrital.ordenarPorSellados')}</option>
              <option value="reconciliados_actual">{t('pastoralDistrital.ordenarPorReconciliados')}</option>
              <option value="entregados_nuevos">{t('pastoralDistrital.ordenarPorEntregadosNuevos')}</option>
            </select>
            <button type="button" onClick={descargarInformeTrimestralDistrital} disabled={!filasInformeOrdenadas.length} className="btn-secondary"><Download className="w-4 h-4" /> {t('pastoralDistrital.botonDescargarPdf')}</button>
          </div>
        </div>
        {loadingInformeTrimestral ? (
          <p className="p-5 text-sm text-muted">{t('pastoralDistrital.informeCargando')}</p>
        ) : resumenInformeTrimestral.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t('pastoralDistrital.informeSinDatos')}</p>
        ) : (() => {
          const filasOrdenadas = filasInformeOrdenadas
          const paged = paginate('informe', filasOrdenadas)
          return <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thCongregacion')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thBautizados')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thSellados')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thReconciliados')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thEntregados')}</th></tr></thead>
              <tbody>
                {paged.pageItems.map((item, index) => (
                  <tr key={item.congregacion_id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{paged.page === 0 && index === 0 && <span className="text-[10px] uppercase tracking-wide text-success mr-1.5">●</span>}{item.nombre}</td>
                    <td className="px-4 py-2.5">{item.bautizados_total_actual} <span className="text-xs text-success">{t('pastoralDistrital.nuevosTexto', { count: item.bautizados_nuevos })}</span></td>
                    <td className="px-4 py-2.5">{item.sellados_total_actual} <span className="text-xs text-success">{t('pastoralDistrital.nuevosTexto', { count: item.sellados_nuevos })}</span></td>
                    <td className="px-4 py-2.5">{item.reconciliados_actual} <span className="text-xs text-muted">{t('pastoralDistrital.antesTexto', { count: item.reconciliados_anterior })}</span></td>
                    <td className="px-4 py-2.5">{item.entregados_total_actual} <span className="text-xs text-success">{t('pastoralDistrital.nuevosPluralTexto', { count: item.entregados_nuevos })}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={filasOrdenadas.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label={t('pastoralDistrital.etiquetaPaginadorCongregaciones')} /></div>
          </>
        })()}
      </section>

      <ResumenComiteDistrital
        titulo={t('pastoralDistrital.comiteRutaTitulo')}
        infoTitulo={t('pastoralDistrital.infoComiteRutaTitulo')}
        descripcion={t('pastoralDistrital.comiteRutaDescripcion')}
        data={resumenRuta}
        pageKey="ruta"
        emptyMessage={t('pastoralDistrital.comiteRutaEmpty')}
        unidadLider={t('pastoralDistrital.unidadBautismos3m')}
        paginate={paginate}
        metrics={[
          { key: 'uno_mas', label: t('pastoralDistrital.metricUnoMas'), kpi: true },
          { key: 'bis', label: t('pastoralDistrital.metricBis'), kpi: true },
          { key: 'refam', label: t('pastoralDistrital.metricRefam'), kpi: true },
          { key: 'esfob', label: t('pastoralDistrital.metricEsfob') },
          { key: 'discipulado', label: t('pastoralDistrital.metricDiscipulado') },
          { key: 'bautismos_3m', label: t('pastoralDistrital.metricBautismos3m'), kpi: true, primary: true, tone: (v) => Number(v) > 0 ? 'text-success font-medium' : '', info: t('pastoralDistrital.infoBautismos3m') },
        ]}
      />

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium flex items-center gap-1.5">{t('pastoralDistrital.sepriSolicitudesTitulo')}<InfoTip texto={t('pastoralDistrital.infoSepriSolicitudesTitulo')} /></h2>
          <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.sepriSolicitudesDescripcion')}</p>
        </div>
        {sepriSolicitudes.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t('pastoralDistrital.sepriSolicitudesSinDatos')}</p>
        ) : (() => {
          const paged = paginate('sepriSolicitudes', sepriSolicitudes)
          return <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thCongregacion')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thEvento')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thFecha')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thAnticipacion')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thEstado')}</th><th className="font-normal px-4 py-2.5"></th></tr></thead>
              <tbody>
                {paged.pageItems.map((item) => {
                  const evento = new Date(`${item.fecha_evento}T00:00:00Z`)
                  const creado = new Date(item.created_at)
                  const dias = Math.round((evento.getTime() - Date.UTC(creado.getUTCFullYear(), creado.getUTCMonth(), creado.getUTCDate())) / 86400000)
                  return (
                    <tr key={item.id} className="border-t border-border align-top">
                      <td className="px-4 py-2.5 font-medium">{item.congregaciones?.nombre}</td>
                      <td className="px-4 py-2.5">{item.nombre_evento}<p className="text-xs text-secondary">{item.ubicacion === 'dentro_templo' ? t('pastoralDistrital.dentroTemplo') : t('pastoralDistrital.fueraTemplo')}{item.lugar ? ` · ${item.lugar}` : ''}{item.poliza_contratada ? t('pastoralDistrital.conPoliza') : ''}</p></td>
                      <td className="px-4 py-2.5 text-secondary">{item.fecha_evento}</td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${dias >= 30 ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>{t('pastoralDistrital.diasTexto', { count: dias })}</span></td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${item.estado === 'pendiente' ? 'bg-warning-bg text-warning' : item.estado === 'aprobado' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>{item.estado === 'pendiente' ? t('pastoralDistrital.estadoPendiente') : item.estado === 'aprobado' ? t('pastoralDistrital.estadoAprobado') : t('pastoralDistrital.estadoRechazado')}</span></td>
                      <td className="px-4 py-2.5">
                        {item.estado === 'pendiente' ? (
                          <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <input className="input-field text-xs py-1" placeholder={t('pastoralDistrital.placeholderNotasOpcional')} value={sepriNotas[item.id] ?? ''} onChange={(event) => setSepriNotas({ ...sepriNotas, [item.id]: event.target.value })} />
                            <div className="flex gap-1.5">
                              <button type="button" className="btn-primary text-xs py-1 px-2 flex-1" onClick={() => resolverSepri(item, 'aprobado')}>{t('pastoralDistrital.botonAprobar')}</button>
                              <button type="button" className="btn-secondary text-xs py-1 px-2 flex-1" onClick={() => resolverSepri(item, 'rechazado')}>{t('pastoralDistrital.botonRechazar')}</button>
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
          <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={sepriSolicitudes.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label={t('pastoralDistrital.etiquetaPaginadorSolicitudes')} /></div>
          </>
        })()}
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium flex items-center gap-1.5">{t('pastoralDistrital.sepriResumenTitulo')}<InfoTip texto={t('pastoralDistrital.infoSepriResumenTitulo')} /></h2>
          <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.sepriResumenDescripcion')}</p>
        </div>
        {sepriResumen.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t('pastoralDistrital.sepriResumenSinDatos')}</p>
        ) : (() => {
          const paged = paginate('sepri', sepriResumen)
          return <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thCongregacion')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thPendientes')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thAprobadas12m')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thATiempo12m')}</th><th className="font-normal px-4 py-2.5">{t('pastoralDistrital.thDelegadosActivos')}</th></tr></thead>
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
          <div className="p-3 border-t border-border"><Pager page={paged.page} totalPages={paged.totalPages} total={sepriResumen.length} onPrev={() => paged.setPage((p) => p - 1)} onNext={() => paged.setPage((p) => p + 1)} label={t('pastoralDistrital.etiquetaPaginadorCongregaciones')} /></div>
          </>
        })()}
      </section>

      <form onSubmit={createCongregation} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end border-2 border-accent/30" style={{ backdropFilter: 'none' }}>
        <div className="sm:col-span-2 lg:col-span-5">
          <h2 className="font-medium flex items-center gap-2"><Building2 className="w-4 h-4 text-accent" />{t('pastoralDistrital.nuevaCongregacionTitulo')}</h2>
          <p className="text-xs text-secondary mt-1">{t('pastoralDistrital.nuevaCongregacionDescripcion')}</p>
          {catalogoCongregaciones.length > 0 && (
            <p className="text-xs text-accent mt-1">{t('pastoralDistrital.nuevaCongregacionAvisoFaltan', { pendientes: catalogoPendientes.length, total: catalogoCongregaciones.length })}</p>
          )}
        </div>
        <div className="text-sm relative sm:col-span-2 lg:col-span-5" ref={catalogoFieldRef}>
          {t('pastoralDistrital.labelNombreCongregacion')}
          <input
            required
            className="input-field mt-1.5"
            placeholder={t('pastoralDistrital.placeholderNombreCongregacion')}
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
                <p className="p-3 text-xs text-muted">{t('pastoralDistrital.sinCoincidenciasOficial')}</p>
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
        <label className="text-sm">{t('pastoralDistrital.labelCiudadMunicipio')}<input className="input-field mt-1.5" value={newCongregation.ciudad} onChange={(event) => setNewCongregation({ ...newCongregation, ciudad: event.target.value })} /></label>
        <label className="text-sm">{t('pastoralDistrital.labelNombresPastor')}<input required className="input-field mt-1.5" value={newCongregation.pastor_nombres} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_nombres: event.target.value })} /></label>
        <label className="text-sm">{t('pastoralDistrital.labelApellidosPastor')}<input required className="input-field mt-1.5" value={newCongregation.pastor_apellidos} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_apellidos: event.target.value })} /></label>
        <label className="text-sm">{t('pastoralDistrital.labelTelefonoPastor')}<input className="input-field mt-1.5" value={newCongregation.pastor_telefono} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_telefono: event.target.value })} /></label>
        <label className="text-sm">{t('pastoralDistrital.labelCorreoPastor')}<input required type="email" className="input-field mt-1.5" value={newCongregation.pastor_email} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_email: event.target.value })} /></label>
        <button disabled={creatingCongregation} className="btn-primary lg:col-span-5"><Plus className="w-4 h-4" />{creatingCongregation ? t('pastoralDistrital.botonCreando') : t('pastoralDistrital.botonCrearCongregacionInvitarPastor')}</button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <form ref={pastorFormRef} onSubmit={savePastor} className="card p-5 grid sm:grid-cols-2 gap-3 items-end" style={{ backdropFilter: 'none' }}>
          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            <h2 className="font-medium">{editingPastorId ? t('pastoralDistrital.pastorFormTituloEditar') : t('pastoralDistrital.pastorFormTituloRegistrar')}</h2>
            {editingPastorId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                {t('pastoralDistrital.botonCancelarEdicion')}
              </button>
            )}
          </div>

          <label className="text-sm">
            {t('pastoralDistrital.labelNombres')}
            <input
              required
              className="input-field mt-1.5"
              value={form.nombres}
              onChange={(event) => setForm({ ...form, nombres: event.target.value })}
            />
          </label>

          <label className="text-sm">
            {t('pastoralDistrital.labelApellidos')}
            <input
              required
              className="input-field mt-1.5"
              value={form.apellidos}
              onChange={(event) => setForm({ ...form, apellidos: event.target.value })}
            />
          </label>

          <label className="text-sm">
            {t('pastoralDistrital.labelTelefono')}
            <input
              className="input-field mt-1.5"
              value={form.telefono}
              onChange={(event) => setForm({ ...form, telefono: event.target.value })}
            />
          </label>

          <label className="text-sm">
            {t('pastoralDistrital.labelFamiliaPastoral')}
            <input
              className="input-field mt-1.5"
              placeholder={t('pastoralDistrital.placeholderFamiliaPastoral')}
              value={form.familia_pastoral}
              onChange={(event) => setForm({ ...form, familia_pastoral: event.target.value })}
            />
          </label>

          {!editingPastorId && (
            <label className="text-sm">
              {t('pastoralDistrital.labelCorreoInvitarAcceso')}
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
              {t('pastoralDistrital.labelLicenciaMinisterial')}
              <select
                className="input-field mt-1.5"
                value={form.licencia}
                onChange={(event) => setForm({ ...form, licencia: event.target.value })}
              >
                {Object.entries(LICENCIA_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <span className="block text-xs text-muted mt-1">{t('pastoralDistrital.infoLicenciaCorreccion')}</span>
            </label>
          )}

          {editingPastorId && (
            <label className="text-sm">
              <span className="flex items-center gap-1">{t('pastoralDistrital.labelTarjetaPredicador')}<InfoTip texto={t('pastoralDistrital.infoTarjetaPredicador')} /></span>
              <input
                type="date"
                className="input-field mt-1.5"
                value={form.fecha_tarjeta_predicador}
                onChange={(event) => setForm({ ...form, fecha_tarjeta_predicador: event.target.value })}
              />
            </label>
          )}

          <div className="text-sm relative" ref={congregacionFieldRef}>
            {t('pastoralDistrital.labelCongregacion')}
            <input
              required
              className="input-field mt-1.5"
              placeholder={t('pastoralDistrital.placeholderCongregacionBuscarOficial')}
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
              <span className="block text-xs text-muted mt-1">{t('pastoralDistrital.infoCongregacionEditar')}</span>
            )}
            {congregacionDropdownOpen && (() => {
              const opciones = editingPastorId ? opcionesCongregacionEditar : congregacionesParaAsignar
              return (
                <div className="absolute z-30 mt-1 w-full bg-surface-2 border border-border rounded-card shadow-lg max-h-48 overflow-y-auto">
                  {opciones.length === 0 ? <p className="p-3 text-xs text-muted">{t('pastoralDistrital.sinResultados')}</p> : opciones.map((item) => (
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
                      {item.tipo === 'oficial' && <span className="ml-2 text-[10px] uppercase tracking-wide text-accent">{t('pastoralDistrital.etiquetaOficialSinRegistrar')}</span>}
                    </button>
                  ))}
                </div>
              )
            })()}
            {!editingPastorId && (
              <span className="block text-xs text-muted mt-1">{t('pastoralDistrital.infoSoloSinPastor')}</span>
            )}
          </div>

          <label className="text-sm">
            {t('pastoralDistrital.labelCargo')}
            <select
              className="input-field mt-1.5"
              value={form.cargo}
              onChange={(event) => setForm({ ...form, cargo: event.target.value })}
            >
              {CARGO_OPTIONS.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {CARGO_LABELS[cargo] || cargo}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            {t('pastoralDistrital.labelDesde')}
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
            {saving ? t('pastoralDistrital.botonGuardandoPastor') : editingPastorId ? t('pastoralDistrital.botonGuardarCambiosPastor') : t('pastoralDistrital.botonRegistrarPastor')}
          </button>

          <label className="text-sm sm:col-span-2">
            {t('pastoralDistrital.labelObservaciones')}
            <textarea
              className="input-field mt-1.5"
              value={form.observaciones}
              onChange={(event) => setForm({ ...form, observaciones: event.target.value })}
            />
          </label>
        </form>

        <form ref={transferFormRef} onSubmit={handleTransfer} className="card p-5 grid gap-3 items-end">
          <h2 className="font-medium flex items-center gap-1.5">{t('pastoralDistrital.transferFormTitulo')}<InfoTip texto={t('pastoralDistrital.infoTransferFormTitulo')} /></h2>

          <label className="text-sm">
            {t('pastoralDistrital.labelPastor')}
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
              <option value="">{t('pastoralDistrital.opcionSeleccionar')}</option>
              {pastors.map((pastor) => (
                <option key={pastor.id} value={pastor.id}>
                  {pastor.nombres} {pastor.apellidos}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            {t('pastoralDistrital.labelNuevaCongregacion')}
            <select
              required
              className="input-field mt-1.5"
              value={transferForm.congregacion_id}
              onChange={(event) => setTransferForm({ ...transferForm, congregacion_id: event.target.value })}
            >
              <option value="">{t('pastoralDistrital.opcionSeleccionar')}</option>
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
            {t('pastoralDistrital.labelFechaTraslado')}
            <input
              required
              type="date"
              className="input-field mt-1.5"
              value={transferForm.fecha}
              onChange={(event) => setTransferForm({ ...transferForm, fecha: event.target.value })}
            />
          </label>

          <label className="text-sm">
            {t('pastoralDistrital.labelObservaciones')}
            <textarea
              className="input-field mt-1.5"
              value={transferForm.observaciones}
              onChange={(event) => setTransferForm({ ...transferForm, observaciones: event.target.value })}
            />
          </label>

          <button disabled={saving} className="btn-secondary">
            <ArrowRightLeft className="w-4 h-4" />
            {saving ? t('pastoralDistrital.botonTrasladando') : t('pastoralDistrital.botonConfirmarTraslado')}
          </button>
        </form>
      </div>

      <form onSubmit={handleFinalizarAsignacion} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div className="sm:col-span-2 lg:col-span-4">
          <h2 className="font-medium">{t('pastoralDistrital.finalizarFormTitulo')}</h2>
          <p className="text-xs text-secondary mt-1">{t('pastoralDistrital.finalizarFormDescripcion')}</p>
        </div>
        <label className="text-sm">
          {t('pastoralDistrital.labelPastor')}
          <select required className="input-field mt-1.5" value={finalizarForm.pastor_id} onChange={(event) => setFinalizarForm({ ...finalizarForm, pastor_id: event.target.value })}>
            <option value="">{t('pastoralDistrital.opcionSeleccionar')}</option>
            {pastors.filter((pastor) => activeByPastor.has(pastor.id)).map((pastor) => (
              <option key={pastor.id} value={pastor.id}>{pastor.nombres} {pastor.apellidos}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t('pastoralDistrital.labelFecha')}
          <input required type="date" className="input-field mt-1.5" value={finalizarForm.fecha} onChange={(event) => setFinalizarForm({ ...finalizarForm, fecha: event.target.value })} />
        </label>
        <label className="text-sm sm:col-span-2">
          {t('pastoralDistrital.labelObservaciones')}
          <input className="input-field mt-1.5" placeholder={t('pastoralDistrital.placeholderMotivoOpcional')} value={finalizarForm.observaciones} onChange={(event) => setFinalizarForm({ ...finalizarForm, observaciones: event.target.value })} />
        </label>
        <button disabled={finalizando} className="btn-secondary sm:col-span-2 lg:col-span-4">
          {finalizando ? t('pastoralDistrital.botonFinalizando') : t('pastoralDistrital.botonFinalizarAsignacion')}
        </button>
      </form>

      <form onSubmit={ascenderLicencia} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div className="sm:col-span-2 lg:col-span-4">
          <h2 className="font-medium flex items-center gap-2"><GraduationCap className="w-4 h-4 text-accent" />{t('pastoralDistrital.ascenderFormTitulo')}</h2>
          <p className="text-xs text-secondary mt-1">{t('pastoralDistrital.ascenderFormDescripcion')}</p>
        </div>
        <label className="text-sm lg:col-span-2">
          {t('pastoralDistrital.labelPastor')}
          <select
            required
            className="input-field mt-1.5"
            value={licenciaForm.pastor_id}
            onChange={(event) => setLicenciaForm({ ...licenciaForm, pastor_id: event.target.value })}
          >
            <option value="">{t('pastoralDistrital.opcionSeleccionar')}</option>
            {pastors.filter((pastor) => LICENCIA_SIGUIENTE[pastor.licencia]).map((pastor) => (
              <option key={pastor.id} value={pastor.id}>
                {pastor.nombres} {pastor.apellidos} — {LICENCIA_LABELS[pastor.licencia]} → {LICENCIA_LABELS[LICENCIA_SIGUIENTE[pastor.licencia]]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t('pastoralDistrital.labelFecha')}
          <input
            required
            type="date"
            className="input-field mt-1.5"
            value={licenciaForm.fecha}
            onChange={(event) => setLicenciaForm({ ...licenciaForm, fecha: event.target.value })}
          />
        </label>
        <label className="text-sm">
          {t('pastoralDistrital.labelObservaciones')}
          <input
            className="input-field mt-1.5"
            placeholder={t('pastoralDistrital.placeholderObservacionesConsistorio')}
            value={licenciaForm.observaciones}
            onChange={(event) => setLicenciaForm({ ...licenciaForm, observaciones: event.target.value })}
          />
        </label>
        <button disabled={ascendiendoLicencia} className="btn-primary lg:col-span-4">
          <GraduationCap className="w-4 h-4" />
          {ascendiendoLicencia ? t('pastoralDistrital.botonRegistrandoAscenso') : t('pastoralDistrital.botonRegistrarAscenso')}
        </button>
      </form>

      <form onSubmit={addFormacion} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div className="sm:col-span-2 lg:col-span-6">
          <h2 className="font-medium flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent" />{t('pastoralDistrital.formacionFormTitulo')}</h2>
          <p className="text-xs text-secondary mt-1">{t('pastoralDistrital.formacionFormDescripcion')}</p>
        </div>
        <label className="text-sm lg:col-span-2">
          {t('pastoralDistrital.labelPastor')}
          <select
            required
            className="input-field mt-1.5"
            value={formacionForm.pastor_id}
            onChange={(event) => setFormacionForm({ ...formacionForm, pastor_id: event.target.value })}
          >
            <option value="">{t('pastoralDistrital.opcionSeleccionar')}</option>
            {pastors.map((pastor) => (
              <option key={pastor.id} value={pastor.id}>{pastor.nombres} {pastor.apellidos}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t('pastoralDistrital.labelTipo')}
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
            {t('pastoralDistrital.labelEspecificaTipo')}
            <input required className="input-field mt-1.5" value={formacionForm.tipo_otro} onChange={(event) => setFormacionForm({ ...formacionForm, tipo_otro: event.target.value })} />
          </label>
        )}
        <label className="text-sm">
          {t('pastoralDistrital.labelNombres')}
          <input required placeholder={t('pastoralDistrital.placeholderNombreFormacion')} className="input-field mt-1.5" value={formacionForm.nombre} onChange={(event) => setFormacionForm({ ...formacionForm, nombre: event.target.value })} />
        </label>
        <label className="text-sm">
          {t('pastoralDistrital.labelInstitucion')}
          <input className="input-field mt-1.5" value={formacionForm.institucion} onChange={(event) => setFormacionForm({ ...formacionForm, institucion: event.target.value })} />
        </label>
        <label className="text-sm">
          {t('pastoralDistrital.labelFecha')}
          <input type="date" className="input-field mt-1.5" value={formacionForm.fecha} onChange={(event) => setFormacionForm({ ...formacionForm, fecha: event.target.value })} />
        </label>
        <button disabled={savingFormacion} className="btn-primary lg:col-span-6">
          <Plus className="w-4 h-4" />
          {savingFormacion ? t('pastoralDistrital.botonGuardando') : t('pastoralDistrital.botonAgregarPreparacion')}
        </button>
      </form>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-medium">{t('pastoralDistrital.pastoresTrayectoriaTitulo')}</h2>
              <p className="text-sm text-secondary mt-1">{t('pastoralDistrital.pastoresTrayectoriaDescripcion')}</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-secondary" />
                <input
                  className="input-field pl-9 min-w-[220px]"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t('pastoralDistrital.placeholderBuscarPastorCongregacion')}
                />
              </div>

              <select className="input-field min-w-[180px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">{t('pastoralDistrital.opcionTodosEstados')}</option>
                <option value="active">{t('pastoralDistrital.opcionActivos')}</option>
                <option value="vacant">{t('pastoralDistrital.opcionHistoricosSinAsignacion')}</option>
              </select>

              <select className="input-field min-w-[180px]" value={congregationFilter} onChange={(event) => setCongregationFilter(event.target.value)}>
                <option value="all">{t('pastoralDistrital.opcionTodasCongregaciones')}</option>
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
                      <p className="text-xs text-secondary mt-1">{congregation?.nombre || t('pastoralDistrital.sinCongregacionAsignada')}{congregation?.ciudad ? ` · ${congregation.ciudad}` : ''}</p>
                      <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-accent-bg text-accent">{LICENCIA_LABELS[pastor.licencia] || LICENCIA_LABELS.obrero}</span>
                      {pastor.licencia === 'obrero' && pastor.fecha_tarjeta_predicador && (
                        <span className="inline-block mt-1 ml-1.5 text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-surface-2 text-secondary">{t('pastoralDistrital.badgeTarjetaPredicador')}: {formatDate(pastor.fecha_tarjeta_predicador)}</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${isAssigned ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'}`}>
                        {isAssigned ? t('pastoralDistrital.badgeActivo') : t('pastoralDistrital.badgeSinAsignacion')}
                      </span>
                      {!pastor.persona_id && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-danger-bg text-danger">{t('pastoralDistrital.badgeSinAccesoVinculado')}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-secondary">
                    {pastor.telefono && <p>{t('pastoralDistrital.tarjetaTel', { telefono: pastor.telefono })}</p>}
                    {pastor.familia_pastoral && <p>{t('pastoralDistrital.tarjetaFamilia', { familia: pastor.familia_pastoral })}</p>}
                    {activeAssignment && <p>{t('pastoralDistrital.tarjetaCargo', { cargo: CARGO_LABELS[activeAssignment.cargo] || activeAssignment.cargo })}</p>}
                    {resumenCongregacion && (
                      <p>{t('pastoralDistrital.tarjetaResumenCongregacion', { activas: resumenCongregacion.personas_activas, nuevas: resumenCongregacion.personas_nuevas_3m })}</p>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button type="button" className="btn-secondary flex-1" onClick={() => openPastorEditor(pastor)}>
                      <PencilLine className="w-4 h-4" />
                      {t('pastoralDistrital.botonEditar')}
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
                      {t('pastoralDistrital.botonTrasladar')}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {filteredPastors.length === 0 && (
            <p className="mt-4 text-sm text-muted">{t('pastoralDistrital.sinPastoresCoincidentes')}</p>
          )}
        </div>

        <div className="border-t border-border">
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <MapPinned className="w-4 h-4 text-accent" />
              {t('pastoralDistrital.historialAsignacionesTitulo')}
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
                            {pastor ? `${pastor.nombres} ${pastor.apellidos}` : t('pastoralDistrital.fallbackPastor')}
                          </p>
                          <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${isActive ? 'bg-success-bg text-success' : 'bg-surface-2 text-secondary'}`}>
                            {isActive ? t('pastoralDistrital.badgeActual') : t('pastoralDistrital.badgeHistorico')}
                          </span>
                        </div>
                        <p className="text-xs text-secondary mt-1">
                          {t('pastoralDistrital.textoCargoCongregacion', { cargo: CARGO_LABELS[assignment.cargo] || assignment.cargo, congregacion: congregation?.nombre || t('pastoralDistrital.fallbackCongregacion') })}
                        </p>
                        <p className="text-xs text-secondary mt-1">
                          {t('pastoralDistrital.textoDesde', { fecha: formatDate(assignment.fecha_inicio) })}
                          {assignment.fecha_fin ? t('pastoralDistrital.textoHasta', { fecha: formatDate(assignment.fecha_fin) }) : t('pastoralDistrital.textoVigente')}
                        </p>
                        {assignment.observaciones && (
                          <p className="text-xs text-muted mt-1">{t('pastoralDistrital.textoObs', { observaciones: assignment.observaciones })}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="p-4 text-sm text-muted">{t('pastoralDistrital.historialAsignacionesSinRegistros')}</p>
            )}
          </div>
        </div>

        <div className="border-t border-border">
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <GraduationCap className="w-4 h-4 text-accent" />
              {t('pastoralDistrital.historialLicenciasTitulo')}
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
                          {pastor ? `${pastor.nombres} ${pastor.apellidos}` : t('pastoralDistrital.fallbackPastor')}
                          {item.tipo === 'correccion' && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-warning-bg text-warning">{t('pastoralDistrital.badgeCorreccion')}</span>}
                        </p>
                        <p className="text-xs text-secondary mt-1">{LICENCIA_LABELS[item.licencia_anterior] || item.licencia_anterior} → {LICENCIA_LABELS[item.licencia_nueva] || item.licencia_nueva}</p>
                        <p className="text-xs text-secondary mt-1">{formatDate(item.fecha)}</p>
                        {item.observaciones && <p className="text-xs text-muted mt-1">{t('pastoralDistrital.textoObs', { observaciones: item.observaciones })}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="p-4 text-sm text-muted">{t('pastoralDistrital.historialLicenciasSinRegistros')}</p>
            )}
          </div>
        </div>

        <div className="border-t border-border">
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <BookOpen className="w-4 h-4 text-accent" />
              {t('pastoralDistrital.historialFormacionTitulo')}
            </div>

            {formaciones.length ? (
              <div className="space-y-3">
                {formaciones.map((item) => {
                  const pastor = pastors.find((entry) => entry.id === item.pastor_id)
                  const tipoLabel = item.tipo === 'otro' ? (item.tipo_otro || TIPO_FORMACION_LABELS.otro) : TIPO_FORMACION_LABELS[item.tipo] || item.tipo
                  return (
                    <div key={item.id} className="flex items-start gap-3 border border-border rounded-lg bg-surface-1 p-3">
                      <BookOpen className="w-4 h-4 text-accent mt-1" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{pastor ? `${pastor.nombres} ${pastor.apellidos}` : t('pastoralDistrital.fallbackPastor')}</p>
                          <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-accent-bg text-accent">{tipoLabel}</span>
                        </div>
                        <p className="text-xs text-secondary mt-1">{item.nombre}{item.institucion ? ` · ${item.institucion}` : ''}</p>
                        {item.fecha && <p className="text-xs text-secondary mt-1">{formatDate(item.fecha)}</p>}
                        {item.observaciones && <p className="text-xs text-muted mt-1">{t('pastoralDistrital.textoObs', { observaciones: item.observaciones })}</p>}
                      </div>
                      <button type="button" onClick={() => deleteFormacion(item.id)} className="text-muted hover:text-danger" aria-label={t('pastoralDistrital.ariaEliminarFormacion')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="p-4 text-sm text-muted">{t('pastoralDistrital.historialFormacionSinRegistros')}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
