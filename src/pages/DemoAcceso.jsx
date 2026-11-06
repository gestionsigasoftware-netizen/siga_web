import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import sigapLogoWhite from '../assets/sigap-logo-white.svg'

// Acceso de un clic a la congregacion demo: usa una cuenta real de
// Supabase Auth, compartida por todos los visitantes (credenciales en
// variables de entorno, nunca en el codigo), para que ProtectedRoute
// y MainLayout funcionen exactamente igual que con cualquier cuenta
// real -- sin inventar un mecanismo de sesion aparte. La congregacion
// detras de esta cuenta esta marcada congregaciones.es_demo = true y
// se reinicia sola cada noche (ver
// supabase/schema/demo_publico_paso1_congregacion.sql y el paso 3,
// el reinicio nocturno).
export default function DemoAcceso() {
  const { t } = useTranslation()
  const { signIn, user, loading: authLoading } = useAuth()
  const [error, setError] = useState(null)
  const demoEmail = import.meta.env.VITE_DEMO_EMAIL
  const demoPassword = import.meta.env.VITE_DEMO_PASSWORD

  useEffect(() => {
    if (authLoading || user) return
    if (!demoEmail || !demoPassword) {
      setError(t('demo.errorNoConfigurado'))
      return
    }
    signIn(demoEmail, demoPassword).then(({ error: signInError }) => {
      if (signInError) setError(t('demo.errorEntrar'))
    })
  }, [authLoading, user, demoEmail, demoPassword, signIn, t])

  if (!authLoading && user) return <Navigate to="/app" replace />

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-night text-white p-6 text-center">
      <img src={sigapLogoWhite} alt="SIGAP" className="h-7 w-auto mb-10" />
      {error ? (
        <div className="max-w-sm">
          <p className="text-base font-medium">{error}</p>
          <Link to="/" className="inline-block mt-6 text-sm text-white/70 hover:text-white hover:underline">{t('login.volverPaginaPrincipal')}</Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 max-w-sm">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
          <p className="text-sm text-white/70">{t('demo.entrando')}</p>
          <p className="flex items-center gap-2 text-xs text-white/45 mt-2">
            <ShieldCheck className="w-4 h-4" /> {t('demo.avisoDatosEjemplo')}
          </p>
        </div>
      )}
    </div>
  )
}
