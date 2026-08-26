import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { ArrowRight, BarChart3, ClipboardPlus, Database, Settings2, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js'
import { useMiRol } from '../hooks/useMiRol'
import { supabase } from '../lib/supabase'

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

export default function Dashboard() {
  const { rolPrincipal, loading: loadingRol } = useMiRol()
  const [alertas, setAlertas] = useState([])
  const [registros, setRegistros] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [handledAlerts, setHandledAlerts] = useState([])
  const [handlingAlertId, setHandlingAlertId] = useState(null)
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [alertasTotal, setAlertasTotal] = useState(0)
  const [resumenFeligresia, setResumenFeligresia] = useState(null)
  const [frecuencia, setFrecuencia] = useState('mensual')

  useEffect(() => {
    if (!rolPrincipal) return
    async function load() {
      setLoadError(null)
      const [{ data: alertasData, error: alertasError }, { count: alertasCount, error: alertasCountError }, { data: feligresiaData, error: feligresiaError }] = await Promise.all([
        supabase.from('vw_alertas_pastorales').select('*'),
        supabase.from('vw_alertas_pastorales').select('clave', { count: 'exact', head: true }),
        rolPrincipal.nivel === 'local' ? supabase.from('vw_resumen_feligresia').select('personas_activas, bautizados, apartados, familias_asociadas').eq('congregacion_id', rolPrincipal.congregacion_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ])
      setAlertas(alertasData ?? [])
      setAlertasTotal(alertasCount ?? 0)
      setResumenFeligresia(feligresiaData)

      const [{ data: registrosData, error: registrosError }, { data: categoriasData, error: categoriasError }] = await Promise.all([
        supabase.from('registros_actividad').select('id, fecha, total_asistentes, desglose, modulos(nombre_modulo)').order('fecha', { ascending: false }).limit(500),
        supabase.from('categorias_demograficas').select('id, nombre').order('orden'),
      ])
      if (alertasError || alertasCountError || feligresiaError || registrosError || categoriasError) setLoadError('No se pudieron cargar todos los indicadores. Revisa la conexión con Supabase.')
      setRegistros(registrosData ?? [])
      setCategorias(categoriasData ?? [])
    }
    load()
  }, [rolPrincipal])

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

  const hasData = Boolean(registros.length)
  const nombreCongregacion = rolPrincipal?.congregaciones?.nombre
  const hoy = new Date()
  const periodos = crearPeriodos(hoy, frecuencia)
  const nombreFrecuencia = FRECUENCIA_LABELS[frecuencia].toLowerCase()
  const nombrePeriodo = FRECUENCIA_PERIODOS[frecuencia]
  const registrosPeriodo = registrosEnPeriodo(registros, periodos[periodos.length - 1])
  const periodoAnterior = registrosEnPeriodo(registros, { inicio: desplazarPeriodo(periodos[periodos.length - 1].inicio, frecuencia, -1), fin: periodos[periodos.length - 1].inicio })
  const asistentesPeriodo = registrosPeriodo.reduce((total, registro) => total + (registro.total_asistentes || 0), 0)
  const promedioPeriodo = registrosPeriodo.length ? Math.round(asistentesPeriodo / registrosPeriodo.length) : 0
  const asistenciaPorPeriodo = periodos.map((periodo) => {
    const registrosDelPeriodo = registrosEnPeriodo(registros, periodo)
    const total = registrosDelPeriodo.reduce((suma, registro) => suma + (registro.total_asistentes || 0), 0)
    return { ...periodo, total, count: registrosDelPeriodo.length, registros: registrosDelPeriodo }
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
  const volumeCategories = categoriasConTotal.filter((categoria) => categoria.total > 0).slice(0, 4)
  const volumeMonths = asistenciaPorPeriodo.map((periodo) => ({ label: periodo.label, records: periodo.registros }))
  const volumeChartData = {
    labels: volumeMonths.map((month) => month.label),
    datasets: volumeCategories.map((category, index) => ({
      label: category.nombre,
      data: volumeMonths.map((month) => month.records.reduce((total, registro) => total + Number(registro.desglose?.[category.id] || 0), 0)),
      borderColor: ['#2a78d6', '#e06b35', '#008300', '#9a6bce'][index],
      backgroundColor: ['rgba(42,120,214,0.1)', 'rgba(224,107,53,0.08)', 'rgba(0,131,0,0.08)', 'rgba(154,107,206,0.08)'][index],
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
  const anteriorTotal = periodoAnterior.reduce((total, registro) => total + (registro.total_asistentes || 0), 0)
  const variacion = anteriorTotal ? Math.round(((asistentesPeriodo - anteriorTotal) / anteriorTotal) * 100) : null
  const pendingAlerts = alertas.filter((alerta) => !handledAlerts.includes(alerta.id))
  const visibleAlerts = showAllAlerts ? pendingAlerts : pendingAlerts.slice(0, 5)
  const activeAlertCount = Math.max(alertasTotal - handledAlerts.length, 0)

  const chartData = {
    labels: asistenciaPorPeriodo.map((periodo) => periodo.label),
    datasets: [
      ...categoriasConTotal.slice(0, 2).map((categoria, index) => ({ label: categoria.nombre, data: asistenciaPorPeriodo.map((periodo) => periodo.registros.reduce((total, registro) => total + Number(registro.desglose?.[categoria.id] || 0), 0)), borderColor: ['#2a78d6', '#e06b35'][index], backgroundColor: ['rgba(42,120,214,0.13)', 'rgba(224,107,53,0.1)'][index], fill: true, tension: 0.42, pointRadius: 2, pointHoverRadius: 5, pointBackgroundColor: '#ffffff', pointBorderWidth: 2, pointBorderColor: ['#2a78d6', '#e06b35'][index], borderWidth: 2.5 })),
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
        <label className="flex items-center gap-2 text-xs text-secondary">
          <span>Frecuencia</span>
          <select value={frecuencia} onChange={(event) => setFrecuencia(event.target.value)} className="input-field text-sm py-2">
            {FRECUENCIAS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
        </label>
      </section>

      <div className="grid sm:grid-cols-3 gap-3">
        <StatTile label={`Asistentes del ${nombrePeriodo}`} value={registros.length ? asistentesPeriodo : '—'} series={attendanceSeries} insight={registros.length ? `${registrosPeriodo.length} actividades alimentan este resultado.` : 'Esperando los primeros registros.'} />
        <StatTile label="Alertas activas" value={activeAlertCount || pendingAlerts.length} tone={activeAlertCount > 0 || pendingAlerts.length > 0 ? 'danger' : 'default'} insight={pendingAlerts.length ? 'Hay señales que requieren atención.' : 'No hay asuntos pendientes hoy.'} />
        <StatTile label="Promedio por actividad" value={registros.length ? promedioPeriodo : '—'} tone="success" series={averageSeries} insight={variacion === null ? 'Aún no hay un periodo comparable.' : `${variacion >= 0 ? 'Crecimiento' : 'Descenso'} del ${Math.abs(variacion)}% frente al periodo anterior.`} />
      </div>

      {loadError && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{loadError}</p>}

      {hasData && (
        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
          <div className="card chart-card p-5">
            <div className="flex justify-between gap-4 mb-4"><div><p className="eyebrow">Ritmo de asistencia</p><h2 className="font-medium mt-1">Lectura del periodo</h2></div><BarChart3 className="w-5 h-5 text-accent" /></div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div><p className="text-xs text-muted">Actividades</p><p className="text-2xl font-semibold mt-1">{registrosPeriodo.length}</p></div>
              <div><p className="text-xs text-muted">Asistentes</p><p className="text-2xl font-semibold mt-1">{asistentesPeriodo}</p></div>
              <div><p className="text-xs text-muted">Variación {nombreFrecuencia}</p><p className={`text-2xl font-semibold mt-1 ${variacion !== null && variacion < 0 ? 'text-danger' : 'text-success'}`}>{variacion === null ? '—' : `${variacion > 0 ? '+' : ''}${variacion}%`}</p></div>
            </div>
            <div className="h-28 mt-5"><Line data={periodChartData} options={periodChartOptions} /></div>
            <div className={`mt-5 flex items-start gap-3 rounded p-3 ${variacion !== null && variacion < 0 ? 'bg-danger-bg' : 'bg-success-bg'}`}>
              {variacion !== null && variacion < 0 ? <TrendingDown className="w-4 h-4 text-danger mt-0.5" /> : <TrendingUp className="w-4 h-4 text-success mt-0.5" />}
              <p className="text-sm text-secondary">{variacion === null ? 'Aún no hay un periodo anterior comparable. Sigue capturando datos para construir una señal confiable.' : variacion < 0 ? `La asistencia bajó ${Math.abs(variacion)}% frente al periodo anterior. Conviene revisar las actividades con menor participación.` : `La asistencia creció ${variacion}% frente al periodo anterior. Identifica qué actividad está impulsando este resultado.`}{ultimoRegistro && <span className="block text-xs text-muted mt-1">Último registro: {ultimoRegistro.fecha}</span>}</p>
            </div>
          </div>
          <div className="card chart-card p-5"><div className="flex items-start justify-between gap-4 mb-3"><div><p className="eyebrow">Composición</p><h2 className="font-medium mt-1">Dónde está el volumen</h2></div>{categoriaPrincipal && <span className="chart-highlight">{leadingShare}% líder</span>}</div>{categoriaPrincipal && totalCategorias > 0 ? <><div className="h-52"><Line data={volumeChartData} options={chartOptions} /></div><p className="summary-insight mt-3">{categoriaPrincipal.nombre} concentra {leadingShare}% de la asistencia registrada{leadingChange === null ? '.' : leadingChange >= 0 ? ` y creció ${leadingChange}% en las últimas seis ventanas.` : ` y bajó ${Math.abs(leadingChange)}% en las últimas seis ventanas.`}</p></> : <p className="text-sm text-muted py-10">Aún no hay desglose por categorías.</p>}</div>
        </section>
      )}

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
            <p className="text-sm text-secondary mt-1 leading-6">Cuando la aplicación móvil (PWA) registre actividades, aquí aparecerán las tendencias y alertas pastorales. Las métricas se mantienen vacías hasta tener información real.</p>
          </div>
        </section>
      )}

      <div className="card chart-card p-5">
        <div className="flex items-start justify-between gap-4 mb-5"><div><p className="eyebrow">Evolución {nombreFrecuencia}</p><h3 className="font-medium mt-1">Participación por categoría</h3></div><span className="chart-live-dot" title="Datos de registros reales" /></div>
        <div style={{ height: 260 }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex justify-between items-center mb-4"><div><h3 className="font-medium">Alertas pastorales</h3></div>{ultimoRegistro && <span className="text-xs text-muted">Último registro: {ultimoRegistro.fecha}</span>}</div>
        {pendingAlerts.length === 0 ? (
          <p className="text-sm text-muted">
            Sin alertas por ahora. Se generan al comparar la asistencia mensual por categoría cuando la caída supera el umbral configurado.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleAlerts.map((a) => (
              <div key={a.id} className={`alert-item ${a.prioridad === 'alta' ? 'alert-item-high' : ''}`}>
                <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 mb-1"><span className={`alert-priority ${a.prioridad === 'alta' ? 'alert-priority-high' : ''}`}>{a.prioridad || 'media'}</span><span className="text-[10px] uppercase tracking-[0.12em] text-muted">{ALERT_TYPE_LABELS[a.tipo] || 'Seguimiento'}</span></div><p className="text-sm font-medium text-ink">{a.titulo}</p></div><div className="flex gap-3 text-xs flex-shrink-0">{a.persona_id && <Link to={`/feligresia?persona=${a.persona_id}`} className="text-accent">Ver ficha</Link>}<button type="button" disabled={Boolean(handlingAlertId)} onClick={() => handleAlert(a)} className="text-accent disabled:opacity-50">{handlingAlertId === a.id ? 'Guardando...' : 'Atender'}</button></div></div>
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
