import { Bell, Database, Globe2, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useMiRol } from '../hooks/useMiRol'
import { formatFecha } from '../lib/dateFormat'
import InfoTip from '../components/InfoTip'
import Toast from '../components/Toast'
import { confirmEnrollment, enrollTotp, listFactors, unenrollFactor } from '../lib/mfa'

const configuracionSistemaCache = new Map()

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
  const { roles } = useMiRol()
  const [preferences, setPreferences] = useState(EMPTY_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  const [error, setError] = useState(null)

  // Verificacion en dos pasos (MFA/TOTP) -- factores ya activados, y el
  // estado del formulario de activacion (QR + codigo) cuando esta en curso.
  const [mfaFactors, setMfaFactors] = useState([])
  const [mfaLoading, setMfaLoading] = useState(true)
  const [enrollData, setEnrollData] = useState(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [mfaSaving, setMfaSaving] = useState(false)

  async function loadMfaFactors() {
    setMfaLoading(true)
    const { data, error: mfaListError } = await listFactors()
    if (mfaListError) setError(`No se pudo consultar la verificación en dos pasos: ${mfaListError.message}`)
    setMfaFactors((data?.totp ?? []).filter((factor) => factor.status === 'verified'))
    setMfaLoading(false)
  }

  async function startMfaEnroll() {
    setError(null)
    setNotice(null)
    const { data, error: enrollError } = await enrollTotp()
    if (enrollError) { setError(`No se pudo iniciar la activación: ${enrollError.message}`); return }
    setEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
  }

  async function cancelMfaEnroll() {
    // Limpia el factor "no verificado" que enroll() ya creo en el
    // servidor -- si no se cancela aqui, quedaria huerfano (Supabase
    // permite varios intentos de inscripcion a la vez).
    if (enrollData) await unenrollFactor(enrollData.factorId)
    setEnrollData(null)
    setVerifyCode('')
    setError(null)
  }

  async function confirmMfaEnroll(event) {
    event.preventDefault()
    if (verifyCode.trim().length < 6) { setError('Ingresa el código de 6 dígitos que muestra tu app autenticadora.'); return }
    setMfaSaving(true)
    setError(null)
    const { error: verifyError } = await confirmEnrollment(enrollData.factorId, verifyCode.trim())
    setMfaSaving(false)
    if (verifyError) { setError('Código incorrecto. Revisa la hora de tu dispositivo e intenta con el código actual.'); return }
    setEnrollData(null)
    setVerifyCode('')
    setNotice('Verificación en dos pasos activada. La próxima vez que inicies sesión, se te pedirá el código.')
    await loadMfaFactors()
  }

  async function disableMfa(factorId) {
    if (!window.confirm('¿Desactivar la verificación en dos pasos? Tu cuenta quedará protegida solo con tu contraseña.')) return
    setMfaSaving(true)
    setError(null)
    const { error: disableError } = await unenrollFactor(factorId)
    setMfaSaving(false)
    if (disableError) { setError(`No se pudo desactivar: ${disableError.message}`); return }
    setNotice('Verificación en dos pasos desactivada.')
    await loadMfaFactors()
  }

  useEffect(() => { loadMfaFactors() }, [])

  async function loadPreferences() {
    if (!user) {
      setLoading(false)
      return
    }
    const cacheKey = user.id
    const cached = configuracionSistemaCache.get(cacheKey)
    if (cached) {
      setPreferences(cached.preferences)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    const { data, error: loadError } = await supabase.from('preferencias_usuario').select('recibir_notificaciones, recibir_alertas, formato_fecha').eq('usuario_id', user.id).maybeSingle()
    if (loadError) setError(`No se pudieron cargar tus preferencias: ${loadError.message}`)
    if (data) {
      setPreferences(data)
      configuracionSistemaCache.set(cacheKey, { preferences: data })
    }
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

  const nombrePersonaVinculada = roles[0]?.personas ? `${roles[0].personas.nombres} ${roles[0].personas.apellidos}` : null
  const ultimoAcceso = user?.last_sign_in_at ? formatFecha(user.last_sign_in_at, { formato: preferences.formato_fecha, conHora: true }) : 'Sin registro'
  const correoVerificado = Boolean(user?.email_confirmed_at)
  const cuentaCreada = user?.created_at ? formatFecha(user.created_at, { formato: preferences.formato_fecha }) : 'Sin registro'

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <p className="eyebrow">Tu espacio personal</p>
        <h1 className="section-title">Preferencias</h1>
        <p className="text-sm text-secondary mt-1">Configura cómo quieres recibir avisos y consultar la información de SIGAP.</p>
      </div>
      {error && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={loadPreferences} className="btn-secondary text-xs self-start sm:self-auto">Reintentar</button></div>}
      <form onSubmit={savePreferences} className="card p-5 max-w-2xl">
        <h2 className="font-medium">Preferencias de mi cuenta</h2>
        <p className="text-sm text-secondary mt-1 mb-5">Los avisos que recibes y el formato de tus fechas.</p>
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-accent">Avisos que quieres recibir</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferences.recibir_notificaciones} onChange={(event) => updatePreference({ recibir_notificaciones: event.target.checked })} /> Recibir notificaciones de actividad<InfoTip texto="Avisos generales del sistema: registros, aprobaciones y novedades de tu congregación." /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferences.recibir_alertas} onChange={(event) => updatePreference({ recibir_alertas: event.target.checked })} /> Recibir alertas pastorales<InfoTip texto="Avisos sobre personas que necesitan seguimiento pastoral, como ausencias prolongadas o casos marcados como prioritarios." /></label>
          <label className="text-sm pt-2">Formato regional de fecha<select className="input-field mt-1.5" value={preferences.formato_fecha} onChange={(event) => updatePreference({ formato_fecha: event.target.value })}><option value="DD/MM/AAAA">Día / mes / año (DD/MM/AAAA)</option><option value="MM/DD/AAAA">Mes / día / año (MM/DD/AAAA)</option></select></label>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-5">
          <button disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar preferencias'}</button>
          <Toast>{notice}</Toast>
        </div>
      </form>
      <section className="card p-5 max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0"><ShieldCheck className="w-4 h-4" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">Verificación en dos pasos</h2>
            <p className="text-sm text-secondary mt-1">Además de tu contraseña, pide un código de una app autenticadora (Google Authenticator, Authy u otra) al iniciar sesión. Muy recomendado para cuentas nacional y super_admin.</p>

            {mfaLoading ? (
              <p className="text-sm text-muted mt-4">Consultando estado...</p>
            ) : enrollData ? (
              <form onSubmit={confirmMfaEnroll} className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <img src={enrollData.qrCode} alt="Código QR para activar la verificación en dos pasos" className="w-36 h-36 rounded border border-border flex-shrink-0" />
                  <div className="text-sm text-secondary">
                    <p>1. Escanea este código con tu app autenticadora.</p>
                    <p className="mt-1">2. Si no puedes escanear, ingresa esta clave manualmente:</p>
                    <p className="mt-1 font-mono text-xs bg-surface-1 rounded px-2 py-1.5 break-all">{enrollData.secret}</p>
                  </div>
                </div>
                <label className="text-sm max-w-xs">Código de 6 dígitos
                  <div className="relative mt-1.5">
                    <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus autoComplete="one-time-code" placeholder="123456" value={verifyCode} onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, ''))} className="input-field pl-10 tracking-[0.3em] text-center" />
                  </div>
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={mfaSaving || verifyCode.length < 6} className="btn-primary">{mfaSaving ? 'Confirmando...' : 'Confirmar y activar'}</button>
                  <button type="button" onClick={cancelMfaEnroll} className="btn-secondary">Cancelar</button>
                </div>
              </form>
            ) : mfaFactors.length > 0 ? (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="inline-block text-xs rounded px-2 py-1 text-success bg-success-bg w-fit">Activada</span>
                <button type="button" disabled={mfaSaving} onClick={() => disableMfa(mfaFactors[0].id)} className="btn-secondary text-sm">Desactivar</button>
              </div>
            ) : (
              <div className="mt-4">
                <span className="inline-block text-xs rounded px-2 py-1 text-secondary bg-surface-1 w-fit mb-3">No activada</span>
                <div><button type="button" onClick={startMfaEnroll} className="btn-primary">Activar verificación en dos pasos</button></div>
              </div>
            )}
          </div>
        </div>
      </section>
      <section>
        <div className="mb-4"><p className="eyebrow">Información del servicio</p><h2 className="font-medium mt-1">Estado del sistema</h2><p className="text-sm text-secondary mt-1">Consulta el contexto de tu cuenta y la conexión de SIGAP.</p></div>
        <div className="grid md:grid-cols-2 gap-4">
          <StatusCard icon={Globe2} title="Idioma y región" description="El idioma de la interfaz es Español. El formato de fecha elegido se muestra aquí." value={preferences.formato_fecha === 'MM/DD/AAAA' ? 'Español · MM/DD' : 'Español · DD/MM'} />
          <StatusCard icon={Bell} title="Notificaciones" description="Resumen de las preferencias que acabas de configurar." value={preferences.recibir_notificaciones || preferences.recibir_alertas ? 'Preferencias activas' : 'Todas desactivadas'} tone={preferences.recibir_notificaciones || preferences.recibir_alertas ? 'success' : 'muted'} />
          <StatusCard icon={LockKeyhole} title="Seguridad" description={`Correo ${correoVerificado ? 'verificado' : 'sin verificar'}. Cuenta creada el ${cuentaCreada}.`} value={`Último acceso: ${ultimoAcceso}`} tone={correoVerificado ? 'success' : 'muted'} />
          <StatusCard icon={Database} title={<span className="flex items-center gap-1">Vinculación al censo<InfoTip texto="Si tu cuenta no está vinculada a una persona del censo, tu nombre no aparecerá correctamente como responsable en los registros que hagas." /></span>} description={nombrePersonaVinculada ? 'Tu cuenta está conectada al registro de feligresía de tu congregación.' : 'Esta cuenta todavía no está vinculada a ninguna persona del censo.'} value={nombrePersonaVinculada || 'Sin vincular'} tone={nombrePersonaVinculada ? 'success' : 'muted'} />
        </div>
      </section>
    </div>
  )
}
