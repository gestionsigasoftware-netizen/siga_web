import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const ESTADO_TONO = {
  pendiente_aprobacion: 'bg-warning-bg text-warning',
  activa: 'bg-success-bg text-success',
  suspendida: 'bg-danger-bg text-danger',
}

export default function Aprobaciones() {
  const [congregaciones, setCongregaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('congregaciones')
      .select('id, nombre, pastor_nombre, estado, distritos(nombre), created_at')
      .order('created_at', { ascending: false })
    setCongregaciones(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function actualizarEstado(id, estado) {
    setBusy(id)
    await supabase.from('congregaciones').update({ estado, aprobada_en: new Date().toISOString() }).eq('id', id)
    setBusy(null)
    load()
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-medium">Aprobación de congregaciones</h1>
        <p className="text-sm text-secondary mt-0.5">Una congregación registrada no puede usar el sistema hasta ser aprobada aquí.</p>
      </div>

      {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}

      <div className="card overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-muted text-left bg-surface-1">
              <th className="font-normal py-2.5 px-4">Congregación</th>
              <th className="font-normal py-2.5 px-4">Pastor</th>
              <th className="font-normal py-2.5 px-4">Distrito</th>
              <th className="font-normal py-2.5 px-4">Estado</th>
              <th className="font-normal py-2.5 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {congregaciones.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-2.5 px-4 font-medium">{c.nombre}</td>
                <td className="py-2.5 px-4 text-secondary">{c.pastor_nombre}</td>
                <td className="py-2.5 px-4 text-secondary">{c.distritos?.nombre}</td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs px-2 py-1 rounded ${ESTADO_TONO[c.estado]}`}>{c.estado.replace('_', ' ')}</span>
                </td>
                <td className="py-2.5 px-4 text-right">
                  {c.estado === 'pendiente_aprobacion' && (
                    <div className="flex justify-end gap-2">
                      <button disabled={busy === c.id} onClick={() => actualizarEstado(c.id, 'activa')} className="text-success hover:opacity-70">
                        <CheckCircle2 className="w-[18px] h-[18px]" />
                      </button>
                      <button disabled={busy === c.id} onClick={() => actualizarEstado(c.id, 'suspendida')} className="text-danger hover:opacity-70">
                        <XCircle className="w-[18px] h-[18px]" />
                      </button>
                    </div>
                  )}
                  {c.estado === 'activa' && (
                    <button disabled={busy === c.id} onClick={() => actualizarEstado(c.id, 'suspendida')} className="text-xs text-danger hover:underline">
                      Suspender
                    </button>
                  )}
                  {c.estado === 'suspendida' && (
                    <button disabled={busy === c.id} onClick={() => actualizarEstado(c.id, 'activa')} className="text-xs text-success hover:underline">
                      Reactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
