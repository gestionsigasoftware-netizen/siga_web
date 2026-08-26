import { useEffect, useState } from 'react'
import { BarChart3, HeartHandshake, Plus, Search, UsersRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

const STATES = { activo: 'Activo', apartado: 'Apartado', trasladado: 'Trasladado', inactivo: 'Inactivo', fallecido: 'Fallecido' }
const EMPTY_PERSON = { nombres: '', apellidos: '', telefono: '', estado_membresia: 'activo', bautizado: false, fecha_bautismo: '', fecha_ingreso: '', fecha_ultima_asistencia: '', familia_id: '' }

export default function FeligresiaAdmin() {
  const { rolPrincipal } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const [people, setPeople] = useState([])
  const [families, setFamilies] = useState([])
  const [committees, setCommittees] = useState([])
  const [cargoHistory, setCargoHistory] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [tab, setTab] = useState('personas')
  const [form, setForm] = useState(EMPTY_PERSON)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [familyName, setFamilyName] = useState('')
  const [committeeName, setCommitteeName] = useState('')
  const [committeeRole, setCommitteeRole] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!congregacionId) return
    const [peopleResult, familyResult, committeeResult, cargoResult] = await Promise.all([
      supabase.from('personas').select('id, nombres, apellidos, telefono, fecha_ingreso, estado_membresia, bautizado, fecha_bautismo, fecha_ultima_asistencia, familia_id, familias(nombre_familia)').eq('congregacion_id', congregacionId).order('nombres'),
      supabase.from('familias').select('id, nombre_familia').eq('congregacion_id', congregacionId).order('nombre_familia'),
      supabase.from('comites').select('id, nombre, membresias_comite(id, persona_id, cargo)').eq('congregacion_id', congregacionId).eq('activo', true).order('nombre'),
      supabase.from('historial_cargos').select('id, persona_id, nombre_cargo, area, fecha_inicio, fecha_fin').order('fecha_inicio', { ascending: false }),
    ])
    if (peopleResult.error) setError('No se pudo cargar la feligresía. Ejecuta feligresia.sql.')
    setPeople(peopleResult.data ?? [])
    setFamilies(familyResult.data ?? [])
    setCommittees(committeeResult.data ?? [])
    setCargoHistory(cargoResult.data ?? [])
  }

  useEffect(() => { load() }, [congregacionId])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  async function savePerson(event) {
    event.preventDefault()
    if (!form.nombres.trim() || !form.apellidos.trim()) {
      setError('Completa nombres y apellidos antes de guardar la ficha.')
      setNotice(null)
      return
    }
    if (form.bautizado && !form.fecha_bautismo) {
      setError('Indica la fecha de bautismo para guardar a la persona como bautizada.')
      setNotice(null)
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    const payload = {
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      telefono: form.telefono.trim() || null,
      estado_membresia: form.estado_membresia,
      bautizado: Boolean(form.bautizado),
      fecha_bautismo: form.bautizado ? form.fecha_bautismo : null,
      fecha_ingreso: form.fecha_ingreso || null,
      fecha_ultima_asistencia: form.fecha_ultima_asistencia || null,
      familia_id: form.familia_id || null,
      congregacion_id: congregacionId,
    }
    const result = selected ? await supabase.from('personas').update(payload).eq('id', selected.id) : await supabase.from('personas').insert(payload)
    setSaving(false)
    if (result.error) {
      const message = result.error.code === '42501'
        ? 'No tienes permisos para modificar esta congregación.'
        : result.error.code === 'PGRST204'
          ? 'Faltan columnas de Feligresía en Supabase. Ejecuta feligresia.sql y vuelve a intentarlo.'
          : `No se pudo guardar la ficha: ${result.error.message}`
      setError(message)
      return
    }
    setShowForm(false)
    setSelected(null)
    setForm(EMPTY_PERSON)
    setNotice(selected ? 'Ficha de persona actualizada correctamente.' : 'Persona registrada correctamente en la feligresía.')
    load()
  }

  async function saveFamily(event) {
    event.preventDefault()
    if (!familyName.trim()) { setError('Escribe un nombre para la familia.'); return }
    setSaving(true); setError(null); setNotice(null)
    const result = await supabase.from('familias').insert({ congregacion_id: congregacionId, nombre_familia: familyName.trim() })
    setSaving(false)
    if (result.error) { setError(`No se pudo crear la familia: ${result.error.message}`); return }
    setFamilyName(''); setNotice('Familia creada correctamente.'); load()
  }

  async function saveCommittee(event) {
    event.preventDefault()
    if (!committeeName.trim()) { setError('Escribe un nombre para el comité.'); return }
    setSaving(true); setError(null); setNotice(null)
    const result = await supabase.from('comites').insert({ congregacion_id: congregacionId, nombre: committeeName.trim() })
    setSaving(false)
    if (result.error) { setError(`No se pudo crear el comité: ${result.error.message}`); return }
    setCommitteeName(''); setNotice('Comité creado correctamente.'); load()
  }

  async function assignCommittee(event) {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null)
    const data = new FormData(event.currentTarget)
    const result = await supabase.from('membresias_comite').insert({ comite_id: data.get('comite_id'), persona_id: data.get('persona_id'), cargo: data.get('cargo') || null })
    setSaving(false)
    if (result.error) { setError(`No se pudo asignar el integrante: ${result.error.message}`); return }
    setCommitteeRole(''); event.currentTarget.reset(); setNotice('Integrante asignado correctamente al comité.'); load()
  }

  const filtered = people.filter((person) => (status === 'todos' || person.estado_membresia === status) && `${person.nombres} ${person.apellidos}`.toLowerCase().includes(search.toLowerCase()))
  const active = people.filter((person) => person.estado_membresia === 'activo').length
  const baptized = people.filter((person) => person.bautizado).length
  const apart = people.filter((person) => person.estado_membresia === 'apartado').length
  const familiesWithPeople = new Set(people.map((person) => person.familia_id).filter(Boolean)).size
  const history = Array.from({ length: 6 }, (_, index) => { const month = new Date(); month.setMonth(month.getMonth() - 5 + index); return { label: month.toLocaleDateString('es-CO', { month: 'short' }), total: people.filter((person) => person.fecha_ingreso && new Date(person.fecha_ingreso) <= month).length } })
  const maxHistory = Math.max(...history.map((item) => item.total), 1)

  function startNewPerson() { setSelected(null); setForm(EMPTY_PERSON); setShowForm(true) }
  function editPerson(person) { setSelected(person); setForm({ ...EMPTY_PERSON, ...person, fecha_bautismo: person.fecha_bautismo || '', fecha_ingreso: person.fecha_ingreso || '', fecha_ultima_asistencia: person.fecha_ultima_asistencia || '', familia_id: person.familia_id || '' }); setShowForm(true) }

  return <div className="flex flex-col gap-6">
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Administración local</p><h1 className="text-2xl font-semibold">Feligresía</h1><p className="text-sm text-secondary mt-1">Censo, familias, comités y seguimiento pastoral.</p></div><div className="flex gap-2"><button onClick={startNewPerson} className="btn-primary"><Plus className="w-4 h-4" /> Registrar persona</button></div></header>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric label="Personas activas" value={active} accent /><Metric label="Bautizados" value={baptized} /><Metric label="Apartados" value={apart} /><Metric label="Familias asociadas" value={familiesWithPeople} /></div>
    <nav className="flex gap-1 border-b border-border overflow-x-auto">{[['personas', 'Población', UsersRound], ['familias', 'Familias', HeartHandshake], ['comites', 'Comités', HeartHandshake], ['historial', 'Evolución', BarChart3]].map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 ${tab === key ? 'border-accent text-accent' : 'border-transparent text-secondary'}`}><Icon className="w-4 h-4" />{label}</button>)}</nav>
    {error && !showForm && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
    {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}
    {tab === 'personas' && <section className="card overflow-hidden"><div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3"><div className="flex items-center gap-2 flex-1"><Search className="w-4 h-4 text-muted" /><input aria-label="Buscar personas" className="bg-transparent outline-none text-sm w-full" placeholder="Buscar persona..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Filtrar estado" className="input-field sm:max-w-[180px]" value={status} onChange={(event) => setStatus(event.target.value)}><option value="todos">Todos los estados</option>{Object.entries(STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>{filtered.length ? <div className="divide-y divide-border">{filtered.map((person) => <button key={person.id} onClick={() => editPerson(person)} className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-1"><div><p className="text-sm font-medium">{person.nombres} {person.apellidos}</p><p className="text-xs text-secondary mt-1">{person.bautizado ? 'Bautizado' : 'No bautizado'}{person.familias?.nombre_familia ? ` · ${person.familias.nombre_familia}` : ''}{person.fecha_ultima_asistencia ? ` · Última asistencia: ${person.fecha_ultima_asistencia}` : ''}</p></div><span className="text-xs px-2 py-1 rounded bg-surface-1">{STATES[person.estado_membresia]}</span></button>)}</div> : <Empty text="No hay personas con estos filtros." />}</section>}
    {tab === 'familias' && <section className="flex flex-col gap-4"><form onSubmit={saveFamily} className="card p-4 flex gap-2"><input required className="input-field" placeholder="Nombre de la nueva familia" value={familyName} onChange={(event) => setFamilyName(event.target.value)} /><button disabled={saving} className="btn-primary whitespace-nowrap"><Plus className="w-4 h-4" /> Crear familia</button></form><div className="grid md:grid-cols-2 gap-4">{families.map((family) => <div key={family.id} className="card p-5"><h2 className="font-medium">{family.nombre_familia}</h2><p className="text-sm text-secondary mt-1">{people.filter((person) => person.familia_id === family.id).length} integrantes asociados</p></div>)}</div>{families.length === 0 && <Empty text="Aún no hay familias registradas." />}</section>}
    {tab === 'comites' && <section className="flex flex-col gap-4"><form onSubmit={saveCommittee} className="card p-4 flex gap-2"><input required className="input-field" placeholder="Nombre del nuevo comité" value={committeeName} onChange={(event) => setCommitteeName(event.target.value)} /><button disabled={saving} className="btn-primary whitespace-nowrap"><Plus className="w-4 h-4" /> Crear comité</button></form><form onSubmit={assignCommittee} className="card p-4 grid sm:grid-cols-3 gap-2"><select required name="comite_id" className="input-field"><option value="">Comité...</option>{committees.map((committee) => <option key={committee.id} value={committee.id}>{committee.nombre}</option>)}</select><select required name="persona_id" className="input-field"><option value="">Integrante...</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><div className="flex gap-2"><input name="cargo" className="input-field" placeholder="Responsabilidad" value={committeeRole} onChange={(event) => setCommitteeRole(event.target.value)} /><button disabled={saving} className="btn-secondary px-3" title="Asignar integrante"><Plus className="w-4 h-4" /></button></div></form><div className="grid md:grid-cols-2 gap-4">{committees.map((committee) => <div key={committee.id} className="card p-5"><h2 className="font-medium">{committee.nombre}</h2><p className="text-sm text-secondary mt-1">{committee.membresias_comite?.length ?? 0} integrantes asociados</p><div className="flex flex-wrap gap-2 mt-4">{(committee.membresias_comite ?? []).map((member) => <span key={member.id} className="text-xs bg-surface-1 rounded px-2 py-1">{people.find((person) => person.id === member.persona_id)?.nombres || 'Integrante'}{member.cargo ? ` · ${member.cargo}` : ''}</span>)}</div></div>)}</div>{committees.length === 0 && <Empty text="Aún no hay comités registrados." />}</section>}
    {tab === 'historial' && <section className="grid lg:grid-cols-2 gap-4"><div className="card p-5"><h2 className="font-medium">Evolución del censo</h2><p className="text-sm text-secondary mt-1 mb-6">Crecimiento acumulado según fechas de ingreso.</p><div className="h-56 flex items-end gap-3 border-b border-l border-border px-4">{history.map((item) => <div key={item.label} className="flex-1 flex flex-col items-center justify-end gap-2 h-full"><span className="text-xs text-muted">{item.total}</span><div className="w-full max-w-12 bg-accent rounded-t" style={{ height: `${Math.max(4, item.total / maxHistory * 75)}%` }} /><span className="text-xs text-muted">{item.label}</span></div>)}</div></div><div className="card p-5"><h2 className="font-medium">Historial de cargos</h2><p className="text-sm text-secondary mt-1 mb-4">Responsabilidades registradas por persona.</p>{cargoHistory.length ? <div className="flex flex-col divide-y divide-border">{cargoHistory.map((item) => <div key={item.id} className="py-3"><p className="text-sm font-medium">{people.find((person) => person.id === item.persona_id)?.nombres || 'Persona'} {people.find((person) => person.id === item.persona_id)?.apellidos || ''}</p><p className="text-xs text-secondary mt-1">{item.nombre_cargo}{item.area ? ` · ${item.area}` : ''}</p><p className="text-xs text-muted mt-1">Desde {item.fecha_inicio}{item.fecha_fin ? ` hasta ${item.fecha_fin}` : ' · Actual'}</p></div>)}</div> : <Empty text="Aún no hay cargos históricos registrados." />}</div></section>}
    {showForm && <PersonForm form={form} setForm={setForm} families={families} saving={saving} editing={Boolean(selected)} error={error} close={() => { setShowForm(false); setError(null) }} onSubmit={savePerson} />}
  </div>
}

function Metric({ label, value, accent }) { return <div className={`rounded p-4 ${accent ? 'bg-accent-bg' : 'bg-surface-1'}`}><p className="text-sm text-secondary">{label}</p><p className="text-2xl font-semibold mt-2">{value}</p></div> }
function Empty({ text }) { return <div className="p-10 text-center text-sm text-secondary">{text}</div> }
function PersonForm({ form, setForm, families, saving, editing, error, close, onSubmit }) { return <div className="fixed inset-0 z-40 bg-ink/30 flex items-center justify-center p-4"><form onSubmit={onSubmit} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-2 rounded-card shadow-xl p-6"><div className="flex justify-between mb-5"><h2 className="font-medium">{editing ? 'Editar ficha de persona' : 'Registrar persona'}</h2><button type="button" aria-label="Cerrar" onClick={close} className="text-sm text-secondary hover:text-ink">Cerrar</button></div>{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mb-4">{error}</p>}<div className="grid sm:grid-cols-2 gap-3"><Field label="Nombres" required value={form.nombres} onChange={(value) => setForm({ ...form, nombres: value })} /><Field label="Apellidos" required value={form.apellidos} onChange={(value) => setForm({ ...form, apellidos: value })} /><Field label="Teléfono" value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value })} /><label className="text-sm">Estado<select className="input-field mt-1.5" value={form.estado_membresia} onChange={(event) => setForm({ ...form, estado_membresia: event.target.value })}>{Object.entries(STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><Field label="Fecha de ingreso" type="date" value={form.fecha_ingreso} onChange={(value) => setForm({ ...form, fecha_ingreso: value })} /><Field label="Última asistencia" type="date" value={form.fecha_ultima_asistencia} onChange={(value) => setForm({ ...form, fecha_ultima_asistencia: value })} /><label className="text-sm">Familia<select className="input-field mt-1.5" value={form.familia_id} onChange={(event) => setForm({ ...form, familia_id: event.target.value })}><option value="">Sin familia</option>{families.map((family) => <option key={family.id} value={family.id}>{family.nombre_familia}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.bautizado} onChange={(event) => setForm({ ...form, bautizado: event.target.checked })} /> Bautizado</label><Field label="Fecha de bautismo" type="date" value={form.fecha_bautismo} onChange={(value) => setForm({ ...form, fecha_bautismo: value })} /></div><button disabled={saving} className="btn-primary w-full justify-center mt-5">{saving ? 'Guardando...' : 'Guardar ficha'}</button></form></div> }
function Field({ label, type = 'text', required, value, onChange }) { return <label className="text-sm">{label}<input required={required} type={type} className="input-field mt-1.5" value={value || ''} onChange={(event) => onChange(event.target.value)} /></label> }
