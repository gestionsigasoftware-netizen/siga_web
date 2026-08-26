import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

function withRequestTimeout(request, milliseconds = 12000) {
  return Promise.race([request, new Promise((_, reject) => setTimeout(() => reject(new Error('La operación tardó demasiado. Verifica la conexión con Supabase.')), milliseconds))])
}

export default function RegistrarAsistencia() {
  const { rolPrincipal, loading: loadingRol } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id

  const [modulos, setModulos] = useState([])
  const [moduloId, setModuloId] = useState('')
  const [tipos, setTipos] = useState([])
  const [tipoId, setTipoId] = useState('')
  const [zonas, setZonas] = useState([])
  const [zonaId, setZonaId] = useState('')
  const [categorias, setCategorias] = useState([])
  const [conteos, setConteos] = useState({})
  const [responsables, setResponsables] = useState([])
  const [responsableId, setResponsableId] = useState('')
  const [novedades, setNovedades] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [motivoCaptura, setMotivoCaptura] = useState('')
  const [canCapture, setCanCapture] = useState(false)
  const [loadingPermission, setLoadingPermission] = useState(true)
  const [loadingData, setLoadingData] = useState(true)
  const [registros, setRegistros] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!congregacionId) { setLoadingPermission(false); setLoadingData(false); return }
    setLoadingData(true)
    setLoadingPermission(true)
    Promise.all([
      supabase.from('modulos').select('id, nombre_modulo, requiere_zona').eq('congregacion_id', congregacionId).eq('activo', true),
      supabase.from('categorias_demograficas').select('id, nombre').eq('congregacion_id', congregacionId).order('orden'),
      supabase.from('personas').select('id, nombres, apellidos').eq('congregacion_id', congregacionId).eq('estado_membresia', 'activo'),
      supabase.rpc('tiene_permiso', { p_congregacion_id: congregacionId, p_permiso: 'estadisticas.registrar' }),
      supabase.rpc('tiene_permiso', { p_congregacion_id: congregacionId, p_permiso: 'feligresia.editar' }),
      supabase.from('registros_actividad').select('id, fecha, modulo_id, tipo_actividad_id, zona_id, total_asistentes, tipos_actividad(nombre), personas:responsable_persona_id(nombres, apellidos)').order('fecha', { ascending: false }).limit(10),
    ]).then(([modulosResult, categoriasResult, responsablesResult, capture, admin, registrosResult]) => {
      const failed = [modulosResult, categoriasResult, responsablesResult, capture, admin, registrosResult].find((result) => result.error)
      if (failed) setError('No se pudo cargar toda la información. Verifica la conexión con Supabase.')
      setModulos(modulosResult.data ?? [])
      setCategorias(categoriasResult.data ?? [])
      setResponsables(responsablesResult.data ?? [])
      setRegistros(registrosResult.data ?? [])
      setCanCapture(Boolean(capture.data || admin.data))
      setLoadingPermission(false)
      setLoadingData(false)
    }).catch(() => {
      setError('No se pudo cargar la información de asistencia.')
      setLoadingPermission(false)
      setLoadingData(false)
    })
  }, [congregacionId])

  useEffect(() => {
    if (!moduloId) { setTipos([]); return }
    supabase.from('tipos_actividad').select('id, nombre, caracter').eq('modulo_id', moduloId).eq('activo', true)
      .then(({ data }) => setTipos(data ?? []))
      supabase.from('zonas').select('id, nombre').eq('modulo_id', moduloId).order('nombre')
        .then(({ data }) => setZonas(data ?? []))
      setZonaId('')
  }, [moduloId])

  async function loadRegistros() {
    const { data } = await supabase
      .from('registros_actividad')
      .select('id, fecha, modulo_id, tipo_actividad_id, zona_id, total_asistentes, tipos_actividad(nombre), personas:responsable_persona_id(nombres, apellidos)')
      .order('fecha', { ascending: false })
      .limit(10)
    setRegistros(data ?? [])
  }

  function actualizarConteo(catId, valor) {
    setConteos((prev) => ({ ...prev, [catId]: parseInt(valor, 10) || 0 }))
  }

  const totalPreview = Object.values(conteos).reduce((total, value) => total + value, 0)

  async function handleSubmit(e) {
    e.preventDefault()
    const total = Object.values(conteos).reduce((a, b) => a + b, 0)
    const modulo = modulos.find((item) => item.id === moduloId)
    if (!responsableId || total <= 0) { setError('Elige un responsable e ingresa al menos un asistente.'); return }
    if (modulo?.requiere_zona && !zonaId) { setError('Selecciona el barrio o zona de la actividad.'); return }
    const duplicate = registros.some((registro) => registro.fecha === fecha && registro.modulo_id === moduloId && registro.tipo_actividad_id === tipoId && (registro.zona_id || null) === (zonaId || null))
    if (duplicate && !window.confirm('Ya existe un registro para esta fecha, módulo, actividad y zona. ¿Deseas continuar como corrección?')) return
    setError(null)
    setSaving(true)

    let result
    try {
      result = await withRequestTimeout(supabase.from('registros_actividad').insert({
        congregacion_id: congregacionId,
        modulo_id: moduloId,
        tipo_actividad_id: tipoId,
        zona_id: zonaId || null,
        responsable_persona_id: responsableId,
        fecha,
        novedades,
        origen_captura: 'web',
        motivo_captura: motivoCaptura,
        desglose: conteos,
      }))
    } catch (requestError) { setSaving(false); setError(requestError.message); return }
    setSaving(false)
    const { error } = result
    if (error) { setError('No se pudo guardar: ' + error.message); return }
    setOk(true)
    setConteos({})
    setNovedades('')
    setMotivoCaptura('')
    loadRegistros()
    setTimeout(() => setOk(false), 3000)
  }

  if (loadingRol || loadingPermission || loadingData) return <div className="module-loading" role="status"><span className="loading-dot" />Preparando corrección de asistencia...</div>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium">Corrección / contingencia de asistencia</h1>
        <p className="text-sm text-secondary mt-0.5">La aplicación móvil es el canal principal. Usa esta pantalla solo para corregir un registro cuando la captura móvil no estuvo disponible.</p>
      </div>

      {!canCapture && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Tu perfil no tiene permiso para registrar correcciones de asistencia.</p>}

      <form onSubmit={handleSubmit} className="card p-5 max-w-lg flex flex-col gap-3.5">
        <label className="text-sm text-secondary">Fecha de la actividad<input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input-field mt-1" /></label>
        {modulos.length === 0 && <p className="text-sm text-warning bg-warning-bg rounded p-3">No hay módulos activos configurados para esta congregación.</p>}
        {categorias.length === 0 && <p className="text-sm text-warning bg-warning-bg rounded p-3">No hay categorías demográficas configuradas para capturar asistencia.</p>}

        <div>
          <label className="text-sm text-secondary block mb-1">Módulo</label>
          <select value={moduloId} onChange={(e) => setModuloId(e.target.value)} className="input-field" required>
            <option value="">Selecciona un módulo</option>
            {modulos.map((m) => <option key={m.id} value={m.id}>{m.nombre_modulo}</option>)}
          </select>
        </div>

        {modulos.find((modulo) => modulo.id === moduloId)?.requiere_zona && <div><label className="text-sm text-secondary block mb-1">Barrio o zona</label><select required value={zonaId} onChange={(e) => setZonaId(e.target.value)} className="input-field"><option value="">Selecciona una zona</option>{zonas.map((zona) => <option key={zona.id} value={zona.id}>{zona.nombre}</option>)}</select></div>}

        <div>
          <label className="text-sm text-secondary block mb-1">Tipo de actividad</label>
          <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="input-field" required disabled={!moduloId}>
            <option value="">Selecciona una actividad</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}{t.caracter ? ` — ${t.caracter}` : ''}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-secondary block mb-1">Responsable de tomar asistencia</label>
          <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className="input-field" required>
            <option value="">Selecciona un responsable</option>
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

        <div>
          <label className="text-sm text-secondary block mb-1">Motivo de corrección o contingencia</label>
          <textarea required value={motivoCaptura} onChange={(e) => setMotivoCaptura(e.target.value)} className="input-field" rows={2} placeholder="Ej. La aplicación móvil no estuvo disponible o se corrigió un dato enviado" />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {ok && <p className="text-sm text-success">Corrección guardada.</p>}

        <div className="flex items-center justify-between gap-3 rounded-card border border-accent/20 bg-accent-bg px-3 py-2.5">
          <div><p className="text-[10px] uppercase tracking-[0.14em] text-accent-dark">Total a registrar</p><p className="text-xs text-secondary mt-0.5">Suma de las categorías ingresadas</p></div>
          <strong className="text-2xl text-accent-dark">{totalPreview}</strong>
        </div>

        <button type="submit" disabled={saving || !canCapture} className="btn-primary justify-center">
          {saving ? 'Guardando...' : 'Guardar corrección'}
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
