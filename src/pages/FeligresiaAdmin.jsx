import { useDeferredValue, useEffect, useState } from 'react'
import { ArrowRightLeft, Award, BarChart3, CheckCircle2, ChevronRight, ClipboardList, Clock, Download, Droplet, ExternalLink, Flame, Flower2, Heart, HeartHandshake, LogIn, Plus, Search, UsersRound, XCircle } from 'lucide-react'
import { Bar, Doughnut } from 'react-chartjs-2'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { UMBRAL_DIAS_NUEVO_BAUTIZADO, diasDesde } from '../lib/rutaEvangelistica'
import { getRangosEdadComite, sugerirComites } from '../lib/comitesPorPoblacion'
import { MOVIMIENTO_LABELS } from '../lib/movimientos'
import { descargarCertificadoDefuncion } from '../lib/certificadoDefuncion'
import { TELEFONO_TIPO_LABELS } from '../lib/contacto'
import { TIPO_SANGRE_OPCIONES, categoriasPrioridad } from '../lib/saludEmergencia'
import SignaturePad from '../components/SignaturePad'
import Empty from '../components/Empty'
import { ETIQUETA_TRIMESTRE, limitesInformeTrimestral, trimestreCerradoMasReciente, trimestreDe } from '../lib/trimestre'
import { useMiRol } from '../hooks/useMiRol'
import { usePreferencias } from '../hooks/usePreferencias'
import { formatFecha } from '../lib/dateFormat'
import { SkeletonList } from '../components/Skeleton'
import { chartOptions as buildChartOptions, gradientFill, distributionDataset } from '../lib/chartTheme'
import ChartEmpty from '../components/ChartEmpty'
import ExportButtons from '../components/ExportButtons'
import InfoTip from '../components/InfoTip'
import { descargarCsv, descargarExcel, descargarPdf } from '../lib/reportExport'
import { avatarTone, initialesDe } from '../lib/avatar'
import Toast from '../components/Toast'

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip)

const feligresiaCache = new Map()

const STATES = { activo: 'Activo', apartado: 'Apartado', trasladado: 'Trasladado', inactivo: 'Inactivo', fallecido: 'Fallecido' }
const STATE_BADGE_CLASS = {
  activo: 'bg-success-bg text-success',
  apartado: 'bg-warning-bg text-warning',
  trasladado: 'bg-accent-bg text-accent',
  inactivo: 'bg-surface-1 text-secondary',
  fallecido: 'bg-surface-1 text-secondary',
}
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
const EMPTY_PERSON = { nombres: '', apellidos: '', telefono: '', fecha_nacimiento: '', estado_membresia: 'activo', estado_civil: 'soltero', genero: '', bautizado: false, fecha_bautismo: '', sellado_espiritu_santo: false, fecha_sellado: '', fecha_ingreso: '', fecha_ultima_asistencia: '', familia_id: '', parentesco_familiar: '', observaciones_pastorales: '', conyuge_id: '', fecha_matrimonio: '', fecha_fallecimiento: '', notas_fallecimiento: '', tipo_documento: '', numero_documento: '', nivel_educativo: '', ocupacion: '', telefono_tipo: '', tiene_whatsapp: false, telefono_alterno: '', red_social: '', pais_bautismo: '', municipio_bautismo: '', congregacion_bautismo_id: '', congregacion_bautismo_nombre: '', pastor_bautizo: '', tipo_sangre: '', eps_nombre: '', condiciones_medicas: '', alergias: '', medicamentos_actuales: '', discapacidad: '', embarazada: false, fecha_probable_parto: '', contacto_emergencia_nombre: '', contacto_emergencia_telefono: '', contacto_emergencia_parentesco: '', autorizacion_datos_salud: false, fecha_autorizacion_datos_salud: '', consentimiento_datos_firma: '', fecha_consentimiento_datos: '' }
const MARITAL_STATUSES = { soltero: 'Soltero/a', casado: 'Casado/a', union_libre: 'Unión libre', divorciado: 'Divorciado/a', viudo: 'Viudo/a' }
const GENERO_LABELS = { masculino: 'Masculino', femenino: 'Femenino' }
const TIPO_DOCUMENTO_LABELS = { cedula_ciudadania: 'Cédula de ciudadanía', tarjeta_identidad: 'Tarjeta de identidad', cedula_extranjeria: 'Cédula de extranjería', pasaporte: 'Pasaporte', registro_civil: 'Registro civil', otro: 'Otro' }
const NIVEL_EDUCATIVO_LABELS = { ninguno: 'Ninguno', primaria_incompleta: 'Primaria incompleta', primaria_completa: 'Primaria completa', secundaria_incompleta: 'Secundaria incompleta', secundaria_completa: 'Secundaria completa / Bachiller', tecnico: 'Técnico', tecnologo: 'Tecnólogo', universitario_incompleto: 'Universitario incompleto', universitario_completo: 'Universitario / Profesional', posgrado: 'Posgrado' }
// Traduce el registro crudo de auditoria_feligresia (nombre de tabla +
// accion SQL) a una frase que un pastor entienda de un vistazo -- antes
// se mostraba literal ("membresias_comite" / "DELETE"), sin sentido
// para alguien sin conocimiento tecnico.
const AUDIT_LABELS = {
  comites: { INSERT: 'Comité creado', UPDATE: 'Comité editado', DELETE: 'Comité eliminado' },
  membresias_comite: { INSERT: 'Integrante agregado', UPDATE: 'Responsabilidad actualizada', DELETE: 'Integrante removido' },
}
function describirCambioAuditoria(item) {
  return AUDIT_LABELS[item.entidad]?.[item.accion] || `${item.entidad} · ${item.accion}`
}

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

function SpiritualTimeline({ person, cargos }) {
  const events = []
  if (person.fecha_ingreso) events.push({ date: person.fecha_ingreso, label: 'Ingresó a la congregación', icon: LogIn, tone: 'accent' })
  if (person.bautizado && person.fecha_bautismo) events.push({ date: person.fecha_bautismo, label: 'Bautizado en agua', icon: Droplet, tone: 'accent' })
  if (person.sellado_espiritu_santo && person.fecha_sellado) events.push({ date: person.fecha_sellado, label: 'Sellado con el Espíritu Santo', icon: Flame, tone: 'success' })
  if (person.fecha_matrimonio) events.push({ date: person.fecha_matrimonio, label: 'Contrajo matrimonio', icon: Heart, tone: 'success' })
  if (person.fecha_fallecimiento) events.push({ date: person.fecha_fallecimiento, label: 'Falleció', icon: Flower2, tone: 'muted' })
  cargos.forEach((cargo) => { if (cargo.fecha_inicio) events.push({ date: cargo.fecha_inicio, endDate: cargo.fecha_fin, label: `Asumió el cargo: ${cargo.nombre_cargo}`, icon: Award, tone: cargo.fecha_fin ? 'muted' : 'accent' }) })
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return <p className="text-xs text-muted mt-2">Aún no hay hitos espirituales registrados.</p>
  return <div className="flex flex-col mt-2">{sorted.map((event, index) => <div key={index} className="flex gap-3"><div className="flex flex-col items-center"><span className={`timeline-dot timeline-dot-${event.tone}`}><event.icon className="w-3.5 h-3.5" /></span>{index < sorted.length - 1 && <span className="timeline-line" />}</div><div className="pb-4 -mt-0.5"><p className="text-sm font-medium">{event.label}</p><p className="text-xs text-muted mt-0.5">{event.date}{event.endDate ? ` → ${event.endDate}` : ''}</p></div></div>)}</div>
}

function PersonFormEditor({ form, setForm, families, committees, cargoHistory, selected, saving, canEdit, editing, error, close, onSubmit, onReconciliar, onVincularConyuge, onDesvincularConyuge, onMarcarFallecido, onDescargarCertificadoDefuncion, analyticsPeople, bautismoBusqueda, bautismoResultados, onBuscarBautismo, nuevoBautizado, rangosEdad, disciplinasPastorales, onRegistrarDisciplina, onAgregarSeguimientoDisciplina, onRestaurarDisciplina }) {
  const [mostrarFirma, setMostrarFirma] = useState(false)
  const memberships = committees.flatMap((committee) => (committee.membresias_comite ?? []).filter((member) => member.persona_id === selected?.id).map((member) => `${committee.nombre}${member.cargo ? ` · ${member.cargo}` : ''}`))
  const cargoEvents = cargoHistory.filter((item) => item.persona_id === selected?.id)
  const cargos = cargoHistory.filter((item) => item.persona_id === selected?.id).map((item) => item.nombre_cargo)
  const edadSelected = selected ? calcularEdad(selected.fecha_nacimiento) : null
  const comitesSugeridos = edadSelected !== null ? sugerirComites({ edad: edadSelected, genero: selected.genero, estadoCivil: selected.estado_civil }, rangosEdad ?? []) : []
  const conyuge = form.conyuge_id ? (analyticsPeople ?? []).find((item) => item.id === form.conyuge_id) : null
  const estadosSeleccionables = Object.entries(STATES).filter(([key]) => key !== 'fallecido' || selected?.estado_membresia === 'fallecido')
  // Cantidad de hijos: se calcula, no se guarda -- contar en vez de un
  // campo aparte evita que quede desactualizado si se agrega o se retira
  // un hijo de la familia más adelante. Cuenta otras personas de la MISMA
  // familia con parentesco_familiar='hijo' (el campo simple que ya usa
  // este formulario, no la tabla relaciones_familiares/árbol genealógico,
  // que es un modelo aparte).
  const hijosEnFamilia = form.familia_id ? (analyticsPeople ?? []).filter((item) => item.familia_id === form.familia_id && item.parentesco_familiar === 'hijo' && item.id !== selected?.id) : []
  const congregacionBautismoNombre = selected?.congregaciones_bautismo?.nombre || bautismoResultados?.find((item) => item.id === form.congregacion_bautismo_id)?.nombre || null
  const categoriasEmergencia = form.autorizacion_datos_salud ? categoriasPrioridad(form, calcularEdad(form.fecha_nacimiento)) : []
  const disciplinasPersona = (disciplinasPastorales ?? []).filter((item) => item.persona_id === selected?.id).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
  const disciplinaActiva = disciplinasPersona.find((item) => !item.fecha_restauracion)
  const disciplinasHistoricas = disciplinasPersona.filter((item) => item.fecha_restauracion)
  return <div className="fixed inset-0 z-40 bg-ink/30 flex items-center justify-center p-4"><form onSubmit={onSubmit} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-2 rounded-card shadow-xl p-6"><div className="flex justify-between mb-5"><h2 className="font-medium">{editing ? 'Editar ficha de persona' : 'Registrar persona'}</h2><button type="button" aria-label="Cerrar" onClick={close} className="text-sm text-secondary hover:text-ink">Cerrar</button></div>{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mb-4">{error}</p>}{nuevoBautizado && <p className="text-sm text-warning bg-warning-bg rounded p-3 mb-4 flex items-center gap-2"><Droplet className="w-4 h-4 flex-shrink-0" />Nuevo bautizado · lleva {nuevoBautizado.dias} día{nuevoBautizado.dias === 1 ? '' : 's'} en Discipulado. Aún está en formación -- espera a que complete al menos {UMBRAL_DIAS_NUEVO_BAUTIZADO} días antes de asignarle un cargo o comité.</p>}<div className="grid sm:grid-cols-2 gap-3"><Field label="Nombres" required value={form.nombres} onChange={(value) => setForm({ ...form, nombres: value })} /><Field label="Apellidos" required value={form.apellidos} onChange={(value) => setForm({ ...form, apellidos: value })} /><Field label="Teléfono" value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value })} /><Field label="Fecha de nacimiento" type="date" value={form.fecha_nacimiento} onChange={(value) => setForm({ ...form, fecha_nacimiento: value })} /><label className="text-sm flex items-center gap-1">Estado<InfoTip texto="'Apartado' es alguien que sigue siendo miembro pero se alejó por un tiempo; 'Trasladado' ya pertenece a otra congregación. 'Fallecido' no se elige aquí -- usa el botón de abajo, porque exige fecha y cierra cargos/comités vigentes." /><select className="input-field mt-1.5 w-full" value={form.estado_membresia} disabled={selected?.estado_membresia === 'fallecido'} onChange={(event) => setForm({ ...form, estado_membresia: event.target.value })}>{estadosSeleccionables.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{editing && selected?.estado_membresia === 'apartado' && <button type="button" onClick={() => onReconciliar(selected)} className="text-xs text-accent mt-1.5">Reconciliar (vuelve a Activo y queda en su historial)</button>}{editing && selected?.estado_membresia !== 'fallecido' && <button type="button" onClick={() => onMarcarFallecido(selected)} className="text-xs text-danger mt-1.5">Registrar fallecimiento</button>}{editing && selected?.estado_membresia === 'fallecido' && <p className="text-xs text-muted mt-1.5">Falleció el {formatFecha(selected.fecha_fallecimiento)}{selected.notas_fallecimiento ? ` · ${selected.notas_fallecimiento}` : ''}</p>}</label><label className="text-sm">Estado civil<select className="input-field mt-1.5" value={form.estado_civil} onChange={(event) => setForm({ ...form, estado_civil: event.target.value })}>{Object.entries(MARITAL_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm sm:col-span-2">Cónyuge<InfoTip texto="Vincula a la persona del censo con quien está casado/a -- actualiza el estado civil de ambos a 'Casado/a' automáticamente." />{conyuge ? <div className="flex items-center gap-2 mt-1.5 flex-wrap"><span className="text-sm">{conyuge.nombres} {conyuge.apellidos}{form.fecha_matrimonio ? ` · casados desde ${formatFecha(form.fecha_matrimonio)}` : ''}</span>{editing && <button type="button" onClick={() => onVincularConyuge(selected)} className="text-xs text-accent">Cambiar</button>}{editing && <button type="button" onClick={() => onDesvincularConyuge(selected)} className="text-xs text-danger">Desvincular</button>}</div> : editing ? <button type="button" onClick={() => onVincularConyuge(selected)} className="btn-secondary text-xs mt-1.5">Vincular cónyuge</button> : <p className="text-xs text-muted mt-1.5">Guarda la ficha primero para poder vincular cónyuge.</p>}</label><label className="text-sm">Género<select className="input-field mt-1.5" value={form.genero || ''} onChange={(event) => setForm({ ...form, genero: event.target.value })}><option value="">Sin registrar</option>{Object.entries(GENERO_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><Field label="Fecha de ingreso" type="date" value={form.fecha_ingreso} onChange={(value) => setForm({ ...form, fecha_ingreso: value })} /><Field label="Última asistencia" type="date" value={form.fecha_ultima_asistencia} onChange={(value) => setForm({ ...form, fecha_ultima_asistencia: value })} /><label className="text-sm">Familia<select className="input-field mt-1.5" value={form.familia_id} onChange={(event) => setForm({ ...form, familia_id: event.target.value, parentesco_familiar: event.target.value ? form.parentesco_familiar : '' })}><option value="">Sin familia</option>{families.map((family) => <option key={family.id} value={family.id}>{family.nombre_familia}</option>)}</select></label><label className="text-sm flex items-center gap-1">Parentesco familiar<InfoTip texto="Solo se puede elegir después de asignar una familia; define su lugar en el árbol genealógico de ese núcleo." /><select className="input-field mt-1.5 w-full" value={form.parentesco_familiar || ''} onChange={(event) => setForm({ ...form, parentesco_familiar: event.target.value })} disabled={!form.familia_id}><option value="">Seleccionar...</option>{Object.entries(FAMILY_RELATIONSHIPS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.bautizado} onChange={(event) => setForm({ ...form, bautizado: event.target.checked })} /> Bautizado<InfoTip texto="Debe estar bautizada para poder asignarse a un comité." /></label><Field label="Fecha de bautismo" type="date" value={form.fecha_bautismo} onChange={(value) => setForm({ ...form, fecha_bautismo: value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.sellado_espiritu_santo} onChange={(event) => setForm({ ...form, sellado_espiritu_santo: event.target.checked })} /> Sellado con el Espíritu Santo<InfoTip texto="Algunos cargos de comité (por ejemplo presidente o tesorero) solo pueden asignarse a personas selladas." /></label><Field label="Fecha de sellado" type="date" value={form.fecha_sellado} onChange={(value) => setForm({ ...form, fecha_sellado: value })} /><label className="text-sm sm:col-span-2">Observaciones pastorales<textarea className="input-field mt-1.5 min-h-24" value={form.observaciones_pastorales || ''} onChange={(event) => setForm({ ...form, observaciones_pastorales: event.target.value })} /></label></div>
    <details className="mt-4 border-t border-border pt-4">
      <summary className="text-sm font-medium cursor-pointer select-none">Datos adicionales del censo</summary>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <label className="text-sm">Tipo de documento<select className="input-field mt-1.5 w-full" value={form.tipo_documento || ''} onChange={(event) => setForm({ ...form, tipo_documento: event.target.value })}><option value="">Sin registrar</option>{Object.entries(TIPO_DOCUMENTO_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <Field label="Número de documento" value={form.numero_documento} onChange={(value) => setForm({ ...form, numero_documento: value })} />
        <label className="text-sm">Nivel educativo<select className="input-field mt-1.5 w-full" value={form.nivel_educativo || ''} onChange={(event) => setForm({ ...form, nivel_educativo: event.target.value })}><option value="">Sin registrar</option>{Object.entries(NIVEL_EDUCATIVO_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-sm">Ocupación<InfoTip texto="Texto libre -- las ocupaciones son demasiado variadas para una lista cerrada." /><input className="input-field mt-1.5 w-full" placeholder="Ej. Comerciante, ama de casa, estudiante" value={form.ocupacion || ''} onChange={(event) => setForm({ ...form, ocupacion: event.target.value })} /></label>
        <label className="text-sm">Tipo de teléfono<select className="input-field mt-1.5 w-full" value={form.telefono_tipo || ''} onChange={(event) => setForm({ ...form, telefono_tipo: event.target.value })}><option value="">Sin registrar</option>{Object.entries(TELEFONO_TIPO_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm mt-1.5 sm:mt-6"><input type="checkbox" checked={Boolean(form.tiene_whatsapp)} onChange={(event) => setForm({ ...form, tiene_whatsapp: event.target.checked })} /> Tiene WhatsApp en ese número</label>
        <Field label="Teléfono alterno" value={form.telefono_alterno} onChange={(value) => setForm({ ...form, telefono_alterno: value })} />
        <label className="text-sm">Red social<InfoTip texto="Para cuando no se puede contactar por los medios habituales. Ej. 'Facebook: Juan Pérez' o '@usuario en Instagram'." /><input className="input-field mt-1.5 w-full" placeholder="Ej. Facebook: Juan Pérez" value={form.red_social || ''} onChange={(event) => setForm({ ...form, red_social: event.target.value })} /></label>
        {hijosEnFamilia.length > 0 && <p className="text-xs text-secondary sm:col-span-2">Hijos registrados en su familia: {hijosEnFamilia.length} ({hijosEnFamilia.map((hijo) => `${hijo.nombres} ${hijo.apellidos}`).join(', ')})</p>}
      </div>
      {form.bautizado && <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-border">
        <p className="text-sm font-medium sm:col-span-2">Lugar y oficiante del bautismo</p>
        <Field label="País" value={form.pais_bautismo} onChange={(value) => setForm({ ...form, pais_bautismo: value })} />
        <Field label="Municipio / ciudad" value={form.municipio_bautismo} onChange={(value) => setForm({ ...form, municipio_bautismo: value })} />
        <div className="sm:col-span-2">
          <label className="text-sm flex items-center gap-1">Congregación donde se bautizó<InfoTip texto="Búscala por nombre o ciudad. Si no aparece, escribe el nombre manualmente." /></label>
          {congregacionBautismoNombre ? (
            <div className="flex items-center gap-2 mt-1.5"><span className="text-sm">{congregacionBautismoNombre}</span><button type="button" onClick={() => setForm({ ...form, congregacion_bautismo_id: '' })} className="text-xs text-accent">Cambiar</button></div>
          ) : (
            <>
              <input className="input-field mt-1.5" placeholder="Buscar congregación por nombre o ciudad..." value={bautismoBusqueda} onChange={(event) => onBuscarBautismo(event.target.value)} />
              {bautismoResultados.length > 0 && <div className="flex flex-col divide-y divide-border border border-border rounded max-h-32 overflow-y-auto mt-1.5">{bautismoResultados.map((item) => <button type="button" key={item.id} onClick={() => setForm({ ...form, congregacion_bautismo_id: item.id, congregacion_bautismo_nombre: '' })} className="text-left text-xs px-2.5 py-2 hover:bg-surface-1"><span className="font-medium">{item.nombre}</span>{item.ciudad ? ` · ${item.ciudad}` : ''}</button>)}</div>}
              <p className="text-xs text-muted mt-1.5">¿No aparece en la lista? Escribe el nombre manualmente:</p>
              <input className="input-field mt-1" placeholder="Nombre de la congregación" value={form.congregacion_bautismo_nombre || ''} onChange={(event) => setForm({ ...form, congregacion_bautismo_nombre: event.target.value })} />
            </>
          )}
        </div>
        <label className="text-sm sm:col-span-2">Pastor que ofició el bautismo<input className="input-field mt-1.5 w-full" value={form.pastor_bautizo || ''} onChange={(event) => setForm({ ...form, pastor_bautizo: event.target.value })} /></label>
      </div>}
    </details>
    <details className="mt-4 border-t border-border pt-4">
      <summary className="text-sm font-medium cursor-pointer select-none">Ficha de salud de emergencia</summary>
      <p className="text-xs text-secondary mt-2">Es información de referencia para una emergencia (qué hacer, a quién avisar) -- la congregación no diagnostica, no prescribe ni administra medicamentos.</p>
      <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={Boolean(form.autorizacion_datos_salud)} onChange={(event) => setForm({ ...form, autorizacion_datos_salud: event.target.checked, fecha_autorizacion_datos_salud: event.target.checked ? (form.fecha_autorizacion_datos_salud || hoyBogota()) : '' })} /> La persona autoriza registrar su información de salud<InfoTip texto="Requerido antes de guardar cualquier campo de esta sección -- la información de salud es un dato sensible (Ley 1581 de 2012)." /></label>
      {form.autorizacion_datos_salud ? <>
        {categoriasEmergencia.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{categoriasEmergencia.map((categoria) => <span key={categoria.key} className="text-[10px] uppercase tracking-wide bg-warning-bg text-warning rounded px-2 py-1">{categoria.label}</span>)}</div>}
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <label className="text-sm">Tipo de sangre<select className="input-field mt-1.5 w-full" value={form.tipo_sangre || ''} onChange={(event) => setForm({ ...form, tipo_sangre: event.target.value })}><option value="">Sin registrar</option>{TIPO_SANGRE_OPCIONES.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select></label>
          <Field label="EPS" value={form.eps_nombre} onChange={(value) => setForm({ ...form, eps_nombre: value })} />
          <label className="text-sm sm:col-span-2">Condiciones médicas relevantes<InfoTip texto="Ej. diabetes, hipertensión, epilepsia, cardiopatía -- lo que alguien atendiendo una emergencia necesitaría saber de un vistazo." /><textarea className="input-field mt-1.5 min-h-16 w-full" value={form.condiciones_medicas || ''} onChange={(event) => setForm({ ...form, condiciones_medicas: event.target.value })} /></label>
          <label className="text-sm sm:col-span-2">Alergias<textarea className="input-field mt-1.5 min-h-16 w-full" value={form.alergias || ''} onChange={(event) => setForm({ ...form, alergias: event.target.value })} /></label>
          <label className="text-sm sm:col-span-2">Medicamentos que toma actualmente<InfoTip texto="Solo de referencia para quien atienda una emergencia (paramédico, EPS) -- recetados por su propio médico, la congregación no los administra." /><textarea className="input-field mt-1.5 min-h-16 w-full" value={form.medicamentos_actuales || ''} onChange={(event) => setForm({ ...form, medicamentos_actuales: event.target.value })} /></label>
          <label className="text-sm sm:col-span-2">Discapacidad<input className="input-field mt-1.5 w-full" placeholder="Ej. movilidad reducida, auditiva -- dejar vacío si no aplica" value={form.discapacidad || ''} onChange={(event) => setForm({ ...form, discapacidad: event.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.embarazada)} onChange={(event) => setForm({ ...form, embarazada: event.target.checked })} /> Embarazada</label>
          {form.embarazada && <Field label="Fecha probable de parto" type="date" value={form.fecha_probable_parto} onChange={(value) => setForm({ ...form, fecha_probable_parto: value })} />}
          <p className="text-sm font-medium sm:col-span-2 mt-1">Contacto de emergencia</p>
          <Field label="Nombre" value={form.contacto_emergencia_nombre} onChange={(value) => setForm({ ...form, contacto_emergencia_nombre: value })} />
          <Field label="Teléfono" value={form.contacto_emergencia_telefono} onChange={(value) => setForm({ ...form, contacto_emergencia_telefono: value })} />
          <Field label="Parentesco" value={form.contacto_emergencia_parentesco} onChange={(value) => setForm({ ...form, contacto_emergencia_parentesco: value })} />
        </div>
      </> : <p className="text-xs text-muted mt-2">Marca la autorización para habilitar esta sección.</p>}
    </details>
    <details className="mt-4 border-t border-border pt-4">
      <summary className="text-sm font-medium cursor-pointer select-none">Consentimiento de datos{form.consentimiento_datos_firma ? ' · Firmado' : ''}</summary>
      <p className="text-xs text-secondary mt-2">Autorización para el uso de sus datos personales dentro de SIGAP, firmada a mano en pantalla (sin necesidad de imprimir ni subir un archivo).</p>
      {form.consentimiento_datos_firma ? <div className="mt-3">
        <p className="text-xs text-secondary">Firmado el {formatFecha(form.fecha_consentimiento_datos)}</p>
        <img src={form.consentimiento_datos_firma} alt="Firma de consentimiento" className="border border-border rounded bg-white mt-2 h-20" />
        <div className="mt-2"><button type="button" onClick={() => setForm({ ...form, consentimiento_datos_firma: '', fecha_consentimiento_datos: '' })} className="text-xs text-danger">Revocar consentimiento</button></div>
      </div> : mostrarFirma ? <div className="mt-3"><SignaturePad onGuardar={(firma) => { setForm({ ...form, consentimiento_datos_firma: firma, fecha_consentimiento_datos: hoyBogota() }); setMostrarFirma(false) }} onCancelar={() => setMostrarFirma(false)} /></div> : <button type="button" onClick={() => setMostrarFirma(true)} className="btn-secondary text-xs mt-3">Capturar firma</button>}
    </details>
    {editing && <details className="mt-4 border-t border-border pt-4" open={Boolean(disciplinaActiva)}>
      <summary className="text-sm font-medium cursor-pointer select-none">Disciplina/suspensión de cargos{disciplinaActiva ? ' · Activa' : ''}</summary>
      {disciplinaActiva ? <div className="mt-3">
        <p className="text-sm text-danger bg-danger-bg rounded p-3">Disciplina activa desde {formatFecha(disciplinaActiva.fecha_inicio)}{disciplinaActiva.fecha_fin_prevista ? ` · prevista hasta ${formatFecha(disciplinaActiva.fecha_fin_prevista)}` : ''}: {disciplinaActiva.motivo}<InfoTip texto="Mientras esté activa (sin fecha de restauración), no se puede asignar a esta persona a un cargo o comité nuevo." /></p>
        <div className="flex gap-2 mt-2 flex-wrap"><button type="button" onClick={() => onAgregarSeguimientoDisciplina(disciplinaActiva)} className="btn-secondary text-xs">Agregar seguimiento</button><button type="button" onClick={() => onRestaurarDisciplina(disciplinaActiva)} className="btn-secondary text-xs">Registrar restauración</button></div>
        {(disciplinaActiva.disciplinas_seguimiento ?? []).length > 0 && <div className="mt-3 flex flex-col gap-1.5">{[...disciplinaActiva.disciplinas_seguimiento].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((nota) => <p key={nota.id} className="text-xs text-secondary">{formatFecha(nota.fecha)} · {nota.nota}</p>)}</div>}
      </div> : <button type="button" onClick={() => onRegistrarDisciplina(selected)} className="btn-secondary text-xs mt-3">Registrar disciplina/suspensión</button>}
      {disciplinasHistoricas.length > 0 && <div className="mt-3 pt-3 border-t border-border"><p className="text-xs font-medium text-secondary">Historial</p>{disciplinasHistoricas.map((item) => <p key={item.id} className="text-xs text-muted mt-1">{formatFecha(item.fecha_inicio)} → {formatFecha(item.fecha_restauracion)} · {item.motivo}{item.notas_restauracion ? ` · ${item.notas_restauracion}` : ''}</p>)}</div>}
    </details>}
    {editing && <div className="mt-5 border-t border-border pt-4"><p className="text-sm font-medium">Ciclo de vida espiritual</p><SpiritualTimeline person={selected} cargos={cargoEvents} /></div>}{editing && <div className="mt-2 border-t border-border pt-4"><p className="text-sm font-medium">Participación y responsabilidades</p>{memberships.length ? <p className="text-xs text-secondary mt-2">{memberships.join(' · ')}</p> : <p className="text-xs text-muted mt-2">Sin participación en comités.</p>}{cargos.length > 0 && <p className="text-xs text-secondary mt-2">Cargos históricos: {cargos.join(', ')}</p>}</div>}{editing && comitesSugeridos.length > 0 && <p className="text-xs text-secondary mt-2 flex items-center gap-1">Comités sugeridos: {comitesSugeridos.map((rango) => rango.comites?.nombre).filter(Boolean).join(', ')}<InfoTip texto="Sugerido según edad, género y estado civil, comparado con el catálogo de rangos de edad configurado en Módulos. Es solo informativo -- no traslada ni asigna a nadie automáticamente." /></p>}{editing && selected?.estado_membresia === 'fallecido' && <button type="button" onClick={() => onDescargarCertificadoDefuncion(selected)} className="btn-secondary w-full justify-center mt-3">Descargar certificado de defunción</button>}<button disabled={saving} className="btn-primary w-full justify-center mt-5">{saving ? 'Guardando...' : 'Guardar ficha'}</button></form></div>
}


function CommitteeAnalytics({ people, committees, cargos, audit, disciplinas }) {
  const { formato_fecha } = usePreferencias()
  const today = hoyBogota()
  const actorPorAuthId = new Map(people.filter((person) => person.auth_user_id).map((person) => [person.auth_user_id, `${person.nombres} ${person.apellidos}`]))
  function describirActor(usuarioId) {
    if (!usuarioId) return 'Cambio automático del sistema'
    return actorPorAuthId.get(usuarioId) || 'Otro usuario'
  }
  const active = committees.filter((committee) => committee.activo && (!committee.fecha_fin || committee.fecha_fin >= today))
  const memberships = active.flatMap((committee) => (committee.membresias_comite ?? []).filter((member) => member.estado !== 'historico' && !member.fecha_fin).map((member) => ({ ...member, committee })))
  const required = active.reduce((total, committee) => total + cargos.filter((cargo) => cargo.obligatorio).length, 0)
  const covered = active.reduce((total, committee) => total + cargos.filter((cargo) => cargo.obligatorio && (committee.membresias_comite ?? []).some((member) => member.cargo_id === cargo.id && member.estado !== 'historico' && !member.fecha_fin)).length, 0)
  const counts = memberships.reduce((result, member) => ({ ...result, [member.persona_id]: (result[member.persona_id] || 0) + 1 }), {})
  const overloaded = Object.entries(counts).filter(([, count]) => count > 1).sort(([, left], [, right]) => right - left)
  const serving = new Set(memberships.map((member) => member.persona_id))
  const withoutMembers = active.filter((committee) => !memberships.some((member) => member.committee.id === committee.id)).length
  const withoutResponsible = active.filter((committee) => !committee.responsable_id).length
  const expiring = memberships.filter((member) => member.fecha_fin && member.fecha_fin >= today && member.fecha_fin <= fechaBogota(new Date(Date.now() + 90 * 86400000))).length
  const disciplinasActivas = (disciplinas ?? []).filter((item) => !item.fecha_restauracion)
  function committeeExportHeaders() {
    return { headers: ['Comité', 'Código', 'Estado', 'Vigencia', 'Integrantes', 'Cargos obligatorios', 'Cargos cubiertos'], rows: active.map((committee) => { const current = memberships.filter((member) => member.committee.id === committee.id); const requiredCargos = cargos.filter((cargo) => cargo.obligatorio); return [committee.nombre, committee.codigo, 'Activo', committee.fecha_fin || 'Sin fecha final', current.length, requiredCargos.length, requiredCargos.filter((cargo) => current.some((member) => member.cargo_id === cargo.id)).length] }) }
  }
  function committeeExportCsv() {
    descargarCsv({ filename: `comites-analisis-${today}.csv`, titulo: 'Análisis de comités', meta: ['Nivel: local'], ...committeeExportHeaders() })
  }
  function committeeExportResumen() {
    return {
      kpis: [
        { label: 'Comités activos', value: active.length },
        { label: 'Integrantes vigentes', value: memberships.length },
        { label: 'Cargos obligatorios cubiertos', value: `${covered}/${required}` },
        { label: 'Sin integrantes', value: withoutMembers },
        { label: 'Sin responsable vigente', value: withoutResponsible },
      ],
      desgloses: [
        { titulo: 'Integrantes por comité', items: active.map((committee) => ({ label: committee.nombre, valor: memberships.filter((member) => member.committee.id === committee.id).length })) },
      ],
    }
  }
  function committeeExportExcel() {
    descargarExcel({ filename: `comites-analisis-${today}.xlsx`, hoja: 'Comités', titulo: 'Análisis de comités', meta: ['Nivel: local'], resumen: committeeExportResumen(), ...committeeExportHeaders() })
  }
  function committeeExportPdf() {
    descargarPdf({ filename: `comites-analisis-${today}.pdf`, titulo: 'Análisis de comités', meta: ['Nivel: local'], resumen: committeeExportResumen(), ...committeeExportHeaders() })
  }
  const insights = []
  if (withoutMembers) insights.push(`${withoutMembers} comité${withoutMembers === 1 ? '' : 's'} activo${withoutMembers === 1 ? '' : 's'} sin integrantes: confirmar continuidad o asignar equipo.`)
  if (withoutResponsible) insights.push(`${withoutResponsible} comité${withoutResponsible === 1 ? '' : 's'} sin responsable vigente: programar designación o documentar transición.`)
  if (expiring) insights.push(`${expiring} responsabilidad${expiring === 1 ? '' : 'es'} vence${expiring === 1 ? '' : 'n'} en los próximos 90 días: revisar continuidad o reemplazo.`)
  if (overloaded.length) insights.push(`${overloaded.length} persona${overloaded.length === 1 ? '' : 's'} participa en más de un comité: conversar sobre carga y disponibilidad.`)
  if (disciplinasActivas.length) insights.push(`${disciplinasActivas.length} persona${disciplinasActivas.length === 1 ? '' : 's'} tiene${disciplinasActivas.length === 1 ? '' : 'n'} una disciplina/suspensión activa: no puede${disciplinasActivas.length === 1 ? '' : 'n'} asignarse a un cargo nuevo hasta que se registre su restauración.`)
  if (!insights.length) insights.push('No hay situaciones operativas prioritarias en este periodo.')
  return <section className="card p-5"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h3 className="font-medium">Análisis de comités</h3><p className="text-xs text-secondary mt-1">Métricas del periodo actual para apoyar decisiones locales.</p></div><ExportButtons onCsv={committeeExportCsv} onExcel={committeeExportExcel} onPdf={committeeExportPdf} /></div><div className="grid grid-cols-2 lg:grid-cols-7 gap-3 mt-5"><Metric label="Comités activos" value={active.length} accent /><Metric label="Integrantes vigentes" value={memberships.length} /><Metric label="Cargos obligatorios" value={required} /><Metric label="Cargos cubiertos" value={covered} /><Metric label="Vacantes" value={Math.max(required - covered, 0)} /><Metric label="Personas disponibles" value={people.filter((person) => person.estado_membresia === 'activo' && !serving.has(person.id)).length} /><Metric label="Con disciplina activa" value={disciplinasActivas.length} /></div><div className="grid lg:grid-cols-2 gap-4 mt-5"><div><h4 className="text-sm font-medium">Insights y acciones</h4>{insights.map((item) => <p key={item} className="summary-insight mt-2">{item}</p>)}</div><div><h4 className="text-sm font-medium">Concentración de responsabilidades</h4>{overloaded.length ? overloaded.slice(0, 8).map(([personId, count]) => { const person = people.find((item) => item.id === personId); return <p key={personId} className="text-xs text-secondary mt-2">{person ? `${person.nombres} ${person.apellidos}` : 'Persona'} · {count} comités</p> }) : <p className="text-xs text-muted mt-2">No hay personas con más de una responsabilidad vigente.</p>}</div></div><div className="mt-5 border-t border-border pt-4"><div className="flex justify-between gap-3"><h4 className="text-sm font-medium">Historial reciente</h4><span className="text-xs text-muted">{audit.length > 12 ? `12 de ${audit.length} cambios` : `${audit.length} cambio${audit.length === 1 ? '' : 's'}`}</span></div>{audit.length ? <div className="overflow-x-auto mt-2"><table className="w-full text-xs"><thead><tr className="text-left text-muted"><th className="font-normal pb-1.5 pr-3">Fecha</th><th className="font-normal pb-1.5 pr-3">Cambio</th><th className="font-normal pb-1.5">Realizado por</th></tr></thead><tbody>{audit.slice(0, 12).map((item) => <tr key={item.id} className="border-b border-border"><td className="py-2 pr-3">{formatFecha(item.creado_en, { formato: formato_fecha, conHora: true })}</td><td className="py-2 pr-3">{describirCambioAuditoria(item)}</td><td className="py-2">{describirActor(item.usuario_id)}</td></tr>)}</tbody></table></div> : <p className="text-xs text-muted mt-2">No hay cambios de comités registrados todavía.</p>}</div></section>
}

function HealthAnalytics({ people }) {
  const activePeople = people.filter((person) => person.estado_membresia === 'activo')
  const withConsent = activePeople.filter((person) => person.autorizacion_datos_salud)
  const withEps = withConsent.filter((person) => person.eps_nombre?.trim()).length
  // Una persona puede caer en más de una categoría a la vez (ej. adulto
  // mayor CON condición médica) -- por eso es un conteo por categoría,
  // no un pastel de 100%.
  const categoriasContadas = withConsent.reduce((acc, person) => {
    categoriasPrioridad(person, calcularEdad(person.fecha_nacimiento)).forEach((categoria) => {
      acc[categoria.label] = (acc[categoria.label] || 0) + 1
    })
    return acc
  }, {})
  const categoriasData = distributionDataset(Object.entries(categoriasContadas).map(([label, value]) => ({ label, value })), { valueKey: 'value', datasetLabel: 'Personas' })
  const chartOptions = buildChartOptions()
  const coberturaPct = activePeople.length ? Math.round(withConsent.length / activePeople.length * 100) : 0
  const insight = withConsent.length === 0
    ? 'Aún no hay fichas de salud registradas -- ningún dato de emergencia disponible todavía.'
    : `${withConsent.length} de ${activePeople.length} personas activas (${coberturaPct}%) tienen ficha de salud de emergencia registrada.`
  return <section className="card p-5">
    <div><h3 className="font-medium">Salud y emergencias</h3><p className="text-xs text-secondary mt-1">Información de referencia para actuar rápido ante una emergencia -- no reemplaza atención médica ni autoriza a administrar medicamentos.</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
      <Metric label="Con ficha de salud" value={withConsent.length} accent />
      <Metric label="Cobertura del censo activo" value={`${coberturaPct}%`} />
      <Metric label="Con EPS registrada" value={withEps} />
      <Metric label="Categorías con datos" value={Object.keys(categoriasContadas).length} />
    </div>
    <p className={`text-sm rounded p-3 mt-4 ${withConsent.length === 0 ? 'text-secondary bg-surface-1' : 'text-accent bg-accent-bg'}`}>{insight}</p>
    <div className="mt-5">
      <h4 className="text-sm font-medium">Personas en categorías de prioridad</h4>
      <p className="text-xs text-secondary mt-1">Niños, adultos mayores, embarazadas y personas con condición médica, alergia o discapacidad registrada -- una misma persona puede aparecer en más de una categoría.</p>
      {Object.keys(categoriasContadas).length ? <div className="h-56 mt-4"><Bar data={categoriasData} options={chartOptions} /></div> : <div className="h-40 mt-4"><ChartEmpty message="Aún no hay categorías de prioridad con datos suficientes." /></div>}
    </div>
  </section>
}

function FeligresiaInsights({ people, families, committees, cargoHistory, followups, alerts }) {
  const [statusFilter, setStatusFilter] = useState('todos')
  const [ageFilter, setAgeFilter] = useState('todas')
  const [historyMonths, setHistoryMonths] = useState('12')
  const today = new Date()
  const todayKey = fechaBogota(today)
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
  const withConsent = activePeople.filter((person) => person.consentimiento_datos_firma).length
  const withoutAttendance = activePeople.filter((person) => !person.fecha_ultima_asistencia || person.fecha_ultima_asistencia < fechaBogota(new Date(today.getTime() - 90 * 86400000))).length
  const pending = followups.filter((item) => item.estado === 'pendiente').length
  const overdue = followups.filter((item) => item.estado === 'pendiente' && item.proxima_fecha && item.proxima_fecha < todayKey).length
  const activeMemberships = committees.filter((committee) => committee.activo).flatMap((committee) => committee.membresias_comite ?? []).filter((member) => !member.fecha_fin && filteredPeople.some((person) => person.id === member.persona_id))
  const committeePeople = new Set(activeMemberships.map((member) => member.persona_id)).size
  const activeCharges = cargoHistory.filter((item) => !item.fecha_fin && filteredPeople.some((person) => person.id === item.persona_id)).length
  const yearAgo = fechaBogota(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()))
  const newPeople = filteredPeople.filter((person) => person.fecha_ingreso && person.fecha_ingreso >= yearAgo).length
  const ages = activePeople.map((person) => calcularEdad(person.fecha_nacimiento, today)).filter((age) => age !== null)
  const ageGroups = [['0-12', 0], ['13-17', 0], ['18-29', 0], ['30-59', 0], ['60+', 0]]
  ages.forEach((age) => { const index = age <= 12 ? 0 : age <= 17 ? 1 : age <= 29 ? 2 : age <= 59 ? 3 : 4; ageGroups[index][1] += 1 })
  const AGE_BRACKETS = ['0-12', '13-17', '18-29', '30-59', '60+']
  const pyramidByBracket = Object.fromEntries(AGE_BRACKETS.map((bracket) => [bracket, { masculino: 0, femenino: 0 }]))
  let peopleWithGenero = 0
  activePeople.forEach((person) => {
    const age = calcularEdad(person.fecha_nacimiento, today)
    if (age === null || (person.genero !== 'masculino' && person.genero !== 'femenino')) return
    peopleWithGenero += 1
    const bracket = age <= 12 ? '0-12' : age <= 17 ? '13-17' : age <= 29 ? '18-29' : age <= 59 ? '30-59' : '60+'
    pyramidByBracket[bracket][person.genero] += 1
  })
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
    return { label: start.toLocaleDateString('es-CO', { month: 'short', year: months > 12 ? '2-digit' : undefined }), total: filteredPeople.filter((person) => person.fecha_ingreso && person.fecha_ingreso >= fechaBogota(start) && person.fecha_ingreso < fechaBogota(end)).length }
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

  // --- Retención por cohorte de ingreso -- usa `people` (censo
  // completo, sin el filtro de estado/edad de arriba: filtrar por
  // "activo" dejaría cada cohorte en 100% de forma trivial) agrupado
  // por trimestre de fecha_ingreso. No es una curva real de "% activo
  // a los N meses" -- eso requeriría reconstruir el estado histórico
  // mes a mes, y SIGAP solo guarda el estado actual. Es honesto: mide
  // "de los que entraron en tal trimestre, cuántos siguen activos HOY",
  // que sí es calculable con los datos que existen.
  const cohortesMapa = new Map()
  people.forEach((person) => {
    if (!person.fecha_ingreso) return
    const { anio, trimestre } = trimestreDe(person.fecha_ingreso)
    const key = `${anio}-${trimestre}`
    if (!cohortesMapa.has(key)) cohortesMapa.set(key, { anio, trimestre, personas: [] })
    cohortesMapa.get(key).personas.push(person)
  })
  const retencionCohortes = [...cohortesMapa.values()]
    .sort((a, b) => a.anio - b.anio || a.trimestre - b.trimestre)
    .map((cohorte) => {
      const totalCohorte = cohorte.personas.length
      const activosCohorte = cohorte.personas.filter((p) => p.estado_membresia === 'activo').length
      const apartadosCohorte = cohorte.personas.filter((p) => p.estado_membresia === 'apartado').length
      const trasladadosCohorte = cohorte.personas.filter((p) => p.estado_membresia === 'trasladado').length
      const otrasBajasCohorte = cohorte.personas.filter((p) => p.estado_membresia === 'inactivo' || p.estado_membresia === 'fallecido').length
      return {
        etiqueta: `${ETIQUETA_TRIMESTRE[cohorte.trimestre].split(' ')[0]} ${cohorte.anio}`,
        total: totalCohorte,
        activos: activosCohorte,
        apartados: apartadosCohorte,
        trasladados: trasladadosCohorte,
        otrasBajas: otrasBajasCohorte,
        retencionPct: totalCohorte ? Math.round((activosCohorte / totalCohorte) * 100) : 0,
      }
    })
  const cohortesConRiesgo = retencionCohortes.filter((c) => c.total >= 3 && c.retencionPct < 60)
  const insightRetencion = retencionCohortes.length === 0
    ? 'Aún no hay fecha de ingreso registrada para calcular cohortes.'
    : cohortesConRiesgo.length > 0
      ? `${cohortesConRiesgo.map((c) => c.etiqueta).join(', ')}: menos del 60% de quienes ingresaron ese trimestre siguen activos hoy. Vale la pena revisar qué pasó con ese grupo.`
      : 'Ninguna cohorte con al menos 3 ingresos está por debajo del 60% de retención.'
  const pyramidData = {
    labels: AGE_BRACKETS,
    datasets: [
      { label: 'Masculino', data: AGE_BRACKETS.map((bracket) => -pyramidByBracket[bracket].masculino), backgroundColor: '#2a78d6', borderRadius: 4, barThickness: 18 },
      { label: 'Femenino', data: AGE_BRACKETS.map((bracket) => pyramidByBracket[bracket].femenino), backgroundColor: '#9a6bce', borderRadius: 4, barThickness: 18 },
    ],
  }
  const pyramidOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: true, position: 'top', align: 'start', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 14, color: '#52514e', font: { size: 11, weight: '500' } } },
      tooltip: { backgroundColor: '#111820', titleColor: '#ffffff', bodyColor: 'rgba(255,255,255,0.78)', padding: 12, callbacks: { label: (context) => ` ${context.dataset.label}: ${Math.abs(context.parsed.x)}` } },
    },
    scales: {
      x: { stacked: true, border: { display: false }, grid: { color: 'rgba(82,81,78,0.1)' }, ticks: { color: '#898781', callback: (value) => Math.abs(value), precision: 0 } },
      y: { stacked: true, border: { display: false }, grid: { display: false }, ticks: { color: '#898781' } },
    },
  }

  return <section className="flex flex-col gap-4">
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-accent">Inteligencia de gestión</p><h2 className="font-medium mt-1">Lectura para tomar decisiones</h2><p className="text-sm text-secondary mt-1">Indicadores construidos con el censo completo, no solo con la página visible.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Filtrar dashboard por estado" className="input-field text-xs" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="todos">Todos los estados</option>{Object.entries(STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select aria-label="Filtrar dashboard por edad" className="input-field text-xs" value={ageFilter} onChange={(event) => setAgeFilter(event.target.value)}><option value="todas">Todas las edades</option>{ageGroups.map(([label]) => <option key={label} value={label}>{label} años</option>)}</select></div></div>
    <div className="grid grid-cols-2 lg:grid-cols-8 gap-3"><Metric label="Personas en censo" value={total} accent /><Metric label="Tasa de actividad" value={`${total ? Math.round(active / total * 100) : 0}%`} /><Metric label="Cobertura familiar" value={`${total ? Math.round(withFamily / total * 100) : 0}%`} /><Metric label="Con consentimiento firmado" value={`${active ? Math.round(withConsent / active * 100) : 0}%`} info="Porcentaje de personas activas que ya firmaron la autorización de uso de datos en su ficha." /><Metric label="Ingresos últimos 12 meses" value={newPeople} /><Metric label="Viudos/as activos" value={widowed} /><Metric label="Divorciados/as activos" value={divorced} /><Metric label="Alertas activas" value={activeAlerts.length} /></div>
    <p className={`text-sm rounded p-3 ${overdue > 0 || withoutAttendance > 0 ? 'text-danger bg-danger-bg' : 'text-success bg-success-bg'}`}>{insight}</p>
    <div className="grid lg:grid-cols-4 gap-4"><div className="card p-5"><h3 className="font-medium">Estado del censo</h3><p className="text-xs text-secondary mt-1">Distribución por estado de membresía.</p><div className="h-56 mt-4"><Bar data={statusData} options={chartOptions} /></div></div><div className="card p-5"><h3 className="font-medium">Bautismo</h3><p className="text-xs text-secondary mt-1">Nivel de consolidación espiritual entre personas activas.</p><div className="h-56 mt-4"><Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: '#52514e', padding: 14, font: { size: 11 } } } } }} /></div></div><div className="card p-5"><h3 className="font-medium">Rangos de edad</h3><p className="text-xs text-secondary mt-1">Personas con fecha de nacimiento registrada.</p><div className="h-56 mt-4"><Bar data={ageData} options={chartOptions} /></div></div><div className="card p-5"><h3 className="font-medium">Situación familiar</h3><p className="text-xs text-secondary mt-1">Estado civil de las personas activas.</p><div className="h-56 mt-4"><Bar data={maritalData} options={chartOptions} /></div></div></div>
    <div className="card p-5"><h3 className="font-medium">Pirámide poblacional</h3><p className="text-xs text-secondary mt-1">Distribución por edad y género de las personas activas.{peopleWithGenero < activePeople.length && ` Basada en ${peopleWithGenero} de ${activePeople.length} activas con género registrado.`}</p>{peopleWithGenero ? <div className="h-72 mt-4"><Bar data={pyramidData} options={pyramidOptions} /></div> : <div className="h-72 mt-4"><ChartEmpty message="Aún no hay personas activas con género registrado." /></div>}</div>
    <div className="card p-5"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h3 className="font-medium">Evolución de ingresos</h3><p className="text-xs text-secondary mt-1">Nuevas personas registradas en el periodo seleccionado.</p></div><select aria-label="Periodo de evolución de ingresos" className="input-field text-xs" value={historyMonths} onChange={(event) => setHistoryMonths(event.target.value)}><option value="12">Últimos 12 meses</option><option value="24">Últimos 24 meses</option><option value="60">Últimos 5 años</option></select></div><div className="h-56 mt-4"><Bar data={admissionsData} options={chartOptions} /></div></div>
    <div className="card p-5">
      <h3 className="font-medium">Retención por cohorte de ingreso</h3>
      <p className="text-xs text-secondary mt-1">De quienes ingresaron en cada trimestre, cuántos siguen activos hoy. No es una curva de retención mes a mes -- SIGAP solo guarda el estado actual, no el historial completo -- pero sí muestra con datos reales si un trimestre en particular retuvo peor que otros.</p>
      {retencionCohortes.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">Aún no hay personas con fecha de ingreso registrada.</p>
      ) : (
        <>
          <p className={`text-sm rounded p-3 mt-4 ${cohortesConRiesgo.length > 0 ? 'text-danger bg-danger-bg' : 'text-success bg-success-bg'}`}>{insightRetencion}</p>
          <div className="table-scroll mt-4">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="px-4 py-3">Cohorte de ingreso</th>
                  <th className="px-4 py-3">Ingresaron</th>
                  <th className="px-4 py-3">Activos hoy</th>
                  <th className="px-4 py-3">Retención</th>
                  <th className="px-4 py-3">Apartados</th>
                  <th className="px-4 py-3">Trasladados</th>
                  <th className="px-4 py-3">Otras bajas</th>
                </tr>
              </thead>
              <tbody>
                {retencionCohortes.map((cohorte) => (
                  <tr key={cohorte.etiqueta} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{cohorte.etiqueta}</td>
                    <td className="px-4 py-3">{cohorte.total}</td>
                    <td className="px-4 py-3">{cohorte.activos}</td>
                    <td className={`px-4 py-3 font-medium ${cohorte.total >= 3 && cohorte.retencionPct < 60 ? 'text-danger' : 'text-success'}`}>{cohorte.retencionPct}%</td>
                    <td className="px-4 py-3 text-secondary">{cohorte.apartados || '—'}</td>
                    <td className="px-4 py-3 text-secondary">{cohorte.trasladados || '—'}</td>
                    <td className="px-4 py-3 text-secondary">{cohorte.otrasBajas || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
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
  const [traslados, setTraslados] = useState([])
  const [discipuladoActivos, setDiscipuladoActivos] = useState([])
  const [disciplinasPastorales, setDisciplinasPastorales] = useState([])
  const [amigosCongregacion, setAmigosCongregacion] = useState([])
  const [familiaAmigos, setFamiliaAmigos] = useState([])
  const [bautismoBusqueda, setBautismoBusqueda] = useState('')
  const [bautismoResultados, setBautismoResultados] = useState([])
  const [trasladoBusqueda, setTrasladoBusqueda] = useState('')
  const [trasladoResultados, setTrasladoResultados] = useState([])
  const [trasladoDestinoId, setTrasladoDestinoId] = useState('')
  const [trasladoObservaciones, setTrasladoObservaciones] = useState('')
  const [savingTraslado, setSavingTraslado] = useState(false)
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
  // null = todavía no se confirmó el permiso (no mostrar el aviso de "solo
  // lectura" -- eso se veía por un instante como un perfil sin permisos en
  // cada navegación hacia esta pantalla, mientras el rol/permiso real
  // seguía cargando). false = confirmado que no puede editar.
  const [canEdit, setCanEdit] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [importRows, setImportRows] = useState([])
  const [importError, setImportError] = useState(null)
  const [importRowErrors, setImportRowErrors] = useState([])
  const [reloadToken, setReloadToken] = useState(0)
  const [rangosEdad, setRangosEdad] = useState([])
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
      setTraslados(cached.traslados)
      setDiscipuladoActivos(cached.discipuladoActivos)
      setDisciplinasPastorales(cached.disciplinasPastorales)
      setAmigosCongregacion(cached.amigosCongregacion)
      setFamiliaAmigos(cached.familiaAmigos)
      setLoading(false)
    } else {
      setLoading(true)
    }
    let peopleQuery = supabase.from('personas').select('id, nombres, apellidos, telefono, fecha_nacimiento, fecha_ingreso, estado_membresia, estado_civil, genero, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ultima_asistencia, familia_id, parentesco_familiar, observaciones_pastorales, conyuge_id, fecha_matrimonio, fecha_fallecimiento, notas_fallecimiento, tipo_documento, numero_documento, nivel_educativo, ocupacion, telefono_tipo, tiene_whatsapp, telefono_alterno, red_social, pais_bautismo, municipio_bautismo, congregacion_bautismo_id, congregacion_bautismo_nombre, pastor_bautizo, tipo_sangre, eps_nombre, condiciones_medicas, alergias, medicamentos_actuales, discapacidad, embarazada, fecha_probable_parto, contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco, autorizacion_datos_salud, fecha_autorizacion_datos_salud, consentimiento_datos_firma, fecha_consentimiento_datos, congregaciones_bautismo:congregacion_bautismo_id(nombre, ciudad), familias(nombre_familia)', { count: 'exact' }).eq('congregacion_id', congregacionId)
    if (personStatus !== 'todos') peopleQuery = peopleQuery.eq('estado_membresia', personStatus)
    if (deferredSearch.trim()) peopleQuery = peopleQuery.or(`nombres.ilike.%${deferredSearch.trim()}%,apellidos.ilike.%${deferredSearch.trim()}%`)
    peopleQuery = peopleQuery.order('nombres').order('id').range(peoplePage * peoplePageSize, peoplePage * peoplePageSize + peoplePageSize - 1)
    const [peopleResult, analyticsPeopleResult, familyResult, familyMembersResult, familyRelationsResult, committeeResult, committeeCargoResult, committeeTypeResult, cargoResult, followupResult, summaryResult, alertsResult, committeeAuditResult, movementsResult, trasladosResult, discipuladoActivosResult, disciplinasPastoralesResult, amigosResult, familiaAmigosResult] = await Promise.all([
      peopleQuery,
      supabase.from('personas').select('id, nombres, apellidos, auth_user_id, estado_membresia, estado_civil, genero, bautizado, fecha_nacimiento, fecha_ingreso, fecha_ultima_asistencia, familia_id, parentesco_familiar, conyuge_id, fecha_fallecimiento, eps_nombre, condiciones_medicas, alergias, discapacidad, embarazada, autorizacion_datos_salud, consentimiento_datos_firma').eq('congregacion_id', congregacionId),
      supabase.from('familias').select('id, nombre_familia, direccion, telefono').eq('congregacion_id', congregacionId).order('nombre_familia'),
      supabase.from('familia_miembros').select('id, familia_id, persona_id, parentesco, es_referente, familias!inner(congregacion_id)').eq('familias.congregacion_id', congregacionId),
      supabase.from('relaciones_familiares').select('id, persona_id, relacionada_id, tipo, personas!relaciones_familiares_persona_id_fkey!inner(congregacion_id)').eq('personas.congregacion_id', congregacionId),
      supabase.from('comites').select('id, nombre, codigo, descripcion, proposito, activo, fecha_inicio, fecha_fin, responsable_id, observaciones, membresias_comite(id, persona_id, cargo, cargo_id, estado, fecha_inicio, fecha_fin, motivo_retiro, reemplaza_membresia_id)').eq('congregacion_id', congregacionId).order('nombre'),
      supabase.from('cargos_comite').select('id, nombre, codigo, unico_por_comite, admite_suplente, orden, requiere_sellado').eq('congregacion_id', congregacionId).eq('activo', true).order('orden').order('nombre'),
      supabase.from('tipos_comite').select('id, nombre, codigo').eq('congregacion_id', congregacionId).eq('activo', true).order('nombre'),
      supabase.from('historial_cargos').select('id, persona_id, nombre_cargo, area, fecha_inicio, fecha_fin, observaciones, personas!inner(congregacion_id)').eq('personas.congregacion_id', congregacionId).order('fecha_inicio', { ascending: false }),

      supabase.from('seguimientos_pastorales').select('id, persona_id, tipo_alerta, accion, notas, fecha, proxima_fecha, estado, usuario_id').eq('congregacion_id', congregacionId).order('proxima_fecha', { ascending: true, nullsFirst: false }),
      supabase.from('vw_resumen_feligresia').select('personas_activas, bautizados, sellados, apartados, familias_asociadas').eq('congregacion_id', congregacionId).maybeSingle(),
      supabase.from('vw_alertas_pastorales').select('*').eq('congregacion_id', congregacionId).order('mes', { ascending: false }),
      supabase.from('auditoria_feligresia').select('id, entidad, accion, usuario_id, creado_en').eq('congregacion_id', congregacionId).in('entidad', ['comites', 'membresias_comite']).order('creado_en', { ascending: false }).limit(100),
      supabase.from('movimientos_membresia').select('id, persona_id, tipo, fecha, congregacion_relacionada_id, observaciones, congregaciones_relacionada:congregacion_relacionada_id(nombre)').eq('congregacion_id', congregacionId).order('fecha', { ascending: false }),
      supabase.from('traslados_feligresia').select('id, persona_id, congregacion_origen_id, congregacion_destino_id, estado, fecha_solicitud, observaciones, persona:persona_id(nombres, apellidos), origen:congregacion_origen_id(nombre), destino:congregacion_destino_id(nombre)').or(`congregacion_origen_id.eq.${congregacionId},congregacion_destino_id.eq.${congregacionId}`).eq('estado', 'pendiente').order('fecha_solicitud', { ascending: false }),
      supabase.from('discipulado_procesos').select('persona_id, fecha_inicio').eq('congregacion_id', congregacionId).eq('estado', 'activo'),
      supabase.from('disciplinas_pastorales').select('id, persona_id, motivo, fecha_inicio, fecha_fin_prevista, fecha_restauracion, notas_restauracion, disciplinas_seguimiento(id, nota, fecha)').eq('congregacion_id', congregacionId).order('fecha_inicio', { ascending: false }),
      supabase.from('amigos').select('id, nombres, fecha_nacimiento').eq('congregacion_id', congregacionId).order('nombres'),
      supabase.from('familia_amigos').select('id, familia_id, amigo_id, parentesco, amigos(nombres, fecha_nacimiento), familias!inner(congregacion_id)').eq('familias.congregacion_id', congregacionId),
    ])
    if (peopleResult.error || analyticsPeopleResult.error || familyResult.error || familyMembersResult.error || familyRelationsResult.error || committeeResult.error || committeeCargoResult.error || committeeTypeResult.error || cargoResult.error || followupResult.error || summaryResult.error || alertsResult.error || committeeAuditResult.error || trasladosResult?.error || discipuladoActivosResult?.error) setError('No se pudo cargar toda la información. Intenta nuevamente o contacta al administrador.')
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
      traslados: trasladosResult?.data ?? [],
      discipuladoActivos: discipuladoActivosResult?.data ?? [],
      disciplinasPastorales: disciplinasPastoralesResult?.data ?? [],
      amigosCongregacion: amigosResult?.data ?? [],
      familiaAmigos: familiaAmigosResult?.data ?? [],
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
    setTraslados(freshData.traslados)
    setDiscipuladoActivos(freshData.discipuladoActivos)
    setDisciplinasPastorales(freshData.disciplinasPastorales)
    setAmigosCongregacion(freshData.amigosCongregacion)
    setFamiliaAmigos(freshData.familiaAmigos)
    setLoading(false)
    feligresiaCache.set(cacheKey, freshData)
  }

  useEffect(() => { load() }, [congregacionId, peoplePage, personStatus, deferredSearch, reloadToken])
  useEffect(() => {
    if (!congregacionId) return
    supabase.rpc('tiene_permiso', { p_congregacion_id: congregacionId, p_permiso: 'feligresia.editar' }).then(({ data }) => setCanEdit(Boolean(data)))
  }, [congregacionId])
  useEffect(() => {
    if (!congregacionId) return
    getRangosEdadComite(congregacionId).then(({ data }) => setRangosEdad(data ?? []))
  }, [congregacionId])
  useEffect(() => { setPeoplePage(0) }, [personStatus, search])

  const today = hoyBogota()
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
    if (['personas', 'familias', 'comites', 'seguimiento', 'historial', 'informe', 'salud'].includes(requestedTab)) setTab(requestedTab)
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
      setError('Indica la fecha de bautismo para guardar el registro.')
      setNotice(null)
      return
    }
    if (form.sellado_espiritu_santo && !form.fecha_sellado) {
      setError('Indica la fecha en que recibió el sello del Espíritu Santo.')
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
      genero: form.genero || null,
      fecha_bautismo: form.bautizado ? form.fecha_bautismo : null,
      sellado_espiritu_santo: Boolean(form.sellado_espiritu_santo),
      fecha_sellado: form.sellado_espiritu_santo ? form.fecha_sellado : null,
      fecha_ingreso: form.fecha_ingreso || null,
      fecha_ultima_asistencia: form.fecha_ultima_asistencia || null,
      familia_id: form.familia_id || null,
      parentesco_familiar: form.familia_id ? form.parentesco_familiar || null : null,
      observaciones_pastorales: observaciones || null,
      tipo_documento: form.tipo_documento || null,
      numero_documento: form.numero_documento?.trim() || null,
      nivel_educativo: form.nivel_educativo || null,
      ocupacion: form.ocupacion?.trim() || null,
      telefono_tipo: form.telefono_tipo || null,
      tiene_whatsapp: Boolean(form.tiene_whatsapp),
      telefono_alterno: form.telefono_alterno?.trim() || null,
      red_social: form.red_social?.trim() || null,
      pais_bautismo: form.bautizado ? (form.pais_bautismo?.trim() || null) : null,
      municipio_bautismo: form.bautizado ? (form.municipio_bautismo?.trim() || null) : null,
      congregacion_bautismo_id: form.bautizado ? (form.congregacion_bautismo_id || null) : null,
      congregacion_bautismo_nombre: form.bautizado && !form.congregacion_bautismo_id ? (form.congregacion_bautismo_nombre?.trim() || null) : null,
      pastor_bautizo: form.bautizado ? (form.pastor_bautizo?.trim() || null) : null,
      autorizacion_datos_salud: Boolean(form.autorizacion_datos_salud),
      fecha_autorizacion_datos_salud: form.autorizacion_datos_salud ? (form.fecha_autorizacion_datos_salud || hoyBogota()) : null,
      tipo_sangre: form.autorizacion_datos_salud ? (form.tipo_sangre || null) : null,
      eps_nombre: form.autorizacion_datos_salud ? (form.eps_nombre?.trim() || null) : null,
      condiciones_medicas: form.autorizacion_datos_salud ? (form.condiciones_medicas?.trim() || null) : null,
      alergias: form.autorizacion_datos_salud ? (form.alergias?.trim() || null) : null,
      medicamentos_actuales: form.autorizacion_datos_salud ? (form.medicamentos_actuales?.trim() || null) : null,
      discapacidad: form.autorizacion_datos_salud ? (form.discapacidad?.trim() || null) : null,
      embarazada: form.autorizacion_datos_salud ? Boolean(form.embarazada) : false,
      fecha_probable_parto: form.autorizacion_datos_salud && form.embarazada ? (form.fecha_probable_parto || null) : null,
      contacto_emergencia_nombre: form.autorizacion_datos_salud ? (form.contacto_emergencia_nombre?.trim() || null) : null,
      contacto_emergencia_telefono: form.autorizacion_datos_salud ? (form.contacto_emergencia_telefono?.trim() || null) : null,
      contacto_emergencia_parentesco: form.autorizacion_datos_salud ? (form.contacto_emergencia_parentesco?.trim() || null) : null,
      consentimiento_datos_firma: form.consentimiento_datos_firma || null,
      fecha_consentimiento_datos: form.consentimiento_datos_firma ? (form.fecha_consentimiento_datos || hoyBogota()) : null,
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
    const result = await supabase.from('comites').insert({ congregacion_id: congregacionId, nombre: committeeName.trim(), codigo: committeeCode.trim() || null, tipo_id: committeeType || null, descripcion: committeeDescription.trim() || null, proposito: committeePurpose.trim() || null, fecha_inicio: committeeStart || hoyBogota(), fecha_fin: committeeEnd || null, responsable_id: committeeResponsible || null, observaciones: committeeNotes.trim() || null })
    setSaving(false)
    if (result.error) { setError(`No se pudo crear el comité: ${result.error.message}`); return }
    setCommitteeName(''); setCommitteeCode(''); setCommitteeType(''); setCommitteeDescription(''); setCommitteePurpose(''); setCommitteeStart(''); setCommitteeEnd(''); setCommitteeResponsible(''); setCommitteeNotes(''); setNotice('Comité creado correctamente.'); load()
  }

  async function assignCommittee(event) {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null)
    if (!canEdit) { setSaving(false); setError('Tu perfil no permite gestionar integrantes.'); return }
    const formElement = event.currentTarget
    const data = new FormData(formElement)
    const cargoValue = data.get('cargo_id') || data.get('cargo')
    const selectedCargo = committeeCargoCatalog.find((cargo) => cargo.id === cargoValue)
    const selectedPerson = people.find((person) => person.id === data.get('persona_id'))
    if (!selectedPerson?.bautizado) { setSaving(false); setError('Esta persona debe estar bautizada o bautizado para pertenecer a un comité.'); return }
    if (selectedCargo?.requiere_sellado && !selectedPerson?.sellado_espiritu_santo) { setSaving(false); setError('Este cargo requiere que la persona haya recibido el sello del Espíritu Santo.'); return }
    const disciplinaActiva = disciplinasPastorales.find((item) => item.persona_id === selectedPerson?.id && !item.fecha_restauracion)
    if (disciplinaActiva) { setSaving(false); setError(`Esta persona tiene una disciplina/suspensión activa desde ${disciplinaActiva.fecha_inicio} (${disciplinaActiva.motivo}) -- registra su restauración antes de asignarle un cargo.`); return }
    const result = await supabase.from('membresias_comite').insert({ comite_id: data.get('comite_id'), persona_id: data.get('persona_id'), cargo_id: selectedCargo?.id || null, cargo: selectedCargo?.nombre || data.get('cargo') || null })
    setSaving(false)
    if (result.error) { setError(`No se pudo asignar el integrante: ${result.error.message}`); return }
    formElement.reset(); setNotice('Integrante asignado correctamente al comité.'); load()
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
      const result = await supabase.from('membresias_comite').update({ fecha_fin: hoyBogota(), estado: 'historico', motivo_retiro: 'Retiro registrado desde Feligresía', usuario_cambio_id: (await supabase.auth.getUser()).data.user?.id || null }).eq('id', member.id)
      setSaving(false)
      if (result.error) { setError(`No se pudo retirar el integrante: ${result.error.message}`); return }
      setDialog(null); setNotice('Integrante retirado del comité.'); load()
    } })
  }

  function editCommitteeMember(member) {
    setDialog({ title: 'Editar responsabilidad', fields: [{ name: 'cargo_id', label: 'Cargo normalizado', value: member.cargo_id || '', type: 'select', options: committeeCargoCatalog.map((cargo) => ({ value: cargo.id, label: cargo.nombre })) }, { name: 'cargo', label: 'Cargo histórico o texto libre', value: member.cargo || '' }, { name: 'reemplazo_persona_id', label: 'Reemplazar por otra persona (opcional)', value: '', type: 'select', options: [{ value: '', label: 'Sin reemplazo' }, ...analyticsPeople.filter((person) => person.id !== member.persona_id && person.estado_membresia === 'activo').map((person) => ({ value: person.id, label: `${person.nombres} ${person.apellidos}` }))] }, { name: 'fecha_efectiva', label: 'Fecha efectiva del reemplazo', value: hoyBogota(), type: 'date' }, { name: 'motivo', label: 'Motivo del cambio', value: '' }], onSubmit: async (values) => {
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
    const formElement = event.currentTarget
    const data = new FormData(formElement)
    const action = data.get('accion')?.toString().trim()
    if (!action) return
    const fecha = data.get('fecha') || hoyBogota()
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
    formElement.reset()
    setNotice('Seguimiento pastoral registrado.'); load()
  }

  async function saveCargo(event) {
    event.preventDefault()
    if (!canEdit) { setError('Tu perfil no permite modificar cargos.'); return }
    if (!selected) return
    const formElement = event.currentTarget
    const data = new FormData(formElement)
    const nombreCargo = data.get('nombre_cargo')?.toString().trim()
    if (!nombreCargo) return
    setSaving(true); setError(null)
    const fechaInicio = data.get('fecha_inicio') || hoyBogota()
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
    formElement.reset()
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
        fecha: data.get('fecha') || hoyBogota(),
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

  async function reconciliarPersona(person) {
    if (!canEdit || !person) return
    setDialog({ title: 'Reconciliar persona', message: `${person.nombres} ${person.apellidos} volverá a estado Activo y quedará registrada como reconciliación en su historial de movimientos.`, confirmLabel: 'Reconciliar', onConfirm: async () => {
      setSaving(true); setError(null)
      let result
      try {
        result = await withRequestTimeout(supabase.from('personas').update({ estado_membresia: 'activo' }).eq('id', person.id))
        if (!result.error) {
          result = await withRequestTimeout(supabase.from('movimientos_membresia').insert({
            persona_id: person.id,
            congregacion_id: congregacionId,
            tipo: 'reactivacion',
            fecha: hoyBogota(),
            observaciones: 'Reconciliación registrada desde la ficha de la persona.',
          }))
        }
      } catch (requestError) {
        setSaving(false); setError(requestError.message); return
      }
      setSaving(false)
      if (result.error) { setError(`No se pudo reconciliar a la persona: ${result.error.message}`); return }
      setDialog(null); setNotice(`${person.nombres} ${person.apellidos} fue reconciliado/a y vuelve a estado Activo.`); load()
    } })
  }

  // conyuge_id es simetrico (A.conyuge_id=B implica B.conyuge_id=A) --
  // se mantiene con dos updates explicitos aqui, no con un trigger (ver
  // supabase/modulos/matrimonio_y_defuncion.sql para el porque). Solo se
  // ofrecen como candidatos personas activas que todavia no tienen
  // conyuge, para no pisar por accidente el matrimonio de alguien mas.
  function vincularConyuge(person) {
    if (!canEdit || !person) return
    const candidatos = analyticsPeople.filter((item) => item.id !== person.id && item.estado_membresia === 'activo' && !item.conyuge_id)
    setDialog({
      title: person.conyuge_id ? 'Cambiar cónyuge' : 'Vincular cónyuge',
      message: 'Selecciona la persona del censo con quien está casado/a. Ambas fichas quedarán vinculadas y en estado civil "Casado/a".',
      fields: [
        { name: 'conyuge_id', label: 'Cónyuge', value: person.conyuge_id || '', required: true, type: 'select', options: [{ value: '', label: 'Seleccionar...' }, ...candidatos.map((item) => ({ value: item.id, label: `${item.nombres} ${item.apellidos}` }))] },
        { name: 'fecha_matrimonio', label: 'Fecha de matrimonio (opcional)', value: person.fecha_matrimonio || '' , type: 'date' },
      ],
      onSubmit: async (values) => {
        setSaving(true); setError(null)
        let result
        try {
          if (person.conyuge_id && person.conyuge_id !== values.conyuge_id) {
            result = await withRequestTimeout(supabase.from('personas').update({ conyuge_id: null, fecha_matrimonio: null }).eq('id', person.conyuge_id))
          }
          if (!result?.error) {
            result = await withRequestTimeout(supabase.from('personas').update({ conyuge_id: values.conyuge_id, fecha_matrimonio: values.fecha_matrimonio || null, estado_civil: 'casado' }).eq('id', person.id))
          }
          if (!result.error) {
            result = await withRequestTimeout(supabase.from('personas').update({ conyuge_id: person.id, fecha_matrimonio: values.fecha_matrimonio || null, estado_civil: 'casado' }).eq('id', values.conyuge_id))
          }
        } catch (requestError) {
          setSaving(false); setError(requestError.message); return
        }
        setSaving(false)
        if (result.error) { setError(`No se pudo vincular el cónyuge: ${result.error.message}`); return }
        setDialog(null); setNotice('Cónyuge vinculado correctamente.'); load()
      },
    })
  }

  function desvincularConyuge(person) {
    if (!canEdit || !person?.conyuge_id) return
    setDialog({ title: 'Desvincular cónyuge', message: 'Se quitará el vínculo matrimonial entre ambas fichas. El estado civil no cambia automáticamente -- actualízalo tú si corresponde (ej. a Divorciado/a).', confirmLabel: 'Desvincular', onConfirm: async () => {
      setSaving(true); setError(null)
      let result
      try {
        result = await withRequestTimeout(supabase.from('personas').update({ conyuge_id: null, fecha_matrimonio: null }).eq('id', person.id))
        if (!result.error) {
          result = await withRequestTimeout(supabase.from('personas').update({ conyuge_id: null, fecha_matrimonio: null }).eq('id', person.conyuge_id))
        }
      } catch (requestError) {
        setSaving(false); setError(requestError.message); return
      }
      setSaving(false)
      if (result.error) { setError(`No se pudo desvincular: ${result.error.message}`); return }
      setDialog(null); setNotice('Cónyuge desvinculado.'); load()
    } })
  }

  // Unico camino para llegar a estado_membresia='fallecido' -- no se deja
  // elegir desde el select generico de estado porque requiere fecha
  // obligatoria y dispara varios efectos que no tendria sentido dejar a
  // medias: se registra en movimientos_membresia (igual que traslados,
  // disciplina, exclusion), el conyuge (si esta vinculado) pasa a Viudo/a,
  // y se cierran sus cargos y membresias de comite vigentes -- decisiones
  // confirmadas explicitamente por el usuario, no supuestos.
  function marcarFallecido(person) {
    if (!canEdit || !person) return
    setDialog({
      title: 'Registrar fallecimiento',
      message: `${person.nombres} ${person.apellidos} pasará a estado Fallecido. Se cerrarán sus cargos y comités vigentes${person.conyuge_id ? ', y su cónyuge quedará como Viudo/a' : ''}.`,
      fields: [
        { name: 'fecha_fallecimiento', label: 'Fecha de fallecimiento', value: hoyBogota(), required: true, type: 'date' },
        { name: 'notas_fallecimiento', label: 'Notas (opcional)', value: '' },
      ],
      onSubmit: async (values) => {
        setSaving(true); setError(null)
        let result
        try {
          result = await withRequestTimeout(supabase.from('personas').update({
            estado_membresia: 'fallecido',
            fecha_fallecimiento: values.fecha_fallecimiento,
            notas_fallecimiento: values.notas_fallecimiento.trim() || null,
          }).eq('id', person.id))
          if (!result.error) {
            result = await withRequestTimeout(supabase.from('movimientos_membresia').insert({
              persona_id: person.id,
              congregacion_id: congregacionId,
              tipo: 'baja_fallecimiento',
              fecha: values.fecha_fallecimiento,
              observaciones: values.notas_fallecimiento.trim() || null,
            }))
          }
          if (!result.error && person.conyuge_id) {
            result = await withRequestTimeout(supabase.from('personas').update({ estado_civil: 'viudo' }).eq('id', person.conyuge_id))
          }
          if (!result.error) {
            result = await withRequestTimeout(supabase.from('historial_cargos').update({ fecha_fin: values.fecha_fallecimiento }).eq('persona_id', person.id).is('fecha_fin', null))
          }
          if (!result.error) {
            result = await withRequestTimeout(supabase.from('membresias_comite').update({ fecha_fin: values.fecha_fallecimiento, estado: 'historico', motivo_retiro: 'Fallecimiento', usuario_cambio_id: (await supabase.auth.getUser()).data.user?.id || null }).eq('persona_id', person.id).is('fecha_fin', null))
          }
        } catch (requestError) {
          setSaving(false); setError(requestError.message); return
        }
        setSaving(false)
        if (result.error) { setError(`No se pudo registrar el fallecimiento: ${result.error.message}`); return }
        setDialog(null); setNotice(`Se registró el fallecimiento de ${person.nombres} ${person.apellidos}.`); load()
      },
    })
  }

  async function descargarCertificadoDefuncionPersona(person) {
    if (!person || person.estado_membresia !== 'fallecido') return
    setError(null)
    try {
      await descargarCertificadoDefuncion({
        nombreCompleto: `${person.nombres} ${person.apellidos}`,
        fechaFallecimiento: person.fecha_fallecimiento,
        congregacionNombre: rolPrincipal?.congregaciones?.nombre,
        pastorNombre: rolPrincipal?.congregaciones?.pastor_nombre,
      })
    } catch (pdfError) {
      setError(`No se pudo generar el certificado: ${pdfError.message}`)
    }
  }

  function registrarDisciplina(person) {
    if (!canEdit) { setError('Tu perfil no permite registrar disciplina.'); return }
    setDialog({
      title: `Registrar disciplina/suspensión · ${person.nombres} ${person.apellidos}`,
      fields: [
        { name: 'motivo', label: 'Motivo', type: 'textarea', required: true },
        { name: 'fecha_inicio', label: 'Fecha de inicio', type: 'date', value: hoyBogota(), required: true },
        { name: 'fecha_fin_prevista', label: 'Fecha prevista de finalización (opcional)', type: 'date' },
      ],
      onSubmit: async (values) => {
        setSaving(true); setError(null)
        const usuarioId = (await supabase.auth.getUser()).data.user?.id || null
        const result = await supabase.from('disciplinas_pastorales').insert({
          persona_id: person.id, congregacion_id: congregacionId, motivo: values.motivo.trim(),
          fecha_inicio: values.fecha_inicio, fecha_fin_prevista: values.fecha_fin_prevista || null, usuario_id: usuarioId,
        })
        setSaving(false)
        if (result.error) { setError(`No se pudo registrar la disciplina: ${result.error.message}`); return }
        setDialog(null); setNotice('Disciplina/suspensión registrada. La persona queda bloqueada para asignarse a un cargo nuevo hasta que se registre su restauración.'); load()
      },
    })
  }

  function agregarSeguimientoDisciplina(disciplina) {
    if (!canEdit) { setError('Tu perfil no permite registrar seguimientos.'); return }
    setDialog({
      title: 'Agregar seguimiento a la disciplina',
      fields: [
        { name: 'nota', label: 'Nota', type: 'textarea', required: true },
        { name: 'fecha', label: 'Fecha', type: 'date', value: hoyBogota(), required: true },
      ],
      onSubmit: async (values) => {
        setSaving(true); setError(null)
        const usuarioId = (await supabase.auth.getUser()).data.user?.id || null
        const result = await supabase.from('disciplinas_seguimiento').insert({ disciplina_id: disciplina.id, nota: values.nota.trim(), fecha: values.fecha, usuario_id: usuarioId })
        setSaving(false)
        if (result.error) { setError(`No se pudo registrar el seguimiento: ${result.error.message}`); return }
        setDialog(null); setNotice('Seguimiento registrado.'); load()
      },
    })
  }

  function restaurarDisciplina(disciplina) {
    if (!canEdit) { setError('Tu perfil no permite registrar restauraciones.'); return }
    setDialog({
      title: 'Registrar restauración',
      message: 'La persona vuelve a quedar habilitada para asignarse a un cargo o comité.',
      fields: [
        { name: 'fecha_restauracion', label: 'Fecha de restauración', type: 'date', value: hoyBogota(), required: true },
        { name: 'notas_restauracion', label: 'Notas (opcional)', type: 'textarea' },
      ],
      onSubmit: async (values) => {
        setSaving(true); setError(null)
        const result = await supabase.from('disciplinas_pastorales').update({ fecha_restauracion: values.fecha_restauracion, notas_restauracion: values.notas_restauracion?.trim() || null }).eq('id', disciplina.id)
        setSaving(false)
        if (result.error) { setError(`No se pudo registrar la restauración: ${result.error.message}`); return }
        setDialog(null); setNotice('Restauración registrada.'); load()
      },
    })
  }

  async function buscarCongregacionesBautismo(texto) {
    setBautismoBusqueda(texto)
    if (texto.trim().length < 2) { setBautismoResultados([]); return }
    const { data, error: buscarError } = await supabase.rpc('buscar_congregaciones', { p_busqueda: texto.trim() })
    if (buscarError) { setError(`No se pudo buscar la congregación: ${buscarError.message}`); return }
    setBautismoResultados(data ?? [])
  }

  async function buscarCongregacionesDestino(texto) {
    setTrasladoBusqueda(texto)
    if (texto.trim().length < 2) { setTrasladoResultados([]); return }
    const { data, error: buscarError } = await supabase.rpc('buscar_congregaciones', { p_busqueda: texto.trim() })
    if (buscarError) { setError(`No se pudo buscar la congregación: ${buscarError.message}`); return }
    setTrasladoResultados((data ?? []).filter((item) => item.id !== congregacionId))
  }

  async function iniciarTraslado() {
    if (!canEdit || !selected || !trasladoDestinoId) return
    setSavingTraslado(true); setError(null)
    const { error: trasladoError } = await supabase.rpc('solicitar_traslado_persona', {
      p_persona_id: selected.id,
      p_congregacion_destino_id: trasladoDestinoId,
      p_observaciones: trasladoObservaciones.trim() || null,
    })
    setSavingTraslado(false)
    if (trasladoError) { setError(`No se pudo iniciar el traslado: ${trasladoError.message}`); return }
    setTrasladoBusqueda(''); setTrasladoResultados([]); setTrasladoDestinoId(''); setTrasladoObservaciones('')
    setNotice('Traslado iniciado. La congregación destino debe recibirlo para completarlo.')
    setShowForm(false)
    load()
  }

  async function recibirTraslado(traslado) {
    if (!canEdit) return
    setSavingTraslado(true); setError(null)
    const { error: recibirError } = await supabase.rpc('recibir_traslado_persona', { p_traslado_id: traslado.id })
    setSavingTraslado(false)
    if (recibirError) { setError(`No se pudo recibir el traslado: ${recibirError.message}`); return }
    setNotice(`${traslado.persona?.nombres} ${traslado.persona?.apellidos} ahora pertenece a tu congregación, con todo su historial.`)
    load()
  }

  async function cancelarTraslado(traslado) {
    if (!canEdit) return
    setSavingTraslado(true); setError(null)
    const { error: cancelarError } = await supabase.rpc('cancelar_traslado_persona', { p_traslado_id: traslado.id })
    setSavingTraslado(false)
    if (cancelarError) { setError(`No se pudo cancelar el traslado: ${cancelarError.message}`); return }
    setNotice('Traslado cancelado.')
    load()
  }

  async function attendPastoralAlert(alert) {
    if (!canEdit) { setError('Tu perfil solo permite consultar alertas.'); return }
    setDialog({ title: 'Atender alerta pastoral', message: alert.detalle, fields: [{ name: 'accion', label: 'Acción realizada', value: '', required: true }, { name: 'fecha', label: 'Fecha realizada', value: hoyBogota(), required: true, type: 'date' }, { name: 'proxima_fecha', label: 'Próximo contacto (opcional)', value: '', type: 'date' }, { name: 'notas', label: 'Notas', value: '' }], onSubmit: (values) => saveAlertAttention(alert, values) })
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

  // Atajo de un solo toque para la alerta "sin asistencia reciente": antes
  // "Atender" solo dejaba una nota y silenciaba la alerta por lo que queda
  // del mes (su clave incluye YYYY-MM), sin tocar fecha_ultima_asistencia
  // -- por eso la misma alerta volvía a aparecer sola el mes siguiente. Este
  // botón sí actualiza el dato real, así que la alerta deja de generarse.
  async function confirmarContactoHoy(alert) {
    if (!canEdit) { setError('Tu perfil solo permite consultar alertas.'); return }
    setSaving(true); setError(null)
    const result = await withRequestTimeout(supabase.from('personas').update({ fecha_ultima_asistencia: hoyBogota() }).eq('id', alert.persona_id))
    setSaving(false)
    if (result.error) { setError(`No se pudo confirmar el contacto: ${result.error.message}`); return }
    setNotice('Contacto de hoy confirmado.'); load()
  }

  async function updateFollowupStatus(followup, estado) {
    if (!canEdit) { setError('Tu perfil solo permite consultar seguimientos.'); return }
    if (estado === 'pendiente' && !followup.proxima_fecha) {
      setDialog({ title: 'Reabrir seguimiento', message: 'Un seguimiento pendiente necesita una próxima fecha de contacto.', fields: [{ name: 'proxima_fecha', label: 'Próximo contacto', value: hoyBogota(), required: true, type: 'date' }], onSubmit: (values) => saveFollowupReopen(followup, values.proxima_fecha) })
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
    const result = await withRequestTimeout(supabase.from('personas').select('id, nombres, apellidos, telefono, fecha_nacimiento, fecha_ingreso, estado_membresia, estado_civil, genero, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ultima_asistencia, familia_id, parentesco_familiar, observaciones_pastorales, conyuge_id, fecha_matrimonio, fecha_fallecimiento, notas_fallecimiento, tipo_documento, numero_documento, nivel_educativo, ocupacion, telefono_tipo, tiene_whatsapp, telefono_alterno, red_social, pais_bautismo, municipio_bautismo, congregacion_bautismo_id, congregacion_bautismo_nombre, pastor_bautizo, tipo_sangre, eps_nombre, condiciones_medicas, alergias, medicamentos_actuales, discapacidad, embarazada, fecha_probable_parto, contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco, autorizacion_datos_salud, fecha_autorizacion_datos_salud, consentimiento_datos_firma, fecha_consentimiento_datos, congregaciones_bautismo:congregacion_bautismo_id(nombre, ciudad), familias(nombre_familia)').eq('id', personaId).maybeSingle())
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

  async function fetchPeopleForExport() {
    if (!congregacionId) return null
    let query = supabase.from('personas').select('nombres, apellidos, telefono, fecha_nacimiento, estado_civil, genero, estado_membresia, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ingreso, fecha_ultima_asistencia, parentesco_familiar, familias(nombre_familia)').eq('congregacion_id', congregacionId).order('apellidos').order('nombres')
    if (personStatus !== 'todos') query = query.eq('estado_membresia', personStatus)
    if (deferredSearch.trim()) query = query.or(`nombres.ilike.%${deferredSearch.trim()}%,apellidos.ilike.%${deferredSearch.trim()}%`)
    const result = await query
    if (result.error) { setError('No se pudo exportar el censo.'); return null }
    const headers = ['Nombres', 'Apellidos', 'Teléfono', 'Fecha nacimiento', 'Género', 'Estado civil', 'Estado', 'Bautizado', 'Fecha bautismo', 'Sellado con el Espíritu Santo', 'Fecha sellado', 'Fecha ingreso', 'Última asistencia', 'Familia', 'Parentesco']
    const rows = (result.data ?? []).map((person) => [person.nombres, person.apellidos, person.telefono, person.fecha_nacimiento, GENERO_LABELS[person.genero] || '', MARITAL_STATUSES[person.estado_civil] || person.estado_civil, STATES[person.estado_membresia], person.bautizado ? 'Sí' : 'No', person.fecha_bautismo, person.sellado_espiritu_santo ? 'Sí' : 'No', person.fecha_sellado, person.fecha_ingreso, person.fecha_ultima_asistencia, person.familias?.nombre_familia, FAMILY_RELATIONSHIPS[person.parentesco_familiar] || person.parentesco_familiar])
    const meta = [personStatus !== 'todos' ? `Estado: ${STATES[personStatus] || personStatus}` : 'Estado: Todos', deferredSearch.trim() ? `Búsqueda: ${deferredSearch.trim()}` : null].filter(Boolean)
    const personas = result.data ?? []
    const porEstado = {}
    const porGenero = {}
    personas.forEach((person) => {
      const estado = STATES[person.estado_membresia] || person.estado_membresia
      porEstado[estado] = (porEstado[estado] || 0) + 1
      const genero = GENERO_LABELS[person.genero] || 'Sin especificar'
      porGenero[genero] = (porGenero[genero] || 0) + 1
    })
    const resumen = {
      kpis: [
        { label: 'Personas en el censo', value: personas.length },
        { label: 'Bautizados', value: personas.filter((person) => person.bautizado).length },
        { label: 'Sellados con el Espíritu Santo', value: personas.filter((person) => person.sellado_espiritu_santo).length },
        { label: 'Con familia asignada', value: personas.filter((person) => person.familias?.nombre_familia).length },
      ],
      desgloses: [
        { titulo: 'Personas por estado', items: Object.entries(porEstado).map(([label, valor]) => ({ label, valor })) },
        { titulo: 'Personas por género', items: Object.entries(porGenero).map(([label, valor]) => ({ label, valor })) },
      ],
    }
    return { headers, rows, meta, resumen }
  }

  async function exportPeopleCsv() {
    const data = await fetchPeopleForExport()
    if (!data) return
    descargarCsv({ filename: `censo-${hoyBogota()}.csv`, titulo: 'Censo de feligresía', ...data })
    setNotice('Censo exportado correctamente.')
  }

  async function exportPeopleExcel() {
    const data = await fetchPeopleForExport()
    if (!data) return
    await descargarExcel({ filename: `censo-${hoyBogota()}.xlsx`, hoja: 'Censo', titulo: 'Censo de feligresía', ...data })
    setNotice('Censo exportado correctamente.')
  }

  async function exportPeoplePdf() {
    const data = await fetchPeopleForExport()
    if (!data) return
    await descargarPdf({ filename: `censo-${hoyBogota()}.pdf`, titulo: 'Censo de feligresía', orientacion: 'landscape', ...data })
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
  // Para la etiqueta "Sugerido: X" del censo -- quien ya tiene un comite
  // activo no necesita sugerencia, sin importar si ese comite coincide
  // o no con el catalogo de rangos de edad.
  const personasConComite = new Set(committees.flatMap((committee) => (committee.membresias_comite ?? []).filter((member) => !member.fecha_fin).map((member) => member.persona_id)))
  const discipuladoInicioPorPersona = new Map(discipuladoActivos.map((row) => [row.persona_id, row.fecha_inicio]))
  function nuevoBautizadoInfo(personId) {
    const fechaInicio = discipuladoInicioPorPersona.get(personId)
    if (!fechaInicio) return null
    const dias = diasDesde(fechaInicio)
    if (dias === null || dias >= UMBRAL_DIAS_NUEVO_BAUTIZADO) return null
    return { dias }
  }
  const totalPages = Math.max(1, Math.ceil(peopleTotal / peoplePageSize))
  const active = summary?.personas_activas ?? 0
  const baptized = summary?.bautizados ?? 0
  const sealed = summary?.sellados ?? 0
  const apart = summary?.apartados ?? 0
  const familiesWithPeople = summary?.familias_asociadas ?? 0
  function startNewPerson() { setSelected(null); setForm(EMPTY_PERSON); setShowForm(true) }
  function editPerson(person) { if (!canEdit) return; setSelected(person); setForm({ ...EMPTY_PERSON, ...person, fecha_bautismo: person.fecha_bautismo || '', fecha_sellado: person.fecha_sellado || '', fecha_ingreso: person.fecha_ingreso || '', fecha_ultima_asistencia: person.fecha_ultima_asistencia || '', familia_id: person.familia_id || '', conyuge_id: person.conyuge_id || '', fecha_matrimonio: person.fecha_matrimonio || '', fecha_fallecimiento: person.fecha_fallecimiento || '', notas_fallecimiento: person.notas_fallecimiento || '', tipo_documento: person.tipo_documento || '', numero_documento: person.numero_documento || '', nivel_educativo: person.nivel_educativo || '', ocupacion: person.ocupacion || '', telefono_tipo: person.telefono_tipo || '', telefono_alterno: person.telefono_alterno || '', red_social: person.red_social || '', pais_bautismo: person.pais_bautismo || '', municipio_bautismo: person.municipio_bautismo || '', congregacion_bautismo_id: person.congregacion_bautismo_id || '', congregacion_bautismo_nombre: person.congregacion_bautismo_nombre || '', pastor_bautizo: person.pastor_bautizo || '', tipo_sangre: person.tipo_sangre || '', eps_nombre: person.eps_nombre || '', condiciones_medicas: person.condiciones_medicas || '', alergias: person.alergias || '', medicamentos_actuales: person.medicamentos_actuales || '', discapacidad: person.discapacidad || '', fecha_probable_parto: person.fecha_probable_parto || '', contacto_emergencia_nombre: person.contacto_emergencia_nombre || '', contacto_emergencia_telefono: person.contacto_emergencia_telefono || '', contacto_emergencia_parentesco: person.contacto_emergencia_parentesco || '', fecha_autorizacion_datos_salud: person.fecha_autorizacion_datos_salud || '', consentimiento_datos_firma: person.consentimiento_datos_firma || '', fecha_consentimiento_datos: person.fecha_consentimiento_datos || '' }); setShowForm(true) }

  return <div className={`flex flex-col gap-6 ${canEdit === false ? 'feligresia-read-only' : ''}`}>
    {loading && <p role="status" className="text-sm text-muted bg-surface-1 rounded p-3">Cargando información de feligresía...</p>}
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Administración local</p><h1 className="text-2xl font-semibold">Feligresía</h1><p className="text-sm text-secondary mt-1">Censo, familias, comités y seguimiento pastoral.</p></div><div className="flex flex-wrap gap-2">{canEdit && <label className="btn-secondary cursor-pointer" title="Importar CSV o Excel"><Download className="w-4 h-4" /> Importar<input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} /></label>}<ExportButtons onCsv={exportPeopleCsv} onExcel={exportPeopleExcel} onPdf={exportPeoplePdf} />{canEdit && <button onClick={startNewPerson} className="btn-primary"><Plus className="w-4 h-4" /> Registrar persona</button>}</div></header>
    {canEdit === false && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Modo consulta: tu perfil puede revisar la feligresía, pero no modificarla.</p>}
    {importError && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3"><p>{importError}</p>{importRowErrors.length > 0 && <ul className="mt-2 list-disc pl-5">{importRowErrors.map((message) => <li key={message}>{message}</li>)}</ul>}</div>}
    {importRows.length > 0 && <section className="card p-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-medium">Vista previa de importación</h2><p className="text-xs text-secondary mt-1">{importRows.length} filas listas. Las familias no encontradas quedarán sin asociación.</p></div><div className="flex gap-2"><button type="button" onClick={() => setImportRows([])} className="btn-secondary">Cancelar</button><button type="button" onClick={importPeople} disabled={saving} className="btn-primary">{saving ? 'Importando...' : 'Confirmar importación'}</button></div></div><div className="overflow-x-auto mt-3"><table className="w-full text-xs"><thead><tr className="text-left border-b border-border"><th className="py-2 pr-3">Nombre</th><th className="py-2 pr-3">Operación</th><th className="py-2 pr-3">Estado</th><th className="py-2 pr-3">Bautizado</th><th className="py-2">Familia</th></tr></thead><tbody>{importRows.slice(0, 5).map((row) => <tr key={row.row} className="border-b border-border"><td className="py-2 pr-3">{row.nombres} {row.apellidos}</td><td className={`py-2 pr-3 ${row.operation === 'actualizar' ? 'text-accent' : 'text-success'}`}>{row.operation}</td><td className="py-2 pr-3">{STATES[row.estado_membresia]}</td><td className="py-2 pr-3">{row.bautizado ? 'Sí' : 'No'}</td><td className="py-2">{row.familia || 'Sin familia'}</td></tr>)}</tbody></table></div></section>}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3"><Metric label="Personas activas" value={active} accent /><Metric label="Bautizados" value={baptized} info="Total en vivo, ahora mismo. El Informe trimestral (pestaña de arriba) muestra en cambio una foto al cierre de un trimestre -- pueden no coincidir si no estás en el trimestre actual." /><Metric label="Sellados" value={sealed} /><Metric label="Apartados" value={apart} info="Sigue siendo miembro, pero se alejó temporalmente de la vida activa de la congregación. No es lo mismo que 'Inactivo' o 'Trasladado'." /><Metric label="Familias asociadas" value={familiesWithPeople} /></div>
    <nav className="flex gap-1 border-b border-border overflow-x-auto" aria-label="Secciones de feligresía" role="tablist">{[['personas', 'Población', UsersRound], ['familias', 'Familias', HeartHandshake], ['comites', 'Comités', HeartHandshake], ['seguimiento', 'Seguimiento pastoral', HeartHandshake], ['traslados', `Traslados${traslados.length ? ` (${traslados.length})` : ''}`, ArrowRightLeft], ['historial', 'Evolución', BarChart3], ['informe', 'Informe trimestral', ClipboardList], ['salud', 'Salud y emergencias', Heart]].map(([key, label, Icon]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 ${tab === key ? 'border-accent text-accent' : 'border-transparent text-secondary'}`}><Icon className="w-4 h-4" />{label}</button>)}</nav>
    {error && !showForm && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => setReloadToken((current) => current + 1)} className="btn-secondary text-xs self-start sm:self-auto">Reintentar</button></div>}
    <Toast>{notice}</Toast>
    {tab === 'comites' && <><CommitteeFilters status={committeeStatusFilter} setStatus={setCommitteeStatusFilter} cargo={committeeCargoFilter} setCargo={setCommitteeCargoFilter} person={committeePersonFilter} setPerson={setCommitteePersonFilter} validity={committeeValidityFilter} setValidity={setCommitteeValidityFilter} cargos={committeeCargoCatalog} people={analyticsPeople} /><CommitteeCreateForm onSubmit={saveCommittee} saving={saving} name={committeeName} setName={setCommitteeName} code={committeeCode} setCode={setCommitteeCode} type={committeeType} setType={setCommitteeType} types={committeeTypes} description={committeeDescription} setDescription={setCommitteeDescription} purpose={committeePurpose} setPurpose={setCommitteePurpose} start={committeeStart} setStart={setCommitteeStart} end={committeeEnd} setEnd={setCommitteeEnd} responsible={committeeResponsible} setResponsible={setCommitteeResponsible} notes={committeeNotes} setNotes={setCommitteeNotes} people={analyticsPeople} /></>}
    {tab === 'seguimiento' && <><PastoralAgendaFilter value={pastoralAgendaStatus} onChange={setPastoralAgendaStatus} search={pastoralAgendaSearch} setSearch={setPastoralAgendaSearch} /><PastoralSection alerts={pastoralAlerts} followups={pastoralFollowups} people={analyticsPeople} saving={saving} onAttend={attendPastoralAlert} onConfirmContact={confirmarContactoHoy} onUpdateFollowup={updateFollowupStatus} onOpenPerson={openPersonFromFollowup} canEdit={canEdit} agendaStatus={pastoralAgendaStatus} agendaSearch={pastoralAgendaSearch} /></>}
    {tab === 'traslados' && <section className="flex flex-col gap-4">
      <section className="card p-5">
        <h2 className="font-medium">Traslados recibidos pendientes</h2>
        <p className="text-sm text-secondary mt-1">Personas de otra congregación que se trasladaron hacia la tuya. Al recibirlas, conservan todo su historial (bautismo, sellado, familia, cargos).</p>
        {traslados.filter((item) => item.congregacion_destino_id === congregacionId).length ? (
          <div className="flex flex-col gap-2.5 mt-4">
            {traslados.filter((item) => item.congregacion_destino_id === congregacionId).map((item) => (
              <div key={item.id} className="agenda-item">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.persona?.nombres} {item.persona?.apellidos}</p>
                  <p className="text-xs text-secondary mt-1">Viene de {item.origen?.nombre} · Solicitado el {item.fecha_solicitud}</p>
                  {item.observaciones && <p className="text-xs text-muted mt-1">{item.observaciones}</p>}
                </div>
                <button type="button" disabled={savingTraslado} onClick={() => recibirTraslado(item)} className="agenda-action agenda-action-success"><CheckCircle2 className="w-3.5 h-3.5" />Recibir</button>
              </div>
            ))}
          </div>
        ) : <Empty text="No hay traslados pendientes por recibir." />}
      </section>
      <section className="card p-5">
        <h2 className="font-medium">Traslados enviados pendientes</h2>
        <p className="text-sm text-secondary mt-1">Personas de tu congregación en camino a otra, esperando que la reciban.</p>
        {traslados.filter((item) => item.congregacion_origen_id === congregacionId).length ? (
          <div className="flex flex-col gap-2.5 mt-4">
            {traslados.filter((item) => item.congregacion_origen_id === congregacionId).map((item) => (
              <div key={item.id} className="agenda-item">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.persona?.nombres} {item.persona?.apellidos}</p>
                  <p className="text-xs text-secondary mt-1">Hacia {item.destino?.nombre} · Solicitado el {item.fecha_solicitud}</p>
                </div>
                <button type="button" disabled={savingTraslado} onClick={() => cancelarTraslado(item)} className="agenda-action agenda-action-danger"><XCircle className="w-3.5 h-3.5" />Cancelar</button>
              </div>
            ))}
          </div>
        ) : <Empty text="No tienes traslados enviados pendientes." />}
      </section>
    </section>}
    {tab === 'personas' && <section className="card overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1 border border-border rounded px-3 py-2 bg-surface-2">
          <Search className="w-4 h-4 text-muted flex-shrink-0" />
          <input aria-label="Buscar personas" className="bg-transparent outline-none text-sm w-full" placeholder="Buscar persona..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select aria-label="Filtrar estado" className="input-field sm:max-w-[180px]" value={personStatus} onChange={(event) => setPersonStatus(event.target.value)}><option value="todos">Todos los estados</option>{Object.entries(STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      </div>
      {loading && people.length === 0 ? <SkeletonList rows={8} /> : filtered.length ? <div className="divide-y divide-border">
        {filtered.map((person) => {
          const nuevoBautizado = nuevoBautizadoInfo(person.id)
          const tone = avatarTone(person.id)
          const comitesSugeridos = person.bautizado && !personasConComite.has(person.id)
            ? sugerirComites({ edad: calcularEdad(person.fecha_nacimiento), genero: person.genero, estadoCivil: person.estado_civil }, rangosEdad)
            : []
          const nombresComitesSugeridos = [...new Set(comitesSugeridos.map((rango) => rango.comites?.nombre).filter(Boolean))]
          return (
            <button key={person.id} onClick={() => editPerson(person)} className="censo-row group">
              <span className="censo-avatar" style={{ background: tone.bg, color: tone.fg }}>{initialesDe(person)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{person.nombres} {person.apellidos}</p>
                <p className="text-xs text-secondary mt-1 flex items-center gap-1 flex-wrap">
                  <span className="inline-flex items-center gap-1">{person.bautizado && <Droplet className="w-3 h-3 text-accent" />}{person.bautizado ? 'Bautizado' : 'No bautizado'}</span>
                  {person.familias?.nombre_familia && <span>· {person.familias.nombre_familia}</span>}
                  {person.fecha_ultima_asistencia && <span>· Últ. asistencia {person.fecha_ultima_asistencia}</span>}
                </p>
                {nuevoBautizado && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-warning bg-warning-bg rounded-full px-2 py-0.5 mt-1.5"><Droplet className="w-3 h-3" />Nuevo bautizado · {nuevoBautizado.dias}d en Discipulado</span>}
                {nombresComitesSugeridos.length > 0 && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-accent bg-accent-bg rounded-full px-2 py-0.5 mt-1.5"><UsersRound className="w-3 h-3" />Sugerido: {nombresComitesSugeridos.join(', ')}</span>}
              </div>
              <span className={`censo-badge ${STATE_BADGE_CLASS[person.estado_membresia] || 'bg-surface-1 text-secondary'}`}>{STATES[person.estado_membresia]}</span>
              <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          )
        })}
      </div> : <Empty text="No hay personas con estos filtros." />}
      <div className="flex items-center justify-between border-t border-border p-3 text-xs text-secondary"><span>{peopleTotal} personas encontradas</span><div className="flex items-center gap-2"><button type="button" disabled={peoplePage === 0 || loading} onClick={() => setPeoplePage((page) => page - 1)} className="btn-secondary px-3">Anterior</button><span>Página {peoplePage + 1} de {totalPages}</span><button type="button" disabled={peoplePage + 1 >= totalPages || loading} onClick={() => setPeoplePage((page) => page + 1)} className="btn-secondary px-3">Siguiente</button></div></div>
    </section>}
    {tab === 'familias' && <section className="flex flex-col gap-4">{canEdit && <form onSubmit={saveFamily} className="card p-4 grid sm:grid-cols-[1.2fr_1fr_0.8fr_auto] gap-2"><input required className="input-field" placeholder="Nombre de la nueva familia" value={familyName} onChange={(event) => setFamilyName(event.target.value)} /><input className="input-field" placeholder="Dirección" value={familyAddress} onChange={(event) => setFamilyAddress(event.target.value)} /><input className="input-field" placeholder="Teléfono" value={familyPhone} onChange={(event) => setFamilyPhone(event.target.value)} /><button disabled={saving} className="btn-primary whitespace-nowrap"><Plus className="w-4 h-4" /> Crear familia</button></form>}<div className="card p-4"><label className="text-sm">Consultar árbol familiar<select className="input-field mt-1.5" value={selectedFamilyId} onChange={(event) => setSelectedFamilyId(event.target.value)}><option value="">Selecciona un núcleo familiar</option>{families.map((family) => <option key={family.id} value={family.id}>{family.nombre_familia}</option>)}</select></label><p className="text-xs text-secondary mt-2">Un núcleo puede compartir personas con otra familia. La ficha de cada persona se mantiene única.</p></div><FamilyTree familyId={selectedFamilyId} families={families} members={familyMembers} relations={familyRelations} people={analyticsPeople} canEdit={canEdit} onOpenPerson={editPerson} onRefresh={() => setReloadToken((current) => current + 1)} amigos={amigosCongregacion} familiaAmigos={familiaAmigos} /><div className="grid md:grid-cols-2 gap-4">{families.map((family) => <div key={family.id} className="card p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-medium">{family.nombre_familia}</h2>{canEdit && <button type="button" className="text-xs text-accent" onClick={() => renameFamily(family)}>Editar nombre</button>}</div>{(family.direccion || family.telefono) && <p className="text-xs text-secondary mt-2">{family.direccion || 'Sin dirección'}{family.telefono ? ` · ${family.telefono}` : ''}</p>}<p className="text-sm text-secondary mt-1">{analyticsPeople.filter((person) => person.familia_id === family.id).length} creyente{analyticsPeople.filter((person) => person.familia_id === family.id).length === 1 ? '' : 's'}{familiaAmigos.filter((link) => link.familia_id === family.id).length > 0 ? ` · ${familiaAmigos.filter((link) => link.familia_id === family.id).length} amigo${familiaAmigos.filter((link) => link.familia_id === family.id).length === 1 ? '' : 's'} en ruta` : ''}</p>{analyticsPeople.filter((person) => person.familia_id === family.id).map((person) => <p key={person.id} className="text-xs text-muted mt-2">{person.nombres} {person.apellidos}</p>)}</div>)}</div>{families.length === 0 && <Empty text="Aún no hay familias registradas." illustration="familia" />}</section>}
    {tab === 'comites' && <section className="flex flex-col gap-4"><form onSubmit={assignCommittee} className="card p-4 grid sm:grid-cols-3 gap-2"><select required name="comite_id" className="input-field"><option value="">Comité...</option>{committees.filter((committee) => committee.activo).map((committee) => <option key={committee.id} value={committee.id}>{committee.nombre}</option>)}</select><select required name="persona_id" className="input-field"><option value="">Integrante...</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><div className="flex gap-2">{committeeCargoCatalog.length > 0 ? <select required name="cargo_id" className="input-field"><option value="">Cargo...</option>{committeeCargoCatalog.map((cargo) => <option key={cargo.id} value={cargo.id}>{cargo.nombre}</option>)}</select> : <input required name="cargo" className="input-field" placeholder="Cargo (configúralos en Configuración)" />}<button disabled={saving} className="btn-secondary px-3" title="Asignar integrante"><Plus className="w-4 h-4" /></button></div></form><div className="grid md:grid-cols-2 gap-4">{committees.map((committee) => <div key={committee.id} className={`card p-5 ${!committee.activo ? 'opacity-60' : ''}`}><div className="flex items-start justify-between gap-3"><h2 className="font-medium">{committee.nombre}</h2><div className="flex gap-2"><button type="button" className="text-xs text-accent" onClick={() => renameCommittee(committee)}>Editar</button><button type="button" className="text-xs text-danger" onClick={() => deactivateCommittee(committee)}>{committee.activo ? 'Desactivar' : 'Reactivar'}</button></div></div><p className="text-sm text-secondary mt-1">{committee.membresias_comite?.filter((member) => !member.fecha_fin).length ?? 0} integrantes activos</p><div className="flex flex-col gap-2 mt-4">{committeeMemberGroups(committee, committeeCargoCatalog).map((group) => <div key={group.key}><p className="text-xs font-medium text-secondary">{group.label}{group.members.length > 1 ? ` (${group.members.length})` : ''}</p>{group.members.map((member) => <div key={member.id} className="flex items-center justify-between gap-2 mt-1"><span className="text-xs bg-surface-1 rounded px-2 py-1">{people.find((person) => person.id === member.persona_id)?.nombres || 'Integrante'} {people.find((person) => person.id === member.persona_id)?.apellidos || ''}</span><div className="flex gap-2"><button type="button" className="text-xs text-accent" onClick={() => editCommitteeMember(member)}>Editar</button><button type="button" className="text-xs text-danger" onClick={() => removeCommitteeMember(member)}>Retirar</button></div></div>)}</div>)}</div></div>)}</div>{committees.length === 0 && <Empty text="Aún no hay comités registrados." illustration="equipo" />}</section>}
    {tab === 'historial' && <><CommitteeAnalytics people={analyticsPeople} committees={allCommittees} cargos={committeeCargoCatalog} audit={committeeAudit} disciplinas={disciplinasPastorales} /><FeligresiaInsights people={analyticsPeople} families={families} committees={committees} cargoHistory={cargoHistory} followups={pastoralFollowups} alerts={pastoralAlerts} /></>}
    {tab === 'informe' && <InformeTrimestralLocal congregacionId={congregacionId} />}
    {tab === 'salud' && <HealthAnalytics people={analyticsPeople} />}
    {showForm && <PersonFormDetailed form={form} setForm={setForm} families={families} committees={committees} cargoHistory={cargoHistory} rangosEdad={rangosEdad} pastoralFollowups={pastoralFollowups} movimientosMembresia={movimientosMembresia} canEdit={canEdit} saving={saving} editing={Boolean(selected)} selected={selected} error={error} close={() => { setShowForm(false); setError(null) }} onSubmit={savePerson} onSavePastoralFollowup={savePastoralFollowup} onSaveCargo={saveCargo} onEditCargo={editCargo} onSaveMovimiento={saveMovimiento} onReconciliar={reconciliarPersona} onVincularConyuge={vincularConyuge} onDesvincularConyuge={desvincularConyuge} onMarcarFallecido={marcarFallecido} onDescargarCertificadoDefuncion={descargarCertificadoDefuncionPersona} analyticsPeople={analyticsPeople} bautismoBusqueda={bautismoBusqueda} bautismoResultados={bautismoResultados} onBuscarBautismo={buscarCongregacionesBautismo} trasladoBusqueda={trasladoBusqueda} trasladoResultados={trasladoResultados} trasladoDestinoId={trasladoDestinoId} setTrasladoDestinoId={setTrasladoDestinoId} trasladoObservaciones={trasladoObservaciones} setTrasladoObservaciones={setTrasladoObservaciones} savingTraslado={savingTraslado} onBuscarDestino={buscarCongregacionesDestino} onIniciarTraslado={iniciarTraslado} nuevoBautizado={selected ? nuevoBautizadoInfo(selected.id) : null} disciplinasPastorales={disciplinasPastorales} onRegistrarDisciplina={registrarDisciplina} onAgregarSeguimientoDisciplina={agregarSeguimientoDisciplina} onRestaurarDisciplina={restaurarDisciplina} />}
    {dialog && <AdminDialog dialog={dialog} saving={saving} error={error} close={() => setDialog(null)} />}
  </div>
}

function FamilyTree({ familyId, families, members, relations, people, canEdit, onOpenPerson, onRefresh, amigos, familiaAmigos }) {
  const [memberForm, setMemberForm] = useState({ persona_id: '', parentesco: 'otro' })
  const [relationForm, setRelationForm] = useState({ persona_id: '', relacionada_id: '', tipo: 'padre' })
  const [amigoMemberForm, setAmigoMemberForm] = useState({ amigo_id: '', parentesco: 'otro' })
  const [error, setError] = useState(null)
  const family = families.find((item) => item.id === familyId)
  const familyMembers = members.filter((item) => item.familia_id === familyId)
  const familyAmigoLinks = (familiaAmigos ?? []).filter((item) => item.familia_id === familyId)
  const peopleById = new Map(people.map((person) => [person.id, person]))
  const groups = [['abuelo', 'Abuelos'], ['abuela', 'Abuelas'], ['padre', 'Padres'], ['madre', 'Madres'], ['conyuge', 'Cónyuges'], ['hijo', 'Hijos'], ['hija', 'Hijas'], ['nieto', 'Nietos'], ['nieta', 'Nietas'], ['hermano', 'Hermanos'], ['hermana', 'Hermanas'], ['nuera', 'Nueras'], ['yerno', 'Yernos'], ['referente', 'Referentes'], ['otro', 'Otros']]
  async function addMember(event) { event.preventDefault(); if (!familyId || !memberForm.persona_id) return; setError(null); const result = await supabase.from('familia_miembros').insert({ familia_id: familyId, persona_id: memberForm.persona_id, parentesco: memberForm.parentesco, es_referente: memberForm.parentesco === 'referente' }); if (result.error) { setError(`No se pudo agregar al núcleo: ${result.error.message}`); return }; setMemberForm({ persona_id: '', parentesco: 'otro' }); onRefresh() }
  async function addRelation(event) { event.preventDefault(); if (!relationForm.persona_id || !relationForm.relacionada_id) return; setError(null); const result = await supabase.from('relaciones_familiares').insert(relationForm); if (result.error) { setError(`No se pudo registrar la relación: ${result.error.message}`); return }; setRelationForm({ persona_id: '', relacionada_id: '', tipo: 'padre' }); onRefresh() }
  async function addAmigoMember(event) { event.preventDefault(); if (!familyId || !amigoMemberForm.amigo_id) return; setError(null); const result = await supabase.from('familia_amigos').insert({ familia_id: familyId, amigo_id: amigoMemberForm.amigo_id, parentesco: amigoMemberForm.parentesco }); if (result.error) { setError(`No se pudo vincular al amigo: ${result.error.message}`); return }; setAmigoMemberForm({ amigo_id: '', parentesco: 'otro' }); onRefresh() }
  async function removeAmigoMember(id) { setError(null); const result = await supabase.from('familia_amigos').delete().eq('id', id); if (result.error) { setError(`No se pudo quitar el vínculo: ${result.error.message}`); return }; onRefresh() }
  if (!family) return <div className="empty-state"><Empty text="Selecciona un núcleo para ver su árbol genealógico." /></div>
  const ninosEnFamilia = familyMembers.filter((member) => { const edad = calcularEdad(peopleById.get(member.persona_id)?.fecha_nacimiento); return edad !== null && edad < 12 }).length
    + familyAmigoLinks.filter((link) => { const edad = calcularEdad(link.amigos?.fecha_nacimiento); return edad !== null && edad < 12 }).length
  return <section className="card p-5">{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mb-4">{error}</p>}<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><p className="eyebrow">Estructura del núcleo</p><h2 className="font-medium mt-1">Árbol genealógico · {family.nombre_familia}</h2><p className="text-sm text-secondary mt-1">La misma persona puede pertenecer a varios núcleos; las relaciones muestran la jerarquía familiar. Composición: {familyMembers.length} creyente{familyMembers.length === 1 ? '' : 's'}, {familyAmigoLinks.length} amigo{familyAmigoLinks.length === 1 ? '' : 's'} en ruta, {ninosEnFamilia} niño{ninosEnFamilia === 1 ? '' : 's'} (menor{ninosEnFamilia === 1 ? '' : 'es'} de 12 años).</p></div><span className="chart-highlight">{familyMembers.length + familyAmigoLinks.length} integrantes</span></div><div className="grid md:grid-cols-2 gap-3 mt-5">{groups.map(([key, label]) => { const group = familyMembers.filter((member) => member.parentesco === key); return group.length ? <div key={key} className="surface-panel p-3"><p className="text-xs uppercase tracking-[0.12em] text-accent">{label}</p>{group.map((member) => { const person = peopleById.get(member.persona_id); return <button type="button" key={member.id} onClick={() => person && onOpenPerson(person)} className="block text-sm text-left mt-2 hover:text-accent">{person ? `${person.nombres} ${person.apellidos}` : 'Persona'}<span className="block text-xs text-muted">{person?.fecha_nacimiento ? `Edad registrada · ${person.fecha_nacimiento}` : 'Sin fecha de nacimiento'}</span></button> })}</div> : null })}</div>{familyAmigoLinks.length > 0 && <div className="mt-5 border-t border-border pt-4"><p className="text-xs uppercase tracking-[0.12em] text-accent">Amigos en ruta vinculados a este núcleo</p><div className="grid md:grid-cols-2 gap-2 mt-2">{familyAmigoLinks.map((link) => <div key={link.id} className="flex items-center justify-between gap-2 surface-panel p-3"><div><p className="text-sm">{link.amigos?.nombres || 'Amigo'}</p><p className="text-xs text-muted">{link.parentesco}</p></div>{canEdit && <button type="button" onClick={() => removeAmigoMember(link.id)} className="text-xs text-danger">Quitar</button>}</div>)}</div></div>}{relations.length > 0 && <div className="mt-5 border-t border-border pt-4"><p className="text-xs uppercase tracking-[0.12em] text-accent">Relaciones registradas</p><div className="grid md:grid-cols-2 gap-2 mt-2">{relations.filter((relation) => familyMembers.some((member) => member.persona_id === relation.persona_id || member.persona_id === relation.relacionada_id)).map((relation) => <p key={relation.id} className="text-sm text-secondary">{peopleById.get(relation.persona_id)?.nombres || 'Persona'} <span className="text-muted">{relation.tipo}</span> {peopleById.get(relation.relacionada_id)?.nombres || 'Persona'}</p>)}</div></div>}{canEdit && <div className="grid md:grid-cols-2 gap-4 mt-5 border-t border-border pt-4"><form onSubmit={addMember} className="flex flex-col gap-2"><p className="text-sm font-medium">Agregar al núcleo</p><select required className="input-field" value={memberForm.persona_id} onChange={(event) => setMemberForm({ ...memberForm, persona_id: event.target.value })}><option value="">Seleccionar persona</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><select className="input-field" value={memberForm.parentesco} onChange={(event) => setMemberForm({ ...memberForm, parentesco: event.target.value })}>{groups.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="btn-secondary">Agregar vínculo</button></form><form onSubmit={addRelation} className="flex flex-col gap-2"><p className="text-sm font-medium">Registrar relación</p><select required className="input-field" value={relationForm.persona_id} onChange={(event) => setRelationForm({ ...relationForm, persona_id: event.target.value })}><option value="">Persona de origen</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><select required className="input-field" value={relationForm.relacionada_id} onChange={(event) => setRelationForm({ ...relationForm, relacionada_id: event.target.value })}><option value="">Persona relacionada</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><select className="input-field" value={relationForm.tipo} onChange={(event) => setRelationForm({ ...relationForm, tipo: event.target.value })}>{[['padre', 'Padre de'], ['madre', 'Madre de'], ['hijo', 'Hijo/a de'], ['conyuge', 'Cónyuge de'], ['hermano', 'Hermano/a de']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="btn-secondary">Registrar relación</button></form><form onSubmit={addAmigoMember} className="flex flex-col gap-2"><p className="text-sm font-medium flex items-center gap-1">Vincular amigo en ruta<InfoTip texto="Para familias mixtas: simpatizantes en ruta evangelística que conviven con la familia pero aún no son creyentes del censo." /></p><select required className="input-field" value={amigoMemberForm.amigo_id} onChange={(event) => setAmigoMemberForm({ ...amigoMemberForm, amigo_id: event.target.value })}><option value="">Seleccionar amigo</option>{(amigos ?? []).map((amigo) => <option key={amigo.id} value={amigo.id}>{amigo.nombres}</option>)}</select><select className="input-field" value={amigoMemberForm.parentesco} onChange={(event) => setAmigoMemberForm({ ...amigoMemberForm, parentesco: event.target.value })}>{[['conyuge', 'Cónyuge'], ['hijo', 'Hijo'], ['hija', 'Hija'], ['nieto', 'Nieto'], ['nieta', 'Nieta'], ['otro', 'Otro']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="btn-secondary">Vincular</button></form></div>}</section>
}

function PastoralAgendaFilter({ value, onChange, search, setSearch }) {
  return <section className="card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><h2 className="font-medium">Agenda pastoral</h2><p className="text-xs text-secondary mt-1">Consulta el estado de tus seguimientos programados.</p></div><div className="flex flex-col sm:flex-row gap-2"><div className="flex items-center gap-2 input-field"><Search className="w-4 h-4 text-muted" /><input aria-label="Buscar seguimientos" className="bg-transparent outline-none text-sm w-full" placeholder="Buscar persona o acción..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Filtrar seguimientos por estado" className="input-field text-xs sm:max-w-[220px]" value={value} onChange={(event) => onChange(event.target.value)}><option value="pendiente">Pendientes</option><option value="completado">Completados</option><option value="cancelado">Cancelados</option><option value="todos">Todos los estados</option></select></div></section>
}

function PastoralSection({ alerts, followups, people, saving, onAttend, onConfirmContact, onUpdateFollowup, onOpenPerson, canEdit, agendaStatus, agendaSearch }) {
  const [alertType, setAlertType] = useState('todos')
  const [alertPriority, setAlertPriority] = useState('todos')
  const [showHistory, setShowHistory] = useState(false)
  const [expandedAlertGroups, setExpandedAlertGroups] = useState(() => new Set())
  const today = hoyBogota()
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
  return <div className="flex flex-col gap-4"><section className="card p-5"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h2 className="font-medium">Agenda de acompañamiento{agenda.length > 0 ? ` (${agenda.length})` : ''}</h2><p className="text-sm text-secondary mt-1">Seguimientos programados, vencidos y próximos.</p></div><div className="flex gap-2"><select aria-label="Filtrar alertas por tipo" className="input-field text-xs" value={alertType} onChange={(event) => setAlertType(event.target.value)}><option value="todos">Todos los tipos</option><option value="familia">Familia</option><option value="bautismo">Bautismo</option><option value="asistencia_persona">Asistencia</option><option value="comite">Comité</option><option value="asistencia">Tendencia</option></select><select aria-label="Filtrar alertas por prioridad" className="input-field text-xs" value={alertPriority} onChange={(event) => setAlertPriority(event.target.value)}><option value="todos">Todas las prioridades</option><option value="alta">Alta</option><option value="media">Media</option></select></div></div>{agenda.length ? <div className="flex flex-col gap-2.5 mt-4 max-h-[30rem] overflow-y-auto pr-1">{agenda.map((item) => { const person = people.find((candidate) => candidate.id === item.persona_id); const overdue = item.proxima_fecha && item.proxima_fecha < today; const dueToday = item.proxima_fecha === today; const statusTone = overdue ? 'danger' : dueToday ? 'warning' : 'accent'; const statusLabel = overdue ? 'Vencido' : dueToday ? 'Hoy' : 'Próximo'; const initials = `${person?.nombres?.[0] || '?'}${person?.apellidos?.[0] || ''}`.toUpperCase(); return <div key={item.id} className={`agenda-item ${overdue ? 'agenda-item-overdue' : ''}`}><div className="flex items-start gap-3 min-w-0"><span className="agenda-avatar" aria-hidden="true">{initials}</span><div className="min-w-0"><p className="text-sm font-medium truncate">{person ? `${person.nombres} ${person.apellidos}` : 'Persona'}</p><p className="text-xs text-secondary mt-1">{item.accion}</p>{item.notas && <p className="text-xs text-muted mt-1">{item.notas}</p>}{item.proxima_fecha && <span className={`agenda-status agenda-status-${statusTone} mt-2`}><Clock className="w-3 h-3" />{statusLabel} · {item.proxima_fecha}</span>}</div></div><div className="flex sm:flex-col gap-1.5 flex-shrink-0"><button type="button" onClick={() => onOpenPerson(item.persona_id)} className="agenda-action agenda-action-neutral"><ExternalLink className="w-3.5 h-3.5" />Ver ficha</button><button type="button" disabled={saving} onClick={() => onUpdateFollowup(item, 'completado')} className="agenda-action agenda-action-success"><CheckCircle2 className="w-3.5 h-3.5" />Completar</button><button type="button" disabled={saving} onClick={() => onUpdateFollowup(item, 'cancelado')} className="agenda-action agenda-action-danger"><XCircle className="w-3.5 h-3.5" />Cancelar</button></div></div> })}</div> : <Empty text="No hay seguimientos programados." />}<button type="button" onClick={() => setShowHistory((value) => !value)} className="text-xs text-accent mt-3">{showHistory ? 'Ocultar historial' : `Ver historial (${completed.length})`}</button>{showHistory && <div className="flex flex-col gap-2.5 mt-3 max-h-[24rem] overflow-y-auto pr-1">{completed.map((item) => { const person = people.find((candidate) => candidate.id === item.persona_id); const initials = `${person?.nombres?.[0] || '?'}${person?.apellidos?.[0] || ''}`.toUpperCase(); return <div key={item.id} className="agenda-item agenda-item-muted"><div className="flex items-start gap-3 min-w-0"><span className="agenda-avatar agenda-avatar-muted" aria-hidden="true">{initials}</span><div className="min-w-0"><p className="text-sm truncate">{person ? `${person.nombres} ${person.apellidos}` : 'Persona'} · {item.accion}</p><p className="text-xs text-muted mt-0.5">{item.fecha} · {item.estado}</p></div></div><div className="flex gap-1.5 flex-shrink-0"><button type="button" onClick={() => onOpenPerson(item.persona_id)} className="agenda-action agenda-action-neutral"><ExternalLink className="w-3.5 h-3.5" />Ver ficha</button><button type="button" disabled={saving} onClick={() => onUpdateFollowup(item, 'pendiente')} className="agenda-action agenda-action-neutral">Reabrir</button></div></div>})}</div>}</section><section className="card p-5"><h2 className="font-medium">Alertas pendientes{filteredAlerts.length > 0 ? ` (${filteredAlerts.length})` : ''}</h2>{alertGroups.length ? <div className="flex flex-col gap-4 mt-4 max-h-[30rem] overflow-y-auto pr-1">{alertGroups.map((group) => { const expanded = expandedAlertGroups.has(group.tipo); const visible = expanded ? group.items : group.items.slice(0, 3); const hidden = group.items.length - visible.length; return <div key={group.tipo}><p className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2">{ALERT_TYPE_LABELS[group.tipo] || group.tipo} ({group.items.length})</p><div className="flex flex-col gap-2.5">{visible.map((alert) => <div key={alert.clave} className={`alert-item ${alert.prioridad === 'alta' ? 'alert-item-high' : ''}`}><div className="flex items-start justify-between gap-3"><div><span className={`alert-priority ${alert.prioridad === 'alta' ? 'alert-priority-high' : ''}`}>{alert.prioridad}</span><p className="text-sm font-medium mt-2">{alert.titulo}</p><p className="text-xs text-secondary mt-1">{alert.detalle}</p></div><div className="flex sm:flex-col gap-1.5 flex-shrink-0 sm:items-end">{alert.tipo === 'asistencia_persona' && <button type="button" disabled={saving} onClick={() => onConfirmContact(alert)} className="agenda-action agenda-action-success"><CheckCircle2 className="w-3.5 h-3.5" />Confirmar contacto hoy</button>}<button type="button" disabled={saving} onClick={() => onAttend(alert)} className={`agenda-action ${alert.tipo === 'asistencia_persona' ? 'agenda-action-neutral' : 'agenda-action-success'}`}><CheckCircle2 className="w-3.5 h-3.5" />Atender</button>{alert.tipo === 'asistencia_persona' && <InfoTip texto={'"Confirmar contacto hoy" actualiza la fecha de última asistencia con un clic, sin abrir formulario -- úsalo cuando ya hablaste con la persona. "Atender" abre el formulario completo para registrar la acción realizada y programar el próximo seguimiento.'} />}</div></div></div>)}</div>{hidden > 0 && <button type="button" onClick={() => setExpandedAlertGroups((current) => new Set(current).add(group.tipo))} className="text-xs text-accent mt-2">Ver {hidden} más de este tipo</button>}</div> })}</div> : <Empty text="No hay alertas con estos filtros." />}</section></div>
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
  return <div className="fixed inset-0 z-[60] bg-ink/30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title"><form onSubmit={submit} className="w-full max-w-md bg-surface-2 rounded-card shadow-xl p-6"><h2 id="admin-dialog-title" className="font-medium">{dialog.title}</h2>{dialog.message && <p className="text-sm text-secondary mt-2">{dialog.message}</p>}{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mt-3">{error}</p>}{dialog.fields && <div className="flex flex-col gap-3 mt-4">{dialog.fields.map((field) => <label key={field.name} className="text-sm">{field.label}{field.type === 'select' ? <select required={field.required} className="input-field mt-1.5" value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea required={field.required} className="input-field mt-1.5 min-h-20 w-full" value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} /> : <input required={field.required} type={field.type || 'text'} className="input-field mt-1.5" value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />}</label>)}</div>}<div className="flex justify-end gap-2 mt-6"><button type="button" onClick={close} className="btn-secondary">Cancelar</button><button disabled={saving} className="btn-primary">{saving ? 'Guardando...' : dialog.confirmLabel || 'Guardar'}</button></div></form></div>
}

function PastoralFollowupPanel({ person, followups, saving, onSubmit, embedded = false }) {
  const personFollowups = followups.filter((item) => item.persona_id === person?.id)
  return <section className={`${embedded ? '' : 'fixed z-50 right-4 bottom-4 w-[min(24rem,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto bg-surface-2 border border-border rounded-card shadow-xl'} p-4`}><div className="flex items-start justify-between gap-3 mb-3"><div><h2 className="font-medium">Seguimiento pastoral</h2><p className="text-xs text-secondary mt-1">{person.nombres} {person.apellidos}</p></div><span className="text-xs text-muted">{personFollowups.length} registros</span></div><form onSubmit={onSubmit} className="flex flex-col gap-2 border-b border-border pb-4"><select name="tipo_alerta" className="input-field text-sm" defaultValue=""><option value="">Tipo de situación...</option><option value="familia">Familia</option><option value="bautismo">Bautismo</option><option value="asistencia_persona">Asistencia</option><option value="general">General</option></select><input required name="accion" className="input-field text-sm" placeholder="Acción realizada" /><div className="grid grid-cols-2 gap-2"><label className="text-xs text-secondary">Fecha realizada<input required name="fecha" type="date" className="input-field text-sm mt-1" defaultValue={hoyBogota()} /></label><label className="text-xs text-secondary">Próximo contacto<input name="proxima_fecha" type="date" className="input-field text-sm mt-1" /></label></div><textarea name="notas" className="input-field text-sm min-h-16" placeholder="Notas del acompañamiento" /><button disabled={saving} className="btn-primary justify-center">{saving ? 'Guardando...' : 'Registrar seguimiento'}</button></form><div className="flex flex-col divide-y divide-border">{personFollowups.length ? personFollowups.map((item) => <div key={item.id} className="py-3"><div className="flex justify-between gap-2"><p className="text-sm font-medium">{item.accion}</p><span className={`text-xs ${item.estado === 'completado' ? 'text-success' : item.estado === 'cancelado' ? 'text-muted' : 'text-accent'}`}>{item.estado || 'pendiente'}</span></div><p className="text-xs text-muted mt-1">{item.fecha}{item.proxima_fecha ? ` · Próximo: ${item.proxima_fecha}` : ''}{item.tipo_alerta ? ` · ${ALERT_TYPE_LABELS[item.tipo_alerta] || item.tipo_alerta}` : ''}</p>{item.notas && <p className="text-xs text-secondary mt-1">{item.notas}</p>}</div>) : <p className="text-xs text-muted py-4">Aún no hay seguimientos registrados.</p>}</div></section>
}
function CargoPanel({ person, cargos, saving, onSubmit, onEdit, embedded = false, nuevoBautizado }) {
  const personCargos = cargos.filter((item) => item.persona_id === person?.id)
  return <section className={`${embedded ? '' : 'fixed z-50 right-4 bottom-[calc(75vh+1rem)] w-[min(24rem,calc(100vw-2rem))] max-h-[30vh] overflow-y-auto bg-surface-2 border border-border rounded-card shadow-xl'} p-4`}><h2 className="font-medium">Historial de cargos</h2>{nuevoBautizado && <p className="text-xs text-warning bg-warning-bg rounded p-2 mt-2 flex items-center gap-1.5"><Droplet className="w-3.5 h-3.5 flex-shrink-0" />Lleva {nuevoBautizado.dias} día{nuevoBautizado.dias === 1 ? '' : 's'} en Discipulado -- aún en formación, evalúa si ya está lista para un cargo.</p>}<form onSubmit={onSubmit} className="grid grid-cols-2 gap-2 mt-3"><input required name="nombre_cargo" className="input-field text-sm col-span-2" placeholder="Nombre del cargo" /><input name="area" className="input-field text-sm" placeholder="Área" /><label className="text-xs text-secondary">Desde<input required name="fecha_inicio" type="date" aria-label="Fecha desde" className="input-field text-sm mt-1" defaultValue={hoyBogota()} /></label><label className="text-xs text-secondary">Hasta (opcional)<input name="fecha_fin" type="date" aria-label="Fecha hasta opcional" className="input-field text-sm mt-1" /></label><input name="observaciones" className="input-field text-sm col-span-2" placeholder="Observaciones" /><button disabled={saving} className="btn-primary text-sm col-span-2 justify-center">{saving ? 'Guardando...' : 'Registrar cargo'}</button></form><div className="divide-y divide-border mt-3">{personCargos.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 py-2"><div><p className="text-xs font-medium">{item.nombre_cargo}{item.area ? ` · ${item.area}` : ''}</p><p className="text-xs text-muted">{item.fecha_inicio}{item.fecha_fin ? ` hasta ${item.fecha_fin}` : ' · Actual'}</p></div><button type="button" onClick={() => onEdit(item)} className="text-xs text-accent">Editar</button></div>)}</div></section>
}

function MembershipMovementsPanel({ person, movimientosMembresia, saving, onSubmit, trasladoBusqueda, trasladoResultados, trasladoDestinoId, setTrasladoDestinoId, trasladoObservaciones, setTrasladoObservaciones, savingTraslado, onBuscarDestino, onIniciarTraslado, embedded = false }) {
  const personMovements = (movimientosMembresia ?? []).filter((item) => item.persona_id === person?.id)
  const destinoSeleccionado = trasladoResultados?.find((item) => item.id === trasladoDestinoId)
  return <section className={`${embedded ? '' : 'fixed z-50 right-4 bottom-4 w-[min(24rem,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto bg-surface-2 border border-border rounded-card shadow-xl'} p-4`}>
    <h2 className="font-medium">Trasladar a otra congregación</h2>
    <p className="text-xs text-secondary mt-1">Busca la congregación destino en cualquier parte del país. Al ser recibida allí, {person?.nombres} conserva todo su historial (bautismo, sellado, familia, cargos).</p>
    <div className="flex flex-col gap-2 mt-3 border-b border-border pb-4">
      <input className="input-field text-sm" placeholder="Buscar congregación por nombre o ciudad..." value={trasladoBusqueda} onChange={(event) => { onBuscarDestino(event.target.value); setTrasladoDestinoId('') }} />
      {trasladoResultados?.length > 0 && !destinoSeleccionado && <div className="flex flex-col divide-y divide-border border border-border rounded max-h-40 overflow-y-auto">{trasladoResultados.map((item) => <button type="button" key={item.id} onClick={() => setTrasladoDestinoId(item.id)} className="text-left text-xs px-2.5 py-2 hover:bg-surface-1"><span className="font-medium">{item.nombre}</span>{item.ciudad ? ` · ${item.ciudad}` : ''}{item.distrito_numero ? ` · Distrito ${item.distrito_numero}` : ''}</button>)}</div>}
      {destinoSeleccionado && <p className="text-xs text-accent">Destino: {destinoSeleccionado.nombre}{destinoSeleccionado.ciudad ? ` · ${destinoSeleccionado.ciudad}` : ''} <button type="button" className="text-muted underline ml-1" onClick={() => setTrasladoDestinoId('')}>cambiar</button></p>}
      <input className="input-field text-sm" placeholder="Observaciones (opcional)" value={trasladoObservaciones} onChange={(event) => setTrasladoObservaciones(event.target.value)} />
      <button type="button" disabled={savingTraslado || !trasladoDestinoId} onClick={onIniciarTraslado} className="btn-primary text-sm justify-center">{savingTraslado ? 'Iniciando...' : 'Iniciar traslado'}</button>
    </div>
    <h2 className="font-medium mt-4">Movimientos de membresía</h2><p className="text-xs text-secondary mt-1">Altas y bajas oficiales para la auditoría de estadísticas.</p><form onSubmit={onSubmit} className="flex flex-col gap-2 mt-3 border-b border-border pb-4"><select required name="tipo" className="input-field text-sm" defaultValue=""><option value="" disabled>Tipo de movimiento...</option>{Object.entries(MOVIMIENTO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="text-xs text-secondary">Fecha<input required name="fecha" type="date" className="input-field text-sm mt-1" defaultValue={hoyBogota()} /></label><input name="observaciones" className="input-field text-sm" placeholder="Observaciones" /><button disabled={saving} className="btn-primary text-sm justify-center">{saving ? 'Guardando...' : 'Registrar movimiento'}</button></form><div className="divide-y divide-border">{personMovements.length ? personMovements.map((item) => <div key={item.id} className="py-3"><p className="text-sm font-medium">{MOVIMIENTO_LABELS[item.tipo] || item.tipo}</p><p className="text-xs text-muted mt-1">{item.fecha}{item.congregaciones_relacionada?.nombre ? ` · ${item.congregaciones_relacionada.nombre}` : ''}</p>{item.observaciones && <p className="text-xs text-secondary mt-1">{item.observaciones}</p>}</div>) : <p className="text-xs text-muted py-4">Aún no hay movimientos registrados.</p>}</div></section>
}
function Metric({ label, value, accent, info }) {
  return (
    <div className={`summary-card summary-card-${accent ? 'default' : 'muted'} stat-tile`}>
      <div className="flex items-center justify-between gap-3"><p className="text-[10px] uppercase tracking-[0.16em] text-secondary flex items-center gap-1.5">{label}{info && <InfoTip texto={info} />}</p><span className={`summary-marker ${accent ? 'bg-accent' : 'bg-muted'}`} aria-hidden="true" /></div>
      <p className="text-3xl font-semibold tracking-tight mt-3">{value}</p>
    </div>
  )
}


// Indicador con trazabilidad "cuántos había vs cuánto crecimos" -- usado
// por Bautizados y Sellados, los dos indicadores que sí son un estado
// acumulado (a diferencia de Reconciliados, que es un evento puntual).
function IndicadorTrimestral({ titulo, anterior, nuevos, actual, info }) {
  return (
    <div className="summary-card summary-card-default stat-tile">
      <p className="text-[10px] uppercase tracking-[0.16em] text-secondary flex items-center gap-1.5">{titulo}{info && <InfoTip texto={info} />}</p>
      <p className="text-3xl font-semibold tracking-tight mt-3">{actual}</p>
      <p className="text-xs text-secondary mt-2">{anterior} antes <span className="text-muted">→</span> +{nuevos} este trimestre</p>
    </div>
  )
}

// El informe que hoy se arma a mano y se envía por WhatsApp/correo cada
// trimestre al distrito -- aquí se calcula solo, a partir de los datos que
// SIGAP ya captura. El rol distrital ve el mismo consolidado automáticamente
// (PastoralDistrital.jsx), y de ahí sube a nacional -- no hay que "enviar"
// nada manualmente.
function InformeTrimestralLocal({ congregacionId }) {
  const cerrado = trimestreCerradoMasReciente()
  const [anio, setAnio] = useState(cerrado.anio)
  const [trimestre, setTrimestre] = useState(cerrado.trimestre)
  const [resumen, setResumen] = useState(null)
  const [loadingInforme, setLoadingInforme] = useState(true)

  useEffect(() => {
    if (!congregacionId) return
    setLoadingInforme(true)
    supabase
      .rpc('resumen_informe_trimestral_congregacion', { p_congregacion_id: congregacionId, ...limitesInformeTrimestral(anio, trimestre) })
      .then(({ data, error }) => { setLoadingInforme(false); setResumen(error ? null : data?.[0] ?? null) })
  }, [congregacionId, anio, trimestre])

  const anioActual = new Date().getFullYear()
  const anios = [anioActual, anioActual - 1, anioActual - 2]

  async function descargarInforme() {
    if (!resumen) return
    const etiqueta = `${ETIQUETA_TRIMESTRE[trimestre]} ${anio}`
    await descargarPdf({
      filename: `informe-trimestral-${anio}-t${trimestre}.pdf`,
      titulo: `Informe trimestral · ${etiqueta}`,
      meta: [
        `Trimestre: ${etiqueta}`,
        `Entregados hoy por estación: Uno Más ${resumen.ruta_uno_mas} · BIS ${resumen.ruta_bis} · REFAM ${resumen.ruta_refam} · ESFOB ${resumen.ruta_esfob}`,
      ],
      resumen: {
        kpis: [
          { label: 'Bautizados', value: resumen.bautizados_total_actual },
          { label: 'Sellados con el Espíritu Santo', value: resumen.sellados_total_actual },
          { label: 'Reconciliados este trimestre', value: resumen.reconciliados_actual },
          { label: 'Entregados actuales', value: resumen.entregados_total_actual },
        ],
      },
      headers: ['Indicador', 'Antes de este trimestre', 'Nuevos este trimestre', 'Total actual'],
      rows: [
        ['Bautizados', resumen.bautizados_total_anterior, resumen.bautizados_nuevos, resumen.bautizados_total_actual],
        ['Sellados con el Espíritu Santo', resumen.sellados_total_anterior, resumen.sellados_nuevos, resumen.sellados_total_actual],
        ['Reconciliados', resumen.reconciliados_anterior, resumen.reconciliados_actual, '—'],
        ['Entregados', resumen.entregados_total_anterior, resumen.entregados_nuevos, resumen.entregados_total_actual],
        ['Entregados que se bautizaron (graduados)', '—', resumen.entregados_graduados, '—'],
      ],
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-secondary">Estadísticas para reportar al distrito -- se calculan solas, no hay que volver a digitarlas.</p>
        <label className="text-sm ml-auto">Año<select className="input-field mt-1.5" value={anio} onChange={(event) => setAnio(Number(event.target.value))}>{anios.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm">Trimestre<select className="input-field mt-1.5" value={trimestre} onChange={(event) => setTrimestre(Number(event.target.value))}>{Object.entries(ETIQUETA_TRIMESTRE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" onClick={descargarInforme} disabled={!resumen} className="btn-secondary"><Download className="w-4 h-4" /> Descargar PDF</button>
      </div>
      {loadingInforme ? (
        <SkeletonList rows={4} />
      ) : resumen ? (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <IndicadorTrimestral titulo="Bautizados" anterior={resumen.bautizados_total_anterior} nuevos={resumen.bautizados_nuevos} actual={resumen.bautizados_total_actual} info="Total de feligreses bautizados al cierre de este trimestre. 'Antes' es el total al cierre del trimestre anterior." />
            <IndicadorTrimestral titulo="Sellados con el Espíritu Santo" anterior={resumen.sellados_total_anterior} nuevos={resumen.sellados_nuevos} actual={resumen.sellados_total_actual} />
            <div className="summary-card summary-card-default stat-tile">
              <p className="text-[10px] uppercase tracking-[0.16em] text-secondary flex items-center gap-1.5">Reconciliados<InfoTip texto="Apartados que volvieron a estado Activo. No es un total acumulado -- se compara este trimestre contra el anterior." /></p>
              <p className="text-3xl font-semibold tracking-tight mt-3">{resumen.reconciliados_actual}</p>
              <p className="text-xs text-secondary mt-2">{resumen.reconciliados_anterior} el trimestre anterior</p>
            </div>
          </div>
          <div className="card p-5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-secondary flex items-center gap-1.5">Entregados<InfoTip texto="Personas en la Ruta Evangelística que aún no se bautizan. 'Nuevos' llegaron este trimestre; 'Graduados' ya se bautizaron (también cuentan en Bautizados)." /></p>
            <div className="grid sm:grid-cols-4 gap-4 mt-3 text-sm">
              <div><p className="text-2xl font-semibold">{resumen.entregados_total_actual}</p><p className="text-xs text-secondary mt-1">Total actual ({resumen.entregados_total_anterior} antes)</p></div>
              <div><p className="text-2xl font-semibold text-success">+{resumen.entregados_nuevos}</p><p className="text-xs text-secondary mt-1">Nuevos este trimestre</p></div>
              <div><p className="text-2xl font-semibold text-accent">{resumen.entregados_graduados}</p><p className="text-xs text-secondary mt-1">Se bautizaron este trimestre</p></div>
            </div>
            <div className="border-t border-border mt-4 pt-4">
              <p className="text-xs text-secondary flex items-center gap-1.5">Hoy mismo, por estación<InfoTip texto="Foto operativa del día de hoy (no del trimestre) -- para saber dónde está cada quien ahora mismo." /></p>
              <div className="grid grid-cols-4 gap-3 mt-2 text-center">
                <div><p className="text-lg font-semibold">{resumen.ruta_uno_mas}</p><p className="text-[10px] text-muted uppercase tracking-wide">Uno Más</p></div>
                <div><p className="text-lg font-semibold">{resumen.ruta_bis}</p><p className="text-[10px] text-muted uppercase tracking-wide">BIS</p></div>
                <div><p className="text-lg font-semibold">{resumen.ruta_refam}</p><p className="text-[10px] text-muted uppercase tracking-wide">REFAM</p></div>
                <div><p className="text-lg font-semibold">{resumen.ruta_esfob}</p><p className="text-[10px] text-muted uppercase tracking-wide">ESFOB</p></div>
              </div>
            </div>
          </div>
        </>
      ) : <Empty text="No se pudo cargar el informe de este trimestre." />}
    </section>
  )
}

function PersonForm({ form, setForm, families, saving, editing, error, close, onSubmit }) { return <div className="fixed inset-0 z-40 bg-ink/30 flex items-center justify-center p-4"><form onSubmit={onSubmit} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-2 rounded-card shadow-xl p-6"><div className="flex justify-between mb-5"><h2 className="font-medium">{editing ? 'Editar ficha de persona' : 'Registrar persona'}</h2><button type="button" aria-label="Cerrar" onClick={close} className="text-sm text-secondary hover:text-ink">Cerrar</button></div>{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mb-4">{error}</p>}<div className="grid sm:grid-cols-2 gap-3"><Field label="Nombres" required value={form.nombres} onChange={(value) => setForm({ ...form, nombres: value })} /><Field label="Apellidos" required value={form.apellidos} onChange={(value) => setForm({ ...form, apellidos: value })} /><Field label="Teléfono" value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value })} /><label className="text-sm">Estado<select className="input-field mt-1.5" value={form.estado_membresia} onChange={(event) => setForm({ ...form, estado_membresia: event.target.value })}>{Object.entries(STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><Field label="Fecha de ingreso" type="date" value={form.fecha_ingreso} onChange={(value) => setForm({ ...form, fecha_ingreso: value })} /><Field label="Última asistencia" type="date" value={form.fecha_ultima_asistencia} onChange={(value) => setForm({ ...form, fecha_ultima_asistencia: value })} /><label className="text-sm">Familia<select className="input-field mt-1.5" value={form.familia_id} onChange={(event) => setForm({ ...form, familia_id: event.target.value })}><option value="">Sin familia</option>{families.map((family) => <option key={family.id} value={family.id}>{family.nombre_familia}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.bautizado} onChange={(event) => setForm({ ...form, bautizado: event.target.checked })} /> Bautizado</label><Field label="Fecha de bautismo" type="date" value={form.fecha_bautismo} onChange={(value) => setForm({ ...form, fecha_bautismo: value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.sellado_espiritu_santo} onChange={(event) => setForm({ ...form, sellado_espiritu_santo: event.target.checked })} /> Sellado con el Espíritu Santo</label><Field label="Fecha de sellado" type="date" value={form.fecha_sellado} onChange={(value) => setForm({ ...form, fecha_sellado: value })} /></div><button disabled={saving} className="btn-primary w-full justify-center mt-5">{saving ? 'Guardando...' : 'Guardar ficha'}</button></form></div> }
function Field({ label, type = 'text', required, value, onChange }) { return <label className="text-sm">{label}<input required={required} type={type} className="input-field mt-1.5" value={value || ''} onChange={(event) => onChange(event.target.value)} /></label> }
