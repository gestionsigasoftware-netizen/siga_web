import { useEffect, useRef, useState } from 'react'
import { Search, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

export default function EquipoCongregacion() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const isPastor = rolPrincipal?.nivel === 'local' && (!rolPrincipal.rol_local || rolPrincipal.rol_local === 'pastor')
  const [people, setPeople] = useState([])
  const [profiles, setProfiles] = useState([])
  const [modules, setModules] = useState([])
  const [assignments, setAssignments] = useState([])
  const [personId, setPersonId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [moduleId, setModuleId] = useState('')
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
      setMessage({ type: 'error', text: 'Tu usuario no tiene una congregación local asignada.' })
      return
    }
    setLoading(true)
    setMessage((current) => (current?.text === 'Tu usuario no tiene una congregación local asignada.' ? null : current))
    const [peopleResult, profilesResult, modulesResult, assignmentsResult] = await Promise.all([
      supabase.from('personas').select('id, nombres, apellidos, auth_user_id').eq('congregacion_id', congregacionId).order('nombres'),
      supabase.from('perfiles_acceso').select('id, codigo, nombre, descripcion').order('nombre'),
      supabase.from('modulos').select('id, nombre_modulo, activo').eq('congregacion_id', congregacionId).eq('activo', true).order('created_at'),
      supabase.from('asignaciones_acceso').select('id, persona_id, perfil_id, fecha_inicio').eq('congregacion_id', congregacionId).is('fecha_fin', null).order('created_at', { ascending: false }),
    ])
    const failed = [peopleResult, profilesResult, modulesResult, assignmentsResult].find((result) => result.error)
    if (failed) setMessage({ type: 'error', text: 'No se pudo cargar el equipo de trabajo. Intenta nuevamente o contacta al administrador.' })
    const loadedPeople = peopleResult.data ?? []
    const loadedProfiles = profilesResult.data ?? []
    const peopleById = new Map(loadedPeople.map((person) => [person.id, person]))
    const profilesById = new Map(loadedProfiles.map((profile) => [profile.id, profile]))
    setPeople(loadedPeople)
    setProfiles(loadedProfiles)
    setModules(modulesResult.data ?? [])
    setAssignments((assignmentsResult.data ?? []).map((assignment) => ({ ...assignment, personas: peopleById.get(assignment.persona_id), perfiles_acceso: profilesById.get(assignment.perfil_id) })))
    setLoading(false)
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

  async function inviteUser(event) {
    event.preventDefault()
    if (!personId) {
      setMessage({ type: 'error', text: 'Busca y selecciona una persona del censo.' })
      return
    }
    if (!email.trim() || (!profileId && !moduleId)) {
      setMessage({ type: 'error', text: 'Escribe el correo y selecciona al menos un tipo de acceso.' })
      return
    }
    if (profileId && assignedProfileKeys.has(`${personId}:${profileId}`) && !moduleId) {
      setMessage({ type: 'error', text: 'Esta persona ya tiene ese perfil activo.' })
      return
    }
    setSaving(true)
    setMessage(null)
    const { data, error } = await supabase.functions.invoke('invitar-usuario', {
      body: { personId, profileId, moduleId, congregacionId, email: email.trim() },
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
          ? 'El servicio de invitaciones no está disponible. Contacta al administrador.'
          : rateLimited
            ? 'Se alcanzó el límite temporal de invitaciones. Espera antes de volver a intentarlo.'
          : 'No se pudo enviar la invitación. Intenta nuevamente o contacta al administrador.',
      })
      return
    }
    if (!data?.ok) {
      setMessage({ type: 'error', text: 'La invitacion no pudo confirmarse.' })
      return
    }
    setPersonId('')
    setPersonSearchTerm('')
    setProfileId('')
    setModuleId('')
    setEmail('')
    setMessage({
      type: 'success',
      text: data.invitationSent
        ? 'Invitacion enviada. La persona recibira un enlace para crear su contrasena.'
        : 'Cuenta existente vinculada. La persona puede ingresar con sus credenciales actuales.',
    })
    load()
  }

  async function endAssignment(assignment) {
    if (!window.confirm(`Retirar el perfil de ${assignment.personas?.nombres || 'esta persona'}?`)) return
    setBusyAssignmentId(assignment.id)
    const result = await supabase.from('asignaciones_acceso').update({ fecha_fin: new Date().toISOString().slice(0, 10) }).eq('id', assignment.id).eq('congregacion_id', congregacionId)
    setBusyAssignmentId(null)
    if (result.error) { setMessage({ type: 'error', text: 'No se pudo retirar el perfil.' }); return }
    setMessage({ type: 'success', text: 'Perfil retirado. El historial se conserva.' })
    load()
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando equipo de trabajo...</div>
  if (!isPastor) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Solo el pastor puede administrar el equipo de la congregacion.</p>

  return (
    <div className="page-shell">
      <header><p className="eyebrow">Administración local</p><h1 className="section-title">Equipo de trabajo</h1><p className="text-sm text-secondary mt-1">Administra en un solo lugar quiénes pueden consultar SIGAP y qué responsabilidades tienen asignadas.</p></header>
      {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`text-sm rounded p-3 ${message.type === 'error' ? 'text-danger bg-danger-bg' : 'text-success bg-success-bg'}`}>{message.text}</p>}
      <section className="grid sm:grid-cols-3 gap-3">
        <div className="stat-tile"><div className="flex items-center gap-2 text-secondary"><Users className="w-4 h-4" /><span className="text-[10px] uppercase tracking-[0.14em]">Personas con acceso</span></div><p className="text-2xl font-semibold mt-3">{peopleWithProfiles}</p></div>
        <div className="stat-tile"><div className="flex items-center gap-2 text-secondary"><ShieldCheck className="w-4 h-4" /><span className="text-[10px] uppercase tracking-[0.14em]">Perfiles activos</span></div><p className="text-2xl font-semibold mt-3">{assignments.length}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Personas disponibles</p><p className="text-2xl font-semibold mt-3">{people.length - peopleWithProfiles}</p></div>
      </section>
      <section className="card p-5"><h2 className="font-medium">Agregar o actualizar acceso</h2><p className="text-sm text-secondary mt-1 mb-4">Selecciona la persona y asígnale el perfil y las responsabilidades que necesita para realizar su trabajo.</p>
      <form onSubmit={inviteUser} className="grid md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end">
        <div className="text-sm relative" ref={personFieldRef}>
          Persona
          <input
            className="input-field mt-1.5"
            placeholder="Escribe un nombre..."
            value={personSearchTerm}
            onChange={(event) => { setPersonSearchTerm(event.target.value); setPersonId(''); setPersonDropdownOpen(true) }}
            onFocus={() => setPersonDropdownOpen(true)}
          />
          {personDropdownOpen && (
            <div className="absolute z-20 mt-1 w-full bg-surface-2 border border-border rounded-card shadow-lg max-h-56 overflow-y-auto">
              {personasParaAsignar.length === 0 ? <p className="p-3 text-xs text-muted">Sin resultados.</p> : personasParaAsignar.map((person) => (
                <button type="button" key={person.id} onClick={() => { setPersonId(person.id); setPersonSearchTerm(`${person.nombres} ${person.apellidos}`); setPersonDropdownOpen(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-1 border-b border-border last:border-0">
                  {person.nombres} {person.apellidos}{person.auth_user_id ? ' (cuenta vinculada)' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="text-sm">Correo de acceso<input required type="email" className="input-field mt-1.5" placeholder="persona@correo.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="text-sm">Acceso web <span className="text-xs text-muted">(opcional)</span><select className="input-field mt-1.5" value={profileId} onChange={(event) => setProfileId(event.target.value)}><option value="">Sin acceso web</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nombre}</option>)}</select></label>
        <label className="text-sm">Responsabilidad operativa <span className="text-xs text-muted">(opcional)</span><select className="input-field mt-1.5" value={moduleId} onChange={(event) => setModuleId(event.target.value)}><option value="">Sin responsabilidad adicional</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.nombre_modulo}</option>)}</select></label>
        <button disabled={saving} className="btn-primary"><UserPlus className="w-4 h-4" />{saving ? 'Enviando...' : 'Invitar usuario'}</button>
      </form>
      </section>
      <p className="text-xs text-secondary">La persona recibira un enlace seguro para establecer su contrasena. No se crea ninguna contrasena desde SIGAP.</p>
      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-medium">Perfiles activos</h2><p className="text-sm text-secondary mt-1">Personas con acceso en esta congregacion.</p></div><div className="flex items-center gap-2 border border-border rounded px-3 py-2 w-full sm:w-64"><Search className="w-4 h-4 text-muted" /><input aria-label="Buscar integrantes del equipo" className="bg-transparent outline-none text-sm w-full" placeholder="Buscar integrante..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div></div>
        {assignments.length ? <div className="divide-y divide-border">{assignments.filter((assignment) => !searchTerm || `${assignment.personas?.nombres || ''} ${assignment.personas?.apellidos || ''}`.toLowerCase().includes(searchTerm.toLowerCase())).map((assignment) => <div key={assignment.id} className="p-4 flex items-center justify-between gap-3 hover:bg-surface-1 transition-colors"><div><p className="text-sm font-medium">{assignment.personas?.nombres} {assignment.personas?.apellidos}</p><p className="text-xs text-secondary mt-1">{assignment.perfiles_acceso?.nombre} · Desde {assignment.fecha_inicio}</p></div><button type="button" disabled={Boolean(busyAssignmentId)} onClick={() => endAssignment(assignment)} className="text-xs text-danger disabled:opacity-50">{busyAssignmentId === assignment.id ? 'Retirando...' : 'Retirar perfil'}</button></div>)}</div> : <p className="p-8 text-sm text-muted">Aun no hay perfiles adicionales asignados.</p>}
      </section>
    </div>
  )
}
