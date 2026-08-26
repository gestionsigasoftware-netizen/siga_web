import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

const ADMIN_LEVELS = ['distrital', 'nacional', 'super_admin']
const ENTITY_LABELS = { personas: 'Personas', familias: 'Familias', comites: 'Comités', membresias_comite: 'Membresías', historial_cargos: 'Cargos', seguimientos_pastorales: 'Seguimientos', estados_alerta_pastoral: 'Estados de alerta' }

export default function AuditoriaFeligresia() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const [entries, setEntries] = useState([])
  const [entity, setEntity] = useState('todas')
  const [action, setAction] = useState('todas')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const pageSize = 50

  useEffect(() => {
    if (!rolPrincipal || !ADMIN_LEVELS.includes(rolPrincipal.nivel)) { setLoading(false); return }
    async function load() {
      setLoading(true); setError(null)
      let query = supabase.from('auditoria_feligresia').select('id, entidad, entidad_id, entidad_clave, accion, antes, despues, usuario_id, creado_en', { count: 'exact' }).order('creado_en', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1)
      if (entity !== 'todas') query = query.eq('entidad', entity)
      if (action !== 'todas') query = query.eq('accion', action)
      try {
        const result = await Promise.race([query, new Promise((_, reject) => setTimeout(() => reject(new Error('La consulta tardó demasiado. Verifica Supabase y las políticas RLS.')), 12000))])
        if (result.error) setError(result.error.code === '42P01' || result.error.code === 'PGRST205' ? 'No existe auditoria_feligresia. Ejecuta feligresia.sql en Supabase.' : `No se pudo cargar la auditoría: ${result.error.message}`)
        setEntries(result.data ?? []); setTotal(result.count ?? 0)
      } catch (requestError) {
        setEntries([]); setTotal(0); setError(requestError.message || 'No se pudo cargar la auditoría.')
      } finally { setLoading(false) }
    }
    load()
  }, [rolPrincipal, entity, action, page, reloadToken])

  useEffect(() => { setPage(0) }, [entity, action])

  if (roleLoading) return <p className="text-sm text-muted">Validando permisos...</p>
  const canAudit = rolPrincipal && (ADMIN_LEVELS.includes(rolPrincipal.nivel) || (rolPrincipal.nivel === 'local' && (!rolPrincipal.rol_local || rolPrincipal.rol_local === 'pastor')))
  if (!canAudit) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">No tienes permisos para consultar la auditoría.</p>

  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <div className="flex flex-col gap-6"><header><p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Control administrativo</p><h1 className="text-2xl font-semibold">Auditoría de Feligresía</h1><p className="text-sm text-secondary mt-1">Consulta los cambios realizados dentro del censo y el seguimiento pastoral.</p></header><section className="card p-4 flex flex-col sm:flex-row gap-3"><select aria-label="Filtrar entidad" className="input-field" value={entity} onChange={(event) => setEntity(event.target.value)}><option value="todas">Todas las entidades</option>{Object.entries(ENTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Filtrar acción" className="input-field" value={action} onChange={(event) => setAction(event.target.value)}><option value="todas">Todas las acciones</option><option value="INSERT">Creaciones</option><option value="UPDATE">Actualizaciones</option><option value="DELETE">Eliminaciones</option></select></section>{error && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => setReloadToken((token) => token + 1)} className="text-danger underline">Reintentar</button></div>}<section className="card overflow-hidden">{loading ? <p className="p-8 text-sm text-muted">Cargando auditoría...</p> : entries.length === 0 ? <div className="p-10 text-center"><ClipboardList className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-sm text-secondary">No hay cambios con estos filtros.</p></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted bg-surface-1"><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Entidad</th><th className="px-4 py-3">Acción</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Detalle</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id} className="border-t border-border"><td className="px-4 py-3 whitespace-nowrap">{new Date(entry.creado_en).toLocaleString('es-CO')}</td><td className="px-4 py-3">{ENTITY_LABELS[entry.entidad] || entry.entidad}</td><td className="px-4 py-3">{entry.accion}</td><td className="px-4 py-3 text-xs text-secondary">{entry.usuario_id || 'Sistema'}</td><td className="px-4 py-3 text-xs"><details><summary className="cursor-pointer text-accent">Ver cambios</summary><pre className="max-w-xl whitespace-pre-wrap break-all mt-2 text-muted">{JSON.stringify({ antes: entry.antes, despues: entry.despues }, null, 2)}</pre></details></td></tr>)}</tbody></table></div>}<div className="flex items-center justify-between border-t border-border p-3 text-xs text-secondary"><span>{total} cambios</span><div className="flex items-center gap-2"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)} className="btn-secondary px-3">Anterior</button><span>Página {page + 1} de {pages}</span><button type="button" disabled={page + 1 >= pages || loading} onClick={() => setPage((current) => current + 1)} className="btn-secondary px-3">Siguiente</button></div></div></section></div>
}
