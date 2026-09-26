import { Bell, Database, Globe2, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { roles } = useMiRol()
  const [preferences, setPreferences] = useState(EMPTY_PREFERENCES)
  const [ultimoAccesoAnterior, setUltimoAccesoAnterior] = useState(null)
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
    if (mfaListError) setError(t('configuracionSistema.errorMfaConsultar', { mensaje: mfaListError.message }))
    setMfaFactors((data?.totp ?? []).filter((factor) => factor.status === 'verified'))
    setMfaLoading(false)
  }

  async function startMfaEnroll() {
    setError(null)
    setNotice(null)
    const { data, error: enrollError } = await enrollTotp()
    if (enrollError) { setError(t('configuracionSistema.errorMfaIniciar', { mensaje: enrollError.message })); return }
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
    if (verifyCode.trim().length < 6) { setError(t('configuracionSistema.errorCodigoCorto')); return }
    setMfaSaving(true)
    setError(null)
    const { error: verifyError } = await confirmEnrollment(enrollData.factorId, verifyCode.trim())
    setMfaSaving(false)
    if (verifyError) { setError(t('configuracionSistema.errorCodigoIncorrecto')); return }
    setEnrollData(null)
    setVerifyCode('')
    setNotice(t('configuracionSistema.mfaActivada'))
    await loadMfaFactors()
  }

  async function disableMfa(factorId) {
    if (!window.confirm(t('configuracionSistema.confirmarDesactivarMfa'))) return
    setMfaSaving(true)
    setError(null)
    const { error: disableError } = await unenrollFactor(factorId)
    setMfaSaving(false)
    if (disableError) { setError(t('configuracionSistema.errorMfaDesactivar', { mensaje: disableError.message })); return }
    setNotice(t('configuracionSistema.mfaDesactivada'))
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
      setUltimoAccesoAnterior(cached.ultimoAccesoAnterior)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    const { data, error: loadError } = await supabase.from('preferencias_usuario').select('recibir_notificaciones, recibir_alertas, formato_fecha, acceso_anterior').eq('usuario_id', user.id).maybeSingle()
    if (loadError) setError(t('configuracionSistema.errorCargarPreferencias', { mensaje: loadError.message }))
    if (data) {
      const { acceso_anterior, ...restoPreferences } = data
      setPreferences(restoPreferences)
      setUltimoAccesoAnterior(acceso_anterior)
      configuracionSistemaCache.set(cacheKey, { preferences: restoPreferences, ultimoAccesoAnterior: acceso_anterior })
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
    if (saveError) setError(t('configuracionSistema.errorGuardarPreferencias', { mensaje: saveError.message }))
    else {
      window.dispatchEvent(new CustomEvent('siga:preferencias-actualizadas', { detail: preferences }))
      setNotice(t('configuracionSistema.preferenciasGuardadas'))
    }
  }

  if (loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('configuracionSistema.cargandoPreferencias')}</div>

  const nombrePersonaVinculada = roles[0]?.personas ? `${roles[0].personas.nombres} ${roles[0].personas.apellidos}` : null
  const ultimoAcceso = ultimoAccesoAnterior ? formatFecha(ultimoAccesoAnterior, { formato: preferences.formato_fecha, conHora: true }) : t('configuracionSistema.primerAcceso')
  const correoVerificado = Boolean(user?.email_confirmed_at)
  const cuentaCreada = user?.created_at ? formatFecha(user.created_at, { formato: preferences.formato_fecha }) : t('configuracionSistema.sinRegistro')
  const idiomaActual = { es: t('configuracionSistema.idiomaEs'), en: t('configuracionSistema.idiomaEn'), pt: t('configuracionSistema.idiomaPt') }[i18n.language] || t('configuracionSistema.idiomaEs')

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <p className="eyebrow">{t('configuracionSistema.eyebrow')}</p>
        <h1 className="section-title">{t('configuracionSistema.titulo')}</h1>
        <p className="text-sm text-secondary mt-1">{t('configuracionSistema.subtitulo')}</p>
      </div>
      {error && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={loadPreferences} className="btn-secondary text-xs self-start sm:self-auto">{t('configuracionSistema.reintentar')}</button></div>}
      <form onSubmit={savePreferences} className="card p-5 max-w-2xl">
        <h2 className="font-medium">{t('configuracionSistema.preferenciasCuenta')}</h2>
        <p className="text-sm text-secondary mt-1 mb-5">{t('configuracionSistema.preferenciasCuentaSubtitulo')}</p>
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-accent">{t('configuracionSistema.avisosRecibir')}</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferences.recibir_notificaciones} onChange={(event) => updatePreference({ recibir_notificaciones: event.target.checked })} /> {t('configuracionSistema.recibirNotificaciones')}<InfoTip texto={t('configuracionSistema.recibirNotificacionesTip')} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferences.recibir_alertas} onChange={(event) => updatePreference({ recibir_alertas: event.target.checked })} /> {t('configuracionSistema.recibirAlertas')}<InfoTip texto={t('configuracionSistema.recibirAlertasTip')} /></label>
          <label className="text-sm pt-2">{t('configuracionSistema.formatoFecha')}<select className="input-field mt-1.5" value={preferences.formato_fecha} onChange={(event) => updatePreference({ formato_fecha: event.target.value })}><option value="DD/MM/AAAA">{t('configuracionSistema.formatoDMA')}</option><option value="MM/DD/AAAA">{t('configuracionSistema.formatoMDA')}</option></select></label>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-5">
          <button disabled={saving} className="btn-primary">{saving ? t('configuracionSistema.guardando') : t('configuracionSistema.guardarPreferencias')}</button>
          <Toast>{notice}</Toast>
        </div>
      </form>
      <section className="card p-5 max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0"><ShieldCheck className="w-4 h-4" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">{t('configuracionSistema.verificacionDosPasos')}</h2>
            <p className="text-sm text-secondary mt-1">{t('configuracionSistema.verificacionDosPasosDesc')}</p>

            {mfaLoading ? (
              <p className="text-sm text-muted mt-4">{t('configuracionSistema.consultandoEstado')}</p>
            ) : enrollData ? (
              <form onSubmit={confirmMfaEnroll} className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <img src={enrollData.qrCode} alt={t('configuracionSistema.qrAlt')} className="w-36 h-36 rounded border border-border flex-shrink-0" />
                  <div className="text-sm text-secondary">
                    <p>{t('configuracionSistema.pasoEscanear')}</p>
                    <p className="mt-1">{t('configuracionSistema.pasoManual')}</p>
                    <p className="mt-1 font-mono text-xs bg-surface-1 rounded px-2 py-1.5 break-all">{enrollData.secret}</p>
                  </div>
                </div>
                <label className="text-sm max-w-xs">{t('configuracionSistema.codigo6Digitos')}
                  <div className="relative mt-1.5">
                    <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus autoComplete="one-time-code" placeholder="123456" value={verifyCode} onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, ''))} className="input-field pl-10 tracking-[0.3em] text-center" />
                  </div>
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={mfaSaving || verifyCode.length < 6} className="btn-primary">{mfaSaving ? t('configuracionSistema.confirmando') : t('configuracionSistema.confirmarActivar')}</button>
                  <button type="button" onClick={cancelMfaEnroll} className="btn-secondary">{t('configuracionSistema.cancelar')}</button>
                </div>
              </form>
            ) : mfaFactors.length > 0 ? (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="inline-block text-xs rounded px-2 py-1 text-success bg-success-bg w-fit">{t('configuracionSistema.activada')}</span>
                <button type="button" disabled={mfaSaving} onClick={() => disableMfa(mfaFactors[0].id)} className="btn-secondary text-sm">{t('configuracionSistema.desactivar')}</button>
              </div>
            ) : (
              <div className="mt-4">
                <span className="inline-block text-xs rounded px-2 py-1 text-secondary bg-surface-1 w-fit mb-3">{t('configuracionSistema.noActivada')}</span>
                <div><button type="button" onClick={startMfaEnroll} className="btn-primary">{t('configuracionSistema.activarVerificacion')}</button></div>
              </div>
            )}
          </div>
        </div>
      </section>
      <section>
        <div className="mb-4"><p className="eyebrow">{t('configuracionSistema.informacionServicio')}</p><h2 className="font-medium mt-1">{t('configuracionSistema.estadoSistema')}</h2><p className="text-sm text-secondary mt-1">{t('configuracionSistema.estadoSistemaSubtitulo')}</p></div>
        <div className="grid md:grid-cols-2 gap-4">
          <StatusCard icon={Globe2} title={t('configuracionSistema.idiomaRegion')} description={t('configuracionSistema.idiomaRegionDesc', { idioma: idiomaActual })} value={preferences.formato_fecha === 'MM/DD/AAAA' ? `${idiomaActual} · MM/DD` : `${idiomaActual} · DD/MM`} />
          <StatusCard icon={Bell} title={t('configuracionSistema.notificaciones')} description={t('configuracionSistema.notificacionesDesc')} value={preferences.recibir_notificaciones || preferences.recibir_alertas ? t('configuracionSistema.preferenciasActivas') : t('configuracionSistema.todasDesactivadas')} tone={preferences.recibir_notificaciones || preferences.recibir_alertas ? 'success' : 'muted'} />
          <StatusCard icon={LockKeyhole} title={t('configuracionSistema.seguridad')} description={t('configuracionSistema.seguridadDesc', { estado: correoVerificado ? t('configuracionSistema.correoVerificado') : t('configuracionSistema.correoSinVerificar'), fecha: cuentaCreada })} value={t('configuracionSistema.ultimoAcceso', { fecha: ultimoAcceso })} tone={correoVerificado ? 'success' : 'muted'} />
          <StatusCard icon={Database} title={<span className="flex items-center gap-1">{t('configuracionSistema.vinculacionCenso')}<InfoTip texto={t('configuracionSistema.vinculacionCensoTip')} /></span>} description={nombrePersonaVinculada ? t('configuracionSistema.vinculadaDesc') : t('configuracionSistema.noVinculadaDesc')} value={nombrePersonaVinculada || t('configuracionSistema.sinVincular')} tone={nombrePersonaVinculada ? 'success' : 'muted'} />
        </div>
      </section>
    </div>
  )
}
