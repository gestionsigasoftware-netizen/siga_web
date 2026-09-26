import { useCallback, useEffect, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import { FileBarChart2, Filter } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from '../hooks/useMiRol'
import { chartOptions as buildChartOptions, trendDataset, distributionDataset } from '../lib/chartTheme'
import ChartEmpty from '../components/ChartEmpty'
import ExportButtons from '../components/ExportButtons'
import { descargarCsv, descargarExcel, descargarPdf } from '../lib/reportExport'
import InfoTip from '../components/InfoTip'

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip)

const PAGE_SIZE = 50
const PERIOD_CODES = ['30', '90', 'all']

function totalActivities(rows) {
  return rows.reduce((sum, row) => sum + Number(row.registros || 0), 0)
}

function Metric({ label, value, detail, info }) {
  return <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1">{label}{info && <InfoTip texto={info} />}</p><p className="text-2xl font-semibold mt-3">{value}</p>{detail && <p className="text-xs text-muted mt-1">{detail}</p>}</div>
}

export default function ReportesOptimizado() {
  const { t } = useTranslation()
  function formatDate(date) {
    return date ? new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : t('reportesOptimizado.sinDatosFecha')
  }
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
    const desde = periodo === 'all' ? '2000-01-01' : (() => { const date = new Date(); date.setDate(date.getDate() - Number(periodo)); return fechaBogota(date) })()
    const summaryRequest = supabase.rpc('resumen_reportes', { p_congregacion_id: congregacionId || null, p_desde: desde })
    // igual que en el select de congregaciones de abajo: el embed pasa a
    // `!inner` solo para distrital, para que el filtro por distrito_id
    // realmente acote las filas de nivel superior (un embed normal sin
    // !inner no restringe el resultset, solo el objeto anidado).
    const detailColumns = `id, fecha, total_asistentes, desglose, nombre_actividad, congregacion_id, congregaciones${rolPrincipal?.nivel === 'distrital' ? '!inner' : ''}(id, nombre${rolPrincipal?.nivel === 'distrital' ? ', distrito_id' : ''}), modulos(id, nombre_modulo), tipos_actividad(nombre)`
    let detailRequest = supabase.from('registros_actividad').select(detailColumns, { count: 'exact' }).order('fecha', { ascending: false }).order('id', { ascending: false }).range(detailPage * PAGE_SIZE, detailPage * PAGE_SIZE + PAGE_SIZE - 1)
    if (congregacionId) detailRequest = detailRequest.eq('congregacion_id', congregacionId)
    if (rolPrincipal?.nivel === 'distrital') detailRequest = detailRequest.eq('congregaciones.distrito_id', rolPrincipal.distrito_id)
    if (congregacion !== 'todas') detailRequest = detailRequest.eq('congregacion_id', congregacion)
    if (modulo !== 'todos') detailRequest = detailRequest.eq('modulo_id', modulo)
    if (periodo !== 'all') detailRequest = detailRequest.gte('fecha', desde)
    // El selector "Filtrar por congregación" debe acotarse al alcance del
    // ROL ACTIVO (rolPrincipal), no solo a RLS: una cuenta que además
    // tiene un rol superior (ej. super_admin que también es pastor local)
    // sigue pasando la RLS de `congregaciones` para TODO el país aunque
    // esté "viendo como" local -- mismo patrón corregido antes en
    // AuditoriaFeligresia.jsx (ver docs/fixes/auditoria-feligresia-fuga-multi-rol-2026-09-23.md).
    let congregationsRequest = supabase.from('congregaciones').select('id, nombre').order('nombre')
    if (rolPrincipal?.nivel === 'local') congregationsRequest = congregationsRequest.eq('id', congregacionId)
    if (rolPrincipal?.nivel === 'distrital') congregationsRequest = congregationsRequest.eq('distrito_id', rolPrincipal.distrito_id)
    const [summaryResult, detailResult, categoryResult, congregationResult] = await Promise.all([
      summaryRequest,
      detailRequest,
      supabase.from('categorias_demograficas').select('id, nombre').order('orden'),
      congregationsRequest,
    ])
    if (summaryResult.error || detailResult.error || categoryResult.error || congregationResult.error) setError(t('reportesOptimizado.errorCargar'))
    setSummary(summaryResult.data ?? [])
    setDetail(detailResult.data ?? [])
    setDetailTotal(detailResult.count ?? 0)
    setCategories(categoryResult.data ?? [])
    setCongregations(congregationResult.data ?? [])
    setLoading(false)
  }, [congregacionId, rolPrincipal?.nivel, rolPrincipal?.distrito_id, periodo, modulo, congregacion, detailPage])

  // Antes se llamaba load() en cuanto el componente montaba, sin esperar a
  // que useMiRol() resolviera rolPrincipal -- en esa primera llamada
  // congregacionId todavia era undefined, asi que el RPC resumen_reportes
  // se disparaba con p_congregacion_id: null. Para una cuenta con mas de
  // un rol (ej. super_admin que tambien es pastor local), eso devolvia un
  // instante de datos del pais entero (visible como un parpadeo con una
  // barra extra en el grafico) antes de que la llamada correctamente
  // acotada lo reemplazara. Mismo patron multi-rol de hoy, esta vez como
  // condicion de carrera en vez de falta de filtro.
  useEffect(() => { if (rolPrincipal) load() }, [load, rolPrincipal])
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
    const periodoLabel = t(`reportesOptimizado.periodos.${periodo}`)
    const filtros = [
      t('reportesOptimizado.export.periodoLabel', { valor: periodoLabel }),
      congregacion !== 'todas' ? t('reportesOptimizado.export.congregacionLabel', { valor: congregations.find((item) => item.id === congregacion)?.nombre || congregacion }) : null,
      modulo !== 'todos' ? t('reportesOptimizado.export.moduloLabel', { valor: byModule.find((item) => item.id === modulo)?.nombre || modulo }) : null,
    ].filter(Boolean)
    return [t('reportesOptimizado.export.alcance', { nivel: rolPrincipal?.nivel || '' }), t('reportesOptimizado.export.filtros', { filtros: filtros.join(' · ') }), t('reportesOptimizado.export.pagina', { pagina: detailPage + 1, total: pages })]
  }

  function exportHeaders() {
    return { headers: [t('reportesOptimizado.colFecha'), t('reportesOptimizado.colCongregacion'), t('reportesOptimizado.colModulo'), t('reportesOptimizado.colActividad'), t('reportesOptimizado.colAsistentes')], rows: detail.map((row) => [formatDate(row.fecha), row.congregaciones?.nombre || '', row.modulos?.nombre_modulo || '', row.nombre_actividad || row.tipos_actividad?.nombre || '', row.total_asistentes || 0]) }
  }

  function exportFilename(extension) {
    return `reporte-siga-${periodo === 'all' ? 'historico' : `${periodo}-dias`}-pagina-${detailPage + 1}.${extension}`
  }

  function exportCsv() {
    descargarCsv({ filename: exportFilename('csv'), titulo: t('reportesOptimizado.export.tituloReporte'), meta: exportMeta(), ...exportHeaders() })
  }

  function exportResumen() {
    return {
      kpis: [
        { label: t('reportesOptimizado.actividadesRegistradas'), value: activities },
        { label: t('reportesOptimizado.export.asistentesAcumulados'), value: total },
        { label: t('reportesOptimizado.promedioPorActividad'), value: activities ? Math.round(total / activities) : 0 },
      ],
      desgloses: [
        { titulo: t('reportesOptimizado.export.porModulo'), items: byModule.map((item) => ({ label: item.nombre, valor: item.total })) },
        { titulo: t('reportesOptimizado.export.porCongregacion'), items: byCongregation.slice(0, 8).map((item) => ({ label: item.nombre, valor: item.total })) },
      ],
    }
  }

  function exportExcel() {
    descargarExcel({ filename: exportFilename('xlsx'), hoja: t('reportesOptimizado.export.hoja'), titulo: t('reportesOptimizado.export.tituloReporte'), meta: exportMeta(), resumen: exportResumen(), ...exportHeaders() })
  }

  function exportPdf() {
    descargarPdf({ filename: exportFilename('pdf'), titulo: t('reportesOptimizado.export.tituloReporte'), meta: exportMeta(), orientacion: 'landscape', resumen: exportResumen(), ...exportHeaders() })
  }

  const chartOptions = buildChartOptions()
  const lineData = trendDataset(byDate.map((row) => formatDate(row.fecha)), byDate.map((row) => row.total), { label: t('reportesOptimizado.asistentesSeries') })
  const barData = distributionDataset(byModule.map((row) => ({ label: row.nombre || t('reportesOptimizado.sinModulo'), total: row.total })), { datasetLabel: t('reportesOptimizado.asistentesSeries') })

  return <div className="page-shell">
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="eyebrow">{t('reportesOptimizado.eyebrow')}</p><h1 className="section-title">{t('reportesOptimizado.titulo')}</h1><p className="text-sm text-secondary mt-1">{t('reportesOptimizado.subtitulo')}</p></div><ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} disabled={loading || !detail.length} /></header>
    <section className={`card p-4 grid gap-3 sm:grid-cols-2 xl:items-center ${rolPrincipal?.nivel === 'local' ? 'xl:grid-cols-[auto_1fr_180px]' : 'xl:grid-cols-[auto_1fr_220px_180px]'}`}><div className="flex items-center gap-2 text-sm text-secondary"><Filter className="w-4 h-4" /> {t('reportesOptimizado.filtrosAnalisis')}</div><div className="flex gap-2 flex-wrap">{PERIOD_CODES.map((value) => <button type="button" key={value} onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? 'bg-night text-white border-night' : 'border-border text-secondary'}`}>{t(`reportesOptimizado.periodos.${value}`)}</button>)}</div>{rolPrincipal?.nivel !== 'local' && <select aria-label={t('reportesOptimizado.ariaCongregacion')} className="input-field min-w-0" value={congregacion} onChange={(event) => setCongregacion(event.target.value)}><option value="todas">{t('reportesOptimizado.todasCongregaciones')}</option>{congregations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>}<select aria-label={t('reportesOptimizado.ariaModulo')} className="input-field min-w-0" value={modulo} onChange={(event) => setModulo(event.target.value)}><option value="todos">{t('reportesOptimizado.todosModulos')}</option>{byModule.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></section>
    {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
    <section className="grid sm:grid-cols-3 gap-3"><Metric label={t('reportesOptimizado.actividadesRegistradas')} value={activities} detail={`${formatDate(byDate.at(-1)?.fecha)} → ${formatDate(byDate[0]?.fecha)}`} info={t('reportesOptimizado.actividadesTip')} /><Metric label={t('reportesOptimizado.asistentesContabilizados')} value={total} /><Metric label={t('reportesOptimizado.promedioPorActividad')} value={activities ? Math.round(total / activities) : 0} info={t('reportesOptimizado.promedioTip')} /></section>
    <section className="grid lg:grid-cols-2 gap-4"><section className="card chart-card p-5 min-h-[310px]"><p className="eyebrow">{t('reportesOptimizado.senalComportamiento')}</p><h2 className="font-medium mt-1">{t('reportesOptimizado.evolucionAsistentes')}</h2><div className="h-56 mt-5">{byDate.length ? <Line data={lineData} options={chartOptions} /> : <ChartEmpty message={t('reportesOptimizado.sinDatosFiltros')} />}</div></section><section className="card chart-card p-5 min-h-[310px]"><p className="eyebrow">{t('reportesOptimizado.comparacionOperativa')}</p><h2 className="font-medium mt-1">{t('reportesOptimizado.asistenciaPorModulo')}</h2><div className="h-56 mt-5">{byModule.length ? <Bar data={barData} options={{ ...chartOptions, indexAxis: 'y' }} /> : <ChartEmpty message={t('reportesOptimizado.sinDatosFiltros')} />}</div></section></section>
    {rolPrincipal?.nivel !== 'local' && (
      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border"><p className="eyebrow">{t('reportesOptimizado.comparativaDistrital')}</p><h2 className="font-medium mt-1">{t('reportesOptimizado.asistenciaPorCongregacion')}</h2><p className="text-sm text-secondary mt-1">{t('reportesOptimizado.sumaPeriodo')}</p></div>
        {byCongregation.length === 0 ? <p className="p-8 text-sm text-muted">{t('reportesOptimizado.sinDatosFiltros')}</p> : <div className="table-scroll"><table className="w-full text-sm"><thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-5 py-3">{t('reportesOptimizado.colCongregacion')}</th><th className="font-normal px-5 py-3 text-right">{t('reportesOptimizado.colActividades')}</th><th className="font-normal px-5 py-3 text-right">{t('reportesOptimizado.colAsistentes')}</th></tr></thead><tbody>{byCongregation.map((item) => <tr key={item.id} className="border-t border-border"><td className="px-5 py-3 font-medium">{item.nombre || t('reportesOptimizado.sinCongregacion')}</td><td className="px-5 py-3 text-right">{item.cantidad}</td><td className="px-5 py-3 text-right font-medium">{item.total}</td></tr>)}</tbody></table></div>}
      </section>
    )}
    <section className="card overflow-hidden"><div className="p-5 border-b border-border"><p className="eyebrow">{t('reportesOptimizado.validacionDatos')}</p><h2 className="font-medium mt-1">{t('reportesOptimizado.detalleRegistros')}</h2><p className="text-sm text-secondary mt-1">{t('reportesOptimizado.mostrandoPagina', { pagina: detailPage + 1, total: pages, cantidad: detailTotal })}</p></div>{loading ? <p className="p-8 text-sm text-muted" role="status">{t('reportesOptimizado.cargandoReporte')}</p> : !detail.length ? <div className="p-10 text-center"><FileBarChart2 className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-sm text-secondary">{t('reportesOptimizado.sinRegistros')}</p></div> : <div className="table-scroll"><table className="w-full text-sm"><caption className="sr-only">{t('reportesOptimizado.detalleRegistros')}</caption><thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-5 py-3">{t('reportesOptimizado.colFecha')}</th><th className="font-normal px-5 py-3">{t('reportesOptimizado.colModulo')}</th><th className="font-normal px-5 py-3">{t('reportesOptimizado.colActividad')}</th><th className="font-normal px-5 py-3 text-right">{t('reportesOptimizado.colAsistentes')}</th></tr></thead><tbody>{detail.map((row) => <tr key={row.id} className="border-t border-border"><td className="px-5 py-3 whitespace-nowrap">{formatDate(row.fecha)}</td><td className="px-5 py-3">{row.modulos?.nombre_modulo || t('reportesOptimizado.sinModulo')}</td><td className="px-5 py-3 text-secondary">{row.nombre_actividad || row.tipos_actividad?.nombre || t('reportesOptimizado.sinActividad')}</td><td className="px-5 py-3 text-right font-medium">{row.total_asistentes || 0}</td></tr>)}</tbody></table></div>}<div className="p-4 border-t border-border flex items-center justify-between gap-3 text-xs text-secondary"><span>{t('reportesOptimizado.categoriasConActividad', { cantidad: categoryTotals.length })}</span><div className="flex gap-2"><button type="button" disabled={detailPage === 0 || loading} onClick={() => setDetailPage((page) => page - 1)} className="btn-secondary px-3">{t('reportesOptimizado.anterior')}</button><button type="button" disabled={detailPage >= pages - 1 || loading} onClick={() => setDetailPage((page) => page + 1)} className="btn-secondary px-3">{t('reportesOptimizado.siguiente')}</button></div></div></section>
  </div>
}
