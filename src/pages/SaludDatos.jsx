import { Fragment, useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip as ChartTooltip } from 'chart.js'
import { Database, ChevronDown, ChevronRight, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'
import { hoyBogota } from '../lib/fechaBogota'
import { distributionDataset, chartOptions } from '../lib/chartTheme'
import { descargarCsv, descargarExcel, descargarPdf } from '../lib/reportExport'
import ChartEmpty from '../components/ChartEmpty'
import ExportButtons from '../components/ExportButtons'
import InfoTip from '../components/InfoTip'

ChartJS.register(BarElement, CategoryScale, LinearScale, ChartTooltip)
const CHART_OPTIONS = chartOptions()

const saludDatosCache = new Map()

function formatDistritoLabel(nombre, numero) {
  return numero ? `Distrito ${numero}` : nombre
}

function pct(parte, total) {
  if (!total) return null
  return Math.round((Number(parte) / Number(total)) * 100)
}

function Metric({ label, value, tip, tono = 'default' }) {
  return (
    <div className="stat-tile">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">{label}{tip && <InfoTip texto={tip} />}</p>
      <p className={`text-2xl font-semibold mt-3 ${tono === 'alerta' && Number(value) > 0 ? 'text-danger' : ''}`}>{value}</p>
    </div>
  )
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
  { key: 'con_fecha_nacimiento', label: 'Fecha de nacimiento', campoPersona: 'fecha_nacimiento' },
  { key: 'con_genero', label: 'Género', campoPersona: 'genero' },
  { key: 'con_telefono', label: 'Teléfono', campoPersona: 'telefono' },
  { key: 'con_familia', label: 'Familia asociada', campoPersona: 'familia_id' },
  { key: 'con_fecha_ingreso', label: 'Fecha de ingreso', campoPersona: 'fecha_ingreso' },
]

// Promedio de completitud de una fila (congregación o distrito) sobre
// los 5 campos de CAMPOS -- usado para el ranking. bautizado/sellado
// quedan fuera a propósito: no son "completitud" en el mismo sentido
// (ver nota en fix_salud_datos_consistencia_bautismo_sellado.sql).
function scoreCompletitud(fila) {
  const total = Number(fila.total_activos || 0)
  if (!total) return null
  const suma = CAMPOS.reduce((acc, campo) => acc + Number(fila[campo.key] || 0), 0)
  return Math.round((suma / (total * CAMPOS.length)) * 100)
}

// Nombres reales de las personas activas a las que les falta `campo` --
// solo tiene sentido a nivel local (un distrito/congregación completo
// ya se resume en la tabla por fila, no en nombres individuales).
function ListaFaltantes({ personas, campo }) {
  const faltantes = personas.filter((p) => !p[campo])
  if (faltantes.length === 0) return null
  return (
    <details className="mt-1.5">
      <summary className="text-xs text-accent cursor-pointer select-none">Ver quién ({faltantes.length})</summary>
      <ul className="mt-1.5 flex flex-col gap-1 text-xs text-secondary max-h-32 overflow-y-auto pl-1">
        {faltantes.map((p) => <li key={p.id}>{[p.nombres, p.apellidos].filter(Boolean).join(' ')}</li>)}
      </ul>
    </details>
  )
}

function ListaInconsistencia({ personas, filtro, etiqueta }) {
  const afectados = personas.filter(filtro)
  if (afectados.length === 0) return null
  return (
    <details className="mt-1.5">
      <summary className="text-xs text-accent cursor-pointer select-none">Ver {etiqueta} ({afectados.length})</summary>
      <ul className="mt-1.5 flex flex-col gap-1 text-xs text-secondary max-h-32 overflow-y-auto pl-1">
        {afectados.map((p) => <li key={p.id}>{[p.nombres, p.apellidos].filter(Boolean).join(' ')}</li>)}
      </ul>
    </details>
  )
}

// Tabla reutilizada dos veces: el nivel principal (por congregación en
// distrital, por distrito en nacional) y, anidada, el detalle por
// congregación cuando nacional expande un distrito (mismo shape de
// fila, misma función RPC -- ver resumen_salud_datos_distrital).
function TablaSalud({ filas, columnaLabel, expandible, expandido, onToggle, drillDown, drillDownLoading }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted bg-surface-1">
          <th className="font-normal px-5 py-3">{columnaLabel}</th>
          <th className="font-normal px-5 py-3">Activos</th>
          {CAMPOS.map((campo) => <th key={campo.key} className="font-normal px-5 py-3">{campo.label}</th>)}
          <th className="font-normal px-5 py-3">Bautizados sin fecha</th>
          <th className="font-normal px-5 py-3">Sellados sin fecha</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => {
          const id = fila.congregacion_id || fila.distrito_id
          const abierto = expandible && expandido === id
          return (
            <Fragment key={id}>
              <tr className={`border-t border-border ${expandible ? 'cursor-pointer hover:bg-surface-1' : ''}`} onClick={expandible ? () => onToggle(id) : undefined}>
                <td className="px-5 py-3 font-medium flex items-center gap-1.5">
                  {expandible && (abierto ? <ChevronDown className="w-3.5 h-3.5 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-muted" />)}
                  {fila.nombre}
                </td>
                <td className="px-5 py-3 text-secondary">{fila.total_activos}</td>
                {CAMPOS.map((campo) => {
                  const valor = pct(fila[campo.key], fila.total_activos)
                  return <td key={campo.key} className={`px-5 py-3 ${valor !== null && valor < 50 ? 'text-danger' : valor !== null && valor < 80 ? 'text-warning' : 'text-secondary'}`}>{valor === null ? '—' : `${valor}%`}</td>
                })}
                <td className={`px-5 py-3 ${Number(fila.bautizados_sin_fecha) > 0 ? 'text-danger' : 'text-secondary'}`}>{fila.bautizados_sin_fecha ?? 0}</td>
                <td className={`px-5 py-3 ${Number(fila.sellados_sin_fecha) > 0 ? 'text-danger' : 'text-secondary'}`}>{fila.sellados_sin_fecha ?? 0}</td>
              </tr>
              {abierto && (
                <tr key={`${id}-detalle`} className="border-t border-border bg-surface-1">
                  <td colSpan={CAMPOS.length + 4} className="px-5 py-4">
                    {drillDownLoading === id ? (
                      <p className="text-xs text-muted">Cargando congregaciones...</p>
                    ) : (drillDown[id]?.length ? (
                      <div className="overflow-x-auto rounded-card border border-border bg-surface-0">
                        <TablaSalud filas={drillDown[id]} columnaLabel="Congregación" expandible={false} expandido={null} onToggle={() => {}} drillDown={{}} drillDownLoading={null} />
                      </div>
                    ) : <p className="text-xs text-muted">Sin congregaciones registradas en este distrito.</p>)}
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

export default function SaludDatos() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const nivel = rolPrincipal?.nivel
  const [filas, setFilas] = useState([])
  const [personasLocal, setPersonasLocal] = useState([])
  const [sinUbicacion, setSinUbicacion] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandido, setExpandido] = useState(null)
  const [drillDown, setDrillDown] = useState({})
  const [drillDownLoading, setDrillDownLoading] = useState(null)

  useEffect(() => {
    if (roleLoading || !rolPrincipal) return
    const cacheKey = nivel === 'local' ? `local:${rolPrincipal.congregacion_id}` : nivel === 'distrital' ? `distrital:${rolPrincipal.distrito_id}` : (nivel === 'nacional' || nivel === 'super_admin') ? 'nacional' : null
    const cached = cacheKey ? saludDatosCache.get(cacheKey) : null
    if (cached) {
      setFilas(cached.filas)
      setPersonasLocal(cached.personasLocal ?? [])
      setSinUbicacion(cached.sinUbicacion ?? [])
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    setExpandido(null)
    setDrillDown({})
    if (nivel === 'local') {
      supabase.from('personas').select('id, nombres, apellidos, fecha_nacimiento, genero, telefono, familia_id, fecha_ingreso, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado').eq('congregacion_id', rolPrincipal.congregacion_id).eq('estado_membresia', 'activo').then(({ data, error: loadError }) => {
        if (loadError) { setError('No se pudo cargar la salud de los datos.'); setLoading(false); return }
        const personas = data ?? []
        const filas = [{
          congregacion_id: rolPrincipal.congregacion_id,
          nombre: 'Tu congregación',
          total_activos: personas.length,
          con_fecha_nacimiento: personas.filter((p) => p.fecha_nacimiento).length,
          con_genero: personas.filter((p) => p.genero).length,
          con_telefono: personas.filter((p) => p.telefono).length,
          con_familia: personas.filter((p) => p.familia_id).length,
          con_fecha_ingreso: personas.filter((p) => p.fecha_ingreso).length,
          bautizados: personas.filter((p) => p.bautizado).length,
          bautizados_sin_fecha: personas.filter((p) => p.bautizado && !p.fecha_bautismo).length,
          sellados: personas.filter((p) => p.sellado_espiritu_santo).length,
          sellados_sin_fecha: personas.filter((p) => p.sellado_espiritu_santo && !p.fecha_sellado).length,
        }]
        setFilas(filas)
        setPersonasLocal(personas)
        setLoading(false)
        if (cacheKey) saludDatosCache.set(cacheKey, { filas, personasLocal: personas })
      })
    } else if (nivel === 'distrital') {
      Promise.all([
        supabase.rpc('resumen_salud_datos_distrital', { p_distrito_id: rolPrincipal.distrito_id }),
        supabase.from('congregaciones').select('id, nombre').eq('distrito_id', rolPrincipal.distrito_id).is('latitud', null),
      ]).then(([{ data, error: loadError }, { data: sinUbicacionData, error: sinUbicacionError }]) => {
        if (loadError || sinUbicacionError) setError('No se pudo cargar la salud de los datos.')
        const filas = data ?? []
        const sinUbi = sinUbicacionData ?? []
        setFilas(filas)
        setSinUbicacion(sinUbi)
        setLoading(false)
        if (cacheKey) saludDatosCache.set(cacheKey, { filas, sinUbicacion: sinUbi })
      })
    } else if (nivel === 'nacional' || nivel === 'super_admin') {
      Promise.all([
        supabase.rpc('resumen_salud_datos_nacional'),
        supabase.from('congregaciones').select('id, nombre').is('latitud', null),
      ]).then(([{ data, error: loadError }, { data: sinUbicacionData, error: sinUbicacionError }]) => {
        if (loadError || sinUbicacionError) setError('No se pudo cargar la salud de los datos.')
        const filas = (data ?? []).map((item) => ({ ...item, nombre: formatDistritoLabel(item.nombre, item.numero) }))
        const sinUbi = sinUbicacionData ?? []
        setFilas(filas)
        setSinUbicacion(sinUbi)
        setLoading(false)
        if (cacheKey) saludDatosCache.set(cacheKey, { filas, sinUbicacion: sinUbi })
      })
    } else {
      setLoading(false)
    }
  }, [roleLoading, rolPrincipal, nivel])

  async function toggleDistrito(distritoId) {
    if (expandido === distritoId) { setExpandido(null); return }
    setExpandido(distritoId)
    if (drillDown[distritoId]) return
    setDrillDownLoading(distritoId)
    const { data, error: rpcError } = await supabase.rpc('resumen_salud_datos_distrital', { p_distrito_id: distritoId })
    setDrillDownLoading(null)
    if (rpcError) { setError('No se pudo cargar el detalle de ese distrito.'); return }
    setDrillDown((prev) => ({ ...prev, [distritoId]: data ?? [] }))
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando salud de datos...</div>

  const totalActivos = filas.reduce((total, fila) => total + Number(fila.total_activos || 0), 0)
  const promedios = CAMPOS.map((campo) => ({
    ...campo,
    valor: pct(filas.reduce((total, fila) => total + Number(fila[campo.key] || 0), 0), totalActivos),
  }))
  const valoresValidos = promedios.map((p) => p.valor).filter((v) => v !== null)
  const completitudPromedio = valoresValidos.length ? Math.round(valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length) : null
  const totalBautizadosSinFecha = filas.reduce((total, fila) => total + Number(fila.bautizados_sin_fecha || 0), 0)
  const totalSelladosSinFecha = filas.reduce((total, fila) => total + Number(fila.sellados_sin_fecha || 0), 0)

  const rankingData = [...filas]
    .map((fila) => ({ label: fila.nombre, total: scoreCompletitud(fila) ?? 0 }))
    .sort((a, b) => a.total - b.total)
  const rankingChart = distributionDataset(rankingData, { datasetLabel: 'Completitud %' })

  function exportResumen() {
    return {
      kpis: [
        { label: 'Completitud promedio', value: completitudPromedio === null ? '—' : `${completitudPromedio}%` },
        { label: 'Personas activas medidas', value: totalActivos },
        { label: 'Bautizados sin fecha', value: totalBautizadosSinFecha },
        { label: 'Sellados sin fecha', value: totalSelladosSinFecha },
      ],
    }
  }
  function exportHeaders() {
    return {
      headers: [nivel === 'distrital' ? 'Congregación' : nivel === 'local' ? 'Congregación' : 'Distrito', 'Activos', ...CAMPOS.map((c) => c.label), 'Bautizados sin fecha', 'Sellados sin fecha'],
      rows: filas.map((fila) => [
        fila.nombre,
        fila.total_activos,
        ...CAMPOS.map((campo) => { const v = pct(fila[campo.key], fila.total_activos); return v === null ? '—' : `${v}%` }),
        fila.bautizados_sin_fecha ?? 0,
        fila.sellados_sin_fecha ?? 0,
      ]),
    }
  }
  function exportCsv() { descargarCsv({ filename: `salud-datos-${hoyBogota()}.csv`, titulo: 'Salud de datos', resumen: exportResumen(), ...exportHeaders() }) }
  function exportExcel() { descargarExcel({ filename: `salud-datos-${hoyBogota()}.xlsx`, hoja: 'Salud de datos', titulo: 'Salud de datos', resumen: exportResumen(), ...exportHeaders() }) }
  function exportPdf() { descargarPdf({ filename: `salud-datos-${hoyBogota()}.pdf`, titulo: 'Salud de datos', resumen: exportResumen(), ...exportHeaders() }) }

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Calidad del censo</p>
          <h1 className="section-title">Salud de datos</h1>
          <p className="text-sm text-secondary mt-0.5">La pirámide poblacional, los cumpleaños, la proyección de crecimiento y el mapa de presencia solo son tan buenos como estos datos.</p>
        </div>
        <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Completitud promedio" value={completitudPromedio === null ? '—' : `${completitudPromedio}%`} tip="Promedio de los 5 campos de abajo, sobre las personas activas." />
        <Metric label="Personas activas medidas" value={totalActivos} />
        <Metric label="Bautizados sin fecha" value={totalBautizadosSinFecha} tono="alerta" tip="Personas marcadas como bautizadas pero sin fecha de bautismo registrada -- una inconsistencia real, no un dato simplemente vacío (bautizado=falso también puede ser correcto)." />
        <Metric label="Sellados sin fecha" value={totalSelladosSinFecha} tono="alerta" tip="Personas marcadas como selladas con el Espíritu Santo pero sin fecha de sellado registrada." />
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4"><Database className="w-4 h-4 text-accent" /><h2 className="font-medium">Promedio {nivel === 'local' ? 'de tu congregación' : nivel === 'distrital' ? 'de tu distrito' : 'nacional'}</h2><InfoTip texto="Porcentaje de personas activas con ese dato registrado. Verde: 80% o más completo. Amarillo: 50-79%. Rojo: menos de 50%." /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {promedios.map((campo) => (
            <div key={campo.key}>
              <Barra etiqueta={campo.label} valor={campo.valor} />
              {nivel === 'local' && <ListaFaltantes personas={personasLocal} campo={campo.campoPersona} />}
            </div>
          ))}
        </div>
        {nivel === 'local' && (
          <div className="grid sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-border">
            <div>
              <p className="text-xs text-secondary mb-1">Bautizados sin fecha registrada</p>
              <p className={`text-lg font-semibold ${totalBautizadosSinFecha > 0 ? 'text-danger' : ''}`}>{totalBautizadosSinFecha}</p>
              <ListaInconsistencia personas={personasLocal} filtro={(p) => p.bautizado && !p.fecha_bautismo} etiqueta="quiénes" />
            </div>
            <div>
              <p className="text-xs text-secondary mb-1">Sellados sin fecha registrada</p>
              <p className={`text-lg font-semibold ${totalSelladosSinFecha > 0 ? 'text-danger' : ''}`}>{totalSelladosSinFecha}</p>
              <ListaInconsistencia personas={personasLocal} filtro={(p) => p.sellado_espiritu_santo && !p.fecha_sellado} etiqueta="quiénes" />
            </div>
          </div>
        )}
        <p className="text-xs text-muted mt-4">Sobre {totalActivos} persona(s) activa(s).</p>
      </section>

      {nivel !== 'local' && (
        <>
          <section className="card chart-card p-5">
            <p className="eyebrow">Ranking</p>
            <h2 className="font-medium mt-1">{nivel === 'distrital' ? 'Congregaciones' : 'Distritos'} que más necesitan atención</h2>
            <p className="text-xs text-secondary mt-1">Ordenado de menor a mayor completitud promedio.</p>
            <div className="h-64 mt-4">
              {filas.length ? <Bar data={rankingChart} options={CHART_OPTIONS} /> : <ChartEmpty message="Aún no hay datos para comparar." />}
            </div>
          </section>

          {sinUbicacion.length > 0 && (
            <section className="card p-5" style={{ borderColor: 'rgba(217,119,6,0.35)' }}>
              <div className="flex items-center gap-2 mb-2"><MapPin className="w-4 h-4 text-warning" /><h2 className="font-medium">Congregaciones sin ubicación en el mapa</h2><InfoTip texto="Sin dirección/ubicación marcada en Configuración, esta congregación no aparece en el Mapa de presencia ni en Territorio alcanzado (Impacto Misionero)." /></div>
              <p className="text-sm text-secondary">{sinUbicacion.length} congregación(es): {sinUbicacion.map((c) => c.nombre).join(', ')}.</p>
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="p-5 border-b border-border"><h2 className="font-medium">{nivel === 'distrital' ? 'Por congregación' : 'Por distrito'}</h2>{nivel !== 'distrital' && <p className="text-xs text-muted mt-1">Haz clic en un distrito para ver el detalle por congregación.</p>}</div>
            {filas.length === 0 ? <p className="p-6 text-sm text-muted">Sin datos todavía.</p> : (
              <div className="overflow-x-auto">
                <TablaSalud
                  filas={filas}
                  columnaLabel={nivel === 'distrital' ? 'Congregación' : 'Distrito'}
                  expandible={nivel !== 'distrital'}
                  expandido={expandido}
                  onToggle={toggleDistrito}
                  drillDown={drillDown}
                  drillDownLoading={drillDownLoading}
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
