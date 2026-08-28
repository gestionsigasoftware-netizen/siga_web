import { useEffect, useState } from 'react'
import { Bell, Check, CircleAlert, Info, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const ICONS = { info: Info, success: Check, warning: CircleAlert, danger: CircleAlert }

export default function NotificationCenter() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [preferences, setPreferences] = useState({ recibir_notificaciones: true, recibir_alertas: true })
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return undefined
    let active = true
    setError(null)
    Promise.all([
      supabase.from('notificaciones').select('*').eq('usuario_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('preferencias_usuario').select('recibir_notificaciones, recibir_alertas').eq('usuario_id', user.id).maybeSingle(),
    ]).then(([notificationResult, preferenceResult]) => {
      if (!active) return
      if (notificationResult.error || preferenceResult.error) {
        setError('No se pudo sincronizar el centro de notificaciones.')
        return
      }
      if (preferenceResult.data) setPreferences(preferenceResult.data)
      const currentPreferences = preferenceResult.data ?? preferences
      setNotifications((notificationResult.data ?? []).filter((notification) => currentPreferences.recibir_notificaciones || ['warning', 'danger'].includes(notification.tipo) && currentPreferences.recibir_alertas))
    })
    const channel = supabase.channel(`notificaciones-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${user.id}` }, (payload) => {
      setPreferences((currentPreferences) => {
        const isAlert = ['warning', 'danger'].includes(payload.new.tipo)
        if (currentPreferences.recibir_notificaciones || (isAlert && currentPreferences.recibir_alertas)) setNotifications((current) => [payload.new, ...current].slice(0, 20))
        return currentPreferences
      })
    }).subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('Las notificaciones en tiempo real no están disponibles.')
    })
    return () => { active = false; supabase.removeChannel(channel) }
  }, [user])

  async function markRead(notification) {
    if (!notification.leida) {
      const { error: updateError } = await supabase.from('notificaciones').update({ leida: true }).eq('id', notification.id)
      if (updateError) {
        setError('No se pudo marcar la notificación como leída.')
        return
      }
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, leida: true } : item))
    }
    setOpen(false)
  }

  const unread = notifications.filter((notification) => !notification.leida).length

  return <div className="relative">
    <button aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`} title="Notificaciones" onClick={() => setOpen(!open)} className="relative p-2 rounded text-secondary hover:bg-surface-1 hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/20">
      <Bell className="w-[18px] h-[18px]" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="absolute right-0 top-11 z-30 w-[min(360px,calc(100vw-2rem))] bg-surface-2 border border-border rounded-card shadow-[0_16px_40px_rgba(21,27,34,0.14)] overflow-hidden"><div className="flex items-center justify-between p-4 border-b border-border"><div><h2 className="text-sm font-medium">Notificaciones</h2><p className="text-xs text-muted mt-0.5">{unread ? `${unread} pendientes de leer` : 'Todo al día'}</p></div><button aria-label="Cerrar notificaciones" onClick={() => setOpen(false)} className="p-1 text-muted hover:text-ink"><X className="w-4 h-4" /></button></div>{error && <p role="alert" className="m-3 rounded bg-danger-bg p-3 text-xs text-danger">{error}</p>}{notifications.length === 0 ? <p className="p-6 text-sm text-muted text-center">No tienes notificaciones nuevas.</p> : <div className="max-h-[360px] overflow-y-auto">{notifications.map((notification) => { const Icon = ICONS[notification.tipo] ?? Info; return <div key={notification.id} className={`flex gap-3 p-4 border-b border-border last:border-0 ${notification.leida ? '' : 'bg-accent-bg/40'}`}><Icon className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" /><div className="min-w-0"><button onClick={() => markRead(notification)} className="text-left w-full"><p className="text-sm font-medium">{notification.titulo}</p><p className="text-xs text-secondary mt-1 leading-5">{notification.mensaje}</p></button>{notification.enlace && <Link to={notification.enlace} onClick={() => markRead(notification)} className="inline-block text-xs text-accent mt-2 hover:underline">Ver detalle</Link>}<p className="text-[11px] text-muted mt-2">{new Date(notification.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</p></div></div> })}</div>}</div>}
  </div>
}
