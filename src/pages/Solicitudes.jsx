import { useEffect, useState } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useMiRol } from '../hooks/useMiRol'
import { formatFecha } from '../lib/dateFormat'
import { usePreferencias } from '../hooks/usePreferencias'
import InfoTip from '../components/InfoTip'

const TIPO_LABELS = { administrativa: 'Administrativa', queja: 'Queja', sugerencia: 'Sugerencia', recurso: 'Recurso', otro: 'Otro' }
const ESTADO_LABELS = { pendiente: 'Pendiente', en_proceso: 'En proceso', resuelto: 'Resuelto', cerrado: 'Cerrado' }
const ESTADO_TONE = { pendiente: 'text-warning', en_proceso: 'text-accent', resuelto: 'text-success', cerrado: 'text-muted' }
const PRIORIDAD_LABELS = { baja: 'Baja', media: 'Media', alta: 'Alta' }

function formatDistritoLabel(nombre, numero) {
  return numero ? `Distrito ${numero} · ${nombre}` : nombre
}

export default function Solicitudes() {
  const { user } = useAuth()
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const { formato_fecha } = usePreferencias()
  const nivel = rolPrincipal?.nivel

  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('todos')

  const [tipo, setTipo] = useState('administrativa')
  const [asunto, setAsunto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [prioridad, setPrioridad] = useState('media')
  const [direccion, setDireccion] = useState('nacional') // solo para distrital: 'nacional' o 'local'
  const [congregacionDestinoId, setCongregacionDestinoId] = useState('')
  const [distritoDestinoId, setDistritoDestinoId] = useState('')
  const [saving, setSaving] = useState(false)

  const [distritos, setDistritos] = useState([])
  const [congregacionesDistrito, setCongregacionesDistrito] = useState([])
  const [congregacionDistritoId, setCongregacionDistritoId] = useState(null)

  const [seleccionada, setSeleccionada] = useState(null)
  const [respuestas, setRespuestas] = useState([])
  const [respuestaTexto, setRespuestaTexto] = useState('')
  const [savingRespuesta, setSavingRespuesta] = useState(false)

  async function cargarSolicitudes() {
    setLoading(true)
    const { data, error: loadError } = await supabase.from('solicitudes_jerarquicas').select('*').order('actualizado_en', { ascending: false }).limit(200)
    if (loadError) setError('No se pudieron cargar las solicitudes.')
    setSolicitudes(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!roleLoading && rolPrincipal) cargarSolicitudes()
  }, [roleLoading, rolPrincipal])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!rolPrincipal) return
    if (nivel === 'local') {
      supabase.from('congregaciones').select('distrito_id').eq('id', rolPrincipal.congregacion_id).single().then(({ data }) => setCongregacionDistritoId(data?.distrito_id ?? null))
    } else if (nivel === 'distrital') {
      supabase.from('congregaciones').select('id, nombre').eq('distrito_id', rolPrincipal.distrito_id).order('nombre').then(({ data }) => setCongregacionesDistrito(data ?? []))
    } else if (nivel === 'nacional' || nivel === 'super_admin') {
      supabase.from('distritos').select('id, nombre, numero').order('numero').then(({ data }) => setDistritos(data ?? []))
    }
  }, [rolPrincipal, nivel])

  async function crearSolicitud(event) {
    event.preventDefault()
    if (!asunto.trim() || !descripcion.trim() || saving) return
    setSaving(true)
    setError(null)

    let payload = { creado_por: user.id, tipo, asunto: asunto.trim(), descripcion: descripcion.trim(), prioridad }
    if (nivel === 'local') {
      if (!congregacionDistritoId) { setSaving(false); setError('No se pudo determinar tu distrito.'); return }
      payload = { ...payload, nivel_origen: 'local', nivel_destino: 'distrital', congregacion_id: rolPrincipal.congregacion_id, distrito_id: congregacionDistritoId }
    } else if (nivel === 'distrital' && direccion === 'nacional') {
      payload = { ...payload, nivel_origen: 'distrital', nivel_destino: 'nacional', distrito_id: rolPrincipal.distrito_id }
    } else if (nivel === 'distrital' && direccion === 'local') {
      if (!congregacionDestinoId) { setSaving(false); setError('Selecciona una congregación.'); return }
      payload = { ...payload, nivel_origen: 'distrital', nivel_destino: 'local', distrito_id: rolPrincipal.distrito_id, congregacion_id: congregacionDestinoId }
    } else if (nivel === 'nacional' || nivel === 'super_admin') {
      if (!distritoDestinoId) { setSaving(false); setError('Selecciona un distrito.'); return }
      payload = { ...payload, nivel_origen: 'nacional', nivel_destino: 'distrital', distrito_id: distritoDestinoId }
    } else {
      setSaving(false); setError('Tu rol no puede enviar solicitudes internas.'); return
    }

    const { error: insertError } = await supabase.from('solicitudes_jerarquicas').insert(payload)
    setSaving(false)
    if (insertError) { setError('No se pudo enviar la solicitud.'); return }
    setAsunto(''); setDescripcion(''); setCongregacionDestinoId(''); setDistritoDestinoId('')
    setNotice('Solicitud enviada.')
    cargarSolicitudes()
  }

  async function abrirSolicitud(solicitud) {
    setSeleccionada(solicitud)
    const { data } = await supabase.from('respuestas_solicitud').select('*').eq('solicitud_id', solicitud.id).order('created_at')
    setRespuestas(data ?? [])
  }

  async function enviarRespuesta(event) {
    event.preventDefault()
    if (!respuestaTexto.trim() || savingRespuesta || !seleccionada) return
    setSavingRespuesta(true)
    const { error: insertError } = await supabase.from('respuestas_solicitud').insert({ solicitud_id: seleccionada.id, autor_id: user.id, mensaje: respuestaTexto.trim() })
    setSavingRespuesta(false)
    if (insertError) { setError('No se pudo enviar la respuesta.'); return }
    setRespuestaTexto('')
    abrirSolicitud(seleccionada)
    cargarSolicitudes()
  }

  async function cambiarEstado(solicitud, nuevoEstado) {
    const { error: updateError } = await supabase.from('solicitudes_jerarquicas').update({ estado: nuevoEstado, actualizado_en: new Date().toISOString() }).eq('id', solicitud.id)
    if (updateError) { setError('No se pudo actualizar el estado.'); return }
    setSeleccionada((current) => current && current.id === solicitud.id ? { ...current, estado: nuevoEstado } : current)
    cargarSolicitudes()
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando solicitudes...</div>
  if (!['local', 'distrital', 'nacional', 'super_admin'].includes(nivel)) return <p className="card p-8 text-center text-sm text-secondary">No tienes un nivel válido para usar solicitudes internas.</p>

  const solicitudesFiltradas = solicitudes.filter((solicitud) => filtroEstado === 'todos' || solicitud.estado === filtroEstado)

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">Comunicación institucional</p>
        <h1 className="section-title">Solicitudes internas</h1>
        <p className="text-sm text-secondary mt-0.5">Peticiones formales entre niveles — local ↔ distrital, distrital ↔ nacional. No es un chat: cada solicitud queda con tipo, prioridad y estado.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <section className="card p-5 max-w-2xl">
        <h2 className="font-medium mb-4">Nueva solicitud</h2>
        <form onSubmit={crearSolicitud} className="flex flex-col gap-3">
          {nivel === 'distrital' && (
            <div className="flex gap-2" role="group" aria-label="Dirección de la solicitud">
              <button type="button" onClick={() => setDireccion('nacional')} className={`text-xs px-3 py-2 rounded border ${direccion === 'nacional' ? 'bg-accent text-white border-accent' : 'border-border text-secondary'}`}>Enviar a Nacional</button>
              <button type="button" onClick={() => setDireccion('local')} className={`text-xs px-3 py-2 rounded border ${direccion === 'local' ? 'bg-accent text-white border-accent' : 'border-border text-secondary'}`}>Enviar a una congregación</button>
            </div>
          )}
          {nivel === 'distrital' && direccion === 'local' && (
            <label className="text-sm">Congregación<select required className="input-field mt-1.5" value={congregacionDestinoId} onChange={(event) => setCongregacionDestinoId(event.target.value)}><option value="">Seleccionar...</option>{congregacionesDistrito.map((congregacion) => <option key={congregacion.id} value={congregacion.id}>{congregacion.nombre}</option>)}</select></label>
          )}
          {(nivel === 'nacional' || nivel === 'super_admin') && (
            <label className="text-sm">Distrito<select required className="input-field mt-1.5" value={distritoDestinoId} onChange={(event) => setDistritoDestinoId(event.target.value)}><option value="">Seleccionar...</option>{distritos.map((distrito) => <option key={distrito.id} value={distrito.id}>{formatDistritoLabel(distrito.nombre, distrito.numero)}</option>)}</select></label>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">Tipo<select className="input-field mt-1.5" value={tipo} onChange={(event) => setTipo(event.target.value)}>{Object.entries(TIPO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm flex items-center gap-1">Prioridad<InfoTip texto="Marcar 'Alta' resalta la solicitud en la lista de quien la recibe, para que la atienda primero." /><select className="input-field mt-1.5 w-full" value={prioridad} onChange={(event) => setPrioridad(event.target.value)}>{Object.entries(PRIORIDAD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label className="text-sm">Asunto<input required maxLength={140} value={asunto} onChange={(event) => setAsunto(event.target.value)} className="input-field mt-1.5" /></label>
          <label className="text-sm">Descripción<textarea required minLength={10} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} className="input-field mt-1.5 min-h-28" /></label>
          <div className="flex items-center gap-3">
            <button disabled={saving} className="btn-primary"><Send className="w-4 h-4" /> {saving ? 'Enviando...' : 'Enviar solicitud'}</button>
            {notice && <p role="status" className="text-sm text-success">{notice}</p>}
          </div>
        </form>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-medium">Solicitudes ({solicitudesFiltradas.length})</h2>
          <select className="input-field w-auto text-xs" value={filtroEstado} onChange={(event) => setFiltroEstado(event.target.value)}>
            <option value="todos">Todos los estados</option>
            {Object.entries(ESTADO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {solicitudesFiltradas.length === 0 ? <p className="p-6 text-sm text-muted">No hay solicitudes.</p> : (
          <div className="divide-y divide-border">
            {solicitudesFiltradas.map((solicitud) => (
              <button type="button" key={solicitud.id} onClick={() => abrirSolicitud(solicitud)} className="w-full text-left p-4 hover:bg-surface-1 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><span className="audit-badge">{TIPO_LABELS[solicitud.tipo]}</span><span className="text-xs text-muted">{solicitud.nivel_origen} → {solicitud.nivel_destino}</span>{solicitud.prioridad === 'alta' && <span className="text-xs text-danger font-medium">Prioridad alta</span>}</div>
                  <p className="text-sm font-medium mt-1.5">{solicitud.asunto}</p>
                  <p className="text-xs text-muted mt-1">{formatFecha(solicitud.created_at, { formato: formato_fecha, conHora: true })}</p>
                </div>
                <span className={`text-xs font-medium flex-shrink-0 ${ESTADO_TONE[solicitud.estado]}`}>{ESTADO_LABELS[solicitud.estado]}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {seleccionada && (
        <div className="fixed inset-0 z-40 bg-ink/30 flex items-center justify-center p-4" onClick={() => setSeleccionada(null)}>
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-surface-2 rounded-card shadow-xl p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div><span className="audit-badge">{TIPO_LABELS[seleccionada.tipo]}</span><h2 className="font-medium mt-2">{seleccionada.asunto}</h2><p className="text-xs text-muted mt-1">{seleccionada.nivel_origen} → {seleccionada.nivel_destino} · {formatFecha(seleccionada.created_at, { formato: formato_fecha, conHora: true })}</p></div>
              <button type="button" onClick={() => setSeleccionada(null)} aria-label="Cerrar" className="text-sm text-secondary hover:text-ink">Cerrar</button>
            </div>
            <p className="text-sm text-secondary leading-6 mb-4">{seleccionada.descripcion}</p>
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xs text-muted flex items-center gap-1">Estado:<InfoTip texto="Cambia al instante para las dos partes, sin necesidad de guardar aparte." /></span>
              {Object.entries(ESTADO_LABELS).map(([value, label]) => (
                <button type="button" key={value} onClick={() => cambiarEstado(seleccionada, value)} className={`text-xs px-2.5 py-1 rounded border ${seleccionada.estado === value ? 'bg-accent text-white border-accent' : 'border-border text-secondary'}`}>{label}</button>
              ))}
            </div>
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-accent" /> Respuestas</h3>
              <div className="flex flex-col gap-3 mb-4">
                {respuestas.length === 0 ? <p className="text-xs text-muted">Sin respuestas todavía.</p> : respuestas.map((respuesta) => (
                  <div key={respuesta.id} className="bg-surface-1 rounded p-3"><p className="text-sm">{respuesta.mensaje}</p><p className="text-xs text-muted mt-1.5">{formatFecha(respuesta.created_at, { formato: formato_fecha, conHora: true })}</p></div>
                ))}
              </div>
              <form onSubmit={enviarRespuesta} className="flex gap-2">
                <input value={respuestaTexto} onChange={(event) => setRespuestaTexto(event.target.value)} placeholder="Escribe una respuesta..." className="input-field flex-1" />
                <button disabled={savingRespuesta} className="btn-secondary">{savingRespuesta ? '...' : 'Enviar'}</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
