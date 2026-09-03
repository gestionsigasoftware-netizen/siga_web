import { useEffect, useState } from 'react'
import { Database } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

function formatDistritoLabel(nombre, numero) {
  return numero ? `Distrito ${numero} · ${nombre}` : nombre
}

function pct(parte, total) {
  if (!total) return null
  return Math.round((Number(parte) / Number(total)) * 100)
}

function Barra({ etiqueta, valor }) {
  const tono = valor === null ? 'bg-surface-1' : valor >= 80 ? 'bg-success' : valor >= 50 ? 'bg-warning' : 'bg-danger'
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-secondary mb-1"><span>{etiqueta}</span><span>{valor === null ? '—' : `${valor}%`}</span></div>
      <div className="h-1.5 rounded-full bg-surface-1 overflow-hidden"><div className={`h-full rounded-full ${tono}`} style={{ width: `${valor ?? 0}%` }} /></div>
    </div>
  )
}

const CAMPOS = [
  { key: 'con_fecha_nacimiento', label: 'Fecha de nacimiento' },
  { key: 'con_genero', label: 'Género' },
  { key: 'con_telefono', label: 'Teléfono' },
  { key: 'con_familia', label: 'Familia asociada' },
  { key: 'con_fecha_ingreso', label: 'Fecha de ingreso' },
]

export default function SaludDatos() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const nivel = rolPrincipal?.nivel
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (roleLoading || !rolPrincipal) return
    setLoading(true)
    setError(null)
    if (nivel === 'local') {
      supabase.from('personas').select('fecha_nacimiento, genero, telefono, familia_id, fecha_ingreso').eq('congregacion_id', rolPrincipal.congregacion_id).eq('estado_membresia', 'activo').then(({ data, error: loadError }) => {
        if (loadError) { setError('No se pudo cargar la salud de los datos.'); setLoading(false); return }
        const personas = data ?? []
        setFilas([{
          congregacion_id: rolPrincipal.congregacion_id,
          nombre: 'Tu congregación',
          total_activos: personas.length,
          con_fecha_nacimiento: personas.filter((p) => p.fecha_nacimiento).length,
          con_genero: personas.filter((p) => p.genero).length,
          con_telefono: personas.filter((p) => p.telefono).length,
          con_familia: personas.filter((p) => p.familia_id).length,
          con_fecha_ingreso: personas.filter((p) => p.fecha_ingreso).length,
        }])
        setLoading(false)
      })
    } else if (nivel === 'distrital') {
      supabase.rpc('resumen_salud_datos_distrital', { p_distrito_id: rolPrincipal.distrito_id }).then(({ data, error: loadError }) => {
        if (loadError) setError('No se pudo cargar la salud de los datos.')
        setFilas(data ?? [])
        setLoading(false)
      })
    } else if (nivel === 'nacional' || nivel === 'super_admin') {
      supabase.rpc('resumen_salud_datos_nacional').then(({ data, error: loadError }) => {
        if (loadError) setError('No se pudo cargar la salud de los datos.')
        setFilas((data ?? []).map((item) => ({ ...item, nombre: formatDistritoLabel(item.nombre, item.numero) })))
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [roleLoading, rolPrincipal, nivel])

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando salud de datos...</div>

  const totalActivos = filas.reduce((total, fila) => total + Number(fila.total_activos || 0), 0)
  const promedios = CAMPOS.map((campo) => ({
    ...campo,
    valor: pct(filas.reduce((total, fila) => total + Number(fila[campo.key] || 0), 0), totalActivos),
  }))

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">Calidad del censo</p>
        <h1 className="section-title">Salud de datos</h1>
        <p className="text-sm text-secondary mt-0.5">La pirámide poblacional, los cumpleaños y la proyección de crecimiento solo son tan buenas como estos datos — aquí se ve qué tan completos están.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4"><Database className="w-4 h-4 text-accent" /><h2 className="font-medium">Promedio {nivel === 'local' ? 'de tu congregación' : nivel === 'distrital' ? 'de tu distrito' : 'nacional'}</h2></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {promedios.map((campo) => <Barra key={campo.key} etiqueta={campo.label} valor={campo.valor} />)}
        </div>
        <p className="text-xs text-muted mt-4">Sobre {totalActivos} persona(s) activa(s).</p>
      </section>

      {nivel !== 'local' && (
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border"><h2 className="font-medium">{nivel === 'distrital' ? 'Por congregación' : 'Por distrito'}</h2></div>
          {filas.length === 0 ? <p className="p-6 text-sm text-muted">Sin datos todavía.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted bg-surface-1">
                    <th className="font-normal px-5 py-3">{nivel === 'distrital' ? 'Congregación' : 'Distrito'}</th>
                    <th className="font-normal px-5 py-3">Activos</th>
                    {CAMPOS.map((campo) => <th key={campo.key} className="font-normal px-5 py-3">{campo.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => (
                    <tr key={fila.congregacion_id || fila.distrito_id} className="border-t border-border">
                      <td className="px-5 py-3 font-medium">{fila.nombre}</td>
                      <td className="px-5 py-3 text-secondary">{fila.total_activos}</td>
                      {CAMPOS.map((campo) => {
                        const valor = pct(fila[campo.key], fila.total_activos)
                        return <td key={campo.key} className={`px-5 py-3 ${valor !== null && valor < 50 ? 'text-danger' : valor !== null && valor < 80 ? 'text-warning' : 'text-secondary'}`}>{valor === null ? '—' : `${valor}%`}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
