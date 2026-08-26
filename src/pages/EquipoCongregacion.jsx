import { useEffect, useState } from 'react'
import { Search, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

export default function EquipoCongregacion() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const isPastor = rolPrincipal?.nivel === 'local' && (!rolPrincipal.rol_local || rolPrincipal.rol_local === 'pastor')
  const [people, setPeople] = useState([])
  const [profiles, setProfiles] = useState([])
  const [assignments, setAssignments] = useState([])
  const [personId, setPersonId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyAssignmentId, setBusyAssignmentId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [message, setMessage] = useState(null)

  async function load() {
    if (!congregacionId) return
    setLoading(true)
    const [peopleResult, profilesResult, assignmentsResult] = await Promise.all([
      supabase.from('personas').select('id, nombres, apellidos').eq('congregacion_id', congregacionId).order('nombres'),
      supabase.from('perfiles_acceso').select('id, codigo, nombre, descripcion').order('nombre'),
      supabase.from('asignaciones_acceso').select('id, persona_id, perfil_id, fecha_inicio').eq('congregacion_id', congregacionId).is('fecha_fin', null).order('created_at', { ascending: false }),
    ])
    const failed = [peopleResult, profilesResult, assignmentsResult].find((result) => result.error)
    if (failed) setMessage({ type: 'error', text: `No se pudo cargar el equipo de trabajo: ${failed.error.message}` })
    const loadedPeople = peopleResult.data ?? []
    const loadedProfiles = profilesResult.data ?? []
    const peopleById = new Map(loadedPeople.map((person) => [person.id, person]))
    const profilesById = new Map(loadedProfiles.map((profile) => [profile.id, profile]))
    setPeople(loadedPeople)
    setProfiles(loadedProfiles)
    setAssignments((assignmentsResult.data ?? []).map((assignment) => ({ ...assignment, personas: peopleById.get(assignment.persona_id), perfiles_acceso: profilesById.get(assignment.perfil_id) })))
    setLoading(false)
  }

  useEffect(() => { load() }, [congregacionId])

  const assignedProfileKeys = new Set(assignments.map((assignment) => `${assignment.persona_id}:${assignment.perfil_id}`))
  const filteredPeople = people.filter((person) => `${person.nombres} ${person.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase()))
  const peopleWithProfiles = new Set(assignments.map((assignment) => assignment.persona_id)).size

  async function assignProfile(event) {
    event.preventDefault()
    if (!personId || !profileId) return
    if (assignedProfileKeys.has(`${personId}:${profileId}`)) { setMessage({ type: 'error', text: 'Esta persona ya tiene ese perfil activo.' }); return }
    setSaving(true); setMessage(null)
    const result = await supabase.from('asignaciones_acceso').insert({ persona_id: personId, congregacion_id: congregacionId, perfil_id: profileId })
    setSaving(false)
    if (result.error) { setMessage({ type: 'error', text: result.error.code === '23505' ? 'Esta persona ya tiene ese perfil activo.' : `No se pudo asignar el perfil: ${result.error.message}` }); return }
    setPersonId(''); setProfileId(''); setMessage({ type: 'success', text: 'Perfil asignado correctamente.' }); load()
  }

  async function endAssignment(assignment) {
    if (!window.confirm(`¿Retirar el perfil de ${assignment.personas?.nombres || 'esta persona'}?`)) return
    setBusyAssignmentId(assignment.id)
    const result = await supabase.from('asignaciones_acceso').update({ fecha_fin: new Date().toISOString().slice(0, 10) }).eq('id', assignment.id).eq('congregacion_id', congregacionId)
    setBusyAssignmentId(null)
    if (result.error) { setMessage({ type: 'error', text: 'No se pudo retirar el perfil.' }); return }
    setMessage({ type: 'success', text: 'Perfil retirado. El historial se conserva.' }); load()
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando equipo de trabajo...</div>
  if (!isPastor) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Solo el pastor puede administrar el equipo de la congregación.</p>

  return <div className="page-shell"><header><p className="eyebrow">Administración local</p><h1 className="section-title">Equipo de trabajo</h1><p className="text-sm text-secondary mt-1">Asigna perfiles de acceso sin crear nuevos niveles jerárquicos.</p></header>{message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`text-sm rounded p-3 ${message.type === 'error' ? 'text-danger bg-danger-bg' : 'text-success bg-success-bg'}`}>{message.text}</p>}<section className="grid sm:grid-cols-3 gap-3"><div className="stat-tile"><div className="flex items-center gap-2 text-secondary"><Users className="w-4 h-4" /><span className="text-[10px] uppercase tracking-[0.14em]">Personas con acceso</span></div><p className="text-2xl font-semibold mt-3">{peopleWithProfiles}</p></div><div className="stat-tile"><div className="flex items-center gap-2 text-secondary"><ShieldCheck className="w-4 h-4" /><span className="text-[10px] uppercase tracking-[0.14em]">Perfiles activos</span></div><p className="text-2xl font-semibold mt-3">{assignments.length}</p></div><div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">Personas disponibles</p><p className="text-2xl font-semibold mt-3">{people.length - peopleWithProfiles}</p></div></section><form onSubmit={assignProfile} className="card p-5 grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end"><label className="text-sm">Persona<select required className="input-field mt-1.5" value={personId} onChange={(event) => setPersonId(event.target.value)}><option value="">Seleccionar persona...</option>{filteredPeople.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select></label><label className="text-sm">Perfil<select required className="input-field mt-1.5" value={profileId} onChange={(event) => setProfileId(event.target.value)}><option value="">Seleccionar perfil...</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nombre}</option>)}</select></label><button disabled={saving} className="btn-primary"><UserPlus className="w-4 h-4" /> {saving ? 'Asignando...' : 'Asignar perfil'}</button></form><section className="card overflow-hidden"><div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-medium">Perfiles activos</h2><p className="text-sm text-secondary mt-1">Personas con acceso adicional en esta congregación.</p></div><div className="flex items-center gap-2 border border-border rounded px-3 py-2 w-full sm:w-64"><Search className="w-4 h-4 text-muted" /><input aria-label="Buscar integrantes del equipo" className="bg-transparent outline-none text-sm w-full" placeholder="Buscar integrante..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div></div>{assignments.length ? <div className="divide-y divide-border">{assignments.filter((assignment) => !searchTerm || `${assignment.personas?.nombres || ''} ${assignment.personas?.apellidos || ''}`.toLowerCase().includes(searchTerm.toLowerCase())).map((assignment) => <div key={assignment.id} className="p-4 flex items-center justify-between gap-3 hover:bg-surface-1 transition-colors"><div><p className="text-sm font-medium">{assignment.personas?.nombres} {assignment.personas?.apellidos}</p><p className="text-xs text-secondary mt-1">{assignment.perfiles_acceso?.nombre} · Desde {assignment.fecha_inicio}</p></div><button type="button" disabled={Boolean(busyAssignmentId)} onClick={() => endAssignment(assignment)} className="text-xs text-danger disabled:opacity-50">{busyAssignmentId === assignment.id ? 'Retirando...' : 'Retirar perfil'}</button></div>)}</div> : <p className="p-8 text-sm text-muted">Aún no hay perfiles adicionales asignados.</p>}</section></div>
}
