import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { ArrowRight, BarChart3, ClipboardPlus, Database, Settings2, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js'
import { useMiRol } from '../hooks/useMiRol'
import { supabase } from '../lib/supabase'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

const NIVEL_TITULO = {
  super_admin: 'Panel — todas las congregaciones',
  nacional: 'Panel nacional',
  distrital: 'Panel distrital',
  local: 'Resumen de la congregación',
}

function StatTile({ label, value, tone = 'default' }) {
  const bg = { default: 'bg-surface-1', danger: 'bg-danger-bg', success: 'bg-success-bg' }[tone]
  const text = { default: 'text-ink', danger: 'text-danger', success: 'text-success' }[tone]
  return (
    <div className={`${bg} rounded p-4`}>
      <p className={`text-sm ${tone === 'default' ? 'text-secondary' : text} mb-1.5`}>{label}</p>
      <p className={`text-2xl font-medium ${text}`}>{value}</p>
    </div>
  )
}

function QuickAction({ to, icon: Icon, title, description }) {
  return (
    <Link to={to} className="group flex items-center justify-between border border-border bg-surface-2 rounded p-4 hover:border-accent hover:shadow-sm transition-all">
      <span className="flex items-center gap-3">
        <span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center"><Icon className="w-[18px] h-[18px]" /></span>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-secondary mt-0.5">{description}</span>
        </span>
      </span>
      <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
    </Link>
  )
}

export default function Dashboard() {
  const { rolPrincipal, loading: loadingRol } = useMiRol()
  const [alertas, setAlertas] = useState([])
  const [tendencia, setTendencia] = useState(null)
  const [registros, setRegistros] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [handledAlerts, setHandledAlerts] = useState([])
  const [alertasTotal, setAlertasTotal] = useState(0)
  const [resumenFeligresia, setResumenFeligresia] = useState(null)

  useEffect(() => {
    if (!rolPrincipal) return
    async function load() {
      setLoadError(null)
      // vw_tendencia_categoria: agregación de registros_actividad.desglose
      // por categoría demográfica y mes, filtrada según el alcance del rol
      // (la vista ya respeta RLS — no hace falta filtrar aquí manualmente).
      const { data, error: tendenciaError } = await supabase.from('vw_tendencia_categoria').select('*').order('mes_orden')
      setTendencia(data)

      const [{ data: alertasData, error: alertasError }, { count: alertasCount, error: alertasCountError }, { data: feligresiaData, error: feligresiaError }] = await Promise.all([
        supabase.from('vw_alertas_pastorales').select('*').limit(5),
        supabase.from('vw_alertas_pastorales').select('clave', { count: 'exact', head: true }),
        rolPrincipal.nivel === 'local' ? supabase.from('vw_resumen_feligresia').select('personas_activas, bautizados, apartados, familias_asociadas').eq('congregacion_id', rolPrincipal.congregacion_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ])
      setAlertas(alertasData ?? [])
      setAlertasTotal(alertasCount ?? 0)
      setResumenFeligresia(feligresiaData)

      const [{ data: registrosData, error: registrosError }, { data: categoriasData, error: categoriasError }] = await Promise.all([
        supabase.from('registros_actividad').select('id, fecha, total_asistentes, desglose, modulos(nombre_modulo)').order('fecha', { ascending: false }).limit(500),
        supabase.from('categorias_demograficas').select('id, nombre').order('orden'),
      ])
      if (tendenciaError || alertasError || alertasCountError || feligresiaError || registrosError || categoriasError) setLoadError('No se pudieron cargar todos los indicadores. Revisa la conexión con Supabase.')
      setRegistros(registrosData ?? [])
      setCategorias(categoriasData ?? [])
    }
    load()
  }, [rolPrincipal])

  async function handleAlert(alert) {
    if (handledAlerts.includes(alert.id)) return
    if (alert.persona_id) {
      const followup = await supabase.from('seguimientos_pastorales').insert({ congregacion_id: alert.congregacion_id, persona_id: alert.persona_id, tipo_alerta: alert.tipo, accion: 'Alerta atendida', notas: alert.detalle })
      if (followup.error) { setLoadError('No se pudo registrar el seguimiento de la alerta.'); return }
    }
    const result = await supabase.from('estados_alerta_pastoral').upsert({ clave: alert.clave, congregacion_id: alert.congregacion_id, estado: 'atendida', notas: alert.detalle }, { onConflict: 'clave' })
    if (result.error) { setLoadError('El seguimiento se guardó, pero no se pudo cerrar la alerta.'); return }
    setHandledAlerts((current) => [...current, alert.id])
  }

  if (loadingRol) return <div className="h-64 flex items-center justify-center text-sm text-muted">Cargando tu espacio...</div>

  const hasData = Boolean(tendencia?.length)
  const nombreCongregacion = rolPrincipal?.congregaciones?.nombre
  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const registrosMes = registros.filter((registro) => registro.fecha >= inicioMes)
  const asistentesMes = registrosMes.reduce((total, registro) => total + (registro.total_asistentes || 0), 0)
  const promedioMes = registrosMes.length ? Math.round(asistentesMes / registrosMes.length) : 0
  const ultimoRegistro = registros[0]
  const categoriasConTotal = categorias.map((categoria) => ({
    ...categoria,
    total: registrosMes.reduce((total, registro) => total + Number(registro.desglose?.[categoria.id] || 0), 0),
  })).sort((a, b) => b.total - a.total)
  const totalCategorias = categoriasConTotal.reduce((total, categoria) => total + categoria.total, 0)
  const categoriaPrincipal = categoriasConTotal[0]
  const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const mesAnterior = registros.filter((registro) => {
    const fecha = new Date(`${registro.fecha}T00:00:00`)
    return fecha >= inicioMesAnterior && fecha < finMesAnterior
  }).reduce((total, registro) => total + (registro.total_asistentes || 0), 0)
  const variacion = mesAnterior ? Math.round(((asistentesMes - mesAnterior) / mesAnterior) * 100) : null
  const pendingAlerts = alertas.filter((alerta) => !handledAlerts.includes(alerta.id))

  const chartData = {
    labels: tendencia?.map((t) => t.mes) ?? ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    datasets: [
      { label: 'Damas', data: tendencia?.map((t) => t.damas) ?? [], borderColor: '#2a78d6', backgroundColor: 'rgba(42,120,214,0.08)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 },
      { label: 'Jóvenes', data: tendencia?.map((t) => t.jovenes) ?? [], borderColor: '#eb6834', backgroundColor: 'rgba(235,104,52,0.08)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 },
    ],
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-card bg-ink text-white p-7 sm:p-9">
        <div className="absolute right-0 top-0 h-full w-2/5 opacity-40 bg-[radial-gradient(circle_at_70%_25%,#2a78d6_0,transparent_55%)]" />
        <div className="relative max-w-2xl">
          <p className="text-xs uppercase tracking-[0.16em] text-white/60">{nombreCongregacion || 'SIGA · IPUC'}</p>
          <h1 className="text-3xl sm:text-4xl font-semibold mt-3 tracking-tight">{nombreCongregacion ? `Hola, ${nombreCongregacion}` : NIVEL_TITULO[rolPrincipal?.nivel] ?? 'Tu espacio de gestión'}</h1>
          <p className="text-sm sm:text-base text-white/70 mt-3 max-w-lg leading-6">Una lectura sencilla de la vida operativa de tu congregación. Empieza registrando una actividad o revisa el estado de tus datos.</p>
        </div>
      </section>

      <div className="grid sm:grid-cols-3 gap-3">
        <StatTile label="Asistentes este mes" value={registros.length ? asistentesMes : '—'} />
        <StatTile label="Alertas activas" value={alertasTotal || pendingAlerts.length} tone={alertasTotal > 0 || pendingAlerts.length > 0 ? 'danger' : 'default'} />
        <StatTile label="Promedio por actividad" value={registros.length ? promedioMes : '—'} tone="success" />
      </div>

      {loadError && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{loadError}</p>}

      {hasData && (
        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
          <div className="card p-5">
            <div className="flex justify-between gap-4 mb-5"><div><h2 className="font-medium">Lectura del periodo</h2><p className="text-sm text-secondary mt-1">Lo que está pasando con la asistencia este mes.</p></div><BarChart3 className="w-5 h-5 text-accent" /></div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div><p className="text-xs text-muted">Actividades</p><p className="text-2xl font-semibold mt-1">{registrosMes.length}</p></div>
              <div><p className="text-xs text-muted">Asistentes</p><p className="text-2xl font-semibold mt-1">{asistentesMes}</p></div>
              <div><p className="text-xs text-muted">Variación mensual</p><p className={`text-2xl font-semibold mt-1 ${variacion !== null && variacion < 0 ? 'text-danger' : 'text-success'}`}>{variacion === null ? '—' : `${variacion > 0 ? '+' : ''}${variacion}%`}</p></div>
            </div>
            <div className={`mt-5 flex items-start gap-3 rounded p-3 ${variacion !== null && variacion < 0 ? 'bg-danger-bg' : 'bg-success-bg'}`}>
              {variacion !== null && variacion < 0 ? <TrendingDown className="w-4 h-4 text-danger mt-0.5" /> : <TrendingUp className="w-4 h-4 text-success mt-0.5" />}
              <p className="text-sm text-secondary">{variacion === null ? 'Aún no hay un periodo anterior comparable. Sigue capturando datos para construir una señal confiable.' : variacion < 0 ? `La asistencia bajó ${Math.abs(variacion)}% frente al mes anterior. Conviene revisar las actividades con menor participación.` : `La asistencia creció ${variacion}% frente al mes anterior. Identifica qué actividad está impulsando este resultado.`}</p>
            </div>
          </div>
          <div className="card p-5"><h2 className="font-medium">Dónde está el volumen</h2><p className="text-sm text-secondary mt-1 mb-5">Distribución por categoría en el periodo.</p>{categoriaPrincipal && totalCategorias > 0 ? <div className="flex flex-col gap-3">{categoriasConTotal.slice(0, 5).map((categoria) => <div key={categoria.id}><div className="flex justify-between text-xs mb-1"><span>{categoria.nombre}</span><span className="font-medium">{categoria.total}</span></div><div className="h-2 bg-surface-1 rounded overflow-hidden"><div className="h-full bg-accent rounded" style={{ width: `${Math.max(2, (categoria.total / totalCategorias) * 100)}%` }} /></div></div>)}</div> : <p className="text-sm text-muted">Aún no hay desglose por categorías.</p>}</div>
        </section>
      )}

      {rolPrincipal?.nivel === 'local' && (
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="font-medium">Accesos rápidos</h2>
              <p className="text-sm text-secondary mt-1">Las tareas que más vas a usar en tu congregación.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            <QuickAction to="/registrar" icon={ClipboardPlus} title="Registrar asistencia" description="Captura una nueva actividad" />
            <QuickAction to="/amigos" icon={Users} title="Ver amigos" description="Continúa el seguimiento" />
            <QuickAction to="/feligresia" icon={Users} title="Abrir feligresía" description="Consulta el censo pastoral" />
            <QuickAction to="/feligresia?tab=seguimiento" icon={TrendingDown} title="Seguimiento pastoral" description="Revisa la agenda pendiente" />
          </div>
        </section>
      )}

      {rolPrincipal?.nivel === 'local' && resumenFeligresia && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="Personas activas" value={resumenFeligresia.personas_activas} />
          <StatTile label="Bautizados" value={resumenFeligresia.bautizados} />
          <StatTile label="Familias" value={resumenFeligresia.familias_asociadas} />
          <StatTile label="Apartados" value={resumenFeligresia.apartados} />
        </section>
      )}

      {!hasData && (
        <section className="border border-dashed border-border rounded-card p-7 bg-surface-2 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          <div className="w-11 h-11 rounded bg-success-bg text-success flex items-center justify-center flex-shrink-0"><Database className="w-5 h-5" /></div>
          <div>
            <h2 className="font-medium">Tu panel está listo para recibir datos</h2>
            <p className="text-sm text-secondary mt-1 leading-6">Cuando la PWA registre actividades, aquí aparecerán las tendencias y las alertas pastorales. Las métricas se mantienen vacías hasta tener información real.</p>
          </div>
        </section>
      )}

      <div className="card p-5">
        <h3 className="font-medium mb-4">Tendencia por categoría demográfica</h3>
        <div style={{ height: 260 }}>
          <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 12 } } } }, scales: { y: { grid: { color: '#e1e0d9' } }, x: { grid: { display: false } } } }} />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex justify-between items-center mb-4"><div><h3 className="font-medium">Alertas pastorales</h3><p className="text-xs text-secondary mt-1">Señales que requieren atención.</p></div>{ultimoRegistro && <span className="text-xs text-muted">Último registro: {ultimoRegistro.fecha}</span>}</div>
        {alertas.filter((alerta) => !handledAlerts.includes(alerta.id)).length === 0 ? (
          <p className="text-sm text-muted">
            Sin alertas por ahora. Se alimentan de <code className="text-xs">vw_alertas_pastorales</code> (comparación
            mes contra mes por categoría, disparada cuando la caída supera el umbral configurado).
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {alertas.filter((alerta) => !handledAlerts.includes(alerta.id)).map((a) => (
              <div key={a.id} className="border-l-2 border-danger bg-danger-bg p-3 rounded-r">
                <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-danger">{a.titulo}</p><div className="flex gap-2 text-xs">{a.persona_id && <Link to={`/feligresia?persona=${a.persona_id}`} className="text-accent">Ver ficha</Link>}<button type="button" onClick={() => handleAlert(a)} className="text-danger">Atender</button></div></div>
                <p className="text-xs text-secondary">{a.detalle}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
