import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LifeBuoy, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useMiRol } from '../hooks/useMiRol'
import { formatFecha } from '../lib/dateFormat'
import { usePreferencias } from '../hooks/usePreferencias'
import InfoTip from '../components/InfoTip'

const ESTADO_LABELS = { pendiente: 'Pendiente', resuelto: 'Resuelto' }
const ADMIN_LEVELS = ['nacional', 'super_admin']

export default function Soporte() {
  const { user } = useAuth()
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const { formato_fecha } = usePreferencias()
  const location = useLocation()
  const [asunto, setAsunto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const [misReportes, setMisReportes] = useState([])
  const [todosReportes, setTodosReportes] = useState([])
  const [loading, setLoading] = useState(true)

  const esAdmin = ADMIN_LEVELS.includes(rolPrincipal?.nivel)

  async function cargar() {
    if (!user) return
    setLoading(true)
    if (esAdmin) {
      const { data } = await supabase.from('reportes_soporte').select('*').order('created_at', { ascending: false }).limit(100)
      setTodosReportes(data ?? [])
    } else {
      const { data } = await supabase.from('reportes_soporte').select('*').eq('usuario_id', user.id).order('created_at', { ascending: false })
      setMisReportes(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { if (!roleLoading) cargar() }, [user, roleLoading, esAdmin])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  async function enviarReporte(event) {
    event.preventDefault()
    if (!asunto.trim() || !descripcion.trim() || saving) return
    setSaving(true)
    setError(null)
    const payload = {
      usuario_id: user.id,
      correo_usuario: user.email,
      asunto: asunto.trim(),
      descripcion: descripcion.trim(),
      pagina: location.pathname,
      nivel: rolPrincipal?.nivel || null,
      congregacion_nombre: rolPrincipal?.congregaciones?.nombre || null,
    }
    const { data, error: insertError } = await supabase.from('reportes_soporte').insert(payload).select('id').single()
    if (insertError) { setSaving(false); setError('No se pudo enviar el reporte. Intenta nuevamente.'); return }
    supabase.functions.invoke('notificar-reporte-soporte', {
      body: { reporteId: data.id, ...payload, correoUsuario: payload.correo_usuario, congregacionNombre: payload.congregacion_nombre },
    }).catch(() => { /* el reporte ya quedo guardado; el correo es un aviso adicional */ })
    setSaving(false)
    setAsunto('')
    setDescripcion('')
    setNotice('Reporte enviado. Nuestro equipo lo va a revisar.')
    cargar()
  }

  async function marcarResuelto(reporte) {
    const { error: updateError } = await supabase.from('reportes_soporte').update({ estado: 'resuelto', resuelto_en: new Date().toISOString() }).eq('id', reporte.id)
    if (updateError) { setError('No se pudo actualizar el reporte.'); return }
    cargar()
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando soporte...</div>

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">Ayuda técnica</p>
        <h1 className="section-title">Soporte</h1>
        <p className="text-sm text-secondary mt-0.5">Reporta un problema, un error o algo que no funcione como esperabas.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <section className="card p-5 max-w-2xl">
        <h2 className="font-medium mb-4">Reportar un problema</h2>
        <form onSubmit={enviarReporte} className="flex flex-col gap-3">
          <label className="text-sm">Asunto<input required maxLength={140} value={asunto} onChange={(event) => setAsunto(event.target.value)} placeholder="Ej. No puedo guardar un registro de asistencia" className="input-field mt-1.5" /></label>
          <label className="text-sm">Descripción<textarea required minLength={10} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Cuéntanos qué pasó, en qué pantalla, y qué esperabas que pasara." className="input-field mt-1.5 min-h-32" /></label>
          <div className="flex items-center gap-3">
            <button disabled={saving} className="btn-primary">{saving ? 'Enviando...' : 'Enviar reporte'}</button>
            {notice && <p role="status" className="text-sm text-success">{notice}</p>}
          </div>
        </form>
        <div className="flex items-center gap-2 text-xs text-muted mt-5 pt-4 border-t border-border">
          <Mail className="w-3.5 h-3.5" /> ¿Algo urgente? Escríbenos directo a <a href="mailto:soportesigasoftware@gmail.com" className="text-accent">soportesigasoftware@gmail.com</a>
        </div>
      </section>

      {esAdmin ? (
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border"><h2 className="font-medium">Todos los reportes</h2><p className="text-sm text-secondary mt-1">Visible solo para nacional/super_admin.</p></div>
          {todosReportes.length === 0 ? <p className="p-6 text-sm text-muted">No hay reportes todavía.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-5 py-3">Fecha</th><th className="font-normal px-5 py-3">Asunto</th><th className="font-normal px-5 py-3">De</th><th className="font-normal px-5 py-3">Estado</th><th className="font-normal px-5 py-3"></th></tr></thead>
                <tbody>
                  {todosReportes.map((reporte) => (
                    <tr key={reporte.id} className="border-t border-border align-top">
                      <td className="px-5 py-3 whitespace-nowrap">{formatFecha(reporte.created_at, { formato: formato_fecha, conHora: true })}</td>
                      <td className="px-5 py-3"><p className="font-medium">{reporte.asunto}</p><p className="text-xs text-secondary mt-1 max-w-md">{reporte.descripcion}</p><p className="text-xs text-muted mt-1">{reporte.pagina}</p></td>
                      <td className="px-5 py-3 text-xs">{reporte.correo_usuario}<br />{reporte.nivel}{reporte.congregacion_nombre ? ` · ${reporte.congregacion_nombre}` : ''}</td>
                      <td className="px-5 py-3"><span className={`audit-badge ${reporte.estado === 'resuelto' ? 'text-success' : 'text-warning'}`}>{ESTADO_LABELS[reporte.estado] || reporte.estado}</span></td>
                      <td className="px-5 py-3">{reporte.estado !== 'resuelto' && <span className="flex items-center gap-1"><button type="button" onClick={() => marcarResuelto(reporte)} className="text-accent text-xs">Marcar resuelto</button><InfoTip texto="No se puede reabrir desde aquí. Úsalo solo cuando el problema ya quedó solucionado." /></span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border"><h2 className="font-medium">Mis reportes</h2></div>
          {misReportes.length === 0 ? <p className="p-6 text-sm text-muted"><LifeBuoy className="w-4 h-4 inline mr-1.5 text-muted" />Todavía no has enviado ningún reporte.</p> : (
            <div className="divide-y divide-border">
              {misReportes.map((reporte) => (
                <div key={reporte.id} className="p-4 flex items-start justify-between gap-3">
                  <div><p className="text-sm font-medium">{reporte.asunto}</p><p className="text-xs text-secondary mt-1">{reporte.descripcion}</p><p className="text-xs text-muted mt-1">{formatFecha(reporte.created_at, { formato: formato_fecha, conHora: true })}</p></div>
                  <span className={`audit-badge flex-shrink-0 ${reporte.estado === 'resuelto' ? 'text-success' : 'text-warning'}`}>{ESTADO_LABELS[reporte.estado] || reporte.estado}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
