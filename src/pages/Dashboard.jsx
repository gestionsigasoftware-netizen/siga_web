import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { ArrowRight, BarChart3, ClipboardPlus, Database, Settings2, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js'
import { useMiRol } from '../hooks/useMiRol'
import { usePreferencias } from '../hooks/usePreferencias'
import { supabase } from '../lib/supabase'
import { formatFecha } from '../lib/dateFormat'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

const NIVEL_TITULO = {
  super_admin: 'Panel — todas las congregaciones',
  nacional: 'Panel nacional',
  distrital: 'Panel distrital',
  local: 'Resumen de la congregación',
}

const ALERT_TYPE_LABELS = { familia: 'Familia', bautismo: 'Bautismo', asistencia_persona: 'Asistencia', asistencia: 'Tendencia', comite: 'Comité' }
const FRECUENCIAS = [
  ['diaria', 'Diaria'],
  ['semanal', 'Semanal'],
  ['mensual', 'Mensual'],
  ['semestral', 'Semestral'],
  ['anual', 'Anual'],
]
const CATEGORIA_COLORS = [
  ['#2a78d6', 'rgba(42,120,214,0.13)'],
  ['#e06b35', 'rgba(224,107,53,0.1)'],
  ['#008300', 'rgba(0,131,0,0.1)'],
  ['#9a6bce', 'rgba(154,107,206,0.1)'],
  ['#d03b3b', 'rgba(208,59,59,0.1)'],
  ['#159a9c', 'rgba(21,154,156,0.1)'],
  ['#c28a16', 'rgba(194,138,22,0.1)'],
]

function inicioSemanaISO(fecha) {
  const dia = fecha.getDay() || 7
  const inicio = new Date(fecha)
  inicio.setDate(fecha.getDate() - dia + 1)
  inicio.setHours(0, 0, 0, 0)
  return inicio
}

function inicioPeriodo(fecha, frecuencia) {
  if (frecuencia === 'diaria') return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  if (frecuencia === 'semanal') return inicioSemanaISO(fecha)
  if (frecuencia === 'semestral') return new Date(fecha.getFullYear(), fecha.getMonth() < 6 ? 0 : 6, 1)
  if (frecuencia === 'anual') return new Date(fecha.getFullYear(), 0, 1)
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
}

function desplazarPeriodo(inicio, frecuencia, cantidad) {
  const desplazado = new Date(inicio)
  if (frecuencia === 'diaria') desplazado.setDate(desplazado.getDate() + cantidad)
  else if (frecuencia === 'semanal') desplazado.setDate(desplazado.getDate() + cantidad * 7)
  else if (frecuencia === 'semestral') desplazado.setMonth(desplazado.getMonth() + cantidad * 6)
  else if (frecuencia === 'anual') desplazado.setFullYear(desplazado.getFullYear() + cantidad)
  else desplazado.setMonth(desplazado.getMonth() + cantidad)
  return desplazado
}

function etiquetaPeriodo(inicio, frecuencia) {
  if (frecuencia === 'diaria') return inicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  if (frecuencia === 'semanal') return `Sem. ${inicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
  if (frecuencia === 'semestral') return `S${inicio.getMonth() < 6 ? 1 : 2} ${inicio.getFullYear()}`
  if (frecuencia === 'anual') return String(inicio.getFullYear())
  return inicio.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
}

function etiquetaRango(periodos, formatoFecha) {
  const inicio = periodos[0]?.inicio
  const fin = periodos[periodos.length - 1]?.fin
  if (!inicio || !fin) return ''
  const ultimoDia = new Date(fin)
  ultimoDia.setDate(ultimoDia.getDate() - 1)
  return `${formatFecha(inicio, { formato: formatoFecha })} - ${formatFecha(ultimoDia, { formato: formatoFecha })}`
}

function crearPeriodos(fecha, frecuencia, cantidad = 6) {
  const periodoActual = inicioPeriodo(fecha, frecuencia)
  return Array.from({ length: cantidad }, (_, indice) => {
    const inicio = desplazarPeriodo(periodoActual, frecuencia, indice - cantidad + 1)
    return { inicio, fin: desplazarPeriodo(inicio, frecuencia, 1), label: etiquetaPeriodo(inicio, frecuencia) }
  })
}

function registrosEnPeriodo(registros, periodo) {
  return registros.filter((registro) => {
    const fecha = new Date(`${registro.fecha}T00:00:00`)
    return fecha >= periodo.inicio && fecha < periodo.fin
  })
}

function cantidadRegistros(registros) {
  return registros.reduce((total, registro) => total + Number(registro.registros || 1), 0)
}

const FRECUENCIA_LABELS = Object.fromEntries(FRECUENCIAS)
const FRECUENCIA_PERIODOS = { diaria: 'día', semanal: 'semana', mensual: 'mes', semestral: 'semestre', anual: 'año' }

function alertRecommendation(alert) {
  if (alert.tipo === 'familia') return 'Revisa la ficha y completa la asociación familiar.'
  if (alert.tipo === 'bautismo') return 'Programa una conversación de acompañamiento.'
  if (alert.tipo === 'asistencia_persona') return 'Contacta a la persona y registra el seguimiento.'
  if (alert.tipo === 'asistencia') return 'Compara las actividades recientes y acuerda una acción.'
  if (alert.tipo === 'comite') return 'Asigna integrantes para activar este comité.'
  return 'Revisa el detalle y registra el siguiente paso.'
}

function StatTile({ label, value, tone = 'default', series = [], insight }) {
  const text = { default: 'text-ink', danger: 'text-danger', success: 'text-success' }[tone]
  const marker = { default: 'bg-accent', danger: 'bg-danger', success: 'bg-success' }[tone]
  return (
    <div className={`summary-card summary-card-${tone} stat-tile`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[10px] uppercase tracking-[0.16em] ${tone === 'default' ? 'text-secondary' : text}`}>{label}</p>
        <span className={`summary-marker ${marker}`} aria-hidden="true" />
      </div>
      <p className={`text-3xl font-semibold tracking-tight mt-3 ${text}`}>{value}</p>
      {series.length > 0 && <MiniTrend series={series} tone={tone} />}
      {insight && <p className="summary-insight">{insight}</p>}
    </div>
  )
}

function MiniTrend({ series, tone }) {
  const width = 240
  const height = 46
  const padding = 4
  const maxValue = Math.max(...series, 1)
  const step = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0
  const points = series.map((value, index) => `${padding + index * step},${height - padding - (value / maxValue) * (height - padding * 2)}`).join(' ')
  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`
  const stroke = { default: '#71b3f7', danger: '#f18a8a', success: '#74d99d' }[tone]
  const gradient = { default: 'rgba(42,120,214,0.24)', danger: 'rgba(208,59,59,0.2)', success: 'rgba(0,131,0,0.2)' }[tone]

  const [lastX, lastY] = points.split(' ').pop().split(',')
  return <div className="summary-chart" aria-hidden="true"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><polygon points={areaPoints} fill={gradient} /><polyline points={points} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx={Number(lastX)} cy={Number(lastY)} r="3" fill={stroke} /></svg></div>
}

function QuickAction({ to, icon: Icon, title, description }) {
  return (
    <Link to={to} className="group flex items-center justify-between border border-border bg-surface-2 rounded-card p-4 hover:border-accent hover:shadow-[0_12px_28px_rgba(42,120,214,0.08)] transition-all">
      <span className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-accent-bg text-accent flex items-center justify-center"><Icon className="w-[18px] h-[18px]" /></span>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-secondary mt-0.5">{description}</span>
        </span>
      </span>
      <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
    </Link>
  )
}

function DistritalStatTile({ label, value, tone = 'default' }) {
  const text = { default: 'text-ink', danger: 'text-danger', success: 'text-success' }[tone]
  return (
    <div className="stat-tile">
      <p className="text-[10px] uppercase tracking-[0.16em] text-secondary">{label}</p>
      <p className={`text-2xl font-semibold mt-3 ${text}`}>{value}</p>
    </div>
  )
}

const MADUREZ_LABELS_DASH = { mision_nacional: 'Misión Nacional', lugar_prediccion: 'Lugar de Predicación', iglesia_local: 'Iglesia Local' }

function InsightCard({ title, value, detail, insight, tone = 'default' }) {
  const toneClass = { default: 'bg-accent-bg text-accent', danger: 'bg-danger-bg text-danger', success: 'bg-success-bg text-success', warning: 'bg-warning-bg text-warning' }[tone]
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-secondary">{title}</p>
      <div className="flex items-baseline gap-2 mt-2">
        <p className="text-2xl font-semibold">{value}</p>
        {detail && <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${toneClass}`}>{detail}</span>}
      </div>
      <p className="summary-insight mt-3">{insight}</p>
    </div>
  )
}

function DashboardDistrital({ rolPrincipal }) {
  const [congregaciones, setCongregaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ordenarPor, setOrdenarPor] = useState('personas_nuevas_3m')
  const distrito = rolPrincipal?.distritos
  const distritoId = rolPrincipal?.distrito_id

  useEffect(() => {
    if (!distritoId) return
    let active = true
    supabase.rpc('resumen_distrital', { p_distrito_id: distritoId }).then(({ data, error: rpcError }) => {
      if (!active) return
      if (rpcError) setError('No se pudo cargar el consolidado del distrito.')
      setCongregaciones(data ?? [])
      setLoading(false)
    })
    return () => { active = false }
  }, [distritoId])

  if (loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando el consolidado del distrito...</div>

  const totalFeligreses = congregaciones.reduce((total, c) => total + Number(c.personas_activas || 0), 0)
  const enCrecimiento = congregaciones.filter((c) => Number(c.personas_nuevas_3m || 0) > 0).length
  const vacantes = congregaciones.filter((c) => !c.pastor_nombre).length
  const filas = [...congregaciones].sort((a, b) => Number(b[ordenarPor] || 0) - Number(a[ordenarPor] || 0))
  const nombreDistrito = distrito?.numero ? `Distrito ${distrito.numero} · ${distrito.nombre}` : distrito?.nombre || 'Panel distrital'

  const sumar = (campo) => congregaciones.reduce((total, c) => total + Number(c[campo] || 0), 0)
  const totalBautizados = sumar('bautizados')
  const totalSellados = sumar('sellados')
  const sinSellarPct = totalBautizados ? Math.round(((totalBautizados - totalSellados) / totalBautizados) * 100) : null
  const totalEstudiosRefam = sumar('estudios_refam_3m')
  const totalBautismos3m = sumar('bautismos_3m')
  const eficaciaRefam = totalBautismos3m ? Math.round(totalEstudiosRefam / totalBautismos3m) : null
  const totalUnoMas = sumar('funnel_uno_mas')
  const totalRefamActivos = sumar('funnel_refam')
  const totalBautizadosRuta = sumar('funnel_bautizados')
  const conversionRefamPct = totalUnoMas ? Math.round((totalRefamActivos / totalUnoMas) * 100) : null
  const totalAltas3m = sumar('altas_3m')
  const totalBajas3m = sumar('bajas_3m')
  const balanceMembresia = totalAltas3m - totalBajas3m
  const congregacionesPorMadurez = congregaciones.reduce((mapa, c) => ({ ...mapa, [c.madurez]: (mapa[c.madurez] || 0) + 1 }), {})
  const congregacionesConstituidas = congregacionesPorMadurez.iglesia_local || 0

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-card bg-ink text-white p-7 sm:p-9">
        <div className="absolute right-0 top-0 h-full w-2/5 opacity-40 bg-[radial-gradient(circle_at_70%_25%,#2a78d6_0,transparent_55%)]" />
        <div className="relative max-w-2xl">
          <p className="text-xs uppercase tracking-[0.16em] text-white/60">SIGA · IPUC</p>
          <h1 className="text-3xl sm:text-4xl font-semibold mt-3 tracking-tight">{nombreDistrito}</h1>
          <p className="text-sm sm:text-base text-white/70 mt-3 max-w-lg leading-6">Consolidado de las congregaciones de tu distrito, para comparar crecimiento y tomar decisiones pastorales a nivel distrital.</p>
        </div>
      </section>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DistritalStatTile label="Congregaciones" value={congregaciones.length} />
        <DistritalStatTile label="Feligreses activos" value={totalFeligreses} />
        <DistritalStatTile label="En crecimiento (3 meses)" value={enCrecimiento} tone="success" />
        <DistritalStatTile label="Vacantes de pastor" value={vacantes} tone={vacantes > 0 ? 'danger' : 'default'} />
      </section>

      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="eyebrow">Insights BI</p>
            <h2 className="font-medium mt-1">Señales para decidir</h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <InsightCard
            title="Brecha de llenura"
            value={sinSellarPct === null ? '—' : `${sinSellarPct}%`}
            detail={sinSellarPct !== null && sinSellarPct > 30 ? 'Atención' : undefined}
            tone={sinSellarPct !== null && sinSellarPct > 30 ? 'warning' : 'default'}
            insight={totalBautizados === 0 ? 'Aún no hay bautizados registrados en el distrito.' : `${totalBautizados - totalSellados} de ${totalBautizados} bautizados aún no están sellados con el Espíritu Santo${sinSellarPct > 30 ? ' — considera una vigilia o campamento distrital.' : '.'}`}
          />
          <InsightCard
            title="Eficacia de REFAM"
            value={eficaciaRefam === null ? '—' : `${eficaciaRefam}:1`}
            insight={totalBautismos3m === 0 ? `${totalEstudiosRefam} estudios entregados en 3 meses, aún sin bautismos que comparar.` : `En promedio se necesitaron ${eficaciaRefam} estudios por cada bautismo en los últimos 3 meses (${totalEstudiosRefam} estudios, ${totalBautismos3m} bautismos).`}
          />
          <InsightCard
            title="Embudo Uno Más → REFAM"
            value={conversionRefamPct === null ? '—' : `${conversionRefamPct}%`}
            insight={totalUnoMas === 0 ? 'Aún no hay personas activas en Uno Más.' : `De ${totalUnoMas} personas en Uno Más, ${totalRefamActivos} avanzaron a REFAM y ${totalBautizadosRuta} amigos ya se bautizaron en el distrito.`}
          />
          <InsightCard
            title="Movimiento de membresía (3 meses)"
            value={balanceMembresia > 0 ? `+${balanceMembresia}` : balanceMembresia}
            tone={balanceMembresia < 0 ? 'danger' : 'success'}
            insight={`${totalAltas3m} altas y ${totalBajas3m} bajas en el distrito${balanceMembresia < 0 ? ' — las bajas superan las altas, conviene revisar traslados y disciplina.' : '.'}`}
          />
          <InsightCard
            title="Madurez de la obra"
            value={congregaciones.length ? `${Math.round((congregacionesConstituidas / congregaciones.length) * 100)}%` : '—'}
            insight={congregaciones.length === 0 ? 'Aún no hay congregaciones para clasificar.' : `${congregacionesConstituidas} Iglesia Local constituida, ${congregacionesPorMadurez.lugar_prediccion || 0} Lugar de Predicación, ${congregacionesPorMadurez.mision_nacional || 0} Misión Nacional.`}
          />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-medium">Comparativa por congregación</h2>
            <p className="text-sm text-secondary mt-1">Ordena para identificar quién está creciendo o en descenso.</p>
          </div>
          <select className="input-field min-w-[220px]" value={ordenarPor} onChange={(event) => setOrdenarPor(event.target.value)}>
            <option value="personas_nuevas_3m">Ordenar por: nuevas (3 meses)</option>
            <option value="personas_activas">Ordenar por: personas activas</option>
            <option value="asistencia_ultimo_mes">Ordenar por: asistencia último mes</option>
            <option value="bajas_3m">Ordenar por: bajas (3 meses)</option>
          </select>
        </div>
        {filas.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aún no hay congregaciones registradas en tu distrito.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="px-4 py-3">Congregación</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Pastor a cargo</th>
                  <th className="px-4 py-3">Personas activas</th>
                  <th className="px-4 py-3">Nuevas (3 meses)</th>
                  <th className="px-4 py-3">Sellados</th>
                  <th className="px-4 py-3">Madurez</th>
                  <th className="px-4 py-3">Asistencia último mes</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => {
                  const variacionAsistencia = c.asistencia_mes_anterior ? Math.round(((c.asistencia_ultimo_mes - c.asistencia_mes_anterior) / c.asistencia_mes_anterior) * 100) : null
                  return (
                    <tr key={c.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{c.nombre}</td>
                      <td className="px-4 py-3 text-secondary">{c.ciudad || '—'}</td>
                      <td className="px-4 py-3 text-secondary">{c.pastor_nombre || 'Vacante'}</td>
                      <td className="px-4 py-3">{c.personas_activas}</td>
                      <td className={`px-4 py-3 ${Number(c.personas_nuevas_3m) > 0 ? 'text-success' : ''}`}>{c.personas_nuevas_3m}</td>
                      <td className="px-4 py-3">{c.sellados}{c.bautizados > 0 && c.sellados < c.bautizados && <span className="ml-1.5 text-xs text-warning">({c.bautizados - c.sellados} sin sellar)</span>}</td>
                      <td className="px-4 py-3 text-secondary">{MADUREZ_LABELS_DASH[c.madurez] || c.madurez}</td>
                      <td className="px-4 py-3">
                        {c.asistencia_ultimo_mes}
                        {variacionAsistencia !== null && (
                          <span className={`ml-1.5 text-xs ${variacionAsistencia < 0 ? 'text-danger' : 'text-success'}`}>
                            ({variacionAsistencia > 0 ? '+' : ''}{variacionAsistencia}%)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${c.estado === 'activa' ? 'bg-success-bg text-success' : c.estado === 'suspendida' ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'}`}>
                          {c.estado === 'activa' ? 'Activa' : c.estado === 'suspendida' ? 'Suspendida' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default function Dashboard() {
  const { rolPrincipal, loading: loadingRol } = useMiRol()
  const { formato_fecha } = usePreferencias()
  const [alertas, setAlertas] = useState([])
  const [registros, setRegistros] = useState([])
  const [categorias, setCategorias] = useState([])
  const [amigos, setAmigos] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [loadingData, setLoadingData] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)
  const [canHandleAlerts, setCanHandleAlerts] = useState(false)
  const [handledAlerts, setHandledAlerts] = useState([])
  const [handlingAlertId, setHandlingAlertId] = useState(null)
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [alertasTotal, setAlertasTotal] = useState(0)
  const [resumenFeligresia, setResumenFeligresia] = useState(null)
  const [frecuencia, setFrecuencia] = useState('mensual')
  const [frecuenciaDetalle, setFrecuenciaDetalle] = useState('mensual')
  const [aplicarFrecuenciaTodos, setAplicarFrecuenciaTodos] = useState(true)
  const [categoriaSeleccionadaId, setCategoriaSeleccionadaId] = useState('general')

  useEffect(() => {
    if (!rolPrincipal) return
    let active = true
    async function load() {
      setLoadingData(true)
      setLoadError(null)
      const alertasQuery = supabase.from('vw_alertas_pastorales').select('*')
      const alertasCountQuery = supabase.from('vw_alertas_pastorales').select('clave', { count: 'exact', head: true })
      if (rolPrincipal.nivel === 'local') {
        alertasQuery.eq('congregacion_id', rolPrincipal.congregacion_id)
        alertasCountQuery.eq('congregacion_id', rolPrincipal.congregacion_id)
      }
      const [{ data: alertasData, error: alertasError }, { count: alertasCount, error: alertasCountError }, { data: feligresiaData, error: feligresiaError }, { data: permisoAlertas, error: permisoError }] = await Promise.all([
        alertasQuery,
        alertasCountQuery,
        rolPrincipal.nivel === 'local' ? supabase.from('vw_resumen_feligresia').select('personas_activas, bautizados, apartados, familias_asociadas').eq('congregacion_id', rolPrincipal.congregacion_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        rolPrincipal.nivel === 'local' ? supabase.rpc('tiene_permiso', { p_congregacion_id: rolPrincipal.congregacion_id, p_permiso: 'feligresia.editar' }) : Promise.resolve({ data: false, error: null }),
      ])
      if (!active) return
      setAlertas(alertasData ?? [])
      setAlertasTotal(alertasCount ?? 0)
      setResumenFeligresia(feligresiaData)
      setCanHandleAlerts(Boolean(permisoAlertas))

      const [{ data: registrosData, error: registrosError }, { data: categoriasData, error: categoriasError }, { data: amigosData, error: amigosError }] = await Promise.all([
        (() => {
          const desde = new Date()
          desde.setFullYear(desde.getFullYear() - 6)
          return supabase.rpc('resumen_dashboard', {
            p_congregacion_id: rolPrincipal.nivel === 'local' ? rolPrincipal.congregacion_id : null,
            p_desde: desde.toISOString().slice(0, 10),
          }).then(({ data, error }) => ({
            data: (data ?? []).map((registro) => ({ ...registro, id: registro.fecha })),
            error,
          }))
        })(),
        supabase.from('categorias_demograficas').select('id, nombre').order('orden'),
        (() => {
          const query = supabase.from('amigos').select('id, convertido, etapa_id, categoria_asignada_id, etapas_seguimiento(nombre, orden)')
          return rolPrincipal.nivel === 'local' ? query.eq('congregacion_id', rolPrincipal.congregacion_id) : query
        })(),
      ])
      if (!active) return
      if (alertasError || alertasCountError || feligresiaError || permisoError || registrosError || categoriasError || amigosError) setLoadError('No se pudieron cargar todos los indicadores. Revisa la conexión con Supabase.')
      setRegistros(registrosData ?? [])
      setCategorias(categoriasData ?? [])
      setAmigos(amigosData ?? [])
      setLoadingData(false)
    }
    load()
    return () => { active = false }
  }, [rolPrincipal, reloadToken])

  async function handleAlert(alert) {
    if (handledAlerts.includes(alert.id) || handlingAlertId) return
    setHandlingAlertId(alert.id)
    setLoadError(null)
    try {
      if (alert.persona_id) {
        const followup = await supabase.from('seguimientos_pastorales').insert({ congregacion_id: alert.congregacion_id, persona_id: alert.persona_id, tipo_alerta: alert.tipo, accion: 'Alerta atendida', notas: alert.detalle })
        if (followup.error) throw new Error('No se pudo registrar el seguimiento de la alerta.')
      }
      const result = await supabase.from('estados_alerta_pastoral').upsert({ clave: alert.clave, congregacion_id: alert.congregacion_id, estado: 'atendida', notas: alert.detalle }, { onConflict: 'clave' })
      if (result.error) throw new Error('El seguimiento se guardó, pero no se pudo cerrar la alerta.')
      setHandledAlerts((current) => [...current, alert.id])
    } catch (alertError) {
      setLoadError(alertError.message)
    } finally {
      setHandlingAlertId(null)
    }
  }

  if (loadingRol || !rolPrincipal) return <div className="module-loading" role="status"><span className="loading-dot" />Preparando tu espacio...</div>
  if (rolPrincipal.nivel === 'distrital') return <DashboardDistrital rolPrincipal={rolPrincipal} />
  if (loadingData) return <div className="module-loading flex-col gap-3" role="status"><span className="loading-dot" /><span>Cargando indicadores del resumen...</span>{loadError && <><p role="alert" className="text-sm text-danger">{loadError}</p><button type="button" onClick={() => setReloadToken((current) => current + 1)} className="btn-secondary text-xs">Reintentar</button></>}</div>

  const hasData = Boolean(registros.length)
  const nombreCongregacion = rolPrincipal?.congregaciones?.nombre
  const hoy = new Date()
  const frecuenciaGraficos = frecuencia
  const frecuenciaDetalleActiva = aplicarFrecuenciaTodos ? frecuencia : frecuenciaDetalle
  const periodos = crearPeriodos(hoy, frecuenciaGraficos)
  const periodosDetalle = crearPeriodos(hoy, frecuenciaDetalleActiva)
  const nombreFrecuencia = FRECUENCIA_LABELS[frecuenciaGraficos].toLowerCase()
  const nombreFrecuenciaDetalle = FRECUENCIA_LABELS[frecuenciaDetalleActiva].toLowerCase()
  const nombrePeriodo = FRECUENCIA_PERIODOS[frecuenciaGraficos]
  const registrosPeriodo = registrosEnPeriodo(registros, periodos[periodos.length - 1])
  const registrosPeriodoDetalle = registrosEnPeriodo(registros, periodosDetalle[periodosDetalle.length - 1])
  const asistentesPeriodo = registrosPeriodo.reduce((total, registro) => total + (registro.total_asistentes || 0), 0)
  const promedioPeriodo = cantidadRegistros(registrosPeriodo) ? Math.round(asistentesPeriodo / cantidadRegistros(registrosPeriodo)) : 0
  const asistenciaPorPeriodo = periodos.map((periodo) => {
    const registrosDelPeriodo = registrosEnPeriodo(registros, periodo)
    const total = registrosDelPeriodo.reduce((suma, registro) => suma + (registro.total_asistentes || 0), 0)
    return { ...periodo, total, count: cantidadRegistros(registrosDelPeriodo), registros: registrosDelPeriodo }
  })
  const attendanceSeries = asistenciaPorPeriodo.map((periodo) => periodo.total)
  const averageSeries = asistenciaPorPeriodo.map((periodo) => periodo.count ? Math.round(periodo.total / periodo.count) : 0)
  const ultimoRegistro = registros[0]
  const categoriasConTotal = categorias.map((categoria) => ({
    ...categoria,
    total: registrosPeriodo.reduce((total, registro) => total + Number(registro.desglose?.[categoria.id] || 0), 0),
  })).sort((a, b) => b.total - a.total)
  const totalCategorias = categoriasConTotal.reduce((total, categoria) => total + categoria.total, 0)
  const categoriaPrincipal = categoriasConTotal[0]
  const anteriorTotal = registrosEnPeriodo(registros, { inicio: desplazarPeriodo(periodos[periodos.length - 1].inicio, frecuenciaGraficos, -1), fin: periodos[periodos.length - 1].inicio }).reduce((total, registro) => total + (registro.total_asistentes || 0), 0)
  const categoriaAmigos = categorias.find((categoria) => categoria.nombre.trim().toLowerCase() === 'amigos')
  const categoriaSeleccionada = categorias.find((categoria) => categoria.id === categoriaSeleccionadaId)
  const conteoCategoriaSeleccionada = categoriaSeleccionada
    ? periodosDetalle.map((periodo) => registrosEnPeriodo(registros, periodo).reduce((total, registro) => total + Number(registro.desglose?.[categoriaSeleccionada.id] || 0), 0))
    : periodosDetalle.map((periodo) => registrosEnPeriodo(registros, periodo).reduce((total, registro) => total + (registro.total_asistentes || 0), 0))
  const conteoCategoriaActual = conteoCategoriaSeleccionada[conteoCategoriaSeleccionada.length - 1] || 0
  const conteoCategoriaAnterior = categoriaSeleccionada
    ? registrosEnPeriodo(registros, { inicio: desplazarPeriodo(periodosDetalle[periodosDetalle.length - 1].inicio, frecuenciaDetalleActiva, -1), fin: periodosDetalle[periodosDetalle.length - 1].inicio }).reduce((total, registro) => total + Number(registro.desglose?.[categoriaSeleccionada.id] || 0), 0)
    : anteriorTotal
  const variacionCategoria = conteoCategoriaAnterior ? Math.round(((conteoCategoriaActual - conteoCategoriaAnterior) / conteoCategoriaAnterior) * 100) : null
  const asistenciaAmigos = asistenciaPorPeriodo.map((periodo) => periodo.registros.reduce((total, registro) => total + Number(registro.desglose?.[categoriaAmigos?.id] || 0), 0))
  const totalAsistenciaAmigos = asistenciaAmigos.reduce((total, valor) => total + valor, 0)
  const amigosConvertidos = amigos.filter((amigo) => amigo.convertido).length
  const amigosEnRuta = amigos.length - amigosConvertidos
  const amigosConCategoria = amigos.filter((amigo) => amigo.categoria_asignada_id).length
  const volumeCategories = categoriasConTotal
  const volumeMonths = asistenciaPorPeriodo.map((periodo) => ({ label: periodo.label, records: periodo.registros }))
  const volumeChartData = {
    labels: volumeMonths.map((month) => month.label),
    datasets: volumeCategories.map((category, index) => ({
      label: category.nombre,
      data: volumeMonths.map((month) => month.records.reduce((total, registro) => total + Number(registro.desglose?.[category.id] || 0), 0)),
      borderColor: CATEGORIA_COLORS[index % CATEGORIA_COLORS.length][0],
      backgroundColor: CATEGORIA_COLORS[index % CATEGORIA_COLORS.length][1],
      fill: true,
      tension: 0.42,
      pointRadius: 2,
      pointHoverRadius: 5,
      pointBackgroundColor: '#ffffff',
      pointBorderWidth: 2,
      borderWidth: 2,
    })),
  }
  const periodChartData = {
    labels: asistenciaPorPeriodo.map((periodo) => periodo.label),
    datasets: [{ label: 'Asistencia total', data: attendanceSeries, borderColor: '#2a78d6', backgroundColor: 'rgba(42,120,214,0.12)', fill: true, tension: 0.42, pointRadius: 2, pointHoverRadius: 5, pointBackgroundColor: '#ffffff', pointBorderWidth: 2, pointBorderColor: '#2a78d6', borderWidth: 2.5 }],
  }
  const leadingShare = totalCategorias && categoriaPrincipal ? Math.round((categoriaPrincipal.total / totalCategorias) * 100) : 0
  const leadingTrend = volumeChartData.datasets[0]?.data
  const leadingChange = leadingTrend?.length > 1 && leadingTrend[0] ? Math.round(((leadingTrend[leadingTrend.length - 1] - leadingTrend[0]) / leadingTrend[0]) * 100) : null
  const variacion = anteriorTotal ? Math.round(((asistentesPeriodo - anteriorTotal) / anteriorTotal) * 100) : null
  const variacionAbsoluta = asistentesPeriodo - anteriorTotal
  const pendingAlerts = alertas.filter((alerta) => !handledAlerts.includes(alerta.id))
  const visibleAlerts = showAllAlerts ? pendingAlerts : pendingAlerts.slice(0, 5)
  const activeAlertCount = Math.max(alertasTotal - handledAlerts.length, 0)

  const chartData = {
    labels: asistenciaPorPeriodo.map((periodo) => periodo.label),
    datasets: [
      ...categoriasConTotal.map((categoria, index) => ({ label: categoria.nombre, data: asistenciaPorPeriodo.map((periodo) => periodo.registros.reduce((total, registro) => total + Number(registro.desglose?.[categoria.id] || 0), 0)), borderColor: CATEGORIA_COLORS[index % CATEGORIA_COLORS.length][0], backgroundColor: CATEGORIA_COLORS[index % CATEGORIA_COLORS.length][1], fill: true, tension: 0.42, pointRadius: 2, pointHoverRadius: 5, pointBackgroundColor: '#ffffff', pointBorderWidth: 2, pointBorderColor: CATEGORIA_COLORS[index % CATEGORIA_COLORS.length][0], borderWidth: 2.5 })),
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'start',
        labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 18, color: '#52514e', font: { size: 11, weight: '500' } },
      },
      tooltip: {
        backgroundColor: '#111820',
        titleColor: '#ffffff',
        bodyColor: 'rgba(255,255,255,0.75)',
        borderColor: 'rgba(113,179,247,0.35)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        boxPadding: 4,
        callbacks: { label: (context) => ` ${context.dataset.label}: ${context.formattedValue}` },
      },
    },
    scales: {
      y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(82,81,78,0.1)', drawTicks: false }, ticks: { color: '#898781', padding: 8, font: { size: 10 } } },
      x: { border: { display: false }, grid: { display: false }, ticks: { color: '#898781', padding: 8, font: { size: 10 } } },
    },
  }
  const periodChartOptions = { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-card bg-ink text-white p-7 sm:p-9">
        <div className="absolute right-0 top-0 h-full w-2/5 opacity-40 bg-[radial-gradient(circle_at_70%_25%,#2a78d6_0,transparent_55%)]" />
        <div className="relative max-w-2xl">
          <p className="text-xs uppercase tracking-[0.16em] text-white/60">{nombreCongregacion || 'SIGA · IPUC'}</p>
          <h1 className="text-3xl sm:text-4xl font-semibold mt-3 tracking-tight">{nombreCongregacion ? `Hola, ${nombreCongregacion}` : NIVEL_TITULO[rolPrincipal?.nivel] ?? 'Tu espacio de gestión'}</h1>
          <p className="text-sm sm:text-base text-white/70 mt-3 max-w-lg leading-6">Una lectura sencilla de la vida operativa de tu congregación. Revisa el estado de tus datos o corrige un registro cuando sea necesario.</p>
        </div>
      </section>

      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Resumen</p>
          <h2 className="font-medium mt-1">Lectura de asistencia</h2>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Seleccionar frecuencia">
          {FRECUENCIAS.map(([valor, etiqueta]) => <button key={valor} type="button" onClick={() => setFrecuencia(valor)} className={`text-xs px-3 py-2 rounded border ${frecuencia === valor ? 'bg-accent text-white border-accent' : 'border-border text-secondary hover:border-accent hover:text-accent'}`}>{etiqueta}</button>)}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div><p className="eyebrow">Categoría seleccionada</p><h2 className="font-medium mt-1">Conteo para toma de decisiones</h2><p className="text-sm text-secondary mt-1">Selecciona una categoría para consultar el total de la {nombreFrecuenciaDetalle} elegido.</p></div>
          <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer"><input type="checkbox" checked={aplicarFrecuenciaTodos} onChange={(event) => setAplicarFrecuenciaTodos(event.target.checked)} /> Aplicar frecuencia a todos</label>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-4" role="group" aria-label="Seleccionar frecuencia de la categoría">
          {FRECUENCIAS.map(([valor, etiqueta]) => <button key={valor} type="button" onClick={() => aplicarFrecuenciaTodos ? setFrecuencia(valor) : setFrecuenciaDetalle(valor)} className={`text-xs px-2.5 py-1.5 rounded border ${frecuenciaDetalleActiva === valor ? 'bg-accent-bg text-accent border-accent/30' : 'border-border text-secondary hover:border-accent'}`}>{etiqueta}</button>)}
        </div>
        <div className="flex gap-2 flex-wrap mt-4" role="group" aria-label="Seleccionar categoría de asistencia">
          <button type="button" onClick={() => setCategoriaSeleccionadaId('general')} className={`text-xs px-3 py-1.5 rounded-full border ${categoriaSeleccionadaId === 'general' ? 'bg-accent-bg text-accent border-accent/30' : 'border-border text-secondary hover:border-accent'}`}>General</button>
          {categorias.map((categoria) => <button type="button" key={categoria.id} onClick={() => setCategoriaSeleccionadaId(categoria.id)} className={`text-xs px-3 py-1.5 rounded-full border ${categoriaSeleccionadaId === categoria.id ? 'bg-accent-bg text-accent border-accent/30' : 'border-border text-secondary hover:border-accent'}`}>{categoria.nombre}</button>)}
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-5">
          <div><p className="text-xs text-muted">Asistentes {categoriaSeleccionada ? `de ${categoriaSeleccionada.nombre}` : 'totales'}</p><p className="text-3xl font-semibold mt-1">{conteoCategoriaActual}</p></div>
          <div><p className="text-xs text-muted">Actividades del periodo</p><p className="text-3xl font-semibold mt-1">{cantidadRegistros(registrosPeriodoDetalle)}</p></div>
          <div><p className="text-xs text-muted">Variación anterior</p><p className={`text-3xl font-semibold mt-1 ${variacionCategoria !== null && variacionCategoria < 0 ? 'text-danger' : 'text-success'}`}>{variacionCategoria === null ? '—' : `${variacionCategoria > 0 ? '+' : ''}${variacionCategoria}%`}</p></div>
        </div>
        <div className="h-36 mt-5"><Line data={{ labels: periodosDetalle.map((periodo) => periodo.label), datasets: [{ label: categoriaSeleccionada?.nombre || 'Asistencia total', data: conteoCategoriaSeleccionada, borderColor: categoriaSeleccionada ? CATEGORIA_COLORS[categorias.findIndex((categoria) => categoria.id === categoriaSeleccionada.id) % CATEGORIA_COLORS.length][0] : '#2a78d6', backgroundColor: categoriaSeleccionada ? CATEGORIA_COLORS[categorias.findIndex((categoria) => categoria.id === categoriaSeleccionada.id) % CATEGORIA_COLORS.length][1] : 'rgba(42,120,214,0.12)', fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2.5 }] }} options={periodChartOptions} /></div>
      </section>

      <div className="grid sm:grid-cols-3 gap-3">
        <StatTile label={`Asistentes del ${nombrePeriodo}`} value={registros.length ? asistentesPeriodo : '—'} series={attendanceSeries} insight={registros.length ? `${cantidadRegistros(registrosPeriodo)} actividades alimentan este resultado.` : 'Esperando los primeros registros.'} />
        <StatTile label="Alertas activas" value={activeAlertCount || pendingAlerts.length} tone={activeAlertCount > 0 || pendingAlerts.length > 0 ? 'danger' : 'default'} insight={pendingAlerts.length ? 'Hay señales que requieren atención.' : 'No hay asuntos pendientes hoy.'} />
        <StatTile label="Promedio por actividad" value={registros.length ? promedioPeriodo : '—'} tone="success" series={averageSeries} insight={variacion === null ? 'Aún no hay un periodo comparable.' : `${variacion >= 0 ? 'Crecimiento' : 'Descenso'} del ${Math.abs(variacion)}% frente al periodo anterior.`} />
      </div>

      {loadError && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{loadError}</p>}

      {hasData && (
        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
          <div className="card chart-card p-5">
            <div className="flex justify-between gap-4 mb-4"><div><p className="eyebrow">Ritmo de asistencia</p><h2 className="font-medium mt-1">Lectura del periodo</h2><p className="text-xs text-secondary mt-1">Asistencias registradas · {etiquetaRango(periodos, formato_fecha)}</p></div><BarChart3 className="w-5 h-5 text-accent" /></div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div><p className="text-xs text-muted">Actividades</p><p className="text-2xl font-semibold mt-1">{cantidadRegistros(registrosPeriodo)}</p></div>
              <div><p className="text-xs text-muted">Asistencias registradas</p><p className="text-2xl font-semibold mt-1">{asistentesPeriodo}</p></div>
              <div><p className="text-xs text-muted">Variación {nombreFrecuencia}</p><p className={`text-2xl font-semibold mt-1 ${variacion !== null && variacion < 0 ? 'text-danger' : 'text-success'}`}>{variacion === null ? '—' : `${variacion > 0 ? '+' : ''}${variacion}%`}</p></div>
            </div>
            <div className="h-28 mt-5"><Line data={periodChartData} options={periodChartOptions} /></div>
            <div className={`mt-5 flex items-start gap-3 rounded p-3 ${variacion !== null && variacion < 0 ? 'bg-danger-bg' : 'bg-success-bg'}`}>
              {variacion !== null && variacion < 0 ? <TrendingDown className="w-4 h-4 text-danger mt-0.5" /> : <TrendingUp className="w-4 h-4 text-success mt-0.5" />}
              <p className="text-sm text-secondary">{variacion === null ? 'Aún no hay un periodo anterior comparable. Sigue capturando datos para construir una señal confiable.' : variacion < 0 ? `La asistencia bajó ${Math.abs(variacion)}% (${Math.abs(variacionAbsoluta)} registros) frente al periodo anterior. Conviene revisar las actividades con menor participación.` : `La asistencia creció ${variacion}% (${variacionAbsoluta} registros) frente al periodo anterior. Identifica qué actividad está impulsando este resultado.`}{ultimoRegistro && <span className="block text-xs text-muted mt-1">Último registro: {ultimoRegistro.fecha}</span>}</p>
            </div>
          </div>
          <div className="card chart-card p-5"><div className="flex items-start justify-between gap-4 mb-3"><div><p className="eyebrow">Composición</p><h2 className="font-medium mt-1">Dónde está el volumen</h2></div>{categoriaPrincipal && <span className="chart-highlight">{leadingShare}% líder</span>}</div>{categoriaPrincipal && totalCategorias > 0 ? <><div className="h-52"><Line data={volumeChartData} options={chartOptions} /></div><p className="summary-insight mt-3">{categoriaPrincipal.nombre} concentra {leadingShare}% de la asistencia registrada{leadingChange === null ? '.' : leadingChange >= 0 ? ` y creció ${leadingChange}% en las últimas seis ventanas.` : ` y bajó ${Math.abs(leadingChange)}% en las últimas seis ventanas.`}</p></> : <p className="text-sm text-muted py-10">Aún no hay desglose por categorías.</p>}</div>
        </section>
      )}

      <section className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div><p className="eyebrow">Amigos e integración</p><h2 className="font-medium mt-1">De la asistencia al acompañamiento</h2><p className="text-sm text-secondary mt-1">Separa lo que registra Ujieres de lo que gestiona la ruta pastoral.</p></div>
          <Link to="/amigos" className="text-xs text-accent">Abrir ruta de amigos <ArrowRight className="inline w-3 h-3" /></Link>
        </div>
        <div className="grid sm:grid-cols-4 gap-4 mt-5">
          <div><p className="text-xs text-muted">Asistencia “Amigos”</p><p className="text-2xl font-semibold mt-1">{categoriaAmigos ? totalAsistenciaAmigos : '—'}</p><p className="text-xs text-secondary mt-1">Suma del desglose de Ujieres</p></div>
          <div><p className="text-xs text-muted">Amigos en ruta</p><p className="text-2xl font-semibold mt-1">{amigosEnRuta}</p><p className="text-xs text-secondary mt-1">Registros no convertidos</p></div>
          <div><p className="text-xs text-muted">Convertidos</p><p className="text-2xl font-semibold mt-1 text-success">{amigosConvertidos}</p><p className="text-xs text-secondary mt-1">Marcados en la ruta</p></div>
          <div><p className="text-xs text-muted">Con categoría asignada</p><p className="text-2xl font-semibold mt-1">{amigosConCategoria}</p><p className="text-xs text-secondary mt-1">Listos para integración</p></div>
        </div>
        {categoriaAmigos ? <div className="h-36 mt-5"><Line data={{ labels: asistenciaPorPeriodo.map((periodo) => periodo.label), datasets: [{ label: 'Asistencia Amigos', data: asistenciaAmigos, borderColor: '#e06b35', backgroundColor: 'rgba(224,107,53,0.12)', fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2.5 }] }} options={periodChartOptions} /></div> : <p className="text-sm text-warning bg-warning-bg rounded p-3 mt-4">Aún no hay información de asistencia de Amigos para mostrar.</p>}
        <p className="text-xs text-muted mt-4">Importante: esta asistencia es un total por categoría; no identifica cuál amigo asistió. Para medir conversión individual habría que registrar el amigo como persona o añadir un vínculo de asistencia por amigo.</p>
      </section>

      {rolPrincipal?.nivel === 'local' && (
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="font-medium">Accesos rápidos</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            <QuickAction to="/registrar" icon={ClipboardPlus} title="Corrección / contingencia" description="Completa un registro excepcional" />
            <QuickAction to="/amigos" icon={Users} title="Ruta de integración" description="Acompaña a tus amigos" />
            <QuickAction to="/feligresia" icon={Users} title="Censo de feligresía" description="Consulta la población" />
            <QuickAction to="/feligresia?tab=seguimiento" icon={TrendingDown} title="Seguimiento pastoral" description="Revisa la agenda pendiente" />
          </div>
        </section>
      )}

      {rolPrincipal?.nivel === 'local' && resumenFeligresia && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="Personas activas" value={resumenFeligresia.personas_activas} />
          <StatTile label="Bautizados" value={resumenFeligresia.bautizados} />
          <StatTile label="Familias" value={resumenFeligresia.familias_asociadas} />
          <StatTile label="Apartados" value={resumenFeligresia.apartados} />
        </section>
      )}

      {!hasData && (
        <section className="border border-dashed border-border rounded-card p-7 bg-surface-2 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          <div className="w-11 h-11 rounded bg-success-bg text-success flex items-center justify-center flex-shrink-0"><Database className="w-5 h-5" /></div>
          <div>
            <h2 className="font-medium">Tu panel está listo para recibir datos</h2>
            <p className="text-sm text-secondary mt-1 leading-6">Cuando haya nuevas actividades registradas, aquí aparecerán las tendencias y alertas pastorales. Las métricas se mantienen vacías hasta tener información real.</p>
          </div>
        </section>
      )}

      <div className="card chart-card p-5">
        <div className="flex items-start justify-between gap-4 mb-5"><div><p className="eyebrow">Evolución {nombreFrecuencia}</p><h3 className="font-medium mt-1">Participación por categoría</h3></div><span className="chart-live-dot" title="Datos de registros reales" /></div>
          <div className="flex items-start justify-between gap-4 mb-5"><div><p className="eyebrow">Evolución {nombreFrecuencia}</p><h3 className="font-medium mt-1">Participación por categoría</h3><p className="text-xs text-secondary mt-1">Asistencias registradas · {etiquetaRango(periodos, formato_fecha)}</p></div><span className="chart-live-dot" title="Datos de registros reales" /></div>
        <div style={{ height: 260 }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex justify-between items-center mb-4"><div><h3 className="font-medium">Alertas pastorales</h3></div>{ultimoRegistro && <span className="text-xs text-muted">Último registro: {ultimoRegistro.fecha}</span>}</div>
        {pendingAlerts.length === 0 ? (
          <p className="text-sm text-muted">
            Sin alertas por ahora. SIGA revisa tendencias de asistencia y condiciones pastorales del censo, como familias pendientes, bautismo, asistencia individual y comités sin integrantes.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleAlerts.map((a) => (
              <div key={a.id} className={`alert-item ${a.prioridad === 'alta' ? 'alert-item-high' : ''}`}>
                <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 mb-1"><span className={`alert-priority ${a.prioridad === 'alta' ? 'alert-priority-high' : ''}`}>{a.prioridad || 'media'}</span><span className="text-[10px] uppercase tracking-[0.12em] text-muted">{ALERT_TYPE_LABELS[a.tipo] || 'Seguimiento'}</span></div><p className="text-sm font-medium text-ink">{a.titulo}</p></div><div className="flex gap-3 text-xs flex-shrink-0">{a.persona_id && <Link to={`/feligresia?persona=${a.persona_id}`} className="text-accent">Ver ficha</Link>}{canHandleAlerts && <button type="button" disabled={Boolean(handlingAlertId)} onClick={() => handleAlert(a)} className="text-accent disabled:opacity-50">{handlingAlertId === a.id ? 'Guardando...' : 'Atender'}</button>}</div></div>
                <p className="text-xs text-secondary mt-1">{a.detalle}</p><p className="text-xs text-muted mt-2">Siguiente paso: {alertRecommendation(a)}</p>
              </div>
            ))}
            {pendingAlerts.length > 5 && <button type="button" onClick={() => setShowAllAlerts((current) => !current)} className="btn-secondary self-start text-xs">{showAllAlerts ? 'Mostrar menos' : `Ver todas (${pendingAlerts.length})`}</button>}
          </div>
        )}
      </div>
    </div>
  )
}
