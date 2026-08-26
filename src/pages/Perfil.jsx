import { useState } from 'react'
import { Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useMiRol } from '../hooks/useMiRol'

export default function Perfil() {
  const { user, updatePassword } = useAuth()
  const { roles } = useMiRol()
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)

  async function changePassword(event) {
    event.preventDefault()
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) { setError('Usa al menos 8 caracteres, una mayúscula, un número y un símbolo.'); return }
    const { error: updateError } = await updatePassword(password)
    if (updateError) { setError('No se pudo actualizar la contraseña.'); return }
    setPassword(''); setError(null); setNotice('Contraseña actualizada correctamente.')
  }

  return <div className="flex flex-col gap-6 max-w-3xl"><div><p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Cuenta</p><h1 className="text-2xl font-semibold">Mi perfil</h1><p className="text-sm text-secondary mt-1">Administra tu acceso y consulta tus permisos dentro de SIGA.</p></div><section className="card p-6 flex items-center gap-4"><div className="w-14 h-14 rounded-full bg-ink text-white flex items-center justify-center text-xl font-semibold">{(user?.email?.[0] || 'U').toUpperCase()}</div><div><h2 className="font-medium">{user?.user_metadata?.full_name || 'Usuario SIGA'}</h2><p className="text-sm text-secondary flex items-center gap-2 mt-1"><Mail className="w-4 h-4" /> {user?.email}</p></div></section><section className="card p-6"><div className="flex items-center gap-3 mb-5"><ShieldCheck className="w-5 h-5 text-success" /><div><h2 className="font-medium">Permisos asignados</h2><p className="text-xs text-secondary mt-1">Roles activos de esta cuenta.</p></div></div><div className="flex gap-2 flex-wrap">{roles.length ? roles.map((role) => <span key={role.id} className="text-xs bg-accent-bg text-accent-dark rounded px-3 py-2">{role.nivel}{role.congregaciones?.nombre ? ` · ${role.congregaciones.nombre}` : ''}</span>) : <p className="text-sm text-muted">No hay roles activos.</p>}</div></section><section className="card p-6"><h2 className="font-medium mb-1">Cambiar contraseña</h2><p className="text-sm text-secondary mb-4">Protege tu cuenta con una contraseña fuerte.</p><form onSubmit={changePassword} className="flex flex-col sm:flex-row gap-3"><input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nueva contraseña segura" className="input-field" /><button className="btn-primary justify-center">Actualizar</button></form>{error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}{notice && <p role="status" className="text-sm text-success mt-3">{notice}</p>}</section><div className="flex items-center gap-2 text-xs text-muted"><UserRound className="w-4 h-4" /> Tu cuenta está vinculada a la organización que administra SIGA.</div></div>
}
