import { useCallback, useEffect, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import { FileBarChart2, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'
import { chartOptions as buildChartOptions, trendDataset, distributionDataset } from '../lib/chartTheme'
import ChartEmpty from '../components/ChartEmpty'
import ExportButtons from '../components/ExportButtons'
import { descargarCsv, descargarExcel, descargarPdf } from '../lib/reportExport'
import InfoTip from '../components/InfoTip'

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip)

const PAGE_SIZE = 50
const PERIODS = [['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['all', 'Todo']]

function formatDate(date) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin datos'
}

function totalActivities(rows) {
  return rows.reduce((sum, row) => sum + Number(row.registros || 0), 0)
}

function Metric({ label, value, detail, info }) {
  return <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1">{label}{info && <InfoTip texto={info} />}</p><p className="text-2xl font-semibold mt-3">{value}</p>{detail && <p className="text-xs text-muted mt-1">{detail}</p>}</div>
}

export default function ReportesOptimizado() {
  const { rolPrincipal } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const [summary, setSummary] = useState([])
  const [detail, setDetail] = useState([])
  const [detailTotal, setDetailTotal] = useState(0)
  const [detailPage, setDetailPage] = useState(0)
  const [periodo, setPeriodo] = useState('30')
  const [modulo, setModulo] = useState('todos')
  const [congregacion, setCongregacion] = useState('todas')
  const [categories, setCategories] = useState([])
  const [congregations, setCongregations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const desde = periodo === 'all' ? '2000-01-01' : (() => { const date = new Date(); date.setDate(date.getDate() - Number(periodo)); return date.toISOString().slice(0, 10) })()
    const summaryRequest = supabase.rpc('resumen_reportes', { p_congregacion_id: congregacionId || null, p_desde: desde })
    let detailRequest = supabase.from('registros_actividad').select('id, fecha, total_asistentes, desglose, nombre_actividad, congregacion_id, congregaciones(id, nombre), modulos(id, nombre_modulo), tipos_actividad(nombre)', { count: 'exact' }).order('fecha', { ascending: false }).order('id', { ascending: false }).range(detailPage * PAGE_SIZE, detailPage * PAGE_SIZE + PAGE_SIZE - 1)
    if (congregacionId) detailRequest = detailRequest.eq('congregacion_id', congregacionId)
    if (congregacion !== 'todas') detailRequest = detailRequest.eq('congregacion_id', congregacion)
    if (modulo !== 'todos') detailRequest = detailRequest.eq('modulo_id', modulo)
    if (periodo !== 'all') detailRequest = detailRequest.gte('fecha', desde)
    const [summaryResult, detailResult, categoryResult, congregationResult] = await Promise.all([
      summaryRequest,
      detailRequest,
      supabase.from('categorias_demograficas').select('id, nombre').order('orden'),
      supabase.from('congregaciones').select('id, nombre').order('nombre'),
    ])
    if (summaryResult.error || detailResult.error || categoryResult.error || congregationResult.error) setError('No se pudo cargar el reporte. Intenta nuevamente o contacta al administrador.')
    setSummary(summaryResult.data ?? [])
    setDetail(detailResult.data ?? [])
    setDetailTotal(detailResult.count ?? 0)
    setCategories(categoryResult.data ?? [])
    setCongregations(congregationResult.data ?? [])
    setLoading(false)
  }, [congregacionId, periodo, modulo, congregacion, detailPage])

  useEffect(() => { load() }, [load])
  useEffect(() => { setDetailPage(0) }, [periodo, modulo, congregacion])

  const filteredSummary = summary.filter((row) => (modulo === 'todos' || row.modulo_id === modulo) && (congregacion === 'todas' || row.congregacion_id === congregacion))
  const activities = totalActivities(filteredSummary)
  const total = filteredSummary.reduce((sum, row) => sum + Number(row.total_asistentes || 0), 0)
  const byModule = [...new Map(filteredSummary.map((row) => [row.modulo_id, { id: row.modulo_id, nombre: row.modulo_nombre, total: 0, cantidad: 0 }])).values()]
  filteredSummary.forEach((row) => { const item = byModule.find((module) => module.id === row.modulo_id); if (item) { item.total += Number(row.total_asistentes || 0); item.cantidad += Number(row.registros || 0) } })
  const byCongregation = [...new Map(filteredSummary.map((row) => [row.congregacion_id, { id: row.congregacion_id, nombre: row.congregacion_nombre, total: 0, cantidad: 0 }])).values()]
  filteredSummary.forEach((row) => { const item = byCongregation.find((item) => item.id === row.congregacion_id); if (item) { item.total += Number(row.total_asistentes || 0); item.cantidad += Number(row.registros || 0) } })
  byCongregation.sort((a, b) => b.total - a.total)
  const byDate = [...new Map(filteredSummary.map((row) => [row.fecha, { fecha: row.fecha, total: 0 }])).values()]
  filteredSummary.forEach((row) => { const item = byDate.find((date) => date.fecha === row.fecha); if (item) item.total += Number(row.total_asistentes || 0) })
  const categoryTotals = categories.map((category) => ({ ...category, total: filteredSummary.reduce((sum, row) => sum + Number(row.desglose?.[category.id] || 0), 0) })).filter((category) => category.total > 0).sort((a, b) => b.total - a.total)
  const pages = Math.max(1, Math.ceil(detailTotal / PAGE_SIZE))

  function exportMeta() {
    const periodoLabel = PERIODS.find(([value]) => value === periodo)?.[1] || periodo
    const filtros = [
      `Periodo: ${periodoLabel}`,
      congregacion !== 'todas' ? `Congregación: ${congregations.find((item) => item.id === congregacion)?.nombre || congregacion}` : null,
      modulo !== 'todos' ? `Módulo: ${byModule.find((item) => item.id === modulo)?.nombre || modulo}` : null,
    ].filter(Boolean)
    return [`Alcance: ${rolPrincipal?.nivel || ''}`, `Filtros: ${filtros.join(' · ')}`, `Página ${detailPage + 1} de ${pages}`]
  }

  function exportHeaders() {
    return { headers: ['Fecha', 'Congregación', 'Módulo', 'Actividad', 'Asistentes'], rows: detail.map((row) => [formatDate(row.fecha), row.congregaciones?.nombre || '', row.modulos?.nombre_modulo || '', row.nombre_actividad || row.tipos_actividad?.nombre || '', row.total_asistentes || 0]) }
  }

  function exportFilename(extension) {
    return `reporte-siga-${periodo === 'all' ? 'historico' : `${periodo}-dias`}-pagina-${detailPage + 1}.${extension}`
  }

  function exportCsv() {
    descargarCsv({ filename: exportFilename('csv'), titulo: 'Reporte de actividad', meta: exportMeta(), ...exportHeaders() })
  }

  function exportExcel() {
    descargarExcel({ filename: exportFilename('xlsx'), hoja: 'Reporte', titulo: 'Reporte de actividad', meta: exportMeta(), ...exportHeaders() })
  }

  function exportPdf() {
    descargarPdf({ filename: exportFilename('pdf'), titulo: 'Reporte de actividad', meta: exportMeta(), orientacion: 'landscape', ...exportHeaders() })
  }

  const chartOptions = buildChartOptions()
  const lineData = trendDataset(byDate.map((row) => formatDate(row.fecha)), byDate.map((row) => row.total), { label: 'Asistentes' })
  const barData = distributionDataset(byModule.map((row) => ({ label: row.nombre || 'Sin módulo', total: row.total })), { datasetLabel: 'Asistentes' })

  return <div className="page-shell">
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="eyebrow">Lectura de datos</p><h1 className="section-title">Reportes</h1><p className="text-sm text-secondary mt-1">Métricas completas y detalle cargado por páginas de 50 registros.</p></div><ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} disabled={loading || !detail.length} /></header>
    <section className="card p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[auto_1fr_220px_180px] xl:items-center"><div className="flex items-center gap-2 text-sm text-secondary"><Filter className="w-4 h-4" /> Filtros del análisis</div><div className="flex gap-2 flex-wrap">{PERIODS.map(([value, label]) => <button type="button" key={value} onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? 'bg-ink text-white border-ink' : 'border-border text-secondary'}`}>{label}</button>)}</div><select aria-label="Filtrar por congregación" className="input-field min-w-0" value={congregacion} onChange={(event) => setCongregacion(event.target.value)}><option value="todas">Todas las congregaciones</option>{congregations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><select aria-label="Filtrar por módulo" className="input-field min-w-0" value={modulo} onChange={(event) => setModulo(event.target.value)}><option value="todos">Todos los módulos</option>{byModule.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></section>
    {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
    <section className="grid sm:grid-cols-3 gap-3"><Metric label="Actividades registradas" value={activities} detail={`${formatDate(byDate.at(-1)?.fecha)} → ${formatDate(byDate[0]?.fecha)}`} info="Cuántas veces se tomó asistencia en el período, no cuántas personas asistieron." /><Metric label="Asistentes contabilizados" value={total} /><Metric label="Promedio por actividad" value={activities ? Math.round(total / activities) : 0} info="Asistentes contabilizados divididos entre actividades registradas." /></section>
    <section className="grid lg:grid-cols-2 gap-4"><section className="card chart-card p-5 min-h-[310px]"><p className="eyebrow">Señal de comportamiento</p><h2 className="font-medium mt-1">Evolución de asistentes</h2><div className="h-56 mt-5">{byDate.length ? <Line data={lineData} options={chartOptions} /> : <ChartEmpty message="Sin datos para estos filtros." />}</div></section><section className="card chart-card p-5 min-h-[310px]"><p className="eyebrow">Comparación operativa</p><h2 className="font-medium mt-1">Asistencia por módulo</h2><div className="h-56 mt-5">{byModule.length ? <Bar data={barData} options={{ ...chartOptions, indexAxis: 'y' }} /> : <ChartEmpty message="Sin datos para estos filtros." />}</div></section></section>
    {rolPrincipal?.nivel !== 'local' && (
      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border"><p className="eyebrow">Comparativa distrital</p><h2 className="font-medium mt-1">Asistencia por congregación</h2><p className="text-sm text-secondary mt-1">Suma del período seleccionado, de mayor a menor.</p></div>
        {byCongregation.length === 0 ? <p className="p-8 text-sm text-muted">Sin datos para estos filtros.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-5 py-3">Congregación</th><th className="font-normal px-5 py-3 text-right">Actividades</th><th className="font-normal px-5 py-3 text-right">Asistentes</th></tr></thead><tbody>{byCongregation.map((item) => <tr key={item.id} className="border-t border-border"><td className="px-5 py-3 font-medium">{item.nombre || 'Sin congregación'}</td><td className="px-5 py-3 text-right">{item.cantidad}</td><td className="px-5 py-3 text-right font-medium">{item.total}</td></tr>)}</tbody></table></div>}
      </section>
    )}
    <section className="card overflow-hidden"><div className="p-5 border-b border-border"><p className="eyebrow">Validación de datos</p><h2 className="font-medium mt-1">Detalle de registros</h2><p className="text-sm text-secondary mt-1">Mostrando página {detailPage + 1} de {pages} · {detailTotal} registros disponibles.</p></div>{loading ? <p className="p-8 text-sm text-muted" role="status">Cargando reporte...</p> : !detail.length ? <div className="p-10 text-center"><FileBarChart2 className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-sm text-secondary">Todavía no hay registros con estos filtros.</p></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Detalle de registros de asistencia</caption><thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-5 py-3">Fecha</th><th className="font-normal px-5 py-3">Módulo</th><th className="font-normal px-5 py-3">Actividad</th><th className="font-normal px-5 py-3 text-right">Asistentes</th></tr></thead><tbody>{detail.map((row) => <tr key={row.id} className="border-t border-border"><td className="px-5 py-3 whitespace-nowrap">{formatDate(row.fecha)}</td><td className="px-5 py-3">{row.modulos?.nombre_modulo || 'Sin módulo'}</td><td className="px-5 py-3 text-secondary">{row.nombre_actividad || row.tipos_actividad?.nombre || 'Sin actividad'}</td><td className="px-5 py-3 text-right font-medium">{row.total_asistentes || 0}</td></tr>)}</tbody></table></div>}<div className="p-4 border-t border-border flex items-center justify-between gap-3 text-xs text-secondary"><span>{categoryTotals.length} categorías con actividad</span><div className="flex gap-2"><button type="button" disabled={detailPage === 0 || loading} onClick={() => setDetailPage((page) => page - 1)} className="btn-secondary px-3">Anterior</button><button type="button" disabled={detailPage >= pages - 1 || loading} onClick={() => setDetailPage((page) => page + 1)} className="btn-secondary px-3">Siguiente</button></div></div></section>
  </div>
}
