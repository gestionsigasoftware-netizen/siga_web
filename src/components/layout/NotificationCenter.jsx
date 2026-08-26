import { useEffect, useState } from 'react'
import { Bell, Check, CircleAlert, Info, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const ICONS = { info: Info, success: Check, warning: CircleAlert, danger: CircleAlert }

export default function NotificationCenter() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user) return undefined
    let active = true
    supabase.from('notificaciones').select('*').eq('usuario_id', user.id).order('created_at', { ascending: false }).limit(20).then(({ data }) => {
      if (active) setNotifications(data ?? [])
    })
    const channel = supabase.channel(`notificaciones-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${user.id}` }, (payload) => {
      setNotifications((current) => [payload.new, ...current].slice(0, 20))
    }).subscribe()
    return () => { active = false; supabase.removeChannel(channel) }
  }, [user])

  async function markRead(notification) {
    if (!notification.leida) {
      await supabase.from('notificaciones').update({ leida: true }).eq('id', notification.id)
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, leida: true } : item))
    }
    setOpen(false)
  }

  const unread = notifications.filter((notification) => !notification.leida).length

  return <div className="relative">
    <button aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`} title="Notificaciones" onClick={() => setOpen(!open)} className="relative p-2 rounded text-secondary hover:bg-surface-1 hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/20">
      <Bell className="w-[18px] h-[18px]" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="absolute right-0 top-11 z-30 w-[min(360px,calc(100vw-2rem))] bg-surface-2 border border-border rounded-card shadow-[0_16px_40px_rgba(21,27,34,0.14)] overflow-hidden"><div className="flex items-center justify-between p-4 border-b border-border"><div><h2 className="text-sm font-medium">Notificaciones</h2><p className="text-xs text-muted mt-0.5">{unread ? `${unread} pendientes de leer` : 'Todo al día'}</p></div><button aria-label="Cerrar notificaciones" onClick={() => setOpen(false)} className="p-1 text-muted hover:text-ink"><X className="w-4 h-4" /></button></div>{notifications.length === 0 ? <p className="p-6 text-sm text-muted text-center">No tienes notificaciones nuevas.</p> : <div className="max-h-[360px] overflow-y-auto">{notifications.map((notification) => { const Icon = ICONS[notification.tipo] ?? Info; return <div key={notification.id} className={`flex gap-3 p-4 border-b border-border last:border-0 ${notification.leida ? '' : 'bg-accent-bg/40'}`}><Icon className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" /><div className="min-w-0"><button onClick={() => markRead(notification)} className="text-left w-full"><p className="text-sm font-medium">{notification.titulo}</p><p className="text-xs text-secondary mt-1 leading-5">{notification.mensaje}</p></button>{notification.enlace && <Link to={notification.enlace} onClick={() => markRead(notification)} className="inline-block text-xs text-accent mt-2 hover:underline">Ver detalle</Link>}<p className="text-[11px] text-muted mt-2">{new Date(notification.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</p></div></div> })}</div>}</div>}
  </div>
}
