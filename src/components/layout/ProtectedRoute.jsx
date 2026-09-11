import { useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  // Si ya hubo un usuario autenticado en esta sesión del navegador y de
  // pronto desaparece (token/refresh expirado, no un cierre manual), no
  // es lo mismo que entrar sin sesión por primera vez -- avisamos por
  // qué se volvió a pedir el login en vez de mandar a la persona a
  // /login en silencio, que se siente como si la app la hubiera echado.
  const hadUser = useRef(false)
  if (user) hadUser.current = true
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
  }
  if (!user) {
    return <Navigate to="/login" replace state={hadUser.current ? { reason: 'session_expired' } : undefined} />
  }
  return children
}
