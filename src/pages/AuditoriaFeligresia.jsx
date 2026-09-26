import { useEffect, useState } from 'react'
import { ClipboardList, Filter, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { hoyBogota } from "../lib/fechaBogota";
import { useMiRol } from '../hooks/useMiRol'
import { usePreferencias } from '../hooks/usePreferencias'
import { formatFecha } from '../lib/dateFormat'
import { descargarCsv, descargarExcel, descargarPdf } from '../lib/reportExport'
import ExportButtons from '../components/ExportButtons'
import InfoTip from '../components/InfoTip'

const auditoriaFeligresiaCache = new Map()

const ADMIN_LEVELS = ['nacional', 'super_admin', 'distrital']
const CAMPOS_INTERNOS_OCULTOS = ['id', 'congregacion_id', 'created_at', 'auth_user_id']

// Humaniza el "antes/despues" de un cambio de auditoria: en UPDATE solo
// muestra los campos que de verdad cambiaron; en INSERT/DELETE muestra
// los campos del unico lado que existe. El JSON crudo queda disponible
// como respaldo, oculto por defecto.
function DetalleCambioAuditoria({ antes, despues }) {
  const { t } = useTranslation()
  const COLUMN_LABELS = t('auditoriaFeligresia.columnLabels', { returnObjects: true })
  function formatearValorAuditoria(valor) {
    if (valor === null || valor === undefined || valor === '') return t('auditoriaFeligresia.sinDatos')
    if (valor === true) return t('auditoriaFeligresia.si')
    if (valor === false) return t('auditoriaFeligresia.no')
    return String(valor)
  }
  const [verCrudo, setVerCrudo] = useState(false)
  let filas = []
  if (antes && despues) {
    const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].filter((clave) => !CAMPOS_INTERNOS_OCULTOS.includes(clave) && JSON.stringify(antes[clave]) !== JSON.stringify(despues[clave]))
    filas = claves.map((clave) => ({ clave, etiqueta: COLUMN_LABELS[clave] || clave, texto: `${formatearValorAuditoria(antes[clave])} → ${formatearValorAuditoria(despues[clave])}` }))
  } else {
    const objeto = despues || antes || {}
    filas = Object.keys(objeto).filter((clave) => !CAMPOS_INTERNOS_OCULTOS.includes(clave)).map((clave) => ({ clave, etiqueta: COLUMN_LABELS[clave] || clave, texto: formatearValorAuditoria(objeto[clave]) }))
  }
  return <div className="mt-2 rounded bg-surface-1 p-3 max-w-xl">
    {filas.length ? filas.map((fila) => <p key={fila.clave} className="text-xs text-secondary"><span className="font-medium text-ink">{fila.etiqueta}:</span> {fila.texto}</p>) : <p className="text-xs text-muted">{t('auditoriaFeligresia.sinCambios')}</p>}
    <button type="button" onClick={() => setVerCrudo((current) => !current)} className="text-[11px] text-accent mt-2">{verCrudo ? t('auditoriaFeligresia.ocultarDatoTecnico') : t('auditoriaFeligresia.verDatoTecnico')}</button>
    {verCrudo && <pre className="whitespace-pre-wrap break-all mt-2 text-[11px] text-muted">{JSON.stringify({ antes, despues }, null, 2)}</pre>}
  </div>
}

export default function AuditoriaFeligresia() {
  const { t } = useTranslation()
  const ENTITY_LABELS = t('auditoriaFeligresia.entityLabels', { returnObjects: true })
  const ACTION_LABELS = t('auditoriaFeligresia.actionLabels', { returnObjects: true })
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
  const [actorPorAuthId, setActorPorAuthId] = useState(new Map())
  const pageSize = 50

  useEffect(() => {
    const ids = [...new Set(entries.map((entry) => entry.usuario_id).filter(Boolean))]
    if (!ids.length) { setActorPorAuthId(new Map()); return }
    let active = true
    // Resuelve solo los usuario_id de la pagina actual (maximo 50) --
    // sin filtrar por congregacion, ya que esta pantalla puede mostrar
    // cambios de varias congregaciones (distrital/nacional) y la RLS de
    // personas ya limita lo que cada rol puede ver.
    supabase.from('personas').select('auth_user_id, nombres, apellidos').in('auth_user_id', ids).then(({ data }) => {
      if (!active) return
      setActorPorAuthId(new Map((data ?? []).map((persona) => [persona.auth_user_id, `${persona.nombres} ${persona.apellidos}`])))
    })
    return () => { active = false }
  }, [entries])
  function describirActor(usuarioId) {
    if (!usuarioId) return t('auditoriaFeligresia.cambioAutomatico')
    return actorPorAuthId.get(usuarioId) || t('auditoriaFeligresia.otroUsuario')
  }

  useEffect(() => {
    const canAudit = rolPrincipal && (ADMIN_LEVELS.includes(rolPrincipal.nivel) || (rolPrincipal.nivel === 'local' && (!rolPrincipal.rol_local || rolPrincipal.rol_local === 'pastor')))
    if (!canAudit) { setLoading(false); return }
    async function load() {
      // El alcance debe fijarlo el ROL ACTIVO (rolPrincipal), no solo la
      // RLS: una cuenta que además tiene un rol superior (ej. super_admin
      // que también es pastor local de una congregación) sigue pasando la
      // RLS de auditoria_feligresia para TODO el país aunque esté "viendo
      // como" local -- la RLS no sabe qué vista eligió en el selector de
      // rol. Por eso, a diferencia de RLS sola, aquí se filtra explícito
      // por el alcance del rol activo, igual que hace el resto de la app
      // (rolPrincipal.congregacion_id / rolPrincipal.distrito_id).
      const scopeKey = rolPrincipal.nivel === 'local' ? `local:${rolPrincipal.congregacion_id}` : rolPrincipal.nivel === 'distrital' ? `distrital:${rolPrincipal.distrito_id}` : rolPrincipal.nivel
      const cacheKey = `${scopeKey}:${entity}:${action}:${fromDate}:${toDate}:${page}`
      const cached = auditoriaFeligresiaCache.get(cacheKey)
      if (cached) {
        setEntries(cached.entries)
        setTotal(cached.total)
        setLoading(false)
      } else {
        setLoading(true)
      }
      setError(null)
      const columnas = `id, entidad, entidad_id, entidad_clave, accion, antes, despues, usuario_id, creado_en${rolPrincipal.nivel === 'distrital' ? ', congregaciones!inner(distrito_id)' : ''}`
      let query = supabase.from('auditoria_feligresia').select(columnas, { count: 'exact' }).order('creado_en', { ascending: false }).order('id', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1)
      if (rolPrincipal.nivel === 'local') query = query.eq('congregacion_id', rolPrincipal.congregacion_id)
      if (rolPrincipal.nivel === 'distrital') query = query.eq('congregaciones.distrito_id', rolPrincipal.distrito_id)
      if (entity !== 'todas') query = query.eq('entidad', entity)
      if (action !== 'todas') query = query.eq('accion', action)
      if (fromDate) query = query.gte('creado_en', `${fromDate}T00:00:00`)
      if (toDate) query = query.lte('creado_en', `${toDate}T23:59:59.999`)
      try {
        const result = await Promise.race([query, new Promise((_, reject) => setTimeout(() => reject(new Error(t('auditoriaFeligresia.errorTimeout'))), 12000))])
        if (result.error) setError(result.error.code === '42P01' || result.error.code === 'PGRST205' ? t('auditoriaFeligresia.errorNoDisponible') : t('auditoriaFeligresia.errorCargar'))
        const freshEntries = result.data ?? []
        const freshTotal = result.count ?? 0
        setEntries(freshEntries)
        setTotal(freshTotal)
        auditoriaFeligresiaCache.set(cacheKey, { entries: freshEntries, total: freshTotal })
      } catch (requestError) {
        setEntries([])
        setTotal(0)
        setError(t('auditoriaFeligresia.errorCargar'))
      } finally { setLoading(false) }
    }
    load()
  }, [rolPrincipal, entity, action, fromDate, toDate, page, reloadToken])

  useEffect(() => { setPage(0) }, [entity, action, fromDate, toDate])

  function exportMeta() {
    const filtros = [
      entity !== 'todas' ? t('auditoriaFeligresia.export.entidadLabel', { valor: ENTITY_LABELS[entity] || entity }) : null,
      action !== 'todas' ? t('auditoriaFeligresia.export.accionLabel', { valor: ACTION_LABELS[action] || action }) : null,
      fromDate ? t('auditoriaFeligresia.export.desdeLabel', { valor: fromDate }) : null,
      toDate ? t('auditoriaFeligresia.export.hastaLabel', { valor: toDate }) : null,
    ].filter(Boolean)
    return [t('auditoriaFeligresia.export.alcance', { nivel: rolPrincipal?.nivel || '' }), ...(filtros.length ? [t('auditoriaFeligresia.export.filtros', { filtros: filtros.join(' · ') })] : [])]
  }

  function exportHeaders() {
    return { headers: [t('auditoriaFeligresia.colFecha'), t('auditoriaFeligresia.colEntidad'), t('auditoriaFeligresia.colAccion'), t('auditoriaFeligresia.colUsuario'), t('auditoriaFeligresia.export.colClave')], rows: entries.map((entry) => [formatFecha(entry.creado_en, { formato: formato_fecha, conHora: true }), ENTITY_LABELS[entry.entidad] || entry.entidad, ACTION_LABELS[entry.accion] || entry.accion, describirActor(entry.usuario_id), entry.entidad_clave || '']) }
  }

  function exportCsv() {
    descargarCsv({ filename: `auditoria-feligresia-${hoyBogota()}.csv`, titulo: t('auditoriaFeligresia.export.tituloReporte'), meta: exportMeta(), ...exportHeaders() })
  }

  function exportResumen() {
    const porEntidad = {}
    const porAccion = {}
    entries.forEach((entry) => {
      const entidad = ENTITY_LABELS[entry.entidad] || entry.entidad
      const accion = ACTION_LABELS[entry.accion] || entry.accion
      porEntidad[entidad] = (porEntidad[entidad] || 0) + 1
      porAccion[accion] = (porAccion[accion] || 0) + 1
    })
    return {
      kpis: [
        { label: t('auditoriaFeligresia.export.cambiosEnPagina'), value: entries.length },
        { label: t('auditoriaFeligresia.export.totalCambios'), value: total },
        ...Object.entries(porAccion).map(([label, value]) => ({ label, value })),
      ],
      desgloses: [
        { titulo: t('auditoriaFeligresia.export.cambiosPorEntidad'), items: Object.entries(porEntidad).map(([label, valor]) => ({ label, valor })) },
      ],
    }
  }

  // Una eliminacion es el tipo de cambio mas importante de notar en una
  // auditoria -- se resalta en rojo tanto en el Excel como en el PDF en
  // vez de dejarlo mezclado con creaciones y actualizaciones.
  function esFilaDelete(_valores, index) {
    return entries[index]?.accion === 'DELETE'
  }

  function exportExcel() {
    descargarExcel({ filename: `auditoria-feligresia-${hoyBogota()}.xlsx`, hoja: t('auditoriaFeligresia.export.hoja'), titulo: t('auditoriaFeligresia.export.tituloReporte'), meta: exportMeta(), resumen: exportResumen(), resaltarFila: esFilaDelete, ...exportHeaders() })
  }

  function exportPdf() {
    descargarPdf({ filename: `auditoria-feligresia-${hoyBogota()}.pdf`, titulo: t('auditoriaFeligresia.export.tituloReporte'), meta: exportMeta(), orientacion: 'landscape', resumen: exportResumen(), resaltarFila: esFilaDelete, ...exportHeaders() })
  }

  if (roleLoading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('auditoriaFeligresia.validandoPermisos')}</div>
  const canAudit = rolPrincipal && (ADMIN_LEVELS.includes(rolPrincipal.nivel) || (rolPrincipal.nivel === 'local' && (!rolPrincipal.rol_local || rolPrincipal.rol_local === 'pastor')))
  if (!canAudit) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{t('auditoriaFeligresia.sinPermisos')}</p>

  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="eyebrow">{t('auditoriaFeligresia.eyebrow')}</p><h1 className="section-title">{t('auditoriaFeligresia.titulo')}</h1><p className="text-sm text-secondary mt-1">{t('auditoriaFeligresia.subtitulo')}</p></div><div className="flex gap-2"><ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} disabled={!entries.length || loading} /><button type="button" onClick={() => setReloadToken((token) => token + 1)} disabled={loading} className="btn-secondary px-3" title={t('auditoriaFeligresia.actualizarAuditoria')} aria-label={t('auditoriaFeligresia.actualizarAuditoria')}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button></div></header>
      <section className="card p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-secondary mb-3"><Filter className="w-4 h-4 text-accent" />{t('auditoriaFeligresia.filtrosAuditoria')}</div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><select aria-label={t('auditoriaFeligresia.ariaEntidad')} className="input-field" value={entity} onChange={(event) => setEntity(event.target.value)}><option value="todas">{t('auditoriaFeligresia.todasEntidades')}</option>{Object.entries(ENTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label={t('auditoriaFeligresia.ariaAccion')} className="input-field" value={action} onChange={(event) => setAction(event.target.value)}><option value="todas">{t('auditoriaFeligresia.todasAcciones')}</option><option value="INSERT">{t('auditoriaFeligresia.creaciones')}</option><option value="UPDATE">{t('auditoriaFeligresia.actualizaciones')}</option><option value="DELETE">{t('auditoriaFeligresia.eliminaciones')}</option></select><label className="text-xs text-secondary">{t('auditoriaFeligresia.desde')}<input aria-label={t('auditoriaFeligresia.ariaFechaInicial')} type="date" className="input-field mt-1" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label className="text-xs text-secondary">{t('auditoriaFeligresia.hasta')}<input aria-label={t('auditoriaFeligresia.ariaFechaFinal')} type="date" className="input-field mt-1" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div></section>
      {error && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => setReloadToken((token) => token + 1)} className="text-danger underline">{t('auditoriaFeligresia.reintentar')}</button></div>}
      <section className="grid sm:grid-cols-3 gap-3"><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{t('auditoriaFeligresia.cambiosEncontrados')}</p><p className="text-2xl font-semibold mt-3">{total}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{t('auditoriaFeligresia.enEstaPagina')}</p><p className="text-2xl font-semibold mt-3">{entries.length}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{t('auditoriaFeligresia.paginaActual')}</p><p className="text-2xl font-semibold mt-3">{page + 1} <span className="text-sm text-muted font-normal">/ {pages}</span></p></div></section>
      <section className="card overflow-hidden">{loading ? <div className="module-loading" role="status"><span className="loading-dot" />{t('auditoriaFeligresia.cargandoAuditoria')}</div> : entries.length === 0 ? <div className="p-10 text-center"><ClipboardList className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-sm text-secondary">{t('auditoriaFeligresia.sinCambiosFiltros')}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="text-left text-muted bg-surface-1"><th className="px-4 py-3">{t('auditoriaFeligresia.colFecha')}</th><th className="px-4 py-3">{t('auditoriaFeligresia.colEntidad')}</th><th className="px-4 py-3">{t('auditoriaFeligresia.colAccion')}</th><th className="px-4 py-3"><span className="inline-flex items-center gap-1">{t('auditoriaFeligresia.colUsuario')}<InfoTip texto={t('auditoriaFeligresia.usuarioTip')} /></span></th><th className="px-4 py-3">{t('auditoriaFeligresia.colDetalle')}</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id} className="border-t border-border"><td className="px-4 py-3 whitespace-nowrap">{formatFecha(entry.creado_en, { formato: formato_fecha, conHora: true })}</td><td className="px-4 py-3"><span className="audit-badge">{ENTITY_LABELS[entry.entidad] || entry.entidad}</span></td><td className="px-4 py-3"><span className={`audit-action audit-action-${entry.accion.toLowerCase()}`}>{ACTION_LABELS[entry.accion] || entry.accion}</span></td><td className="px-4 py-3 text-xs text-secondary">{describirActor(entry.usuario_id)}</td><td className="px-4 py-3 text-xs"><button type="button" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} className="text-accent">{expandedId === entry.id ? t('auditoriaFeligresia.ocultarCambios') : t('auditoriaFeligresia.verCambios')}</button>{expandedId === entry.id && <DetalleCambioAuditoria antes={entry.antes} despues={entry.despues} />}</td></tr>)}</tbody></table></div>}<div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border p-3 text-xs text-secondary"><span>{t('auditoriaFeligresia.cambiosEncontradosFooter', { cantidad: total })}</span><div className="flex items-center gap-2"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)} className="btn-secondary px-3">{t('auditoriaFeligresia.anterior')}</button><span>{t('auditoriaFeligresia.paginaXdeY', { pagina: page + 1, total: pages })}</span><button type="button" disabled={page + 1 >= pages || loading} onClick={() => setPage((current) => current + 1)} className="btn-secondary px-3">{t('auditoriaFeligresia.siguiente')}</button></div></div></section>
    </div>
  )
}
