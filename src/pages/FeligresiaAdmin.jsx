import { useDeferredValue, useEffect, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, Award, BarChart3, CheckCircle2, ChevronRight, ClipboardList, Clock, Download, Droplet, ExternalLink, Flame, Flower2, Heart, HeartHandshake, LogIn, Plus, Search, UsersRound, XCircle } from 'lucide-react'
import { Bar, Doughnut } from 'react-chartjs-2'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
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

const STATE_BADGE_CLASS = {
  activo: 'bg-success-bg text-success',
  apartado: 'bg-warning-bg text-warning',
  trasladado: 'bg-accent-bg text-accent',
  inactivo: 'bg-surface-1 text-secondary',
  fallecido: 'bg-surface-1 text-secondary',
}
// Agrupa integrantes activos por el cargo normalizado del catálogo de la congregación
// (cargos_comite); lo que no coincide con ningún cargo del catálogo cae en un grupo
// residual para no perder membresías creadas antes de configurar el catálogo.
function committeeMemberGroups(committee, cargoCatalog, t) {
  const active = (committee.membresias_comite ?? []).filter((member) => !member.fecha_fin)
  const groups = cargoCatalog.map((cargo) => ({
    key: cargo.id,
    label: cargo.nombre,
    members: active.filter((member) => member.cargo_id === cargo.id || (!member.cargo_id && member.cargo === cargo.nombre)),
  }))
  const claimed = new Set(groups.flatMap((group) => group.members.map((member) => member.id)))
  const other = active.filter((member) => !claimed.has(member.id))
  if (other.length) groups.push({ key: 'otros', label: other.some((member) => member.cargo) ? t('feligresiaAdmin.comites.otro') : t('feligresiaAdmin.comites.sinCargo'), members: other })
  return groups.filter((group) => group.members.length)
}
const EMPTY_PERSON ={ nombres: '', apellidos: '', telefono: '', fecha_nacimiento: '', estado_membresia: 'activo', estado_civil: 'soltero', genero: '', bautizado: false, fecha_bautismo: '', sellado_espiritu_santo: false, fecha_sellado: '', fecha_ingreso: '', fecha_ultima_asistencia: '', familia_id: '', parentesco_familiar: '', observaciones_pastorales: '', conyuge_id: '', fecha_matrimonio: '', fecha_fallecimiento: '', notas_fallecimiento: '', tipo_documento: '', numero_documento: '', nivel_educativo: '', ocupacion: '', telefono_tipo: '', tiene_whatsapp: false, telefono_alterno: '', red_social: '', pais_bautismo: '', municipio_bautismo: '', congregacion_bautismo_id: '', congregacion_bautismo_nombre: '', pastor_bautizo: '', tipo_sangre: '', eps_nombre: '', condiciones_medicas: '', alergias: '', medicamentos_actuales: '', discapacidad: '', embarazada: false, fecha_probable_parto: '', contacto_emergencia_nombre: '', contacto_emergencia_telefono: '', contacto_emergencia_parentesco: '', autorizacion_datos_salud: false, fecha_autorizacion_datos_salud: '', consentimiento_datos_firma: '', fecha_consentimiento_datos: '' }
// Traduce el registro crudo de auditoria_feligresia (nombre de tabla +
// accion SQL) a una frase que un pastor entienda de un vistazo -- antes
// se mostraba literal ("membresias_comite" / "DELETE"), sin sentido
// para alguien sin conocimiento tecnico.
function describirCambioAuditoria(item, t) {
  const AUDIT_LABELS = {
    comites: { INSERT: t('feligresiaAdmin.auditoria.comiteCreado'), UPDATE: t('feligresiaAdmin.auditoria.comiteEditado'), DELETE: t('feligresiaAdmin.auditoria.comiteEliminado') },
    membresias_comite: { INSERT: t('feligresiaAdmin.auditoria.integranteAgregado'), UPDATE: t('feligresiaAdmin.auditoria.responsabilidadActualizada'), DELETE: t('feligresiaAdmin.auditoria.integranteRemovido') },
  }
  return AUDIT_LABELS[item.entidad]?.[item.accion] || t('feligresiaAdmin.auditoria.formatoGenerico', { entidad: item.entidad, accion: item.accion })
}

function withRequestTimeout(request, milliseconds = 12000) {
  return Promise.race([
    request,
    new Promise((_, reject) => setTimeout(() => reject(new Error(i18n.t('feligresiaAdmin.errores.timeout'))), milliseconds)),
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
  const { t } = useTranslation()
  const [section, setSection] = useState('datos')
  return <>
    {section === 'datos' && <PersonFormEditor {...props} />}
    {props.editing && section !== 'datos' && <div className="fixed inset-0 z-40 bg-night/30 flex items-center justify-center p-4"><div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-2 rounded-card shadow-xl p-6"><div className="flex justify-between mb-5"><h2 className="font-medium">{t('feligresiaAdmin.personFormDetailed.fichaDe', { nombre: `${props.selected.nombres} ${props.selected.apellidos}` })}</h2><button type="button" aria-label={t('feligresiaAdmin.comun.cerrar')} onClick={props.close} className="text-sm text-secondary hover:text-ink">{t('feligresiaAdmin.comun.cerrar')}</button></div>{props.error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mb-4">{props.error}</p>}{section === 'seguimiento' && <PastoralFollowupPanel {...props} person={props.selected} followups={props.pastoralFollowups} onSubmit={props.onSavePastoralFollowup} embedded />}{section === 'cargos' && <CargoPanel {...props} person={props.selected} cargos={props.cargoHistory} onSubmit={props.onSaveCargo} onEdit={props.onEditCargo} embedded />}{section === 'movimientos' && <MembershipMovementsPanel {...props} person={props.selected} movimientosMembresia={props.movimientosMembresia} onSubmit={props.onSaveMovimiento} embedded />}</div></div>}
    {props.editing && <nav className="fixed z-[55] bottom-4 left-1/2 -translate-x-1/2 flex gap-1 bg-surface-2 border border-border rounded p-1 shadow-lg"><button type="button" onClick={() => setSection('datos')} className={`text-xs px-3 py-2 rounded ${section === 'datos' ? 'bg-accent-bg text-accent' : 'text-secondary'}`}>{t('feligresiaAdmin.personFormDetailed.tabDatos')}</button><button type="button" onClick={() => setSection('seguimiento')} className={`text-xs px-3 py-2 rounded ${section === 'seguimiento' ? 'bg-accent-bg text-accent' : 'text-secondary'}`}>{t('feligresiaAdmin.personFormDetailed.tabSeguimiento')}</button><button type="button" onClick={() => setSection('cargos')} className={`text-xs px-3 py-2 rounded ${section === 'cargos' ? 'bg-accent-bg text-accent' : 'text-secondary'}`}>{t('feligresiaAdmin.personFormDetailed.tabCargos')}</button><button type="button" onClick={() => setSection('movimientos')} className={`text-xs px-3 py-2 rounded ${section === 'movimientos' ? 'bg-accent-bg text-accent' : 'text-secondary'}`}>{t('feligresiaAdmin.personFormDetailed.tabMovimientos')}</button></nav>}
  </>
}

function SpiritualTimeline({ person, cargos }) {
  const { t } = useTranslation()
  const events = []
  if (person.fecha_ingreso) events.push({ date: person.fecha_ingreso, label: t('feligresiaAdmin.timeline.ingreso'), icon: LogIn, tone: 'accent' })
  if (person.bautizado && person.fecha_bautismo) events.push({ date: person.fecha_bautismo, label: t('feligresiaAdmin.timeline.bautizadoEvento'), icon: Droplet, tone: 'accent' })
  if (person.sellado_espiritu_santo && person.fecha_sellado) events.push({ date: person.fecha_sellado, label: t('feligresiaAdmin.timeline.selladoEvento'), icon: Flame, tone: 'success' })
  if (person.fecha_matrimonio) events.push({ date: person.fecha_matrimonio, label: t('feligresiaAdmin.timeline.matrimonio'), icon: Heart, tone: 'success' })
  if (person.fecha_fallecimiento) events.push({ date: person.fecha_fallecimiento, label: t('feligresiaAdmin.timeline.fallecio'), icon: Flower2, tone: 'muted' })
  cargos.forEach((cargo) => { if (cargo.fecha_inicio) events.push({ date: cargo.fecha_inicio, endDate: cargo.fecha_fin, label: t('feligresiaAdmin.timeline.asumioCargo', { cargo: cargo.nombre_cargo }), icon: Award, tone: cargo.fecha_fin ? 'muted' : 'accent' }) })
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return <p className="text-xs text-muted mt-2">{t('feligresiaAdmin.timeline.sinHitos')}</p>
  return <div className="flex flex-col mt-2">{sorted.map((event, index) => <div key={index} className="flex gap-3"><div className="flex flex-col items-center"><span className={`timeline-dot timeline-dot-${event.tone}`}><event.icon className="w-3.5 h-3.5" /></span>{index < sorted.length - 1 && <span className="timeline-line" />}</div><div className="pb-4 -mt-0.5"><p className="text-sm font-medium">{event.label}</p><p className="text-xs text-muted mt-0.5">{event.date}{event.endDate ? ` → ${event.endDate}` : ''}</p></div></div>)}</div>
}

function PersonFormEditor({ form, setForm, families, committees, cargoHistory, selected, saving, canEdit, editing, error, close, onSubmit, onReconciliar, onVincularConyuge, onDesvincularConyuge, onMarcarFallecido, onDescargarCertificadoDefuncion, analyticsPeople, bautismoBusqueda, bautismoResultados, onBuscarBautismo, nuevoBautizado, rangosEdad, disciplinasPastorales, onRegistrarDisciplina, onAgregarSeguimientoDisciplina, onRestaurarDisciplina }) {
  const { t } = useTranslation()
  const STATES = t('feligresiaAdmin.estados', { returnObjects: true })
  const MARITAL_STATUSES = t('feligresiaAdmin.estadoCivil', { returnObjects: true })
  const GENERO_LABELS = t('feligresiaAdmin.genero', { returnObjects: true })
  const TIPO_DOCUMENTO_LABELS = t('feligresiaAdmin.tipoDocumento', { returnObjects: true })
  const NIVEL_EDUCATIVO_LABELS = t('feligresiaAdmin.nivelEducativo', { returnObjects: true })
  const FAMILY_RELATIONSHIPS = t('feligresiaAdmin.parentescoFamiliar', { returnObjects: true })
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
  return <div className="fixed inset-0 z-40 bg-night/30 flex items-center justify-center p-4"><form onSubmit={onSubmit} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-2 rounded-card shadow-xl p-6"><div className="flex justify-between mb-5"><h2 className="font-medium">{editing ? t('feligresiaAdmin.personFormEditor.editarFicha') : t('feligresiaAdmin.personFormEditor.registrarPersona')}</h2><button type="button" aria-label={t('feligresiaAdmin.comun.cerrar')} onClick={close} className="text-sm text-secondary hover:text-ink">{t('feligresiaAdmin.comun.cerrar')}</button></div>{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mb-4">{error}</p>}{nuevoBautizado && <p className="text-sm text-warning bg-warning-bg rounded p-3 mb-4 flex items-center gap-2"><Droplet className="w-4 h-4 flex-shrink-0" />{t('feligresiaAdmin.personFormEditor.nuevoBautizadoAviso', { count: nuevoBautizado.dias, dias: nuevoBautizado.dias, umbral: UMBRAL_DIAS_NUEVO_BAUTIZADO })}</p>}<div className="grid sm:grid-cols-2 gap-3"><Field label={t('feligresiaAdmin.personFormEditor.nombres')} required value={form.nombres} onChange={(value) => setForm({ ...form, nombres: value })} /><Field label={t('feligresiaAdmin.personFormEditor.apellidos')} required value={form.apellidos} onChange={(value) => setForm({ ...form, apellidos: value })} /><Field label={t('feligresiaAdmin.personFormEditor.telefono')} value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value })} /><Field label={t('feligresiaAdmin.personFormEditor.fechaNacimiento')} type="date" value={form.fecha_nacimiento} onChange={(value) => setForm({ ...form, fecha_nacimiento: value })} /><label className="text-sm flex items-center gap-1">{t('feligresiaAdmin.personFormEditor.estado')}<InfoTip texto={t('feligresiaAdmin.personFormEditor.estadoTip')} /><select className="input-field mt-1.5 w-full" value={form.estado_membresia} disabled={selected?.estado_membresia === 'fallecido'} onChange={(event) => setForm({ ...form, estado_membresia: event.target.value })}>{estadosSeleccionables.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{editing && selected?.estado_membresia === 'apartado' && <button type="button" onClick={() => onReconciliar(selected)} className="text-xs text-accent mt-1.5">{t('feligresiaAdmin.personFormEditor.reconciliar')}</button>}{editing && selected?.estado_membresia !== 'fallecido' && <button type="button" onClick={() => onMarcarFallecido(selected)} className="text-xs text-danger mt-1.5">{t('feligresiaAdmin.personFormEditor.registrarFallecimiento')}</button>}{editing && selected?.estado_membresia === 'fallecido' && <p className="text-xs text-muted mt-1.5">{t('feligresiaAdmin.personFormEditor.fallecioEl', { fecha: formatFecha(selected.fecha_fallecimiento) })}{selected.notas_fallecimiento ? ` · ${selected.notas_fallecimiento}` : ''}</p>}</label><label className="text-sm">{t('feligresiaAdmin.personFormEditor.estadoCivilLabel')}<select className="input-field mt-1.5" value={form.estado_civil} onChange={(event) => setForm({ ...form, estado_civil: event.target.value })}>{Object.entries(MARITAL_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm sm:col-span-2">{t('feligresiaAdmin.personFormEditor.conyuge')}<InfoTip texto={t('feligresiaAdmin.personFormEditor.conyugeTip')} />{conyuge ? <div className="flex items-center gap-2 mt-1.5 flex-wrap"><span className="text-sm">{conyuge.nombres} {conyuge.apellidos}{form.fecha_matrimonio ? t('feligresiaAdmin.personFormEditor.casadosDesdeSufijo', { fecha: formatFecha(form.fecha_matrimonio) }) : ''}</span>{editing && <button type="button" onClick={() => onVincularConyuge(selected)} className="text-xs text-accent">{t('feligresiaAdmin.comun.cambiar')}</button>}{editing && <button type="button" onClick={() => onDesvincularConyuge(selected)} className="text-xs text-danger">{t('feligresiaAdmin.personFormEditor.desvincular')}</button>}</div> : editing ? <button type="button" onClick={() => onVincularConyuge(selected)} className="btn-secondary text-xs mt-1.5">{t('feligresiaAdmin.personFormEditor.vincularConyuge')}</button> : <p className="text-xs text-muted mt-1.5">{t('feligresiaAdmin.personFormEditor.guardaFichaPrimero')}</p>}</label><label className="text-sm">{t('feligresiaAdmin.personFormEditor.generoLabel')}<select className="input-field mt-1.5" value={form.genero || ''} onChange={(event) => setForm({ ...form, genero: event.target.value })}><option value="">{t('feligresiaAdmin.comun.sinRegistrar')}</option>{Object.entries(GENERO_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><Field label={t('feligresiaAdmin.personFormEditor.fechaIngreso')} type="date" value={form.fecha_ingreso} onChange={(value) => setForm({ ...form, fecha_ingreso: value })} /><Field label={t('feligresiaAdmin.personFormEditor.ultimaAsistencia')} type="date" value={form.fecha_ultima_asistencia} onChange={(value) => setForm({ ...form, fecha_ultima_asistencia: value })} /><label className="text-sm">{t('feligresiaAdmin.personFormEditor.familia')}<select className="input-field mt-1.5" value={form.familia_id} onChange={(event) => setForm({ ...form, familia_id: event.target.value, parentesco_familiar: event.target.value ? form.parentesco_familiar : '' })}><option value="">{t('feligresiaAdmin.personFormEditor.sinFamilia')}</option>{families.map((family) => <option key={family.id} value={family.id}>{family.nombre_familia}</option>)}</select></label><label className="text-sm flex items-center gap-1">{t('feligresiaAdmin.personFormEditor.parentescoFamiliarLabel')}<InfoTip texto={t('feligresiaAdmin.personFormEditor.parentescoTip')} /><select className="input-field mt-1.5 w-full" value={form.parentesco_familiar || ''} onChange={(event) => setForm({ ...form, parentesco_familiar: event.target.value })} disabled={!form.familia_id}><option value="">{t('feligresiaAdmin.comun.seleccionar')}</option>{Object.entries(FAMILY_RELATIONSHIPS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.bautizado} onChange={(event) => setForm({ ...form, bautizado: event.target.checked })} /> {t('feligresiaAdmin.personFormEditor.bautizadoLabel')}<InfoTip texto={t('feligresiaAdmin.personFormEditor.bautizadoTip')} /></label><Field label={t('feligresiaAdmin.personFormEditor.fechaBautismo')} type="date" value={form.fecha_bautismo} onChange={(value) => setForm({ ...form, fecha_bautismo: value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.sellado_espiritu_santo} onChange={(event) => setForm({ ...form, sellado_espiritu_santo: event.target.checked })} /> {t('feligresiaAdmin.personFormEditor.selladoLabel')}<InfoTip texto={t('feligresiaAdmin.personFormEditor.selladoTip')} /></label><Field label={t('feligresiaAdmin.personFormEditor.fechaSellado')} type="date" value={form.fecha_sellado} onChange={(value) => setForm({ ...form, fecha_sellado: value })} /><label className="text-sm sm:col-span-2">{t('feligresiaAdmin.personFormEditor.observacionesPastorales')}<textarea className="input-field mt-1.5 min-h-24" value={form.observaciones_pastorales || ''} onChange={(event) => setForm({ ...form, observaciones_pastorales: event.target.value })} /></label></div>
    <details className="mt-4 border-t border-border pt-4">
      <summary className="text-sm font-medium cursor-pointer select-none">{t('feligresiaAdmin.personFormEditor.datosAdicionales')}</summary>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <label className="text-sm">{t('feligresiaAdmin.personFormEditor.tipoDocumentoLabel')}<select className="input-field mt-1.5 w-full" value={form.tipo_documento || ''} onChange={(event) => setForm({ ...form, tipo_documento: event.target.value })}><option value="">{t('feligresiaAdmin.comun.sinRegistrar')}</option>{Object.entries(TIPO_DOCUMENTO_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <Field label={t('feligresiaAdmin.personFormEditor.numeroDocumento')} value={form.numero_documento} onChange={(value) => setForm({ ...form, numero_documento: value })} />
        <label className="text-sm">{t('feligresiaAdmin.personFormEditor.nivelEducativoLabel')}<select className="input-field mt-1.5 w-full" value={form.nivel_educativo || ''} onChange={(event) => setForm({ ...form, nivel_educativo: event.target.value })}><option value="">{t('feligresiaAdmin.comun.sinRegistrar')}</option>{Object.entries(NIVEL_EDUCATIVO_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-sm">{t('feligresiaAdmin.personFormEditor.ocupacion')}<InfoTip texto={t('feligresiaAdmin.personFormEditor.ocupacionTip')} /><input className="input-field mt-1.5 w-full" placeholder={t('feligresiaAdmin.personFormEditor.ocupacionPlaceholder')} value={form.ocupacion || ''} onChange={(event) => setForm({ ...form, ocupacion: event.target.value })} /></label>
        <label className="text-sm">{t('feligresiaAdmin.personFormEditor.tipoTelefono')}<select className="input-field mt-1.5 w-full" value={form.telefono_tipo || ''} onChange={(event) => setForm({ ...form, telefono_tipo: event.target.value })}><option value="">{t('feligresiaAdmin.comun.sinRegistrar')}</option>{Object.entries(TELEFONO_TIPO_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm mt-1.5 sm:mt-6"><input type="checkbox" checked={Boolean(form.tiene_whatsapp)} onChange={(event) => setForm({ ...form, tiene_whatsapp: event.target.checked })} /> {t('feligresiaAdmin.personFormEditor.tieneWhatsapp')}</label>
        <Field label={t('feligresiaAdmin.personFormEditor.telefonoAlterno')} value={form.telefono_alterno} onChange={(value) => setForm({ ...form, telefono_alterno: value })} />
        <label className="text-sm">{t('feligresiaAdmin.personFormEditor.redSocial')}<InfoTip texto={t('feligresiaAdmin.personFormEditor.redSocialTip')} /><input className="input-field mt-1.5 w-full" placeholder={t('feligresiaAdmin.personFormEditor.redSocialPlaceholder')} value={form.red_social || ''} onChange={(event) => setForm({ ...form, red_social: event.target.value })} /></label>
        {hijosEnFamilia.length > 0 && <p className="text-xs text-secondary sm:col-span-2">{t('feligresiaAdmin.personFormEditor.hijosRegistrados', { cantidad: hijosEnFamilia.length, lista: hijosEnFamilia.map((hijo) => `${hijo.nombres} ${hijo.apellidos}`).join(', ') })}</p>}
      </div>
      {form.bautizado && <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-border">
        <p className="text-sm font-medium sm:col-span-2">{t('feligresiaAdmin.personFormEditor.lugarOficianteBautismo')}</p>
        <Field label={t('feligresiaAdmin.personFormEditor.pais')} value={form.pais_bautismo} onChange={(value) => setForm({ ...form, pais_bautismo: value })} />
        <Field label={t('feligresiaAdmin.personFormEditor.municipioCiudad')} value={form.municipio_bautismo} onChange={(value) => setForm({ ...form, municipio_bautismo: value })} />
        <div className="sm:col-span-2">
          <label className="text-sm flex items-center gap-1">{t('feligresiaAdmin.personFormEditor.congregacionBautizo')}<InfoTip texto={t('feligresiaAdmin.personFormEditor.congregacionBautizoTip')} /></label>
          {congregacionBautismoNombre ? (
            <div className="flex items-center gap-2 mt-1.5"><span className="text-sm">{congregacionBautismoNombre}</span><button type="button" onClick={() => setForm({ ...form, congregacion_bautismo_id: '' })} className="text-xs text-accent">{t('feligresiaAdmin.comun.cambiar')}</button></div>
          ) : (
            <>
              <input className="input-field mt-1.5" placeholder={t('feligresiaAdmin.personFormEditor.buscarCongregacionPlaceholder')} value={bautismoBusqueda} onChange={(event) => onBuscarBautismo(event.target.value)} />
              {bautismoResultados.length > 0 && <div className="flex flex-col divide-y divide-border border border-border rounded max-h-32 overflow-y-auto mt-1.5">{bautismoResultados.map((item) => <button type="button" key={item.id} onClick={() => setForm({ ...form, congregacion_bautismo_id: item.id, congregacion_bautismo_nombre: '' })} className="text-left text-xs px-2.5 py-2 hover:bg-surface-1"><span className="font-medium">{item.nombre}</span>{item.ciudad ? ` · ${item.ciudad}` : ''}</button>)}</div>}
              <p className="text-xs text-muted mt-1.5">{t('feligresiaAdmin.personFormEditor.noApareceEnLista')}</p>
              <input className="input-field mt-1" placeholder={t('feligresiaAdmin.personFormEditor.nombreCongregacionPlaceholder')} value={form.congregacion_bautismo_nombre || ''} onChange={(event) => setForm({ ...form, congregacion_bautismo_nombre: event.target.value })} />
            </>
          )}
        </div>
        <label className="text-sm sm:col-span-2">{t('feligresiaAdmin.personFormEditor.pastorOficiante')}<input className="input-field mt-1.5 w-full" value={form.pastor_bautizo || ''} onChange={(event) => setForm({ ...form, pastor_bautizo: event.target.value })} /></label>
      </div>}
    </details>
    <details className="mt-4 border-t border-border pt-4">
      <summary className="text-sm font-medium cursor-pointer select-none">{t('feligresiaAdmin.personFormEditor.fichaSalud')}</summary>
      <p className="text-xs text-secondary mt-2">{t('feligresiaAdmin.personFormEditor.fichaSaludDesc')}</p>
      <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={Boolean(form.autorizacion_datos_salud)} onChange={(event) => setForm({ ...form, autorizacion_datos_salud: event.target.checked, fecha_autorizacion_datos_salud: event.target.checked ? (form.fecha_autorizacion_datos_salud || hoyBogota()) : '' })} /> {t('feligresiaAdmin.personFormEditor.autorizaSalud')}<InfoTip texto={t('feligresiaAdmin.personFormEditor.autorizaSaludTip')} /></label>
      {form.autorizacion_datos_salud ? <>
        {categoriasEmergencia.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{categoriasEmergencia.map((categoria) => <span key={categoria.key} className="text-[10px] uppercase tracking-wide bg-warning-bg text-warning rounded px-2 py-1">{categoria.label}</span>)}</div>}
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <label className="text-sm">{t('feligresiaAdmin.personFormEditor.tipoSangre')}<select className="input-field mt-1.5 w-full" value={form.tipo_sangre || ''} onChange={(event) => setForm({ ...form, tipo_sangre: event.target.value })}><option value="">{t('feligresiaAdmin.comun.sinRegistrar')}</option>{TIPO_SANGRE_OPCIONES.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select></label>
          <Field label={t('feligresiaAdmin.personFormEditor.eps')} value={form.eps_nombre} onChange={(value) => setForm({ ...form, eps_nombre: value })} />
          <label className="text-sm sm:col-span-2">{t('feligresiaAdmin.personFormEditor.condicionesMedicas')}<InfoTip texto={t('feligresiaAdmin.personFormEditor.condicionesMedicasTip')} /><textarea className="input-field mt-1.5 min-h-16 w-full" value={form.condiciones_medicas || ''} onChange={(event) => setForm({ ...form, condiciones_medicas: event.target.value })} /></label>
          <label className="text-sm sm:col-span-2">{t('feligresiaAdmin.personFormEditor.alergias')}<textarea className="input-field mt-1.5 min-h-16 w-full" value={form.alergias || ''} onChange={(event) => setForm({ ...form, alergias: event.target.value })} /></label>
          <label className="text-sm sm:col-span-2">{t('feligresiaAdmin.personFormEditor.medicamentosActuales')}<InfoTip texto={t('feligresiaAdmin.personFormEditor.medicamentosTip')} /><textarea className="input-field mt-1.5 min-h-16 w-full" value={form.medicamentos_actuales || ''} onChange={(event) => setForm({ ...form, medicamentos_actuales: event.target.value })} /></label>
          <label className="text-sm sm:col-span-2">{t('feligresiaAdmin.personFormEditor.discapacidad')}<input className="input-field mt-1.5 w-full" placeholder={t('feligresiaAdmin.personFormEditor.discapacidadPlaceholder')} value={form.discapacidad || ''} onChange={(event) => setForm({ ...form, discapacidad: event.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.embarazada)} onChange={(event) => setForm({ ...form, embarazada: event.target.checked })} /> {t('feligresiaAdmin.personFormEditor.embarazada')}</label>
          {form.embarazada && <Field label={t('feligresiaAdmin.personFormEditor.fechaProbableParto')} type="date" value={form.fecha_probable_parto} onChange={(value) => setForm({ ...form, fecha_probable_parto: value })} />}
          <p className="text-sm font-medium sm:col-span-2 mt-1">{t('feligresiaAdmin.personFormEditor.contactoEmergencia')}</p>
          <Field label={t('feligresiaAdmin.personFormEditor.nombre')} value={form.contacto_emergencia_nombre} onChange={(value) => setForm({ ...form, contacto_emergencia_nombre: value })} />
          <Field label={t('feligresiaAdmin.personFormEditor.telefono')} value={form.contacto_emergencia_telefono} onChange={(value) => setForm({ ...form, contacto_emergencia_telefono: value })} />
          <Field label={t('feligresiaAdmin.personFormEditor.parentesco')} value={form.contacto_emergencia_parentesco} onChange={(value) => setForm({ ...form, contacto_emergencia_parentesco: value })} />
        </div>
      </> : <p className="text-xs text-muted mt-2">{t('feligresiaAdmin.personFormEditor.marcaAutorizacion')}</p>}
    </details>
    <details className="mt-4 border-t border-border pt-4">
      <summary className="text-sm font-medium cursor-pointer select-none">{t('feligresiaAdmin.personFormEditor.consentimientoDatos')}{form.consentimiento_datos_firma ? t('feligresiaAdmin.personFormEditor.firmadoSufijo') : ''}</summary>
      <p className="text-xs text-secondary mt-2">{t('feligresiaAdmin.personFormEditor.consentimientoDesc')}</p>
      {form.consentimiento_datos_firma ? <div className="mt-3">
        <p className="text-xs text-secondary">{t('feligresiaAdmin.personFormEditor.firmadoEl', { fecha: formatFecha(form.fecha_consentimiento_datos) })}</p>
        <img src={form.consentimiento_datos_firma} alt={t('feligresiaAdmin.personFormEditor.firmaAlt')} className="border border-border rounded bg-white mt-2 h-20" />
        <div className="mt-2"><button type="button" onClick={() => setForm({ ...form, consentimiento_datos_firma: '', fecha_consentimiento_datos: '' })} className="text-xs text-danger">{t('feligresiaAdmin.personFormEditor.revocarConsentimiento')}</button></div>
      </div> : mostrarFirma ? <div className="mt-3"><SignaturePad onGuardar={(firma) => { setForm({ ...form, consentimiento_datos_firma: firma, fecha_consentimiento_datos: hoyBogota() }); setMostrarFirma(false) }} onCancelar={() => setMostrarFirma(false)} /></div> : <button type="button" onClick={() => setMostrarFirma(true)} className="btn-secondary text-xs mt-3">{t('feligresiaAdmin.personFormEditor.capturarFirma')}</button>}
    </details>
    {editing && <details className="mt-4 border-t border-border pt-4" open={Boolean(disciplinaActiva)}>
      <summary className="text-sm font-medium cursor-pointer select-none">{t('feligresiaAdmin.personFormEditor.disciplinaSuspension')}{disciplinaActiva ? t('feligresiaAdmin.personFormEditor.activaSufijo') : ''}</summary>
      {disciplinaActiva ? <div className="mt-3">
        <p className="text-sm text-danger bg-danger-bg rounded p-3">{t('feligresiaAdmin.personFormEditor.disciplinaActivaDesde', { fecha: formatFecha(disciplinaActiva.fecha_inicio) })}{disciplinaActiva.fecha_fin_prevista ? t('feligresiaAdmin.personFormEditor.previstaHasta', { fecha: formatFecha(disciplinaActiva.fecha_fin_prevista) }) : ''}: {disciplinaActiva.motivo}<InfoTip texto={t('feligresiaAdmin.personFormEditor.disciplinaActivaTip')} /></p>
        <div className="flex gap-2 mt-2 flex-wrap"><button type="button" onClick={() => onAgregarSeguimientoDisciplina(disciplinaActiva)} className="btn-secondary text-xs">{t('feligresiaAdmin.personFormEditor.agregarSeguimiento')}</button><button type="button" onClick={() => onRestaurarDisciplina(disciplinaActiva)} className="btn-secondary text-xs">{t('feligresiaAdmin.personFormEditor.registrarRestauracion')}</button></div>
        {(disciplinaActiva.disciplinas_seguimiento ?? []).length > 0 && <div className="mt-3 flex flex-col gap-1.5">{[...disciplinaActiva.disciplinas_seguimiento].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((nota) => <p key={nota.id} className="text-xs text-secondary">{formatFecha(nota.fecha)} · {nota.nota}</p>)}</div>}
      </div> : <button type="button" onClick={() => onRegistrarDisciplina(selected)} className="btn-secondary text-xs mt-3">{t('feligresiaAdmin.personFormEditor.registrarDisciplina')}</button>}
      {disciplinasHistoricas.length > 0 && <div className="mt-3 pt-3 border-t border-border"><p className="text-xs font-medium text-secondary">{t('feligresiaAdmin.personFormEditor.historial')}</p>{disciplinasHistoricas.map((item) => <p key={item.id} className="text-xs text-muted mt-1">{formatFecha(item.fecha_inicio)} → {formatFecha(item.fecha_restauracion)} · {item.motivo}{item.notas_restauracion ? ` · ${item.notas_restauracion}` : ''}</p>)}</div>}
    </details>}
    {editing && <div className="mt-5 border-t border-border pt-4"><p className="text-sm font-medium">{t('feligresiaAdmin.personFormEditor.cicloVidaEspiritual')}</p><SpiritualTimeline person={selected} cargos={cargoEvents} /></div>}{editing && <div className="mt-2 border-t border-border pt-4"><p className="text-sm font-medium">{t('feligresiaAdmin.personFormEditor.participacionResponsabilidades')}</p>{memberships.length ? <p className="text-xs text-secondary mt-2">{memberships.join(' · ')}</p> : <p className="text-xs text-muted mt-2">{t('feligresiaAdmin.personFormEditor.sinParticipacionComites')}</p>}{cargos.length > 0 && <p className="text-xs text-secondary mt-2">{t('feligresiaAdmin.personFormEditor.cargosHistoricos', { lista: cargos.join(', ') })}</p>}</div>}{editing && comitesSugeridos.length > 0 && <p className="text-xs text-secondary mt-2 flex items-center gap-1">{t('feligresiaAdmin.personFormEditor.comitesSugeridos', { lista: comitesSugeridos.map((rango) => rango.comites?.nombre).filter(Boolean).join(', ') })}<InfoTip texto={t('feligresiaAdmin.personFormEditor.comitesSugeridosTip')} /></p>}{editing && selected?.estado_membresia === 'fallecido' && <button type="button" onClick={() => onDescargarCertificadoDefuncion(selected)} className="btn-secondary w-full justify-center mt-3">{t('feligresiaAdmin.personFormEditor.descargarCertificadoDefuncion')}</button>}<button disabled={saving} className="btn-primary w-full justify-center mt-5">{saving ? t('feligresiaAdmin.comun.guardando') : t('feligresiaAdmin.personFormEditor.guardarFicha')}</button></form></div>
}


function CommitteeAnalytics({ people, committees, cargos, audit, disciplinas }) {
  const { t } = useTranslation()
  const { formato_fecha } = usePreferencias()
  const today = hoyBogota()
  const actorPorAuthId = new Map(people.filter((person) => person.auth_user_id).map((person) => [person.auth_user_id, `${person.nombres} ${person.apellidos}`]))
  function describirActor(usuarioId) {
    if (!usuarioId) return t('feligresiaAdmin.cambioAutomatico')
    return actorPorAuthId.get(usuarioId) || t('feligresiaAdmin.otroUsuario')
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
    return { headers: [t('feligresiaAdmin.committeeAnalytics.colComite'), t('feligresiaAdmin.committeeAnalytics.colCodigo'), t('feligresiaAdmin.committeeAnalytics.colEstado'), t('feligresiaAdmin.committeeAnalytics.colVigencia'), t('feligresiaAdmin.committeeAnalytics.colIntegrantes'), t('feligresiaAdmin.committeeAnalytics.colCargosObligatorios'), t('feligresiaAdmin.committeeAnalytics.colCargosCubiertos')], rows: active.map((committee) => { const current = memberships.filter((member) => member.committee.id === committee.id); const requiredCargos = cargos.filter((cargo) => cargo.obligatorio); return [committee.nombre, committee.codigo, t('feligresiaAdmin.estados.activo'), committee.fecha_fin || t('feligresiaAdmin.committeeAnalytics.sinFechaFinal'), current.length, requiredCargos.length, requiredCargos.filter((cargo) => current.some((member) => member.cargo_id === cargo.id)).length] }) }
  }
  function committeeExportCsv() {
    descargarCsv({ filename: `comites-analisis-${today}.csv`, titulo: t('feligresiaAdmin.committeeAnalytics.titulo'), meta: [t('feligresiaAdmin.export.nivelLocal')], ...committeeExportHeaders() })
  }
  function committeeExportResumen() {
    return {
      kpis: [
        { label: t('feligresiaAdmin.committeeAnalytics.metricComitesActivos'), value: active.length },
        { label: t('feligresiaAdmin.committeeAnalytics.metricIntegrantesVigentes'), value: memberships.length },
        { label: t('feligresiaAdmin.committeeAnalytics.kpiCargosObligatoriosCubiertos'), value: `${covered}/${required}` },
        { label: t('feligresiaAdmin.committeeAnalytics.kpiSinIntegrantes'), value: withoutMembers },
        { label: t('feligresiaAdmin.committeeAnalytics.kpiSinResponsable'), value: withoutResponsible },
      ],
      desgloses: [
        { titulo: t('feligresiaAdmin.committeeAnalytics.desgloseIntegrantesPorComite'), items: active.map((committee) => ({ label: committee.nombre, valor: memberships.filter((member) => member.committee.id === committee.id).length })) },
      ],
    }
  }
  function committeeExportExcel() {
    descargarExcel({ filename: `comites-analisis-${today}.xlsx`, hoja: t('feligresiaAdmin.committeeAnalytics.hojaComites'), titulo: t('feligresiaAdmin.committeeAnalytics.titulo'), meta: [t('feligresiaAdmin.export.nivelLocal')], resumen: committeeExportResumen(), ...committeeExportHeaders() })
  }
  function committeeExportPdf() {
    descargarPdf({ filename: `comites-analisis-${today}.pdf`, titulo: t('feligresiaAdmin.committeeAnalytics.titulo'), meta: [t('feligresiaAdmin.export.nivelLocal')], resumen: committeeExportResumen(), ...committeeExportHeaders() })
  }
  const insights = []
  if (withoutMembers) insights.push(t('feligresiaAdmin.committeeAnalytics.insightSinIntegrantes', { count: withoutMembers }))
  if (withoutResponsible) insights.push(t('feligresiaAdmin.committeeAnalytics.insightSinResponsable', { count: withoutResponsible }))
  if (expiring) insights.push(t('feligresiaAdmin.committeeAnalytics.insightVencePronto', { count: expiring }))
  if (overloaded.length) insights.push(t('feligresiaAdmin.committeeAnalytics.insightConcentracion', { count: overloaded.length }))
  if (disciplinasActivas.length) insights.push(t('feligresiaAdmin.committeeAnalytics.insightDisciplinaActiva', { count: disciplinasActivas.length }))
  if (!insights.length) insights.push(t('feligresiaAdmin.committeeAnalytics.insightSinPrioridades'))
  return <section className="card p-5"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h3 className="font-medium">{t('feligresiaAdmin.committeeAnalytics.titulo')}</h3><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.committeeAnalytics.subtitulo')}</p></div><ExportButtons onCsv={committeeExportCsv} onExcel={committeeExportExcel} onPdf={committeeExportPdf} /></div><div className="grid grid-cols-2 lg:grid-cols-7 gap-3 mt-5"><Metric label={t('feligresiaAdmin.committeeAnalytics.metricComitesActivos')} value={active.length} accent /><Metric label={t('feligresiaAdmin.committeeAnalytics.metricIntegrantesVigentes')} value={memberships.length} /><Metric label={t('feligresiaAdmin.committeeAnalytics.metricCargosObligatorios')} value={required} /><Metric label={t('feligresiaAdmin.committeeAnalytics.metricCargosCubiertos')} value={covered} /><Metric label={t('feligresiaAdmin.committeeAnalytics.metricVacantes')} value={Math.max(required - covered, 0)} /><Metric label={t('feligresiaAdmin.committeeAnalytics.metricPersonasDisponibles')} value={people.filter((person) => person.estado_membresia === 'activo' && !serving.has(person.id)).length} /><Metric label={t('feligresiaAdmin.committeeAnalytics.metricConDisciplina')} value={disciplinasActivas.length} /></div><div className="grid lg:grid-cols-2 gap-4 mt-5"><div><h4 className="text-sm font-medium">{t('feligresiaAdmin.committeeAnalytics.insightsTitulo')}</h4>{insights.map((item) => <p key={item} className="summary-insight mt-2">{item}</p>)}</div><div><h4 className="text-sm font-medium">{t('feligresiaAdmin.committeeAnalytics.concentracionTitulo')}</h4>{overloaded.length ? overloaded.slice(0, 8).map(([personId, count]) => { const person = people.find((item) => item.id === personId); return <p key={personId} className="text-xs text-secondary mt-2">{person ? `${person.nombres} ${person.apellidos}` : t('feligresiaAdmin.comun.persona')} · {t('feligresiaAdmin.committeeAnalytics.comitesCount', { count })}</p> }) : <p className="text-xs text-muted mt-2">{t('feligresiaAdmin.committeeAnalytics.sinConcentracion')}</p>}</div></div><div className="mt-5 border-t border-border pt-4"><div className="flex justify-between gap-3"><h4 className="text-sm font-medium">{t('feligresiaAdmin.committeeAnalytics.historialTitulo')}</h4><span className="text-xs text-muted">{audit.length > 12 ? t('feligresiaAdmin.committeeAnalytics.historialParcial', { total: audit.length }) : t('feligresiaAdmin.committeeAnalytics.historialCambios', { count: audit.length })}</span></div>{audit.length ? <div className="overflow-x-auto mt-2"><table className="w-full text-xs"><thead><tr className="text-left text-muted"><th className="font-normal pb-1.5 pr-3">{t('feligresiaAdmin.committeeAnalytics.colFecha')}</th><th className="font-normal pb-1.5 pr-3">{t('feligresiaAdmin.committeeAnalytics.colCambio')}</th><th className="font-normal pb-1.5">{t('feligresiaAdmin.committeeAnalytics.colRealizadoPor')}</th></tr></thead><tbody>{audit.slice(0, 12).map((item) => <tr key={item.id} className="border-b border-border"><td className="py-2 pr-3">{formatFecha(item.creado_en, { formato: formato_fecha, conHora: true })}</td><td className="py-2 pr-3">{describirCambioAuditoria(item, t)}</td><td className="py-2">{describirActor(item.usuario_id)}</td></tr>)}</tbody></table></div> : <p className="text-xs text-muted mt-2">{t('feligresiaAdmin.committeeAnalytics.sinCambios')}</p>}</div></section>
}

function HealthAnalytics({ people }) {
  const { t } = useTranslation()
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
  const categoriasData = distributionDataset(Object.entries(categoriasContadas).map(([label, value]) => ({ label, value })), { valueKey: 'value', datasetLabel: t('feligresiaAdmin.comun.personas') })
  const chartOptions = buildChartOptions()
  const coberturaPct = activePeople.length ? Math.round(withConsent.length / activePeople.length * 100) : 0
  const insight = withConsent.length === 0
    ? t('feligresiaAdmin.healthAnalytics.sinFichas')
    : t('feligresiaAdmin.healthAnalytics.insightCobertura', { conFicha: withConsent.length, activas: activePeople.length, pct: coberturaPct })
  return <section className="card p-5">
    <div><h3 className="font-medium">{t('feligresiaAdmin.healthAnalytics.titulo')}</h3><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.healthAnalytics.subtitulo')}</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
      <Metric label={t('feligresiaAdmin.healthAnalytics.metricConFicha')} value={withConsent.length} accent />
      <Metric label={t('feligresiaAdmin.healthAnalytics.metricCobertura')} value={`${coberturaPct}%`} />
      <Metric label={t('feligresiaAdmin.healthAnalytics.metricConEps')} value={withEps} />
      <Metric label={t('feligresiaAdmin.healthAnalytics.metricCategorias')} value={Object.keys(categoriasContadas).length} />
    </div>
    <p className={`text-sm rounded p-3 mt-4 ${withConsent.length === 0 ? 'text-secondary bg-surface-1' : 'text-accent bg-accent-bg'}`}>{insight}</p>
    <div className="mt-5">
      <h4 className="text-sm font-medium">{t('feligresiaAdmin.healthAnalytics.categoriasTitulo')}</h4>
      <p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.healthAnalytics.categoriasSubtitulo')}</p>
      {Object.keys(categoriasContadas).length ? <div className="h-56 mt-4"><Bar data={categoriasData} options={chartOptions} /></div> : <div className="h-40 mt-4"><ChartEmpty message={t('feligresiaAdmin.healthAnalytics.sinCategorias')} /></div>}
    </div>
  </section>
}

function FeligresiaInsights({ people, families, committees, cargoHistory, followups, alerts }) {
  const { t } = useTranslation()
  const STATES = t('feligresiaAdmin.estados', { returnObjects: true })
  const MARITAL_STATUSES = t('feligresiaAdmin.estadoCivil', { returnObjects: true })
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
  const followupStatuses = [[t('feligresiaAdmin.insights.pendientes'), followups.filter((item) => item.estado === 'pendiente').length], [t('feligresiaAdmin.insights.completados'), followups.filter((item) => item.estado === 'completado').length], [t('feligresiaAdmin.insights.cancelados'), followups.filter((item) => item.estado === 'cancelado').length]]
  const familySizes = families.map((family) => filteredPeople.filter((person) => person.familia_id === family.id).length).filter((size) => size > 0)
  const averageFamilySize = familySizes.length ? (familySizes.reduce((sum, size) => sum + size, 0) / familySizes.length).toFixed(1) : '0.0'
  const activeAlerts = alerts.filter((alert) => alert.estado !== 'atendida')
  const months = Number(historyMonths)
  const admissionsHistory = Array.from({ length: months }, (_, index) => {
    const start = new Date(today.getFullYear(), today.getMonth() - months + index + 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth() - months + index + 2, 1)
    const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'pt' ? 'pt-BR' : 'es-CO'
    return { label: start.toLocaleDateString(locale, { month: 'short', year: months > 12 ? '2-digit' : undefined }), total: filteredPeople.filter((person) => person.fecha_ingreso && person.fecha_ingreso >= fechaBogota(start) && person.fecha_ingreso < fechaBogota(end)).length }
  })
  const chartOptions = buildChartOptions()
  const widowed = activePeople.filter((person) => person.estado_civil === 'viudo').length
  const divorced = activePeople.filter((person) => person.estado_civil === 'divorciado').length
  const apartados = filteredPeople.filter((person) => person.estado_membresia === 'apartado').length
  const insight = overdue > 0 ? t('feligresiaAdmin.insights.overdue', { count: overdue })
    : apartados > 0 ? t('feligresiaAdmin.insights.apartados', { count: apartados })
    : withoutAttendance > 0 ? t('feligresiaAdmin.insights.sinAsistencia', { count: withoutAttendance })
    : widowed + divorced > 0 ? t('feligresiaAdmin.insights.viudoDivorciado', { count: widowed + divorced })
    : activeAlerts.length > 0 ? t('feligresiaAdmin.insights.alertasPendientes', { count: activeAlerts.length })
    : newPeople > 0 ? t('feligresiaAdmin.insights.nuevosIngresos', { count: newPeople })
    : t('feligresiaAdmin.insights.alDia')
  const doughnutData = { labels: [t('feligresiaAdmin.insights.bautizadosActivos'), t('feligresiaAdmin.insights.noBautizadosActivos')], datasets: [{ data: [baptized, Math.max(activeTotal - baptized, 0)], backgroundColor: ['#008300', '#d9e0e8'], borderWidth: 0 }] }
  const statusData = distributionDataset(statuses, { valueKey: 'value', datasetLabel: t('feligresiaAdmin.comun.personas') })
  const maritalData = distributionDataset(maritalStatuses, { valueKey: 'value', datasetLabel: t('feligresiaAdmin.insights.datasetPersonasActivas') })
  const ageData = distributionDataset(ageGroups.map(([label, value]) => ({ label, value })), { valueKey: 'value', datasetLabel: t('feligresiaAdmin.comun.personas') })
  const followupData = distributionDataset(followupStatuses.map(([label, value]) => ({ label, value })), { valueKey: 'value', datasetLabel: t('feligresiaAdmin.insights.datasetSeguimientos') })
  const admissionsData = { labels: admissionsHistory.map((item) => item.label), datasets: [{ label: t('feligresiaAdmin.insights.datasetNuevosIngresos'), data: admissionsHistory.map((item) => item.total), backgroundColor: gradientFill('#2a78d6'), borderRadius: 4, barThickness: months > 24 ? 10 : 18 }] }

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
    ? t('feligresiaAdmin.insights.insightRetencionSinDatos')
    : cohortesConRiesgo.length > 0
      ? t('feligresiaAdmin.insights.insightRetencionRiesgo', { cohortes: cohortesConRiesgo.map((c) => c.etiqueta).join(', ') })
      : t('feligresiaAdmin.insights.insightRetencionOk')
  const pyramidData = {
    labels: AGE_BRACKETS,
    datasets: [
      { label: t('feligresiaAdmin.genero.masculino'), data: AGE_BRACKETS.map((bracket) => -pyramidByBracket[bracket].masculino), backgroundColor: '#2a78d6', borderRadius: 4, barThickness: 18 },
      { label: t('feligresiaAdmin.genero.femenino'), data: AGE_BRACKETS.map((bracket) => pyramidByBracket[bracket].femenino), backgroundColor: '#9a6bce', borderRadius: 4, barThickness: 18 },
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
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-accent">{t('feligresiaAdmin.insights.badge')}</p><h2 className="font-medium mt-1">{t('feligresiaAdmin.insights.titulo')}</h2><p className="text-sm text-secondary mt-1">{t('feligresiaAdmin.insights.subtitulo')}</p></div><div className="flex flex-wrap gap-2"><select aria-label={t('feligresiaAdmin.insights.filtrarEstadoAria')} className="input-field text-xs" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="todos">{t('feligresiaAdmin.insights.todosEstados')}</option>{Object.entries(STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select aria-label={t('feligresiaAdmin.insights.filtrarEdadAria')} className="input-field text-xs" value={ageFilter} onChange={(event) => setAgeFilter(event.target.value)}><option value="todas">{t('feligresiaAdmin.insights.todasEdades')}</option>{ageGroups.map(([label]) => <option key={label} value={label}>{t('feligresiaAdmin.insights.edadAnios', { edad: label })}</option>)}</select></div></div>
    <div className="grid grid-cols-2 lg:grid-cols-8 gap-3"><Metric label={t('feligresiaAdmin.insights.metricPersonasCenso')} value={total} accent /><Metric label={t('feligresiaAdmin.insights.metricTasaActividad')} value={`${total ? Math.round(active / total * 100) : 0}%`} /><Metric label={t('feligresiaAdmin.insights.metricCoberturaFamiliar')} value={`${total ? Math.round(withFamily / total * 100) : 0}%`} /><Metric label={t('feligresiaAdmin.insights.metricConConsentimiento')} value={`${active ? Math.round(withConsent / active * 100) : 0}%`} info={t('feligresiaAdmin.insights.infoConsentimiento')} /><Metric label={t('feligresiaAdmin.insights.metricIngresos12Meses')} value={newPeople} /><Metric label={t('feligresiaAdmin.insights.metricViudos')} value={widowed} /><Metric label={t('feligresiaAdmin.insights.metricDivorciados')} value={divorced} /><Metric label={t('feligresiaAdmin.insights.metricAlertasActivas')} value={activeAlerts.length} /></div>
    <p className={`text-sm rounded p-3 ${overdue > 0 || withoutAttendance > 0 ? 'text-danger bg-danger-bg' : 'text-success bg-success-bg'}`}>{insight}</p>
    <div className="grid lg:grid-cols-4 gap-4"><div className="card p-5"><h3 className="font-medium">{t('feligresiaAdmin.insights.estadoCensoTitulo')}</h3><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.insights.estadoCensoSubtitulo')}</p><div className="h-56 mt-4"><Bar data={statusData} options={chartOptions} /></div></div><div className="card p-5"><h3 className="font-medium">{t('feligresiaAdmin.insights.bautismoTitulo')}</h3><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.insights.bautismoSubtitulo')}</p><div className="h-56 mt-4"><Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: '#52514e', padding: 14, font: { size: 11 } } } } }} /></div></div><div className="card p-5"><h3 className="font-medium">{t('feligresiaAdmin.insights.rangosEdadTitulo')}</h3><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.insights.rangosEdadSubtitulo')}</p><div className="h-56 mt-4"><Bar data={ageData} options={chartOptions} /></div></div><div className="card p-5"><h3 className="font-medium">{t('feligresiaAdmin.insights.situacionFamiliarTitulo')}</h3><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.insights.situacionFamiliarSubtitulo')}</p><div className="h-56 mt-4"><Bar data={maritalData} options={chartOptions} /></div></div></div>
    <div className="card p-5"><h3 className="font-medium">{t('feligresiaAdmin.insights.piramideTitulo')}</h3><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.insights.piramideSubtitulo')}{peopleWithGenero < activePeople.length && t('feligresiaAdmin.insights.piramideBasadaEn', { con: peopleWithGenero, total: activePeople.length })}</p>{peopleWithGenero ? <div className="h-72 mt-4"><Bar data={pyramidData} options={pyramidOptions} /></div> : <div className="h-72 mt-4"><ChartEmpty message={t('feligresiaAdmin.insights.sinGenero')} /></div>}</div>
    <div className="card p-5"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h3 className="font-medium">{t('feligresiaAdmin.insights.evolucionIngresosTitulo')}</h3><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.insights.evolucionIngresosSubtitulo')}</p></div><select aria-label={t('feligresiaAdmin.insights.periodoAria')} className="input-field text-xs" value={historyMonths} onChange={(event) => setHistoryMonths(event.target.value)}><option value="12">{t('feligresiaAdmin.insights.ultimos12Meses')}</option><option value="24">{t('feligresiaAdmin.insights.ultimos24Meses')}</option><option value="60">{t('feligresiaAdmin.insights.ultimos5Anios')}</option></select></div><div className="h-56 mt-4"><Bar data={admissionsData} options={chartOptions} /></div></div>
    <div className="card p-5">
      <h3 className="font-medium">{t('feligresiaAdmin.insights.retencionTitulo')}</h3>
      <p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.insights.retencionSubtitulo')}</p>
      {retencionCohortes.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">{t('feligresiaAdmin.insights.sinCohortes')}</p>
      ) : (
        <>
          <p className={`text-sm rounded p-3 mt-4 ${cohortesConRiesgo.length > 0 ? 'text-danger bg-danger-bg' : 'text-success bg-success-bg'}`}>{insightRetencion}</p>
          <div className="table-scroll mt-4">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="px-4 py-3">{t('feligresiaAdmin.insights.colCohorte')}</th>
                  <th className="px-4 py-3">{t('feligresiaAdmin.insights.colIngresaron')}</th>
                  <th className="px-4 py-3">{t('feligresiaAdmin.insights.colActivosHoy')}</th>
                  <th className="px-4 py-3">{t('feligresiaAdmin.insights.colRetencion')}</th>
                  <th className="px-4 py-3">{t('feligresiaAdmin.insights.colApartados')}</th>
                  <th className="px-4 py-3">{t('feligresiaAdmin.insights.colTrasladados')}</th>
                  <th className="px-4 py-3">{t('feligresiaAdmin.insights.colOtrasBajas')}</th>
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
    <div className="grid lg:grid-cols-2 gap-4"><div className="card p-5"><h3 className="font-medium">{t('feligresiaAdmin.insights.seguimientoPastoralTitulo')}</h3><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.insights.seguimientoPastoralSubtitulo')}</p><div className="h-52 mt-4"><Bar data={followupData} options={chartOptions} /></div><p className="summary-insight mt-3">{t('feligresiaAdmin.insights.resumenSeguimientos', { pending, overdue, total: followups.length })}</p></div><div className="card p-5"><h3 className="font-medium">{t('feligresiaAdmin.insights.capacidadTitulo')}</h3><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.insights.capacidadSubtitulo')}</p><div className="grid grid-cols-3 gap-3 mt-6"><div><p className="text-[10px] uppercase tracking-[0.12em] text-secondary">{t('feligresiaAdmin.insights.comitesActivosLabel')}</p><p className="text-2xl font-semibold mt-1">{committees.filter((committee) => committee.activo).length}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-secondary">{t('feligresiaAdmin.insights.personasEnComites')}</p><p className="text-2xl font-semibold mt-1">{committeePeople}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-secondary">{t('feligresiaAdmin.insights.cargosVigentes')}</p><p className="text-2xl font-semibold mt-1">{activeCharges}</p></div></div><p className="summary-insight mt-5">{t('feligresiaAdmin.insights.familiasResumen', { count: averageFamilySize === '1.0' ? 1 : 2, total: families.length, promedio: averageFamilySize })}</p>{cargoHistory.filter((item) => !item.fecha_fin).slice(0, 5).map((item) => { const person = people.find((candidate) => candidate.id === item.persona_id); return <p key={item.id} className="text-xs text-muted mt-2">{item.nombre_cargo} · {person ? `${person.nombres} ${person.apellidos}` : t('feligresiaAdmin.comun.persona')}</p> })}</div></div>
  </section>
}

export default function FeligresiaAdmin() {
  const { t, i18n } = useTranslation()
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
    if (peopleResult.error || analyticsPeopleResult.error || familyResult.error || familyMembersResult.error || familyRelationsResult.error || committeeResult.error || committeeCargoResult.error || committeeTypeResult.error || cargoResult.error || followupResult.error || summaryResult.error || alertsResult.error || committeeAuditResult.error || trasladosResult?.error || discipuladoActivosResult?.error) setError(t('feligresiaAdmin.errores.noSeCargoTodo'))
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
    if (['personas', 'familias', 'comites', 'seguimiento', 'traslados', 'historial', 'informe', 'salud'].includes(requestedTab)) setTab(requestedTab)
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
    if (!canEdit) { setError(t('feligresiaAdmin.errores.soloConsultaFeligresia')); return }
    const nombres = String(form.nombres ?? '').trim()
    const apellidos = String(form.apellidos ?? '').trim()
    const telefono = String(form.telefono ?? '').trim()
    const observaciones = String(form.observaciones_pastorales ?? '').trim()
    if (!nombres || !apellidos) {
      setError(t('feligresiaAdmin.errores.faltanNombresApellidos'))
      setNotice(null)
      return
    }
    if (form.bautizado && !form.fecha_bautismo) {
      setError(t('feligresiaAdmin.errores.faltaFechaBautismo'))
      setNotice(null)
      return
    }
    if (form.sellado_espiritu_santo && !form.fecha_sellado) {
      setError(t('feligresiaAdmin.errores.faltaFechaSellado'))
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
        ? t('feligresiaAdmin.errores.sinPermisoCongregacion')
        : result.error.code === 'PGRST204'
          ? t('feligresiaAdmin.errores.faltanDatosConfiguracion')
          : t('feligresiaAdmin.errores.noSeGuardoFicha', { mensaje: result.error.message })
      setError(message)
      return
    }
    setShowForm(false)
    setSelected(null)
    setForm(EMPTY_PERSON)
    setNotice(selected ? t('feligresiaAdmin.notices.fichaActualizada') : t('feligresiaAdmin.notices.personaRegistrada'))
    load()
  }

  async function saveFamily(event) {
    event.preventDefault()
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteFamilias')); return }
    if (!familyName.trim()) { setError(t('feligresiaAdmin.errores.faltaNombreFamilia')); return }
    setSaving(true); setError(null); setNotice(null)
    const result = await supabase.from('familias').insert({ congregacion_id: congregacionId, nombre_familia: familyName.trim(), direccion: familyAddress.trim() || null, telefono: familyPhone.trim() || null })
    setSaving(false)
    if (result.error) { setError(t('feligresiaAdmin.errores.noSeCreoFamilia', { mensaje: result.error.message })); return }
    setFamilyName(''); setFamilyAddress(''); setFamilyPhone(''); setNotice(t('feligresiaAdmin.notices.familiaCreada')); load()
  }

  async function saveCommittee(event) {
    event.preventDefault()
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteComites')); return }
    if (!committeeName.trim()) { setError(t('feligresiaAdmin.errores.faltaNombreComite')); return }
    if (committeeEnd && committeeStart && committeeEnd < committeeStart) { setError(t('feligresiaAdmin.errores.fechaFinalAnterior')); return }
    setSaving(true); setError(null); setNotice(null)
    const result = await supabase.from('comites').insert({ congregacion_id: congregacionId, nombre: committeeName.trim(), codigo: committeeCode.trim() || null, tipo_id: committeeType || null, descripcion: committeeDescription.trim() || null, proposito: committeePurpose.trim() || null, fecha_inicio: committeeStart || hoyBogota(), fecha_fin: committeeEnd || null, responsable_id: committeeResponsible || null, observaciones: committeeNotes.trim() || null })
    setSaving(false)
    if (result.error) { setError(t('feligresiaAdmin.errores.noSeCreoComite', { mensaje: result.error.message })); return }
    setCommitteeName(''); setCommitteeCode(''); setCommitteeType(''); setCommitteeDescription(''); setCommitteePurpose(''); setCommitteeStart(''); setCommitteeEnd(''); setCommitteeResponsible(''); setCommitteeNotes(''); setNotice(t('feligresiaAdmin.notices.comiteCreado')); load()
  }

  async function assignCommittee(event) {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null)
    if (!canEdit) { setSaving(false); setError(t('feligresiaAdmin.errores.noPermiteIntegrantes')); return }
    const formElement = event.currentTarget
    const data = new FormData(formElement)
    const cargoValue = data.get('cargo_id') || data.get('cargo')
    const selectedCargo = committeeCargoCatalog.find((cargo) => cargo.id === cargoValue)
    const selectedPerson = people.find((person) => person.id === data.get('persona_id'))
    if (!selectedPerson?.bautizado) { setSaving(false); setError(t('feligresiaAdmin.errores.requiereBautismo')); return }
    if (selectedCargo?.requiere_sellado && !selectedPerson?.sellado_espiritu_santo) { setSaving(false); setError(t('feligresiaAdmin.errores.requiereSellado')); return }
    const disciplinaActiva = disciplinasPastorales.find((item) => item.persona_id === selectedPerson?.id && !item.fecha_restauracion)
    if (disciplinaActiva) { setSaving(false); setError(t('feligresiaAdmin.errores.disciplinaActivaBloquea', { fecha: disciplinaActiva.fecha_inicio, motivo: disciplinaActiva.motivo })); return }
    const result = await supabase.from('membresias_comite').insert({ comite_id: data.get('comite_id'), persona_id: data.get('persona_id'), cargo_id: selectedCargo?.id || null, cargo: selectedCargo?.nombre || data.get('cargo') || null })
    setSaving(false)
    if (result.error) { setError(t('feligresiaAdmin.errores.noSeAsignoIntegrante', { mensaje: result.error.message })); return }
    formElement.reset(); setNotice(t('feligresiaAdmin.notices.integranteAsignado')); load()
  }

  async function renameFamily(family) {
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteFamilias')); return }
    setDialog({ title: t('feligresiaAdmin.dialogos.editarFamiliaTitulo'), fields: [{ name: 'nombre_familia', label: t('feligresiaAdmin.dialogos.campoNombre'), value: family.nombre_familia, required: true }, { name: 'direccion', label: t('feligresiaAdmin.dialogos.campoDireccion'), value: family.direccion || '' }, { name: 'telefono', label: t('feligresiaAdmin.dialogos.campoTelefono'), value: family.telefono || '' }], onSubmit: async (values) => {
      setSaving(true); setError(null)
      const result = await supabase.from('familias').update({ nombre_familia: values.nombre_familia.trim(), direccion: values.direccion.trim() || null, telefono: values.telefono.trim() || null }).eq('id', family.id).eq('congregacion_id', congregacionId)
      setSaving(false)
      if (result.error) { setError(t('feligresiaAdmin.errores.noSeActualizoFamilia', { mensaje: result.error.message })); return }
      setDialog(null); setNotice(t('feligresiaAdmin.notices.familiaActualizada')); load()
    } })
  }

  async function deactivateCommittee(committee) {
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteComites')); return }
    const nextActive = !committee.activo
    setDialog({ title: nextActive ? t('feligresiaAdmin.dialogos.reactivarComiteTitulo') : t('feligresiaAdmin.dialogos.desactivarComiteTitulo'), message: nextActive ? t('feligresiaAdmin.dialogos.seReactivara', { nombre: committee.nombre }) : t('feligresiaAdmin.dialogos.seDesactivara', { nombre: committee.nombre }), confirmLabel: nextActive ? t('feligresiaAdmin.comites.reactivar') : t('feligresiaAdmin.comites.desactivar'), onConfirm: async () => {
      setSaving(true); setError(null)
      const result = await supabase.from('comites').update({ activo: nextActive }).eq('id', committee.id).eq('congregacion_id', congregacionId)
      setSaving(false)
      if (result.error) { setError(t('feligresiaAdmin.errores.noSeActualizoComite', { mensaje: result.error.message })); return }
      setDialog(null); setNotice(nextActive ? t('feligresiaAdmin.notices.comiteReactivado') : t('feligresiaAdmin.notices.comiteDesactivado')); load()
    } })
  }

  async function renameCommittee(committee) {
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteComites')); return }
    setDialog({ title: t('feligresiaAdmin.dialogos.editarComiteTitulo'), fields: [{ name: 'nombre', label: t('feligresiaAdmin.dialogos.campoNombre'), value: committee.nombre, required: true, placeholder: t('feligresiaAdmin.dialogos.placeholderNombreComite') }, { name: 'codigo', label: t('feligresiaAdmin.dialogos.campoCodigoInterno'), value: committee.codigo || '', placeholder: t('feligresiaAdmin.dialogos.placeholderCodigoComite'), tip: t('feligresiaAdmin.dialogos.tipCodigoComite') }, { name: 'descripcion', label: t('feligresiaAdmin.dialogos.campoDescripcion'), value: committee.descripcion || '', type: 'textarea', placeholder: t('feligresiaAdmin.dialogos.placeholderDescripcionComite') }, { name: 'fecha_inicio', label: t('feligresiaAdmin.dialogos.campoFechaInicio'), value: committee.fecha_inicio || '', type: 'date', required: true }, { name: 'fecha_fin', label: t('feligresiaAdmin.dialogos.campoFechaFinalizacion'), value: committee.fecha_fin || '', type: 'date', tip: t('feligresiaAdmin.dialogos.tipFechaFinComite') }], onSubmit: async (values) => {
      if (values.fecha_fin && values.fecha_fin < values.fecha_inicio) { setError(t('feligresiaAdmin.errores.fechaFinalAnterior')); return }
      setSaving(true); setError(null)
      const result = await supabase.from('comites').update({ nombre: values.nombre.trim(), codigo: values.codigo.trim() || null, descripcion: values.descripcion.trim() || null, fecha_inicio: values.fecha_inicio, fecha_fin: values.fecha_fin || null }).eq('id', committee.id).eq('congregacion_id', congregacionId)
      setSaving(false)
      if (result.error) { setError(t('feligresiaAdmin.errores.noSeActualizoComite', { mensaje: result.error.message })); return }
      setDialog(null); setNotice(t('feligresiaAdmin.notices.comiteActualizado')); load()
    } })
  }

  async function removeCommitteeMember(member) {
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteIntegrantes')); return }
    setDialog({ title: t('feligresiaAdmin.dialogos.retirarIntegranteTitulo'), message: t('feligresiaAdmin.dialogos.retirarIntegranteMensaje'), confirmLabel: t('feligresiaAdmin.comites.retirar'), onConfirm: async () => {
      setSaving(true); setError(null)
      const result = await supabase.from('membresias_comite').update({ fecha_fin: hoyBogota(), estado: 'historico', motivo_retiro: 'Retiro registrado desde Feligresía', usuario_cambio_id: (await supabase.auth.getUser()).data.user?.id || null }).eq('id', member.id)
      setSaving(false)
      if (result.error) { setError(t('feligresiaAdmin.errores.noSeRetiroIntegrante', { mensaje: result.error.message })); return }
      setDialog(null); setNotice(t('feligresiaAdmin.notices.integranteRetirado')); load()
    } })
  }

  function editCommitteeMember(member) {
    setDialog({ title: t('feligresiaAdmin.dialogos.editarResponsabilidadTitulo'), fields: [{ name: 'cargo_id', label: t('feligresiaAdmin.dialogos.campoCargoNormalizado'), value: member.cargo_id || '', type: 'select', options: committeeCargoCatalog.map((cargo) => ({ value: cargo.id, label: cargo.nombre })) }, { name: 'cargo', label: t('feligresiaAdmin.dialogos.campoCargoLibre'), value: member.cargo || '' }, { name: 'reemplazo_persona_id', label: t('feligresiaAdmin.dialogos.campoReemplazarPersona'), value: '', type: 'select', options: [{ value: '', label: t('feligresiaAdmin.dialogos.sinReemplazo') }, ...analyticsPeople.filter((person) => person.id !== member.persona_id && person.estado_membresia === 'activo').map((person) => ({ value: person.id, label: `${person.nombres} ${person.apellidos}` }))] }, { name: 'fecha_efectiva', label: t('feligresiaAdmin.dialogos.campoFechaEfectivaReemplazo'), value: hoyBogota(), type: 'date' }, { name: 'motivo', label: t('feligresiaAdmin.dialogos.campoMotivoCambio'), value: '' }], onSubmit: async (values) => {
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
      if (result.error) { setError(t('feligresiaAdmin.errores.noSeActualizoResponsabilidad', { mensaje: result.error.message })); return }
      setDialog(null); setNotice(values.reemplazo_persona_id ? t('feligresiaAdmin.notices.responsabilidadReemplazada') : t('feligresiaAdmin.notices.cargoIntegranteActualizado')); load()
    } })
  }

  async function savePastoralFollowup(event) {
    event.preventDefault()
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteSeguimientos')); return }
    if (!selected) return
    const formElement = event.currentTarget
    const data = new FormData(formElement)
    const action = data.get('accion')?.toString().trim()
    if (!action) return
    const fecha = data.get('fecha') || hoyBogota()
    const proximaFecha = data.get('proxima_fecha') || null
    if (proximaFecha && proximaFecha < fecha) { setError(t('feligresiaAdmin.errores.proximoContactoAnterior')); return }
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
    if (result.error) { setError(t('feligresiaAdmin.errores.noSeRegistroSeguimiento', { mensaje: result.error.message })); return }
    formElement.reset()
    setNotice(t('feligresiaAdmin.notices.seguimientoPastoralRegistrado')); load()
  }

  async function saveCargo(event) {
    event.preventDefault()
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteCargos')); return }
    if (!selected) return
    const formElement = event.currentTarget
    const data = new FormData(formElement)
    const nombreCargo = data.get('nombre_cargo')?.toString().trim()
    if (!nombreCargo) return
    setSaving(true); setError(null)
    const fechaInicio = data.get('fecha_inicio') || hoyBogota()
    const fechaFin = data.get('fecha_fin') || null
    if (fechaFin && fechaFin < fechaInicio) { setSaving(false); setError(t('feligresiaAdmin.errores.fechaFinCargoAnterior')); return }
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
    if (result.error) { setError(t('feligresiaAdmin.errores.noSeRegistroCargo', { mensaje: result.error.message })); return }
    formElement.reset()
    setNotice(t('feligresiaAdmin.notices.cargoHistoricoRegistrado')); load()
  }

  async function saveMovimiento(event) {
    event.preventDefault()
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteMovimientos')); return }
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
    if (result.error) { setError(t('feligresiaAdmin.errores.noSeRegistroMovimiento', { mensaje: result.error.message })); return }
    form.reset()
    setNotice(t('feligresiaAdmin.notices.movimientoRegistrado')); load()
  }

  async function reconciliarPersona(person) {
    if (!canEdit || !person) return
    setDialog({ title: t('feligresiaAdmin.dialogos.reconciliarPersonaTitulo'), message: t('feligresiaAdmin.dialogos.reconciliarPersonaMensaje', { nombre: `${person.nombres} ${person.apellidos}` }), confirmLabel: t('feligresiaAdmin.dialogos.reconciliar'), onConfirm: async () => {
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
      if (result.error) { setError(t('feligresiaAdmin.errores.noSeReconcilio', { mensaje: result.error.message })); return }
      setDialog(null); setNotice(t('feligresiaAdmin.notices.personaReconciliada', { nombre: `${person.nombres} ${person.apellidos}` })); load()
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
      title: person.conyuge_id ? t('feligresiaAdmin.dialogos.cambiarConyugeTitulo') : t('feligresiaAdmin.dialogos.vincularConyugeTitulo'),
      message: t('feligresiaAdmin.dialogos.vincularConyugeMensaje'),
      fields: [
        { name: 'conyuge_id', label: t('feligresiaAdmin.dialogos.campoConyuge'), value: person.conyuge_id || '', required: true, type: 'select', options: [{ value: '', label: t('feligresiaAdmin.comun.seleccionar') }, ...candidatos.map((item) => ({ value: item.id, label: `${item.nombres} ${item.apellidos}` }))] },
        { name: 'fecha_matrimonio', label: t('feligresiaAdmin.dialogos.campoFechaMatrimonio'), value: person.fecha_matrimonio || '' , type: 'date' },
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
        if (result.error) { setError(t('feligresiaAdmin.errores.noSeVinculoConyuge', { mensaje: result.error.message })); return }
        setDialog(null); setNotice(t('feligresiaAdmin.notices.conyugeVinculado')); load()
      },
    })
  }

  function desvincularConyuge(person) {
    if (!canEdit || !person?.conyuge_id) return
    setDialog({ title: t('feligresiaAdmin.dialogos.desvincularConyugeTitulo'), message: t('feligresiaAdmin.dialogos.desvincularConyugeMensaje'), confirmLabel: t('feligresiaAdmin.dialogos.desvincular'), onConfirm: async () => {
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
      if (result.error) { setError(t('feligresiaAdmin.errores.noSeDesvinculo', { mensaje: result.error.message })); return }
      setDialog(null); setNotice(t('feligresiaAdmin.notices.conyugeDesvinculado')); load()
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
      title: t('feligresiaAdmin.dialogos.registrarFallecimientoTitulo'),
      message: person.conyuge_id ? t('feligresiaAdmin.dialogos.marcarFallecidoMensajeConConyuge', { nombre: `${person.nombres} ${person.apellidos}` }) : t('feligresiaAdmin.dialogos.marcarFallecidoMensaje', { nombre: `${person.nombres} ${person.apellidos}` }),
      fields: [
        { name: 'fecha_fallecimiento', label: t('feligresiaAdmin.dialogos.campoFechaFallecimiento'), value: hoyBogota(), required: true, type: 'date' },
        { name: 'notas_fallecimiento', label: t('feligresiaAdmin.dialogos.campoNotasOpcional'), value: '' },
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
        if (result.error) { setError(t('feligresiaAdmin.errores.noSeRegistroFallecimiento', { mensaje: result.error.message })); return }
        setDialog(null); setNotice(t('feligresiaAdmin.notices.fallecimientoRegistrado', { nombre: `${person.nombres} ${person.apellidos}` })); load()
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
      setError(t('feligresiaAdmin.errores.noSeGeneroCertificado', { mensaje: pdfError.message }))
    }
  }

  function registrarDisciplina(person) {
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteDisciplina')); return }
    setDialog({
      title: t('feligresiaAdmin.dialogos.registrarDisciplinaTitulo', { nombre: `${person.nombres} ${person.apellidos}` }),
      fields: [
        { name: 'motivo', label: t('feligresiaAdmin.dialogos.campoMotivo'), type: 'textarea', required: true },
        { name: 'fecha_inicio', label: t('feligresiaAdmin.dialogos.campoFechaInicio'), type: 'date', value: hoyBogota(), required: true },
        { name: 'fecha_fin_prevista', label: t('feligresiaAdmin.dialogos.campoFechaFinPrevista'), type: 'date' },
      ],
      onSubmit: async (values) => {
        setSaving(true); setError(null)
        const usuarioId = (await supabase.auth.getUser()).data.user?.id || null
        const result = await supabase.from('disciplinas_pastorales').insert({
          persona_id: person.id, congregacion_id: congregacionId, motivo: values.motivo.trim(),
          fecha_inicio: values.fecha_inicio, fecha_fin_prevista: values.fecha_fin_prevista || null, usuario_id: usuarioId,
        })
        setSaving(false)
        if (result.error) { setError(t('feligresiaAdmin.errores.noSeRegistroDisciplina', { mensaje: result.error.message })); return }
        setDialog(null); setNotice(t('feligresiaAdmin.notices.disciplinaRegistrada')); load()
      },
    })
  }

  function agregarSeguimientoDisciplina(disciplina) {
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteSeguimientos')); return }
    setDialog({
      title: t('feligresiaAdmin.dialogos.agregarSeguimientoDisciplinaTitulo'),
      fields: [
        { name: 'nota', label: t('feligresiaAdmin.dialogos.campoNota'), type: 'textarea', required: true },
        { name: 'fecha', label: t('feligresiaAdmin.dialogos.campoFecha'), type: 'date', value: hoyBogota(), required: true },
      ],
      onSubmit: async (values) => {
        setSaving(true); setError(null)
        const usuarioId = (await supabase.auth.getUser()).data.user?.id || null
        const result = await supabase.from('disciplinas_seguimiento').insert({ disciplina_id: disciplina.id, nota: values.nota.trim(), fecha: values.fecha, usuario_id: usuarioId })
        setSaving(false)
        if (result.error) { setError(t('feligresiaAdmin.errores.noSeRegistroSeguimiento', { mensaje: result.error.message })); return }
        setDialog(null); setNotice(t('feligresiaAdmin.notices.seguimientoRegistrado')); load()
      },
    })
  }

  function restaurarDisciplina(disciplina) {
    if (!canEdit) { setError(t('feligresiaAdmin.errores.noPermiteRestauraciones')); return }
    setDialog({
      title: t('feligresiaAdmin.dialogos.registrarRestauracionTitulo'),
      message: t('feligresiaAdmin.dialogos.registrarRestauracionMensaje'),
      fields: [
        { name: 'fecha_restauracion', label: t('feligresiaAdmin.dialogos.campoFechaRestauracion'), type: 'date', value: hoyBogota(), required: true },
        { name: 'notas_restauracion', label: t('feligresiaAdmin.dialogos.campoNotasOpcional'), type: 'textarea' },
      ],
      onSubmit: async (values) => {
        setSaving(true); setError(null)
        const result = await supabase.from('disciplinas_pastorales').update({ fecha_restauracion: values.fecha_restauracion, notas_restauracion: values.notas_restauracion?.trim() || null }).eq('id', disciplina.id)
        setSaving(false)
        if (result.error) { setError(t('feligresiaAdmin.errores.noSeRegistroRestauracion', { mensaje: result.error.message })); return }
        setDialog(null); setNotice(t('feligresiaAdmin.notices.restauracionRegistrada')); load()
      },
    })
  }

  async function buscarCongregacionesBautismo(texto) {
    setBautismoBusqueda(texto)
    if (texto.trim().length < 2) { setBautismoResultados([]); return }
    const { data, error: buscarError } = await supabase.rpc('buscar_congregaciones', { p_busqueda: texto.trim() })
    if (buscarError) { setError(t('feligresiaAdmin.errores.noSeBuscoCongregacion', { mensaje: buscarError.message })); return }
    setBautismoResultados(data ?? [])
  }

  async function buscarCongregacionesDestino(texto) {
    setTrasladoBusqueda(texto)
    if (texto.trim().length < 2) { setTrasladoResultados([]); return }
    const { data, error: buscarError } = await supabase.rpc('buscar_congregaciones', { p_busqueda: texto.trim() })
    if (buscarError) { setError(t('feligresiaAdmin.errores.noSeBuscoCongregacion', { mensaje: buscarError.message })); return }
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
    if (trasladoError) { setError(t('feligresiaAdmin.errores.noSeInicioTraslado', { mensaje: trasladoError.message })); return }
    setTrasladoBusqueda(''); setTrasladoResultados([]); setTrasladoDestinoId(''); setTrasladoObservaciones('')
    setNotice(t('feligresiaAdmin.notices.trasladoIniciado'))
    setShowForm(false)
    load()
  }

  async function recibirTraslado(traslado) {
    if (!canEdit) return
    setSavingTraslado(true); setError(null)
    const { error: recibirError } = await supabase.rpc('recibir_traslado_persona', { p_traslado_id: traslado.id })
    setSavingTraslado(false)
    if (recibirError) { setError(t('feligresiaAdmin.errores.noSeRecibioTraslado', { mensaje: recibirError.message })); return }
    setNotice(t('feligresiaAdmin.notices.trasladoRecibido', { nombre: `${traslado.persona?.nombres} ${traslado.persona?.apellidos}` }))
    load()
  }

  async function cancelarTraslado(traslado) {
    if (!canEdit) return
    setSavingTraslado(true); setError(null)
    const { error: cancelarError } = await supabase.rpc('cancelar_traslado_persona', { p_traslado_id: traslado.id })
    setSavingTraslado(false)
    if (cancelarError) { setError(t('feligresiaAdmin.errores.noSeCanceloTraslado', { mensaje: cancelarError.message })); return }
    setNotice(t('feligresiaAdmin.notices.trasladoCancelado'))
    load()
  }

  async function attendPastoralAlert(alert) {
    if (!canEdit) { setError(t('feligresiaAdmin.errores.soloConsultaAlertas')); return }
    setDialog({ title: t('feligresiaAdmin.dialogos.atenderAlertaTitulo'), message: alert.detalle, fields: [{ name: 'accion', label: t('feligresiaAdmin.dialogos.campoAccionRealizada'), value: '', required: true, placeholder: t('feligresiaAdmin.dialogos.placeholderAccionRealizada') }, { name: 'fecha', label: t('feligresiaAdmin.dialogos.campoFechaRealizada'), value: hoyBogota(), required: true, type: 'date' }, { name: 'proxima_fecha', label: t('feligresiaAdmin.dialogos.campoProximoContactoOpcional'), value: '', type: 'date', tip: t('feligresiaAdmin.dialogos.tipProximoContacto') }, { name: 'notas', label: t('feligresiaAdmin.dialogos.campoNotas'), value: '', type: 'textarea', placeholder: t('feligresiaAdmin.dialogos.placeholderNotasSeguimiento') }], onSubmit: (values) => saveAlertAttention(alert, values) })
  }

  async function saveAlertAttention(alert, values) {
    if (values.proxima_fecha && values.proxima_fecha < values.fecha) { setError(t('feligresiaAdmin.errores.proximoContactoAnterior')); return }
    setSaving(true); setError(null)
    if (alert.persona_id) {
      const followup = await withRequestTimeout(supabase.from('seguimientos_pastorales').insert({ congregacion_id: alert.congregacion_id, persona_id: alert.persona_id, tipo_alerta: alert.tipo, accion: values.accion.trim(), notas: values.notas.trim() || alert.detalle, fecha: values.fecha, proxima_fecha: values.proxima_fecha || null, estado: values.proxima_fecha ? 'pendiente' : 'completado' }))
      if (followup.error) { setSaving(false); setError(t('feligresiaAdmin.errores.noSeRegistroSeguimiento', { mensaje: followup.error.message })); return }
    }
    const result = await withRequestTimeout(supabase.from('estados_alerta_pastoral').upsert({ clave: alert.clave, congregacion_id: alert.congregacion_id, estado: 'atendida', notas: `${values.accion.trim()}${values.notas.trim() ? `: ${values.notas.trim()}` : ''}` }, { onConflict: 'clave' }))
    setSaving(false)
    if (result.error) { setError(t('feligresiaAdmin.errores.noSeCerroAlerta', { mensaje: result.error.message })); return }
    setDialog(null); setNotice(t('feligresiaAdmin.notices.alertaAtendida')); load()
  }

  // Atajo de un solo toque para la alerta "sin asistencia reciente": antes
  // "Atender" solo dejaba una nota y silenciaba la alerta por lo que queda
  // del mes (su clave incluye YYYY-MM), sin tocar fecha_ultima_asistencia
  // -- por eso la misma alerta volvía a aparecer sola el mes siguiente. Este
  // botón sí actualiza el dato real, así que la alerta deja de generarse.
  async function confirmarContactoHoy(alert) {
    if (!canEdit) { setError(t('feligresiaAdmin.errores.soloConsultaAlertas')); return }
    setSaving(true); setError(null)
    const result = await withRequestTimeout(supabase.from('personas').update({ fecha_ultima_asistencia: hoyBogota() }).eq('id', alert.persona_id))
    setSaving(false)
    if (result.error) { setError(t('feligresiaAdmin.errores.noSeConfirmoContacto', { mensaje: result.error.message })); return }
    setNotice(t('feligresiaAdmin.notices.contactoConfirmado')); load()
  }

  async function updateFollowupStatus(followup, estado) {
    if (!canEdit) { setError(t('feligresiaAdmin.errores.soloConsultaSeguimientos')); return }
    if (estado === 'pendiente' && !followup.proxima_fecha) {
      setDialog({ title: t('feligresiaAdmin.dialogos.reabrirSeguimientoTitulo'), message: t('feligresiaAdmin.dialogos.reabrirSeguimientoMensaje'), fields: [{ name: 'proxima_fecha', label: t('feligresiaAdmin.dialogos.campoProximoContacto'), value: hoyBogota(), required: true, type: 'date' }], onSubmit: (values) => saveFollowupReopen(followup, values.proxima_fecha) })
      return
    }
    setSaving(true); setError(null)
    const result = await withRequestTimeout(supabase.from('seguimientos_pastorales').update({ estado }).eq('id', followup.id).eq('congregacion_id', congregacionId))
    setSaving(false)
    if (result.error) { setError(t('feligresiaAdmin.errores.noSeActualizoSeguimiento', { mensaje: result.error.message })); return }
    setNotice(estado === 'completado' ? t('feligresiaAdmin.notices.seguimientoCompletado') : t('feligresiaAdmin.notices.seguimientoCancelado')); load()
  }

  async function saveFollowupReopen(followup, proximaFecha) {
    setSaving(true); setError(null)
    const result = await withRequestTimeout(supabase.from('seguimientos_pastorales').update({ estado: 'pendiente', proxima_fecha: proximaFecha }).eq('id', followup.id).eq('congregacion_id', congregacionId))
    setSaving(false)
    if (result.error) { setError(t('feligresiaAdmin.errores.noSeReabrioSeguimiento', { mensaje: result.error.message })); return }
    setDialog(null); setNotice(t('feligresiaAdmin.notices.seguimientoReabierto')); load()
  }

  async function openPersonFromFollowup(personaId) {
    const visiblePerson = people.find((person) => person.id === personaId)
    if (visiblePerson) { editPerson(visiblePerson); return }
    const result = await withRequestTimeout(supabase.from('personas').select('id, nombres, apellidos, telefono, fecha_nacimiento, fecha_ingreso, estado_membresia, estado_civil, genero, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ultima_asistencia, familia_id, parentesco_familiar, observaciones_pastorales, conyuge_id, fecha_matrimonio, fecha_fallecimiento, notas_fallecimiento, tipo_documento, numero_documento, nivel_educativo, ocupacion, telefono_tipo, tiene_whatsapp, telefono_alterno, red_social, pais_bautismo, municipio_bautismo, congregacion_bautismo_id, congregacion_bautismo_nombre, pastor_bautizo, tipo_sangre, eps_nombre, condiciones_medicas, alergias, medicamentos_actuales, discapacidad, embarazada, fecha_probable_parto, contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco, autorizacion_datos_salud, fecha_autorizacion_datos_salud, consentimiento_datos_firma, fecha_consentimiento_datos, congregaciones_bautismo:congregacion_bautismo_id(nombre, ciudad), familias(nombre_familia)').eq('id', personaId).maybeSingle())
    if (result.error || !result.data) { setError(t('feligresiaAdmin.errores.noSeAbrioFicha')); return }
    editPerson(result.data)
  }

  function editCargo(cargo) {
    setDialog({ title: t('feligresiaAdmin.dialogos.editarCargoTitulo'), fields: [{ name: 'nombre_cargo', label: t('feligresiaAdmin.dialogos.campoNombreCargo'), value: cargo.nombre_cargo, required: true }, { name: 'area', label: t('feligresiaAdmin.dialogos.campoArea'), value: cargo.area || '' }, { name: 'fecha_inicio', label: t('feligresiaAdmin.dialogos.campoDesde'), value: cargo.fecha_inicio || '', required: true, type: 'date' }, { name: 'fecha_fin', label: t('feligresiaAdmin.dialogos.campoHastaOpcional'), value: cargo.fecha_fin || '', type: 'date' }, { name: 'observaciones', label: t('feligresiaAdmin.dialogos.campoObservaciones'), value: cargo.observaciones || '' }], onSubmit: async (values) => {
      if (values.fecha_fin && values.fecha_fin < values.fecha_inicio) { setError(t('feligresiaAdmin.errores.fechaFinCargoAnterior')); return }
      setSaving(true); setError(null)
      let result
      try {
        result = await withRequestTimeout(supabase.from('historial_cargos').update({ nombre_cargo: values.nombre_cargo.trim(), area: values.area.trim() || null, fecha_inicio: values.fecha_inicio, fecha_fin: values.fecha_fin || null, observaciones: values.observaciones.trim() || null }).eq('id', cargo.id))
      } catch (requestError) { setSaving(false); setError(requestError.message); return }
      setSaving(false)
      if (result.error) { setError(t('feligresiaAdmin.errores.noSeActualizoCargo', { mensaje: result.error.message })); return }
      setDialog(null); setNotice(t('feligresiaAdmin.notices.cargoActualizado')); load()
    } })
  }

  async function fetchPeopleForExport() {
    if (!congregacionId) return null
    const STATES = t('feligresiaAdmin.estados', { returnObjects: true })
    const MARITAL_STATUSES = t('feligresiaAdmin.estadoCivil', { returnObjects: true })
    const GENERO_LABELS = t('feligresiaAdmin.genero', { returnObjects: true })
    const FAMILY_RELATIONSHIPS = t('feligresiaAdmin.parentescoFamiliar', { returnObjects: true })
    let query = supabase.from('personas').select('nombres, apellidos, telefono, fecha_nacimiento, estado_civil, genero, estado_membresia, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ingreso, fecha_ultima_asistencia, parentesco_familiar, familias(nombre_familia)').eq('congregacion_id', congregacionId).order('apellidos').order('nombres')
    if (personStatus !== 'todos') query = query.eq('estado_membresia', personStatus)
    if (deferredSearch.trim()) query = query.or(`nombres.ilike.%${deferredSearch.trim()}%,apellidos.ilike.%${deferredSearch.trim()}%`)
    const result = await query
    if (result.error) { setError(t('feligresiaAdmin.errores.noSeExportoCenso')); return null }
    const headers = [t('feligresiaAdmin.export.colNombres'), t('feligresiaAdmin.export.colApellidos'), t('feligresiaAdmin.export.colTelefono'), t('feligresiaAdmin.export.colFechaNacimiento'), t('feligresiaAdmin.export.colGenero'), t('feligresiaAdmin.export.colEstadoCivil'), t('feligresiaAdmin.export.colEstado'), t('feligresiaAdmin.export.colBautizado'), t('feligresiaAdmin.export.colFechaBautismo'), t('feligresiaAdmin.export.colSellado'), t('feligresiaAdmin.export.colFechaSellado'), t('feligresiaAdmin.export.colFechaIngreso'), t('feligresiaAdmin.export.colUltimaAsistencia'), t('feligresiaAdmin.export.colFamilia'), t('feligresiaAdmin.export.colParentesco')]
    const rows = (result.data ?? []).map((person) => [person.nombres, person.apellidos, person.telefono, person.fecha_nacimiento, GENERO_LABELS[person.genero] || '', MARITAL_STATUSES[person.estado_civil] || person.estado_civil, STATES[person.estado_membresia], person.bautizado ? t('feligresiaAdmin.comun.si') : t('feligresiaAdmin.comun.no'), person.fecha_bautismo, person.sellado_espiritu_santo ? t('feligresiaAdmin.comun.si') : t('feligresiaAdmin.comun.no'), person.fecha_sellado, person.fecha_ingreso, person.fecha_ultima_asistencia, person.familias?.nombre_familia, FAMILY_RELATIONSHIPS[person.parentesco_familiar] || person.parentesco_familiar])
    const meta = [personStatus !== 'todos' ? t('feligresiaAdmin.export.metaEstado', { estado: STATES[personStatus] || personStatus }) : t('feligresiaAdmin.export.metaEstadoTodos'), deferredSearch.trim() ? t('feligresiaAdmin.export.metaBusqueda', { busqueda: deferredSearch.trim() }) : null].filter(Boolean)
    const personas = result.data ?? []
    const porEstado = {}
    const porGenero = {}
    personas.forEach((person) => {
      const estado = STATES[person.estado_membresia] || person.estado_membresia
      porEstado[estado] = (porEstado[estado] || 0) + 1
      const genero = GENERO_LABELS[person.genero] || t('feligresiaAdmin.export.sinEspecificar')
      porGenero[genero] = (porGenero[genero] || 0) + 1
    })
    const resumen = {
      kpis: [
        { label: t('feligresiaAdmin.export.kpiPersonasCenso'), value: personas.length },
        { label: t('feligresiaAdmin.export.colBautizado'), value: personas.filter((person) => person.bautizado).length },
        { label: t('feligresiaAdmin.export.kpiSellados'), value: personas.filter((person) => person.sellado_espiritu_santo).length },
        { label: t('feligresiaAdmin.export.kpiConFamilia'), value: personas.filter((person) => person.familias?.nombre_familia).length },
      ],
      desgloses: [
        { titulo: t('feligresiaAdmin.export.desglosePorEstado'), items: Object.entries(porEstado).map(([label, valor]) => ({ label, valor })) },
        { titulo: t('feligresiaAdmin.export.desglosePorGenero'), items: Object.entries(porGenero).map(([label, valor]) => ({ label, valor })) },
      ],
    }
    return { headers, rows, meta, resumen }
  }

  async function exportPeopleCsv() {
    const data = await fetchPeopleForExport()
    if (!data) return
    descargarCsv({ filename: `censo-${hoyBogota()}.csv`, titulo: t('feligresiaAdmin.export.censoTitulo'), ...data })
    setNotice(t('feligresiaAdmin.notices.censoExportado'))
  }

  async function exportPeopleExcel() {
    const data = await fetchPeopleForExport()
    if (!data) return
    await descargarExcel({ filename: `censo-${hoyBogota()}.xlsx`, hoja: t('feligresiaAdmin.export.censoHoja'), titulo: t('feligresiaAdmin.export.censoTitulo'), ...data })
    setNotice(t('feligresiaAdmin.notices.censoExportado'))
  }

  async function exportPeoplePdf() {
    const data = await fetchPeopleForExport()
    if (!data) return
    await descargarPdf({ filename: `censo-${hoyBogota()}.pdf`, titulo: t('feligresiaAdmin.export.censoTitulo'), orientacion: 'landscape', ...data })
    setNotice(t('feligresiaAdmin.notices.censoExportado'))
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
      if (!sheet) throw new Error(t('feligresiaAdmin.errores.archivoSinHoja'))
      const headers = sheet.getRow(1).values.slice(1).map((value) => String(value ?? ''))
      const rows = []
      sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) rows.push(Object.fromEntries(headers.map((header, index) => [header, row.getCell(index + 1).value ?? '']))) })
      const aliases = { nombres: ['nombres', 'nombre'], apellidos: ['apellidos', 'apellido'], telefono: ['telefono', 'teléfono', 'celular'], fecha_nacimiento: ['fecha nacimiento', 'fecha_nacimiento', 'nacimiento'], estado_civil: ['estado civil', 'estado_civil'], estado_membresia: ['estado', 'estado_membresia'], bautizado: ['bautizado'], fecha_bautismo: ['fecha bautismo', 'fecha_bautismo'], fecha_ingreso: ['fecha ingreso', 'fecha_ingreso'], fecha_ultima_asistencia: ['ultima asistencia', 'última asistencia', 'fecha_ultima_asistencia'], familia: ['familia', 'nombre familia'], parentesco_familiar: ['parentesco', 'parentesco familiar', 'parentesco_familiar'] }
      const normalize = (value) => String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ _-]+/g, ' ')
      const findValue = (row, names) => { const key = Object.keys(row).find((candidate) => names.includes(normalize(candidate))); return key ? row[key] : '' }
      const parsed = rows.slice(0, 500).map((row, index) => ({ row: index + 2, nombres: String(findValue(row, aliases.nombres)).trim(), apellidos: String(findValue(row, aliases.apellidos)).trim(), telefono: String(findValue(row, aliases.telefono)).trim(), fecha_nacimiento: findValue(row, aliases.fecha_nacimiento) || null, estado_civil: String(findValue(row, aliases.estado_civil) || 'soltero').trim().toLowerCase(), estado_membresia: String(findValue(row, aliases.estado_membresia) || 'activo').trim().toLowerCase(), bautizado: ['si', 'sí', 'true', '1'].includes(normalize(findValue(row, aliases.bautizado))), fecha_bautismo: findValue(row, aliases.fecha_bautismo) || null, fecha_ingreso: findValue(row, aliases.fecha_ingreso) || null, fecha_ultima_asistencia: findValue(row, aliases.fecha_ultima_asistencia) || null, familia: String(findValue(row, aliases.familia)).trim(), parentesco_familiar: String(findValue(row, aliases.parentesco_familiar)).trim() }))
      const STATES = t('feligresiaAdmin.estados', { returnObjects: true })
      const invalid = parsed.find((row) => !row.nombres || !row.apellidos || !Object.prototype.hasOwnProperty.call(STATES, row.estado_membresia))
      if (invalid) throw new Error(t('feligresiaAdmin.errores.filaRequiereDatos', { fila: invalid.row }))
      if (!parsed.length) throw new Error(t('feligresiaAdmin.errores.archivoSinFilas'))
      const existingResult = await withRequestTimeout(supabase.from('personas').select('id, nombres, apellidos, telefono, familia_id').eq('congregacion_id', congregacionId))
      if (existingResult.error) throw new Error(t('feligresiaAdmin.errores.noSeComparoArchivo', { mensaje: existingResult.error.message }))
      const normalizePhone = (value) => String(value ?? '').replace(/\D/g, '')
      const normalizeName = (value) => normalize(value).replace(/\s+/g, ' ')
      const findMatch = (row) => existingResult.data.find((person) => (normalizePhone(row.telefono) && normalizePhone(row.telefono) === normalizePhone(person.telefono)) || normalizeName(`${row.nombres} ${row.apellidos}`) === normalizeName(`${person.nombres} ${person.apellidos}`))
      setImportRows(parsed.map((row) => ({ ...row, match: findMatch(row), operation: findMatch(row) ? 'actualizar' : 'insertar' })))
    } catch (error) { setImportRows([]); setImportError(error.message || t('feligresiaAdmin.errores.noSeLeyoArchivo')) }
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
        if (result.error) errors.push(t('feligresiaAdmin.errores.filaError', { fila: row.row, mensaje: result.error.message }))
        else if (row.match) updated += 1
        else inserted += 1
      } catch (requestError) { errors.push(t('feligresiaAdmin.errores.filaError', { fila: row.row, mensaje: requestError.message })) }
    }
    setSaving(false)
    if (errors.length) { setImportRowErrors(errors); setImportError(t('feligresiaAdmin.errores.algunasFilasFallaron')); load(); return }
    setImportRows([]); setNotice(t('feligresiaAdmin.notices.importacionCompletada', { inserted, updated })); load()
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
  const STATES = t('feligresiaAdmin.estados', { returnObjects: true })
  const totalPages = Math.max(1, Math.ceil(peopleTotal / peoplePageSize))
  const active = summary?.personas_activas ?? 0
  const baptized = summary?.bautizados ?? 0
  const sealed = summary?.sellados ?? 0
  const apart = summary?.apartados ?? 0
  const familiesWithPeople = summary?.familias_asociadas ?? 0
  function startNewPerson() { setSelected(null); setForm(EMPTY_PERSON); setShowForm(true) }
  function editPerson(person) { if (!canEdit) return; setSelected(person); setForm({ ...EMPTY_PERSON, ...person, fecha_bautismo: person.fecha_bautismo || '', fecha_sellado: person.fecha_sellado || '', fecha_ingreso: person.fecha_ingreso || '', fecha_ultima_asistencia: person.fecha_ultima_asistencia || '', familia_id: person.familia_id || '', conyuge_id: person.conyuge_id || '', fecha_matrimonio: person.fecha_matrimonio || '', fecha_fallecimiento: person.fecha_fallecimiento || '', notas_fallecimiento: person.notas_fallecimiento || '', tipo_documento: person.tipo_documento || '', numero_documento: person.numero_documento || '', nivel_educativo: person.nivel_educativo || '', ocupacion: person.ocupacion || '', telefono_tipo: person.telefono_tipo || '', telefono_alterno: person.telefono_alterno || '', red_social: person.red_social || '', pais_bautismo: person.pais_bautismo || '', municipio_bautismo: person.municipio_bautismo || '', congregacion_bautismo_id: person.congregacion_bautismo_id || '', congregacion_bautismo_nombre: person.congregacion_bautismo_nombre || '', pastor_bautizo: person.pastor_bautizo || '', tipo_sangre: person.tipo_sangre || '', eps_nombre: person.eps_nombre || '', condiciones_medicas: person.condiciones_medicas || '', alergias: person.alergias || '', medicamentos_actuales: person.medicamentos_actuales || '', discapacidad: person.discapacidad || '', fecha_probable_parto: person.fecha_probable_parto || '', contacto_emergencia_nombre: person.contacto_emergencia_nombre || '', contacto_emergencia_telefono: person.contacto_emergencia_telefono || '', contacto_emergencia_parentesco: person.contacto_emergencia_parentesco || '', fecha_autorizacion_datos_salud: person.fecha_autorizacion_datos_salud || '', consentimiento_datos_firma: person.consentimiento_datos_firma || '', fecha_consentimiento_datos: person.fecha_consentimiento_datos || '' }); setShowForm(true) }

  return <div className={`flex flex-col gap-6 ${canEdit === false ? 'feligresia-read-only' : ''}`}>
    {loading && <p role="status" className="text-sm text-muted bg-surface-1 rounded p-3">{t('feligresiaAdmin.cargando')}</p>}
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">{t('feligresiaAdmin.administracionLocal')}</p><h1 className="text-2xl font-semibold">{t('feligresiaAdmin.titulo')}</h1><p className="text-sm text-secondary mt-1">{t('feligresiaAdmin.subtitulo')}</p></div><div className="flex flex-wrap gap-2">{canEdit && <label className="btn-secondary cursor-pointer" title={t('feligresiaAdmin.importarTitle')}><Download className="w-4 h-4" /> {t('feligresiaAdmin.importar')}<input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} /></label>}<ExportButtons onCsv={exportPeopleCsv} onExcel={exportPeopleExcel} onPdf={exportPeoplePdf} />{canEdit && <button onClick={startNewPerson} className="btn-primary"><Plus className="w-4 h-4" /> {t('feligresiaAdmin.registrarPersona')}</button>}</div></header>
    {canEdit === false && <p className="text-sm text-secondary bg-surface-1 rounded p-3">{t('feligresiaAdmin.modoConsulta')}</p>}
    {importError && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3"><p>{importError}</p>{importRowErrors.length > 0 && <ul className="mt-2 list-disc pl-5">{importRowErrors.map((message) => <li key={message}>{message}</li>)}</ul>}</div>}
    {importRows.length > 0 && <section className="card p-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-medium">{t('feligresiaAdmin.vistaPreviaImportacion')}</h2><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.filasListas', { count: importRows.length })}</p></div><div className="flex gap-2"><button type="button" onClick={() => setImportRows([])} className="btn-secondary">{t('feligresiaAdmin.comun.cancelar')}</button><button type="button" onClick={importPeople} disabled={saving} className="btn-primary">{saving ? t('feligresiaAdmin.importando') : t('feligresiaAdmin.confirmarImportacion')}</button></div></div><div className="overflow-x-auto mt-3"><table className="w-full text-xs"><thead><tr className="text-left border-b border-border"><th className="py-2 pr-3">{t('feligresiaAdmin.colNombre')}</th><th className="py-2 pr-3">{t('feligresiaAdmin.colOperacion')}</th><th className="py-2 pr-3">{t('feligresiaAdmin.export.colEstado')}</th><th className="py-2 pr-3">{t('feligresiaAdmin.export.colBautizado')}</th><th className="py-2">{t('feligresiaAdmin.colFamilia')}</th></tr></thead><tbody>{importRows.slice(0, 5).map((row) => <tr key={row.row} className="border-b border-border"><td className="py-2 pr-3">{row.nombres} {row.apellidos}</td><td className={`py-2 pr-3 ${row.operation === 'actualizar' ? 'text-accent' : 'text-success'}`}>{row.operation === 'actualizar' ? t('feligresiaAdmin.operacionActualizar') : t('feligresiaAdmin.operacionInsertar')}</td><td className="py-2 pr-3">{STATES[row.estado_membresia]}</td><td className="py-2 pr-3">{row.bautizado ? t('feligresiaAdmin.comun.si') : t('feligresiaAdmin.comun.no')}</td><td className="py-2">{row.familia || t('feligresiaAdmin.comun.sinFamilia')}</td></tr>)}</tbody></table></div></section>}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3"><Metric label={t('feligresiaAdmin.metricPersonasActivas')} value={active} accent /><Metric label={t('feligresiaAdmin.export.colBautizado')} value={baptized} info={t('feligresiaAdmin.infoBautizados')} /><Metric label={t('feligresiaAdmin.export.kpiSellados')} value={sealed} /><Metric label={t('feligresiaAdmin.estados.apartado')} value={apart} info={t('feligresiaAdmin.infoApartados')} /><Metric label={t('feligresiaAdmin.metricFamiliasAsociadas')} value={familiesWithPeople} /></div>
    <nav className="flex gap-1 border-b border-border overflow-x-auto" aria-label={t('feligresiaAdmin.seccionesAria')} role="tablist">{[['personas', t('feligresiaAdmin.tabPoblacion'), UsersRound], ['familias', t('feligresiaAdmin.tabFamilias'), HeartHandshake], ['comites', t('feligresiaAdmin.tabComites'), HeartHandshake], ['seguimiento', t('feligresiaAdmin.tabSeguimiento'), HeartHandshake], ['traslados', traslados.length ? t('feligresiaAdmin.tabTrasladosConCount', { count: traslados.length }) : t('feligresiaAdmin.tabTraslados'), ArrowRightLeft], ['historial', t('feligresiaAdmin.tabHistorial'), BarChart3], ['informe', t('feligresiaAdmin.tabInforme'), ClipboardList], ['salud', t('feligresiaAdmin.tabSalud'), Heart]].map(([key, label, Icon]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 ${tab === key ? 'border-accent text-accent' : 'border-transparent text-secondary'}`}><Icon className="w-4 h-4" />{label}</button>)}</nav>
    {error && !showForm && <div role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => setReloadToken((current) => current + 1)} className="btn-secondary text-xs self-start sm:self-auto">{t('feligresiaAdmin.comun.reintentar')}</button></div>}
    <Toast>{notice}</Toast>
    {tab === 'comites' && <><CommitteeFilters status={committeeStatusFilter} setStatus={setCommitteeStatusFilter} cargo={committeeCargoFilter} setCargo={setCommitteeCargoFilter} person={committeePersonFilter} setPerson={setCommitteePersonFilter} validity={committeeValidityFilter} setValidity={setCommitteeValidityFilter} cargos={committeeCargoCatalog} people={analyticsPeople} /><CommitteeCreateForm onSubmit={saveCommittee} saving={saving} name={committeeName} setName={setCommitteeName} code={committeeCode} setCode={setCommitteeCode} type={committeeType} setType={setCommitteeType} types={committeeTypes} description={committeeDescription} setDescription={setCommitteeDescription} purpose={committeePurpose} setPurpose={setCommitteePurpose} start={committeeStart} setStart={setCommitteeStart} end={committeeEnd} setEnd={setCommitteeEnd} responsible={committeeResponsible} setResponsible={setCommitteeResponsible} notes={committeeNotes} setNotes={setCommitteeNotes} people={analyticsPeople} /></>}
    {tab === 'seguimiento' && <><PastoralAgendaFilter value={pastoralAgendaStatus} onChange={setPastoralAgendaStatus} search={pastoralAgendaSearch} setSearch={setPastoralAgendaSearch} /><PastoralSection alerts={pastoralAlerts} followups={pastoralFollowups} people={analyticsPeople} saving={saving} onAttend={attendPastoralAlert} onConfirmContact={confirmarContactoHoy} onUpdateFollowup={updateFollowupStatus} onOpenPerson={openPersonFromFollowup} canEdit={canEdit} agendaStatus={pastoralAgendaStatus} agendaSearch={pastoralAgendaSearch} /></>}
    {tab === 'traslados' && <section className="flex flex-col gap-4">
      <p className="text-xs text-secondary bg-surface-1 rounded-card px-4 py-2.5">{t('feligresiaAdmin.traslados.notaPre')}<strong>{t('feligresiaAdmin.traslados.notaStrong')}</strong>{t('feligresiaAdmin.traslados.notaPost')}</p>
      <section className="card p-5">
        <h2 className="font-medium">{t('feligresiaAdmin.traslados.recibidosTitulo')}</h2>
        <p className="text-sm text-secondary mt-1">{t('feligresiaAdmin.traslados.recibidosSubtitulo')}</p>
        {traslados.filter((item) => item.congregacion_destino_id === congregacionId).length ? (
          <div className="flex flex-col gap-2.5 mt-4">
            {traslados.filter((item) => item.congregacion_destino_id === congregacionId).map((item) => (
              <div key={item.id} className="agenda-item">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.persona?.nombres} {item.persona?.apellidos}</p>
                  <p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.traslados.vieneDe', { origen: item.origen?.nombre, fecha: item.fecha_solicitud })}</p>
                  {item.observaciones && <p className="text-xs text-muted mt-1">{item.observaciones}</p>}
                </div>
                <button type="button" disabled={savingTraslado} onClick={() => recibirTraslado(item)} className="agenda-action agenda-action-success"><CheckCircle2 className="w-3.5 h-3.5" />{t('feligresiaAdmin.traslados.recibir')}</button>
              </div>
            ))}
          </div>
        ) : <Empty text={t('feligresiaAdmin.traslados.sinPendientesRecibir')} />}
      </section>
      <section className="card p-5">
        <h2 className="font-medium">{t('feligresiaAdmin.traslados.enviadosTitulo')}</h2>
        <p className="text-sm text-secondary mt-1">{t('feligresiaAdmin.traslados.enviadosSubtitulo')}</p>
        {traslados.filter((item) => item.congregacion_origen_id === congregacionId).length ? (
          <div className="flex flex-col gap-2.5 mt-4">
            {traslados.filter((item) => item.congregacion_origen_id === congregacionId).map((item) => (
              <div key={item.id} className="agenda-item">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.persona?.nombres} {item.persona?.apellidos}</p>
                  <p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.traslados.hacia', { destino: item.destino?.nombre, fecha: item.fecha_solicitud })}</p>
                </div>
                <button type="button" disabled={savingTraslado} onClick={() => cancelarTraslado(item)} className="agenda-action agenda-action-danger"><XCircle className="w-3.5 h-3.5" />{t('feligresiaAdmin.comun.cancelar')}</button>
              </div>
            ))}
          </div>
        ) : <Empty text={t('feligresiaAdmin.traslados.sinPendientesEnviados')} />}
      </section>
    </section>}
    {tab === 'personas' && <section className="card overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1 border border-border rounded px-3 py-2 bg-surface-2">
          <Search className="w-4 h-4 text-muted flex-shrink-0" />
          <input aria-label={t('feligresiaAdmin.buscarPersonasAria')} className="bg-transparent outline-none text-sm w-full" placeholder={t('feligresiaAdmin.buscarPersonaPlaceholder')} value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select aria-label={t('feligresiaAdmin.filtrarEstadoAria')} className="input-field sm:max-w-[180px]" value={personStatus} onChange={(event) => setPersonStatus(event.target.value)}><option value="todos">{t('feligresiaAdmin.insights.todosEstados')}</option>{Object.entries(STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      </div>
      <div className="px-4 pt-3 flex items-center gap-1.5 text-xs text-muted"><InfoTip texto={t('feligresiaAdmin.tipEtiquetasPersona')} /><span>{t('feligresiaAdmin.queSignificanEtiquetas')}</span></div>
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
                  <span className="inline-flex items-center gap-1">{person.bautizado && <Droplet className="w-3 h-3 text-accent" />}{person.bautizado ? t('feligresiaAdmin.bautizadoBadge') : t('feligresiaAdmin.noBautizadoBadge')}</span>
                  {person.familias?.nombre_familia && <span>· {person.familias.nombre_familia}</span>}
                  {person.fecha_ultima_asistencia && <span>· {t('feligresiaAdmin.ultimaAsistenciaBadge', { fecha: person.fecha_ultima_asistencia })}</span>}
                </p>
                {nuevoBautizado && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-warning bg-warning-bg rounded-full px-2 py-0.5 mt-1.5"><Droplet className="w-3 h-3" />{t('feligresiaAdmin.nuevoBautizadoBadge', { dias: nuevoBautizado.dias })}</span>}
                {nombresComitesSugeridos.length > 0 && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-accent bg-accent-bg rounded-full px-2 py-0.5 mt-1.5"><UsersRound className="w-3 h-3" />{t('feligresiaAdmin.sugeridoBadge', { nombres: nombresComitesSugeridos.join(', ') })}</span>}
              </div>
              <span className={`censo-badge ${STATE_BADGE_CLASS[person.estado_membresia] || 'bg-surface-1 text-secondary'}`}>{STATES[person.estado_membresia]}</span>
              <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          )
        })}
      </div> : <Empty text={t('feligresiaAdmin.sinPersonasFiltros')} />}
      <div className="flex items-center justify-between border-t border-border p-3 text-xs text-secondary"><span>{t('feligresiaAdmin.personasEncontradas', { count: peopleTotal })}</span><div className="flex items-center gap-2"><button type="button" disabled={peoplePage === 0 || loading} onClick={() => setPeoplePage((page) => page - 1)} className="btn-secondary px-3">{t('feligresiaAdmin.anterior')}</button><span>{t('feligresiaAdmin.paginaDe', { actual: peoplePage + 1, total: totalPages })}</span><button type="button" disabled={peoplePage + 1 >= totalPages || loading} onClick={() => setPeoplePage((page) => page + 1)} className="btn-secondary px-3">{t('feligresiaAdmin.siguiente')}</button></div></div>
    </section>}
    {tab === 'familias' && <section className="flex flex-col gap-4">{canEdit && <form onSubmit={saveFamily} className="card p-4 grid sm:grid-cols-[1.2fr_1fr_0.8fr_auto] gap-2"><input required className="input-field" placeholder={t('feligresiaAdmin.placeholderNombreFamilia')} value={familyName} onChange={(event) => setFamilyName(event.target.value)} /><input className="input-field" placeholder={t('feligresiaAdmin.placeholderDireccionFamilia')} value={familyAddress} onChange={(event) => setFamilyAddress(event.target.value)} /><input className="input-field" placeholder={t('feligresiaAdmin.placeholderTelefonoFamilia')} value={familyPhone} onChange={(event) => setFamilyPhone(event.target.value)} /><button disabled={saving} className="btn-primary whitespace-nowrap"><Plus className="w-4 h-4" /> {t('feligresiaAdmin.crearFamilia')}</button></form>}<div className="card p-4"><label className="text-sm">{t('feligresiaAdmin.consultarArbolFamiliar')}<select className="input-field mt-1.5" value={selectedFamilyId} onChange={(event) => setSelectedFamilyId(event.target.value)}><option value="">{t('feligresiaAdmin.seleccionaNucleoFamiliar')}</option>{families.map((family) => <option key={family.id} value={family.id}>{family.nombre_familia}</option>)}</select></label><p className="text-xs text-secondary mt-2">{t('feligresiaAdmin.nucleoCompartidoNota')}</p></div><FamilyTree familyId={selectedFamilyId} families={families} members={familyMembers} relations={familyRelations} people={analyticsPeople} canEdit={canEdit} onOpenPerson={editPerson} onRefresh={() => setReloadToken((current) => current + 1)} amigos={amigosCongregacion} familiaAmigos={familiaAmigos} /><div className="grid md:grid-cols-2 gap-4">{families.map((family) => <div key={family.id} className="card p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-medium">{family.nombre_familia}</h2>{canEdit && <button type="button" className="text-xs text-accent" onClick={() => renameFamily(family)}>{t('feligresiaAdmin.editarNombre')}</button>}</div>{(family.direccion || family.telefono) && <p className="text-xs text-secondary mt-2">{family.direccion || t('feligresiaAdmin.sinDireccion')}{family.telefono ? ` · ${family.telefono}` : ''}</p>}<p className="text-sm text-secondary mt-1">{t('feligresiaAdmin.creyenteCount', { count: analyticsPeople.filter((person) => person.familia_id === family.id).length })}{familiaAmigos.filter((link) => link.familia_id === family.id).length > 0 ? ` · ${t('feligresiaAdmin.amigoEnRutaCount', { count: familiaAmigos.filter((link) => link.familia_id === family.id).length })}` : ''}</p>{analyticsPeople.filter((person) => person.familia_id === family.id).map((person) => <p key={person.id} className="text-xs text-muted mt-2">{person.nombres} {person.apellidos}</p>)}</div>)}</div>{families.length === 0 && <Empty text={t('feligresiaAdmin.sinFamiliasRegistradas')} illustration="familia" />}</section>}
    {tab === 'comites' && <section className="flex flex-col gap-4"><div className="flex items-center gap-1"><h3 className="text-sm font-medium">{t('feligresiaAdmin.comites.asignarIntegranteTitulo')}</h3><InfoTip texto={t('feligresiaAdmin.comites.tipCargo')} /></div><form onSubmit={assignCommittee} className="card p-4 grid sm:grid-cols-3 gap-2"><select required name="comite_id" className="input-field"><option value="">{t('feligresiaAdmin.comites.comiteEllipsis')}</option>{committees.filter((committee) => committee.activo).map((committee) => <option key={committee.id} value={committee.id}>{committee.nombre}</option>)}</select><select required name="persona_id" className="input-field"><option value="">{t('feligresiaAdmin.comites.integranteEllipsis')}</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><div className="flex gap-2">{committeeCargoCatalog.length > 0 ? <select required name="cargo_id" className="input-field"><option value="">{t('feligresiaAdmin.comites.cargoEllipsis')}</option>{committeeCargoCatalog.map((cargo) => <option key={cargo.id} value={cargo.id}>{cargo.nombre}</option>)}</select> : <input required name="cargo" className="input-field" placeholder={t('feligresiaAdmin.comites.placeholderCargoSinCatalogo')} />}<button disabled={saving} className="btn-secondary px-3" title={t('feligresiaAdmin.comites.asignarIntegranteTitulo')}><Plus className="w-4 h-4" /></button></div></form><div className="grid md:grid-cols-2 gap-4">{committees.map((committee) => <div key={committee.id} className={`card p-5 ${!committee.activo ? 'opacity-60' : ''}`}><div className="flex items-start justify-between gap-3"><h2 className="font-medium">{committee.nombre}</h2><div className="flex gap-2"><button type="button" className="text-xs text-accent" onClick={() => renameCommittee(committee)}>{t('feligresiaAdmin.comun.editar')}</button><button type="button" className="text-xs text-danger" onClick={() => deactivateCommittee(committee)}>{committee.activo ? t('feligresiaAdmin.comites.desactivar') : t('feligresiaAdmin.comites.reactivar')}</button></div></div><p className="text-sm text-secondary mt-1">{t('feligresiaAdmin.comites.integrantesActivosCount', { count: committee.membresias_comite?.filter((member) => !member.fecha_fin).length ?? 0 })}</p><div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted mt-1.5">{committee.codigo && <span>{t('feligresiaAdmin.comites.codigoLabel', { codigo: committee.codigo })}</span>}{committeeTypes.find((item) => item.id === committee.tipo_id)?.nombre && <span>{t('feligresiaAdmin.comites.tipoLabel', { tipo: committeeTypes.find((item) => item.id === committee.tipo_id)?.nombre })}</span>}{committee.responsable_id && <span>{t('feligresiaAdmin.comites.responsableLabel', { nombre: `${people.find((person) => person.id === committee.responsable_id)?.nombres} ${people.find((person) => person.id === committee.responsable_id)?.apellidos}` })}</span>}<span>{committee.fecha_fin ? t('feligresiaAdmin.comites.vigenciaDelAl', { desde: formatFecha(committee.fecha_inicio), hasta: formatFecha(committee.fecha_fin) }) : t('feligresiaAdmin.comites.vigenciaDesde', { desde: formatFecha(committee.fecha_inicio) })}</span></div>{(committee.descripcion || committee.proposito) && <details className="mt-1.5"><summary className="text-xs text-accent cursor-pointer select-none">{t('feligresiaAdmin.comites.verDescripcionProposito')}</summary><div className="mt-1.5 text-xs text-secondary flex flex-col gap-1">{committee.descripcion && <p><strong>{t('feligresiaAdmin.comites.queEs')}</strong> {committee.descripcion}</p>}{committee.proposito && <p><strong>{t('feligresiaAdmin.comites.paraQue')}</strong> {committee.proposito}</p>}</div></details>}<div className="flex flex-col gap-2 mt-4">{committeeMemberGroups(committee, committeeCargoCatalog, t).map((group) => <div key={group.key}><p className="text-xs font-medium text-secondary">{group.label}{group.members.length > 1 ? ` (${group.members.length})` : ''}</p>{group.members.map((member) => <div key={member.id} className="flex items-center justify-between gap-2 mt-1"><span className="text-xs bg-surface-1 rounded px-2 py-1">{people.find((person) => person.id === member.persona_id)?.nombres || t('feligresiaAdmin.comun.integrante')} {people.find((person) => person.id === member.persona_id)?.apellidos || ''}</span><div className="flex gap-2"><button type="button" className="text-xs text-accent" onClick={() => editCommitteeMember(member)}>{t('feligresiaAdmin.comun.editar')}</button><button type="button" className="text-xs text-danger" onClick={() => removeCommitteeMember(member)}>{t('feligresiaAdmin.comites.retirar')}</button></div></div>)}</div>)}</div></div>)}</div>{committees.length === 0 && <Empty text={t('feligresiaAdmin.comites.sinComitesRegistrados')} illustration="equipo" />}</section>}
    {tab === 'historial' && <><CommitteeAnalytics people={analyticsPeople} committees={allCommittees} cargos={committeeCargoCatalog} audit={committeeAudit} disciplinas={disciplinasPastorales} /><FeligresiaInsights people={analyticsPeople} families={families} committees={committees} cargoHistory={cargoHistory} followups={pastoralFollowups} alerts={pastoralAlerts} /></>}
    {tab === 'informe' && <InformeTrimestralLocal congregacionId={congregacionId} />}
    {tab === 'salud' && <HealthAnalytics people={analyticsPeople} />}
    {showForm && <PersonFormDetailed form={form} setForm={setForm} families={families} committees={committees} cargoHistory={cargoHistory} rangosEdad={rangosEdad} pastoralFollowups={pastoralFollowups} movimientosMembresia={movimientosMembresia} canEdit={canEdit} saving={saving} editing={Boolean(selected)} selected={selected} error={error} close={() => { setShowForm(false); setError(null) }} onSubmit={savePerson} onSavePastoralFollowup={savePastoralFollowup} onSaveCargo={saveCargo} onEditCargo={editCargo} onSaveMovimiento={saveMovimiento} onReconciliar={reconciliarPersona} onVincularConyuge={vincularConyuge} onDesvincularConyuge={desvincularConyuge} onMarcarFallecido={marcarFallecido} onDescargarCertificadoDefuncion={descargarCertificadoDefuncionPersona} analyticsPeople={analyticsPeople} bautismoBusqueda={bautismoBusqueda} bautismoResultados={bautismoResultados} onBuscarBautismo={buscarCongregacionesBautismo} trasladoBusqueda={trasladoBusqueda} trasladoResultados={trasladoResultados} trasladoDestinoId={trasladoDestinoId} setTrasladoDestinoId={setTrasladoDestinoId} trasladoObservaciones={trasladoObservaciones} setTrasladoObservaciones={setTrasladoObservaciones} savingTraslado={savingTraslado} onBuscarDestino={buscarCongregacionesDestino} onIniciarTraslado={iniciarTraslado} nuevoBautizado={selected ? nuevoBautizadoInfo(selected.id) : null} disciplinasPastorales={disciplinasPastorales} onRegistrarDisciplina={registrarDisciplina} onAgregarSeguimientoDisciplina={agregarSeguimientoDisciplina} onRestaurarDisciplina={restaurarDisciplina} />}
    {dialog && <AdminDialog dialog={dialog} saving={saving} error={error} close={() => setDialog(null)} />}
  </div>
}

function FamilyTree({ familyId, families, members, relations, people, canEdit, onOpenPerson, onRefresh, amigos, familiaAmigos }) {
  const { t } = useTranslation()
  const [memberForm, setMemberForm] = useState({ persona_id: '', parentesco: 'otro' })
  const [relationForm, setRelationForm] = useState({ persona_id: '', relacionada_id: '', tipo: 'padre' })
  const [amigoMemberForm, setAmigoMemberForm] = useState({ amigo_id: '', parentesco: 'otro' })
  const [error, setError] = useState(null)
  const family = families.find((item) => item.id === familyId)
  const familyMembers = members.filter((item) => item.familia_id === familyId)
  const familyAmigoLinks = (familiaAmigos ?? []).filter((item) => item.familia_id === familyId)
  const peopleById = new Map(people.map((person) => [person.id, person]))
  const groups = [['abuelo', t('feligresiaAdmin.familyTree.grupoAbuelos')], ['abuela', t('feligresiaAdmin.familyTree.grupoAbuelas')], ['padre', t('feligresiaAdmin.familyTree.grupoPadres')], ['madre', t('feligresiaAdmin.familyTree.grupoMadres')], ['conyuge', t('feligresiaAdmin.familyTree.grupoConyuges')], ['hijo', t('feligresiaAdmin.familyTree.grupoHijos')], ['hija', t('feligresiaAdmin.familyTree.grupoHijas')], ['nieto', t('feligresiaAdmin.familyTree.grupoNietos')], ['nieta', t('feligresiaAdmin.familyTree.grupoNietas')], ['hermano', t('feligresiaAdmin.familyTree.grupoHermanos')], ['hermana', t('feligresiaAdmin.familyTree.grupoHermanas')], ['nuera', t('feligresiaAdmin.familyTree.grupoNueras')], ['yerno', t('feligresiaAdmin.familyTree.grupoYernos')], ['referente', t('feligresiaAdmin.familyTree.grupoReferentes')], ['otro', t('feligresiaAdmin.familyTree.grupoOtros')]]
  async function addMember(event) { event.preventDefault(); if (!familyId || !memberForm.persona_id) return; setError(null); const result = await supabase.from('familia_miembros').insert({ familia_id: familyId, persona_id: memberForm.persona_id, parentesco: memberForm.parentesco, es_referente: memberForm.parentesco === 'referente' }); if (result.error) { setError(t('feligresiaAdmin.familyTree.errorAgregarNucleo', { mensaje: result.error.message })); return }; setMemberForm({ persona_id: '', parentesco: 'otro' }); onRefresh() }
  async function addRelation(event) { event.preventDefault(); if (!relationForm.persona_id || !relationForm.relacionada_id) return; setError(null); const result = await supabase.from('relaciones_familiares').insert(relationForm); if (result.error) { setError(t('feligresiaAdmin.familyTree.errorRegistrarRelacion', { mensaje: result.error.message })); return }; setRelationForm({ persona_id: '', relacionada_id: '', tipo: 'padre' }); onRefresh() }
  async function addAmigoMember(event) { event.preventDefault(); if (!familyId || !amigoMemberForm.amigo_id) return; setError(null); const result = await supabase.from('familia_amigos').insert({ familia_id: familyId, amigo_id: amigoMemberForm.amigo_id, parentesco: amigoMemberForm.parentesco }); if (result.error) { setError(t('feligresiaAdmin.familyTree.errorVincularAmigo', { mensaje: result.error.message })); return }; setAmigoMemberForm({ amigo_id: '', parentesco: 'otro' }); onRefresh() }
  async function removeAmigoMember(id) { setError(null); const result = await supabase.from('familia_amigos').delete().eq('id', id); if (result.error) { setError(t('feligresiaAdmin.familyTree.errorQuitarVinculo', { mensaje: result.error.message })); return }; onRefresh() }
  if (!family) return <div className="empty-state"><Empty text={t('feligresiaAdmin.familyTree.seleccionaNucleo')} /></div>
  const ninosEnFamilia = familyMembers.filter((member) => { const edad = calcularEdad(peopleById.get(member.persona_id)?.fecha_nacimiento); return edad !== null && edad < 12 }).length
    + familyAmigoLinks.filter((link) => { const edad = calcularEdad(link.amigos?.fecha_nacimiento); return edad !== null && edad < 12 }).length
  return <section className="card p-5">{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mb-4">{error}</p>}<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><p className="eyebrow">{t('feligresiaAdmin.familyTree.estructuraNucleo')}</p><h2 className="font-medium mt-1">{t('feligresiaAdmin.familyTree.arbolGenealogico', { nombre: family.nombre_familia })}</h2><p className="text-sm text-secondary mt-1">{t('feligresiaAdmin.familyTree.composicion', { count: familyMembers.length, creyentes: familyMembers.length, amigos: familyAmigoLinks.length, sufijoAmigos: familyAmigoLinks.length === 1 ? '' : 's', ninos: ninosEnFamilia, sufijoNinos: ninosEnFamilia === 1 ? '' : 's', sufijoMenor: ninosEnFamilia === 1 ? '' : 'es' })}</p></div><span className="chart-highlight">{familyMembers.length + familyAmigoLinks.length} {t('feligresiaAdmin.familyTree.integrantes')}</span></div><div className="grid md:grid-cols-2 gap-3 mt-5">{groups.map(([key, label]) => { const group = familyMembers.filter((member) => member.parentesco === key); return group.length ? <div key={key} className="surface-panel p-3"><p className="text-xs uppercase tracking-[0.12em] text-accent">{label}</p>{group.map((member) => { const person = peopleById.get(member.persona_id); return <button type="button" key={member.id} onClick={() => person && onOpenPerson(person)} className="block text-sm text-left mt-2 hover:text-accent">{person ? `${person.nombres} ${person.apellidos}` : t('feligresiaAdmin.familyTree.persona')}<span className="block text-xs text-muted">{person?.fecha_nacimiento ? t('feligresiaAdmin.familyTree.edadRegistrada', { fecha: person.fecha_nacimiento }) : t('feligresiaAdmin.familyTree.sinFechaNacimiento')}</span></button> })}</div> : null })}</div>{familyAmigoLinks.length > 0 && <div className="mt-5 border-t border-border pt-4"><p className="text-xs uppercase tracking-[0.12em] text-accent">{t('feligresiaAdmin.familyTree.amigosVinculados')}</p><div className="grid md:grid-cols-2 gap-2 mt-2">{familyAmigoLinks.map((link) => <div key={link.id} className="flex items-center justify-between gap-2 surface-panel p-3"><div><p className="text-sm">{link.amigos?.nombres || t('feligresiaAdmin.familyTree.amigo')}</p><p className="text-xs text-muted">{link.parentesco}</p></div>{canEdit && <button type="button" onClick={() => removeAmigoMember(link.id)} className="text-xs text-danger">{t('feligresiaAdmin.familyTree.quitar')}</button>}</div>)}</div></div>}{relations.length > 0 && <div className="mt-5 border-t border-border pt-4"><p className="text-xs uppercase tracking-[0.12em] text-accent">{t('feligresiaAdmin.familyTree.relacionesRegistradas')}</p><div className="grid md:grid-cols-2 gap-2 mt-2">{relations.filter((relation) => familyMembers.some((member) => member.persona_id === relation.persona_id || member.persona_id === relation.relacionada_id)).map((relation) => <p key={relation.id} className="text-sm text-secondary">{peopleById.get(relation.persona_id)?.nombres || t('feligresiaAdmin.familyTree.persona')} <span className="text-muted">{relation.tipo}</span> {peopleById.get(relation.relacionada_id)?.nombres || t('feligresiaAdmin.familyTree.persona')}</p>)}</div></div>}{canEdit && <div className="grid md:grid-cols-2 gap-4 mt-5 border-t border-border pt-4"><form onSubmit={addMember} className="flex flex-col gap-2"><p className="text-sm font-medium">{t('feligresiaAdmin.familyTree.agregarAlNucleo')}</p><select required className="input-field" value={memberForm.persona_id} onChange={(event) => setMemberForm({ ...memberForm, persona_id: event.target.value })}><option value="">{t('feligresiaAdmin.familyTree.seleccionarPersona')}</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><select className="input-field" value={memberForm.parentesco} onChange={(event) => setMemberForm({ ...memberForm, parentesco: event.target.value })}>{groups.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="btn-secondary">{t('feligresiaAdmin.familyTree.agregarVinculo')}</button></form><form onSubmit={addRelation} className="flex flex-col gap-2"><p className="text-sm font-medium">{t('feligresiaAdmin.familyTree.registrarRelacion')}</p><select required className="input-field" value={relationForm.persona_id} onChange={(event) => setRelationForm({ ...relationForm, persona_id: event.target.value })}><option value="">{t('feligresiaAdmin.familyTree.personaOrigen')}</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><select required className="input-field" value={relationForm.relacionada_id} onChange={(event) => setRelationForm({ ...relationForm, relacionada_id: event.target.value })}><option value="">{t('feligresiaAdmin.familyTree.personaRelacionada')}</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><select className="input-field" value={relationForm.tipo} onChange={(event) => setRelationForm({ ...relationForm, tipo: event.target.value })}>{[['padre', t('feligresiaAdmin.familyTree.padreDe')], ['madre', t('feligresiaAdmin.familyTree.madreDe')], ['hijo', t('feligresiaAdmin.familyTree.hijoDe')], ['conyuge', t('feligresiaAdmin.familyTree.conyugeDe')], ['hermano', t('feligresiaAdmin.familyTree.hermanoDe')]].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="btn-secondary">{t('feligresiaAdmin.familyTree.registrarRelacion')}</button></form><form onSubmit={addAmigoMember} className="flex flex-col gap-2"><p className="text-sm font-medium flex items-center gap-1">{t('feligresiaAdmin.familyTree.vincularAmigoRuta')}<InfoTip texto={t('feligresiaAdmin.familyTree.vincularAmigoRutaTip')} /></p><select required className="input-field" value={amigoMemberForm.amigo_id} onChange={(event) => setAmigoMemberForm({ ...amigoMemberForm, amigo_id: event.target.value })}><option value="">{t('feligresiaAdmin.familyTree.seleccionarAmigo')}</option>{(amigos ?? []).map((amigo) => <option key={amigo.id} value={amigo.id}>{amigo.nombres}</option>)}</select><select className="input-field" value={amigoMemberForm.parentesco} onChange={(event) => setAmigoMemberForm({ ...amigoMemberForm, parentesco: event.target.value })}>{[['conyuge', t('feligresiaAdmin.familyTree.conyugeOpcion')], ['hijo', t('feligresiaAdmin.familyTree.hijoOpcion')], ['hija', t('feligresiaAdmin.familyTree.hijaOpcion')], ['nieto', t('feligresiaAdmin.familyTree.nietoOpcion')], ['nieta', t('feligresiaAdmin.familyTree.nietaOpcion')], ['otro', t('feligresiaAdmin.familyTree.otroOpcion')]].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="btn-secondary">{t('feligresiaAdmin.familyTree.vincular')}</button></form></div>}</section>
}

function PastoralAgendaFilter({ value, onChange, search, setSearch }) {
  const { t } = useTranslation()
  return <section className="card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><h2 className="font-medium flex items-center gap-1">{t('feligresiaAdmin.pastoralAgenda.agendaPastoral')}<InfoTip texto={t('feligresiaAdmin.pastoralAgenda.agendaPastoralTip')} /></h2><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.pastoralAgenda.consultaEstado')}</p></div><div className="flex flex-col sm:flex-row gap-2"><div className="flex items-center gap-2 input-field"><Search className="w-4 h-4 text-muted" /><input aria-label={t('feligresiaAdmin.pastoralAgenda.buscarSeguimientos')} className="bg-transparent outline-none text-sm w-full" placeholder={t('feligresiaAdmin.pastoralAgenda.buscarPersonaAccion')} value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label={t('feligresiaAdmin.pastoralAgenda.filtrarPorEstado')} className="input-field text-xs sm:max-w-[220px]" value={value} onChange={(event) => onChange(event.target.value)}><option value="pendiente">{t('feligresiaAdmin.pastoralAgenda.pendientes')}</option><option value="completado">{t('feligresiaAdmin.pastoralAgenda.completados')}</option><option value="cancelado">{t('feligresiaAdmin.pastoralAgenda.cancelados')}</option><option value="todos">{t('feligresiaAdmin.pastoralAgenda.todosLosEstados')}</option></select></div></section>
}

function PastoralSection({ alerts, followups, people, saving, onAttend, onConfirmContact, onUpdateFollowup, onOpenPerson, canEdit, agendaStatus, agendaSearch }) {
  const { t } = useTranslation()
  const ALERT_TYPE_LABELS = t('feligresiaAdmin.tiposAlerta', { returnObjects: true })
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
  // Franja "Hoy": un solo punto de partida antes de leer las dos
  // secciones de abajo -- se calcula sobre TODAS las alertas/seguimientos
  // (no sobre lo ya filtrado por tipo/prioridad/busqueda), porque debe
  // ser un punto de referencia estable sin importar que filtro tenga
  // seleccionado el pastor en ese momento.
  const alertasAltaPrioridad = alerts.filter((alert) => alert.prioridad === 'alta').length
  const seguimientosVencidos = followups.filter((item) => item.estado === 'pendiente' && item.proxima_fecha && item.proxima_fecha < today).length
  const seguimientosHoy = followups.filter((item) => item.estado === 'pendiente' && item.proxima_fecha === today).length
  const hayUrgente = alertasAltaPrioridad > 0 || seguimientosVencidos > 0 || seguimientosHoy > 0
  const resumenHoy = [
    alertasAltaPrioridad > 0 ? t('feligresiaAdmin.pastoralAgenda.resumenAlertasAlta', { count: alertasAltaPrioridad }) : null,
    seguimientosVencidos > 0 ? t('feligresiaAdmin.pastoralAgenda.resumenVencidos', { count: seguimientosVencidos }) : null,
    seguimientosHoy > 0 ? t('feligresiaAdmin.pastoralAgenda.resumenHoy', { count: seguimientosHoy }) : null,
  ].filter(Boolean).join(' · ')
  return <div className="flex flex-col gap-4"><section className={`card p-4 border-l-4 ${hayUrgente ? 'border-danger' : 'border-success'}`}><div className="flex items-center gap-2"><span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${hayUrgente ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'}`}>{hayUrgente ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}</span><div><p className="text-sm font-medium">{hayUrgente ? t('feligresiaAdmin.pastoralAgenda.empezarPorEsto') : t('feligresiaAdmin.pastoralAgenda.alDia')}</p><p className="text-xs text-secondary mt-0.5">{hayUrgente ? resumenHoy : t('feligresiaAdmin.pastoralAgenda.sinAlertasNiVencidos')}</p></div></div></section><section className="card p-5"><div><h2 className="font-medium">{t('feligresiaAdmin.pastoralAgenda.agendaAcompanamiento')}{agenda.length > 0 ? ` (${agenda.length})` : ''}</h2><p className="text-sm text-secondary mt-1">{t('feligresiaAdmin.pastoralAgenda.agendaAcompanamientoDesc')}</p></div>{agenda.length ? <div className="flex flex-col gap-2.5 mt-4 max-h-[30rem] overflow-y-auto pr-1">{agenda.map((item) => { const person = people.find((candidate) => candidate.id === item.persona_id); const overdue = item.proxima_fecha && item.proxima_fecha < today; const dueToday = item.proxima_fecha === today; const statusTone = overdue ? 'danger' : dueToday ? 'warning' : 'accent'; const statusLabel = overdue ? t('feligresiaAdmin.pastoralAgenda.vencido') : dueToday ? t('feligresiaAdmin.pastoralAgenda.hoy') : t('feligresiaAdmin.pastoralAgenda.proximo'); const initials = `${person?.nombres?.[0] || '?'}${person?.apellidos?.[0] || ''}`.toUpperCase(); return <div key={item.id} className={`agenda-item ${overdue ? 'agenda-item-overdue' : ''}`}><div className="flex items-start gap-3 min-w-0"><span className="agenda-avatar" aria-hidden="true">{initials}</span><div className="min-w-0"><p className="text-sm font-medium truncate">{person ? `${person.nombres} ${person.apellidos}` : t('feligresiaAdmin.pastoralAgenda.persona')}</p><p className="text-xs text-secondary mt-1">{item.accion}</p>{item.notas && <p className="text-xs text-muted mt-1">{item.notas}</p>}{item.proxima_fecha && <span className={`agenda-status agenda-status-${statusTone} mt-2`}><Clock className="w-3 h-3" />{statusLabel} · {item.proxima_fecha}</span>}</div></div><div className="flex sm:flex-col gap-1.5 flex-shrink-0"><button type="button" onClick={() => onOpenPerson(item.persona_id)} className="agenda-action agenda-action-neutral"><ExternalLink className="w-3.5 h-3.5" />{t('feligresiaAdmin.pastoralAgenda.verFicha')}</button><button type="button" disabled={saving} onClick={() => onUpdateFollowup(item, 'completado')} className="agenda-action agenda-action-success"><CheckCircle2 className="w-3.5 h-3.5" />{t('feligresiaAdmin.pastoralAgenda.completar')}</button><button type="button" disabled={saving} onClick={() => onUpdateFollowup(item, 'cancelado')} className="agenda-action agenda-action-danger"><XCircle className="w-3.5 h-3.5" />{t('feligresiaAdmin.pastoralAgenda.cancelar')}</button></div></div> })}</div> : <Empty text={t('feligresiaAdmin.pastoralAgenda.sinSeguimientosProgramados')} />}<button type="button" onClick={() => setShowHistory((value) => !value)} className="text-xs text-accent mt-3">{showHistory ? t('feligresiaAdmin.pastoralAgenda.ocultarHistorial') : t('feligresiaAdmin.pastoralAgenda.verHistorial', { cantidad: completed.length })}</button>{showHistory && <div className="flex flex-col gap-2.5 mt-3 max-h-[24rem] overflow-y-auto pr-1">{completed.map((item) => { const person = people.find((candidate) => candidate.id === item.persona_id); const initials = `${person?.nombres?.[0] || '?'}${person?.apellidos?.[0] || ''}`.toUpperCase(); return <div key={item.id} className="agenda-item agenda-item-muted"><div className="flex items-start gap-3 min-w-0"><span className="agenda-avatar agenda-avatar-muted" aria-hidden="true">{initials}</span><div className="min-w-0"><p className="text-sm truncate">{person ? `${person.nombres} ${person.apellidos}` : t('feligresiaAdmin.pastoralAgenda.persona')} · {item.accion}</p><p className="text-xs text-muted mt-0.5">{item.fecha} · {item.estado}</p></div></div><div className="flex gap-1.5 flex-shrink-0"><button type="button" onClick={() => onOpenPerson(item.persona_id)} className="agenda-action agenda-action-neutral"><ExternalLink className="w-3.5 h-3.5" />{t('feligresiaAdmin.pastoralAgenda.verFicha')}</button><button type="button" disabled={saving} onClick={() => onUpdateFollowup(item, 'pendiente')} className="agenda-action agenda-action-neutral">{t('feligresiaAdmin.pastoralAgenda.reabrir')}</button></div></div>})}</div>}</section><section className="card p-5"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h2 className="font-medium flex items-center gap-1">{t('feligresiaAdmin.pastoralAgenda.alertasPendientes')}{filteredAlerts.length > 0 ? ` (${filteredAlerts.length})` : ''}<InfoTip texto={t('feligresiaAdmin.pastoralAgenda.alertasPendientesTip')} /></h2><p className="text-sm text-secondary mt-1">{t('feligresiaAdmin.pastoralAgenda.detectadasAutomaticamente')}</p></div><div className="flex gap-2"><select aria-label={t('feligresiaAdmin.pastoralAgenda.filtrarAlertasTipo')} className="input-field text-xs" value={alertType} onChange={(event) => setAlertType(event.target.value)}><option value="todos">{t('feligresiaAdmin.pastoralAgenda.todosLosTipos')}</option><option value="familia">{t('feligresiaAdmin.tiposAlerta.familia')}</option><option value="bautismo">{t('feligresiaAdmin.tiposAlerta.bautismo')}</option><option value="asistencia_persona">{t('feligresiaAdmin.tiposAlerta.asistencia_persona')}</option><option value="comite">{t('feligresiaAdmin.tiposAlerta.comite')}</option><option value="asistencia">{t('feligresiaAdmin.tiposAlerta.asistencia')}</option></select><select aria-label={t('feligresiaAdmin.pastoralAgenda.filtrarAlertasPrioridad')} className="input-field text-xs" value={alertPriority} onChange={(event) => setAlertPriority(event.target.value)}><option value="todos">{t('feligresiaAdmin.pastoralAgenda.todasLasPrioridades')}</option><option value="alta">{t('feligresiaAdmin.pastoralAgenda.alta')}</option><option value="media">{t('feligresiaAdmin.pastoralAgenda.media')}</option></select></div></div>{alertGroups.length ? <div className="flex flex-col gap-4 mt-4 max-h-[30rem] overflow-y-auto pr-1">{alertGroups.map((group) => { const expanded = expandedAlertGroups.has(group.tipo); const visible = expanded ? group.items : group.items.slice(0, 3); const hidden = group.items.length - visible.length; return <div key={group.tipo}><p className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2">{ALERT_TYPE_LABELS[group.tipo] || group.tipo} ({group.items.length})</p><div className="flex flex-col gap-2.5">{visible.map((alert) => <div key={alert.clave} className={`alert-item ${alert.prioridad === 'alta' ? 'alert-item-high' : ''}`}><div className="flex items-start justify-between gap-3"><div><span className={`alert-priority ${alert.prioridad === 'alta' ? 'alert-priority-high' : ''}`}>{alert.prioridad}</span><p className="text-sm font-medium mt-2">{alert.titulo}</p><p className="text-xs text-secondary mt-1">{alert.detalle}</p></div><div className="flex sm:flex-col gap-1.5 flex-shrink-0 sm:items-end">{alert.tipo === 'asistencia_persona' && <button type="button" disabled={saving} onClick={() => onConfirmContact(alert)} className="agenda-action agenda-action-success"><CheckCircle2 className="w-3.5 h-3.5" />{t('feligresiaAdmin.pastoralAgenda.confirmarContactoHoy')}</button>}<button type="button" disabled={saving} onClick={() => onAttend(alert)} className={`agenda-action ${alert.tipo === 'asistencia_persona' ? 'agenda-action-neutral' : 'agenda-action-success'}`}><CheckCircle2 className="w-3.5 h-3.5" />{t('feligresiaAdmin.pastoralAgenda.atender')}</button></div></div></div>)}</div>{hidden > 0 && <button type="button" onClick={() => setExpandedAlertGroups((current) => new Set(current).add(group.tipo))} className="text-xs text-accent mt-2">{t('feligresiaAdmin.pastoralAgenda.verMasDeEsteTipo', { cantidad: hidden })}</button>}</div> })}</div> : <Empty text={t('feligresiaAdmin.pastoralAgenda.sinAlertasConFiltros')} />}</section></div>
}

function CommitteeFilters({ status, setStatus, cargo, setCargo, person, setPerson, validity, setValidity, cargos, people }) {
  const { t } = useTranslation()
  return <section className="card p-4"><div className="flex items-center gap-1 mb-2"><p className="text-xs font-medium text-secondary">{t('feligresiaAdmin.committeeFilters.filtrarComites')}</p><InfoTip texto={t('feligresiaAdmin.committeeFilters.filtrarComitesTip')} /></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2"><select aria-label={t('feligresiaAdmin.committeeFilters.filtrarPorEstado')} className="input-field" value={status} onChange={(event) => setStatus(event.target.value)}><option value="todos">{t('feligresiaAdmin.committeeFilters.todosLosEstados')}</option><option value="activos">{t('feligresiaAdmin.committeeFilters.activos')}</option><option value="inactivos">{t('feligresiaAdmin.committeeFilters.inactivos')}</option></select><select aria-label={t('feligresiaAdmin.committeeFilters.filtrarPorVigencia')} className="input-field" value={validity} onChange={(event) => setValidity(event.target.value)}><option value="todos">{t('feligresiaAdmin.committeeFilters.todaVigencia')}</option><option value="vigentes">{t('feligresiaAdmin.committeeFilters.vigentes')}</option><option value="vencidos">{t('feligresiaAdmin.committeeFilters.vencidos')}</option></select><select aria-label={t('feligresiaAdmin.committeeFilters.filtrarPorCargo')} className="input-field" value={cargo} onChange={(event) => setCargo(event.target.value)}><option value="todos">{t('feligresiaAdmin.committeeFilters.todosLosCargos')}</option>{cargos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><select aria-label={t('feligresiaAdmin.committeeFilters.filtrarPorIntegrante')} className="input-field" value={person} onChange={(event) => setPerson(event.target.value)}><option value="">{t('feligresiaAdmin.committeeFilters.todosLosIntegrantes')}</option>{people.map((item) => <option key={item.id} value={item.id}>{item.nombres} {item.apellidos}</option>)}</select></div></section>
}

function CommitteeCreateForm({ onSubmit, saving, name, setName, code, setCode, type, setType, types, description, setDescription, purpose, setPurpose, start, setStart, end, setEnd, responsible, setResponsible, notes, setNotes, people }) {
  const { t } = useTranslation()
  return <form onSubmit={onSubmit} className="card p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><div className="sm:col-span-2"><label className="text-sm">{t('feligresiaAdmin.committeeCreateForm.nombre')}<input required placeholder={t('feligresiaAdmin.committeeCreateForm.nombrePlaceholder')} className="input-field mt-1.5" value={name} onChange={(event) => setName(event.target.value)} /></label></div><label className="text-sm flex items-center gap-1">{t('feligresiaAdmin.committeeCreateForm.codigoInterno')}<InfoTip texto={t('feligresiaAdmin.committeeCreateForm.codigoInternoTip')} /><input placeholder={t('feligresiaAdmin.committeeCreateForm.codigoPlaceholder')} className="input-field mt-1.5 w-full" value={code} onChange={(event) => setCode(event.target.value)} /></label><label className="text-sm flex items-center gap-1">{t('feligresiaAdmin.committeeCreateForm.tipo')}<InfoTip texto={t('feligresiaAdmin.committeeCreateForm.tipoTip')} /><select className="input-field mt-1.5 w-full" value={type} onChange={(event) => setType(event.target.value)}><option value="">{t('feligresiaAdmin.committeeCreateForm.sinTipo')}</option>{types.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="text-sm">{t('feligresiaAdmin.committeeCreateForm.fechaInicio')}<input required type="date" className="input-field mt-1.5" value={start} onChange={(event) => setStart(event.target.value)} /></label><label className="text-sm flex items-center gap-1">{t('feligresiaAdmin.committeeCreateForm.fechaFinalizacion')}<InfoTip texto={t('feligresiaAdmin.committeeCreateForm.fechaFinalizacionTip')} /><input type="date" className="input-field mt-1.5 w-full" value={end} onChange={(event) => setEnd(event.target.value)} /></label><label className="text-sm">{t('feligresiaAdmin.committeeCreateForm.responsable')}<select className="input-field mt-1.5" value={responsible} onChange={(event) => setResponsible(event.target.value)}><option value="">{t('feligresiaAdmin.committeeCreateForm.sinResponsable')}</option>{people.filter((person) => person.estado_membresia === 'activo').map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select></label><label className="text-sm sm:col-span-2 flex items-center gap-1">{t('feligresiaAdmin.committeeCreateForm.descripcion')}<InfoTip texto={t('feligresiaAdmin.committeeCreateForm.descripcionTip')} /><textarea placeholder={t('feligresiaAdmin.committeeCreateForm.descripcionPlaceholder')} className="input-field mt-1.5 min-h-16 w-full" value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="text-sm sm:col-span-2 flex items-center gap-1">{t('feligresiaAdmin.committeeCreateForm.proposito')}<InfoTip texto={t('feligresiaAdmin.committeeCreateForm.propositoTip')} /><textarea placeholder={t('feligresiaAdmin.committeeCreateForm.propositoPlaceholder')} className="input-field mt-1.5 min-h-16 w-full" value={purpose} onChange={(event) => setPurpose(event.target.value)} /></label><label className="text-sm sm:col-span-2">{t('feligresiaAdmin.committeeCreateForm.observaciones')}<textarea placeholder={t('feligresiaAdmin.committeeCreateForm.observacionesPlaceholder')} className="input-field mt-1.5 min-h-16" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="sm:col-span-2 lg:col-span-4 flex justify-end"><button disabled={saving} className="btn-primary"><Plus className="w-4 h-4" />{saving ? t('feligresiaAdmin.comun.guardando') : t('feligresiaAdmin.committeeCreateForm.crearComite')}</button></div></form>
}

function AdminDialog({ dialog, saving, error, close }) {
  const { t } = useTranslation()
  const [values, setValues] = useState(() => Object.fromEntries((dialog.fields ?? []).map((field) => [field.name, field.value || ''])))
  useEffect(() => {
    const handleKeyDown = (event) => { if (event.key === 'Escape' && !saving) close() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [close, saving])
  const submit = (event) => { event.preventDefault(); if (dialog.onSubmit) dialog.onSubmit(values); else dialog.onConfirm() }
  return <div className="fixed inset-0 z-[60] bg-night/30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title"><form onSubmit={submit} className="w-full max-w-md bg-surface-2 rounded-card shadow-xl p-6"><h2 id="admin-dialog-title" className="font-medium">{dialog.title}</h2>{dialog.message && <p className="text-sm text-secondary mt-2">{dialog.message}</p>}{error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3 mt-3">{error}</p>}{dialog.fields && <div className="flex flex-col gap-3 mt-4">{dialog.fields.map((field) => <label key={field.name} className="text-sm flex items-center gap-1 flex-wrap">{field.label}{field.tip && <InfoTip texto={field.tip} />}{field.type === 'select' ? <select required={field.required} className="input-field mt-1.5 w-full" value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea required={field.required} placeholder={field.placeholder} className="input-field mt-1.5 min-h-20 w-full" value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} /> : <input required={field.required} type={field.type || 'text'} placeholder={field.placeholder} className="input-field mt-1.5 w-full" value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />}</label>)}</div>}<div className="flex justify-end gap-2 mt-6"><button type="button" onClick={close} className="btn-secondary">{t('feligresiaAdmin.adminDialog.cancelar')}</button><button disabled={saving} className="btn-primary">{saving ? t('feligresiaAdmin.comun.guardando') : dialog.confirmLabel || t('feligresiaAdmin.adminDialog.guardar')}</button></div></form></div>
}

function PastoralFollowupPanel({ person, followups, saving, onSubmit, embedded = false }) {
  const { t } = useTranslation()
  const ALERT_TYPE_LABELS = t('feligresiaAdmin.tiposAlerta', { returnObjects: true })
  const personFollowups = followups.filter((item) => item.persona_id === person?.id)
  return <section className={`${embedded ? '' : 'fixed z-50 right-4 bottom-4 w-[min(24rem,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto bg-surface-2 border border-border rounded-card shadow-xl'} p-4`}><div className="flex items-start justify-between gap-3 mb-3"><div><h2 className="font-medium flex items-center gap-1">{t('feligresiaAdmin.pastoralFollowupPanel.seguimientoPastoral')}<InfoTip texto={t('feligresiaAdmin.pastoralFollowupPanel.seguimientoPastoralTip')} /></h2><p className="text-xs text-secondary mt-1">{person.nombres} {person.apellidos}</p></div><span className="text-xs text-muted">{personFollowups.length} {t('feligresiaAdmin.pastoralFollowupPanel.registros')}</span></div><form onSubmit={onSubmit} className="flex flex-col gap-2 border-b border-border pb-4"><div className="flex items-center gap-1.5"><select name="tipo_alerta" className="input-field text-sm flex-1" defaultValue=""><option value="">{t('feligresiaAdmin.pastoralFollowupPanel.tipoSituacion')}</option><option value="familia">{t('feligresiaAdmin.tiposAlerta.familia')}</option><option value="bautismo">{t('feligresiaAdmin.tiposAlerta.bautismo')}</option><option value="asistencia_persona">{t('feligresiaAdmin.tiposAlerta.asistencia_persona')}</option><option value="general">{t('feligresiaAdmin.pastoralFollowupPanel.general')}</option></select><InfoTip texto={t('feligresiaAdmin.pastoralFollowupPanel.tipoSituacionTip')} /></div><input required name="accion" className="input-field text-sm" placeholder={t('feligresiaAdmin.pastoralFollowupPanel.accionPlaceholder')} /><div className="grid grid-cols-2 gap-2"><label className="text-xs text-secondary">{t('feligresiaAdmin.pastoralFollowupPanel.fechaRealizada')}<input required name="fecha" type="date" className="input-field text-sm mt-1" defaultValue={hoyBogota()} /></label><label className="text-xs text-secondary flex items-center gap-1">{t('feligresiaAdmin.pastoralFollowupPanel.proximoContacto')}<InfoTip texto={t('feligresiaAdmin.pastoralFollowupPanel.proximoContactoTip')} /><input name="proxima_fecha" type="date" className="input-field text-sm mt-1 w-full" /></label></div><textarea name="notas" className="input-field text-sm min-h-16" placeholder={t('feligresiaAdmin.pastoralFollowupPanel.notasPlaceholder')} /><button disabled={saving} className="btn-primary justify-center">{saving ? t('feligresiaAdmin.comun.guardando') : t('feligresiaAdmin.pastoralFollowupPanel.registrarSeguimiento')}</button></form><div className="flex flex-col divide-y divide-border">{personFollowups.length ? personFollowups.map((item) => <div key={item.id} className="py-3"><div className="flex justify-between gap-2"><p className="text-sm font-medium">{item.accion}</p><span className={`text-xs ${item.estado === 'completado' ? 'text-success' : item.estado === 'cancelado' ? 'text-muted' : 'text-accent'}`}>{item.estado || t('feligresiaAdmin.pastoralFollowupPanel.pendiente')}</span></div><p className="text-xs text-muted mt-1">{item.fecha}{item.proxima_fecha ? t('feligresiaAdmin.pastoralFollowupPanel.proximoDosPuntos', { fecha: item.proxima_fecha }) : ''}{item.tipo_alerta ? ` · ${ALERT_TYPE_LABELS[item.tipo_alerta] || item.tipo_alerta}` : ''}</p>{item.notas && <p className="text-xs text-secondary mt-1">{item.notas}</p>}</div>) : <p className="text-xs text-muted py-4">{t('feligresiaAdmin.pastoralFollowupPanel.sinSeguimientosRegistrados')}</p>}</div></section>
}
function CargoPanel({ person, cargos, saving, onSubmit, onEdit, embedded = false, nuevoBautizado }) {
  const { t } = useTranslation()
  const personCargos = cargos.filter((item) => item.persona_id === person?.id)
  return <section className={`${embedded ? '' : 'fixed z-50 right-4 bottom-[calc(75vh+1rem)] w-[min(24rem,calc(100vw-2rem))] max-h-[30vh] overflow-y-auto bg-surface-2 border border-border rounded-card shadow-xl'} p-4`}><h2 className="font-medium">{t('feligresiaAdmin.cargoPanel.historialCargos')}</h2>{nuevoBautizado && <p className="text-xs text-warning bg-warning-bg rounded p-2 mt-2 flex items-center gap-1.5"><Droplet className="w-3.5 h-3.5 flex-shrink-0" />{t('feligresiaAdmin.cargoPanel.nuevoBautizadoAviso', { count: nuevoBautizado.dias, dias: nuevoBautizado.dias })}</p>}<form onSubmit={onSubmit} className="grid grid-cols-2 gap-2 mt-3"><input required name="nombre_cargo" className="input-field text-sm col-span-2" placeholder={t('feligresiaAdmin.cargoPanel.nombreCargoPlaceholder')} /><input name="area" className="input-field text-sm" placeholder={t('feligresiaAdmin.cargoPanel.areaPlaceholder')} /><label className="text-xs text-secondary">{t('feligresiaAdmin.cargoPanel.desde')}<input required name="fecha_inicio" type="date" aria-label={t('feligresiaAdmin.cargoPanel.fechaDesde')} className="input-field text-sm mt-1" defaultValue={hoyBogota()} /></label><label className="text-xs text-secondary">{t('feligresiaAdmin.cargoPanel.hastaOpcional')}<input name="fecha_fin" type="date" aria-label={t('feligresiaAdmin.cargoPanel.fechaHastaOpcional')} className="input-field text-sm mt-1" /></label><input name="observaciones" className="input-field text-sm col-span-2" placeholder={t('feligresiaAdmin.cargoPanel.observacionesPlaceholder')} /><button disabled={saving} className="btn-primary text-sm col-span-2 justify-center">{saving ? t('feligresiaAdmin.comun.guardando') : t('feligresiaAdmin.cargoPanel.registrarCargo')}</button></form><div className="divide-y divide-border mt-3">{personCargos.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 py-2"><div><p className="text-xs font-medium">{item.nombre_cargo}{item.area ? ` · ${item.area}` : ''}</p><p className="text-xs text-muted">{item.fecha_inicio}{item.fecha_fin ? t('feligresiaAdmin.cargoPanel.hastaFecha', { fecha: item.fecha_fin }) : t('feligresiaAdmin.cargoPanel.actual')}</p></div><button type="button" onClick={() => onEdit(item)} className="text-xs text-accent">{t('feligresiaAdmin.cargoPanel.editar')}</button></div>)}</div></section>
}

function MembershipMovementsPanel({ person, movimientosMembresia, saving, onSubmit, trasladoBusqueda, trasladoResultados, trasladoDestinoId, setTrasladoDestinoId, trasladoObservaciones, setTrasladoObservaciones, savingTraslado, onBuscarDestino, onIniciarTraslado, embedded = false }) {
  const { t } = useTranslation()
  const personMovements = (movimientosMembresia ?? []).filter((item) => item.persona_id === person?.id)
  const destinoSeleccionado = trasladoResultados?.find((item) => item.id === trasladoDestinoId)
  return <section className={`${embedded ? '' : 'fixed z-50 right-4 bottom-4 w-[min(24rem,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto bg-surface-2 border border-border rounded-card shadow-xl'} p-4`}>
    <h2 className="font-medium">{t('feligresiaAdmin.membershipMovementsPanel.trasladarAOtraCongregacion')}</h2>
    <p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.membershipMovementsPanel.trasladarDesc', { nombre: person?.nombres })}</p>
    <div className="flex flex-col gap-2 mt-3 border-b border-border pb-4">
      <input className="input-field text-sm" placeholder={t('feligresiaAdmin.membershipMovementsPanel.buscarCongregacionPlaceholder')} value={trasladoBusqueda} onChange={(event) => { onBuscarDestino(event.target.value); setTrasladoDestinoId('') }} />
      {trasladoResultados?.length > 0 && !destinoSeleccionado && <div className="flex flex-col divide-y divide-border border border-border rounded max-h-40 overflow-y-auto">{trasladoResultados.map((item) => <button type="button" key={item.id} onClick={() => setTrasladoDestinoId(item.id)} className="text-left text-xs px-2.5 py-2 hover:bg-surface-1"><span className="font-medium">{item.nombre}</span>{item.ciudad ? ` · ${item.ciudad}` : ''}{item.distrito_numero ? t('feligresiaAdmin.membershipMovementsPanel.distritoNumero', { numero: item.distrito_numero }) : ''}</button>)}</div>}
      {destinoSeleccionado && <p className="text-xs text-accent">{t('feligresiaAdmin.membershipMovementsPanel.destino', { nombre: destinoSeleccionado.nombre })}{destinoSeleccionado.ciudad ? ` · ${destinoSeleccionado.ciudad}` : ''} <button type="button" className="text-muted underline ml-1" onClick={() => setTrasladoDestinoId('')}>{t('feligresiaAdmin.membershipMovementsPanel.cambiar')}</button></p>}
      <input className="input-field text-sm" placeholder={t('feligresiaAdmin.membershipMovementsPanel.observacionesTrasladoPlaceholder')} value={trasladoObservaciones} onChange={(event) => setTrasladoObservaciones(event.target.value)} />
      <button type="button" disabled={savingTraslado || !trasladoDestinoId} onClick={onIniciarTraslado} className="btn-primary text-sm justify-center">{savingTraslado ? t('feligresiaAdmin.membershipMovementsPanel.iniciando') : t('feligresiaAdmin.membershipMovementsPanel.iniciarTraslado')}</button>
      <p className="text-xs text-muted">{t('feligresiaAdmin.membershipMovementsPanel.trasladoPendienteNota')}</p>
    </div>
    <h2 className="font-medium mt-4 flex items-center gap-1">{t('feligresiaAdmin.membershipMovementsPanel.movimientosMembresia')}<InfoTip texto={t('feligresiaAdmin.membershipMovementsPanel.movimientosTip')} /></h2><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.membershipMovementsPanel.altasBajasAuditoria')}</p><form onSubmit={onSubmit} className="flex flex-col gap-2 mt-3 border-b border-border pb-4"><select required name="tipo" className="input-field text-sm" defaultValue=""><option value="" disabled>{t('feligresiaAdmin.membershipMovementsPanel.tipoMovimiento')}</option>{Object.entries(MOVIMIENTO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="text-xs text-secondary">{t('feligresiaAdmin.membershipMovementsPanel.fecha')}<input required name="fecha" type="date" className="input-field text-sm mt-1" defaultValue={hoyBogota()} /></label><input name="observaciones" className="input-field text-sm" placeholder={t('feligresiaAdmin.membershipMovementsPanel.observacionesMovimientoPlaceholder')} /><button disabled={saving} className="btn-primary text-sm justify-center">{saving ? t('feligresiaAdmin.comun.guardando') : t('feligresiaAdmin.membershipMovementsPanel.registrarMovimiento')}</button></form><div className="divide-y divide-border">{personMovements.length ? personMovements.map((item) => <div key={item.id} className="py-3"><p className="text-sm font-medium">{MOVIMIENTO_LABELS[item.tipo] || item.tipo}</p><p className="text-xs text-muted mt-1">{item.fecha}{item.congregaciones_relacionada?.nombre ? ` · ${item.congregaciones_relacionada.nombre}` : ''}</p>{item.observaciones && <p className="text-xs text-secondary mt-1">{item.observaciones}</p>}</div>) : <p className="text-xs text-muted py-4">{t('feligresiaAdmin.membershipMovementsPanel.sinMovimientosRegistrados')}</p>}</div></section>
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
  const { t } = useTranslation()
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
      titulo: t('feligresiaAdmin.informeTrimestral.tituloReporte', { etiqueta }),
      meta: [
        t('feligresiaAdmin.informeTrimestral.metaTrimestre', { etiqueta }),
        t('feligresiaAdmin.informeTrimestral.metaEntregadosHoy', { unoMas: resumen.ruta_uno_mas, bis: resumen.ruta_bis, refam: resumen.ruta_refam, esfob: resumen.ruta_esfob }),
      ],
      resumen: {
        kpis: [
          { label: t('feligresiaAdmin.informeTrimestral.exportBautizados'), value: resumen.bautizados_total_actual },
          { label: t('feligresiaAdmin.informeTrimestral.exportSellados'), value: resumen.sellados_total_actual },
          { label: t('feligresiaAdmin.informeTrimestral.exportReconciliadosTrimestre'), value: resumen.reconciliados_actual },
          { label: t('feligresiaAdmin.informeTrimestral.exportEntregadosActuales'), value: resumen.entregados_total_actual },
        ],
      },
      headers: [t('feligresiaAdmin.informeTrimestral.colIndicador'), t('feligresiaAdmin.informeTrimestral.colAntes'), t('feligresiaAdmin.informeTrimestral.colNuevos'), t('feligresiaAdmin.informeTrimestral.colTotalActual')],
      rows: [
        [t('feligresiaAdmin.informeTrimestral.exportBautizados'), resumen.bautizados_total_anterior, resumen.bautizados_nuevos, resumen.bautizados_total_actual],
        [t('feligresiaAdmin.informeTrimestral.exportSellados'), resumen.sellados_total_anterior, resumen.sellados_nuevos, resumen.sellados_total_actual],
        [t('feligresiaAdmin.informeTrimestral.exportReconciliados'), resumen.reconciliados_anterior, resumen.reconciliados_actual, '—'],
        [t('feligresiaAdmin.informeTrimestral.exportEntregados'), resumen.entregados_total_anterior, resumen.entregados_nuevos, resumen.entregados_total_actual],
        [t('feligresiaAdmin.informeTrimestral.exportEntregadosGraduados'), '—', resumen.entregados_graduados, '—'],
      ],
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-secondary">{t('feligresiaAdmin.informeTrimestral.estadisticasReportarDistrito')}</p>
        <label className="text-sm ml-auto">{t('feligresiaAdmin.informeTrimestral.anio')}<select className="input-field mt-1.5" value={anio} onChange={(event) => setAnio(Number(event.target.value))}>{anios.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm">{t('feligresiaAdmin.informeTrimestral.trimestre')}<select className="input-field mt-1.5" value={trimestre} onChange={(event) => setTrimestre(Number(event.target.value))}>{Object.entries(ETIQUETA_TRIMESTRE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" onClick={descargarInforme} disabled={!resumen} className="btn-secondary"><Download className="w-4 h-4" /> {t('feligresiaAdmin.informeTrimestral.descargarPdf')}</button>
      </div>
      {loadingInforme ? (
        <SkeletonList rows={4} />
      ) : resumen ? (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <IndicadorTrimestral titulo={t('feligresiaAdmin.informeTrimestral.bautizadosTitulo')} anterior={resumen.bautizados_total_anterior} nuevos={resumen.bautizados_nuevos} actual={resumen.bautizados_total_actual} info={t('feligresiaAdmin.informeTrimestral.bautizadosTip')} />
            <IndicadorTrimestral titulo={t('feligresiaAdmin.informeTrimestral.selladosTitulo')} anterior={resumen.sellados_total_anterior} nuevos={resumen.sellados_nuevos} actual={resumen.sellados_total_actual} />
            <div className="summary-card summary-card-default stat-tile">
              <p className="text-[10px] uppercase tracking-[0.16em] text-secondary flex items-center gap-1.5">{t('feligresiaAdmin.informeTrimestral.reconciliadosTitulo')}<InfoTip texto={t('feligresiaAdmin.informeTrimestral.reconciliadosTip')} /></p>
              <p className="text-3xl font-semibold tracking-tight mt-3">{resumen.reconciliados_actual}</p>
              <p className="text-xs text-secondary mt-2">{t('feligresiaAdmin.informeTrimestral.trimestreAnterior', { cantidad: resumen.reconciliados_anterior })}</p>
            </div>
          </div>
          <div className="card p-5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-secondary flex items-center gap-1.5">{t('feligresiaAdmin.informeTrimestral.entregadosTitulo')}<InfoTip texto={t('feligresiaAdmin.informeTrimestral.entregadosTip')} /></p>
            <div className="grid sm:grid-cols-4 gap-4 mt-3 text-sm">
              <div><p className="text-2xl font-semibold">{resumen.entregados_total_actual}</p><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.informeTrimestral.totalActualAntes', { anterior: resumen.entregados_total_anterior })}</p></div>
              <div><p className="text-2xl font-semibold text-success">+{resumen.entregados_nuevos}</p><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.informeTrimestral.nuevosEsteTrimestre')}</p></div>
              <div><p className="text-2xl font-semibold text-accent">{resumen.entregados_graduados}</p><p className="text-xs text-secondary mt-1">{t('feligresiaAdmin.informeTrimestral.seBautizaronEsteTrimestre')}</p></div>
            </div>
            <div className="border-t border-border mt-4 pt-4">
              <p className="text-xs text-secondary flex items-center gap-1.5">{t('feligresiaAdmin.informeTrimestral.hoyMismoPorEstacion')}<InfoTip texto={t('feligresiaAdmin.informeTrimestral.hoyMismoTip')} /></p>
              <div className="grid grid-cols-4 gap-3 mt-2 text-center">
                <div><p className="text-lg font-semibold">{resumen.ruta_uno_mas}</p><p className="text-[10px] text-muted uppercase tracking-wide">{t('feligresiaAdmin.informeTrimestral.unoMas')}</p></div>
                <div><p className="text-lg font-semibold">{resumen.ruta_bis}</p><p className="text-[10px] text-muted uppercase tracking-wide">BIS</p></div>
                <div><p className="text-lg font-semibold">{resumen.ruta_refam}</p><p className="text-[10px] text-muted uppercase tracking-wide">REFAM</p></div>
                <div><p className="text-lg font-semibold">{resumen.ruta_esfob}</p><p className="text-[10px] text-muted uppercase tracking-wide">ESFOB</p></div>
              </div>
            </div>
          </div>
        </>
      ) : <Empty text={t('feligresiaAdmin.informeTrimestral.sinInformeTrimestre')} />}
    </section>
  )
}

function Field({ label, type = 'text', required, value, onChange }) { return <label className="text-sm">{label}<input required={required} type={type} className="input-field mt-1.5" value={value || ''} onChange={(event) => onChange(event.target.value)} /></label> }
