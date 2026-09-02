import { useEffect, useState } from 'react'
import { Mail, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useMiRol } from '../hooks/useMiRol'

export default function Perfil() {
  const { user, updatePassword, updateProfile } = useAuth()
  const { roles } = useMiRol()
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const [nombres, setNombres] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameNotice, setNameNotice] = useState(null)
  const [nameError, setNameError] = useState(null)

  // Cuando la cuenta esta vinculada a una persona del censo, ese es el
  // UNICO nombre real — no se guarda un nombre distinto en Auth para no
  // terminar con dos nombres diferentes para la misma persona. Solo las
  // cuentas sin persona vinculada (ej. nacional/distrital puros) usan un
  // nombre propio guardado en los metadatos de Auth.
  const personaVinculada = roles[0]?.personas ?? null
  const nombreCuentaSinCenso = user?.user_metadata?.nombres ? `${user.user_metadata.nombres} ${user.user_metadata.apellidos || ''}`.trim() : null
  const displayName = personaVinculada ? `${personaVinculada.nombres} ${personaVinculada.apellidos}` : nombreCuentaSinCenso || 'Usuario SIGAP'

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
      if (rpcError || !ok) { setNameError('No se pudo actualizar tu nombre.'); return }
      setNameNotice('Nombre actualizado. Recargando la página...')
      setTimeout(() => window.location.reload(), 900)
      return
    }
    const { error: updateError } = await updateProfile(nombres.trim(), apellidos.trim())
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
      <section className="card p-6">
        <h2 className="font-medium mb-1">Nombre</h2>
        <p className="text-xs text-secondary mb-4">{personaVinculada ? 'Corrige tu nombre si quedó mal escrito o vacío al registrarte. Es el mismo nombre que aparece en el censo de tu congregación — no se guardan nombres distintos en cada lado.' : 'El nombre con el que te vas a identificar dentro de SIGAP.'}</p>
        <form onSubmit={saveFullName} className="grid sm:grid-cols-2 gap-3">
          <input required value={nombres} onChange={(event) => setNombres(event.target.value)} placeholder="Nombres" className="input-field" />
          <input required value={apellidos} onChange={(event) => setApellidos(event.target.value)} placeholder="Apellidos" className="input-field" />
          <button disabled={savingName} className="btn-primary justify-center sm:col-span-2 sm:w-fit">{savingName ? 'Guardando...' : 'Guardar nombre'}</button>
        </form>
        {nameError && <p role="alert" className="text-sm text-danger mt-3">{nameError}</p>}
        {nameNotice && <p role="status" className="text-sm text-success mt-3">{nameNotice}</p>}
      </section>
      <section className="card p-6"><div className="flex items-center gap-3 mb-5"><ShieldCheck className="w-5 h-5 text-success" /><div><h2 className="font-medium">Permisos asignados</h2><p className="text-xs text-secondary mt-1">Roles activos de esta cuenta.</p></div></div><div className="flex gap-2 flex-wrap">{roles.length ? roles.map((role) => <span key={role.id} className="text-xs bg-accent-bg text-accent-dark rounded px-3 py-2">{role.nivel}{role.congregaciones?.nombre ? ` · ${role.congregaciones.nombre}` : ''}</span>) : <p className="text-sm text-muted">No hay roles activos.</p>}</div></section>
      <section className="card p-6"><h2 className="font-medium mb-4">Cambiar contraseña</h2><form onSubmit={changePassword} className="flex flex-col sm:flex-row gap-3"><input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nueva contraseña segura" className="input-field" /><button className="btn-primary justify-center">Actualizar</button></form>{error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}{notice && <p role="status" className="text-sm text-success mt-3">{notice}</p>}</section>
    </div>
  )
}
