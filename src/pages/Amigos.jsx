import { useState, useEffect } from 'react'
import { MapPinned, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

const TONO_ETAPA = {
  0: 'bg-surface-1 text-secondary',
  1: 'bg-warning-bg text-warning',
  2: 'bg-accent-bg text-accent',
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
    <div className="page-shell">
      <header>
        <p className="eyebrow">Seguimiento</p>
        <h1 className="section-title">Amigos en ruta</h1>
        <p className="text-sm text-secondary mt-1">Visible solo para el líder de cada zona, el pastor y el admin local.</p>
      </header>

      <section className="grid sm:grid-cols-3 gap-3">
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Total</p>
          <p className="mt-3 text-2xl font-semibold">{amigos.length}</p>
        </div>
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Etapas</p>
          <p className="mt-3 text-2xl font-semibold">{etapas.length}</p>
        </div>
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">En filtro</p>
          <p className="mt-3 text-2xl font-semibold">{filtrados.length}</p>
        </div>
      </section>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFiltro('todos')} className={`text-xs px-3 py-1.5 rounded-full border ${filtro === 'todos' ? 'bg-accent-bg text-accent border-accent/20' : 'border-border bg-transparent text-secondary'}`}>
          Todos
        </button>
        {etapas.map((e) => (
          <button key={e.id} onClick={() => setFiltro(e.id)} className={`text-xs px-3 py-1.5 rounded-full border ${filtro === e.id ? 'bg-accent-bg text-accent border-accent/20' : 'border-border bg-transparent text-secondary'}`}>
            {e.nombre}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted bg-surface-1 rounded p-3">Cargando...</p>}

      {!loading && filtrados.length === 0 && (
        <div className="card p-6 text-sm text-secondary">
          <div className="flex items-center gap-2 mb-2">
            <MapPinned className="w-4 h-4 text-accent" />
            <span>Sin registros en esta etapa.</span>
          </div>
          <p>Los datos de esta pantalla se filtran automáticamente por RLS y solo muestran los amigos de las zonas donde tienes asignación activa.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtrados.map((a) => (
          <div key={a.id} className="card p-4 flex justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-1 border border-border flex items-center justify-center">
                <Users className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="font-medium text-sm">{a.nombres}</p>
                <p className="text-xs text-secondary">{a.sector || 'Sin sector Asignado'}</p>
              </div>
            </div>
            <span className={`text-[10px] uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-full ${TONO_ETAPA[a.etapas_seguimiento?.orden % 5] ?? TONO_ETAPA[0]}`}>
              {a.etapas_seguimiento?.nombre ?? 'Sin etapa'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
