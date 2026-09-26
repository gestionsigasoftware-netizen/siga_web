import { useEffect, useRef, useState } from 'react'
import { Search, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { hoyBogota } from "../lib/fechaBogota";
import { useMiRol } from '../hooks/useMiRol'
import InfoTip from '../components/InfoTip'

const esModuloCarcelaria = (nombreModulo) => /carcelari/i.test(nombreModulo || '')

const equipoCongregacionCache = new Map()

export default function EquipoCongregacion() {
  const { t } = useTranslation()
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const isPastor = rolPrincipal?.nivel === 'local' && (!rolPrincipal.rol_local || rolPrincipal.rol_local === 'pastor')
  const [people, setPeople] = useState([])
  const [profiles, setProfiles] = useState([])
  const [modules, setModules] = useState([])
  const [zonas, setZonas] = useState([])
  const [centros, setCentros] = useState([])
  const [assignments, setAssignments] = useState([])
  const [cargoAssignments, setCargoAssignments] = useState([])
  const [busyCargoAssignmentId, setBusyCargoAssignmentId] = useState(null)
  const [personId, setPersonId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [zonaId, setZonaId] = useState('')
  const [centroId, setCentroId] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyAssignmentId, setBusyAssignmentId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [message, setMessage] = useState(null)
  const [personSearchTerm, setPersonSearchTerm] = useState('')
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false)
  const personFieldRef = useRef(null)

  async function load() {
    if (!congregacionId) {
      setLoading(false)
      setMessage({ type: 'error', text: t('equipoCongregacion.sinCongregacion') })
      return
    }
    const cacheKey = congregacionId
    const cached = equipoCongregacionCache.get(cacheKey)
    if (cached) {
      setPeople(cached.people)
      setProfiles(cached.profiles)
      setModules(cached.modules)
      setZonas(cached.zonas)
      setCentros(cached.centros)
      setAssignments(cached.assignments)
      setCargoAssignments(cached.cargoAssignments)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setMessage((current) => (current?.text === t('equipoCongregacion.sinCongregacion') ? null : current))
    const { data: congregacion } = await supabase.from('congregaciones').select('distrito_id').eq('id', congregacionId).single()
    const [peopleResult, profilesResult, modulesResult, zonasResult, centrosResult, assignmentsResult, cargoAssignmentsResult] = await Promise.all([
      supabase.from('personas').select('id, nombres, apellidos, auth_user_id').eq('congregacion_id', congregacionId).order('nombres'),
      supabase.from('perfiles_acceso').select('id, codigo, nombre, descripcion').order('nombre'),
      supabase.from('modulos').select('id, nombre_modulo, activo, requiere_zona').eq('congregacion_id', congregacionId).eq('activo', true).order('created_at'),
      supabase.from('zonas').select('id, nombre').eq('congregacion_id', congregacionId).order('nombre'),
      congregacion?.distrito_id ? supabase.from('centros_reclusion').select('id, nombre').eq('distrito_id', congregacion.distrito_id).eq('activo', true).order('nombre') : Promise.resolve({ data: [] }),
      supabase.from('asignaciones_acceso').select('id, persona_id, perfil_id, fecha_inicio').eq('congregacion_id', congregacionId).is('fecha_fin', null).order('created_at', { ascending: false }),
      supabase.from('asignaciones_cargo').select('id, persona_id, fecha_inicio, zonas(nombre), centros_reclusion(nombre), cargos!inner(nombre_cargo, modulos!inner(nombre_modulo, congregacion_id))').eq('cargos.modulos.congregacion_id', congregacionId).is('fecha_fin', null).order('fecha_inicio', { ascending: false }),
    ])
    const failed = [peopleResult, profilesResult, modulesResult, zonasResult, centrosResult, assignmentsResult, cargoAssignmentsResult].find((result) => result.error)
    if (failed) setMessage({ type: 'error', text: t('equipoCongregacion.errorCargar') })
    const loadedPeople = peopleResult.data ?? []
    const loadedProfiles = profilesResult.data ?? []
    const peopleById = new Map(loadedPeople.map((person) => [person.id, person]))
    const profilesById = new Map(loadedProfiles.map((profile) => [profile.id, profile]))
    const newModules = modulesResult.data ?? []
    const newZonas = zonasResult.data ?? []
    const newCentros = centrosResult.data ?? []
    const newAssignments = (assignmentsResult.data ?? []).map((assignment) => ({ ...assignment, personas: peopleById.get(assignment.persona_id), perfiles_acceso: profilesById.get(assignment.perfil_id) }))
    const newCargoAssignments = (cargoAssignmentsResult.data ?? []).map((assignment) => ({ ...assignment, personas: peopleById.get(assignment.persona_id) }))
    setPeople(loadedPeople)
    setProfiles(loadedProfiles)
    setModules(newModules)
    setZonas(newZonas)
    setCentros(newCentros)
    setAssignments(newAssignments)
    setCargoAssignments(newCargoAssignments)
    setLoading(false)
    equipoCongregacionCache.set(cacheKey, {
      people: loadedPeople,
      profiles: loadedProfiles,
      modules: newModules,
      zonas: newZonas,
      centros: newCentros,
      assignments: newAssignments,
      cargoAssignments: newCargoAssignments,
    })
  }

  useEffect(() => { load() }, [congregacionId])

  useEffect(() => {
    if (!message || message.type !== 'success') return undefined
    const timer = setTimeout(() => setMessage(null), 4500)
    return () => clearTimeout(timer)
  }, [message])

  useEffect(() => {
    function handleClickOutside(event) {
      if (personFieldRef.current && !personFieldRef.current.contains(event.target)) setPersonDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const assignedProfileKeys = new Set(assignments.map((assignment) => `${assignment.persona_id}:${assignment.perfil_id}`))
  const personasParaAsignar = people.filter((person) => `${person.nombres} ${person.apellidos}`.toLowerCase().includes(personSearchTerm.toLowerCase()))
  const peopleWithProfiles = new Set(assignments.map((assignment) => assignment.persona_id)).size
  const moduloSeleccionado = modules.find((module) => module.id === moduleId)
  const pideZona = Boolean(moduloSeleccionado?.requiere_zona)
  const pideCentro = esModuloCarcelaria(moduloSeleccionado?.nombre_modulo)

  async function inviteUser(event) {
    event.preventDefault()
    if (!personId) {
      setMessage({ type: 'error', text: t('equipoCongregacion.errorSeleccionaPersona') })
      return
    }
    if (!email.trim() || (!profileId && !moduleId)) {
      setMessage({ type: 'error', text: t('equipoCongregacion.errorCorreoTipoAcceso') })
      return
    }
    if (profileId && assignedProfileKeys.has(`${personId}:${profileId}`) && !moduleId) {
      setMessage({ type: 'error', text: t('equipoCongregacion.errorPerfilExistente') })
      return
    }
    if (pideZona && !zonaId) {
      setMessage({ type: 'error', text: t('equipoCongregacion.errorFaltaZona') })
      return
    }
    if (pideCentro && !centroId) {
      setMessage({ type: 'error', text: t('equipoCongregacion.errorFaltaCentro') })
      return
    }
    setSaving(true)
    setMessage(null)
    const { data, error } = await supabase.functions.invoke('invitar-usuario', {
      body: { personId, profileId, moduleId, congregacionId, email: email.trim(), zonaId: pideZona ? zonaId : null, centroId: pideCentro ? centroId : null },
    })
    setSaving(false)
    if (error) {
      const functionUnavailable = error.message?.toLowerCase().includes('failed to send a request')
      let serverMessage = ''
      if (error.context) {
        try {
          const body = await error.context.json()
          serverMessage = body?.error || ''
        } catch { /* La respuesta puede no tener JSON. */ }
      }
      const rateLimited = `${serverMessage} ${error.message}`.toLowerCase().includes('rate limit')
      setMessage({
        type: 'error',
        text: functionUnavailable
          ? t('equipoCongregacion.errorServicioNoDisponible')
          : rateLimited
            ? t('equipoCongregacion.errorRateLimit')
          : t('equipoCongregacion.errorEnviarInvitacion'),
      })
      return
    }
    if (!data?.ok) {
      setMessage({ type: 'error', text: t('equipoCongregacion.errorInvitacionNoConfirmada') })
      return
    }
    setPersonId('')
    setPersonSearchTerm('')
    setProfileId('')
    setModuleId('')
    setZonaId('')
    setCentroId('')
    setEmail('')
    setMessage({
      type: 'success',
      text: data.invitationSent
        ? t('equipoCongregacion.invitacionEnviada')
        : t('equipoCongregacion.cuentaVinculada'),
    })
    load()
  }

  async function endAssignment(assignment) {
    if (!window.confirm(t('equipoCongregacion.confirmarRetirarPerfil', { nombre: assignment.personas?.nombres || t('equipoCongregacion.estaPersona') }))) return
    setBusyAssignmentId(assignment.id)
    const result = await supabase.from('asignaciones_acceso').update({ fecha_fin: hoyBogota() }).eq('id', assignment.id).eq('congregacion_id', congregacionId)
    setBusyAssignmentId(null)
    if (result.error) { setMessage({ type: 'error', text: t('equipoCongregacion.errorRetirarPerfil') }); return }
    setMessage({ type: 'success', text: t('equipoCongregacion.perfilRetirado') })
    load()
  }

  async function endCargoAssignment(assignment) {
    if (!window.confirm(t('equipoCongregacion.confirmarRetirarCargo', { modulo: assignment.cargos?.modulos?.nombre_modulo || t('equipoCongregacion.esteModulo'), nombre: assignment.personas?.nombres || t('equipoCongregacion.estaPersona') }))) return
    setBusyCargoAssignmentId(assignment.id)
    const result = await supabase.from('asignaciones_cargo').update({ fecha_fin: hoyBogota() }).eq('id', assignment.id)
    setBusyCargoAssignmentId(null)
    if (result.error) { setMessage({ type: 'error', text: t('equipoCongregacion.errorRetirarCargo') }); return }
    setMessage({ type: 'success', text: t('equipoCongregacion.cargoRetirado') })
    load()
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('equipoCongregacion.cargando')}</div>
  if (!isPastor) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{t('equipoCongregacion.soloPastor')}</p>

  return (
    <div className="page-shell">
      <header><p className="eyebrow">{t('equipoCongregacion.eyebrow')}</p><h1 className="section-title">{t('equipoCongregacion.titulo')}</h1><p className="text-sm text-secondary mt-1">{t('equipoCongregacion.subtitulo')}</p></header>
      {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`text-sm rounded p-3 ${message.type === 'error' ? 'text-danger bg-danger-bg' : 'text-success bg-success-bg'}`}>{message.text}</p>}
      <section className="grid sm:grid-cols-3 gap-3">
        <div className="stat-tile"><div className="flex items-center gap-2 text-secondary"><Users className="w-4 h-4" /><span className="text-[10px] uppercase tracking-[0.14em]">{t('equipoCongregacion.personasConAcceso')}</span></div><p className="text-2xl font-semibold mt-3">{peopleWithProfiles}</p></div>
        <div className="stat-tile"><div className="flex items-center gap-2 text-secondary"><ShieldCheck className="w-4 h-4" /><span className="text-[10px] uppercase tracking-[0.14em]">{t('equipoCongregacion.perfilesActivos')}</span></div><p className="text-2xl font-semibold mt-3">{assignments.length}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{t('equipoCongregacion.personasDisponibles')}</p><p className="text-2xl font-semibold mt-3">{people.length - peopleWithProfiles}</p></div>
      </section>
      <section className="card p-5"><h2 className="font-medium">{t('equipoCongregacion.agregarActualizar')}</h2><p className="text-sm text-secondary mt-1 mb-4">{t('equipoCongregacion.agregarActualizarSubtitulo')}</p>
      <form onSubmit={inviteUser} className="grid md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end">
        <div className="text-sm relative" ref={personFieldRef}>
          {t('equipoCongregacion.persona')}
          <input
            className="input-field mt-1.5"
            placeholder={t('equipoCongregacion.escribeNombre')}
            value={personSearchTerm}
            onChange={(event) => { setPersonSearchTerm(event.target.value); setPersonId(''); setPersonDropdownOpen(true) }}
            onFocus={() => setPersonDropdownOpen(true)}
          />
          {personDropdownOpen && (
            <div className="absolute z-20 mt-1 w-full bg-surface-2 border border-border rounded-card shadow-lg max-h-56 overflow-y-auto">
              {personasParaAsignar.length === 0 ? <p className="p-3 text-xs text-muted">{t('equipoCongregacion.sinResultados')}</p> : personasParaAsignar.map((person) => (
                <button type="button" key={person.id} onClick={() => { setPersonId(person.id); setPersonSearchTerm(`${person.nombres} ${person.apellidos}`); setPersonDropdownOpen(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-1 border-b border-border last:border-0">
                  {person.nombres} {person.apellidos}{person.auth_user_id ? t('equipoCongregacion.cuentaVinculadaSuffix') : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="text-sm">{t('equipoCongregacion.correoAcceso')}<input required type="email" className="input-field mt-1.5" placeholder="persona@correo.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="text-sm">
          <span className="flex items-center gap-1">{t('equipoCongregacion.accesoWeb')} <span className="text-xs text-muted">{t('equipoCongregacion.opcional')}</span><InfoTip texto={t('equipoCongregacion.accesoWebTip')} /></span>
          <select className="input-field mt-1.5 w-full" value={profileId} onChange={(event) => setProfileId(event.target.value)}><option value="">{t('equipoCongregacion.sinAccesoWeb')}</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nombre}</option>)}</select>
        </label>
        <label className="text-sm">
          <span className="flex items-center gap-1">{t('equipoCongregacion.responsabilidadOperativa')} <span className="text-xs text-muted">{t('equipoCongregacion.opcional')}</span><InfoTip texto={t('equipoCongregacion.responsabilidadOperativaTip')} /></span>
          <select className="input-field mt-1.5 w-full" value={moduleId} onChange={(event) => { setModuleId(event.target.value); setZonaId(''); setCentroId('') }}><option value="">{t('equipoCongregacion.sinResponsabilidad')}</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.nombre_modulo}</option>)}</select>
        </label>
        <button disabled={saving} className="btn-primary"><UserPlus className="w-4 h-4" />{saving ? t('equipoCongregacion.enviando') : t('equipoCongregacion.invitarUsuario')}</button>
        {pideZona && <label className="text-sm md:col-span-2">{t('equipoCongregacion.zonaResponsable')}<select required className="input-field mt-1.5" value={zonaId} onChange={(event) => setZonaId(event.target.value)}><option value="">{t('equipoCongregacion.seleccionarZona')}</option>{zonas.map((zona) => <option key={zona.id} value={zona.id}>{zona.nombre}</option>)}</select>{zonas.length === 0 && <p className="text-xs text-danger mt-1">{t('equipoCongregacion.sinZonas')}</p>}</label>}
        {pideCentro && <label className="text-sm md:col-span-2">{t('equipoCongregacion.centroResponsable')}<select required className="input-field mt-1.5" value={centroId} onChange={(event) => setCentroId(event.target.value)}><option value="">{t('equipoCongregacion.seleccionarCentro')}</option>{centros.map((centro) => <option key={centro.id} value={centro.id}>{centro.nombre}</option>)}</select>{centros.length === 0 && <p className="text-xs text-danger mt-1">{t('equipoCongregacion.sinCentros')}</p>}</label>}
      </form>
      </section>
      <p className="text-xs text-secondary">{t('equipoCongregacion.notaEnlace')}</p>
      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-medium flex items-center gap-1.5">{t('equipoCongregacion.perfilesActivosTitulo')}<InfoTip texto={t('equipoCongregacion.perfilesActivosTip')} /></h2><p className="text-sm text-secondary mt-1">{t('equipoCongregacion.personasConAccesoSubtitulo')}</p></div><div className="flex items-center gap-2 border border-border rounded px-3 py-2 w-full sm:w-64"><Search className="w-4 h-4 text-muted" /><input aria-label={t('equipoCongregacion.ariaBuscarIntegrantes')} className="bg-transparent outline-none text-sm w-full" placeholder={t('equipoCongregacion.buscarIntegrante')} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div></div>
        {assignments.length ? <div className="divide-y divide-border">{assignments.filter((assignment) => !searchTerm || `${assignment.personas?.nombres || ''} ${assignment.personas?.apellidos || ''}`.toLowerCase().includes(searchTerm.toLowerCase())).map((assignment) => <div key={assignment.id} className="p-4 flex items-center justify-between gap-3 hover:bg-surface-1 transition-colors"><div><p className="text-sm font-medium">{assignment.personas?.nombres} {assignment.personas?.apellidos}</p><p className="text-xs text-secondary mt-1">{assignment.perfiles_acceso?.nombre} · {t('equipoCongregacion.desde')} {assignment.fecha_inicio}</p></div><button type="button" disabled={Boolean(busyAssignmentId)} onClick={() => endAssignment(assignment)} className="text-xs text-danger disabled:opacity-50">{busyAssignmentId === assignment.id ? t('equipoCongregacion.retirando') : t('equipoCongregacion.retirarPerfil')}</button></div>)}</div> : <p className="p-8 text-sm text-muted">{t('equipoCongregacion.sinPerfiles')}</p>}
      </section>
      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border"><h2 className="font-medium flex items-center gap-1.5">{t('equipoCongregacion.responsabilidadesOperativas')}<InfoTip texto={t('equipoCongregacion.responsabilidadesOperativasTip')} /></h2><p className="text-sm text-secondary mt-1">{t('equipoCongregacion.responsabilidadesOperativasSubtitulo')}</p></div>
        {cargoAssignments.length ? <div className="divide-y divide-border">{cargoAssignments.filter((assignment) => !searchTerm || `${assignment.personas?.nombres || ''} ${assignment.personas?.apellidos || ''}`.toLowerCase().includes(searchTerm.toLowerCase())).map((assignment) => <div key={assignment.id} className="p-4 flex items-center justify-between gap-3 hover:bg-surface-1 transition-colors"><div><p className="text-sm font-medium">{assignment.personas?.nombres} {assignment.personas?.apellidos}</p><p className="text-xs text-secondary mt-1">{assignment.cargos?.modulos?.nombre_modulo}{assignment.zonas?.nombre ? ` — ${assignment.zonas.nombre}` : ''}{assignment.centros_reclusion?.nombre ? ` — ${assignment.centros_reclusion.nombre}` : ''} · {t('equipoCongregacion.desde')} {assignment.fecha_inicio}</p></div><button type="button" disabled={Boolean(busyCargoAssignmentId)} onClick={() => endCargoAssignment(assignment)} className="text-xs text-danger disabled:opacity-50">{busyCargoAssignmentId === assignment.id ? t('equipoCongregacion.retirando') : t('equipoCongregacion.retirar')}</button></div>)}</div> : <p className="p-8 text-sm text-muted">{t('equipoCongregacion.sinResponsabilidades')}</p>}
      </section>
    </div>
  )
}
