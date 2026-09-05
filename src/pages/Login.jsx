import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, BarChart3, Check, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import sigapLogo from '../assets/sigap-logo.svg'
import sigapLogoWhite from '../assets/sigap-logo-white.svg'

export default function Login() {
  const { signIn, resetPassword, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  const [newPassword, setNewPassword] = useState('')
  const [isInvitation] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('type') === 'invite' || new URLSearchParams(window.location.search).get('type') === 'invite')
  const [isRecovery, setIsRecovery] = useState(() => new URLSearchParams(window.location.search).has('reset') || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'invite')
  const passwordRules = [
    { label: '8 caracteres como mínimo', valid: newPassword.length >= 8 },
    { label: 'Una letra mayúscula', valid: /[A-Z]/.test(newPassword) },
    { label: 'Un número', valid: /\d/.test(newPassword) },
    { label: 'Un símbolo', valid: /[^A-Za-z0-9]/.test(newPassword) },
  ]
  const validNewPassword = passwordRules.every((rule) => rule.valid)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) { setError('Usuario o contraseña incorrectos.'); return }
    navigate('/app')
  }

  async function handlePasswordRecovery() {
    if (!email) {
      setError('Escribe tu correo electrónico para recuperar la contraseña.')
      return
    }
    setError(null)
    setNotice(null)
    const { error: recoveryError } = await resetPassword(email)
    if (recoveryError) {
      setError('No se pudo enviar el correo de recuperación. Verifica la dirección.')
      return
    }
    setNotice('Te enviamos un enlace para crear una contraseña nueva.')
  }

  async function handleUpdatePassword(event) {
    event.preventDefault()
    if (!validNewPassword) {
      setError('Completa todos los requisitos de seguridad de la contraseña.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: updateError } = await updatePassword(newPassword)
    setLoading(false)
    if (updateError) { setError('No se pudo actualizar la contraseña. Solicita un enlace nuevo.'); return }
    setNewPassword('')
    if (isInvitation) {
      navigate('/app')
      return
    }
    setIsRecovery(false)
    setNotice('Contraseña actualizada. Ya puedes ingresar con tu nueva contraseña.')
  }

  return (
    <div className="login-ambient min-h-screen text-ink p-4 md:p-6">
      <style>{`
        /* Fondo fuera de la tarjeta de login: el mismo beige de marca,
           pero con un leve tinte calido (lado dorado, familia warning)
           y uno frio (lado azul, familia accent) que migran despacio de
           un lado a otro -- decorativo, nunca toca la tarjeta en si. */
        .login-ambient {
          background: linear-gradient(115deg, #f7ecd9 0%, #f3f0e9 35%, #f3f0e9 65%, #eaf0f7 100%);
          background-size: 220% 220%;
          animation: login-ambient-shift 26s ease-in-out infinite;
        }
        @keyframes login-ambient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-ambient { animation: none; background-position: 50% 50%; }
        }
      `}</style>
      <div className="min-h-0 lg:min-h-[calc(100vh-3rem)] max-w-xl lg:max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] overflow-hidden rounded-card bg-surface-2 shadow-[0_24px_80px_rgba(21,27,34,0.12)]">
        <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink text-white p-12">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_80%_15%,#2a78d6_0,transparent_32%),linear-gradient(145deg,transparent_45%,#173404_150%)]" />
          <div className="relative">
            <Link to="/" className="inline-flex items-center" aria-label="Volver a la página principal de SIGAP">
              <img src={sigapLogoWhite} alt="SIGAP" className="h-7 w-auto" />
            </Link>
            <div className="mt-28 max-w-md">
              <p className="text-sm uppercase tracking-[0.18em] text-white/60">Gestión pastoral inteligente</p>
              <h2 className="mt-4 text-5xl font-semibold leading-[1.05]">Decisiones pastorales con información clara.</h2>
            </div>
          </div>
          <div className="relative flex items-end justify-between gap-8">
            <div className="flex flex-col gap-3 text-sm text-white/70">
              {['Ciclo de vida espiritual', 'Comités y territorio conectados', 'Local, distrital y nacional'].map((item) => (
                <span key={item} className="flex items-center gap-2"><Check className="w-4 h-4 text-[#8fca68]" />{item}</span>
              ))}
            </div>
            <BarChart3 className="w-20 h-20 text-white/15" strokeWidth={1} />
          </div>
        </section>

        <section className="flex items-center justify-center p-7 sm:p-12">
          <div className="w-full max-w-sm">
            <Link to="/" className="inline-flex items-center mb-14 lg:hidden" aria-label="Volver a la página principal de SIGAP">
              <img src={sigapLogo} alt="SIGAP" className="h-6 w-auto" />
            </Link>
            <div className="mb-8">
              <p className="text-sm font-medium text-accent mb-3">{isRecovery ? (isInvitation ? 'Invitación a SIGAP' : 'Nueva contraseña') : 'Bienvenido de nuevo'}</p>
              <h1 className="text-3xl font-semibold tracking-tight">{isRecovery ? (isInvitation ? 'Crea tu contraseña' : 'Actualiza tu acceso') : 'Entra a tu espacio SIGAP'}</h1>
              <p className="text-sm text-secondary mt-3 leading-6">{isRecovery ? (isInvitation ? 'Define una contraseña segura para activar tu acceso a SIGAP.' : 'Crea una nueva contraseña para volver a entrar a tu espacio de trabajo.') : 'Administra la información de tu congregación con una mirada clara y oportuna.'}</p>
            </div>

            {isRecovery ? <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
              <div><label htmlFor="new-password" className="text-sm font-medium block mb-1.5">Nueva contraseña</label><input id="new-password" type="password" required minLength={8} autoComplete="new-password" placeholder="Crea una contraseña segura" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError(null) }} className="input-field" /></div>
              <div aria-live="polite" className="rounded bg-surface-1 p-3"><p className="text-xs font-medium text-secondary mb-2">Requisitos de seguridad</p><div className="grid gap-1.5">{passwordRules.map((rule) => <p key={rule.label} className={`text-xs ${rule.valid ? 'text-success' : 'text-muted'}`}>{rule.valid ? '✓' : '○'} {rule.label}</p>)}</div></div>
              {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
              {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}
              <button type="submit" disabled={loading || !validNewPassword} className="btn-primary justify-center mt-2 py-3">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isInvitation ? 'Activar acceso' : 'Actualizar contraseña'}</button>
              <Link to="/login" className="text-sm text-center text-secondary hover:text-ink hover:underline mt-1">Volver al inicio de sesión</Link>
            </form> : <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="text-sm font-medium block mb-1.5">Correo electrónico</label>
                <input id="email" type="email" required autoComplete="email" placeholder="nombre@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
                  <button type="button" onClick={handlePasswordRecovery} className="text-xs text-accent hover:underline">¿Olvidaste tu contraseña?</button>
                </div>
                <div className="relative">
                  <input id="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Ingresa tu contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field pr-11" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-ink transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
              {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}
              <button type="submit" disabled={loading} className="btn-primary justify-center mt-2 py-3">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Ingresar a SIGAP <ArrowUpRight className="w-4 h-4" /></>}
              </button>
              <Link to="/" className="text-sm text-center text-secondary hover:text-ink hover:underline mt-1">Volver a la página principal</Link>
            </form>}

            <div className="flex items-center gap-2 mt-8 text-xs text-muted">
              <ShieldCheck className="w-4 h-4 text-success" /> Tu información se mantiene protegida.
            </div>
            <p className="text-xs text-muted mt-12">SIGAP · Gestión pastoral</p>
          </div>
        </section>
      </div>
    </div>
  )
}
