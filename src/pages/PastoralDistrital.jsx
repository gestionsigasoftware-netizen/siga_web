import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, Plus, Search, PencilLine, Users, Building2, UserRoundCheck, CircleDashed, MapPinned, GraduationCap, BookOpen, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMiRol } from '../hooks/useMiRol'

const TODAY = new Date().toISOString().slice(0, 10)
const CARGO_OPTIONS = ['Pastor local', 'Pastor asociado', 'Pastor auxiliar', 'Coordinador de congregación']
const LICENCIA_LABELS = { obrero: 'Obrero', local: 'Licencia Local', general: 'Licencia General', ordenacion: 'Ordenación Ministerial' }
const LICENCIA_SIGUIENTE = { obrero: 'local', local: 'general', general: 'ordenacion', ordenacion: null }
const TIPO_FORMACION_LABELS = { titulo: 'Título', curso: 'Curso', diplomado: 'Diplomado', especializacion: 'Especialización', maestria: 'Maestría', doctorado: 'Doctorado', seminario_biblico: 'Seminario bíblico', otro: 'Otro' }
const MADUREZ_LABELS = { mision_nacional: 'Misión Nacional', lugar_prediccion: 'Lugar de Predicación', iglesia_local: 'Iglesia Local (Constituida)' }
const EMPTY_FORM = {
  nombres: '',
  apellidos: '',
  telefono: '',
  email: '',
  familia_pastoral: '',
  congregacion_id: '',
  fecha_inicio: TODAY,
  cargo: 'Pastor local',
  observaciones: '',
  fecha_tarjeta_predicador: '',
}
const EMPTY_NEW_CONGREGATION = { nombre: '', ciudad: '', pastor_nombres: '', pastor_apellidos: '', pastor_telefono: '', pastor_email: '' }
const EMPTY_FORMACION = { pastor_id: '', tipo: 'diplomado', tipo_otro: '', nombre: '', institucion: '', fecha: '', observaciones: '' }

const formatDate = (value) => {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const getCurrentMonthTransfers = (assignments = []) => {
  const now = new Date()
  return assignments.filter((assignment) => {
    if (!assignment.fecha_inicio) return false
    const date = new Date(`${assignment.fecha_inicio}T12:00:00`)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }).length
}

export default function PastoralDistrital() {
  const { rolPrincipal, loading: roleLoading } = useMiRol()
  const distritoId = rolPrincipal?.distrito_id
  const isDistrictLeader = rolPrincipal?.nivel === 'distrital'

  const [pastors, setPastors] = useState([])
  const [congregations, setCongregations] = useState([])
  const [assignments, setAssignments] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [congregationFilter, setCongregationFilter] = useState('all')
  const [editingPastorId, setEditingPastorId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [transferForm, setTransferForm] = useState({
    pastor_id: '',
    congregacion_id: '',
    fecha: TODAY,
    observaciones: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [newCongregation, setNewCongregation] = useState(EMPTY_NEW_CONGREGATION)
  const [creatingCongregation, setCreatingCongregation] = useState(false)
  const [pastorProfileId, setPastorProfileId] = useState(null)
  const [resumenPorCongregacion, setResumenPorCongregacion] = useState(new Map())
  const [licenciaHistorial, setLicenciaHistorial] = useState([])
  const [licenciaForm, setLicenciaForm] = useState({ pastor_id: '', fecha: TODAY, observaciones: '' })
  const [ascendiendoLicencia, setAscendiendoLicencia] = useState(false)
  const [formaciones, setFormaciones] = useState([])
  const [formacionForm, setFormacionForm] = useState(EMPTY_FORMACION)
  const [resumenEscuelaDominical, setResumenEscuelaDominical] = useState([])
  const [resumenDamas, setResumenDamas] = useState([])
  const [savingFormacion, setSavingFormacion] = useState(false)

  const activeAssignments = useMemo(
    () => assignments.filter((assignment) => !assignment.fecha_fin),
    [assignments]
  )

  const activeByPastor = useMemo(
    () => new Map(activeAssignments.map((assignment) => [assignment.pastor_id, assignment])),
    [activeAssignments]
  )

  const stats = useMemo(() => {
    const activePastorIds = new Set(activeAssignments.map((assignment) => assignment.pastor_id))
    const activePastorCount = pastors.filter((pastor) => activePastorIds.has(pastor.id)).length
    const congregationsWithPastors = congregations.filter((congregation) => congregation.pastor_id).length
    const vacantCongregations = congregations.length - congregationsWithPastors

    return {
      totalPastors: pastors.length,
      activePastorCount,
      congregationsWithPastors,
      vacantCongregations,
      transfersThisMonth: getCurrentMonthTransfers(assignments),
    }
  }, [activeAssignments, pastors, congregations, assignments])

  const filteredPastors = useMemo(() => {
    return pastors.filter((pastor) => {
      const activeAssignment = activeByPastor.get(pastor.id)
      const congregation = congregations.find((item) => item.id === activeAssignment?.congregacion_id)
      const matchesSearch = !searchTerm || `${pastor.nombres} ${pastor.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase()) || (congregation?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && activeAssignment) || (statusFilter === 'vacant' && !activeAssignment)
      const matchesCongregation = congregationFilter === 'all' || activeAssignment?.congregacion_id === congregationFilter

      return matchesSearch && matchesStatus && matchesCongregation
    })
  }, [pastors, activeByPastor, congregations, searchTerm, statusFilter, congregationFilter])

  const filteredAssignments = useMemo(() => {
    return [...assignments].filter((assignment) => {
      const pastor = pastors.find((item) => item.id === assignment.pastor_id)
      const congregation = congregations.find((item) => item.id === assignment.congregacion_id)
      const matchesSearch = !searchTerm || `${pastor?.nombres || ''} ${pastor?.apellidos || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) || (congregation?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && !assignment.fecha_fin) || (statusFilter === 'vacant' && assignment.fecha_fin)
      const matchesCongregation = congregationFilter === 'all' || assignment.congregacion_id === congregationFilter
      return matchesSearch && matchesStatus && matchesCongregation
    })
  }, [assignments, pastors, congregations, searchTerm, statusFilter, congregationFilter])

  async function load() {
    if (!distritoId || !isDistrictLeader) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [pastorResult, congregationResult, assignmentResult, profileResult, resumenResult, licenciaResult, formacionResult, escuelaDominicalResult, damasResult] = await Promise.all([
      supabase
        .from('pastores')
        .select('id, nombres, apellidos, telefono, familia_pastoral, observaciones, distrito_id, persona_id, licencia, fecha_tarjeta_predicador')
        .eq('distrito_id', distritoId)
        .order('apellidos')
        .order('nombres'),
      supabase
        .from('congregaciones')
        .select('id, nombre, ciudad, pastor_id, pastor_nombre, estado, madurez')
        .eq('distrito_id', distritoId)
        .order('nombre'),
      supabase
        .from('asignaciones_pastorales')
        .select('id, pastor_id, congregacion_id, cargo, fecha_inicio, fecha_fin, observaciones')
        .eq('distrito_id', distritoId)
        .order('fecha_inicio', { ascending: false }),
      supabase.from('perfiles_acceso').select('id').eq('codigo', 'pastor').maybeSingle(),
      supabase.rpc('resumen_distrital', { p_distrito_id: distritoId }),
      supabase
        .from('historial_licencias_pastorales')
        .select('id, pastor_id, licencia_anterior, licencia_nueva, fecha, observaciones')
        .order('fecha', { ascending: false }),
      supabase
        .from('formacion_pastoral')
        .select('id, pastor_id, tipo, tipo_otro, nombre, institucion, fecha, observaciones')
        .order('fecha', { ascending: false }),
      supabase.rpc('resumen_escuela_dominical_distrital', { p_distrito_id: distritoId }),
      supabase.rpc('resumen_damas_distrital', { p_distrito_id: distritoId }),
    ])

    if (pastorResult.error || congregationResult.error || assignmentResult.error) {
      setError('No se pudo cargar la gestión pastoral distrital. Intenta nuevamente o contacta al administrador.')
    }

    setPastors(pastorResult.data ?? [])
    setCongregations(congregationResult.data ?? [])
    setAssignments(assignmentResult.data ?? [])
    setPastorProfileId(profileResult.data?.id ?? null)
    setResumenPorCongregacion(new Map((resumenResult.data ?? []).map((row) => [row.congregacion_id, row])))
    setLicenciaHistorial(licenciaResult.data ?? [])
    setFormaciones(formacionResult.data ?? [])
    setResumenEscuelaDominical(escuelaDominicalResult.data ?? [])
    setResumenDamas(damasResult.data ?? [])
    setLoading(false)
  }

  async function createCongregation(event) {
    event.preventDefault()
    if (!distritoId) return
    if (!newCongregation.nombre.trim() || !newCongregation.pastor_nombres.trim() || !newCongregation.pastor_apellidos.trim() || !newCongregation.pastor_email.trim()) {
      setError('Completa el nombre de la congregación, el nombre del pastor y su correo.')
      return
    }
    setCreatingCongregation(true)
    setError(null)
    setNotice(null)
    try {
      const { data: created, error: createError } = await supabase.rpc('crear_congregacion_con_pastor', {
        p_distrito_id: distritoId,
        p_nombre_congregacion: newCongregation.nombre.trim(),
        p_pastor_nombres: newCongregation.pastor_nombres.trim(),
        p_pastor_apellidos: newCongregation.pastor_apellidos.trim(),
        p_pastor_telefono: newCongregation.pastor_telefono.trim() || null,
        p_ciudad: newCongregation.ciudad.trim() || null,
      })
      if (createError) throw new Error(`No se pudo crear la congregación: ${createError.message}`)
      const [{ congregacion_id: newCongregationId, persona_id: newPersonId }] = created

      const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invitar-usuario', {
        body: { personId: newPersonId, profileId: pastorProfileId, congregacionId: newCongregationId, email: newCongregation.pastor_email.trim() },
      })
      if (inviteError) {
        setNotice('La congregación y el pastor quedaron registrados, pero la invitación de acceso no se pudo enviar. Puedes reintentarla luego desde Equipo de trabajo una vez la congregación esté activa.')
      } else if (!inviteData?.ok) {
        setNotice('La congregación y el pastor quedaron registrados, pero la invitación no se confirmó. Revísala desde Equipo de trabajo.')
      } else {
        setNotice(inviteData.invitationSent ? 'Congregación creada. Se envió la invitación de acceso al pastor.' : 'Congregación creada. La cuenta existente del pastor quedó vinculada.')
      }
      setNewCongregation(EMPTY_NEW_CONGREGATION)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreatingCongregation(false)
    }
  }

  useEffect(() => {
    load()
  }, [distritoId, isDistrictLeader])

  const resetForm = () => {
    setEditingPastorId(null)
    setForm(EMPTY_FORM)
  }

  const openPastorEditor = (pastor) => {
    const activeAssignment = activeByPastor.get(pastor.id)
    setEditingPastorId(pastor.id)
    setForm({
      nombres: pastor.nombres || '',
      apellidos: pastor.apellidos || '',
      telefono: pastor.telefono || '',
      familia_pastoral: pastor.familia_pastoral || '',
      congregacion_id: activeAssignment?.congregacion_id || '',
      fecha_inicio: activeAssignment?.fecha_inicio || TODAY,
      cargo: activeAssignment?.cargo || 'Pastor local',
      observaciones: activeAssignment?.observaciones || pastor.observaciones || '',
      fecha_tarjeta_predicador: pastor.fecha_tarjeta_predicador || '',
    })
  }

  async function savePastor(event) {
    event.preventDefault()

    if (!distritoId) {
      setError('No se pudo determinar el distrito del usuario activo.')
      return
    }

    if (!form.nombres.trim() || !form.apellidos.trim() || !form.congregacion_id) {
      setError('Completa nombres, apellidos y congregación.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      if (editingPastorId) {
        const { error: pastorError } = await supabase
          .from('pastores')
          .update({
            nombres: form.nombres.trim(),
            apellidos: form.apellidos.trim(),
            telefono: form.telefono.trim() || null,
            familia_pastoral: form.familia_pastoral.trim() || null,
            observaciones: form.observaciones.trim() || null,
            fecha_tarjeta_predicador: form.fecha_tarjeta_predicador || null,
          })
          .eq('id', editingPastorId)

        if (pastorError) {
          throw new Error(`No se pudo actualizar al pastor: ${pastorError.message}`)
        }

        const { error: assignmentError } = await supabase
          .from('asignaciones_pastorales')
          .update({
            cargo: form.cargo,
            observaciones: form.observaciones.trim() || null,
          })
          .eq('pastor_id', editingPastorId)
          .is('fecha_fin', null)

        if (assignmentError) {
          throw new Error(`El pastor se actualizó, pero la asignación vigente no pudo guardarse: ${assignmentError.message}`)
        }

        const nombreCompleto = `${form.nombres.trim()} ${form.apellidos.trim()}`
        const currentAssignment = activeByPastor.get(editingPastorId)
        if (currentAssignment?.congregacion_id && currentAssignment.congregacion_id !== form.congregacion_id) {
          const { error: transferError } = await supabase.rpc('trasladar_pastor', {
            p_pastor_id: editingPastorId,
            p_congregacion_destino: form.congregacion_id,
            p_fecha: form.fecha_inicio || TODAY,
            p_observaciones: form.observaciones.trim() || null,
          })

          if (transferError) {
            throw new Error(`No se pudo mover la asignación del pastor: ${transferError.message}`)
          }
        }

        await supabase
          .from('congregaciones')
          .update({ pastor_id: editingPastorId, pastor_nombre: nombreCompleto })
          .eq('id', form.congregacion_id)

        setNotice('Pastor actualizado correctamente.')
      } else {
        if (!form.email.trim()) {
          throw new Error('El correo del pastor es obligatorio para darle acceso al sistema.')
        }

        const { data: created, error: registerError } = await supabase.rpc('registrar_pastor_con_acceso', {
          p_congregacion_id: form.congregacion_id,
          p_pastor_nombres: form.nombres.trim(),
          p_pastor_apellidos: form.apellidos.trim(),
          p_pastor_telefono: form.telefono.trim() || null,
          p_cargo: form.cargo,
        })
        if (registerError) throw new Error(`No se pudo registrar el pastor: ${registerError.message}`)
        const [{ persona_id: newPersonId }] = created

        const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invitar-usuario', {
          body: { personId: newPersonId, profileId: pastorProfileId, congregacionId: form.congregacion_id, email: form.email.trim() },
        })
        if (inviteError) {
          setNotice('El pastor quedó registrado y asignado, pero la invitación de acceso no se pudo enviar. Puedes reintentarla desde Equipo de trabajo.')
        } else if (!inviteData?.ok) {
          setNotice('El pastor quedó registrado y asignado, pero la invitación no se confirmó. Revísala desde Equipo de trabajo.')
        } else {
          setNotice(inviteData.invitationSent ? 'Pastor registrado, asignado y con invitación de acceso enviada.' : 'Pastor registrado y asignado. La cuenta existente quedó vinculada.')
        }
      }

      resetForm()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTransfer(event) {
    event.preventDefault()

    if (!transferForm.pastor_id || !transferForm.congregacion_id) {
      setError('Selecciona el pastor y la congregación de destino.')
      return
    }

    if (transferForm.congregacion_id === activeByPastor.get(transferForm.pastor_id)?.congregacion_id) {
      setError('El pastor ya está asignado a la congregación elegida.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const { error: transferError } = await supabase.rpc('trasladar_pastor', {
        p_pastor_id: transferForm.pastor_id,
        p_congregacion_destino: transferForm.congregacion_id,
        p_fecha: transferForm.fecha || TODAY,
        p_observaciones: transferForm.observaciones.trim() || null,
      })

      if (transferError) {
        throw new Error(transferError.message)
      }

      setTransferForm({
        pastor_id: '',
        congregacion_id: '',
        fecha: TODAY,
        observaciones: '',
      })
      setNotice('Traslado registrado correctamente.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function ascenderLicencia(event) {
    event.preventDefault()

    if (!licenciaForm.pastor_id) {
      setError('Selecciona el pastor a ascender.')
      return
    }

    setAscendiendoLicencia(true)
    setError(null)
    setNotice(null)

    try {
      const { data: nuevaLicencia, error: licenciaError } = await supabase.rpc('ascender_licencia_pastor', {
        p_pastor_id: licenciaForm.pastor_id,
        p_fecha: licenciaForm.fecha || TODAY,
        p_observaciones: licenciaForm.observaciones.trim() || null,
      })

      if (licenciaError) throw new Error(licenciaError.message)

      setLicenciaForm({ pastor_id: '', fecha: TODAY, observaciones: '' })
      setNotice(`Ascenso registrado: ahora tiene ${LICENCIA_LABELS[nuevaLicencia] || nuevaLicencia}.`)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAscendiendoLicencia(false)
    }
  }

  async function addFormacion(event) {
    event.preventDefault()

    if (!formacionForm.pastor_id || !formacionForm.nombre.trim()) {
      setError('Selecciona el pastor y el nombre de la preparación.')
      return
    }
    if (formacionForm.tipo === 'otro' && !formacionForm.tipo_otro.trim()) {
      setError('Especifica el tipo de preparación en "Otro".')
      return
    }

    setSavingFormacion(true)
    setError(null)
    setNotice(null)

    try {
      const { error: formacionError } = await supabase.from('formacion_pastoral').insert({
        pastor_id: formacionForm.pastor_id,
        tipo: formacionForm.tipo,
        tipo_otro: formacionForm.tipo === 'otro' ? formacionForm.tipo_otro.trim() : null,
        nombre: formacionForm.nombre.trim(),
        institucion: formacionForm.institucion.trim() || null,
        fecha: formacionForm.fecha || null,
        observaciones: formacionForm.observaciones.trim() || null,
      })

      if (formacionError) throw new Error(formacionError.message)

      setFormacionForm(EMPTY_FORMACION)
      setNotice('Preparación registrada correctamente.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingFormacion(false)
    }
  }

  async function updateMadurez(congregacionId, madurez) {
    setError(null)
    setNotice(null)
    const { error: updateError } = await supabase.from('congregaciones').update({ madurez }).eq('id', congregacionId)
    if (updateError) {
      setError('No se pudo actualizar la madurez de la sede.')
      return
    }
    setNotice('Madurez de la sede actualizada.')
    await load()
  }

  async function deleteFormacion(id) {
    setError(null)
    setNotice(null)
    const { error: deleteError } = await supabase.from('formacion_pastoral').delete().eq('id', id)
    if (deleteError) {
      setError('No se pudo eliminar el registro de preparación.')
      return
    }
    setNotice('Registro de preparación eliminado.')
    await load()
  }

  if (roleLoading || loading) {
    return <div className="module-loading" role="status"><span className="loading-dot" />Cargando gestión pastoral distrital...</div>
  }

  if (!isDistrictLeader) {
    return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Este módulo es exclusivo del líder distrital.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-accent mb-2">Administración distrital</p>
        <h1 className="text-2xl font-semibold">Gestión pastoral</h1>
        <p className="text-sm text-secondary mt-1">Controla pastores, asignaciones, traslados y trayectoria dentro del distrito.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {notice && <p role="status" className="text-sm text-success bg-success-bg rounded p-3">{notice}</p>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>Total</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{stats.totalPastors}</p>
          <p className="text-sm text-secondary mt-1">Pastores registrados</p>
        </div>

        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>Activos</span>
            <UserRoundCheck className="w-4 h-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{stats.activePastorCount}</p>
          <p className="text-sm text-secondary mt-1">Asignaciones vigentes</p>
        </div>

        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>Congregaciones</span>
            <Building2 className="w-4 h-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{stats.congregationsWithPastors}</p>
          <p className="text-sm text-secondary mt-1">Con pastor asignado</p>
        </div>

        <div className="stat-tile">
          <div className="flex items-center justify-between text-secondary text-xs uppercase tracking-wide">
            <span>Vacantes</span>
            <CircleDashed className="w-4 h-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{stats.vacantCongregations}</p>
          <p className="text-sm text-secondary mt-1">Sin pastor actual</p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">Congregaciones del distrito</h2>
          <p className="text-sm text-secondary mt-1">Clasificación de madurez de la sede (Misión Nacional / Lugar de Predicación / Iglesia Local).</p>
        </div>
        {congregations.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aún no hay congregaciones registradas en tu distrito.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="font-normal px-5 py-3">Congregación</th>
                  <th className="font-normal px-5 py-3">Ciudad</th>
                  <th className="font-normal px-5 py-3">Madurez de la sede</th>
                </tr>
              </thead>
              <tbody>
                {congregations.map((congregation) => (
                  <tr key={congregation.id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{congregation.nombre}</td>
                    <td className="px-5 py-3 text-secondary">{congregation.ciudad || '—'}</td>
                    <td className="px-5 py-3">
                      <select className="input-field" value={congregation.madurez || 'lugar_prediccion'} onChange={(event) => updateMadurez(congregation.id, event.target.value)}>
                        {Object.entries(MADUREZ_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium">Escuela Dominical por congregación</h2>
            <p className="text-sm text-secondary mt-1">Comités administrados localmente, consolidado a nivel distrital.</p>
          </div>
          {resumenEscuelaDominical.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay datos de Escuela Dominical en tu distrito.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Clases</th><th className="font-normal px-4 py-2.5">Niños</th><th className="font-normal px-4 py-2.5">Maestros</th><th className="font-normal px-4 py-2.5">Lecciones (30d)</th></tr></thead>
                <tbody>
                  {resumenEscuelaDominical.map((item) => (
                    <tr key={item.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                      <td className="px-4 py-2.5">{item.clases_activas}</td>
                      <td className="px-4 py-2.5">{item.ninos_activos}</td>
                      <td className="px-4 py-2.5">{item.maestros_activos}</td>
                      <td className="px-4 py-2.5">{item.lecciones_ultimo_mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-medium">Damas Dorcas por congregación</h2>
            <p className="text-sm text-secondary mt-1">Comités administrados localmente, consolidado a nivel distrital.</p>
          </div>
          {resumenDamas.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aún no hay datos de Damas Dorcas en tu distrito.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">Congregación</th><th className="font-normal px-4 py-2.5">Beneficiarias</th><th className="font-normal px-4 py-2.5">Actividades (30d)</th></tr></thead>
                <tbody>
                  {resumenDamas.map((item) => (
                    <tr key={item.congregacion_id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                      <td className="px-4 py-2.5">{item.beneficiarias_activas}</td>
                      <td className="px-4 py-2.5">{item.actividades_ultimo_mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <form onSubmit={createCongregation} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end border-2 border-accent/30">
        <div className="sm:col-span-2 lg:col-span-5">
          <h2 className="font-medium flex items-center gap-2"><Building2 className="w-4 h-4 text-accent" />Registrar nueva congregación</h2>
          <p className="text-xs text-secondary mt-1">Crea la congregación en tu distrito y da acceso a su primer pastor local. Queda pendiente de aprobación hasta que la actives desde Aprobaciones.</p>
        </div>
        <label className="text-sm">Nombre de la congregación<input required className="input-field mt-1.5" value={newCongregation.nombre} onChange={(event) => setNewCongregation({ ...newCongregation, nombre: event.target.value })} /></label>
        <label className="text-sm">Ciudad/Municipio<input className="input-field mt-1.5" value={newCongregation.ciudad} onChange={(event) => setNewCongregation({ ...newCongregation, ciudad: event.target.value })} /></label>
        <label className="text-sm">Nombres del pastor<input required className="input-field mt-1.5" value={newCongregation.pastor_nombres} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_nombres: event.target.value })} /></label>
        <label className="text-sm">Apellidos del pastor<input required className="input-field mt-1.5" value={newCongregation.pastor_apellidos} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_apellidos: event.target.value })} /></label>
        <label className="text-sm">Teléfono del pastor<input className="input-field mt-1.5" value={newCongregation.pastor_telefono} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_telefono: event.target.value })} /></label>
        <label className="text-sm">Correo del pastor<input required type="email" className="input-field mt-1.5" value={newCongregation.pastor_email} onChange={(event) => setNewCongregation({ ...newCongregation, pastor_email: event.target.value })} /></label>
        <button disabled={creatingCongregation} className="btn-primary lg:col-span-5"><Plus className="w-4 h-4" />{creatingCongregation ? 'Creando...' : 'Crear congregación e invitar pastor'}</button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <form onSubmit={savePastor} className="card p-5 grid sm:grid-cols-2 gap-3 items-end">
          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            <h2 className="font-medium">{editingPastorId ? 'Editar pastor' : 'Registrar pastor'}</h2>
            {editingPastorId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancelar edición
              </button>
            )}
          </div>

          <label className="text-sm">
            Nombres
            <input
              required
              className="input-field mt-1.5"
              value={form.nombres}
              onChange={(event) => setForm({ ...form, nombres: event.target.value })}
            />
          </label>

          <label className="text-sm">
            Apellidos
            <input
              required
              className="input-field mt-1.5"
              value={form.apellidos}
              onChange={(event) => setForm({ ...form, apellidos: event.target.value })}
            />
          </label>

          <label className="text-sm">
            Teléfono
            <input
              className="input-field mt-1.5"
              value={form.telefono}
              onChange={(event) => setForm({ ...form, telefono: event.target.value })}
            />
          </label>

          <label className="text-sm">
            Familia pastoral
            <input
              className="input-field mt-1.5"
              placeholder="Cónyuge e hijos"
              value={form.familia_pastoral}
              onChange={(event) => setForm({ ...form, familia_pastoral: event.target.value })}
            />
          </label>

          {!editingPastorId && (
            <label className="text-sm">
              Correo (para invitar acceso)
              <input
                required
                type="email"
                className="input-field mt-1.5"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
          )}

          {editingPastorId && (
            <label className="text-sm">
              Tarjeta de predicador (obreros sin licencia)
              <input
                type="date"
                className="input-field mt-1.5"
                value={form.fecha_tarjeta_predicador}
                onChange={(event) => setForm({ ...form, fecha_tarjeta_predicador: event.target.value })}
              />
            </label>
          )}

          <label className="text-sm">
            Congregación
            <select
              required
              className="input-field mt-1.5"
              value={form.congregacion_id}
              onChange={(event) => setForm({ ...form, congregacion_id: event.target.value })}
            >
              <option value="">Seleccionar...</option>
              {congregations
                .filter((congregation) => !congregation.pastor_id || congregation.id === form.congregacion_id)
                .map((congregation) => (
                  <option key={congregation.id} value={congregation.id}>
                    {congregation.nombre}
                  </option>
                ))}
            </select>
            {!editingPastorId && (
              <span className="block text-xs text-muted mt-1">Solo se muestran congregaciones sin pastor asignado.</span>
            )}
          </label>

          <label className="text-sm">
            Cargo
            <select
              className="input-field mt-1.5"
              value={form.cargo}
              onChange={(event) => setForm({ ...form, cargo: event.target.value })}
            >
              {CARGO_OPTIONS.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Desde
            <input
              required
              type="date"
              className="input-field mt-1.5"
              value={form.fecha_inicio}
              onChange={(event) => setForm({ ...form, fecha_inicio: event.target.value })}
            />
          </label>

          <button disabled={saving} className="btn-primary sm:col-span-2">
            {editingPastorId ? <PencilLine className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Guardando...' : editingPastorId ? 'Guardar cambios' : 'Registrar pastor'}
          </button>

          <label className="text-sm sm:col-span-2">
            Observaciones
            <textarea
              className="input-field mt-1.5"
              value={form.observaciones}
              onChange={(event) => setForm({ ...form, observaciones: event.target.value })}
            />
          </label>
        </form>

        <form onSubmit={handleTransfer} className="card p-5 grid gap-3 items-end">
          <h2 className="font-medium">Trasladar pastor</h2>

          <label className="text-sm">
            Pastor
            <select
              required
              className="input-field mt-1.5"
              value={transferForm.pastor_id}
              onChange={(event) =>
                setTransferForm({
                  ...transferForm,
                  pastor_id: event.target.value,
                  congregacion_id: '',
                })
              }
            >
              <option value="">Seleccionar...</option>
              {pastors.map((pastor) => (
                <option key={pastor.id} value={pastor.id}>
                  {pastor.nombres} {pastor.apellidos}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Nueva congregación
            <select
              required
              className="input-field mt-1.5"
              value={transferForm.congregacion_id}
              onChange={(event) => setTransferForm({ ...transferForm, congregacion_id: event.target.value })}
            >
              <option value="">Seleccionar...</option>
              {congregations
                .filter((congregation) => !congregation.pastor_id || congregation.pastor_id === transferForm.pastor_id)
                .map((congregation) => (
                  <option key={congregation.id} value={congregation.id}>
                    {congregation.nombre}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm">
            Fecha del traslado
            <input
              required
              type="date"
              className="input-field mt-1.5"
              value={transferForm.fecha}
              onChange={(event) => setTransferForm({ ...transferForm, fecha: event.target.value })}
            />
          </label>

          <label className="text-sm">
            Observaciones
            <textarea
              className="input-field mt-1.5"
              value={transferForm.observaciones}
              onChange={(event) => setTransferForm({ ...transferForm, observaciones: event.target.value })}
            />
          </label>

          <button disabled={saving} className="btn-secondary">
            <ArrowRightLeft className="w-4 h-4" />
            {saving ? 'Trasladando...' : 'Confirmar traslado'}
          </button>
        </form>
      </div>

      <form onSubmit={ascenderLicencia} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div className="sm:col-span-2 lg:col-span-4">
          <h2 className="font-medium flex items-center gap-2"><GraduationCap className="w-4 h-4 text-accent" />Ascender licencia ministerial</h2>
          <p className="text-xs text-secondary mt-1">Escalafón de la IPUC: Obrero → Licencia Local → Licencia General → Ordenación Ministerial. Un nivel a la vez.</p>
        </div>
        <label className="text-sm lg:col-span-2">
          Pastor
          <select
            required
            className="input-field mt-1.5"
            value={licenciaForm.pastor_id}
            onChange={(event) => setLicenciaForm({ ...licenciaForm, pastor_id: event.target.value })}
          >
            <option value="">Seleccionar...</option>
            {pastors.filter((pastor) => LICENCIA_SIGUIENTE[pastor.licencia]).map((pastor) => (
              <option key={pastor.id} value={pastor.id}>
                {pastor.nombres} {pastor.apellidos} — {LICENCIA_LABELS[pastor.licencia]} → {LICENCIA_LABELS[LICENCIA_SIGUIENTE[pastor.licencia]]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Fecha
          <input
            required
            type="date"
            className="input-field mt-1.5"
            value={licenciaForm.fecha}
            onChange={(event) => setLicenciaForm({ ...licenciaForm, fecha: event.target.value })}
          />
        </label>
        <label className="text-sm">
          Observaciones
          <input
            className="input-field mt-1.5"
            placeholder="Evaluación, Consistorio de Ancianos..."
            value={licenciaForm.observaciones}
            onChange={(event) => setLicenciaForm({ ...licenciaForm, observaciones: event.target.value })}
          />
        </label>
        <button disabled={ascendiendoLicencia} className="btn-primary lg:col-span-4">
          <GraduationCap className="w-4 h-4" />
          {ascendiendoLicencia ? 'Registrando...' : 'Registrar ascenso'}
        </button>
      </form>

      <form onSubmit={addFormacion} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div className="sm:col-span-2 lg:col-span-6">
          <h2 className="font-medium flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent" />Preparación académica y ministerial</h2>
          <p className="text-xs text-secondary mt-1">Títulos, cursos, diplomados y demás formación de cada pastor del distrito.</p>
        </div>
        <label className="text-sm lg:col-span-2">
          Pastor
          <select
            required
            className="input-field mt-1.5"
            value={formacionForm.pastor_id}
            onChange={(event) => setFormacionForm({ ...formacionForm, pastor_id: event.target.value })}
          >
            <option value="">Seleccionar...</option>
            {pastors.map((pastor) => (
              <option key={pastor.id} value={pastor.id}>{pastor.nombres} {pastor.apellidos}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Tipo
          <select
            className="input-field mt-1.5"
            value={formacionForm.tipo}
            onChange={(event) => setFormacionForm({ ...formacionForm, tipo: event.target.value })}
          >
            {Object.entries(TIPO_FORMACION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {formacionForm.tipo === 'otro' && (
          <label className="text-sm">
            Especifica el tipo
            <input required className="input-field mt-1.5" value={formacionForm.tipo_otro} onChange={(event) => setFormacionForm({ ...formacionForm, tipo_otro: event.target.value })} />
          </label>
        )}
        <label className="text-sm">
          Nombre
          <input required placeholder="Ej: Teología Pastoral" className="input-field mt-1.5" value={formacionForm.nombre} onChange={(event) => setFormacionForm({ ...formacionForm, nombre: event.target.value })} />
        </label>
        <label className="text-sm">
          Institución
          <input className="input-field mt-1.5" value={formacionForm.institucion} onChange={(event) => setFormacionForm({ ...formacionForm, institucion: event.target.value })} />
        </label>
        <label className="text-sm">
          Fecha
          <input type="date" className="input-field mt-1.5" value={formacionForm.fecha} onChange={(event) => setFormacionForm({ ...formacionForm, fecha: event.target.value })} />
        </label>
        <button disabled={savingFormacion} className="btn-primary lg:col-span-6">
          <Plus className="w-4 h-4" />
          {savingFormacion ? 'Guardando...' : 'Agregar preparación'}
        </button>
      </form>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-medium">Pastores y trayectoria</h2>
              <p className="text-sm text-secondary mt-1">Asignaciones vigentes e históricas del distrito.</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-secondary" />
                <input
                  className="input-field pl-9 min-w-[220px]"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar pastor o congregación"
                />
              </div>

              <select className="input-field min-w-[180px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="vacant">Históricos / sin asignación</option>
              </select>

              <select className="input-field min-w-[180px]" value={congregationFilter} onChange={(event) => setCongregationFilter(event.target.value)}>
                <option value="all">Todas las congregaciones</option>
                {congregations.map((congregation) => (
                  <option key={congregation.id} value={congregation.id}>
                    {congregation.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredPastors.map((pastor) => {
              const activeAssignment = activeByPastor.get(pastor.id)
              const congregation = congregations.find((item) => item.id === activeAssignment?.congregacion_id)
              const isAssigned = Boolean(activeAssignment)
              const resumenCongregacion = congregation ? resumenPorCongregacion.get(congregation.id) : null

              return (
                <article key={pastor.id} className="border border-border rounded-lg bg-surface-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-ink">{pastor.nombres} {pastor.apellidos}</h3>
                      <p className="text-xs text-secondary mt-1">{congregation?.nombre || 'Sin congregación asignada'}{congregation?.ciudad ? ` · ${congregation.ciudad}` : ''}</p>
                      <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-accent-bg text-accent">{LICENCIA_LABELS[pastor.licencia] || 'Obrero'}</span>
                      {pastor.licencia === 'obrero' && pastor.fecha_tarjeta_predicador && (
                        <span className="inline-block mt-1 ml-1.5 text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-surface-2 text-secondary">Tarjeta de predicador: {formatDate(pastor.fecha_tarjeta_predicador)}</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${isAssigned ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'}`}>
                        {isAssigned ? 'Activo' : 'Sin asignación'}
                      </span>
                      {!pastor.persona_id && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-danger-bg text-danger">Sin acceso vinculado</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-secondary">
                    {pastor.telefono && <p>Tel: {pastor.telefono}</p>}
                    {pastor.familia_pastoral && <p>Familia: {pastor.familia_pastoral}</p>}
                    {activeAssignment && <p>Cargo: {activeAssignment.cargo}</p>}
                    {resumenCongregacion && (
                      <p>{resumenCongregacion.personas_activas} personas activas · {resumenCongregacion.personas_nuevas_3m} nuevas (3 meses)</p>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button type="button" className="btn-secondary flex-1" onClick={() => openPastorEditor(pastor)}>
                      <PencilLine className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-primary flex-1"
                      onClick={() => setTransferForm({ pastor_id: pastor.id, congregacion_id: '', fecha: TODAY, observaciones: '' })}
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Trasladar
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {filteredPastors.length === 0 && (
            <p className="mt-4 text-sm text-muted">No hay pastores que coincidan con los filtros actuales.</p>
          )}
        </div>

        <div className="border-t border-border">
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <MapPinned className="w-4 h-4 text-accent" />
              Historial de asignaciones
            </div>

            {filteredAssignments.length ? (
              <div className="space-y-3">
                {filteredAssignments.map((assignment) => {
                  const pastor = pastors.find((item) => item.id === assignment.pastor_id)
                  const congregation = congregations.find((item) => item.id === assignment.congregacion_id)
                  const isActive = !assignment.fecha_fin

                  return (
                    <div key={assignment.id} className="flex items-start gap-3 border border-border rounded-lg bg-surface-1 p-3">
                      <ArrowRightLeft className="w-4 h-4 text-accent mt-1" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {pastor ? `${pastor.nombres} ${pastor.apellidos}` : 'Pastor'}
                          </p>
                          <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${isActive ? 'bg-success-bg text-success' : 'bg-surface-2 text-secondary'}`}>
                            {isActive ? 'Actual' : 'Histórico'}
                          </span>
                        </div>
                        <p className="text-xs text-secondary mt-1">
                          {assignment.cargo} · {congregation?.nombre || 'Congregación'}
                        </p>
                        <p className="text-xs text-secondary mt-1">
                          Desde {formatDate(assignment.fecha_inicio)}
                          {assignment.fecha_fin ? ` · Hasta ${formatDate(assignment.fecha_fin)}` : ' · Vigente'}
                        </p>
                        {assignment.observaciones && (
                          <p className="text-xs text-muted mt-1">Obs: {assignment.observaciones}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="p-4 text-sm text-muted">Aún no hay trayectoria pastoral registrada con los filtros actuales.</p>
            )}
          </div>
        </div>

        <div className="border-t border-border">
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <GraduationCap className="w-4 h-4 text-accent" />
              Historial de licencias ministeriales
            </div>

            {licenciaHistorial.length ? (
              <div className="space-y-3">
                {licenciaHistorial.map((item) => {
                  const pastor = pastors.find((entry) => entry.id === item.pastor_id)
                  return (
                    <div key={item.id} className="flex items-start gap-3 border border-border rounded-lg bg-surface-1 p-3">
                      <GraduationCap className="w-4 h-4 text-accent mt-1" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{pastor ? `${pastor.nombres} ${pastor.apellidos}` : 'Pastor'}</p>
                        <p className="text-xs text-secondary mt-1">{LICENCIA_LABELS[item.licencia_anterior] || item.licencia_anterior} → {LICENCIA_LABELS[item.licencia_nueva] || item.licencia_nueva}</p>
                        <p className="text-xs text-secondary mt-1">{formatDate(item.fecha)}</p>
                        {item.observaciones && <p className="text-xs text-muted mt-1">Obs: {item.observaciones}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="p-4 text-sm text-muted">Aún no hay ascensos de licencia registrados.</p>
            )}
          </div>
        </div>

        <div className="border-t border-border">
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <BookOpen className="w-4 h-4 text-accent" />
              Preparación académica y ministerial
            </div>

            {formaciones.length ? (
              <div className="space-y-3">
                {formaciones.map((item) => {
                  const pastor = pastors.find((entry) => entry.id === item.pastor_id)
                  const tipoLabel = item.tipo === 'otro' ? (item.tipo_otro || 'Otro') : TIPO_FORMACION_LABELS[item.tipo] || item.tipo
                  return (
                    <div key={item.id} className="flex items-start gap-3 border border-border rounded-lg bg-surface-1 p-3">
                      <BookOpen className="w-4 h-4 text-accent mt-1" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{pastor ? `${pastor.nombres} ${pastor.apellidos}` : 'Pastor'}</p>
                          <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-accent-bg text-accent">{tipoLabel}</span>
                        </div>
                        <p className="text-xs text-secondary mt-1">{item.nombre}{item.institucion ? ` · ${item.institucion}` : ''}</p>
                        {item.fecha && <p className="text-xs text-secondary mt-1">{formatDate(item.fecha)}</p>}
                        {item.observaciones && <p className="text-xs text-muted mt-1">Obs: {item.observaciones}</p>}
                      </div>
                      <button type="button" onClick={() => deleteFormacion(item.id)} className="text-muted hover:text-danger" aria-label="Eliminar registro de preparación">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="p-4 text-sm text-muted">Aún no hay preparación académica registrada.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
