import { useEffect, useState } from 'react'
import { Download, FileBarChart2, Filter, TrendingDown, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

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
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      let query = supabase.from('registros_actividad').select('id, fecha, total_asistentes, desglose, novedades, congregacion_id, congregaciones(id, nombre, distrito_id, distritos(nombre)), modulos(id, nombre_modulo), tipos_actividad(nombre)').order('fecha', { ascending: false })
      if (congregacionId) query = query.eq('congregacion_id', congregacionId)
      if (periodo !== 'all') query = query.gte('fecha', new Date(Date.now() - Number(periodo) * 86400000).toISOString().slice(0, 10))
      const [{ data, error: registrosError }, { data: categoriasData, error: categoriasError }, { data: congregacionesData, error: congregacionesError }] = await Promise.all([
        query,
        supabase.from('categorias_demograficas').select('id, nombre').order('orden'),
        supabase.from('congregaciones').select('id, nombre, distrito_id, distritos(nombre)').order('nombre'),
      ])
      if (registrosError || categoriasError || congregacionesError) setError('No se pudo cargar todo el reporte. Revisa la conexión con Supabase.')
      setRegistros(data ?? [])
      setCategorias(categoriasData ?? [])
      setCongregaciones(congregacionesData ?? [])
      setLoading(false)
    }
    load()
  }, [congregacionId, periodo])

  const modulos = [...new Map(registros.map((registro) => [registro.modulos?.id, registro.modulos?.nombre_modulo])).entries()]
  const registrosFiltrados = registros.filter((registro) => (modulo === 'todos' || registro.modulos?.id === modulo) && (congregacion === 'todas' || registro.congregacion_id === congregacion))
  const total = registrosFiltrados.reduce((sum, registro) => sum + (registro.total_asistentes || 0), 0)
  const porModulo = modulos.map(([id, nombre]) => ({ id, nombre: nombre || 'Sin módulo', total: registros.filter((registro) => registro.modulos?.id === id).reduce((sum, registro) => sum + (registro.total_asistentes || 0), 0), cantidad: registros.filter((registro) => registro.modulos?.id === id).length })).sort((a, b) => b.total - a.total)
  const porCategoria = categorias.map((categoria) => ({ ...categoria, total: registrosFiltrados.reduce((sum, registro) => sum + Number(registro.desglose?.[categoria.id] || 0), 0) })).filter((categoria) => categoria.total > 0).sort((a, b) => b.total - a.total)
  const actividadPromedio = registrosFiltrados.length ? Math.round(total / registrosFiltrados.length) : 0
  const primerPeriodo = registrosFiltrados.length ? registrosFiltrados[registrosFiltrados.length - 1].fecha : null
  const ultimaFecha = registrosFiltrados.length ? registrosFiltrados[0].fecha : null
  const mayorModulo = porModulo[0]

  return <div className="page-shell">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="eyebrow">Lectura de datos</p><h1 className="section-title">Reportes</h1><p className="text-sm text-secondary mt-1">Convierte los registros de la PWA en señales para actuar.</p></div><button className="btn-secondary" disabled title="Disponible próximamente"><Download className="w-4 h-4" /> Exportar próximamente</button></div>
    <div className="card p-4 flex flex-col md:flex-row md:items-center gap-4"><div className="flex items-center gap-2 text-sm text-secondary"><Filter className="w-4 h-4" /> Filtrar análisis</div><div className="flex gap-2 flex-wrap">{[['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['all', 'Todo']].map(([value, label]) => <button key={value} onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? 'bg-ink text-white border-ink' : 'border-border text-secondary'}`}>{label}</button>)}</div><select aria-label="Filtrar por congregación" className="input-field md:max-w-xs md:ml-auto" value={congregacion} onChange={(event) => setCongregacion(event.target.value)}><option value="todas">Todas las congregaciones</option>{congregaciones.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><select aria-label="Filtrar por módulo" className="input-field md:max-w-xs" value={modulo} onChange={(event) => setModulo(event.target.value)}><option value="todos">Todos los módulos</option>{modulos.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></div>
    {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
    <div className="grid sm:grid-cols-3 gap-3"><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Actividades registradas</p><p className="text-2xl font-medium mt-3">{registrosFiltrados.length}</p><p className="text-xs text-muted mt-1">{primerPeriodo || 'Sin datos'} {ultimaFecha && `→ ${ultimaFecha}`}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Asistentes contabilizados</p><p className="text-2xl font-medium mt-3">{total}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Promedio por actividad</p><p className="text-2xl font-medium mt-3">{actividadPromedio}</p></div></div>
    {!loading && registrosFiltrados.length > 0 && <section className="grid lg:grid-cols-2 gap-4"><div className="card p-5"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center"><TrendingUp className="w-4 h-4" /></div><div><h2 className="font-medium">Hallazgo principal</h2><p className="text-sm text-secondary mt-1 leading-6">{mayorModulo ? `${mayorModulo.nombre} concentra ${mayorModulo.total} asistentes en ${mayorModulo.cantidad} actividades. Es el mejor punto de partida para entender qué prácticas están funcionando.` : 'Aún no hay suficiente información para identificar un patrón.'}</p></div></div></div><div className="card p-5"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded bg-warning-bg text-warning flex items-center justify-center"><TrendingDown className="w-4 h-4" /></div><div className="w-full"><h2 className="font-medium">Distribución por categoría</h2><p className="text-sm text-secondary mt-1 mb-4">Prioriza conversaciones donde el volumen sea menor.</p>{porCategoria.length ? <div className="flex flex-col gap-3">{porCategoria.slice(0, 4).map((categoria) => <div key={categoria.id}><div className="flex justify-between text-xs mb-1"><span>{categoria.nombre}</span><strong>{categoria.total}</strong></div><div className="h-1.5 bg-surface-1 rounded overflow-hidden"><div className="h-full bg-warning rounded" style={{ width: `${Math.max(3, (categoria.total / porCategoria[0].total) * 100)}%` }} /></div></div>)}</div> : <p className="text-sm text-muted">Sin desglose disponible.</p>}</div></div></div></section>}
    <div className="card overflow-hidden"><div className="p-5 border-b border-border"><h2 className="font-medium">Detalle de registros</h2><p className="text-sm text-secondary mt-1">Consulta el origen de las métricas y valida los datos recibidos.</p></div>{loading ? <p className="p-8 text-sm text-muted">Cargando reporte...</p> : registrosFiltrados.length === 0 ? <div className="p-10 text-center"><FileBarChart2 className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-sm text-secondary">Todavía no hay registros con estos filtros.</p></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-5 py-3">Fecha</th><th className="font-normal px-5 py-3">Módulo</th><th className="font-normal px-5 py-3">Actividad</th><th className="font-normal px-5 py-3 text-right">Asistentes</th></tr></thead><tbody>{registrosFiltrados.map((registro) => <tr key={registro.id} className="border-t border-border"><td className="px-5 py-3">{registro.fecha}</td><td className="px-5 py-3">{registro.modulos?.nombre_modulo || '—'}</td><td className="px-5 py-3 text-secondary">{registro.tipos_actividad?.nombre || '—'}</td><td className="px-5 py-3 text-right font-medium">{registro.total_asistentes}</td></tr>)}</tbody></table></div>}</div>
  </div>
}
