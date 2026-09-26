import { useEffect, useState } from 'react'
import { CreditCard, Landmark, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { hoyBogota } from "../lib/fechaBogota";
import { useMiRol } from '../hooks/useMiRol'
import { formatFecha } from '../lib/dateFormat'
import { usePreferencias } from '../hooks/usePreferencias'
import { calcularEstadoSuscripcion } from '../lib/suscripciones'
import InfoTip from '../components/InfoTip'
import Toast from '../components/Toast'

const suscripcionesCache = new Map()

const ESTADO_TONE = { activa: 'text-success', en_gracia: 'text-warning', bloqueada: 'text-danger', sin_configurar: 'text-muted' }
const METODO_PAGO_VACIO = { nequi_numero: '', nequi_titular: '', banco_nombre: '', banco_numero: '', banco_titular: '', notas: '' }

export default function Suscripciones() {
  const { t } = useTranslation()
  const PLAN_LABELS = t('suscripciones.planLabels', { returnObjects: true })
  const ESTADO_LABELS = t('suscripciones.estadoLabels', { returnObjects: true })
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
    const cacheKey = 'all'
    const cached = suscripcionesCache.get(cacheKey)
    if (cached) {
      setCongregaciones(cached.congregaciones)
      setSuscripciones(cached.suscripciones)
      if (cached.metodoPago) setMetodoPago(cached.metodoPago)
      setLoading(false)
    } else {
      setLoading(true)
    }
    const [{ data: congregacionesData, error: congregacionesError }, { data: suscripcionesData, error: suscripcionesError }, { data: metodoPagoData, error: metodoPagoError }] = await Promise.all([
      supabase.from('congregaciones').select('id, nombre, ciudad, distritos(nombre, numero)').order('nombre'),
      supabase.from('suscripciones').select('*'),
      supabase.from('metodos_pago_sigap').select('*').maybeSingle(),
    ])
    if (congregacionesError || suscripcionesError || metodoPagoError) setError(t('suscripciones.errorCargar'))
    const newCongregaciones = congregacionesData ?? []
    const newSuscripciones = Object.fromEntries((suscripcionesData ?? []).map((item) => [item.congregacion_id, item]))
    const newMetodoPago = metodoPagoData ? { ...METODO_PAGO_VACIO, ...metodoPagoData } : null
    setCongregaciones(newCongregaciones)
    setSuscripciones(newSuscripciones)
    if (newMetodoPago) setMetodoPago(newMetodoPago)
    setLoading(false)
    suscripcionesCache.set(cacheKey, { congregaciones: newCongregaciones, suscripciones: newSuscripciones, metodoPago: newMetodoPago })
  }

  // No basta con ocultar la tabla si el rol activo no es super_admin: la
  // consulta debe ni siquiera dispararse, porque una cuenta multi-rol (ej.
  // super_admin viendo "como" local) igual pasaria la RLS y traeria estos
  // datos de negocio a memoria/red aunque la pantalla no los muestre.
  useEffect(() => {
    if (roleLoading) return
    if (rolPrincipal?.nivel === 'super_admin') cargar()
    else setLoading(false)
  }, [roleLoading, rolPrincipal?.nivel])

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
      fecha_proximo_pago: actual?.fecha_proximo_pago || hoyBogota(),
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
    if (upsertError) { setError(t('suscripciones.errorGuardarSuscripcion')); return }
    setEditando(null)
    setNotice(t('suscripciones.suscripcionGuardada'))
    cargar()
  }

  async function registrarPago(congregacionId) {
    setError(null)
    const { error: rpcError } = await supabase.rpc('registrar_pago_suscripcion', { p_congregacion_id: congregacionId, p_metodo: 'Manual (Nequi/banco)' })
    if (rpcError) { setError(rpcError.message || t('suscripciones.errorRegistrarPago')); return }
    setNotice(t('suscripciones.pagoRegistrado'))
    cargar()
  }

  async function guardarMetodoPago(event) {
    event.preventDefault()
    setGuardandoMetodo(true)
    setError(null)
    const { error: updateError } = await supabase.from('metodos_pago_sigap').update({ ...metodoPago, updated_at: new Date().toISOString() }).eq('id', true)
    setGuardandoMetodo(false)
    if (updateError) { setError(t('suscripciones.errorGuardarMetodo')); return }
    setNotice(t('suscripciones.metodoActualizado'))
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('suscripciones.cargando')}</div>
  if (rolPrincipal?.nivel !== 'super_admin') return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{t('suscripciones.soloSuperAdmin')}</p>

  const filas = congregaciones
    .filter((congregacion) => !searchTerm || congregacion.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    .map((congregacion) => ({ congregacion, suscripcion: suscripciones[congregacion.id], estado: calcularEstadoSuscripcion(suscripciones[congregacion.id]) }))

  const resumen = filas.reduce((acc, fila) => { acc[fila.estado] = (acc[fila.estado] || 0) + 1; return acc }, {})

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">{t('suscripciones.eyebrow')}</p>
        <h1 className="section-title">{t('suscripciones.titulo')}</h1>
        <p className="text-sm text-secondary mt-0.5">{t('suscripciones.subtitulo')}</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      <Toast>{notice}</Toast>

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-1"><Landmark className="w-4 h-4 text-accent" /><h2 className="font-medium">{t('suscripciones.metodoPagoTitulo')}</h2></div>
        <p className="text-xs text-secondary mb-4">{t('suscripciones.metodoPagoSubtitulo')}</p>
        <form onSubmit={guardarMetodoPago} className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">{t('suscripciones.nequiNumero')}<input className="input-field mt-1.5" value={metodoPago.nequi_numero || ''} onChange={(event) => setMetodoPago({ ...metodoPago, nequi_numero: event.target.value })} /></label>
          <label className="text-sm">{t('suscripciones.nequiTitular')}<input className="input-field mt-1.5" value={metodoPago.nequi_titular || ''} onChange={(event) => setMetodoPago({ ...metodoPago, nequi_titular: event.target.value })} /></label>
          <label className="text-sm">{t('suscripciones.banco')}<input className="input-field mt-1.5" value={metodoPago.banco_nombre || ''} onChange={(event) => setMetodoPago({ ...metodoPago, banco_nombre: event.target.value })} /></label>
          <label className="text-sm">{t('suscripciones.numeroCuenta')}<input className="input-field mt-1.5" value={metodoPago.banco_numero || ''} onChange={(event) => setMetodoPago({ ...metodoPago, banco_numero: event.target.value })} /></label>
          <label className="text-sm">{t('suscripciones.titularCuenta')}<input className="input-field mt-1.5" value={metodoPago.banco_titular || ''} onChange={(event) => setMetodoPago({ ...metodoPago, banco_titular: event.target.value })} /></label>
          <label className="text-sm">{t('suscripciones.notas')} <span className="text-xs text-muted">{t('suscripciones.opcional')}</span><input className="input-field mt-1.5" value={metodoPago.notas || ''} onChange={(event) => setMetodoPago({ ...metodoPago, notas: event.target.value })} /></label>
          <div className="sm:col-span-2"><button disabled={guardandoMetodo} className="btn-primary">{guardandoMetodo ? t('suscripciones.guardando') : t('suscripciones.guardarMetodoPago')}</button></div>
        </form>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{t('suscripciones.activas')}</p><p className="text-2xl font-semibold mt-3 text-success">{resumen.activa || 0}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">{t('suscripciones.enGracia')}<InfoTip texto={t('suscripciones.enGraciaTip')} /></p><p className="text-2xl font-semibold mt-3 text-warning">{resumen.en_gracia || 0}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">{t('suscripciones.bloqueadas')}<InfoTip texto={t('suscripciones.bloqueadasTip')} /></p><p className="text-2xl font-semibold mt-3 text-danger">{resumen.bloqueada || 0}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">{t('suscripciones.sinConfigurar')}<InfoTip texto={t('suscripciones.sinConfigurarTip')} /></p><p className="text-2xl font-semibold mt-3">{resumen.sin_configurar || 0}</p></div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2"><Search className="w-4 h-4 text-muted" /><input className="bg-transparent outline-none text-sm w-full" placeholder={t('suscripciones.buscarCongregacion')} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-5 py-3">{t('suscripciones.colCongregacion')}</th><th className="font-normal px-5 py-3">{t('suscripciones.colDistrito')}</th><th className="font-normal px-5 py-3">{t('suscripciones.colPlan')}</th><th className="font-normal px-5 py-3">{t('suscripciones.colProximoPago')}</th><th className="font-normal px-5 py-3">{t('suscripciones.colEstado')}</th><th className="font-normal px-5 py-3"><span className="flex items-center justify-end gap-1.5">{t('suscripciones.colAcciones')}<InfoTip texto={t('suscripciones.accionesTip')} /></span></th></tr></thead>
            <tbody>
              {filas.map(({ congregacion, suscripcion, estado }) => (
                <tr key={congregacion.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium">{congregacion.nombre}</td>
                  <td className="px-5 py-3 text-secondary">{congregacion.distritos?.numero ? t('suscripciones.distritoLabel', { numero: congregacion.distritos.numero }) : '—'}</td>
                  <td className="px-5 py-3 text-secondary">{suscripcion ? PLAN_LABELS[suscripcion.plan] : '—'}</td>
                  <td className="px-5 py-3 text-secondary">{suscripcion ? formatFecha(suscripcion.fecha_proximo_pago, { formato: formato_fecha }) : '—'}</td>
                  <td className={`px-5 py-3 font-medium ${ESTADO_TONE[estado]}`}>{ESTADO_LABELS[estado]}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => abrirEdicion(congregacion)} className="text-accent text-xs mr-3">{suscripcion ? t('suscripciones.editar') : t('suscripciones.configurar')}</button>
                    {suscripcion && <button type="button" onClick={() => registrarPago(congregacion.id)} className="text-success text-xs">{t('suscripciones.registrarPago')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editando && (
        <div className="fixed inset-0 z-40 bg-night/30 flex items-center justify-center p-4" onClick={() => setEditando(null)}>
          <form onSubmit={guardarSuscripcion} className="w-full max-w-md bg-surface-2 rounded-card shadow-xl p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1"><CreditCard className="w-4 h-4 text-accent" /><h2 className="font-medium">{editando.nombre}</h2></div>
            <p className="text-xs text-secondary mb-4">{t('suscripciones.configurarSubtitulo')}</p>
            <div className="flex flex-col gap-3">
              <label className="text-sm">{t('suscripciones.plan')}<select className="input-field mt-1.5" value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}><option value="mensual">{t('suscripciones.planLabels.mensual')}</option><option value="anual">{t('suscripciones.planLabels.anual')}</option></select></label>
              <label className="text-sm">{t('suscripciones.montoLabel')} <span className="text-xs text-muted">{t('suscripciones.opcional')}</span><input type="number" min="0" className="input-field mt-1.5" value={form.monto} onChange={(event) => setForm({ ...form, monto: event.target.value })} /></label>
              <label className="text-sm">{t('suscripciones.proximaFechaPago')}<input required type="date" className="input-field mt-1.5" value={form.fecha_proximo_pago} onChange={(event) => setForm({ ...form, fecha_proximo_pago: event.target.value })} /></label>
              <label className="text-sm">{t('suscripciones.diasGracia')}<input type="number" min="0" className="input-field mt-1.5" value={form.dias_gracia} onChange={(event) => setForm({ ...form, dias_gracia: event.target.value })} /></label>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setEditando(null)} className="btn-secondary flex-1 justify-center">{t('suscripciones.cancelar')}</button>
              <button disabled={saving} className="btn-primary flex-1 justify-center">{saving ? t('suscripciones.guardando') : t('suscripciones.guardar')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
