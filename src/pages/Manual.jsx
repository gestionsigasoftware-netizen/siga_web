import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { useMiRol } from '../hooks/useMiRol'

const MANUAL = {
  local: [
    {
      seccion: 'Tu día a día',
      items: [
        { titulo: 'Resumen', texto: 'Punto de partida diario: asistencia reciente, alertas pastorales (familias sin asociar, sin bautismo, sin asistencia reciente, comités sin integrantes), pirámide poblacional, ciclo de vida espiritual, proyección de crecimiento a 12 meses y los próximos cumpleaños de tu congregación.' },
      ],
    },
    {
      seccion: 'Censo y familia',
      items: [
        { titulo: 'Feligresía', texto: 'El censo completo de tu congregación. Registra personas, arma familias, marca bautismo/sellado, revisa comités y seguimiento pastoral. La pestaña "Traslados" gestiona cuando alguien llega de otra congregación o se va a otra — el historial completo viaja con la persona.' },
        { titulo: 'Red de Familias', texto: 'Casos de acompañamiento y restablecimiento familiar: registra el caso, sus visitas domiciliarias y las actividades de seguimiento.' },
      ],
    },
    {
      seccion: 'Ruta evangelística',
      items: [
        { titulo: 'Misiones y Evangelismo', texto: 'Zonas de trabajo territorial y el embudo real de evangelismo: Uno Más → REFAM → Bautizado. Registra visitas y discipulado por zona.' },
        { titulo: 'Amigos en ruta', texto: 'Seguimiento de personas en proceso de integración a la congregación, organizadas por etapas que tú mismo configuras (ej. "Primera visita", "Bautizado").' },
      ],
    },
    {
      seccion: 'Comités',
      items: [
        { titulo: 'Escuela Dominical, Música, Educación Artística, Educación Teológica', texto: 'Formación estructurada: crea grupos o clases, registra sesiones y la asistencia individual de cada integrante a lo largo del tiempo.' },
        { titulo: 'Damas Dorcas, Conquistadores Pentecostales', texto: 'Actividades con asistencia: registra a las beneficiarias o miembros y cada actividad realizada, con quién asistió.' },
        { titulo: 'Obra Carcelaria, Obra Social', texto: 'Casos de necesidad con seguimiento: registra a la persona, el tipo de necesidad, y cada ayuda o visita entregada en el tiempo — para poder ver la frecuencia real de apoyo por caso.' },
        { titulo: 'Misión Juvenil', texto: 'Censo de estudiantes alcanzados en instituciones educativas, sus grupos y las lecciones dictadas.' },
      ],
    },
    {
      seccion: 'Administración de tu congregación (solo el pastor)',
      items: [
        { titulo: 'Equipo de trabajo', texto: 'Da o retira acceso web a personas de tu censo — eliges a la persona, su correo, y el perfil de acceso o módulo que va a operar.' },
        { titulo: 'Módulos y actividades', texto: 'Crea, renombra y activa/desactiva los módulos de tu congregación (Ujieres, Evangelismo, etc.) y sus tipos de actividad.' },
        { titulo: 'Configuración local', texto: 'Catálogos propios de tu congregación (categorías demográficas, etapas de seguimiento de Amigos, tipos y cargos de comité) y las preferencias de alertas.' },
        { titulo: 'Auditoría de Feligresía', texto: 'Historial de todos los cambios hechos en el censo, quién los hizo y cuándo.' },
      ],
    },
  ],
  distrital: [
    {
      seccion: 'Tu día a día',
      items: [
        { titulo: 'Resumen', texto: 'Consolidado de todo tu distrito: comparativa entre congregaciones, semáforo de salud (asistencia, bautismo, comités, alertas), y pirámide poblacional distrital.' },
      ],
    },
    {
      seccion: 'Gestión pastoral',
      items: [
        { titulo: 'Registrar nueva congregación', texto: 'Da de alta una congregación nueva de tu distrito junto con su primer pastor, en un solo paso — incluye enviarle la invitación de acceso real.' },
        { titulo: 'Directiva distrital', texto: 'Registra quién ocupa cada uno de los 5 cargos de la junta distrital (Supervisor, Secretario, Tesorero, Presbíteros, Veedor).' },
        { titulo: 'Comités por congregación', texto: 'Consolidado de los 10 comités (Escuela Dominical, Damas Dorcas, Música, etc.) por cada congregación de tu distrito, incluyendo Misión Juvenil y Red de Familias.' },
        { titulo: 'Formación y traslados pastorales', texto: 'Registra la formación ministerial de tus pastores, gestiona traslados de pastores entre congregaciones, y usa "Finalizar asignación pastoral" cuando un pastor se retira sin ir a otra congregación conocida.' },
      ],
    },
    {
      seccion: 'Supervisión',
      items: [
        { titulo: 'Auditoría de Feligresía', texto: 'Cambios en el censo de cualquier congregación de tu distrito.' },
        { titulo: 'Impacto Misionero', texto: 'Consolidado de Obra Carcelaria, Misión Juvenil y Obra Social a nivel distrital.' },
        { titulo: 'Aprobaciones', texto: 'Activa las congregaciones nuevas de tu distrito que están pendientes de aprobación.' },
      ],
    },
  ],
  nacional: [
    {
      seccion: 'Tu día a día',
      items: [
        { titulo: 'Resumen', texto: 'Vista país: población total, tendencias, pirámide poblacional y ciclo de vida espiritual a nivel nacional.' },
      ],
    },
    {
      seccion: 'Visión país',
      items: [
        { titulo: 'Gestión Pastoral Nacional', texto: 'Escalafón ministerial (Obrero → Licencia Local → Licencia General → Ordenación) de los 36 distritos, congregaciones y cargos distritales vacantes. Desde aquí también se otorga acceso a un nuevo líder distrital (o nacional, si eres super_admin).' },
        { titulo: 'Comités Nacional', texto: 'Los 10 comités reales de la IPUC, consolidados por distrito, para todo el país.' },
        { titulo: 'Catálogo de distritos', texto: 'Crea y edita distritos, y reasigna congregaciones de un distrito a otro cuando sea necesario.' },
        { titulo: 'Impacto Misionero', texto: 'Consolidado nacional de Obra Carcelaria, Misión Juvenil y Obra Social.' },
      ],
    },
    {
      seccion: 'Supervisión',
      items: [
        { titulo: 'Auditoría de Feligresía', texto: 'Cambios en el censo de cualquier congregación del país.' },
        { titulo: 'Aprobaciones', texto: 'Igual que distrital, pero para todo el país.' },
      ],
    },
  ],
}

const HERRAMIENTAS_GENERALES = [
  { titulo: 'Reportes', texto: 'Lectura de asistencia y actividad por periodo, con exportación a CSV, Excel y PDF con el membrete oficial.' },
  { titulo: 'Soporte', texto: 'Reporta un problema técnico o algo que no funcione — llega directo al equipo que mantiene SIGAP.' },
  { titulo: 'Solicitudes internas', texto: 'Comunicación formal entre niveles (local con su distrital, distrital con nacional) — no es un chat, cada solicitud queda con estado hasta resolverse.' },
  { titulo: 'Preferencias personales', texto: 'Formato de fecha, qué notificaciones recibir, y el estado de tu propia cuenta.' },
]

const NIVELES = [
  { key: 'local', label: 'Nivel local' },
  { key: 'distrital', label: 'Nivel distrital' },
  { key: 'nacional', label: 'Nivel nacional' },
]

export default function Manual() {
  const { rolPrincipal } = useMiRol()
  const [nivelActivo, setNivelActivo] = useState(rolPrincipal?.nivel === 'distrital' ? 'distrital' : (rolPrincipal?.nivel === 'nacional' || rolPrincipal?.nivel === 'super_admin') ? 'nacional' : 'local')

  const secciones = MANUAL[nivelActivo] ?? MANUAL.local

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">Documentación</p>
        <h1 className="section-title">Manual de uso</h1>
        <p className="text-sm text-secondary mt-0.5">Qué hace cada pantalla de SIGAP, organizado por nivel — local, distrital y nacional.</p>
      </header>

      <nav className="flex gap-1 border-b border-border overflow-x-auto" aria-label="Nivel del manual" role="tablist">
        {NIVELES.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={nivelActivo === item.key} onClick={() => setNivelActivo(item.key)} className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 ${nivelActivo === item.key ? 'border-accent text-accent font-medium' : 'border-transparent text-secondary'}`}>{item.label}</button>
        ))}
      </nav>

      <div className="flex flex-col gap-8">
        {secciones.map((grupo) => (
          <section key={grupo.seccion}>
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted mb-3">{grupo.seccion}</h2>
            <div className="grid gap-3">
              {grupo.items.map((item) => (
                <div key={item.titulo} className="card p-5">
                  <h3 className="font-medium">{item.titulo}</h3>
                  <p className="text-sm text-secondary leading-6 mt-2">{item.texto}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section>
          <h2 className="text-xs uppercase tracking-[0.14em] text-muted mb-3">Herramientas generales (todos los niveles)</h2>
          <div className="grid gap-3">
            {HERRAMIENTAS_GENERALES.map((item) => (
              <div key={item.titulo} className="card p-5">
                <h3 className="font-medium">{item.titulo}</h3>
                <p className="text-sm text-secondary leading-6 mt-2">{item.texto}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <p className="text-xs text-muted flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> ¿Algo no funciona como se describe aquí? Repórtalo desde Soporte.</p>
    </div>
  )
}
