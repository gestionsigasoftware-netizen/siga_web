import { Bell, Database, Globe2, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const EMPTY_PREFERENCES = { recibir_notificaciones: true, recibir_alertas: true, formato_fecha: 'DD/MM/AAAA' }

function StatusCard({ icon: Icon, title, description, value, tone = 'success' }) {
  return (
    <section className="card p-5">
      <div className="flex gap-3">
        <div className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" /></div>
        <div className="min-w-0">
          <h2 className="font-medium">{title}</h2>
          <p className="text-sm text-secondary mt-1 leading-5">{description}</p>
          <span className={`inline-block text-xs rounded px-2 py-1 mt-4 ${tone === 'muted' ? 'text-secondary bg-surface-1' : 'text-success bg-success-bg'}`}>{value}</span>
        </div>
      </div>
    </section>
  )
}

export default function ConfiguracionSistema() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState(EMPTY_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)

  async function loadPreferences() {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase.from('preferencias_usuario').select('recibir_notificaciones, recibir_alertas, formato_fecha').eq('usuario_id', user.id).maybeSingle()
    if (loadError) setError(`No se pudieron cargar tus preferencias: ${loadError.message}`)
    if (data) setPreferences(data)
    setLoading(false)
  }

  useEffect(() => { loadPreferences() }, [user])

  function updatePreference(values) {
    setPreferences((current) => ({ ...current, ...values }))
    setNotice(null)
    setError(null)
  }

  async function savePreferences(event) {
    event.preventDefault()
    if (!user || saving) return
    setSaving(true)
    setNotice(null)
    setError(null)
    const { error: saveError } = await supabase.from('preferencias_usuario').upsert({ ...preferences, usuario_id: user.id })
    setSaving(false)
    if (saveError) setError(`No se pudieron guardar tus preferencias: ${saveError.message}`)
    else {
      window.dispatchEvent(new CustomEvent('siga:preferencias-actualizadas', { detail: preferences }))
      setNotice('Preferencias personales guardadas.')
    }
  }

  if (loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando preferencias...</div>

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <p className="eyebrow">Tu espacio personal</p>
        <h1 className="section-title">Preferencias</h1>
        <p className="text-sm text-secondary mt-1">Configura cómo quieres recibir avisos y consultar la información de SIGA.</p>
      </div>
      {error && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={loadPreferences} className="btn-secondary text-xs self-start sm:self-auto">Reintentar</button></div>}
      <form onSubmit={savePreferences} className="card p-5 max-w-2xl">
        <h2 className="font-medium">Preferencias de mi cuenta</h2>
        <p className="text-sm text-secondary mt-1 mb-5">Los avisos que recibes y el formato de tus fechas.</p>
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-accent">Avisos que quieres recibir</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferences.recibir_notificaciones} onChange={(event) => updatePreference({ recibir_notificaciones: event.target.checked })} /> Recibir notificaciones de actividad</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferences.recibir_alertas} onChange={(event) => updatePreference({ recibir_alertas: event.target.checked })} /> Recibir alertas pastorales</label>
          <label className="text-sm pt-2">Formato regional de fecha<select className="input-field mt-1.5" value={preferences.formato_fecha} onChange={(event) => updatePreference({ formato_fecha: event.target.value })}><option value="DD/MM/AAAA">Día / mes / año (DD/MM/AAAA)</option><option value="MM/DD/AAAA">Mes / día / año (MM/DD/AAAA)</option></select></label>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-5">
          <button disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar preferencias'}</button>
          {notice && <p role="status" className="text-sm text-success">{notice}</p>}
        </div>
      </form>
      <section>
        <div className="mb-4"><p className="eyebrow">Información del servicio</p><h2 className="font-medium mt-1">Estado del sistema</h2><p className="text-sm text-secondary mt-1">Consulta el contexto de tu cuenta y la conexión de SIGA.</p></div>
        <div className="grid md:grid-cols-2 gap-4">
          <StatusCard icon={Globe2} title="Idioma y región" description="El idioma de la interfaz es Español. El formato de fecha elegido se muestra aquí." value={preferences.formato_fecha === 'MM/DD/AAAA' ? 'Español · MM/DD' : 'Español · DD/MM'} />
          <StatusCard icon={Bell} title="Notificaciones" description="Resumen de las preferencias que acabas de configurar." value={preferences.recibir_notificaciones || preferences.recibir_alertas ? 'Preferencias activas' : 'Todas desactivadas'} tone={preferences.recibir_notificaciones || preferences.recibir_alertas ? 'success' : 'muted'} />
          <StatusCard icon={LockKeyhole} title="Seguridad" description="Tu acceso está protegido por autenticación y políticas de sesión." value="Política activa" />
          <StatusCard icon={Database} title="Información actualizada" description="Tus datos se mantienen disponibles para la gestión de la congregación." value="Estado verificado" />
        </div>
      </section>
    </div>
  )
}
