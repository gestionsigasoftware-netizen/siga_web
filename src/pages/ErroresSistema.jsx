import { useEffect, useState } from 'react'
import { Bug, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'
import { formatFecha } from '../lib/dateFormat'
import { usePreferencias } from '../hooks/usePreferencias'
import Toast from '../components/Toast'

export default function ErroresSistema() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const { formato_fecha } = usePreferencias()
  const [errores, setErrores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [soloSinRevisar, setSoloSinRevisar] = useState(true)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => { if (!roleLoading) cargar() }, [roleLoading])

  async function cargar() {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('errores_frontend')
      .select('id, mensaje, stack, contexto, url, user_agent, usuario_id, revisado, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (loadError) setError('No se pudieron cargar los errores registrados.')
    setErrores(data ?? [])
    setLoading(false)
  }

  async function marcarRevisado(id, revisado) {
    const { error: updateError } = await supabase.from('errores_frontend').update({ revisado }).eq('id', id)
    if (updateError) { setError('No se pudo actualizar el error.'); return }
    setErrores((current) => current.map((item) => (item.id === id ? { ...item, revisado } : item)))
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este registro de error? No se puede deshacer.')) return
    const { error: deleteError } = await supabase.from('errores_frontend').delete().eq('id', id)
    if (deleteError) { setError('No se pudo eliminar el registro.'); return }
    setErrores((current) => current.filter((item) => item.id !== id))
    setNotice('Registro eliminado.')
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando errores del sistema...</div>
  if (rolPrincipal?.nivel !== 'super_admin') return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Esta vista es exclusiva de super_admin — la salud técnica de SIGAP no depende del rol pastoral nacional.</p>

  const visibles = errores.filter((item) => !soloSinRevisar || !item.revisado)
  const sinRevisarCount = errores.filter((item) => !item.revisado).length

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">Salud técnica · super_admin</p>
        <h1 className="section-title">Errores del sistema</h1>
        <p className="text-sm text-secondary mt-0.5">Errores reales de JavaScript capturados en el navegador de cualquier usuario (roto en pantalla, promesa sin manejar, etc.), sin que nadie tenga que reportarlo. No detecta si el sitio está totalmente caído.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      <Toast>{notice}</Toast>

      <section className="grid sm:grid-cols-2 gap-3">
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Total (últimos 200)</p><p className="text-2xl font-semibold mt-3">{errores.length}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Sin revisar</p><p className={`text-2xl font-semibold mt-3 ${sinRevisarCount ? 'text-danger' : ''}`}>{sinRevisarCount}</p></div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <Bug className="w-4 h-4 text-muted" />
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={soloSinRevisar} onChange={(event) => setSoloSinRevisar(event.target.checked)} />
            Mostrar solo sin revisar
          </label>
        </div>
        {!visibles.length ? (
          <p className="text-sm text-secondary p-5">{soloSinRevisar ? 'No hay errores sin revisar.' : 'No se ha registrado ningún error todavía.'}</p>
        ) : (
          <div className="divide-y divide-border">
            {visibles.map((item) => (
              <div key={item.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words">{item.mensaje}</p>
                    <p className="text-xs text-secondary mt-1">{formatFecha(item.created_at, { formato: formato_fecha, conHora: true })} · {item.contexto}{item.url ? ` · ${item.url}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" className="btn-secondary text-xs" onClick={() => marcarRevisado(item.id, !item.revisado)}>
                      {item.revisado ? 'Marcar sin revisar' : 'Marcar revisado'}
                    </button>
                    <button type="button" aria-label="Eliminar" className="btn-secondary text-xs" onClick={() => eliminar(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {item.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted cursor-pointer">Ver stack</summary>
                    <pre className="text-xs text-secondary mt-1 whitespace-pre-wrap break-words bg-surface-1 rounded p-3">{item.stack}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
