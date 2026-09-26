import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { hoyBogota } from "../lib/fechaBogota";
import { useMiRol } from '../hooks/useMiRol'
import InfoTip from '../components/InfoTip'

const registrarAsistenciaCache = new Map()

export default function RegistrarAsistencia() {
  const { t } = useTranslation()
  function withRequestTimeout(request, milliseconds = 12000) {
    return Promise.race([request, new Promise((_, reject) => setTimeout(() => reject(new Error(t('registrarAsistencia.errorTimeout'))), milliseconds))])
  }
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
  const [ujieresCongregacion, setUjieresCongregacion] = useState([])
  const [responsableId, setResponsableId] = useState('')
  const [novedades, setNovedades] = useState('')
  const [fecha, setFecha] = useState(hoyBogota())
  const [motivoCaptura, setMotivoCaptura] = useState('')
  const [canCapture, setCanCapture] = useState(false)
  const [captureRules, setCaptureRules] = useState({ exigir_responsable: true, exigir_novedades: false })
  const [loadingPermission, setLoadingPermission] = useState(true)
  const [loadingData, setLoadingData] = useState(true)
  const [registros, setRegistros] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!congregacionId) { setLoadingPermission(false); setLoadingData(false); return }
    const cacheKey = congregacionId
    const cached = registrarAsistenciaCache.get(cacheKey)
    if (cached) {
      setModulos(cached.modulos)
      setCategorias(cached.categorias)
      setResponsables(cached.responsables)
      setUjieresCongregacion(cached.ujieresCongregacion ?? [])
      if (cached.captureRules) setCaptureRules(cached.captureRules)
      setRegistros(cached.registros)
      setCanCapture(cached.canCapture)
      setLoadingPermission(false)
      setLoadingData(false)
    } else {
      setLoadingData(true)
      setLoadingPermission(true)
    }
    Promise.all([
      supabase.from('modulos').select('id, nombre_modulo, requiere_zona').eq('congregacion_id', congregacionId).eq('activo', true),
      supabase.from('categorias_demograficas').select('id, nombre').eq('congregacion_id', congregacionId).order('orden'),
      supabase.from('personas').select('id, nombres, apellidos').eq('congregacion_id', congregacionId).eq('estado_membresia', 'activo'),
      supabase.from('ujieres_congregacion').select('id, nombre').eq('congregacion_id', congregacionId).eq('activo', true).order('nombre'),
      supabase.rpc('tiene_permiso', { p_congregacion_id: congregacionId, p_permiso: 'estadisticas.registrar' }),
      supabase.rpc('tiene_permiso', { p_congregacion_id: congregacionId, p_permiso: 'feligresia.editar' }),
      supabase.from('configuracion_congregacion').select('exigir_responsable, exigir_novedades').eq('congregacion_id', congregacionId).maybeSingle(),
      supabase.from('registros_actividad').select('id, fecha, modulo_id, tipo_actividad_id, zona_id, total_asistentes, tipos_actividad(nombre), personas:responsable_persona_id(nombres, apellidos), ujieres_congregacion:ujier_responsable_id(nombre)').eq('congregacion_id', congregacionId).order('fecha', { ascending: false }).limit(10),
    ]).then(([modulosResult, categoriasResult, responsablesResult, ujieresResult, capture, admin, configResult, registrosResult]) => {
      const failed = [modulosResult, categoriasResult, responsablesResult, ujieresResult, capture, admin, configResult, registrosResult].find((result) => result.error)
      if (failed) setError(t('registrarAsistencia.errorCargarTodo'))
      const newModulos = modulosResult.data ?? []
      const newCategorias = categoriasResult.data ?? []
      const newResponsables = responsablesResult.data ?? []
      const newUjieres = ujieresResult.data ?? []
      const newCaptureRules = configResult.data || null
      const newRegistros = registrosResult.data ?? []
      const newCanCapture = Boolean(capture.data || admin.data)
      setModulos(newModulos)
      setCategorias(newCategorias)
      setResponsables(newResponsables)
      setUjieresCongregacion(newUjieres)
      if (newCaptureRules) setCaptureRules(newCaptureRules)
      setRegistros(newRegistros)
      setCanCapture(newCanCapture)
      setLoadingPermission(false)
      setLoadingData(false)
      registrarAsistenciaCache.set(cacheKey, {
        modulos: newModulos,
        categorias: newCategorias,
        responsables: newResponsables,
        ujieresCongregacion: newUjieres,
        captureRules: newCaptureRules,
        registros: newRegistros,
        canCapture: newCanCapture,
      })
    }).catch(() => {
      setError(t('registrarAsistencia.errorCargarInfo'))
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
      setTipoId('')
      setResponsableId('')
  }, [moduloId])

  const moduloSeleccionado = modulos.find((item) => item.id === moduloId)
  const esModuloUjieres = moduloSeleccionado?.nombre_modulo?.trim().toLowerCase() === 'ujieres'

  async function loadRegistros() {
    const { data } = await supabase
      .from('registros_actividad')
      .select('id, fecha, modulo_id, tipo_actividad_id, zona_id, total_asistentes, tipos_actividad(nombre), personas:responsable_persona_id(nombres, apellidos), ujieres_congregacion:ujier_responsable_id(nombre)')
      .eq('congregacion_id', congregacionId)
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
    if ((captureRules.exigir_responsable && !responsableId) || total <= 0) { setError(`${captureRules.exigir_responsable ? t('registrarAsistencia.errorEligeResponsable') : ''}${t('registrarAsistencia.errorIngresaAsistente')}`); return }
    if (captureRules.exigir_novedades && !novedades.trim()) { setError(t('registrarAsistencia.errorNovedades')); return }
    if (modulo?.requiere_zona && !zonaId) { setError(t('registrarAsistencia.errorZona')); return }
    setError(null)
    setSaving(true)

    let duplicateQuery = supabase.from('registros_actividad').select('id', { count: 'exact', head: true }).eq('congregacion_id', congregacionId).eq('fecha', fecha).eq('modulo_id', moduloId).eq('tipo_actividad_id', tipoId)
    duplicateQuery = zonaId ? duplicateQuery.eq('zona_id', zonaId) : duplicateQuery.is('zona_id', null)
    const { count: duplicateCount, error: duplicateError } = await duplicateQuery
    if (duplicateError) { setSaving(false); setError(t('registrarAsistencia.errorVerificarDuplicado')); return }
    if (duplicateCount > 0 && !window.confirm(t('registrarAsistencia.confirmarDuplicado'))) { setSaving(false); return }

    let result
    try {
      result = await withRequestTimeout(supabase.from('registros_actividad').insert({
        congregacion_id: congregacionId,
        modulo_id: moduloId,
        tipo_actividad_id: tipoId,
        zona_id: zonaId || null,
        responsable_persona_id: esModuloUjieres ? null : (responsableId || null),
        ujier_responsable_id: esModuloUjieres ? (responsableId || null) : null,
        fecha,
        novedades,
        origen_captura: 'web',
        motivo_captura: motivoCaptura,
        desglose: conteos,
      }))
    } catch (requestError) { setSaving(false); setError(t('registrarAsistencia.errorGuardar')); return }
    setSaving(false)
    const { error } = result
    if (error) { setError(t('registrarAsistencia.errorGuardar')); return }
    setOk(true)
    setConteos({})
    setNovedades('')
    setMotivoCaptura('')
    loadRegistros()
    setTimeout(() => setOk(false), 3000)
  }

  if (loadingRol || loadingPermission || loadingData) return <div className="module-loading" role="status"><span className="loading-dot" />{t('registrarAsistencia.preparando')}</div>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium">{t('registrarAsistencia.titulo')}</h1>
        <p className="text-sm text-secondary mt-0.5">{t('registrarAsistencia.subtitulo')}</p>
      </div>

      {!canCapture && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{t('registrarAsistencia.sinPermiso')}</p>}

      <form onSubmit={handleSubmit} className="card p-5 max-w-lg flex flex-col gap-3.5">
        <label className="text-sm text-secondary">{t('registrarAsistencia.fechaActividad')}<input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input-field mt-1" /></label>
        {modulos.length === 0 && <p className="text-sm text-warning bg-warning-bg rounded p-3">{t('registrarAsistencia.sinModulos')}</p>}
        {categorias.length === 0 && <p className="text-sm text-warning bg-warning-bg rounded p-3">{t('registrarAsistencia.sinCategorias')}</p>}

        <div>
          <label className="text-sm text-secondary block mb-1">{t('registrarAsistencia.modulo')}</label>
          <select value={moduloId} onChange={(e) => setModuloId(e.target.value)} className="input-field" required>
            <option value="">{t('registrarAsistencia.seleccionaModulo')}</option>
            {modulos.map((m) => <option key={m.id} value={m.id}>{m.nombre_modulo}</option>)}
          </select>
        </div>

        {modulos.find((modulo) => modulo.id === moduloId)?.requiere_zona && <div><label className="text-sm text-secondary block mb-1">{t('registrarAsistencia.barrioZona')}</label><select required value={zonaId} onChange={(e) => setZonaId(e.target.value)} className="input-field"><option value="">{t('registrarAsistencia.seleccionaZona')}</option>{zonas.map((zona) => <option key={zona.id} value={zona.id}>{zona.nombre}</option>)}</select></div>}

        <div>
          <label className="text-sm text-secondary block mb-1">{t('registrarAsistencia.tipoActividad')}</label>
          <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="input-field" required disabled={!moduloId}>
            <option value="">{t('registrarAsistencia.seleccionaActividad')}</option>
            {tipos.map((t2) => <option key={t2.id} value={t2.id}>{t2.nombre}{t2.caracter ? ` — ${t2.caracter}` : ''}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-secondary mb-1 flex items-center gap-1">
            {t('registrarAsistencia.responsableAsistencia')}{captureRules.exigir_responsable ? '' : t('registrarAsistencia.opcional')}
            <InfoTip texto={t('registrarAsistencia.responsableTip')} />
          </label>
          <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className="input-field w-full" required={captureRules.exigir_responsable}>
            <option value="">{t('registrarAsistencia.seleccionaResponsable')}</option>
            {esModuloUjieres
              ? ujieresCongregacion.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)
              : responsables.map((p) => <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>)}
          </select>
          {esModuloUjieres && ujieresCongregacion.length === 0 && <p className="text-xs text-muted mt-1">{t('registrarAsistencia.sinUjieres')}</p>}
        </div>

        <div>
          <label className="text-sm text-secondary block mb-2">{t('registrarAsistencia.asistenciaPorCategoria')}</label>
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
          <label className="text-sm text-secondary block mb-1">{t('registrarAsistencia.novedades')}{captureRules.exigir_novedades ? '' : t('registrarAsistencia.opcional')}</label>
          <textarea required={captureRules.exigir_novedades} value={novedades} onChange={(e) => setNovedades(e.target.value)} className="input-field" rows={2} placeholder={t('registrarAsistencia.placeholderSinNovedades')} />
        </div>

        <div>
          <label className="text-sm text-secondary mb-1 flex items-center gap-1">
            {t('registrarAsistencia.motivoCorreccion')}
            <InfoTip texto={t('registrarAsistencia.motivoTip')} />
          </label>
          <textarea required value={motivoCaptura} onChange={(e) => setMotivoCaptura(e.target.value)} className="input-field" rows={2} placeholder={t('registrarAsistencia.motivoPlaceholder')} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {ok && <p className="text-sm text-success">{t('registrarAsistencia.correccionGuardada')}</p>}

        <div className="flex items-center justify-between gap-3 rounded-card border border-accent/20 bg-accent-bg px-3 py-2.5">
          <div><p className="text-[10px] uppercase tracking-[0.14em] text-accent-dark">{t('registrarAsistencia.totalARegistrar')}</p><p className="text-xs text-secondary mt-0.5">{t('registrarAsistencia.sumaCategorias')}</p></div>
          <strong className="text-2xl text-accent-dark">{totalPreview}</strong>
        </div>

        <button type="submit" disabled={saving || !canCapture} className="btn-primary justify-center">
          {saving ? t('registrarAsistencia.guardando') : t('registrarAsistencia.guardarCorreccion')}
        </button>
      </form>

      <div>
        <h3 className="font-medium mb-3">{t('registrarAsistencia.registrosRecientes')}</h3>
        <div className="table-scroll">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-muted text-left">
              <th className="font-normal py-1.5">{t('registrarAsistencia.colFecha')}</th>
              <th className="font-normal py-1.5">{t('registrarAsistencia.colActividad')}</th>
              <th className="font-normal py-1.5">{t('registrarAsistencia.colResponsable')}</th>
              <th className="font-normal py-1.5">{t('registrarAsistencia.colTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2">{r.fecha}</td>
                <td className="py-2">{r.tipos_actividad?.nombre}</td>
                <td className="py-2">{r.personas ? `${r.personas.nombres} ${r.personas.apellidos}` : r.ujieres_congregacion ? r.ujieres_congregacion.nombre : '—'}</td>
                <td className="py-2">{r.total_asistentes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
