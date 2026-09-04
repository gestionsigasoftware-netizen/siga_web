import { useEffect, useState } from 'react'
import { CreditCard, Landmark, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'
import { formatFecha } from '../lib/dateFormat'
import { usePreferencias } from '../hooks/usePreferencias'
import { calcularEstadoSuscripcion } from '../lib/suscripciones'
import InfoTip from '../components/InfoTip'

const PLAN_LABELS = { mensual: 'Mensual', anual: 'Anual' }
const ESTADO_LABELS = { activa: 'Activa', en_gracia: 'En periodo de gracia', bloqueada: 'Bloqueada', sin_configurar: 'Sin suscripción' }
const ESTADO_TONE = { activa: 'text-success', en_gracia: 'text-warning', bloqueada: 'text-danger', sin_configurar: 'text-muted' }
const METODO_PAGO_VACIO = { nequi_numero: '', nequi_titular: '', banco_nombre: '', banco_numero: '', banco_titular: '', notas: '' }

export default function Suscripciones() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const { formato_fecha } = usePreferencias()
  const [congregaciones, setCongregaciones] = useState([])
  const [suscripciones, setSuscripciones] = useState({})
  const [metodoPago, setMetodoPago] = useState(METODO_PAGO_VACIO)
  const [guardandoMetodo, setGuardandoMetodo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ plan: 'mensual', monto: '', fecha_proximo_pago: '', dias_gracia: 5 })
  const [saving, setSaving] = useState(false)

  async function cargar() {
    setLoading(true)
    const [{ data: congregacionesData, error: congregacionesError }, { data: suscripcionesData, error: suscripcionesError }, { data: metodoPagoData }] = await Promise.all([
      supabase.from('congregaciones').select('id, nombre, ciudad, distritos(nombre, numero)').order('nombre'),
      supabase.from('suscripciones').select('*'),
      supabase.from('metodos_pago_sigap').select('*').maybeSingle(),
    ])
    if (congregacionesError || suscripcionesError) setError('No se pudieron cargar las suscripciones.')
    setCongregaciones(congregacionesData ?? [])
    setSuscripciones(Object.fromEntries((suscripcionesData ?? []).map((item) => [item.congregacion_id, item])))
    if (metodoPagoData) setMetodoPago({ ...METODO_PAGO_VACIO, ...metodoPagoData })
    setLoading(false)
  }

  useEffect(() => { if (!roleLoading) cargar() }, [roleLoading])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  function abrirEdicion(congregacion) {
    const actual = suscripciones[congregacion.id]
    setEditando(congregacion)
    setForm({
      plan: actual?.plan || 'mensual',
      monto: actual?.monto || '',
      fecha_proximo_pago: actual?.fecha_proximo_pago || new Date().toISOString().slice(0, 10),
      dias_gracia: actual?.dias_gracia ?? 5,
    })
  }

  async function guardarSuscripcion(event) {
    event.preventDefault()
    if (!editando || !form.fecha_proximo_pago) return
    setSaving(true)
    setError(null)
    const payload = {
      congregacion_id: editando.id,
      plan: form.plan,
      monto: form.monto ? Number(form.monto) : null,
      fecha_proximo_pago: form.fecha_proximo_pago,
      dias_gracia: Number(form.dias_gracia) || 0,
    }
    const { error: upsertError } = await supabase.from('suscripciones').upsert(payload, { onConflict: 'congregacion_id' })
    setSaving(false)
    if (upsertError) { setError('No se pudo guardar la suscripción.'); return }
    setEditando(null)
    setNotice('Suscripción guardada.')
    cargar()
  }

  async function registrarPago(congregacionId) {
    setError(null)
    const { error: rpcError } = await supabase.rpc('registrar_pago_suscripcion', { p_congregacion_id: congregacionId, p_metodo: 'Manual (Nequi/banco)' })
    if (rpcError) { setError(rpcError.message || 'No se pudo registrar el pago.'); return }
    setNotice('Pago registrado. Próxima fecha de pago actualizada.')
    cargar()
  }

  async function guardarMetodoPago(event) {
    event.preventDefault()
    setGuardandoMetodo(true)
    setError(null)
    const { error: updateError } = await supabase.from('metodos_pago_sigap').update({ ...metodoPago, updated_at: new Date().toISOString() }).eq('id', true)
    setGuardandoMetodo(false)
    if (updateError) { setError('No se pudo guardar el método de pago.'); return }
    setNotice('Método de pago actualizado.')
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando suscripciones...</div>
  if (rolPrincipal?.nivel !== 'super_admin') return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Esta vista es exclusiva de super_admin — la facturación de SIGAP no depende del rol pastoral nacional.</p>

  const filas = congregaciones
    .filter((congregacion) => !searchTerm || congregacion.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    .map((congregacion) => ({ congregacion, suscripcion: suscripciones[congregacion.id], estado: calcularEstadoSuscripcion(suscripciones[congregacion.id]) }))

  const resumen = filas.reduce((acc, fila) => { acc[fila.estado] = (acc[fila.estado] || 0) + 1; return acc }, {})

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">Operación comercial · super_admin</p>
        <h1 className="section-title">Suscripciones</h1>
        <p className="text-sm text-secondary mt-0.5">Cobro por congregación. Sin pasarela de pagos todavía — la congregación paga por Nequi o transferencia y aquí registras el pago manualmente. Al vencer, hay 5 días de gracia y luego se bloquea el acceso; solo super_admin puede reactivarlo.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-1"><Landmark className="w-4 h-4 text-accent" /><h2 className="font-medium">Método de pago para las congregaciones</h2></div>
        <p className="text-xs text-secondary mb-4">Esto es lo que ve una congregación cuando le toca pagar (aviso de gracia o bloqueo). Un solo método para todo SIGAP, no uno por congregación.</p>
        <form onSubmit={guardarMetodoPago} className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">Nequi — número<input className="input-field mt-1.5" value={metodoPago.nequi_numero || ''} onChange={(event) => setMetodoPago({ ...metodoPago, nequi_numero: event.target.value })} /></label>
          <label className="text-sm">Nequi — titular<input className="input-field mt-1.5" value={metodoPago.nequi_titular || ''} onChange={(event) => setMetodoPago({ ...metodoPago, nequi_titular: event.target.value })} /></label>
          <label className="text-sm">Banco<input className="input-field mt-1.5" value={metodoPago.banco_nombre || ''} onChange={(event) => setMetodoPago({ ...metodoPago, banco_nombre: event.target.value })} /></label>
          <label className="text-sm">Número de cuenta<input className="input-field mt-1.5" value={metodoPago.banco_numero || ''} onChange={(event) => setMetodoPago({ ...metodoPago, banco_numero: event.target.value })} /></label>
          <label className="text-sm">Titular de la cuenta<input className="input-field mt-1.5" value={metodoPago.banco_titular || ''} onChange={(event) => setMetodoPago({ ...metodoPago, banco_titular: event.target.value })} /></label>
          <label className="text-sm">Notas <span className="text-xs text-muted">(opcional)</span><input className="input-field mt-1.5" value={metodoPago.notas || ''} onChange={(event) => setMetodoPago({ ...metodoPago, notas: event.target.value })} /></label>
          <div className="sm:col-span-2"><button disabled={guardandoMetodo} className="btn-primary">{guardandoMetodo ? 'Guardando...' : 'Guardar método de pago'}</button></div>
        </form>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Activas</p><p className="text-2xl font-semibold mt-3 text-success">{resumen.activa || 0}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">En gracia<InfoTip texto="Ya venció su pago, pero todavía pueden usar el sistema mientras pasan los días de gracia configurados." /></p><p className="text-2xl font-semibold mt-3 text-warning">{resumen.en_gracia || 0}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">Bloqueadas<InfoTip texto="Pasaron los días de gracia sin que se registrara el pago. No pueden entrar a SIGAP hasta que registres el pago." /></p><p className="text-2xl font-semibold mt-3 text-danger">{resumen.bloqueada || 0}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">Sin configurar<InfoTip texto="Todavía no se les ha creado una suscripción, así que no aplica ningún bloqueo por pago." /></p><p className="text-2xl font-semibold mt-3">{resumen.sin_configurar || 0}</p></div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2"><Search className="w-4 h-4 text-muted" /><input className="bg-transparent outline-none text-sm w-full" placeholder="Buscar congregación..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-5 py-3">Congregación</th><th className="font-normal px-5 py-3">Distrito</th><th className="font-normal px-5 py-3">Plan</th><th className="font-normal px-5 py-3">Próximo pago</th><th className="font-normal px-5 py-3">Estado</th><th className="font-normal px-5 py-3"><span className="flex items-center justify-end gap-1.5">Acciones<InfoTip texto="'Registrar pago' no cobra nada automáticamente: solo confirma que ya te pagaron y mueve la próxima fecha de pago." /></span></th></tr></thead>
            <tbody>
              {filas.map(({ congregacion, suscripcion, estado }) => (
                <tr key={congregacion.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium">{congregacion.nombre}</td>
                  <td className="px-5 py-3 text-secondary">{congregacion.distritos ? `Distrito ${congregacion.distritos.numero ?? ''} · ${congregacion.distritos.nombre}` : '—'}</td>
                  <td className="px-5 py-3 text-secondary">{suscripcion ? PLAN_LABELS[suscripcion.plan] : '—'}</td>
                  <td className="px-5 py-3 text-secondary">{suscripcion ? formatFecha(suscripcion.fecha_proximo_pago, { formato: formato_fecha }) : '—'}</td>
                  <td className={`px-5 py-3 font-medium ${ESTADO_TONE[estado]}`}>{ESTADO_LABELS[estado]}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => abrirEdicion(congregacion)} className="text-accent text-xs mr-3">{suscripcion ? 'Editar' : 'Configurar'}</button>
                    {suscripcion && <button type="button" onClick={() => registrarPago(congregacion.id)} className="text-success text-xs">Registrar pago</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editando && (
        <div className="fixed inset-0 z-40 bg-ink/30 flex items-center justify-center p-4" onClick={() => setEditando(null)}>
          <form onSubmit={guardarSuscripcion} className="w-full max-w-md bg-surface-2 rounded-card shadow-xl p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1"><CreditCard className="w-4 h-4 text-accent" /><h2 className="font-medium">{editando.nombre}</h2></div>
            <p className="text-xs text-secondary mb-4">Configura el plan y la próxima fecha de pago.</p>
            <div className="flex flex-col gap-3">
              <label className="text-sm">Plan<select className="input-field mt-1.5" value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}><option value="mensual">Mensual</option><option value="anual">Anual</option></select></label>
              <label className="text-sm">Monto (COP) <span className="text-xs text-muted">(opcional)</span><input type="number" min="0" className="input-field mt-1.5" value={form.monto} onChange={(event) => setForm({ ...form, monto: event.target.value })} /></label>
              <label className="text-sm">Próxima fecha de pago<input required type="date" className="input-field mt-1.5" value={form.fecha_proximo_pago} onChange={(event) => setForm({ ...form, fecha_proximo_pago: event.target.value })} /></label>
              <label className="text-sm">Días de gracia después del vencimiento<input type="number" min="0" className="input-field mt-1.5" value={form.dias_gracia} onChange={(event) => setForm({ ...form, dias_gracia: event.target.value })} /></label>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setEditando(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
              <button disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
