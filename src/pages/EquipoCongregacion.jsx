import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
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
  const [message, setMessage] = useState(null)

  async function load() {
    if (!congregacionId) return
    setLoading(true)
    const [peopleResult, profilesResult, assignmentsResult] = await Promise.all([
      supabase.from('personas').select('id, nombres, apellidos').eq('congregacion_id', congregacionId).order('nombres'),
      supabase.from('perfiles_acceso').select('id, codigo, nombre, descripcion').order('nombre'),
      supabase.from('asignaciones_acceso').select('id, persona_id, perfil_id, fecha_inicio, personas(nombres, apellidos), perfiles_acceso(nombre)').eq('congregacion_id', congregacionId).is('fecha_fin', null).order('created_at', { ascending: false }),
    ])
    if (peopleResult.error || profilesResult.error || assignmentsResult.error) setMessage({ type: 'error', text: 'No se pudo cargar el equipo de trabajo.' })
    setPeople(peopleResult.data ?? []); setProfiles(profilesResult.data ?? []); setAssignments(assignmentsResult.data ?? []); setLoading(false)
  }

  useEffect(() => { load() }, [congregacionId])

  async function assignProfile(event) {
    event.preventDefault()
    if (!personId || !profileId) return
    setSaving(true); setMessage(null)
    const result = await supabase.from('asignaciones_acceso').insert({ persona_id: personId, congregacion_id: congregacionId, perfil_id: profileId })
    setSaving(false)
    if (result.error) { setMessage({ type: 'error', text: result.error.code === '23505' ? 'Esta persona ya tiene ese perfil activo.' : `No se pudo asignar el perfil: ${result.error.message}` }); return }
    setPersonId(''); setProfileId(''); setMessage({ type: 'success', text: 'Perfil asignado correctamente.' }); load()
  }

  async function endAssignment(assignment) {
    const result = await supabase.from('asignaciones_acceso').update({ fecha_fin: new Date().toISOString().slice(0, 10) }).eq('id', assignment.id).eq('congregacion_id', congregacionId)
    if (result.error) { setMessage({ type: 'error', text: 'No se pudo retirar el perfil.' }); return }
    setMessage({ type: 'success', text: 'Perfil retirado. El historial se conserva.' }); load()
  }

  if (roleLoading || loading) return <p className="text-sm text-muted">Cargando equipo de trabajo...</p>
  if (!isPastor) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Solo el pastor puede administrar el equipo de la congregación.</p>

  return <div className="flex flex-col gap-6"><header><p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Administración local</p><h1 className="text-2xl font-semibold">Equipo de trabajo</h1><p className="text-sm text-secondary mt-1">Asigna perfiles de acceso sin crear nuevos niveles jerárquicos.</p></header>{message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`text-sm rounded p-3 ${message.type === 'error' ? 'text-danger bg-danger-bg' : 'text-success bg-success-bg'}`}>{message.text}</p>}<form onSubmit={assignProfile} className="card p-5 grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end"><label className="text-sm">Persona<select required className="input-field mt-1.5" value={personId} onChange={(event) => setPersonId(event.target.value)}><option value="">Seleccionar persona...</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select></label><label className="text-sm">Perfil<select required className="input-field mt-1.5" value={profileId} onChange={(event) => setProfileId(event.target.value)}><option value="">Seleccionar perfil...</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nombre}</option>)}</select></label><button disabled={saving} className="btn-primary"><UserPlus className="w-4 h-4" /> {saving ? 'Asignando...' : 'Asignar perfil'}</button></form><section className="card overflow-hidden"><div className="p-5 border-b border-border"><h2 className="font-medium">Perfiles activos</h2><p className="text-sm text-secondary mt-1">Personas con acceso adicional en esta congregación.</p></div>{assignments.length ? <div className="divide-y divide-border">{assignments.map((assignment) => <div key={assignment.id} className="p-4 flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{assignment.personas?.nombres} {assignment.personas?.apellidos}</p><p className="text-xs text-secondary mt-1">{assignment.perfiles_acceso?.nombre} · Desde {assignment.fecha_inicio}</p></div><button type="button" onClick={() => endAssignment(assignment)} className="text-xs text-danger">Retirar perfil</button></div>)}</div> : <p className="p-8 text-sm text-muted">Aún no hay perfiles adicionales asignados.</p>}</section></div>
}
