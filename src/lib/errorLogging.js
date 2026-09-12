import { supabase } from './supabase'

const MAX_LEN = 4000

function truncar(texto) {
  if (!texto) return null
  return String(texto).slice(0, MAX_LEN)
}

// Best-effort: un error registrando el error nunca debe volver a
// romper la app ni molestar al usuario -- se traga cualquier fallo.
export async function logClientError(error, contexto = 'desconocido') {
  try {
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('errores_frontend').insert({
      mensaje: truncar(error?.message || String(error) || 'Error sin mensaje'),
      stack: truncar(error?.stack),
      contexto,
      url: window.location?.href || null,
      user_agent: navigator?.userAgent || null,
      usuario_id: userData?.user?.id || null,
    })
  } catch {
    // Sin conexion, RLS, o cualquier otra falla: no hay nada mas que hacer aqui.
  }
}

export function instalarCapturaGlobalDeErrores() {
  window.addEventListener('error', (event) => {
    logClientError(event.error || event.message, 'window.onerror')
  })
  window.addEventListener('unhandledrejection', (event) => {
    logClientError(event.reason, 'unhandledrejection')
  })
}
