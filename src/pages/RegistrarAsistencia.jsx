import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

export default function RegistrarAsistencia() {
  const { rolPrincipal } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id

  const [modulos, setModulos] = useState([])
  const [moduloId, setModuloId] = useState('')
  const [tipos, setTipos] = useState([])
  const [tipoId, setTipoId] = useState('')
  const [categorias, setCategorias] = useState([])
  const [conteos, setConteos] = useState({})
  const [responsables, setResponsables] = useState([])
  const [responsableId, setResponsableId] = useState('')
  const [novedades, setNovedades] = useState('')
  const [registros, setRegistros] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!congregacionId) return
    supabase.from('modulos').select('id, nombre_modulo, requiere_zona').eq('congregacion_id', congregacionId).eq('activo', true)
      .then(({ data }) => setModulos(data ?? []))
    supabase.from('categorias_demograficas').select('id, nombre').eq('congregacion_id', congregacionId).order('orden')
      .then(({ data }) => setCategorias(data ?? []))
    supabase.from('personas').select('id, nombres, apellidos').eq('congregacion_id', congregacionId)
      .then(({ data }) => setResponsables(data ?? []))
    loadRegistros()
  }, [congregacionId])

  useEffect(() => {
    if (!moduloId) { setTipos([]); return }
    supabase.from('tipos_actividad').select('id, nombre, caracter').eq('modulo_id', moduloId).eq('activo', true)
      .then(({ data }) => setTipos(data ?? []))
  }, [moduloId])

  async function loadRegistros() {
    const { data } = await supabase
      .from('registros_actividad')
      .select('id, fecha, total_asistentes, tipos_actividad(nombre), personas:responsable_persona_id(nombres, apellidos)')
      .order('fecha', { ascending: false })
      .limit(10)
    setRegistros(data ?? [])
  }

  function actualizarConteo(catId, valor) {
    setConteos((prev) => ({ ...prev, [catId]: parseInt(valor, 10) || 0 }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const total = Object.values(conteos).reduce((a, b) => a + b, 0)
    if (!responsableId || total <= 0) { setError('Elige un responsable e ingresa al menos un asistente.'); return }
    setError(null)
    setSaving(true)

    const { error } = await supabase.from('registros_actividad').insert({
      congregacion_id: congregacionId,
      modulo_id: moduloId,
      tipo_actividad_id: tipoId,
      responsable_persona_id: responsableId,
      novedades,
      desglose: conteos,
    })

    setSaving(false)
    if (error) { setError('No se pudo guardar: ' + error.message); return }
    setOk(true)
    setConteos({})
    setNovedades('')
    loadRegistros()
    setTimeout(() => setOk(false), 3000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium">Registrar asistencia</h1>
        <p className="text-sm text-secondary mt-0.5">Funciona igual para cualquier módulo — Ujieres, Evangelismo, Misión Juvenil, Apartados.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 max-w-lg flex flex-col gap-3.5">
        <div>
          <label className="text-sm text-secondary block mb-1">Módulo</label>
          <select value={moduloId} onChange={(e) => setModuloId(e.target.value)} className="input-field" required>
            <option value="">Seleccionar...</option>
            {modulos.map((m) => <option key={m.id} value={m.id}>{m.nombre_modulo}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-secondary block mb-1">Tipo de actividad</label>
          <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="input-field" required disabled={!moduloId}>
            <option value="">Seleccionar...</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}{t.caracter ? ` — ${t.caracter}` : ''}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-secondary block mb-1">Responsable de tomar asistencia</label>
          <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className="input-field" required>
            <option value="">Seleccionar...</option>
            {responsables.map((p) => <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-secondary block mb-2">Asistencia por categoría</label>
          <div className="grid grid-cols-2 gap-2.5">
            {categorias.map((cat) => (
              <div key={cat.id}>
                <label className="text-xs text-muted">{cat.nombre}</label>
                <input type="number" min="0" value={conteos[cat.id] ?? ''} onChange={(e) => actualizarConteo(cat.id, e.target.value)} className="input-field" placeholder="0" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-secondary block mb-1">Novedades</label>
          <textarea value={novedades} onChange={(e) => setNovedades(e.target.value)} className="input-field" rows={2} placeholder="Sin novedades" />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {ok && <p className="text-sm text-success">Asistencia registrada.</p>}

        <button type="submit" disabled={saving} className="btn-primary justify-center">
          {saving ? 'Guardando...' : 'Guardar asistencia'}
        </button>
      </form>

      <div>
        <h3 className="font-medium mb-3">Registros recientes</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-muted text-left">
              <th className="font-normal py-1.5">Fecha</th>
              <th className="font-normal py-1.5">Actividad</th>
              <th className="font-normal py-1.5">Responsable</th>
              <th className="font-normal py-1.5">Total</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2">{r.fecha}</td>
                <td className="py-2">{r.tipos_actividad?.nombre}</td>
                <td className="py-2">{r.personas ? `${r.personas.nombres} ${r.personas.apellidos}` : '—'}</td>
                <td className="py-2">{r.total_asistentes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
