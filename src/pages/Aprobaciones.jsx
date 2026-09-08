import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'
import InfoTip from '../components/InfoTip'

const aprobacionesCache = new Map()

const ALLOWED_LEVELS = ['distrital', 'nacional', 'super_admin']

const ESTADO_TONO = {
  pendiente_aprobacion: 'bg-warning-bg text-warning',
  activa: 'bg-success-bg text-success',
  suspendida: 'bg-danger-bg text-danger',
}
const ESTADO_LABEL = { pendiente_aprobacion: 'Pendiente de aprobación', activa: 'Activa', suspendida: 'Suspendida' }
const MADUREZ_LABELS = { mision_nacional: 'Misión Nacional', lugar_prediccion: 'Lugar de Predicación', iglesia_local: 'Iglesia Local (Constituida)' }

export default function Aprobaciones() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const [congregaciones, setCongregaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [anulandoId, setAnulandoId] = useState(null)

  async function load() {
    const cacheKey = 'todas'
    const cached = aprobacionesCache.get(cacheKey)
    if (cached) {
      setCongregaciones(cached.congregaciones)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    const { data, error: loadError } = await supabase
      .from('congregaciones')
      .select('id, nombre, pastor_nombre, estado, madurez, distritos(nombre), created_at')
      .order('created_at', { ascending: false })
    const freshData = { congregaciones: data ?? [] }
    setCongregaciones(freshData.congregaciones)
    if (loadError) setError('No se pudieron cargar las congregaciones.')
    setLoading(false)
    aprobacionesCache.set(cacheKey, freshData)
  }

  useEffect(() => { load() }, [])

  async function actualizarEstado(id, estado) {
    setBusy(id)
    const { error: updateError } = await supabase.from('congregaciones').update({ estado, aprobada_en: new Date().toISOString() }).eq('id', id)
    setBusy(null)
    if (updateError) { setError('No se pudo actualizar el estado de la congregación.'); return }
    load()
  }

  async function actualizarMadurez(id, madurez) {
    setBusy(id)
    const { error: updateError } = await supabase.from('congregaciones').update({ madurez }).eq('id', id)
    setBusy(null)
    if (updateError) { setError('No se pudo actualizar la madurez de la sede.'); return }
    load()
  }

  async function anularCongregacion(id) {
    setBusy(id)
    setError(null)
    setNotice(null)
    const { error: anularError } = await supabase.rpc('anular_congregacion', { p_congregacion_id: id })
    setBusy(null)
    setAnulandoId(null)
    if (anularError) { setError(`No se pudo anular: ${anularError.message}`); return }
    setNotice('Congregación anulada -- se deshizo por completo, como si nunca se hubiera creado.')
    load()
  }

  if (roleLoading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando aprobaciones...</div>
  if (!ALLOWED_LEVELS.includes(rolPrincipal?.nivel)) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">No tienes permisos para administrar aprobaciones de congregaciones.</p>

  return (
    <div className="page-shell">
      <div>
        <p className="eyebrow">Control administrativo</p><h1 className="section-title">Aprobación de congregaciones</h1>
        <p className="text-sm text-secondary mt-0.5">Una congregación registrada no puede usar el sistema hasta ser aprobada aquí.</p>
      </div>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}
      {loading && <div className="module-loading" role="status"><span className="loading-dot" />Cargando aprobaciones...</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm border-collapse">
          <thead>
            <tr className="text-muted text-left bg-surface-1">
              <th className="font-normal py-2.5 px-4">Congregación</th>
              <th className="font-normal py-2.5 px-4">Pastor</th>
              <th className="font-normal py-2.5 px-4">Distrito</th>
              <th className="font-normal py-2.5 px-4"><span className="flex items-center gap-1">Madurez<InfoTip texto="Nivel de desarrollo de la sede: Misión Nacional (recién empieza), Lugar de Predicación (ya reúne gente de forma estable) o Iglesia Local (ya está constituida)." /></span></th>
              <th className="font-normal py-2.5 px-4">Estado</th>
              <th className="font-normal py-2.5 px-4 text-right"><span className="flex items-center justify-end gap-1">Acciones<InfoTip texto="El visto aprueba la congregación y le da acceso al sistema. La X la deja suspendida sin poder usarlo." /></span></th>
            </tr>
          </thead>
          <tbody>
            {congregaciones.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-2.5 px-4 font-medium">{c.nombre}</td>
                <td className="py-2.5 px-4 text-secondary">{c.pastor_nombre}</td>
                <td className="py-2.5 px-4 text-secondary">{c.distritos?.nombre}</td>
                <td className="py-2.5 px-4">
                  <select disabled={busy === c.id} className="input-field text-xs" value={c.madurez || 'lugar_prediccion'} onChange={(event) => actualizarMadurez(c.id, event.target.value)}>
                    {Object.entries(MADUREZ_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs px-2 py-1 rounded ${ESTADO_TONO[c.estado]}`}>{ESTADO_LABEL[c.estado] || c.estado}</span>
                </td>
                <td className="py-2.5 px-4 text-right">
                  {c.estado === 'pendiente_aprobacion' && anulandoId !== c.id && (
                    <div className="flex justify-end gap-2">
                      <button disabled={busy === c.id} onClick={() => actualizarEstado(c.id, 'activa')} className="text-success hover:opacity-70" title="Aprobar">
                        <CheckCircle2 className="w-[18px] h-[18px]" />
                      </button>
                      <button disabled={busy === c.id} onClick={() => actualizarEstado(c.id, 'suspendida')} className="text-danger hover:opacity-70" title="Suspender">
                        <XCircle className="w-[18px] h-[18px]" />
                      </button>
                      <button disabled={busy === c.id} onClick={() => setAnulandoId(c.id)} className="text-muted hover:opacity-70" title="Anular (creada por error)">
                        <Trash2 className="w-[18px] h-[18px]" />
                      </button>
                    </div>
                  )}
                  {c.estado === 'pendiente_aprobacion' && anulandoId === c.id && (
                    <div className="flex justify-end items-center gap-2">
                      <span className="text-xs text-secondary">¿Anular? No se puede deshacer.</span>
                      <button disabled={busy === c.id} onClick={() => anularCongregacion(c.id)} className="text-xs text-danger hover:underline">Sí, anular</button>
                      <button disabled={busy === c.id} onClick={() => setAnulandoId(null)} className="text-xs text-secondary hover:underline">Cancelar</button>
                    </div>
                  )}
                  {c.estado === 'activa' && (
                    <button disabled={busy === c.id} onClick={() => actualizarEstado(c.id, 'suspendida')} className="text-xs text-danger hover:underline">
                      Suspender
                    </button>
                  )}
                  {c.estado === 'suspendida' && (
                    <button disabled={busy === c.id} onClick={() => actualizarEstado(c.id, 'activa')} className="text-xs text-success hover:underline">
                      Reactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  )
}
