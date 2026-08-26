import { useEffect, useState } from 'react'
import { ArrowRightLeft, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

const TODAY = new Date().toISOString().slice(0, 10)
const CARGO_OPTIONS = ['Pastor local', 'Pastor asociado', 'Pastor auxiliar', 'Coordinador de congregación']

export default function PastoralDistrital() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const distritoId = rolPrincipal?.distrito_id
  const isDistrictLeader = rolPrincipal?.nivel === 'distrital'

  const [pastors, setPastors] = useState([])
  const [congregations, setCongregations] = useState([])
  const [assignments, setAssignments] = useState([])
  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    telefono: '',
    familia_pastoral: '',
    congregacion_id: '',
    fecha_inicio: TODAY,
    cargo: 'Pastor local',
    observaciones: '',
  })
  const [transferForm, setTransferForm] = useState({
    pastor_id: '',
    congregacion_id: '',
    fecha: TODAY,
    observaciones: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  async function load() {
    if (!distritoId || !isDistrictLeader) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [pastorResult, congregationResult, assignmentResult] = await Promise.all([
      supabase
        .from('pastores')
        .select('id, nombres, apellidos, telefono, familia_pastoral, observaciones, distrito_id')
        .eq('distrito_id', distritoId)
        .order('apellidos')
        .order('nombres'),
      supabase
        .from('congregaciones')
        .select('id, nombre, pastor_id, pastor_nombre')
        .eq('distrito_id', distritoId)
        .order('nombre'),
      supabase
        .from('asignaciones_pastorales')
        .select('id, pastor_id, congregacion_id, cargo, fecha_inicio, fecha_fin, observaciones')
        .eq('distrito_id', distritoId)
        .order('fecha_inicio', { ascending: false }),
    ])

    if (pastorResult.error || congregationResult.error || assignmentResult.error) {
      setError('No se pudo cargar la gestión pastoral distrital. Verifica que pastoral_distrital.sql esté ejecutado.')
    }

    setPastors(pastorResult.data ?? [])
    setCongregations(congregationResult.data ?? [])
    setAssignments(assignmentResult.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [distritoId, isDistrictLeader])

  async function savePastor(event) {
    event.preventDefault()

    if (!distritoId) {
      setError('No se pudo determinar el distrito del usuario activo.')
      return
    }

    if (!form.nombres.trim() || !form.apellidos.trim() || !form.congregacion_id) {
      setError('Completa nombres, apellidos y congregación.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const { data: pastorData, error: pastorError } = await supabase
        .from('pastores')
        .insert({
          distrito_id: distritoId,
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          telefono: form.telefono.trim() || null,
          familia_pastoral: form.familia_pastoral.trim() || null,
          observaciones: form.observaciones.trim() || null,
        })
        .select('id')
        .single()

      if (pastorError) {
        throw new Error(`No se pudo registrar el pastor: ${pastorError.message}`)
      }

      const { error: assignmentError } = await supabase.from('asignaciones_pastorales').insert({
        pastor_id: pastorData.id,
        distrito_id: distritoId,
        congregacion_id: form.congregacion_id,
        cargo: form.cargo,
        fecha_inicio: form.fecha_inicio,
        observaciones: form.observaciones.trim() || null,
      })

      if (assignmentError) {
        throw new Error(`El pastor se creó, pero no se pudo asignar: ${assignmentError.message}`)
      }

      const nombreCompleto = `${form.nombres.trim()} ${form.apellidos.trim()}`
      await supabase
        .from('congregaciones')
        .update({ pastor_id: pastorData.id, pastor_nombre: nombreCompleto })
        .eq('id', form.congregacion_id)

      setForm({
        nombres: '',
        apellidos: '',
        telefono: '',
        familia_pastoral: '',
        congregacion_id: '',
        fecha_inicio: TODAY,
        cargo: 'Pastor local',
        observaciones: '',
      })
      setNotice('Pastor registrado y asignado correctamente.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTransfer(event) {
    event.preventDefault()

    if (!transferForm.pastor_id || !transferForm.congregacion_id) {
      setError('Selecciona el pastor y la congregación de destino.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const { error: transferError } = await supabase.rpc('trasladar_pastor', {
        p_pastor_id: transferForm.pastor_id,
        p_congregacion_destino: transferForm.congregacion_id,
        p_fecha: transferForm.fecha || TODAY,
        p_observaciones: transferForm.observaciones.trim() || null,
      })

      if (transferError) {
        throw new Error(transferError.message)
      }

      setTransferForm({
        pastor_id: '',
        congregacion_id: '',
        fecha: TODAY,
        observaciones: '',
      })
      setNotice('Traslado registrado correctamente.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (roleLoading || loading) {
    return <p className="text-sm text-muted">Cargando gestión pastoral distrital...</p>
  }

  if (!isDistrictLeader) {
    return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Este módulo es exclusivo del líder distrital.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Administración distrital</p>
        <h1 className="text-2xl font-semibold">Gestión pastoral</h1>
        <p className="text-sm text-secondary mt-1">Controla pastores, asignaciones, traslados y trayectoria dentro del distrito.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <form onSubmit={savePastor} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <label className="text-sm">
          Nombres
          <input
            required
            className="input-field mt-1.5"
            value={form.nombres}
            onChange={(event) => setForm({ ...form, nombres: event.target.value })}
          />
        </label>

        <label className="text-sm">
          Apellidos
          <input
            required
            className="input-field mt-1.5"
            value={form.apellidos}
            onChange={(event) => setForm({ ...form, apellidos: event.target.value })}
          />
        </label>

        <label className="text-sm">
          Teléfono
          <input
            className="input-field mt-1.5"
            value={form.telefono}
            onChange={(event) => setForm({ ...form, telefono: event.target.value })}
          />
        </label>

        <label className="text-sm">
          Familia pastoral
          <input
            className="input-field mt-1.5"
            placeholder="Cónyuge e hijos"
            value={form.familia_pastoral}
            onChange={(event) => setForm({ ...form, familia_pastoral: event.target.value })}
          />
        </label>

        <label className="text-sm">
          Congregación
          <select
            required
            className="input-field mt-1.5"
            value={form.congregacion_id}
            onChange={(event) => setForm({ ...form, congregacion_id: event.target.value })}
          >
            <option value="">Seleccionar...</option>
            {congregations
              .filter((congregation) => !congregation.pastor_id)
              .map((congregation) => (
                <option key={congregation.id} value={congregation.id}>
                  {congregation.nombre}
                </option>
              ))}
          </select>
        </label>

        <label className="text-sm">
          Cargo
          <select
            className="input-field mt-1.5"
            value={form.cargo}
            onChange={(event) => setForm({ ...form, cargo: event.target.value })}
          >
            {CARGO_OPTIONS.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Desde
          <input
            required
            type="date"
            className="input-field mt-1.5"
            value={form.fecha_inicio}
            onChange={(event) => setForm({ ...form, fecha_inicio: event.target.value })}
          />
        </label>

        <button disabled={saving} className="btn-primary sm:col-span-2 lg:col-span-4">
          <Plus className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Registrar pastor'}
        </button>

        <label className="text-sm sm:col-span-2 lg:col-span-4">
          Observaciones
          <textarea
            className="input-field mt-1.5"
            value={form.observaciones}
            onChange={(event) => setForm({ ...form, observaciones: event.target.value })}
          />
        </label>
      </form>

      <form onSubmit={handleTransfer} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <h2 className="sm:col-span-2 lg:col-span-4 font-medium">Trasladar pastor</h2>

        <label className="text-sm">
          Pastor
          <select
            required
            className="input-field mt-1.5"
            value={transferForm.pastor_id}
            onChange={(event) =>
              setTransferForm({
                ...transferForm,
                pastor_id: event.target.value,
                congregacion_id: '',
              })
            }
          >
            <option value="">Seleccionar...</option>
            {pastors.map((pastor) => (
              <option key={pastor.id} value={pastor.id}>
                {pastor.nombres} {pastor.apellidos}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Nueva congregación
          <select
            required
            className="input-field mt-1.5"
            value={transferForm.congregacion_id}
            onChange={(event) => setTransferForm({ ...transferForm, congregacion_id: event.target.value })}
          >
            <option value="">Seleccionar...</option>
            {congregations
              .filter((congregation) => !congregation.pastor_id || congregation.pastor_id === transferForm.pastor_id)
              .map((congregation) => (
                <option key={congregation.id} value={congregation.id}>
                  {congregation.nombre}
                </option>
              ))}
          </select>
        </label>

        <label className="text-sm">
          Desde
          <input
            required
            type="date"
            className="input-field mt-1.5"
            value={transferForm.fecha}
            onChange={(event) => setTransferForm({ ...transferForm, fecha: event.target.value })}
          />
        </label>

        <button disabled={saving} className="btn-secondary">
          <ArrowRightLeft className="w-4 h-4" />
          {saving ? 'Trasladando...' : 'Confirmar traslado'}
        </button>

        <label className="text-sm sm:col-span-2 lg:col-span-4">
          Observaciones
          <textarea
            className="input-field mt-1.5"
            value={transferForm.observaciones}
            onChange={(event) => setTransferForm({ ...transferForm, observaciones: event.target.value })}
          />
        </label>
      </form>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">Pastores y trayectoria</h2>
          <p className="text-sm text-secondary mt-1">Asignaciones vigentes e históricas del distrito.</p>
        </div>

        {assignments.length ? (
          <div className="divide-y divide-border">
            {assignments.map((assignment) => {
              const pastor = pastors.find((item) => item.id === assignment.pastor_id)
              const congregation = congregations.find((item) => item.id === assignment.congregacion_id)

              return (
                <div key={assignment.id} className="p-4 flex items-start gap-3">
                  <ArrowRightLeft className="w-4 h-4 text-accent mt-1" />
                  <div>
                    <p className="text-sm font-medium">
                      {pastor ? `${pastor.nombres} ${pastor.apellidos}` : 'Pastor'}
                    </p>
                    <p className="text-xs text-secondary mt-1">
                      {assignment.cargo} · {congregation?.nombre || 'Congregación'} · Desde {assignment.fecha_inicio}
                      {assignment.fecha_fin ? ` hasta ${assignment.fecha_fin}` : ' · Actual'}
                    </p>
                    {pastor?.familia_pastoral && (
                      <p className="text-xs text-muted mt-1">Familia pastoral: {pastor.familia_pastoral}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="p-8 text-sm text-muted">Aún no hay trayectoria pastoral registrada.</p>
        )}
      </section>
    </div>
  )
}
