import { useEffect, useState } from 'react'
import { Mail, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useMiRol } from '../hooks/useMiRol'
import InfoTip from '../components/InfoTip'
import Toast from '../components/Toast'
import { nivelLabel, describirAlcance } from '../components/layout/RoleChooser'
import { avatarTone, initialesDe } from '../lib/avatar'

export default function Perfil() {
  const { t } = useTranslation()
  const { user, updatePassword, updateProfile } = useAuth()
  const { roles } = useMiRol()
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  const [error, setError] = useState(null)
  const [nombres, setNombres] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameNotice, setNameNotice] = useState(null)
  const [nameError, setNameError] = useState(null)

  useEffect(() => {
    if (!nameNotice) return undefined
    const timer = setTimeout(() => setNameNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [nameNotice])

  // Cuando la cuenta esta vinculada a una persona del censo, ese es el
  // UNICO nombre real — no se guarda un nombre distinto en Auth para no
  // terminar con dos nombres diferentes para la misma persona. Solo las
  // cuentas sin persona vinculada (ej. nacional/distrital puros) usan un
  // nombre propio guardado en los metadatos de Auth.
  const personaVinculada = roles[0]?.personas ?? null
  const nombreCuentaSinCenso = user?.user_metadata?.nombres ? `${user.user_metadata.nombres} ${user.user_metadata.apellidos || ''}`.trim() : null
  const displayName = personaVinculada ? `${personaVinculada.nombres} ${personaVinculada.apellidos}` : nombreCuentaSinCenso || t('perfil.usuarioSigap')
  const personaParaAvatar = personaVinculada || { nombres: nombreCuentaSinCenso || user?.email || 'Usuario' }
  const avatarColor = avatarTone(user?.id || user?.email || '')

  useEffect(() => {
    if (nombres || apellidos) return
    if (personaVinculada) {
      setNombres(personaVinculada.nombres || '')
      setApellidos(personaVinculada.apellidos || '')
    } else if (user?.user_metadata?.nombres) {
      setNombres(user.user_metadata.nombres || '')
      setApellidos(user.user_metadata.apellidos || '')
    }
  }, [personaVinculada, user])

  async function saveFullName(event) {
    event.preventDefault()
    if (!nombres.trim() || !apellidos.trim() || savingName) return
    setSavingName(true)
    setNameNotice(null)
    setNameError(null)
    if (personaVinculada) {
      const { data: ok, error: rpcError } = await supabase.rpc('actualizar_mi_nombre', { p_nombres: nombres.trim(), p_apellidos: apellidos.trim() })
      setSavingName(false)
      if (rpcError || !ok) { setNameError(t('perfil.errorNombre')); return }
      setNameNotice(t('perfil.nombreActualizadoRecargando'))
      setTimeout(() => window.location.reload(), 900)
      return
    }
    const { error: updateError } = await updateProfile(nombres.trim(), apellidos.trim())
    setSavingName(false)
    if (updateError) { setNameError(t('perfil.errorNombre')); return }
    setNameNotice(t('perfil.nombreActualizado'))
  }

  async function changePassword(event) {
    event.preventDefault()
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) { setError(t('perfil.requisitosContrasena')); return }
    const { error: updateError } = await updatePassword(password)
    if (updateError) { setError(t('perfil.errorContrasena')); return }
    setPassword('')
    setError(null)
    setNotice(t('perfil.contrasenaActualizada'))
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div><p className="eyebrow">{t('perfil.eyebrow')}</p><h1 className="section-title">{t('perfil.titulo')}</h1><p className="text-sm text-secondary mt-1">{t('perfil.subtitulo')}</p></div>
      <section className="card p-6 flex items-center gap-4"><div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold" style={{ background: avatarColor.bg, color: avatarColor.fg, boxShadow: '0 3px 6px rgba(11, 11, 11, 0.16), 0 1px 2px rgba(11, 11, 11, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.55)' }}>{initialesDe(personaParaAvatar)}</div><div><h2 className="font-medium">{displayName}</h2><p className="text-sm text-secondary flex items-center gap-2 mt-1"><Mail className="w-4 h-4" /> {user?.email}</p></div></section>
      <section className="card p-6">
        <h2 className="font-medium mb-1">{t('perfil.nombre')}</h2>
        <p className="text-xs text-secondary mb-4">{personaVinculada ? t('perfil.nombreAyudaCenso') : t('perfil.nombreAyudaSinCenso')}</p>
        <form onSubmit={saveFullName} className="grid sm:grid-cols-2 gap-3">
          <input required value={nombres} onChange={(event) => setNombres(event.target.value)} placeholder={t('perfil.placeholderNombres')} className="input-field" />
          <input required value={apellidos} onChange={(event) => setApellidos(event.target.value)} placeholder={t('perfil.placeholderApellidos')} className="input-field" />
          <button disabled={savingName} className="btn-primary justify-center sm:col-span-2 sm:w-fit">{savingName ? t('perfil.guardando') : t('perfil.guardarNombre')}</button>
        </form>
        {nameError && <p role="alert" className="text-sm text-danger mt-3">{nameError}</p>}
        <Toast>{nameNotice}</Toast>
      </section>
      <section className="card p-6"><div className="flex items-center gap-3 mb-5"><ShieldCheck className="w-5 h-5 text-success" /><div><h2 className="font-medium">{t('perfil.permisosAsignados')}</h2><p className="text-xs text-secondary mt-1">{t('perfil.rolesActivos')}</p></div></div><div className="flex gap-2 flex-wrap">{roles.length ? roles.map((role) => <span key={role.id} className="text-xs bg-accent-bg text-accent-dark rounded px-3 py-2">{nivelLabel(role.nivel)} · {describirAlcance(role)}</span>) : <p className="text-sm text-muted">{t('perfil.sinRoles')}</p>}</div></section>
      <section className="card p-6"><h2 className="font-medium mb-4 flex items-center gap-1.5">{t('perfil.cambiarContrasena')}<InfoTip texto={t('perfil.requisitosContrasenaTip')} /></h2><form onSubmit={changePassword} className="flex flex-col sm:flex-row gap-3"><input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('perfil.placeholderNuevaContrasena')} className="input-field" /><button className="btn-primary justify-center">{t('perfil.actualizar')}</button></form>{error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}<Toast>{notice}</Toast></section>
    </div>
  )
}
