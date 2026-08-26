import { Bell, Database, Globe2, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const settings = [
  { icon: Globe2, title: 'Idioma y región', description: 'Formato de fechas y números usado en los reportes.', value: 'Español · Colombia' },
  { icon: Bell, title: 'Notificaciones', description: 'Avisos de actividad y alertas pastorales en tiempo real.', value: 'Activadas' },
  { icon: LockKeyhole, title: 'Seguridad', description: 'Las contraseñas deben tener mayúscula, número, símbolo y 8 caracteres.', value: 'Política activa' },
  { icon: Database, title: 'Sincronización', description: 'La PWA envía los registros a la plataforma cuando recupera conexión.', value: 'Supabase · Conectado' },
]

export default function ConfiguracionSistema() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState({ recibir_notificaciones: true, recibir_alertas: true, formato_fecha: 'DD/MM/AAAA' })
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('preferencias_usuario').select('recibir_notificaciones, recibir_alertas, formato_fecha').eq('usuario_id', user.id).maybeSingle().then(({ data }) => { if (data) setPreferences(data) })
  }, [user])

  async function savePreferences(event) {
    event.preventDefault()
    const { error } = await supabase.from('preferencias_usuario').upsert({ ...preferences, usuario_id: user.id })
    setNotice(error ? 'No se pudieron guardar las preferencias.' : 'Preferencias personales guardadas.')
  }

  return <div className="flex flex-col gap-6 max-w-4xl"><div><p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Administración</p><h1 className="text-2xl font-semibold">Configuración del sistema</h1><p className="text-sm text-secondary mt-1">Preferencias generales y estado de los servicios de SIGA.</p></div><div className="grid md:grid-cols-2 gap-4">{settings.map(({ icon: Icon, title, description, value }) => <section key={title} className="card p-5"><div className="flex gap-3"><div className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" /></div><div><h2 className="font-medium">{title}</h2><p className="text-sm text-secondary mt-1 leading-5">{description}</p><span className="inline-block text-xs text-success bg-success-bg rounded px-2 py-1 mt-4">{value}</span></div></div></section>)}</div><form onSubmit={savePreferences} className="card p-5 max-w-2xl"><h2 className="font-medium">Mis preferencias</h2><p className="text-sm text-secondary mt-1 mb-5">Personaliza qué avisos quieres recibir y cómo leer las fechas.</p><div className="flex flex-col gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferences.recibir_notificaciones} onChange={(e) => setPreferences({ ...preferences, recibir_notificaciones: e.target.checked })} /> Recibir notificaciones de actividad</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferences.recibir_alertas} onChange={(e) => setPreferences({ ...preferences, recibir_alertas: e.target.checked })} /> Recibir alertas pastorales</label><label className="text-sm">Formato de fecha<select className="input-field mt-1.5" value={preferences.formato_fecha} onChange={(e) => setPreferences({ ...preferences, formato_fecha: e.target.value })}><option>DD/MM/AAAA</option><option>MM/DD/AAAA</option></select></label></div><div className="flex items-center gap-4 mt-5"><button className="btn-primary">Guardar preferencias</button>{notice && <p role="status" className="text-sm text-success">{notice}</p>}</div></form><section className="border border-dashed border-border rounded-card p-5"><h2 className="font-medium">Estado de la plataforma</h2><p className="text-sm text-secondary mt-1">La configuración avanzada de organización, módulos y catálogos se administra desde las secciones operativas correspondientes.</p></section></div>
}
