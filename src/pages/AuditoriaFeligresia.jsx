import { useEffect, useState } from 'react'
import { ClipboardList, Filter, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { hoyBogota } from "../lib/fechaBogota";
import { useMiRol } from '../hooks/useMiRol'
import { usePreferencias } from '../hooks/usePreferencias'
import { formatFecha } from '../lib/dateFormat'
import { descargarCsv, descargarExcel, descargarPdf } from '../lib/reportExport'
import ExportButtons from '../components/ExportButtons'
import InfoTip from '../components/InfoTip'

const ADMIN_LEVELS = ['nacional', 'super_admin', 'distrital']
const ENTITY_LABELS = { personas: 'Personas', familias: 'Familias', comites: 'Comités', membresias_comite: 'Membresías', historial_cargos: 'Cargos', seguimientos_pastorales: 'Seguimientos', estados_alerta_pastoral: 'Estados de alerta' }
const ACTION_LABELS = { INSERT: 'Creación', UPDATE: 'Actualización', DELETE: 'Eliminación' }

export default function AuditoriaFeligresia() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const { formato_fecha } = usePreferencias()
  const [entries, setEntries] = useState([])
  const [entity, setEntity] = useState('todas')
  const [action, setAction] = useState('todas')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const pageSize = 50

  useEffect(() => {
    const canAudit = rolPrincipal && (ADMIN_LEVELS.includes(rolPrincipal.nivel) || (rolPrincipal.nivel === 'local' && (!rolPrincipal.rol_local || rolPrincipal.rol_local === 'pastor')))
    if (!canAudit) { setLoading(false); return }
    async function load() {
      setLoading(true)
      setError(null)
      let query = supabase.from('auditoria_feligresia').select('id, entidad, entidad_id, entidad_clave, accion, antes, despues, usuario_id, creado_en', { count: 'exact' }).order('creado_en', { ascending: false }).order('id', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1)
      if (entity !== 'todas') query = query.eq('entidad', entity)
      if (action !== 'todas') query = query.eq('accion', action)
      if (fromDate) query = query.gte('creado_en', `${fromDate}T00:00:00`)
      if (toDate) query = query.lte('creado_en', `${toDate}T23:59:59.999`)
      try {
        const result = await Promise.race([query, new Promise((_, reject) => setTimeout(() => reject(new Error('La consulta tardó demasiado. Intenta nuevamente.')), 12000))])
        if (result.error) setError(result.error.code === '42P01' || result.error.code === 'PGRST205' ? 'La auditoría aún no está disponible. Contacta al administrador.' : 'No se pudo cargar la auditoría. Intenta nuevamente.')
        setEntries(result.data ?? [])
        setTotal(result.count ?? 0)
      } catch (requestError) {
        setEntries([])
        setTotal(0)
        setError('No se pudo cargar la auditoría. Intenta nuevamente.')
      } finally { setLoading(false) }
    }
    load()
  }, [rolPrincipal, entity, action, fromDate, toDate, page, reloadToken])

  useEffect(() => { setPage(0) }, [entity, action, fromDate, toDate])

  function exportMeta() {
    const filtros = [
      entity !== 'todas' ? `Entidad: ${ENTITY_LABELS[entity] || entity}` : null,
      action !== 'todas' ? `Acción: ${ACTION_LABELS[action] || action}` : null,
      fromDate ? `Desde: ${fromDate}` : null,
      toDate ? `Hasta: ${toDate}` : null,
    ].filter(Boolean)
    return [`Alcance: ${rolPrincipal?.nivel || ''}`, ...(filtros.length ? [`Filtros: ${filtros.join(' · ')}`] : [])]
  }

  function exportHeaders() {
    return { headers: ['Fecha', 'Entidad', 'Acción', 'Usuario', 'Clave'], rows: entries.map((entry) => [formatFecha(entry.creado_en, { formato: formato_fecha, conHora: true }), ENTITY_LABELS[entry.entidad] || entry.entidad, ACTION_LABELS[entry.accion] || entry.accion, entry.usuario_id || 'Sistema', entry.entidad_clave || '']) }
  }

  function exportCsv() {
    descargarCsv({ filename: `auditoria-feligresia-${hoyBogota()}.csv`, titulo: 'Auditoría de Feligresía', meta: exportMeta(), ...exportHeaders() })
  }

  function exportExcel() {
    descargarExcel({ filename: `auditoria-feligresia-${hoyBogota()}.xlsx`, hoja: 'Auditoría', titulo: 'Auditoría de Feligresía', meta: exportMeta(), ...exportHeaders() })
  }

  function exportPdf() {
    descargarPdf({ filename: `auditoria-feligresia-${hoyBogota()}.pdf`, titulo: 'Auditoría de Feligresía', meta: exportMeta(), orientacion: 'landscape', ...exportHeaders() })
  }

  if (roleLoading) return <div className="module-loading" role="status"><span className="loading-dot" />Validando permisos...</div>
  const canAudit = rolPrincipal && (ADMIN_LEVELS.includes(rolPrincipal.nivel) || (rolPrincipal.nivel === 'local' && (!rolPrincipal.rol_local || rolPrincipal.rol_local === 'pastor')))
  if (!canAudit) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">No tienes permisos para consultar la auditoría.</p>

  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="eyebrow">Control administrativo</p><h1 className="section-title">Auditoría de Feligresía</h1><p className="text-sm text-secondary mt-1">Consulta los cambios realizados dentro del censo y el seguimiento pastoral.</p></div><div className="flex gap-2"><ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} disabled={!entries.length || loading} /><button type="button" onClick={() => setReloadToken((token) => token + 1)} disabled={loading} className="btn-secondary px-3" title="Actualizar auditoría" aria-label="Actualizar auditoría"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button></div></header>
      <section className="card p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-secondary mb-3"><Filter className="w-4 h-4 text-accent" />Filtros de auditoría</div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><select aria-label="Filtrar entidad" className="input-field" value={entity} onChange={(event) => setEntity(event.target.value)}><option value="todas">Todas las entidades</option>{Object.entries(ENTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Filtrar acción" className="input-field" value={action} onChange={(event) => setAction(event.target.value)}><option value="todas">Todas las acciones</option><option value="INSERT">Creaciones</option><option value="UPDATE">Actualizaciones</option><option value="DELETE">Eliminaciones</option></select><label className="text-xs text-secondary">Desde<input aria-label="Fecha inicial" type="date" className="input-field mt-1" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label className="text-xs text-secondary">Hasta<input aria-label="Fecha final" type="date" className="input-field mt-1" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div></section>
      {error && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => setReloadToken((token) => token + 1)} className="text-danger underline">Reintentar</button></div>}
      <section className="grid sm:grid-cols-3 gap-3"><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Cambios encontrados</p><p className="text-2xl font-semibold mt-3">{total}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">En esta página</p><p className="text-2xl font-semibold mt-3">{entries.length}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Página actual</p><p className="text-2xl font-semibold mt-3">{page + 1} <span className="text-sm text-muted font-normal">/ {pages}</span></p></div></section>
      <section className="card overflow-hidden">{loading ? <div className="module-loading" role="status"><span className="loading-dot" />Cargando auditoría...</div> : entries.length === 0 ? <div className="p-10 text-center"><ClipboardList className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-sm text-secondary">No hay cambios con estos filtros.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="text-left text-muted bg-surface-1"><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Entidad</th><th className="px-4 py-3">Acción</th><th className="px-4 py-3"><span className="inline-flex items-center gap-1">Usuario<InfoTip texto="Es un código interno, no un nombre. 'Sistema' significa que el cambio lo hizo un proceso automático, sin que nadie lo capturara a mano." /></span></th><th className="px-4 py-3">Detalle</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id} className="border-t border-border"><td className="px-4 py-3 whitespace-nowrap">{formatFecha(entry.creado_en, { formato: formato_fecha, conHora: true })}</td><td className="px-4 py-3"><span className="audit-badge">{ENTITY_LABELS[entry.entidad] || entry.entidad}</span></td><td className="px-4 py-3"><span className={`audit-action audit-action-${entry.accion.toLowerCase()}`}>{ACTION_LABELS[entry.accion] || entry.accion}</span></td><td className="px-4 py-3 text-xs text-secondary">{entry.usuario_id ? `${entry.usuario_id.slice(0, 8)}...` : 'Sistema'}</td><td className="px-4 py-3 text-xs"><span className="inline-flex items-center gap-1"><button type="button" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} className="text-accent">{expandedId === entry.id ? 'Ocultar cambios' : 'Ver cambios'}</button><InfoTip texto="Muestra el dato técnico completo (antes y después) tal como quedó guardado, sin traducir a lenguaje sencillo." /></span>{expandedId === entry.id && <pre className="max-w-xl whitespace-pre-wrap break-all mt-2 rounded bg-surface-1 p-3 text-muted">{JSON.stringify({ antes: entry.antes, despues: entry.despues }, null, 2)}</pre>}</td></tr>)}</tbody></table></div>}<div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border p-3 text-xs text-secondary"><span>{total} cambios encontrados</span><div className="flex items-center gap-2"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)} className="btn-secondary px-3">Anterior</button><span>Página {page + 1} de {pages}</span><button type="button" disabled={page + 1 >= pages || loading} onClick={() => setPage((current) => current + 1)} className="btn-secondary px-3">Siguiente</button></div></div></section>
    </div>
  )
}