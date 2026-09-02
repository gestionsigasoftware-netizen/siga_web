import { useEffect, useState } from 'react'
import { Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useMiRol } from '../hooks/useMiRol'

export default function Perfil() {
  const { user, updatePassword, updateProfile } = useAuth()
  const { roles } = useMiRol()
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const [fullName, setFullName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameNotice, setNameNotice] = useState(null)
  const [nameError, setNameError] = useState(null)

  // El nombre puede venir de los metadatos de Auth (lo normal si se editó
  // aquí, o si la invitación ya lo trajo) o, si aún no hay metadato, del
  // nombre real en el censo (personas) al que esta cuenta está vinculada —
  // evita mostrar "Usuario SIGAP" cuando el dato real ya existe en otro lado.
  const nombrePersonaVinculada = roles[0]?.personas ? `${roles[0].personas.nombres} ${roles[0].personas.apellidos}` : null
  const displayName = user?.user_metadata?.full_name || nombrePersonaVinculada || 'Usuario SIGAP'

  useEffect(() => {
    if (!fullName && (user?.user_metadata?.full_name || nombrePersonaVinculada)) {
      setFullName(user?.user_metadata?.full_name || nombrePersonaVinculada || '')
    }
  }, [user, nombrePersonaVinculada])

  async function saveFullName(event) {
    event.preventDefault()
    if (!fullName.trim() || savingName) return
    setSavingName(true)
    setNameNotice(null)
    setNameError(null)
    const { error: updateError } = await updateProfile(fullName.trim())
    setSavingName(false)
    if (updateError) { setNameError('No se pudo actualizar tu nombre.'); return }
    setNameNotice('Nombre actualizado.')
  }

  async function changePassword(event) {
    event.preventDefault()
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) { setError('Usa al menos 8 caracteres, una mayúscula, un número y un símbolo.'); return }
    const { error: updateError } = await updatePassword(password)
    if (updateError) { setError('No se pudo actualizar la contraseña.'); return }
    setPassword('')
    setError(null)
    setNotice('Contraseña actualizada correctamente.')
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div><p className="eyebrow">Cuenta</p><h1 className="section-title">Mi perfil</h1><p className="text-sm text-secondary mt-1">Administra tu acceso y consulta tus permisos dentro de SIGAP.</p></div>
      <section className="card p-6 flex items-center gap-4"><div className="w-14 h-14 rounded-full bg-ink text-white flex items-center justify-center text-xl font-semibold">{(user?.email?.[0] || 'U').toUpperCase()}</div><div><h2 className="font-medium">{displayName}</h2><p className="text-sm text-secondary flex items-center gap-2 mt-1"><Mail className="w-4 h-4" /> {user?.email}</p></div></section>
      <section className="card p-6"><h2 className="font-medium mb-1">Nombre de la cuenta</h2><p className="text-xs text-secondary mb-4">Así te van a ver los demás usuarios de tu congregación (por ejemplo, en las notificaciones de acceso).</p><form onSubmit={saveFullName} className="flex flex-col sm:flex-row gap-3"><input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Tu nombre completo" className="input-field" /><button disabled={savingName} className="btn-primary justify-center">{savingName ? 'Guardando...' : 'Guardar nombre'}</button></form>{nameError && <p role="alert" className="text-sm text-danger mt-3">{nameError}</p>}{nameNotice && <p role="status" className="text-sm text-success mt-3">{nameNotice}</p>}</section>
      <section className="card p-6"><div className="flex items-center gap-3 mb-5"><ShieldCheck className="w-5 h-5 text-success" /><div><h2 className="font-medium">Permisos asignados</h2><p className="text-xs text-secondary mt-1">Roles activos de esta cuenta.</p></div></div><div className="flex gap-2 flex-wrap">{roles.length ? roles.map((role) => <span key={role.id} className="text-xs bg-accent-bg text-accent-dark rounded px-3 py-2">{role.nivel}{role.congregaciones?.nombre ? ` · ${role.congregaciones.nombre}` : ''}</span>) : <p className="text-sm text-muted">No hay roles activos.</p>}</div></section>
      <section className="card p-6"><h2 className="font-medium mb-4">Cambiar contraseña</h2><form onSubmit={changePassword} className="flex flex-col sm:flex-row gap-3"><input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nueva contraseña segura" className="input-field" /><button className="btn-primary justify-center">Actualizar</button></form>{error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}{notice && <p role="status" className="text-sm text-success mt-3">{notice}</p>}</section>
    </div>
  )
}
