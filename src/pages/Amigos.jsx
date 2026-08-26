import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

const TONO_ETAPA = {
  0: 'bg-surface-1 text-secondary',
  1: 'bg-warning-bg text-warning',
  2: 'bg-accent-bg text-accent-dark',
  3: 'bg-warning-bg text-warning',
  4: 'bg-success-bg text-success',
}

export default function Amigos() {
  const { rolPrincipal } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id

  const [etapas, setEtapas] = useState([])
  const [amigos, setAmigos] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!congregacionId) return
    async function load() {
      const { data: etapasData } = await supabase.from('etapas_seguimiento').select('id, nombre, orden').eq('congregacion_id', congregacionId).order('orden')
      setEtapas(etapasData ?? [])
      const { data: amigosData } = await supabase
        .from('amigos')
        .select('id, nombres, sector, etapa_id, etapas_seguimiento(nombre, orden)')
        .eq('congregacion_id', congregacionId)
      setAmigos(amigosData ?? [])
      setLoading(false)
    }
    load()
  }, [congregacionId])

  const filtrados = filtro === 'todos' ? amigos : amigos.filter((a) => a.etapa_id === filtro)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-medium">Amigos en ruta de seguimiento</h1>
        <p className="text-sm text-secondary mt-0.5">Visible solo para el líder de cada zona, el pastor y el admin local.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFiltro('todos')} className={`text-xs px-3 py-1.5 rounded border ${filtro === 'todos' ? 'bg-surface-1 border-border' : 'border-border bg-transparent'}`}>Todos</button>
        {etapas.map((e) => (
          <button key={e.id} onClick={() => setFiltro(e.id)} className={`text-xs px-3 py-1.5 rounded border ${filtro === e.id ? 'bg-surface-1 border-border' : 'border-border bg-transparent'}`}>
            {e.nombre}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted">Cargando...</p>}
      {!loading && filtrados.length === 0 && (
        <p className="text-sm text-muted">
          Sin registros en esta etapa. Los datos de esta pantalla se filtran automáticamente por RLS —
          solo ves los amigos de las zonas donde tienes asignación activa (o toda la congregación si eres admin local).
        </p>
      )}
      <div className="flex flex-col gap-2">
        {filtrados.map((a) => (
          <div key={a.id} className="flex justify-between items-center border border-border rounded p-3">
            <div>
              <p className="font-medium text-sm">{a.nombres}</p>
              <p className="text-xs text-secondary">{a.sector}</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded ${TONO_ETAPA[a.etapas_seguimiento?.orden % 5] ?? TONO_ETAPA[0]}`}>
              {a.etapas_seguimiento?.nombre ?? 'Sin etapa'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
