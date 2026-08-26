import { useCallback, useEffect, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import { Download, FileBarChart2, Filter, TrendingDown, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip)

const PERIODS = [['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['all', 'Todo']]
const COLORS = ['#2a78d6', '#e06b35', '#008300', '#9a6bce']

function formatDate(date, options = { day: '2-digit', month: 'short' }) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', options) : 'Sin datos'
}

function Metric({ label, value, detail, tone = 'default' }) {
  return <div className={`stat-tile ${tone === 'danger' ? 'border-danger/30' : ''}`}><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{label}</p><p className={`text-2xl font-semibold mt-3 ${tone === 'danger' ? 'text-danger' : ''}`}>{value}</p>{detail && <p className="text-xs text-muted mt-1">{detail}</p>}</div>
}

function ChartPanel({ eyebrow, title, description, children, className = '' }) {
  return <section className={`card chart-card p-5 ${className}`}><div><p className="eyebrow">{eyebrow}</p><h2 className="font-medium mt-1">{title}</h2><p className="text-sm text-secondary mt-1">{description}</p></div>{children}</section>
}

export default function Reportes() {
  const { rolPrincipal } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const [registros, setRegistros] = useState([])
  const [periodo, setPeriodo] = useState('30')
  const [modulo, setModulo] = useState('todos')
  const [congregacion, setCongregacion] = useState('todas')
  const [categorias, setCategorias] = useState([])
  const [congregaciones, setCongregaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase.from('registros_actividad').select('id, fecha, total_asistentes, desglose, congregacion_id, congregaciones(id, nombre), modulos(id, nombre_modulo), tipos_actividad(nombre)').order('fecha', { ascending: false })
    if (congregacionId) query = query.eq('congregacion_id', congregacionId)
    if (periodo !== 'all') {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - Number(periodo))
      query = query.gte('fecha', `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`)
    }
    const [{ data, error: recordsError }, { data: categories, error: categoriesError }, { data: congregations, error: congregationsError }] = await Promise.all([
      query,
      supabase.from('categorias_demograficas').select('id, nombre').order('orden'),
      supabase.from('congregaciones').select('id, nombre').order('nombre'),
    ])
    if (recordsError || categoriesError || congregationsError) setError('No se pudo cargar todo el reporte. Revisa la conexión con Supabase.')
    setRegistros(data ?? [])
    setCategorias(categories ?? [])
    setCongregaciones(congregations ?? [])
    setLoaded(true)
    setLoading(false)
  }, [congregacionId, periodo])

  useEffect(() => { load() }, [load])

  const modulos = [...new Map(registros.map((registro) => [registro.modulos?.id, registro.modulos?.nombre_modulo])).entries()]
  const registrosFiltrados = registros.filter((registro) => (modulo === 'todos' || registro.modulos?.id === modulo) && (congregacion === 'todas' || registro.congregacion_id === congregacion))
  const total = registrosFiltrados.reduce((sum, registro) => sum + Number(registro.total_asistentes || 0), 0)
  const porModulo = modulos.map(([id, nombre]) => ({ id, nombre: nombre || 'Sin módulo', total: registrosFiltrados.filter((registro) => registro.modulos?.id === id).reduce((sum, registro) => sum + Number(registro.total_asistentes || 0), 0), cantidad: registrosFiltrados.filter((registro) => registro.modulos?.id === id).length })).filter((item) => item.cantidad > 0).sort((a, b) => b.total - a.total)
  const porCategoria = categorias.map((categoria) => ({ ...categoria, total: registrosFiltrados.reduce((sum, registro) => sum + Number(registro.desglose?.[categoria.id] || 0), 0) })).filter((categoria) => categoria.total > 0).sort((a, b) => b.total - a.total)
  const totalCategorias = porCategoria.reduce((sum, categoria) => sum + categoria.total, 0)
  const porFecha = [...new Set(registrosFiltrados.map((registro) => registro.fecha))].sort().map((fecha) => ({ fecha, total: registrosFiltrados.filter((registro) => registro.fecha === fecha).reduce((sum, registro) => sum + Number(registro.total_asistentes || 0), 0) }))
  const promedioReciente = porFecha.length ? porFecha.slice(-3).reduce((sum, item) => sum + item.total, 0) / Math.min(3, porFecha.length) : 0
  const promedioAnterior = porFecha.length > 3 ? porFecha.slice(0, -3).reduce((sum, item) => sum + item.total, 0) / (porFecha.length - 3) : 0
  const variacion = promedioAnterior ? Math.round(((promedioReciente - promedioAnterior) / promedioAnterior) * 100) : null
  const mayorModulo = porModulo[0]
  const insight = !registrosFiltrados.length ? 'No hay actividad para analizar con estos filtros.' : variacion !== null && variacion <= -20 ? `La asistencia promedio reciente cayó ${Math.abs(variacion)}%. Conviene revisar las últimas actividades y activar seguimiento.` : mayorModulo ? `${mayorModulo.nombre} lidera el volumen con ${mayorModulo.total} asistentes. Compara su frecuencia con los módulos de menor actividad.` : 'Los datos aún no permiten identificar una tendencia confiable.'
  const lineData = { labels: porFecha.map((item) => formatDate(item.fecha)), datasets: [{ label: 'Asistentes', data: porFecha.map((item) => item.total), borderColor: COLORS[0], backgroundColor: 'rgba(42,120,214,0.14)', fill: true, tension: 0.38, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: '#fff', pointBorderColor: COLORS[0], pointBorderWidth: 2, borderWidth: 2.5 }] }
  const barData = { labels: porModulo.map((item) => item.nombre), datasets: [{ label: 'Asistentes', data: porModulo.map((item) => item.total), backgroundColor: COLORS, borderRadius: 4, barThickness: 16 }] }
  const lineOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111820', padding: 10 } }, scales: { y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(82,81,78,0.1)' }, ticks: { color: '#898781', font: { size: 10 } } }, x: { border: { display: false }, grid: { display: false }, ticks: { color: '#898781', font: { size: 10 }, maxRotation: 0 } } } }
  const barOptions = { ...lineOptions, indexAxis: 'y', scales: { x: lineOptions.scales.y, y: { ...lineOptions.scales.x, ticks: { ...lineOptions.scales.x.ticks, autoSkip: false } } } }

  function exportar() {
    const rows = [['Fecha', 'Congregación', 'Módulo', 'Actividad', 'Asistentes']]
    registrosFiltrados.forEach((registro) => rows.push([registro.fecha, registro.congregaciones?.nombre || '', registro.modulos?.nombre_modulo || '', registro.tipos_actividad?.nombre || '', registro.total_asistentes || 0]))
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-siga-${periodo === 'all' ? 'historico' : `${periodo}-dias`}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <div className="page-shell">
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="eyebrow">Lectura de datos</p><h1 className="section-title">Reportes</h1><p className="text-sm text-secondary mt-1">Una lectura visual para detectar cambios y decidir dónde actuar.</p></div><button className="btn-secondary" disabled={loading || !registrosFiltrados.length} onClick={exportar}><Download className="w-4 h-4" /> Exportar CSV</button></header>
    <section className="card p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[auto_1fr_220px_180px] xl:items-center"><div className="flex items-center gap-2 text-sm text-secondary"><Filter className="w-4 h-4" /> Filtros del análisis</div><div role="group" aria-label="Filtrar por periodo" className="flex gap-2 flex-wrap">{PERIODS.map(([value, label]) => <button type="button" aria-pressed={periodo === value} key={value} onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border whitespace-nowrap ${periodo === value ? 'bg-ink text-white border-ink' : 'border-border text-secondary'}`}>{label}</button>)}</div><select aria-label="Filtrar por congregación" className="input-field min-w-0" value={congregacion} onChange={(event) => setCongregacion(event.target.value)}><option value="todas">Todas las congregaciones</option>{congregaciones.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><select aria-label="Filtrar por módulo" className="input-field min-w-0" value={modulo} onChange={(event) => setModulo(event.target.value)}><option value="todos">Todos los módulos</option>{modulos.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></section>
    {error && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={load} className="btn-secondary text-xs self-start sm:self-auto">Reintentar</button></div>}
    <section className="grid sm:grid-cols-3 gap-3"><Metric label="Actividades registradas" value={registrosFiltrados.length} detail={`${formatDate(registrosFiltrados.at(-1)?.fecha)} → ${formatDate(registrosFiltrados[0]?.fecha)}`} /><Metric label="Asistentes contabilizados" value={total} /><Metric label="Promedio por actividad" value={registrosFiltrados.length ? Math.round(total / registrosFiltrados.length) : 0} /></section>
    <ChartPanel eyebrow="Señal de comportamiento" title="Evolución de asistentes" description="Identifica cambios de ritmo en las actividades filtradas." className="min-h-[330px]"><div className="h-56 mt-5">{porFecha.length ? <Line data={lineData} options={lineOptions} /> : <div className="h-full flex items-center justify-center text-sm text-muted">Sin suficiente actividad para mostrar evolución.</div>}</div></ChartPanel>
    <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4 items-start"><ChartPanel eyebrow="Comparación operativa" title="Asistencia por módulo" description="Detecta dónde se concentra el volumen y dónde puede existir una alerta."><div className="h-56 mt-5">{porModulo.length ? <Bar data={barData} options={barOptions} /> : <div className="h-full flex items-center justify-center text-sm text-muted">Sin módulos para comparar.</div>}</div></ChartPanel><section className={`card p-5 ${variacion !== null && variacion <= -20 ? 'border-danger bg-danger-bg/30' : ''}`}><div className="flex items-start gap-3"><div className={`w-9 h-9 rounded flex items-center justify-center ${variacion !== null && variacion <= -20 ? 'bg-danger-bg text-danger' : 'bg-accent-bg text-accent'}`}>{variacion !== null && variacion <= -20 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}</div><div><p className="eyebrow">Lectura para decidir</p><h2 className="font-medium mt-1">Insight operativo</h2><p className="text-sm text-secondary mt-2 leading-6">{insight}</p></div></div>{mayorModulo && <div className="mt-5 pt-4 border-t border-border"><p className="text-xs text-muted">Módulo líder</p><p className="text-lg font-semibold mt-1">{mayorModulo.nombre}</p><p className="text-xs text-secondary mt-1">{mayorModulo.total} asistentes · {mayorModulo.cantidad} {mayorModulo.cantidad === 1 ? 'actividad' : 'actividades'}</p></div>}</section></section>
    <section className="grid lg:grid-cols-2 gap-4 items-start"><ChartPanel eyebrow="Lectura de composición" title="Distribución por categoría" description="Observa cómo se reparte el volumen y prioriza los grupos con menor participación."><div className="flex flex-col gap-3 mt-5">{porCategoria.length ? porCategoria.slice(0, 6).map((categoria) => <div key={categoria.id}><div className="flex justify-between text-xs mb-1"><span>{categoria.nombre}</span><strong>{categoria.total} <span className="text-muted font-normal">{totalCategorias ? `${Math.round((categoria.total / totalCategorias) * 100)}%` : ''}</span></strong></div><div className="h-2 bg-surface-1 rounded overflow-hidden"><div className="h-full bg-warning rounded" style={{ width: `${Math.max(3, (categoria.total / porCategoria[0].total) * 100)}%` }} /></div></div>) : <p className="text-sm text-muted py-8">Sin desglose disponible.</p>}</div></ChartPanel><section className="card overflow-hidden"><div className="p-5 border-b border-border"><p className="eyebrow">Validación de datos</p><h2 className="font-medium mt-1">Detalle de registros</h2><p className="text-sm text-secondary mt-1">Consulta el origen de las métricas aplicadas al análisis.</p></div>{loading ? <p className="p-8 text-sm text-muted" role="status">Cargando reporte...</p> : !loaded ? <p className="p-8 text-sm text-muted">No se pudo cargar el reporte.</p> : registrosFiltrados.length === 0 ? <div className="p-10 text-center"><FileBarChart2 className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-sm text-secondary">Todavía no hay registros con estos filtros.</p></div> : <div className="max-h-[330px] overflow-auto"><table className="w-full text-sm"><caption className="sr-only">Detalle de registros de asistencia</caption><thead className="sticky top-0"><tr className="text-left text-muted bg-surface-1"><th scope="col" className="font-normal px-5 py-3">Fecha</th><th scope="col" className="font-normal px-5 py-3">Módulo</th><th scope="col" className="font-normal px-5 py-3">Actividad</th><th scope="col" className="font-normal px-5 py-3 text-right">Asistentes</th></tr></thead><tbody>{registrosFiltrados.map((registro) => <tr key={registro.id} className="border-t border-border"><td className="px-5 py-3 whitespace-nowrap">{formatDate(registro.fecha, { day: '2-digit', month: 'short', year: 'numeric' })}</td><td className="px-5 py-3">{registro.modulos?.nombre_modulo || '—'}</td><td className="px-5 py-3 text-secondary">{registro.tipos_actividad?.nombre || '—'}</td><td className="px-5 py-3 text-right font-medium">{registro.total_asistentes}</td></tr>)}</tbody></table></div>}</section></section>
  </div>
}
