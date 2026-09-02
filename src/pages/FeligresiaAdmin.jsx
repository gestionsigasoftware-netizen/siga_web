import { useDeferredValue, useEffect, useState } from 'react'
import { BarChart3, Download, HeartHandshake, Plus, Search, UsersRound } from 'lucide-react'
import { Bar, Doughnut } from 'react-chartjs-2'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'
import { usePreferencias } from '../hooks/usePreferencias'
import { formatFecha } from '../lib/dateFormat'
import { SkeletonList } from '../components/Skeleton'
import { chartOptions as buildChartOptions, gradientFill, distributionDataset } from '../lib/chartTheme'

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip)

const feligresiaCache = new Map()

const STATES = { activo: 'Activo', apartado: 'Apartado', trasladado: 'Trasladado', inactivo: 'Inactivo', fallecido: 'Fallecido' }
const ALERT_TYPE_LABELS = { familia: 'Familia', bautismo: 'Bautismo', asistencia_persona: 'Asistencia', asistencia: 'Tendencia', comite: 'Comité' }
const FAMILY_RELATIONSHIPS = { cabeza: 'Cabeza de familia', padre: 'Padre', madre: 'Madre', hijo: 'Hijo/a', conyuge: 'Cónyuge', hermano: 'Hermano/a', abuelo: 'Abuelo/a', nieto: 'Nieto/a', otro: 'Otro' }
// Agrupa integrantes activos por el cargo normalizado del catálogo de la congregación
// (cargos_comite); lo que no coincide con ningún cargo del catálogo cae en un grupo
// residual para no perder membresías creadas antes de configurar el catálogo.
function committeeMemberGroups(committee, cargoCatalog) {
  const active = (committee.membresias_comite ?? []).filter((member) => !member.fecha_fin)
  const groups = cargoCatalog.map((cargo) => ({
    key: cargo.id,
    label: cargo.nombre,
    members: active.filter((member) => member.cargo_id === cargo.id || (!member.cargo_id && member.cargo === cargo.nombre)),
  }))
  const claimed = new Set(groups.flatMap((group) => group.members.map((member) => member.id)))
  const other = active.filter((member) => !claimed.has(member.id))
  if (other.length) groups.push({ key: 'otros', label: other.some((member) => member.cargo) ? 'Otro' : 'Sin cargo', members: other })
  return groups.filter((group) => group.members.length)
}
const EMPTY_PERSON = { nombres: '', apellidos: '', telefono: '', fecha_nacimiento: '', estado_membresia: 'activo', estado_civil: 'soltero', bautizado: false, fecha_bautismo: '', sellado_espiritu_santo: false, fecha_sellado: '', fecha_ingreso: '', fecha_ultima_asistencia: '', familia_id: '', parentesco_familiar: '', observaciones_pastorales: '' }
const MARITAL_STATUSES = { soltero: 'Soltero/a', casado: 'Casado/a', union_libre: 'Unión libre', divorciado: 'Divorciado/a', viudo: 'Viudo/a' }

function withRequestTimeout(request, milliseconds = 12000) {
  return Promise.race([
    request,
    new Promise((_, reject) => setTimeout(() => reject(new Error('La operación tardó demasiado. Intenta nuevamente.')), milliseconds)),
  ])
}

function calcularEdad(fechaNacimiento, hoy = new Date()) {
  if (!fechaNacimiento) return null
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00`)
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const noHaCumplido = hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())
  if (noHaCumplido) edad -= 1
  return edad >= 0 && edad < 110 ? edad : null
}

function PersonFormDetailed(props) {
  const [section, setSection] = useState('datos')
  return <>
    {section === 'datos' && <PersonFormEditor {...props} />}
    {props.editing && section !== 'datos' && <div className="fixed inset-0 z-40 bg-ink/30 flex items-center justify-center p-4"><div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-2 rounded-card shadow-xl p-6"><div className="flex justify-between mb-5"><h2 className="font-medium">Ficha de {props.selected.nombres} {props.selected.apellidos}</h2><button type="button" aria-label="Cerrar" onClick={props.close} className="text-sm text-secondary hover:text-ink">Cerrar</button></div>{props.error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mb-4">{props.error}</p>}{section === 'seguimiento' && <PastoralFollowupPanel {...props} person={props.selected} followups={props.pastoralFollowups} onSubmit={props.onSavePastoralFollowup} embedded />}{section === 'cargos' && <CargoPanel {...props} person={props.selected} cargos={props.cargoHistory} onSubmit={props.onSaveCargo} onEdit={props.onEditCargo} embedded />}{section === 'movimientos' && <MembershipMovementsPanel {...props} person={props.selected} movimientosMembresia={props.movimientosMembresia} onSubmit={props.onSaveMovimiento} embedded />}</div></div>}
    {props.editing && <nav className="fixed z-[55] bottom-4 left-1/2 -translate-x-1/2 flex gap-1 bg-surface-2 border border-border rounded p-1 shadow-lg"><button type="button" onClick={() => setSection('datos')} className={`text-xs px-3 py-2 rounded ${section === 'datos' ? 'bg-accent-bg text-accent' : 'text-secondary'}`}>Datos</button><button type="button" onClick={() => setSection('seguimiento')} className={`text-xs px-3 py-2 rounded ${section === 'seguimiento' ? 'bg-accent-bg text-accent' : 'text-secondary'}`}>Seguimiento</button><button type="button" onClick={() => setSection('cargos')} className={`text-xs px-3 py-2 rounded ${section === 'cargos' ? 'bg-accent-bg text-accent' : 'text-secondary'}`}>Cargos</button><button type="button" onClick={() => setSection('movimientos')} className={`text-xs px-3 py-2 rounded ${section === 'movimientos' ? 'bg-accent-bg text-accent' : 'text-secondary'}`}>Movimientos</button></nav>}
  </>
}

function PersonFormEditor({ form, setForm, families, committees, cargoHistory, selected, saving, canEdit, editing, error, close, onSubmit }) {
  const memberships = committees.flatMap((committee) => (committee.membresias_comite ?? []).filter((member) => member.persona_id === selected?.id).map((member) => `${committee.nombre}${member.cargo ? ` · ${member.cargo}` : ''}`))
  const cargos = cargoHistory.filter((item) => item.persona_id === selected?.id).map((item) => item.nombre_cargo)
  return <div className="fixed inset-0 z-40 bg-ink/30 flex items-center justify-center p-4"><form onSubmit={onSubmit} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-2 rounded-card shadow-xl p-6"><div className="flex justify-between mb-5"><h2 className="font-medium">{editing ? 'Editar ficha de persona' : 'Registrar persona'}</h2><button type="button" aria-label="Cerrar" onClick={close} className="text-sm text-secondary hover:text-ink">Cerrar</button></div>{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mb-4">{error}</p>}<div className="grid sm:grid-cols-2 gap-3"><Field label="Nombres" required value={form.nombres} onChange={(value) => setForm({ ...form, nombres: value })} /><Field label="Apellidos" required value={form.apellidos} onChange={(value) => setForm({ ...form, apellidos: value })} /><Field label="Teléfono" value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value })} /><Field label="Fecha de nacimiento" type="date" value={form.fecha_nacimiento} onChange={(value) => setForm({ ...form, fecha_nacimiento: value })} /><label className="text-sm">Estado<select className="input-field mt-1.5" value={form.estado_membresia} onChange={(event) => setForm({ ...form, estado_membresia: event.target.value })}>{Object.entries(STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm">Estado civil<select className="input-field mt-1.5" value={form.estado_civil} onChange={(event) => setForm({ ...form, estado_civil: event.target.value })}>{Object.entries(MARITAL_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><Field label="Fecha de ingreso" type="date" value={form.fecha_ingreso} onChange={(value) => setForm({ ...form, fecha_ingreso: value })} /><Field label="Última asistencia" type="date" value={form.fecha_ultima_asistencia} onChange={(value) => setForm({ ...form, fecha_ultima_asistencia: value })} /><label className="text-sm">Familia<select className="input-field mt-1.5" value={form.familia_id} onChange={(event) => setForm({ ...form, familia_id: event.target.value, parentesco_familiar: event.target.value ? form.parentesco_familiar : '' })}><option value="">Sin familia</option>{families.map((family) => <option key={family.id} value={family.id}>{family.nombre_familia}</option>)}</select></label><label className="text-sm">Parentesco familiar<select className="input-field mt-1.5" value={form.parentesco_familiar || ''} onChange={(event) => setForm({ ...form, parentesco_familiar: event.target.value })} disabled={!form.familia_id}><option value="">Seleccionar...</option>{Object.entries(FAMILY_RELATIONSHIPS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.bautizado} onChange={(event) => setForm({ ...form, bautizado: event.target.checked })} /> Bautizado</label><Field label="Fecha de bautismo" type="date" value={form.fecha_bautismo} onChange={(value) => setForm({ ...form, fecha_bautismo: value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.sellado_espiritu_santo} onChange={(event) => setForm({ ...form, sellado_espiritu_santo: event.target.checked })} /> Sellado con el Espíritu Santo</label><Field label="Fecha de sellado" type="date" value={form.fecha_sellado} onChange={(value) => setForm({ ...form, fecha_sellado: value })} /><label className="text-sm sm:col-span-2">Observaciones pastorales<textarea className="input-field mt-1.5 min-h-24" value={form.observaciones_pastorales || ''} onChange={(event) => setForm({ ...form, observaciones_pastorales: event.target.value })} /></label></div>{editing && <div className="mt-5 border-t border-border pt-4"><p className="text-sm font-medium">Participación y responsabilidades</p>{memberships.length ? <p className="text-xs text-secondary mt-2">{memberships.join(' · ')}</p> : <p className="text-xs text-muted mt-2">Sin participación en comités.</p>}{cargos.length > 0 && <p className="text-xs text-secondary mt-2">Cargos históricos: {cargos.join(', ')}</p>}</div>}<button disabled={saving} className="btn-primary w-full justify-center mt-5">{saving ? 'Guardando...' : 'Guardar ficha'}</button></form></div>
}


function CommitteeAnalytics({ people, committees, cargos, audit }) {
  const { formato_fecha } = usePreferencias()
  const today = new Date().toISOString().slice(0, 10)
  const active = committees.filter((committee) => committee.activo && (!committee.fecha_fin || committee.fecha_fin >= today))
  const memberships = active.flatMap((committee) => (committee.membresias_comite ?? []).filter((member) => member.estado !== 'historico' && !member.fecha_fin).map((member) => ({ ...member, committee })))
  const required = active.reduce((total, committee) => total + cargos.filter((cargo) => cargo.obligatorio).length, 0)
  const covered = active.reduce((total, committee) => total + cargos.filter((cargo) => cargo.obligatorio && (committee.membresias_comite ?? []).some((member) => member.cargo_id === cargo.id && member.estado !== 'historico' && !member.fecha_fin)).length, 0)
  const counts = memberships.reduce((result, member) => ({ ...result, [member.persona_id]: (result[member.persona_id] || 0) + 1 }), {})
  const overloaded = Object.entries(counts).filter(([, count]) => count > 1).sort(([, left], [, right]) => right - left)
  const serving = new Set(memberships.map((member) => member.persona_id))
  const withoutMembers = active.filter((committee) => !memberships.some((member) => member.committee.id === committee.id)).length
  const withoutResponsible = active.filter((committee) => !committee.responsable_id).length
  const expiring = memberships.filter((member) => member.fecha_fin && member.fecha_fin >= today && member.fecha_fin <= new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)).length
  const exportCsv = () => {
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = [['Comité', 'Código', 'Estado', 'Vigencia', 'Integrantes', 'Cargos obligatorios', 'Cargos cubiertos'], ...active.map((committee) => { const current = memberships.filter((member) => member.committee.id === committee.id); const requiredCargos = cargos.filter((cargo) => cargo.obligatorio); return [committee.nombre, committee.codigo, 'Activo', committee.fecha_fin || 'Sin fecha final', current.length, requiredCargos.length, requiredCargos.filter((cargo) => current.some((member) => member.cargo_id === cargo.id)).length] }), [], ['Fecha', 'Entidad', 'Acción', 'Usuario'], ...audit.map((item) => [item.creado_en, item.entidad, item.accion, item.usuario_id])]
    const csv = `\ufeff${rows.map((row) => row.map(escape).join(';')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); const link = document.createElement('a'); link.href = url; link.download = `comites-analisis-${today}.csv`; link.click(); URL.revokeObjectURL(url)
  }
  const insights = []
  if (withoutMembers) insights.push(`${withoutMembers} comité${withoutMembers === 1 ? '' : 's'} activo${withoutMembers === 1 ? '' : 's'} sin integrantes: confirmar continuidad o asignar equipo.`)
  if (withoutResponsible) insights.push(`${withoutResponsible} comité${withoutResponsible === 1 ? '' : 's'} sin responsable vigente: programar designación o documentar transición.`)
  if (expiring) insights.push(`${expiring} responsabilidad${expiring === 1 ? '' : 'es'} vence${expiring === 1 ? '' : 'n'} en los próximos 90 días: revisar continuidad o reemplazo.`)
  if (overloaded.length) insights.push(`${overloaded.length} persona${overloaded.length === 1 ? '' : 's'} participa en más de un comité: conversar sobre carga y disponibilidad.`)
  if (!insights.length) insights.push('No hay situaciones operativas prioritarias en este periodo.')
  return <section className="card p-5"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h3 className="font-medium">Análisis de comités</h3><p className="text-xs text-secondary mt-1">Métricas del periodo actual para apoyar decisiones locales.</p></div><button type="button" onClick={exportCsv} className="btn-secondary"><Download className="w-4 h-4" /> Exportar análisis</button></div><div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-5"><Metric label="Comités activos" value={active.length} accent /><Metric label="Integrantes vigentes" value={memberships.length} /><Metric label="Cargos obligatorios" value={required} /><Metric label="Cargos cubiertos" value={covered} /><Metric label="Vacantes" value={Math.max(required - covered, 0)} /><Metric label="Personas disponibles" value={people.filter((person) => person.estado_membresia === 'activo' && !serving.has(person.id)).length} /></div><div className="grid lg:grid-cols-2 gap-4 mt-5"><div><h4 className="text-sm font-medium">Insights y acciones</h4>{insights.map((item) => <p key={item} className="summary-insight mt-2">{item}</p>)}</div><div><h4 className="text-sm font-medium">Concentración de responsabilidades</h4>{overloaded.length ? overloaded.slice(0, 8).map(([personId, count]) => { const person = people.find((item) => item.id === personId); return <p key={personId} className="text-xs text-secondary mt-2">{person ? `${person.nombres} ${person.apellidos}` : 'Persona'} · {count} comités</p> }) : <p className="text-xs text-muted mt-2">No hay personas con más de una responsabilidad vigente.</p>}</div></div><div className="mt-5 border-t border-border pt-4"><div className="flex justify-between gap-3"><h4 className="text-sm font-medium">Historial reciente</h4><span className="text-xs text-muted">{audit.length} cambios</span></div>{audit.length ? <div className="overflow-x-auto mt-2"><table className="w-full text-xs"><tbody>{audit.slice(0, 12).map((item) => <tr key={item.id} className="border-b border-border"><td className="py-2 pr-3">{formatFecha(item.creado_en, { formato: formato_fecha, conHora: true })}</td><td className="py-2 pr-3">{item.entidad}</td><td className="py-2 pr-3">{item.accion}</td><td className="py-2">{item.usuario_id || 'Sistema'}</td></tr>)}</tbody></table></div> : <p className="text-xs text-muted mt-2">No hay cambios de comités registrados todavía.</p>}</div></section>
}

function FeligresiaInsights({ people, families, committees, cargoHistory, followups, alerts }) {
  const [statusFilter, setStatusFilter] = useState('todos')
  const [ageFilter, setAgeFilter] = useState('todas')
  const [historyMonths, setHistoryMonths] = useState('12')
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const filteredPeople = people.filter((person) => {
    const age = calcularEdad(person.fecha_nacimiento, today)
    const matchesStatus = statusFilter === 'todos' || person.estado_membresia === statusFilter
    const matchesAge = ageFilter === 'todas' || (age !== null && ((ageFilter === '0-12' && age <= 12) || (ageFilter === '13-17' && age >= 13 && age <= 17) || (ageFilter === '18-29' && age >= 18 && age <= 29) || (ageFilter === '30-59' && age >= 30 && age <= 59) || (ageFilter === '60+' && age >= 60)))
    return matchesStatus && matchesAge
  })
  const activePeople = filteredPeople.filter((person) => person.estado_membresia === 'activo')
  const total = filteredPeople.length
  const active = activePeople.length
  const activeTotal = activePeople.length
  const baptized = activePeople.filter((person) => person.bautizado).length
  const withFamily = activePeople.filter((person) => person.familia_id).length
  const withoutAttendance = activePeople.filter((person) => !person.fecha_ultima_asistencia || person.fecha_ultima_asistencia < new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10)).length
  const pending = followups.filter((item) => item.estado === 'pendiente').length
  const overdue = followups.filter((item) => item.estado === 'pendiente' && item.proxima_fecha && item.proxima_fecha < todayKey).length
  const activeMemberships = committees.filter((committee) => committee.activo).flatMap((committee) => committee.membresias_comite ?? []).filter((member) => !member.fecha_fin && filteredPeople.some((person) => person.id === member.persona_id))
  const committeePeople = new Set(activeMemberships.map((member) => member.persona_id)).size
  const activeCharges = cargoHistory.filter((item) => !item.fecha_fin && filteredPeople.some((person) => person.id === item.persona_id)).length
  const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()).toISOString().slice(0, 10)
  const newPeople = filteredPeople.filter((person) => person.fecha_ingreso && person.fecha_ingreso >= yearAgo).length
  const ages = activePeople.map((person) => calcularEdad(person.fecha_nacimiento, today)).filter((age) => age !== null)
  const ageGroups = [['0-12', 0], ['13-17', 0], ['18-29', 0], ['30-59', 0], ['60+', 0]]
  ages.forEach((age) => { const index = age <= 12 ? 0 : age <= 17 ? 1 : age <= 29 ? 2 : age <= 59 ? 3 : 4; ageGroups[index][1] += 1 })
  const statuses = Object.entries(STATES).map(([key, label]) => ({ label, value: filteredPeople.filter((person) => person.estado_membresia === key).length }))
  const maritalStatuses = Object.entries(MARITAL_STATUSES).map(([key, label]) => ({ label, value: activePeople.filter((person) => person.estado_civil === key).length }))
  const followupStatuses = [['Pendientes', followups.filter((item) => item.estado === 'pendiente').length], ['Completados', followups.filter((item) => item.estado === 'completado').length], ['Cancelados', followups.filter((item) => item.estado === 'cancelado').length]]
  const familySizes = families.map((family) => filteredPeople.filter((person) => person.familia_id === family.id).length).filter((size) => size > 0)
  const averageFamilySize = familySizes.length ? (familySizes.reduce((sum, size) => sum + size, 0) / familySizes.length).toFixed(1) : '0.0'
  const activeAlerts = alerts.filter((alert) => alert.estado !== 'atendida')
  const months = Number(historyMonths)
  const admissionsHistory = Array.from({ length: months }, (_, index) => {
    const start = new Date(today.getFullYear(), today.getMonth() - months + index + 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth() - months + index + 2, 1)
    return { label: start.toLocaleDateString('es-CO', { month: 'short', year: months > 12 ? '2-digit' : undefined }), total: filteredPeople.filter((person) => person.fecha_ingreso && person.fecha_ingreso >= start.toISOString().slice(0, 10) && person.fecha_ingreso < end.toISOString().slice(0, 10)).length }
  })
  const chartOptions = buildChartOptions()
  const widowed = activePeople.filter((person) => person.estado_civil === 'viudo').length
  const divorced = activePeople.filter((person) => person.estado_civil === 'divorciado').length
  const apartados = filteredPeople.filter((person) => person.estado_membresia === 'apartado').length
  const insight = overdue > 0 ? `${overdue} seguimiento${overdue === 1 ? '' : 's'} está${overdue === 1 ? '' : 'n'} vencido${overdue === 1 ? '' : 's'}: prioriza la agenda pastoral.` : apartados > 0 ? `${apartados} persona${apartados === 1 ? '' : 's'} figura${apartados === 1 ? '' : 'n'} como apartada${apartados === 1 ? '' : 's'}. Revisa su familia, último contacto y define una ruta de reactivación.` : withoutAttendance > 0 ? `${withoutAttendance} persona${withoutAttendance === 1 ? '' : 's'} activa${withoutAttendance === 1 ? '' : 's'} no tiene asistencia reciente. Conviene activar contacto y actualizar su ficha.` : widowed + divorced > 0 ? `${widowed + divorced} persona${widowed + divorced === 1 ? '' : 's'} activa${widowed + divorced === 1 ? '' : 's'} figura como viuda o divorciada. Revisa si requiere acompañamiento familiar.` : activeAlerts.length > 0 ? `${activeAlerts.length} alerta${activeAlerts.length === 1 ? '' : 's'} pastoral${activeAlerts.length === 1 ? '' : 'es'} requiere${activeAlerts.length === 1 ? '' : 'n'} revisión.` : newPeople > 0 ? `${newPeople} persona${newPeople === 1 ? '' : 's'} ingresó${newPeople === 1 ? '' : 'aron'} en los últimos 12 meses. Revisa su integración y bautismo.` : 'La información está al día. Mantén la rutina de seguimiento y actualización del censo.'
  const doughnutData = { labels: ['Bautizados activos', 'No bautizados activos'], datasets: [{ data: [baptized, Math.max(activeTotal - baptized, 0)], backgroundColor: ['#008300', '#d9e0e8'], borderWidth: 0 }] }
  const statusData = distributionDataset(statuses, { valueKey: 'value', datasetLabel: 'Personas' })
  const maritalData = distributionDataset(maritalStatuses, { valueKey: 'value', datasetLabel: 'Personas activas' })
  const ageData = distributionDataset(ageGroups.map(([label, value]) => ({ label, value })), { valueKey: 'value', datasetLabel: 'Personas' })
  const followupData = distributionDataset(followupStatuses.map(([label, value]) => ({ label, value })), { valueKey: 'value', datasetLabel: 'Seguimientos' })
  const admissionsData = { labels: admissionsHistory.map((item) => item.label), datasets: [{ label: 'Nuevos ingresos', data: admissionsHistory.map((item) => item.total), backgroundColor: gradientFill('#2a78d6'), borderRadius: 4, barThickness: months > 24 ? 10 : 18 }] }

  return <section className="flex flex-col gap-4">
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-accent">Inteligencia de gestión</p><h2 className="font-medium mt-1">Lectura para tomar decisiones</h2><p className="text-sm text-secondary mt-1">Indicadores construidos con el censo completo, no solo con la página visible.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Filtrar dashboard por estado" className="input-field text-xs" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="todos">Todos los estados</option>{Object.entries(STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select aria-label="Filtrar dashboard por edad" className="input-field text-xs" value={ageFilter} onChange={(event) => setAgeFilter(event.target.value)}><option value="todas">Todas las edades</option>{ageGroups.map(([label]) => <option key={label} value={label}>{label} años</option>)}</select></div></div>
    <div className="grid grid-cols-2 lg:grid-cols-7 gap-3"><Metric label="Personas en censo" value={total} accent /><Metric label="Tasa de actividad" value={`${total ? Math.round(active / total * 100) : 0}%`} /><Metric label="Cobertura familiar" value={`${total ? Math.round(withFamily / total * 100) : 0}%`} /><Metric label="Ingresos últimos 12 meses" value={newPeople} /><Metric label="Viudos/as activos" value={widowed} /><Metric label="Divorciados/as activos" value={divorced} /><Metric label="Alertas activas" value={activeAlerts.length} /></div>
    <p className={`text-sm rounded p-3 ${overdue > 0 || withoutAttendance > 0 ? 'text-danger bg-danger-bg' : 'text-success bg-success-bg'}`}>{insight}</p>
    <div className="grid lg:grid-cols-4 gap-4"><div className="card p-5"><h3 className="font-medium">Estado del censo</h3><p className="text-xs text-secondary mt-1">Distribución por estado de membresía.</p><div className="h-56 mt-4"><Bar data={statusData} options={chartOptions} /></div></div><div className="card p-5"><h3 className="font-medium">Bautismo</h3><p className="text-xs text-secondary mt-1">Nivel de consolidación espiritual entre personas activas.</p><div className="h-56 mt-4"><Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: '#52514e', padding: 14, font: { size: 11 } } } } }} /></div></div><div className="card p-5"><h3 className="font-medium">Rangos de edad</h3><p className="text-xs text-secondary mt-1">Personas con fecha de nacimiento registrada.</p><div className="h-56 mt-4"><Bar data={ageData} options={chartOptions} /></div></div><div className="card p-5"><h3 className="font-medium">Situación familiar</h3><p className="text-xs text-secondary mt-1">Estado civil de las personas activas.</p><div className="h-56 mt-4"><Bar data={maritalData} options={chartOptions} /></div></div></div>
    <div className="card p-5"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h3 className="font-medium">Evolución de ingresos</h3><p className="text-xs text-secondary mt-1">Nuevas personas registradas en el periodo seleccionado.</p></div><select aria-label="Periodo de evolución de ingresos" className="input-field text-xs" value={historyMonths} onChange={(event) => setHistoryMonths(event.target.value)}><option value="12">Últimos 12 meses</option><option value="24">Últimos 24 meses</option><option value="60">Últimos 5 años</option></select></div><div className="h-56 mt-4"><Bar data={admissionsData} options={chartOptions} /></div></div>
    <div className="grid lg:grid-cols-2 gap-4"><div className="card p-5"><h3 className="font-medium">Seguimiento pastoral</h3><p className="text-xs text-secondary mt-1">Carga de trabajo y resultado de acompañamientos.</p><div className="h-52 mt-4"><Bar data={followupData} options={chartOptions} /></div><p className="summary-insight mt-3">{pending} pendientes · {overdue} vencidos · {followups.length} registros totales.</p></div><div className="card p-5"><h3 className="font-medium">Capacidad de organización</h3><p className="text-xs text-secondary mt-1">Participación en comités y cargos vigentes.</p><div className="grid grid-cols-3 gap-3 mt-6"><div><p className="text-[10px] uppercase tracking-[0.12em] text-secondary">Comités activos</p><p className="text-2xl font-semibold mt-1">{committees.filter((committee) => committee.activo).length}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-secondary">Personas en comités</p><p className="text-2xl font-semibold mt-1">{committeePeople}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-secondary">Cargos vigentes</p><p className="text-2xl font-semibold mt-1">{activeCharges}</p></div></div><p className="summary-insight mt-5">Hay {families.length} familias registradas, con un promedio de {averageFamilySize} integrante{averageFamilySize === '1.0' ? '' : 's'} por familia.</p>{cargoHistory.filter((item) => !item.fecha_fin).slice(0, 5).map((item) => { const person = people.find((candidate) => candidate.id === item.persona_id); return <p key={item.id} className="text-xs text-muted mt-2">{item.nombre_cargo} · {person ? `${person.nombres} ${person.apellidos}` : 'Persona'}</p> })}</div></div>
  </section>
}

export default function FeligresiaAdmin() {
  const location = useLocation()
  const { rolPrincipal } = useMiRol()
  const congregacionId = rolPrincipal?.congregacion_id
  const [people, setPeople] = useState([])
  const [analyticsPeople, setAnalyticsPeople] = useState([])
  const [families, setFamilies] = useState([])
  const [allCommittees, setAllCommittees] = useState([])
  const [cargoHistory, setCargoHistory] = useState([])
  const [movimientosMembresia, setMovimientosMembresia] = useState([])
  const [pastoralFollowups, setPastoralFollowups] = useState([])
  const [pastoralAlerts, setPastoralAlerts] = useState([])
  const [committeeAudit, setCommitteeAudit] = useState([])
  const [pastoralAgendaStatus, setPastoralAgendaStatus] = useState('pendiente')
  const [pastoralAgendaSearch, setPastoralAgendaSearch] = useState('')
  const [peopleTotal, setPeopleTotal] = useState(0)
  const [summary, setSummary] = useState(null)
  const [peoplePage, setPeoplePage] = useState(0)
  const peoplePageSize = 50
  const [search, setSearch] = useState('')
  const [personStatus, setPersonStatus] = useState('todos')
  const [tab, setTab] = useState('personas')
  const [form, setForm] = useState(EMPTY_PERSON)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [familyName, setFamilyName] = useState('')
  const [familyAddress, setFamilyAddress] = useState('')
  const [familyPhone, setFamilyPhone] = useState('')
  const [selectedFamilyId, setSelectedFamilyId] = useState('')
  const [familyMembers, setFamilyMembers] = useState([])
  const [familyRelations, setFamilyRelations] = useState([])
  const [committeeName, setCommitteeName] = useState('')
  const [committeeCode, setCommitteeCode] = useState('')
  const [committeeDescription, setCommitteeDescription] = useState('')
  const [committeeStart, setCommitteeStart] = useState('')
  const [committeeEnd, setCommitteeEnd] = useState('')
  const [committeeResponsible, setCommitteeResponsible] = useState('')
  const [committeeType, setCommitteeType] = useState('')
  const [committeePurpose, setCommitteePurpose] = useState('')
  const [committeeNotes, setCommitteeNotes] = useState('')
  const [committeeTypes, setCommitteeTypes] = useState([])
  const [committeeCargoCatalog, setCommitteeCargoCatalog] = useState([])
  const [committeeStatusFilter, setCommitteeStatusFilter] = useState('todos')
  const [committeeCargoFilter, setCommitteeCargoFilter] = useState('todos')
  const [committeePersonFilter, setCommitteePersonFilter] = useState('')
  const [committeeValidityFilter, setCommitteeValidityFilter] = useState('todos')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [importRows, setImportRows] = useState([])
  const [importError, setImportError] = useState(null)
  const [importRowErrors, setImportRowErrors] = useState([])
  const [reloadToken, setReloadToken] = useState(0)
  const deferredSearch = useDeferredValue(search)

  async function load() {
    if (!congregacionId) return
    const cacheKey = `${congregacionId}:${personStatus}:${deferredSearch}:${peoplePage}`
    const cached = feligresiaCache.get(cacheKey)
    if (cached) {
      setPeople(cached.people)
      setCommitteeCargoCatalog(cached.committeeCargoCatalog)
      setCommitteeTypes(cached.committeeTypes)
      setAnalyticsPeople(cached.analyticsPeople)
      setPeopleTotal(cached.peopleTotal)
      setFamilies(cached.families)
      setFamilyMembers(cached.familyMembers)
      setFamilyRelations(cached.familyRelations)
      setAllCommittees(cached.allCommittees)
      setCargoHistory(cached.cargoHistory)
      setMovimientosMembresia(cached.movimientosMembresia)
      setPastoralFollowups(cached.pastoralFollowups)
      setSummary(cached.summary)
      setPastoralAlerts(cached.pastoralAlerts)
      setCommitteeAudit(cached.committeeAudit)
      setLoading(false)
    } else {
      setLoading(true)
    }
    let peopleQuery = supabase.from('personas').select('id, nombres, apellidos, telefono, fecha_nacimiento, fecha_ingreso, estado_membresia, estado_civil, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ultima_asistencia, familia_id, parentesco_familiar, observaciones_pastorales, familias(nombre_familia)', { count: 'exact' }).eq('congregacion_id', congregacionId)
    if (personStatus !== 'todos') peopleQuery = peopleQuery.eq('estado_membresia', personStatus)
    if (deferredSearch.trim()) peopleQuery = peopleQuery.or(`nombres.ilike.%${deferredSearch.trim()}%,apellidos.ilike.%${deferredSearch.trim()}%`)
    peopleQuery = peopleQuery.order('nombres').order('id').range(peoplePage * peoplePageSize, peoplePage * peoplePageSize + peoplePageSize - 1)
    const [peopleResult, analyticsPeopleResult, familyResult, familyMembersResult, familyRelationsResult, committeeResult, committeeCargoResult, committeeTypeResult, cargoResult, followupResult, summaryResult, alertsResult, committeeAuditResult, movementsResult] = await Promise.all([
      peopleQuery,
      supabase.from('personas').select('id, nombres, apellidos, estado_membresia, estado_civil, bautizado, fecha_nacimiento, fecha_ingreso, fecha_ultima_asistencia, familia_id').eq('congregacion_id', congregacionId),
      supabase.from('familias').select('id, nombre_familia, direccion, telefono').eq('congregacion_id', congregacionId).order('nombre_familia'),
      supabase.from('familia_miembros').select('id, familia_id, persona_id, parentesco, es_referente, familias!inner(congregacion_id)').eq('familias.congregacion_id', congregacionId),
      supabase.from('relaciones_familiares').select('id, persona_id, relacionada_id, tipo'),
      supabase.from('comites').select('id, nombre, codigo, descripcion, proposito, activo, fecha_inicio, fecha_fin, responsable_id, observaciones, membresias_comite(id, persona_id, cargo, cargo_id, estado, fecha_inicio, fecha_fin, motivo_retiro, reemplaza_membresia_id)').eq('congregacion_id', congregacionId).order('nombre'),
      supabase.from('cargos_comite').select('id, nombre, codigo, unico_por_comite, admite_suplente, orden, requiere_sellado').eq('congregacion_id', congregacionId).eq('activo', true).order('orden').order('nombre'),
      supabase.from('tipos_comite').select('id, nombre, codigo').eq('congregacion_id', congregacionId).eq('activo', true).order('nombre'),
      supabase.from('historial_cargos').select('id, persona_id, nombre_cargo, area, fecha_inicio, fecha_fin, observaciones').order('fecha_inicio', { ascending: false }),

      supabase.from('seguimientos_pastorales').select('id, persona_id, tipo_alerta, accion, notas, fecha, proxima_fecha, estado, usuario_id').eq('congregacion_id', congregacionId).order('proxima_fecha', { ascending: true, nullsFirst: false }),
      supabase.from('vw_resumen_feligresia').select('personas_activas, bautizados, sellados, apartados, familias_asociadas').eq('congregacion_id', congregacionId).maybeSingle(),
      supabase.from('vw_alertas_pastorales').select('*').order('mes', { ascending: false }),
      supabase.from('auditoria_feligresia').select('id, entidad, accion, usuario_id, creado_en').eq('congregacion_id', congregacionId).in('entidad', ['comites', 'membresias_comite']).order('creado_en', { ascending: false }).limit(100),
      supabase.from('movimientos_membresia').select('id, persona_id, tipo, fecha, congregacion_relacionada_id, observaciones, congregaciones_relacionada:congregacion_relacionada_id(nombre)').eq('congregacion_id', congregacionId).order('fecha', { ascending: false }),
    ])
    if (peopleResult.error || analyticsPeopleResult.error || familyResult.error || familyMembersResult.error || familyRelationsResult.error || committeeResult.error || committeeCargoResult.error || committeeTypeResult.error || cargoResult.error || followupResult.error || summaryResult.error || alertsResult.error || committeeAuditResult.error) setError('No se pudo cargar toda la información. Intenta nuevamente o contacta al administrador.')
    const freshData = {
      people: peopleResult.data ?? [],
      committeeCargoCatalog: committeeCargoResult.data ?? [],
      committeeTypes: committeeTypeResult.data ?? [],
      analyticsPeople: analyticsPeopleResult.data ?? [],
      peopleTotal: peopleResult.count ?? 0,
      families: familyResult.data ?? [],
      familyMembers: familyMembersResult.data ?? [],
      familyRelations: familyRelationsResult.data ?? [],
      allCommittees: committeeResult.data ?? [],
      cargoHistory: cargoResult.data ?? [],
      movimientosMembresia: movementsResult?.data ?? [],
      pastoralFollowups: followupResult.data ?? [],
      summary: summaryResult.data,
      pastoralAlerts: alertsResult.data ?? [],
      committeeAudit: committeeAuditResult.data ?? [],
    }
    setPeople(freshData.people)
    setCommitteeCargoCatalog(freshData.committeeCargoCatalog)
    setCommitteeTypes(freshData.committeeTypes)
    setAnalyticsPeople(freshData.analyticsPeople)
    setPeopleTotal(freshData.peopleTotal)
    setFamilies(freshData.families)
    setFamilyMembers(freshData.familyMembers)
    setFamilyRelations(freshData.familyRelations)
    setAllCommittees(freshData.allCommittees)
    setCargoHistory(freshData.cargoHistory)
    setMovimientosMembresia(freshData.movimientosMembresia)
    setPastoralFollowups(freshData.pastoralFollowups)
    setSummary(freshData.summary)
    setPastoralAlerts(freshData.pastoralAlerts)
    setCommitteeAudit(freshData.committeeAudit)
    setLoading(false)
    feligresiaCache.set(cacheKey, freshData)
  }

  useEffect(() => { load() }, [congregacionId, peoplePage, personStatus, deferredSearch, reloadToken])
  useEffect(() => {
    if (!congregacionId) return
    supabase.rpc('tiene_permiso', { p_congregacion_id: congregacionId, p_permiso: 'feligresia.editar' }).then(({ data }) => setCanEdit(Boolean(data)))
  }, [congregacionId])
  useEffect(() => { setPeoplePage(0) }, [personStatus, search])

  const today = new Date().toISOString().slice(0, 10)
  const committees = allCommittees.filter((committee) => {
    const active = committee.activo && (!committee.fecha_fin || committee.fecha_fin >= today)
    const validityMatch = committeeValidityFilter === 'todos' || (committeeValidityFilter === 'vigentes' && active) || (committeeValidityFilter === 'vencidos' && committee.fecha_fin && committee.fecha_fin < today)
    const statusMatch = committeeStatusFilter === 'todos' || (committeeStatusFilter === 'activos' && committee.activo) || (committeeStatusFilter === 'inactivos' && !committee.activo)
    const personMatch = !committeePersonFilter || (committee.membresias_comite ?? []).some((member) => member.persona_id === committeePersonFilter)
    const cargoMatch = committeeCargoFilter === 'todos' || (committee.membresias_comite ?? []).some((member) => member.cargo_id === committeeCargoFilter)
    return statusMatch && validityMatch && personMatch && cargoMatch
  })

  useEffect(() => {
    const requestedTab = new URLSearchParams(location.search).get('tab')
    if (['personas', 'familias', 'comites', 'seguimiento', 'historial'].includes(requestedTab)) setTab(requestedTab)
    const personId = new URLSearchParams(location.search).get('persona')
    const person = people.find((item) => item.id === personId)
    if (person) editPerson(person)
  }, [people, location.search])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  async function savePerson(event) {
    event.preventDefault()
    if (!canEdit) { setError('Tu perfil solo permite consultar la feligresía.'); return }
    const nombres = String(form.nombres ?? '').trim()
    const apellidos = String(form.apellidos ?? '').trim()
    const telefono = String(form.telefono ?? '').trim()
    const observaciones = String(form.observaciones_pastorales ?? '').trim()
    if (!nombres || !apellidos) {
      setError('Completa nombres y apellidos antes de guardar la ficha.')
      setNotice(null)
      return
    }
    if (form.bautizado && !form.fecha_bautismo) {
      setError('Indica la fecha de bautismo para guardar a la persona como bautizada.')
      setNotice(null)
      return
    }
    if (form.sellado_espiritu_santo && !form.fecha_sellado) {
      setError('Indica la fecha en que fue sellada con el Espíritu Santo.')
      setNotice(null)
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    const payload = {
      nombres,
      apellidos,
      telefono: telefono || null,
      estado_membresia: form.estado_membresia,
      bautizado: Boolean(form.bautizado),
      fecha_nacimiento: form.fecha_nacimiento || null,
      estado_civil: form.estado_civil || 'soltero',
      fecha_bautismo: form.bautizado ? form.fecha_bautismo : null,
      sellado_espiritu_santo: Boolean(form.sellado_espiritu_santo),
      fecha_sellado: form.sellado_espiritu_santo ? form.fecha_sellado : null,
      fecha_ingreso: form.fecha_ingreso || null,
      fecha_ultima_asistencia: form.fecha_ultima_asistencia || null,
      familia_id: form.familia_id || null,
      parentesco_familiar: form.familia_id ? form.parentesco_familiar || null : null,
      observaciones_pastorales: observaciones || null,
      congregacion_id: congregacionId,
    }
    let result
    try {
      result = selected
        ? await withRequestTimeout(supabase.from('personas').update(payload).eq('id', selected.id))
        : await withRequestTimeout(supabase.from('personas').insert(payload))
    } catch (requestError) {
      setSaving(false)
      setError(requestError.message)
      return
    }
    setSaving(false)
    if (result.error) {
      const message = result.error.code === '42501'
        ? 'No tienes permisos para modificar esta congregación.'
        : result.error.code === 'PGRST204'
          ? 'Faltan datos de configuración para mostrar esta sección. Contacta al administrador.'
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
    if (!canEdit) { setError('Tu perfil no permite modificar familias.'); return }
    if (!familyName.trim()) { setError('Escribe un nombre para la familia.'); return }
    setSaving(true); setError(null); setNotice(null)
    const result = await supabase.from('familias').insert({ congregacion_id: congregacionId, nombre_familia: familyName.trim(), direccion: familyAddress.trim() || null, telefono: familyPhone.trim() || null })
    setSaving(false)
    if (result.error) { setError(`No se pudo crear la familia: ${result.error.message}`); return }
    setFamilyName(''); setFamilyAddress(''); setFamilyPhone(''); setNotice('Familia creada correctamente.'); load()
  }

  async function saveCommittee(event) {
    event.preventDefault()
    if (!canEdit) { setError('Tu perfil no permite modificar comités.'); return }
    if (!committeeName.trim()) { setError('Escribe un nombre para el comité.'); return }
    if (committeeEnd && committeeStart && committeeEnd < committeeStart) { setError('La fecha final no puede ser anterior a la fecha inicial.'); return }
    setSaving(true); setError(null); setNotice(null)
    const result = await supabase.from('comites').insert({ congregacion_id: congregacionId, nombre: committeeName.trim(), codigo: committeeCode.trim() || null, tipo_id: committeeType || null, descripcion: committeeDescription.trim() || null, proposito: committeePurpose.trim() || null, fecha_inicio: committeeStart || new Date().toISOString().slice(0, 10), fecha_fin: committeeEnd || null, responsable_id: committeeResponsible || null, observaciones: committeeNotes.trim() || null })
    setSaving(false)
    if (result.error) { setError(`No se pudo crear el comité: ${result.error.message}`); return }
    setCommitteeName(''); setCommitteeCode(''); setCommitteeType(''); setCommitteeDescription(''); setCommitteePurpose(''); setCommitteeStart(''); setCommitteeEnd(''); setCommitteeResponsible(''); setCommitteeNotes(''); setNotice('Comité creado correctamente.'); load()
  }

  async function assignCommittee(event) {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null)
    if (!canEdit) { setSaving(false); setError('Tu perfil no permite gestionar integrantes.'); return }
    const data = new FormData(event.currentTarget)
    const cargoValue = data.get('cargo_id') || data.get('cargo')
    const selectedCargo = committeeCargoCatalog.find((cargo) => cargo.id === cargoValue)
    const selectedPerson = people.find((person) => person.id === data.get('persona_id'))
    if (!selectedPerson?.bautizado) { setSaving(false); setError('Esta persona debe estar bautizada para pertenecer a un comité.'); return }
    if (selectedCargo?.requiere_sellado && !selectedPerson?.sellado_espiritu_santo) { setSaving(false); setError('Este cargo requiere que la persona esté sellada con el Espíritu Santo.'); return }
    const result = await supabase.from('membresias_comite').insert({ comite_id: data.get('comite_id'), persona_id: data.get('persona_id'), cargo_id: selectedCargo?.id || null, cargo: selectedCargo?.nombre || data.get('cargo') || null })
    setSaving(false)
    if (result.error) { setError(`No se pudo asignar el integrante: ${result.error.message}`); return }
    event.currentTarget.reset(); setNotice('Integrante asignado correctamente al comité.'); load()
  }

  async function renameFamily(family) {
    if (!canEdit) { setError('Tu perfil no permite modificar familias.'); return }
    setDialog({ title: 'Editar familia', fields: [{ name: 'nombre_familia', label: 'Nombre', value: family.nombre_familia, required: true }, { name: 'direccion', label: 'Dirección', value: family.direccion || '' }, { name: 'telefono', label: 'Teléfono', value: family.telefono || '' }], onSubmit: async (values) => {
      setSaving(true); setError(null)
      const result = await supabase.from('familias').update({ nombre_familia: values.nombre_familia.trim(), direccion: values.direccion.trim() || null, telefono: values.telefono.trim() || null }).eq('id', family.id).eq('congregacion_id', congregacionId)
      setSaving(false)
      if (result.error) { setError(`No se pudo actualizar la familia: ${result.error.message}`); return }
      setDialog(null); setNotice('Familia actualizada correctamente.'); load()
    } })
  }

  async function deactivateCommittee(committee) {
    if (!canEdit) { setError('Tu perfil no permite modificar comités.'); return }
    const nextActive = !committee.activo
    setDialog({ title: `${nextActive ? 'Reactivar' : 'Desactivar'} comité`, message: `Se ${nextActive ? 'reactivará' : 'desactivará'} “${committee.nombre}”.`, confirmLabel: nextActive ? 'Reactivar' : 'Desactivar', onConfirm: async () => {
      setSaving(true); setError(null)
      const result = await supabase.from('comites').update({ activo: nextActive }).eq('id', committee.id).eq('congregacion_id', congregacionId)
      setSaving(false)
      if (result.error) { setError(`No se pudo actualizar el comité: ${result.error.message}`); return }
      setDialog(null); setNotice(nextActive ? 'Comité reactivado.' : 'Comité desactivado.'); load()
    } })
  }

  async function renameCommittee(committee) {
    if (!canEdit) { setError('Tu perfil no permite modificar comités.'); return }
    setDialog({ title: 'Editar comité', fields: [{ name: 'nombre', label: 'Nombre', value: committee.nombre, required: true }, { name: 'codigo', label: 'Código interno', value: committee.codigo || '' }, { name: 'descripcion', label: 'Descripción', value: committee.descripcion || '' }, { name: 'fecha_inicio', label: 'Fecha de inicio', value: committee.fecha_inicio || '', type: 'date', required: true }, { name: 'fecha_fin', label: 'Fecha de finalización', value: committee.fecha_fin || '', type: 'date' }], onSubmit: async (values) => {
      if (values.fecha_fin && values.fecha_fin < values.fecha_inicio) { setError('La fecha final no puede ser anterior a la fecha inicial.'); return }
      setSaving(true); setError(null)
      const result = await supabase.from('comites').update({ nombre: values.nombre.trim(), codigo: values.codigo.trim() || null, descripcion: values.descripcion.trim() || null, fecha_inicio: values.fecha_inicio, fecha_fin: values.fecha_fin || null }).eq('id', committee.id).eq('congregacion_id', congregacionId)
      setSaving(false)
      if (result.error) { setError(`No se pudo actualizar el comité: ${result.error.message}`); return }
      setDialog(null); setNotice('Comité actualizado correctamente.'); load()
    } })
  }

  async function removeCommitteeMember(member) {
    if (!canEdit) { setError('Tu perfil no permite gestionar integrantes.'); return }
    setDialog({ title: 'Retirar integrante', message: 'La membresía se cerrará conservando el historial.', confirmLabel: 'Retirar', onConfirm: async () => {
      setSaving(true); setError(null)
      const result = await supabase.from('membresias_comite').update({ fecha_fin: new Date().toISOString().slice(0, 10), estado: 'historico', motivo_retiro: 'Retiro registrado desde Feligresía', usuario_cambio_id: (await supabase.auth.getUser()).data.user?.id || null }).eq('id', member.id)
      setSaving(false)
      if (result.error) { setError(`No se pudo retirar el integrante: ${result.error.message}`); return }
      setDialog(null); setNotice('Integrante retirado del comité.'); load()
    } })
  }

  function editCommitteeMember(member) {
    setDialog({ title: 'Editar responsabilidad', fields: [{ name: 'cargo_id', label: 'Cargo normalizado', value: member.cargo_id || '', type: 'select', options: committeeCargoCatalog.map((cargo) => ({ value: cargo.id, label: cargo.nombre })) }, { name: 'cargo', label: 'Cargo histórico o texto libre', value: member.cargo || '' }, { name: 'reemplazo_persona_id', label: 'Reemplazar por otra persona (opcional)', value: '', type: 'select', options: [{ value: '', label: 'Sin reemplazo' }, ...analyticsPeople.filter((person) => person.id !== member.persona_id && person.estado_membresia === 'activo').map((person) => ({ value: person.id, label: `${person.nombres} ${person.apellidos}` }))] }, { name: 'fecha_efectiva', label: 'Fecha efectiva del reemplazo', value: new Date().toISOString().slice(0, 10), type: 'date' }, { name: 'motivo', label: 'Motivo del cambio', value: '' }], onSubmit: async (values) => {
      setSaving(true); setError(null)
      let result
      try {
        if (values.reemplazo_persona_id) {
          result = await withRequestTimeout(supabase.rpc('reemplazar_membresia_comite', { p_membresia_id: member.id, p_persona_id: values.reemplazo_persona_id, p_cargo_id: values.cargo_id || null, p_cargo: values.cargo.trim() || null, p_fecha_efectiva: values.fecha_efectiva, p_motivo: values.motivo.trim() || null }))
        } else {
          result = await withRequestTimeout(supabase.from('membresias_comite').update({ cargo_id: values.cargo_id || null, cargo: values.cargo.trim() || null }).eq('id', member.id))
        }
      } catch (requestError) { setSaving(false); setError(requestError.message); return }
      setSaving(false)
      if (result.error) { setError(`No se pudo actualizar la responsabilidad: ${result.error.message}`); return }
      setDialog(null); setNotice(values.reemplazo_persona_id ? 'Responsabilidad reemplazada y registrada en el historial.' : 'Cargo del integrante actualizado.'); load()
    } })
  }

  async function savePastoralFollowup(event) {
    event.preventDefault()
    if (!canEdit) { setError('Tu perfil no permite registrar seguimientos.'); return }
    if (!selected) return
    const data = new FormData(event.currentTarget)
    const action = data.get('accion')?.toString().trim()
    if (!action) return
    const fecha = data.get('fecha') || new Date().toISOString().slice(0, 10)
    const proximaFecha = data.get('proxima_fecha') || null
    if (proximaFecha && proximaFecha < fecha) { setError('El próximo contacto no puede ser anterior a la fecha realizada.'); return }
    setSaving(true); setError(null)
    const result = await supabase.from('seguimientos_pastorales').insert({
      congregacion_id: congregacionId,
      persona_id: selected.id,
      tipo_alerta: data.get('tipo_alerta') || null,
      accion: action,
      notas: data.get('notas')?.toString().trim() || null,
      fecha,
      proxima_fecha: proximaFecha,
      estado: proximaFecha ? 'pendiente' : 'completado',
    })
    setSaving(false)
    if (result.error) { setError(`No se pudo registrar el seguimiento: ${result.error.message}`); return }
    event.currentTarget.reset()
    setNotice('Seguimiento pastoral registrado.'); load()
  }

  async function saveCargo(event) {
    event.preventDefault()
    if (!canEdit) { setError('Tu perfil no permite modificar cargos.'); return }
    if (!selected) return
    const data = new FormData(event.currentTarget)
    const nombreCargo = data.get('nombre_cargo')?.toString().trim()
    if (!nombreCargo) return
    setSaving(true); setError(null)
    const fechaInicio = data.get('fecha_inicio') || new Date().toISOString().slice(0, 10)
    const fechaFin = data.get('fecha_fin') || null
    if (fechaFin && fechaFin < fechaInicio) { setSaving(false); setError('La fecha de finalización no puede ser anterior a la fecha de inicio.'); return }
    let result
    try {
      result = await withRequestTimeout(supabase.from('historial_cargos').insert({
        persona_id: selected.id,
        nombre_cargo: nombreCargo,
        area: data.get('area')?.toString().trim() || null,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        observaciones: data.get('observaciones')?.toString().trim() || null,
      }))
    } catch (requestError) {
      setSaving(false); setError(requestError.message); return
    }
    setSaving(false)
    if (result.error) { setError(`No se pudo registrar el cargo: ${result.error.message}`); return }
    event.currentTarget.reset()
    setNotice('Cargo histórico registrado.'); load()
  }

  async function saveMovimiento(event) {
    event.preventDefault()
    if (!canEdit) { setError('Tu perfil no permite registrar movimientos de membresía.'); return }
    if (!selected) return
    const form = event.currentTarget
    const data = new FormData(form)
    const tipo = data.get('tipo')?.toString()
    if (!tipo) return
    setSaving(true); setError(null)
    let result
    try {
      result = await withRequestTimeout(supabase.from('movimientos_membresia').insert({
        persona_id: selected.id,
        congregacion_id: congregacionId,
        tipo,
        fecha: data.get('fecha') || new Date().toISOString().slice(0, 10),
        observaciones: data.get('observaciones')?.toString().trim() || null,
      }))
    } catch (requestError) {
      setSaving(false); setError(requestError.message); return
    }
    setSaving(false)
    if (result.error) { setError(`No se pudo registrar el movimiento: ${result.error.message}`); return }
    form.reset()
    setNotice('Movimiento de membresía registrado.'); load()
  }

  async function attendPastoralAlert(alert) {
    if (!canEdit) { setError('Tu perfil solo permite consultar alertas.'); return }
    setDialog({ title: 'Atender alerta pastoral', message: alert.detalle, fields: [{ name: 'accion', label: 'Acción realizada', value: '', required: true }, { name: 'fecha', label: 'Fecha realizada', value: new Date().toISOString().slice(0, 10), required: true, type: 'date' }, { name: 'proxima_fecha', label: 'Próximo contacto (opcional)', value: '', type: 'date' }, { name: 'notas', label: 'Notas', value: '' }], onSubmit: (values) => saveAlertAttention(alert, values) })
  }

  async function saveAlertAttention(alert, values) {
    if (values.proxima_fecha && values.proxima_fecha < values.fecha) { setError('El próximo contacto no puede ser anterior a la fecha realizada.'); return }
    setSaving(true); setError(null)
    if (alert.persona_id) {
      const followup = await withRequestTimeout(supabase.from('seguimientos_pastorales').insert({ congregacion_id: alert.congregacion_id, persona_id: alert.persona_id, tipo_alerta: alert.tipo, accion: values.accion.trim(), notas: values.notas.trim() || alert.detalle, fecha: values.fecha, proxima_fecha: values.proxima_fecha || null, estado: values.proxima_fecha ? 'pendiente' : 'completado' }))
      if (followup.error) { setSaving(false); setError(`No se pudo registrar el seguimiento: ${followup.error.message}`); return }
    }
    const result = await withRequestTimeout(supabase.from('estados_alerta_pastoral').upsert({ clave: alert.clave, congregacion_id: alert.congregacion_id, estado: 'atendida', notas: `${values.accion.trim()}${values.notas.trim() ? `: ${values.notas.trim()}` : ''}` }, { onConflict: 'clave' }))
    setSaving(false)
    if (result.error) { setError(`No se pudo cerrar la alerta: ${result.error.message}`); return }
    setDialog(null); setNotice('Alerta atendida correctamente.'); load()
  }

  async function updateFollowupStatus(followup, estado) {
    if (!canEdit) { setError('Tu perfil solo permite consultar seguimientos.'); return }
    if (estado === 'pendiente' && !followup.proxima_fecha) {
      setDialog({ title: 'Reabrir seguimiento', message: 'Un seguimiento pendiente necesita una próxima fecha de contacto.', fields: [{ name: 'proxima_fecha', label: 'Próximo contacto', value: new Date().toISOString().slice(0, 10), required: true, type: 'date' }], onSubmit: (values) => saveFollowupReopen(followup, values.proxima_fecha) })
      return
    }
    setSaving(true); setError(null)
    const result = await withRequestTimeout(supabase.from('seguimientos_pastorales').update({ estado }).eq('id', followup.id).eq('congregacion_id', congregacionId))
    setSaving(false)
    if (result.error) { setError(`No se pudo actualizar el seguimiento: ${result.error.message}`); return }
    setNotice(estado === 'completado' ? 'Seguimiento completado.' : 'Seguimiento cancelado.'); load()
  }

  async function saveFollowupReopen(followup, proximaFecha) {
    setSaving(true); setError(null)
    const result = await withRequestTimeout(supabase.from('seguimientos_pastorales').update({ estado: 'pendiente', proxima_fecha: proximaFecha }).eq('id', followup.id).eq('congregacion_id', congregacionId))
    setSaving(false)
    if (result.error) { setError(`No se pudo reabrir el seguimiento: ${result.error.message}`); return }
    setDialog(null); setNotice('Seguimiento reabierto.'); load()
  }

  async function openPersonFromFollowup(personaId) {
    const visiblePerson = people.find((person) => person.id === personaId)
    if (visiblePerson) { editPerson(visiblePerson); return }
    const result = await withRequestTimeout(supabase.from('personas').select('id, nombres, apellidos, telefono, fecha_nacimiento, fecha_ingreso, estado_membresia, estado_civil, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ultima_asistencia, familia_id, parentesco_familiar, observaciones_pastorales, familias(nombre_familia)').eq('id', personaId).maybeSingle())
    if (result.error || !result.data) { setError('No se pudo abrir la ficha de la persona.'); return }
    editPerson(result.data)
  }

  function editCargo(cargo) {
    setDialog({ title: 'Editar cargo', fields: [{ name: 'nombre_cargo', label: 'Nombre del cargo', value: cargo.nombre_cargo, required: true }, { name: 'area', label: 'Área', value: cargo.area || '' }, { name: 'fecha_inicio', label: 'Desde', value: cargo.fecha_inicio || '', required: true, type: 'date' }, { name: 'fecha_fin', label: 'Hasta (opcional)', value: cargo.fecha_fin || '', type: 'date' }, { name: 'observaciones', label: 'Observaciones', value: cargo.observaciones || '' }], onSubmit: async (values) => {
      if (values.fecha_fin && values.fecha_fin < values.fecha_inicio) { setError('La fecha de finalización no puede ser anterior a la fecha de inicio.'); return }
      setSaving(true); setError(null)
      let result
      try {
        result = await withRequestTimeout(supabase.from('historial_cargos').update({ nombre_cargo: values.nombre_cargo.trim(), area: values.area.trim() || null, fecha_inicio: values.fecha_inicio, fecha_fin: values.fecha_fin || null, observaciones: values.observaciones.trim() || null }).eq('id', cargo.id))
      } catch (requestError) { setSaving(false); setError(requestError.message); return }
      setSaving(false)
      if (result.error) { setError(`No se pudo actualizar el cargo: ${result.error.message}`); return }
      setDialog(null); setNotice('Cargo actualizado correctamente.'); load()
    } })
  }

  async function exportPeople() {
    if (!congregacionId) return
    let query = supabase.from('personas').select('nombres, apellidos, telefono, fecha_nacimiento, estado_civil, estado_membresia, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ingreso, fecha_ultima_asistencia, parentesco_familiar, familias(nombre_familia)').eq('congregacion_id', congregacionId).order('apellidos').order('nombres')
    if (personStatus !== 'todos') query = query.eq('estado_membresia', personStatus)
    if (deferredSearch.trim()) query = query.or(`nombres.ilike.%${deferredSearch.trim()}%,apellidos.ilike.%${deferredSearch.trim()}%`)
    const result = await query
    if (result.error) { setError('No se pudo exportar el censo.'); return }
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['Nombres', 'Apellidos', 'Teléfono', 'Fecha nacimiento', 'Estado civil', 'Estado', 'Bautizado', 'Fecha bautismo', 'Sellado con el Espíritu Santo', 'Fecha sellado', 'Fecha ingreso', 'Última asistencia', 'Familia', 'Parentesco'],
      ...(result.data ?? []).map((person) => [person.nombres, person.apellidos, person.telefono, person.fecha_nacimiento, MARITAL_STATUSES[person.estado_civil] || person.estado_civil, STATES[person.estado_membresia], person.bautizado ? 'Sí' : 'No', person.fecha_bautismo, person.sellado_espiritu_santo ? 'Sí' : 'No', person.fecha_sellado, person.fecha_ingreso, person.fecha_ultima_asistencia, person.familias?.nombre_familia, FAMILY_RELATIONSHIPS[person.parentesco_familiar] || person.parentesco_familiar]),
    ]
    const csv = `\ufeff${rows.map((row) => row.map(escapeCsv).join(';')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = `censo-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url)
    setNotice('Censo exportado correctamente.')
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportError(null)
    setImportRowErrors([])
    try {
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      if (file.name.toLowerCase().endsWith('.csv')) await workbook.csv.load(file)
      else await workbook.xlsx.load(await file.arrayBuffer())
      const sheet = workbook.worksheets[0]
      if (!sheet) throw new Error('El archivo no contiene ninguna hoja.')
      const headers = sheet.getRow(1).values.slice(1).map((value) => String(value ?? ''))
      const rows = []
      sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) rows.push(Object.fromEntries(headers.map((header, index) => [header, row.getCell(index + 1).value ?? '']))) })
      const aliases = { nombres: ['nombres', 'nombre'], apellidos: ['apellidos', 'apellido'], telefono: ['telefono', 'teléfono', 'celular'], fecha_nacimiento: ['fecha nacimiento', 'fecha_nacimiento', 'nacimiento'], estado_civil: ['estado civil', 'estado_civil'], estado_membresia: ['estado', 'estado_membresia'], bautizado: ['bautizado'], fecha_bautismo: ['fecha bautismo', 'fecha_bautismo'], fecha_ingreso: ['fecha ingreso', 'fecha_ingreso'], fecha_ultima_asistencia: ['ultima asistencia', 'última asistencia', 'fecha_ultima_asistencia'], familia: ['familia', 'nombre familia'], parentesco_familiar: ['parentesco', 'parentesco familiar', 'parentesco_familiar'] }
      const normalize = (value) => String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ _-]+/g, ' ')
      const findValue = (row, names) => { const key = Object.keys(row).find((candidate) => names.includes(normalize(candidate))); return key ? row[key] : '' }
      const parsed = rows.slice(0, 500).map((row, index) => ({ row: index + 2, nombres: String(findValue(row, aliases.nombres)).trim(), apellidos: String(findValue(row, aliases.apellidos)).trim(), telefono: String(findValue(row, aliases.telefono)).trim(), fecha_nacimiento: findValue(row, aliases.fecha_nacimiento) || null, estado_civil: String(findValue(row, aliases.estado_civil) || 'soltero').trim().toLowerCase(), estado_membresia: String(findValue(row, aliases.estado_membresia) || 'activo').trim().toLowerCase(), bautizado: ['si', 'sí', 'true', '1'].includes(normalize(findValue(row, aliases.bautizado))), fecha_bautismo: findValue(row, aliases.fecha_bautismo) || null, fecha_ingreso: findValue(row, aliases.fecha_ingreso) || null, fecha_ultima_asistencia: findValue(row, aliases.fecha_ultima_asistencia) || null, familia: String(findValue(row, aliases.familia)).trim(), parentesco_familiar: String(findValue(row, aliases.parentesco_familiar)).trim() }))
      const invalid = parsed.find((row) => !row.nombres || !row.apellidos || !Object.prototype.hasOwnProperty.call(STATES, row.estado_membresia))
      if (invalid) throw new Error(`La fila ${invalid.row} requiere nombres, apellidos y un estado válido.`)
      if (!parsed.length) throw new Error('El archivo no contiene filas para importar.')
      const existingResult = await withRequestTimeout(supabase.from('personas').select('id, nombres, apellidos, telefono, familia_id').eq('congregacion_id', congregacionId))
      if (existingResult.error) throw new Error(`No se pudo comparar el archivo con el censo: ${existingResult.error.message}`)
      const normalizePhone = (value) => String(value ?? '').replace(/\D/g, '')
      const normalizeName = (value) => normalize(value).replace(/\s+/g, ' ')
      const findMatch = (row) => existingResult.data.find((person) => (normalizePhone(row.telefono) && normalizePhone(row.telefono) === normalizePhone(person.telefono)) || normalizeName(`${row.nombres} ${row.apellidos}`) === normalizeName(`${person.nombres} ${person.apellidos}`))
      setImportRows(parsed.map((row) => ({ ...row, match: findMatch(row), operation: findMatch(row) ? 'actualizar' : 'insertar' })))
    } catch (error) { setImportRows([]); setImportError(error.message || 'No se pudo leer el archivo.') }
  }

  async function importPeople() {
    if (!importRows.length) return
    setSaving(true); setImportError(null)
    setImportRowErrors([])
    const familyByName = new Map(families.map((family) => [family.nombre_familia.trim().toLowerCase(), family.id]))
    const errors = []
    let inserted = 0
    let updated = 0
    for (const row of importRows) {
      const payload = { nombres: row.nombres, apellidos: row.apellidos, telefono: row.telefono || null, fecha_nacimiento: row.fecha_nacimiento, estado_civil: row.estado_civil, estado_membresia: row.estado_membresia, bautizado: row.bautizado, fecha_bautismo: row.bautizado ? row.fecha_bautismo : null, fecha_ingreso: row.fecha_ingreso, fecha_ultima_asistencia: row.fecha_ultima_asistencia, familia_id: row.familia ? familyByName.get(row.familia.toLowerCase()) || null : null, parentesco_familiar: row.parentesco_familiar || null, congregacion_id: congregacionId }
      try {
        const result = row.match
          ? await withRequestTimeout(supabase.from('personas').update(payload).eq('id', row.match.id).eq('congregacion_id', congregacionId))
          : await withRequestTimeout(supabase.from('personas').insert(payload))
        if (result.error) errors.push(`Fila ${row.row}: ${result.error.message}`)
        else if (row.match) updated += 1
        else inserted += 1
      } catch (requestError) { errors.push(`Fila ${row.row}: ${requestError.message}`) }
    }
    setSaving(false)
    if (errors.length) { setImportRowErrors(errors); setImportError('Algunas filas no pudieron procesarse.'); load(); return }
    setImportRows([]); setNotice(`${inserted} personas nuevas y ${updated} actualizadas.`); load()
  }

  const filtered = people.filter((person) => (personStatus === 'todos' || person.estado_membresia === personStatus) && `${person.nombres} ${person.apellidos}`.toLowerCase().includes(deferredSearch.toLowerCase()))
  const totalPages = Math.max(1, Math.ceil(peopleTotal / peoplePageSize))
  const active = summary?.personas_activas ?? 0
  const baptized = summary?.bautizados ?? 0
  const sealed = summary?.sellados ?? 0
  const apart = summary?.apartados ?? 0
  const familiesWithPeople = summary?.familias_asociadas ?? 0
  function startNewPerson() { setSelected(null); setForm(EMPTY_PERSON); setShowForm(true) }
  function editPerson(person) { if (!canEdit) return; setSelected(person); setForm({ ...EMPTY_PERSON, ...person, fecha_bautismo: person.fecha_bautismo || '', fecha_sellado: person.fecha_sellado || '', fecha_ingreso: person.fecha_ingreso || '', fecha_ultima_asistencia: person.fecha_ultima_asistencia || '', familia_id: person.familia_id || '' }); setShowForm(true) }

  return <div className={`flex flex-col gap-6 ${canEdit ? '' : 'feligresia-read-only'}`}>
    {loading && <p role="status" className="text-sm text-muted bg-surface-1 rounded p-3">Cargando información de feligresía...</p>}
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Administración local</p><h1 className="text-2xl font-semibold">Feligresía</h1><p className="text-sm text-secondary mt-1">Censo, familias, comités y seguimiento pastoral.</p></div><div className="flex flex-wrap gap-2">{canEdit && <label className="btn-secondary cursor-pointer" title="Importar CSV o Excel"><Download className="w-4 h-4" /> Importar<input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} /></label>}<button onClick={exportPeople} className="btn-secondary" title="Exportar censo"><Download className="w-4 h-4" /> Exportar CSV</button>{canEdit && <button onClick={startNewPerson} className="btn-primary"><Plus className="w-4 h-4" /> Registrar persona</button>}</div></header>
    {!canEdit && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Modo consulta: tu perfil puede revisar la feligresía, pero no modificarla.</p>}
    {importError && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3"><p>{importError}</p>{importRowErrors.length > 0 && <ul className="mt-2 list-disc pl-5">{importRowErrors.map((message) => <li key={message}>{message}</li>)}</ul>}</div>}
    {importRows.length > 0 && <section className="card p-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-medium">Vista previa de importación</h2><p className="text-xs text-secondary mt-1">{importRows.length} filas listas. Las familias no encontradas quedarán sin asociación.</p></div><div className="flex gap-2"><button type="button" onClick={() => setImportRows([])} className="btn-secondary">Cancelar</button><button type="button" onClick={importPeople} disabled={saving} className="btn-primary">{saving ? 'Importando...' : 'Confirmar importación'}</button></div></div><div className="overflow-x-auto mt-3"><table className="w-full text-xs"><thead><tr className="text-left border-b border-border"><th className="py-2 pr-3">Nombre</th><th className="py-2 pr-3">Operación</th><th className="py-2 pr-3">Estado</th><th className="py-2 pr-3">Bautizado</th><th className="py-2">Familia</th></tr></thead><tbody>{importRows.slice(0, 5).map((row) => <tr key={row.row} className="border-b border-border"><td className="py-2 pr-3">{row.nombres} {row.apellidos}</td><td className={`py-2 pr-3 ${row.operation === 'actualizar' ? 'text-accent' : 'text-success'}`}>{row.operation}</td><td className="py-2 pr-3">{STATES[row.estado_membresia]}</td><td className="py-2 pr-3">{row.bautizado ? 'Sí' : 'No'}</td><td className="py-2">{row.familia || 'Sin familia'}</td></tr>)}</tbody></table></div></section>}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3"><Metric label="Personas activas" value={active} accent /><Metric label="Bautizados" value={baptized} /><Metric label="Sellados" value={sealed} /><Metric label="Apartados" value={apart} /><Metric label="Familias asociadas" value={familiesWithPeople} /></div>
    <nav className="flex gap-1 border-b border-border overflow-x-auto" aria-label="Secciones de feligresía" role="tablist">{[['personas', 'Población', UsersRound], ['familias', 'Familias', HeartHandshake], ['comites', 'Comités', HeartHandshake], ['seguimiento', 'Seguimiento pastoral', HeartHandshake], ['historial', 'Evolución', BarChart3]].map(([key, label, Icon]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 ${tab === key ? 'border-accent text-accent' : 'border-transparent text-secondary'}`}><Icon className="w-4 h-4" />{label}</button>)}</nav>
    {error && !showForm && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => setReloadToken((current) => current + 1)} className="btn-secondary text-xs self-start sm:self-auto">Reintentar</button></div>}
    {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}
    {tab === 'comites' && <><CommitteeFilters status={committeeStatusFilter} setStatus={setCommitteeStatusFilter} cargo={committeeCargoFilter} setCargo={setCommitteeCargoFilter} person={committeePersonFilter} setPerson={setCommitteePersonFilter} validity={committeeValidityFilter} setValidity={setCommitteeValidityFilter} cargos={committeeCargoCatalog} people={analyticsPeople} /><CommitteeCreateForm onSubmit={saveCommittee} saving={saving} name={committeeName} setName={setCommitteeName} code={committeeCode} setCode={setCommitteeCode} type={committeeType} setType={setCommitteeType} types={committeeTypes} description={committeeDescription} setDescription={setCommitteeDescription} purpose={committeePurpose} setPurpose={setCommitteePurpose} start={committeeStart} setStart={setCommitteeStart} end={committeeEnd} setEnd={setCommitteeEnd} responsible={committeeResponsible} setResponsible={setCommitteeResponsible} notes={committeeNotes} setNotes={setCommitteeNotes} people={analyticsPeople} /></>}
    {tab === 'seguimiento' && <><PastoralAgendaFilter value={pastoralAgendaStatus} onChange={setPastoralAgendaStatus} search={pastoralAgendaSearch} setSearch={setPastoralAgendaSearch} /><PastoralSection alerts={pastoralAlerts} followups={pastoralFollowups} people={analyticsPeople} saving={saving} onAttend={attendPastoralAlert} onUpdateFollowup={updateFollowupStatus} onOpenPerson={openPersonFromFollowup} canEdit={canEdit} agendaStatus={pastoralAgendaStatus} agendaSearch={pastoralAgendaSearch} /></>}
    {tab === 'personas' && <section className="card overflow-hidden"><div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3"><div className="flex items-center gap-2 flex-1"><Search className="w-4 h-4 text-muted" /><input aria-label="Buscar personas" className="bg-transparent outline-none text-sm w-full" placeholder="Buscar persona..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Filtrar estado" className="input-field sm:max-w-[180px]" value={personStatus} onChange={(event) => setPersonStatus(event.target.value)}><option value="todos">Todos los estados</option>{Object.entries(STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>{loading && people.length === 0 ? <SkeletonList rows={8} /> : filtered.length ? <div className="divide-y divide-border">{filtered.map((person) => <button key={person.id} onClick={() => editPerson(person)} className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-1"><div><p className="text-sm font-medium">{person.nombres} {person.apellidos}</p><p className="text-xs text-secondary mt-1">{person.bautizado ? 'Bautizado' : 'No bautizado'}{person.familias?.nombre_familia ? ` · ${person.familias.nombre_familia}` : ''}{person.fecha_ultima_asistencia ? ` · Última asistencia: ${person.fecha_ultima_asistencia}` : ''}</p></div><span className="text-xs px-2 py-1 rounded bg-surface-1">{STATES[person.estado_membresia]}</span></button>)}</div> : <Empty text="No hay personas con estos filtros." />}<div className="flex items-center justify-between border-t border-border p-3 text-xs text-secondary"><span>{peopleTotal} personas encontradas</span><div className="flex items-center gap-2"><button type="button" disabled={peoplePage === 0 || loading} onClick={() => setPeoplePage((page) => page - 1)} className="btn-secondary px-3">Anterior</button><span>Página {peoplePage + 1} de {totalPages}</span><button type="button" disabled={peoplePage + 1 >= totalPages || loading} onClick={() => setPeoplePage((page) => page + 1)} className="btn-secondary px-3">Siguiente</button></div></div></section>}
    {tab === 'familias' && <section className="flex flex-col gap-4">{canEdit && <form onSubmit={saveFamily} className="card p-4 grid sm:grid-cols-[1.2fr_1fr_0.8fr_auto] gap-2"><input required className="input-field" placeholder="Nombre de la nueva familia" value={familyName} onChange={(event) => setFamilyName(event.target.value)} /><input className="input-field" placeholder="Dirección" value={familyAddress} onChange={(event) => setFamilyAddress(event.target.value)} /><input className="input-field" placeholder="Teléfono" value={familyPhone} onChange={(event) => setFamilyPhone(event.target.value)} /><button disabled={saving} className="btn-primary whitespace-nowrap"><Plus className="w-4 h-4" /> Crear familia</button></form>}<div className="card p-4"><label className="text-sm">Consultar árbol familiar<select className="input-field mt-1.5" value={selectedFamilyId} onChange={(event) => setSelectedFamilyId(event.target.value)}><option value="">Selecciona un núcleo familiar</option>{families.map((family) => <option key={family.id} value={family.id}>{family.nombre_familia}</option>)}</select></label><p className="text-xs text-secondary mt-2">Un núcleo puede compartir personas con otra familia. La ficha de cada persona se mantiene única.</p></div><FamilyTree familyId={selectedFamilyId} families={families} members={familyMembers} relations={familyRelations} people={analyticsPeople} canEdit={canEdit} onOpenPerson={editPerson} onRefresh={() => setReloadToken((current) => current + 1)} /><div className="grid md:grid-cols-2 gap-4">{families.map((family) => <div key={family.id} className="card p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-medium">{family.nombre_familia}</h2>{canEdit && <button type="button" className="text-xs text-accent" onClick={() => renameFamily(family)}>Editar nombre</button>}</div>{(family.direccion || family.telefono) && <p className="text-xs text-secondary mt-2">{family.direccion || 'Sin dirección'}{family.telefono ? ` · ${family.telefono}` : ''}</p>}<p className="text-sm text-secondary mt-1">{analyticsPeople.filter((person) => person.familia_id === family.id).length} integrantes asociados</p>{analyticsPeople.filter((person) => person.familia_id === family.id).map((person) => <p key={person.id} className="text-xs text-muted mt-2">{person.nombres} {person.apellidos}</p>)}</div>)}</div>{families.length === 0 && <Empty text="Aún no hay familias registradas." />}</section>}
    {tab === 'comites' && <section className="flex flex-col gap-4"><form onSubmit={assignCommittee} className="card p-4 grid sm:grid-cols-3 gap-2"><select required name="comite_id" className="input-field"><option value="">Comité...</option>{committees.filter((committee) => committee.activo).map((committee) => <option key={committee.id} value={committee.id}>{committee.nombre}</option>)}</select><select required name="persona_id" className="input-field"><option value="">Integrante...</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><div className="flex gap-2">{committeeCargoCatalog.length > 0 ? <select required name="cargo_id" className="input-field"><option value="">Cargo...</option>{committeeCargoCatalog.map((cargo) => <option key={cargo.id} value={cargo.id}>{cargo.nombre}</option>)}</select> : <input required name="cargo" className="input-field" placeholder="Cargo (configúralos en Configuración)" />}<button disabled={saving} className="btn-secondary px-3" title="Asignar integrante"><Plus className="w-4 h-4" /></button></div></form><div className="grid md:grid-cols-2 gap-4">{committees.map((committee) => <div key={committee.id} className={`card p-5 ${!committee.activo ? 'opacity-60' : ''}`}><div className="flex items-start justify-between gap-3"><h2 className="font-medium">{committee.nombre}</h2><div className="flex gap-2"><button type="button" className="text-xs text-accent" onClick={() => renameCommittee(committee)}>Editar</button><button type="button" className="text-xs text-danger" onClick={() => deactivateCommittee(committee)}>{committee.activo ? 'Desactivar' : 'Reactivar'}</button></div></div><p className="text-sm text-secondary mt-1">{committee.membresias_comite?.filter((member) => !member.fecha_fin).length ?? 0} integrantes activos</p><div className="flex flex-col gap-2 mt-4">{committeeMemberGroups(committee, committeeCargoCatalog).map((group) => <div key={group.key}><p className="text-xs font-medium text-secondary">{group.label}{group.members.length > 1 ? ` (${group.members.length})` : ''}</p>{group.members.map((member) => <div key={member.id} className="flex items-center justify-between gap-2 mt-1"><span className="text-xs bg-surface-1 rounded px-2 py-1">{people.find((person) => person.id === member.persona_id)?.nombres || 'Integrante'} {people.find((person) => person.id === member.persona_id)?.apellidos || ''}</span><div className="flex gap-2"><button type="button" className="text-xs text-accent" onClick={() => editCommitteeMember(member)}>Editar</button><button type="button" className="text-xs text-danger" onClick={() => removeCommitteeMember(member)}>Retirar</button></div></div>)}</div>)}</div></div>)}</div>{committees.length === 0 && <Empty text="Aún no hay comités registrados." />}</section>}
    {tab === 'historial' && <><CommitteeAnalytics people={analyticsPeople} committees={allCommittees} cargos={committeeCargoCatalog} audit={committeeAudit} /><FeligresiaInsights people={analyticsPeople} families={families} committees={committees} cargoHistory={cargoHistory} followups={pastoralFollowups} alerts={pastoralAlerts} /></>}
    {showForm && <PersonFormDetailed form={form} setForm={setForm} families={families} committees={committees} cargoHistory={cargoHistory} pastoralFollowups={pastoralFollowups} movimientosMembresia={movimientosMembresia} canEdit={canEdit} saving={saving} editing={Boolean(selected)} selected={selected} error={error} close={() => { setShowForm(false); setError(null) }} onSubmit={savePerson} onSavePastoralFollowup={savePastoralFollowup} onSaveCargo={saveCargo} onEditCargo={editCargo} onSaveMovimiento={saveMovimiento} />}
    {dialog && <AdminDialog dialog={dialog} saving={saving} error={error} close={() => setDialog(null)} />}
  </div>
}

function FamilyTree({ familyId, families, members, relations, people, canEdit, onOpenPerson, onRefresh }) {
  const [memberForm, setMemberForm] = useState({ persona_id: '', parentesco: 'otro' })
  const [relationForm, setRelationForm] = useState({ persona_id: '', relacionada_id: '', tipo: 'padre' })
  const family = families.find((item) => item.id === familyId)
  const familyMembers = members.filter((item) => item.familia_id === familyId)
  const peopleById = new Map(people.map((person) => [person.id, person]))
  const groups = [['abuelo', 'Abuelos'], ['abuela', 'Abuelas'], ['padre', 'Padres'], ['madre', 'Madres'], ['conyuge', 'Cónyuges'], ['hijo', 'Hijos'], ['hija', 'Hijas'], ['nieto', 'Nietos'], ['nieta', 'Nietas'], ['hermano', 'Hermanos'], ['hermana', 'Hermanas'], ['nuera', 'Nueras'], ['yerno', 'Yernos'], ['referente', 'Referentes'], ['otro', 'Otros']]
  async function addMember(event) { event.preventDefault(); if (!familyId || !memberForm.persona_id) return; const result = await supabase.from('familia_miembros').insert({ familia_id: familyId, persona_id: memberForm.persona_id, parentesco: memberForm.parentesco, es_referente: memberForm.parentesco === 'referente' }); if (result.error) return; setMemberForm({ persona_id: '', parentesco: 'otro' }); onRefresh() }
  async function addRelation(event) { event.preventDefault(); if (!relationForm.persona_id || !relationForm.relacionada_id) return; const result = await supabase.from('relaciones_familiares').insert(relationForm); if (result.error) return; setRelationForm({ persona_id: '', relacionada_id: '', tipo: 'padre' }); onRefresh() }
  if (!family) return <div className="empty-state"><Empty text="Selecciona un núcleo para ver su árbol genealógico." /></div>
  return <section className="card p-5"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><p className="eyebrow">Estructura del núcleo</p><h2 className="font-medium mt-1">Árbol genealógico · {family.nombre_familia}</h2><p className="text-sm text-secondary mt-1">La misma persona puede pertenecer a varios núcleos; las relaciones muestran la jerarquía familiar.</p></div><span className="chart-highlight">{familyMembers.length} integrantes</span></div><div className="grid md:grid-cols-2 gap-3 mt-5">{groups.map(([key, label]) => { const group = familyMembers.filter((member) => member.parentesco === key); return group.length ? <div key={key} className="surface-panel p-3"><p className="text-xs uppercase tracking-[0.12em] text-accent">{label}</p>{group.map((member) => { const person = peopleById.get(member.persona_id); return <button type="button" key={member.id} onClick={() => person && onOpenPerson(person)} className="block text-sm text-left mt-2 hover:text-accent">{person ? `${person.nombres} ${person.apellidos}` : 'Persona'}<span className="block text-xs text-muted">{person?.fecha_nacimiento ? `Edad registrada · ${person.fecha_nacimiento}` : 'Sin fecha de nacimiento'}</span></button> })}</div> : null })}</div>{relations.length > 0 && <div className="mt-5 border-t border-border pt-4"><p className="text-xs uppercase tracking-[0.12em] text-accent">Relaciones registradas</p><div className="grid md:grid-cols-2 gap-2 mt-2">{relations.filter((relation) => familyMembers.some((member) => member.persona_id === relation.persona_id || member.persona_id === relation.relacionada_id)).map((relation) => <p key={relation.id} className="text-sm text-secondary">{peopleById.get(relation.persona_id)?.nombres || 'Persona'} <span className="text-muted">{relation.tipo}</span> {peopleById.get(relation.relacionada_id)?.nombres || 'Persona'}</p>)}</div></div>}{canEdit && <div className="grid md:grid-cols-2 gap-4 mt-5 border-t border-border pt-4"><form onSubmit={addMember} className="flex flex-col gap-2"><p className="text-sm font-medium">Agregar al núcleo</p><select required className="input-field" value={memberForm.persona_id} onChange={(event) => setMemberForm({ ...memberForm, persona_id: event.target.value })}><option value="">Seleccionar persona</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><select className="input-field" value={memberForm.parentesco} onChange={(event) => setMemberForm({ ...memberForm, parentesco: event.target.value })}>{groups.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="btn-secondary">Agregar vínculo</button></form><form onSubmit={addRelation} className="flex flex-col gap-2"><p className="text-sm font-medium">Registrar relación</p><select required className="input-field" value={relationForm.persona_id} onChange={(event) => setRelationForm({ ...relationForm, persona_id: event.target.value })}><option value="">Persona de origen</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><select required className="input-field" value={relationForm.relacionada_id} onChange={(event) => setRelationForm({ ...relationForm, relacionada_id: event.target.value })}><option value="">Persona relacionada</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><select className="input-field" value={relationForm.tipo} onChange={(event) => setRelationForm({ ...relationForm, tipo: event.target.value })}>{[['padre', 'Padre de'], ['madre', 'Madre de'], ['hijo', 'Hijo/a de'], ['conyuge', 'Cónyuge de'], ['hermano', 'Hermano/a de']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="btn-secondary">Registrar relación</button></form></div>}</section>
}

function PastoralAgendaFilter({ value, onChange, search, setSearch }) {
  return <section className="card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><h2 className="font-medium">Agenda pastoral</h2><p className="text-xs text-secondary mt-1">Consulta el estado de tus seguimientos programados.</p></div><div className="flex flex-col sm:flex-row gap-2"><div className="flex items-center gap-2 input-field"><Search className="w-4 h-4 text-muted" /><input aria-label="Buscar seguimientos" className="bg-transparent outline-none text-sm w-full" placeholder="Buscar persona o acción..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Filtrar seguimientos por estado" className="input-field text-xs sm:max-w-[220px]" value={value} onChange={(event) => onChange(event.target.value)}><option value="pendiente">Pendientes</option><option value="completado">Completados</option><option value="cancelado">Cancelados</option><option value="todos">Todos los estados</option></select></div></section>
}

function PastoralSection({ alerts, followups, people, saving, onAttend, onUpdateFollowup, onOpenPerson, canEdit, agendaStatus, agendaSearch }) {
  const [alertType, setAlertType] = useState('todos')
  const [alertPriority, setAlertPriority] = useState('todos')
  const [showHistory, setShowHistory] = useState(false)
  const [expandedAlertGroups, setExpandedAlertGroups] = useState(() => new Set())
  const today = new Date().toISOString().slice(0, 10)
  const normalizedSearch = agendaSearch.trim().toLowerCase()
  const agenda = followups.filter((item) => {
    if (agendaStatus !== 'todos' && item.estado !== agendaStatus) return false
    const person = people.find((candidate) => candidate.id === item.persona_id)
    return !normalizedSearch || `${person?.nombres || ''} ${person?.apellidos || ''} ${item.accion || ''}`.toLowerCase().includes(normalizedSearch)
  }).sort((a, b) => (a.proxima_fecha || '9999').localeCompare(b.proxima_fecha || '9999'))
  const filteredAlerts = alerts.filter((alert) => (alertType === 'todos' || alert.tipo === alertType) && (alertPriority === 'todos' || alert.prioridad === alertPriority))
  const alertGroups = Object.values(filteredAlerts.reduce((groups, alert) => {
    (groups[alert.tipo] ??= { tipo: alert.tipo, items: [] }).items.push(alert)
    return groups
  }, {}))
  const completed = followups.filter((item) => item.estado !== 'pendiente')
  return <div className="flex flex-col gap-4"><section className="card p-5"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h2 className="font-medium">Agenda de acompañamiento</h2><p className="text-sm text-secondary mt-1">Seguimientos programados, vencidos y próximos.</p></div><div className="flex gap-2"><select aria-label="Filtrar alertas por tipo" className="input-field text-xs" value={alertType} onChange={(event) => setAlertType(event.target.value)}><option value="todos">Todos los tipos</option><option value="familia">Familia</option><option value="bautismo">Bautismo</option><option value="asistencia_persona">Asistencia</option><option value="comite">Comité</option><option value="asistencia">Tendencia</option></select><select aria-label="Filtrar alertas por prioridad" className="input-field text-xs" value={alertPriority} onChange={(event) => setAlertPriority(event.target.value)}><option value="todos">Todas las prioridades</option><option value="alta">Alta</option><option value="media">Media</option></select></div></div>{agenda.length ? <div className="flex flex-col divide-y divide-border mt-4">{agenda.map((item) => { const person = people.find((candidate) => candidate.id === item.persona_id); const overdue = item.proxima_fecha && item.proxima_fecha < today; return <div key={item.id} className="py-3 flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{person ? `${person.nombres} ${person.apellidos}` : 'Persona'}</p><p className="text-xs text-secondary mt-1">{item.accion}{item.proxima_fecha ? ` · ${overdue ? 'Vencido' : 'Próximo'}: ${item.proxima_fecha}` : ''}</p>{item.notas && <p className="text-xs text-muted mt-1">{item.notas}</p>}</div><div className="flex gap-2 text-xs"><button type="button" onClick={() => onOpenPerson(item.persona_id)} className="text-accent">Ver ficha</button><button type="button" disabled={saving} onClick={() => onUpdateFollowup(item, 'completado')} className="text-success">Completar</button><button type="button" disabled={saving} onClick={() => onUpdateFollowup(item, 'cancelado')} className="text-danger">Cancelar</button></div></div> })}</div> : <Empty text="No hay seguimientos programados." />}<button type="button" onClick={() => setShowHistory((value) => !value)} className="text-xs text-accent mt-3">{showHistory ? 'Ocultar historial' : `Ver historial (${completed.length})`}</button>{showHistory && completed.map((item) => { const person = people.find((candidate) => candidate.id === item.persona_id); return <div key={item.id} className="border-t border-border py-3 flex justify-between gap-3"><div><p className="text-sm">{person ? `${person.nombres} ${person.apellidos}` : 'Persona'} · {item.accion}</p><p className="text-xs text-muted">{item.fecha} · {item.estado}</p></div><div className="flex gap-2 text-xs"><button type="button" onClick={() => onOpenPerson(item.persona_id)} className="text-accent">Ver ficha</button><button type="button" disabled={saving} onClick={() => onUpdateFollowup(item, 'pendiente')} className="text-accent">Reabrir</button></div></div>})}</section><section className="card p-5"><h2 className="font-medium">Alertas pendientes{filteredAlerts.length > 0 ? ` (${filteredAlerts.length})` : ''}</h2>{alertGroups.length ? <div className="flex flex-col divide-y divide-border mt-4">{alertGroups.map((group) => { const expanded = expandedAlertGroups.has(group.tipo); const visible = expanded ? group.items : group.items.slice(0, 3); const hidden = group.items.length - visible.length; return <div key={group.tipo} className="py-3"><p className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2">{ALERT_TYPE_LABELS[group.tipo] || group.tipo} ({group.items.length})</p><div className="flex flex-col divide-y divide-border">{visible.map((alert) => <div key={alert.clave} className="py-3 flex items-start justify-between gap-3"><div><span className={`alert-priority ${alert.prioridad === 'alta' ? 'alert-priority-high' : ''}`}>{alert.prioridad}</span><p className="text-sm font-medium mt-2">{alert.titulo}</p><p className="text-xs text-secondary mt-1">{alert.detalle}</p></div><button type="button" disabled={saving} onClick={() => onAttend(alert)} className="text-xs text-accent flex-shrink-0">Atender</button></div>)}</div>{hidden > 0 && <button type="button" onClick={() => setExpandedAlertGroups((current) => new Set(current).add(group.tipo))} className="text-xs text-accent mt-2">Ver {hidden} más de este tipo</button>}</div> })}</div> : <Empty text="No hay alertas con estos filtros." />}</section></div>
}

function CommitteeFilters({ status, setStatus, cargo, setCargo, person, setPerson, validity, setValidity, cargos, people }) {
  return <section className="card p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2"><select aria-label="Filtrar comités por estado" className="input-field" value={status} onChange={(event) => setStatus(event.target.value)}><option value="todos">Todos los estados</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option></select><select aria-label="Filtrar comités por vigencia" className="input-field" value={validity} onChange={(event) => setValidity(event.target.value)}><option value="todos">Toda vigencia</option><option value="vigentes">Vigentes</option><option value="vencidos">Vencidos</option></select><select aria-label="Filtrar comités por cargo" className="input-field" value={cargo} onChange={(event) => setCargo(event.target.value)}><option value="todos">Todos los cargos</option>{cargos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><select aria-label="Filtrar comités por integrante" className="input-field" value={person} onChange={(event) => setPerson(event.target.value)}><option value="">Todos los integrantes</option>{people.map((item) => <option key={item.id} value={item.id}>{item.nombres} {item.apellidos}</option>)}</select></section>
}

function CommitteeCreateForm({ onSubmit, saving, name, setName, code, setCode, type, setType, types, description, setDescription, purpose, setPurpose, start, setStart, end, setEnd, responsible, setResponsible, notes, setNotes, people }) {
  return <form onSubmit={onSubmit} className="card p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><div className="sm:col-span-2"><label className="text-sm">Nombre<input required className="input-field mt-1.5" value={name} onChange={(event) => setName(event.target.value)} /></label></div><label className="text-sm">Código interno<input className="input-field mt-1.5" value={code} onChange={(event) => setCode(event.target.value)} /></label><label className="text-sm">Tipo<select className="input-field mt-1.5" value={type} onChange={(event) => setType(event.target.value)}><option value="">Sin tipo</option>{types.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="text-sm">Fecha de inicio<input required type="date" className="input-field mt-1.5" value={start} onChange={(event) => setStart(event.target.value)} /></label><label className="text-sm">Fecha de finalización<input type="date" className="input-field mt-1.5" value={end} onChange={(event) => setEnd(event.target.value)} /></label><label className="text-sm">Responsable<select className="input-field mt-1.5" value={responsible} onChange={(event) => setResponsible(event.target.value)}><option value="">Sin responsable</option>{people.filter((person) => person.estado_membresia === 'activo').map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select></label><label className="text-sm sm:col-span-2">Descripción<textarea className="input-field mt-1.5 min-h-16" value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="text-sm sm:col-span-2">Propósito<textarea className="input-field mt-1.5 min-h-16" value={purpose} onChange={(event) => setPurpose(event.target.value)} /></label><label className="text-sm sm:col-span-2">Observaciones<textarea className="input-field mt-1.5 min-h-16" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="sm:col-span-2 lg:col-span-4 flex justify-end"><button disabled={saving} className="btn-primary"><Plus className="w-4 h-4" />{saving ? 'Guardando...' : 'Crear comité'}</button></div></form>
}

function AdminDialog({ dialog, saving, error, close }) {
  const [values, setValues] = useState(() => Object.fromEntries((dialog.fields ?? []).map((field) => [field.name, field.value || ''])))
  useEffect(() => {
    const handleKeyDown = (event) => { if (event.key === 'Escape' && !saving) close() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [close, saving])
  const submit = (event) => { event.preventDefault(); if (dialog.onSubmit) dialog.onSubmit(values); else dialog.onConfirm() }
  return <div className="fixed inset-0 z-[60] bg-ink/30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title"><form onSubmit={submit} className="w-full max-w-md bg-surface-2 rounded-card shadow-xl p-6"><h2 id="admin-dialog-title" className="font-medium">{dialog.title}</h2>{dialog.message && <p className="text-sm text-secondary mt-2">{dialog.message}</p>}{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mt-3">{error}</p>}{dialog.fields && <div className="flex flex-col gap-3 mt-4">{dialog.fields.map((field) => <label key={field.name} className="text-sm">{field.label}{field.type === 'select' ? <select required={field.required} className="input-field mt-1.5" value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input required={field.required} type={field.type || 'text'} className="input-field mt-1.5" value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />}</label>)}</div>}<div className="flex justify-end gap-2 mt-6"><button type="button" onClick={close} className="btn-secondary">Cancelar</button><button disabled={saving} className="btn-primary">{saving ? 'Guardando...' : dialog.confirmLabel || 'Guardar'}</button></div></form></div>
}

function PastoralFollowupPanel({ person, followups, saving, onSubmit, embedded = false }) {
  const personFollowups = followups.filter((item) => item.persona_id === person?.id)
  return <section className={`${embedded ? '' : 'fixed z-50 right-4 bottom-4 w-[min(24rem,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto bg-surface-2 border border-border rounded-card shadow-xl'} p-4`}><div className="flex items-start justify-between gap-3 mb-3"><div><h2 className="font-medium">Seguimiento pastoral</h2><p className="text-xs text-secondary mt-1">{person.nombres} {person.apellidos}</p></div><span className="text-xs text-muted">{personFollowups.length} registros</span></div><form onSubmit={onSubmit} className="flex flex-col gap-2 border-b border-border pb-4"><select name="tipo_alerta" className="input-field text-sm" defaultValue=""><option value="">Tipo de situación...</option><option value="familia">Familia</option><option value="bautismo">Bautismo</option><option value="asistencia_persona">Asistencia</option><option value="general">General</option></select><input required name="accion" className="input-field text-sm" placeholder="Acción realizada" /><div className="grid grid-cols-2 gap-2"><label className="text-xs text-secondary">Fecha realizada<input required name="fecha" type="date" className="input-field text-sm mt-1" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label className="text-xs text-secondary">Próximo contacto<input name="proxima_fecha" type="date" className="input-field text-sm mt-1" /></label></div><textarea name="notas" className="input-field text-sm min-h-16" placeholder="Notas del acompañamiento" /><button disabled={saving} className="btn-primary justify-center">{saving ? 'Guardando...' : 'Registrar seguimiento'}</button></form><div className="flex flex-col divide-y divide-border">{personFollowups.length ? personFollowups.map((item) => <div key={item.id} className="py-3"><div className="flex justify-between gap-2"><p className="text-sm font-medium">{item.accion}</p><span className={`text-xs ${item.estado === 'completado' ? 'text-success' : item.estado === 'cancelado' ? 'text-muted' : 'text-accent'}`}>{item.estado || 'pendiente'}</span></div><p className="text-xs text-muted mt-1">{item.fecha}{item.proxima_fecha ? ` · Próximo: ${item.proxima_fecha}` : ''}{item.tipo_alerta ? ` · ${item.tipo_alerta}` : ''}</p>{item.notas && <p className="text-xs text-secondary mt-1">{item.notas}</p>}</div>) : <p className="text-xs text-muted py-4">Aún no hay seguimientos registrados.</p>}</div></section>
}
function CargoPanel({ person, cargos, saving, onSubmit, onEdit, embedded = false }) {
  const personCargos = cargos.filter((item) => item.persona_id === person?.id)
  return <section className={`${embedded ? '' : 'fixed z-50 right-4 bottom-[calc(75vh+1rem)] w-[min(24rem,calc(100vw-2rem))] max-h-[30vh] overflow-y-auto bg-surface-2 border border-border rounded-card shadow-xl'} p-4`}><h2 className="font-medium">Historial de cargos</h2><form onSubmit={onSubmit} className="grid grid-cols-2 gap-2 mt-3"><input required name="nombre_cargo" className="input-field text-sm col-span-2" placeholder="Nombre del cargo" /><input name="area" className="input-field text-sm" placeholder="Área" /><label className="text-xs text-secondary">Desde<input required name="fecha_inicio" type="date" aria-label="Fecha desde" className="input-field text-sm mt-1" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label className="text-xs text-secondary">Hasta (opcional)<input name="fecha_fin" type="date" aria-label="Fecha hasta opcional" className="input-field text-sm mt-1" /></label><input name="observaciones" className="input-field text-sm col-span-2" placeholder="Observaciones" /><button disabled={saving} className="btn-primary text-sm col-span-2 justify-center">{saving ? 'Guardando...' : 'Registrar cargo'}</button></form><div className="divide-y divide-border mt-3">{personCargos.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 py-2"><div><p className="text-xs font-medium">{item.nombre_cargo}{item.area ? ` · ${item.area}` : ''}</p><p className="text-xs text-muted">{item.fecha_inicio}{item.fecha_fin ? ` hasta ${item.fecha_fin}` : ' · Actual'}</p></div><button type="button" onClick={() => onEdit(item)} className="text-xs text-accent">Editar</button></div>)}</div></section>
}

const MOVIMIENTO_LABELS = { alta_bautismo: 'Alta por bautismo', alta_recibimiento: 'Alta por recibimiento (carta)', baja_traslado: 'Baja por traslado', baja_disciplina: 'Baja por disciplina', baja_exclusion: 'Baja por exclusión', reactivacion: 'Reactivación' }

function MembershipMovementsPanel({ person, movimientosMembresia, saving, onSubmit, embedded = false }) {
  const personMovements = (movimientosMembresia ?? []).filter((item) => item.persona_id === person?.id)
  return <section className={`${embedded ? '' : 'fixed z-50 right-4 bottom-4 w-[min(24rem,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto bg-surface-2 border border-border rounded-card shadow-xl'} p-4`}><h2 className="font-medium">Movimientos de membresía</h2><p className="text-xs text-secondary mt-1">Altas y bajas oficiales para la auditoría de estadísticas.</p><form onSubmit={onSubmit} className="flex flex-col gap-2 mt-3 border-b border-border pb-4"><select required name="tipo" className="input-field text-sm" defaultValue=""><option value="" disabled>Tipo de movimiento...</option>{Object.entries(MOVIMIENTO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="text-xs text-secondary">Fecha<input required name="fecha" type="date" className="input-field text-sm mt-1" defaultValue={new Date().toISOString().slice(0, 10)} /></label><input name="observaciones" className="input-field text-sm" placeholder="Observaciones" /><button disabled={saving} className="btn-primary text-sm justify-center">{saving ? 'Guardando...' : 'Registrar movimiento'}</button></form><div className="divide-y divide-border">{personMovements.length ? personMovements.map((item) => <div key={item.id} className="py-3"><p className="text-sm font-medium">{MOVIMIENTO_LABELS[item.tipo] || item.tipo}</p><p className="text-xs text-muted mt-1">{item.fecha}{item.congregaciones_relacionada?.nombre ? ` · ${item.congregaciones_relacionada.nombre}` : ''}</p>{item.observaciones && <p className="text-xs text-secondary mt-1">{item.observaciones}</p>}</div>) : <p className="text-xs text-muted py-4">Aún no hay movimientos registrados.</p>}</div></section>
}
function Metric({ label, value, accent }) {
  return (
    <div className={`summary-card summary-card-${accent ? 'default' : 'muted'} stat-tile`}>
      <div className="flex items-center justify-between gap-3"><p className="text-[10px] uppercase tracking-[0.16em] text-secondary">{label}</p><span className={`summary-marker ${accent ? 'bg-accent' : 'bg-muted'}`} aria-hidden="true" /></div>
      <p className="text-3xl font-semibold tracking-tight mt-3">{value}</p>
    </div>
  )
}

function Empty({ text }) {
  return <div className="p-10 text-center text-sm text-secondary bg-surface-1 rounded-card border border-dashed border-border">{text}</div>
}

function PersonForm({ form, setForm, families, saving, editing, error, close, onSubmit }) { return <div className="fixed inset-0 z-40 bg-ink/30 flex items-center justify-center p-4"><form onSubmit={onSubmit} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-2 rounded-card shadow-xl p-6"><div className="flex justify-between mb-5"><h2 className="font-medium">{editing ? 'Editar ficha de persona' : 'Registrar persona'}</h2><button type="button" aria-label="Cerrar" onClick={close} className="text-sm text-secondary hover:text-ink">Cerrar</button></div>{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mb-4">{error}</p>}<div className="grid sm:grid-cols-2 gap-3"><Field label="Nombres" required value={form.nombres} onChange={(value) => setForm({ ...form, nombres: value })} /><Field label="Apellidos" required value={form.apellidos} onChange={(value) => setForm({ ...form, apellidos: value })} /><Field label="Teléfono" value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value })} /><label className="text-sm">Estado<select className="input-field mt-1.5" value={form.estado_membresia} onChange={(event) => setForm({ ...form, estado_membresia: event.target.value })}>{Object.entries(STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><Field label="Fecha de ingreso" type="date" value={form.fecha_ingreso} onChange={(value) => setForm({ ...form, fecha_ingreso: value })} /><Field label="Última asistencia" type="date" value={form.fecha_ultima_asistencia} onChange={(value) => setForm({ ...form, fecha_ultima_asistencia: value })} /><label className="text-sm">Familia<select className="input-field mt-1.5" value={form.familia_id} onChange={(event) => setForm({ ...form, familia_id: event.target.value })}><option value="">Sin familia</option>{families.map((family) => <option key={family.id} value={family.id}>{family.nombre_familia}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.bautizado} onChange={(event) => setForm({ ...form, bautizado: event.target.checked })} /> Bautizado</label><Field label="Fecha de bautismo" type="date" value={form.fecha_bautismo} onChange={(value) => setForm({ ...form, fecha_bautismo: value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.sellado_espiritu_santo} onChange={(event) => setForm({ ...form, sellado_espiritu_santo: event.target.checked })} /> Sellado con el Espíritu Santo</label><Field label="Fecha de sellado" type="date" value={form.fecha_sellado} onChange={(value) => setForm({ ...form, fecha_sellado: value })} /></div><button disabled={saving} className="btn-primary w-full justify-center mt-5">{saving ? 'Guardando...' : 'Guardar ficha'}</button></form></div> }
function Field({ label, type = 'text', required, value, onChange }) { return <label className="text-sm">{label}<input required={required} type={type} className="input-field mt-1.5" value={value || ''} onChange={(event) => onChange(event.target.value)} /></label> }
