import { BookOpen } from 'lucide-react'
import { useMiRol } from '../hooks/useMiRol'

// Cada entrada tiene "queEs" (para qué sirve, en lenguaje llano) y "como"
// (uno o mas flujos reales, cada uno con pasos concretos usando las
// etiquetas literales de botones/pestañas/campos que existen en el
// codigo -- no descripciones genericas -- para que sobreviva una
// revision contra el codigo real mas adelante.
const MANUAL = {
  local: [
    {
      seccion: 'Tu día a día',
      items: [
        {
          titulo: 'Resumen',
          queEs: 'Tu punto de partida diario: asistencia reciente, alertas pastorales (familias sin asociar, sin bautismo, sin asistencia reciente, comités sin integrantes), pirámide poblacional, ciclo de vida espiritual, proyección de crecimiento a 12 meses y los próximos cumpleaños de tu congregación.',
          como: [
            { accion: 'Revisarlo cada día', pasos: ['Entra y mira la tarjeta "Alertas activas" — un número en rojo significa que algo necesita tu atención.', 'Clic en una alerta para ir directo a la persona o comité afectado.', 'Revisa la pirámide poblacional y el ciclo de vida espiritual para entender la composición real de tu congregación, no solo el total.'] },
          ],
        },
      ],
    },
    {
      seccion: 'Censo y familia',
      items: [
        {
          titulo: 'Feligresía',
          queEs: 'El censo completo de tu congregación, en 7 pestañas: Población, Familias, Comités, Seguimiento pastoral, Traslados, Evolución e Informe trimestral. Cada persona activa, apartada, bautizada o trasladada vive aquí.',
          como: [
            { accion: 'Registrar una persona nueva', pasos: ['En la pestaña "Población", clic en "Registrar persona".', 'Llena nombres, apellidos, fecha de nacimiento, género, estado civil y demás datos.', 'Guarda — si ya cumple los requisitos de edad/género de algún comité, verás la etiqueta "Sugerido: [comité]" en su fila.'] },
            { accion: 'Trasladar a alguien a otra congregación', pasos: ['Abre la ficha de la persona en Población.', 'Ve a "Trasladar a otra congregación".', 'Busca la congregación destino por nombre o ciudad y confirma — el historial completo viaja con la persona, no se pierde.'] },
          ],
        },
        {
          titulo: 'Red de Familias',
          queEs: 'El área de trabajo familiar (DEFAM): convierte el contexto que ya existe en Feligresía en acompañamiento medible. No crea un censo propio de personas — abre "casos" sobre familias/personas que ya están registradas, programa visitas domiciliarias y registra talleres o campañas.',
          como: [
            { accion: 'Abrir un acompañamiento', pasos: ['Pestaña "Acompañamiento" → elige la Familia (y opcionalmente la Persona relacionada y el Responsable).', 'Elige la Necesidad (Acompañamiento solicitado, Visita pendiente, Orientación, Integración, Reactivación o Necesidad identificada) y la Prioridad.', 'Define el "Próximo contacto" y clic en "Registrar acompañamiento".', 'Cuando se resuelva, clic en "Cerrar caso" — es definitivo, si la familia vuelve a necesitar seguimiento se abre uno nuevo.'] },
            { accion: 'Programar una visita domiciliaria', pasos: ['Pestaña "Visitas" → llena Familia, Fecha, Responsable y Motivo.', 'Clic en "Programar visita".', 'Cuando se realice, márcala con "Marcar realizada" (o "Cancelar" si no se hizo).'] },
            { accion: 'Registrar un taller o campaña familiar', pasos: ['Pestaña "Actividades" → llena Nombre, Tipo (Taller, Escuela de familia, Campaña, Conferencia, Visita grupal), Fecha, Responsable, Asistentes y Familias alcanzadas.', 'Clic en "Registrar actividad".'] },
          ],
        },
      ],
    },
    {
      seccion: 'Ruta evangelística',
      items: [
        {
          titulo: 'Misiones y Evangelismo',
          queEs: 'El tablero central de la Ruta Evangelística: el camino real de una persona desde el primer contacto hasta convertirse en feligrés formado, en 6 estaciones — Métodos → Uno Más → BIS → REFAM → ESFOB/EFOB → Discipulado. No es obligatorio pasar por todas en orden estricto: cada persona se puede trasladar a cualquier estación según su situación real.',
          como: [
            { accion: 'Ver el estado general', pasos: ['Entra y revisa "Procesos activos", "Amigos en ruta", "Asistencias REFAM" y el gráfico "Personas por estación".', 'La tarjeta "Prioridad sugerida" te dice qué hacer primero, con un botón directo (ej. "Abrir Discipulado").', 'Clic en "Amigos en ruta" para el listado maestro (ficha, notas, historial y estación actual de cada persona).'] },
            { accion: 'Registrar y avanzar a alguien en Uno Más', pasos: ['Entra a "Uno Más" → elige el Amigo y el Responsable (obligatorio) → "Agregar a Uno Más".', 'Selecciónalo y registra su "Compromiso de Uno Más" (estado, último contacto, resultado) → "Guardar compromiso".', 'Cuando esté listo, elige la estación destino en "Trasladar a..." y confirma.'] },
            { accion: 'Trabajar un grupo REFAM', pasos: ['Entra a "REFAM" → "Crear grupo REFAM" (Nombre, Zona, Día de reunión, Anfitrión, Líder).', 'Selecciona el grupo y agrega participantes (Amigo o Persona + comité responsable).', 'Marca "Marcar completada" cuando alguien termine una lección, y usa "Registrar reunión" para dejar asistencia de cada sesión.'] },
            { accion: 'Iniciar ESFOB/EFOB o Discipulado', pasos: ['Entra a "ESFOB / EFOB" o "Discipulado" → "Iniciar proceso" (persona, comité/mentor, programa, fecha).', 'En "Procesos activos", clic en "Marcar lección completada" a medida que avanza.', 'En ESFOB, al completar todas las lecciones aparece "Marcar bautizado" — luego incorpórala a Feligresía desde Amigos.'] },
          ],
        },
        {
          titulo: 'Amigos en ruta',
          queEs: 'Seguimiento de personas en proceso de integración (evangelismo, primer contacto, discipulado) hasta que se bautizan e ingresan a Feligresía, organizadas por etapas configurables (ej. "Primera visita", "Bautizado").',
          como: [
            { accion: 'Registrar un amigo nuevo', pasos: ['Clic en "Nuevo amigo".', 'Llena nombres, dirección, etapa, zona y quién lo invitó.', 'Guarda.'] },
            { accion: 'Marcar bautizado e incorporar a Feligresía', pasos: ['Abre la ficha del amigo y marca el hito de bautismo.', 'Una vez bautizado, clic en "Incorporar a Feligresía" — es definitivo: crea el registro oficial de membresía y la ficha deja de poder volver a estado en ruta.'] },
          ],
        },
      ],
    },
    {
      seccion: 'Comités que administran población (convertidos y no convertidos)',
      items: [
        {
          titulo: 'Escuela Dominical',
          queEs: 'Censo propio de niños por edades y etapas (Misión Infantil). Los niños no necesitan estar en Feligresía — se registran con nombre propio y llevan hitos independientes de bautizado y sellado.',
          como: [
            { accion: 'Registrar un niño nuevo', pasos: ['"Nuevo niño" → Nombres, Apellidos, Clase, Fecha de nacimiento, Nombre y Teléfono del acudiente.', 'Clic en "Registrar niño".'] },
            { accion: 'Crear una clase y registrar una lección', pasos: ['"Nueva clase" → Nombre, Etapa (Cuna, Párvulos, Primarios, Preadolescentes), Metodología, Maestro líder → "Registrar clase".', 'Selecciona la clase, llena Tema y Fecha, marca asistencia individual → "Registrar lección" (el número avanza solo).'] },
            { accion: 'Marcar hitos', pasos: ['En el censo, "Marcar bautizado" o "Marcar sellado" junto al niño (queda con la fecha de hoy, no se puede deshacer desde aquí).'] },
          ],
        },
        {
          titulo: 'Damas Dorcas',
          queEs: 'Trabajo evangelístico, social y espiritual con mujeres. Mismo patrón que Escuela Dominical: censo propio de beneficiarias (no requiere que ya sean feligresas), con hitos de bautizada/sellada y alerta si llevan más de 60 días sin actividad.',
          como: [
            { accion: 'Registrar una beneficiaria', pasos: ['"Nueva beneficiaria" → Nombres, Apellidos, Teléfono, Dirección, Responsable de seguimiento → "Registrar beneficiaria".'] },
            { accion: 'Registrar una actividad', pasos: ['"Registrar actividad" → Fecha, Tipo (Visita, Social, Espiritual, Otro), Descripción, Responsable, asistencia individual → "Registrar actividad".'] },
            { accion: 'Marcar hitos y priorizar seguimiento', pasos: ['"Marcar bautizada" / "Marcar sellada" junto al nombre en el censo.', 'Revisa "Beneficiarias sin seguimiento reciente" para saber a quién visitar primero.'] },
          ],
        },
        {
          titulo: 'Obra Carcelaria',
          queEs: 'Trabajo con internos dentro del centro de reclusión y su reinserción después de salir libres, en 5 pestañas: Internos, Cultos y REFAM, Delegados, Seguimiento familiar y Reinserción. "Vincular a la Ruta" es la conexión con Misiones y Evangelismo.',
          como: [
            { accion: 'Registrar un interno y marcar hitos', pasos: ['Pestaña "Internos" → "Nuevo interno" (Nombres, Apellidos, Centro, Patio/pabellón, Fecha de ingreso) → "Registrar interno".', '"Marcar bautizado" / "Marcar sellado" / "Marcar liberado" según corresponda.'] },
            { accion: 'Vincular un interno a la Ruta Evangelística', pasos: ['Junto al interno activo, clic en "Vincular a la Ruta".', 'Si no está bautizado, elige el Responsable y "Confirmar" (entra a BIS). Si ya está bautizado, se vincula directo.'] },
            { accion: 'Gestionar un liberado (reinserción)', pasos: ['La asignación a una congregación receptora la hace el distrital desde Pastoral Distrital.', 'Como congregación receptora: actualiza el Estado (Asignado/Contactado/Activo/Inactivo/Reincidencia) y usa "Vincular" igual que con un interno.'] },
          ],
        },
        {
          titulo: 'Conquistadores Pentecostales',
          queEs: 'Censo propio de miembros del club (niños/jóvenes), sean ya convertidos o no — igual que Escuela Dominical y Misión Juvenil, administra tanto a bautizados como a quienes apenas están en camino, con hitos de bautismo/sellado y "Vincular" directo a la Ruta Evangelística.',
          como: [
            { accion: 'Registrar un miembro nuevo', pasos: ['Clic en "Nuevo miembro".', 'Llena nombres, apellidos, teléfono y rol — no necesitas que ya esté en el censo de Feligresía.', 'Guarda.'] },
            { accion: 'Marcar hitos y vincular a la Ruta', pasos: ['En la tabla de miembros, columna "Hitos": marca Bautizado/Sellado con su fecha.', 'Columna "Ruta": botón "Vincular" — lo manda a la Ruta Evangelística si aún no está bautizado, o lo deja listo para incorporar a Feligresía si ya lo está.'] },
          ],
        },
        {
          titulo: 'Misión Juvenil',
          queEs: 'Censo de estudiantes alcanzados en instituciones educativas (colegios, universidades) mediante clubes/grupos, con seguimiento de bautismo y sellado independiente del censo general — un estudiante no bautizado también se administra aquí.',
          como: [
            { accion: 'Dar de alta institución, estudiante y grupo', pasos: ['"Nueva institución" para un colegio o universidad.', '"Nuevo estudiante" para un alumno alcanzado (no requiere que ya sea feligrés).', '"Nuevo grupo REFAM" para organizar el discipulado de varios estudiantes juntos.'] },
            { accion: 'Vincular a la Ruta Evangelística', pasos: ['Cuando un estudiante decide seguir el proceso o se bautiza, clic en "Vincular" en su fila.', 'Si ya está bautizado, queda listo para incorporar a Feligresía desde Amigos; si no, entra a BIS con un responsable asignado.'] },
          ],
        },
      ],
    },
    {
      seccion: 'Comités de servicio (solo feligreses ya bautizados)',
      items: [
        {
          titulo: 'Música',
          queEs: 'Formación musical (FECP): coros, orquesta y equipos de alabanza. A diferencia de los comités de arriba, solo administra personas que ya son feligreses registrados — se elige de la lista de personas, no se crea un censo nuevo.',
          como: [
            { accion: 'Crear un grupo y agregar un integrante', pasos: ['"Nuevo grupo" → Nombre, Tipo (Coro, Orquesta, Alabanza, Otro), Instructor → "Registrar grupo".', '"Nuevo integrante" → Persona, Grupo, Instrumento o voz → "Registrar integrante".'] },
            { accion: 'Registrar una sesión de ensayo', pasos: ['Selecciona el grupo, llena Tema y Fecha, marca asistencia individual → "Registrar sesión" (el número avanza solo).'] },
          ],
        },
        {
          titulo: 'Educación Artística',
          queEs: 'Formación en danza, teatro y artes visuales con enfoque bíblico. Mismo patrón que Música: comité de servicio, solo feligreses ya registrados.',
          como: [
            { accion: 'Crear un grupo y agregar un integrante', pasos: ['"Nuevo grupo" → Nombre, Disciplina (Danza, Teatro, Artes visuales, Otro), Instructor → "Registrar grupo".', '"Nuevo integrante" → Persona, Grupo → "Registrar integrante".'] },
            { accion: 'Registrar una sesión', pasos: ['Selecciona el grupo, llena Tema y Fecha, marca asistencia → "Registrar sesión".'] },
          ],
        },
        {
          titulo: 'Educación Teológica',
          queEs: 'Formación bíblica y doctrinal de la membresía (distinta de la formación ministerial de pastores, que ve el distrital). Comité de servicio, organizado por Nivel (Título, Curso, Diplomado, Especialización, Maestría, Doctorado, Seminario bíblico, Otro), con certificación al terminar.',
          como: [
            { accion: 'Crear un grupo y agregar un integrante', pasos: ['"Nuevo grupo" → Nombre, Nivel, Instructor → "Registrar grupo".', '"Nuevo integrante" → Persona, Grupo → "Registrar integrante".'] },
            { accion: 'Registrar sesión y certificar', pasos: ['Selecciona el grupo, llena Tema y Fecha, marca asistencia → "Registrar sesión".', 'Al terminar el proceso de alguien, clic en "Certificar" junto a su nombre (fecha de hoy, no se puede deshacer desde aquí).'] },
          ],
        },
      ],
    },
    {
      seccion: 'Otros frentes',
      items: [
        {
          titulo: 'SEPRI',
          queEs: 'No es un comité — es el flujo de aprobación de eventos fuera del templo. Debe presentarse a la Secretaría Distrital con al menos 30 días de anticipación; fuera de ese plazo, la iglesia no responde legalmente por lo que ocurra.',
          como: [
            { accion: 'Enviar una solicitud de evento', pasos: ['"Nueva solicitud de evento" → Nombre, Fecha, Asistentes esperados, Ubicación (dentro/fuera del templo), Responsable, si tiene póliza de seguros, y las medidas de seguridad.', '"Enviar solicitud" — queda "Pendiente" hasta que la Secretaría Distrital la apruebe o rechace; no se puede editar una vez resuelta.'] },
            { accion: 'Registrar un delegado de seguridad', pasos: ['Pestaña "Delegados" → Persona, marca "Certificación vigente" y su fecha de vencimiento → "Registrar delegado".'] },
          ],
        },
        {
          titulo: 'Obra Social',
          queEs: 'Asistencia socioeconómica a hermanos sin recursos. No crea censo propio de personas: sus "casos" se abren sobre una familia ya censada, con opción de vincularse a un caso ya abierto en Red de Familias para no perder el origen de la necesidad.',
          como: [
            { accion: 'Registrar un caso', pasos: ['"Nuevo caso" → si ya existe en Red de Familias, marca "Vincular caso de Red de Familias" (autocompleta la familia).', 'Elige Familia, Tipo de necesidad (Económica, Alimentaria, Salud, Vivienda, Otra), Prioridad y Responsable → "Registrar caso".'] },
            { accion: 'Registrar una ayuda entregada', pasos: ['Selecciona el caso, actualiza el Estado si corresponde (Identificada, En apoyo, Resuelta, Cerrada).', 'Llena Fecha, Tipo de ayuda (Material, Económica, Acompañamiento, Otra), Descripción → "Registrar ayuda".'] },
          ],
        },
        {
          titulo: 'Impacto Misionero',
          queEs: 'Tablero de solo consulta (sin formularios): consolida el alcance de Obra Carcelaria, Misión Juvenil y Obra Social para ver de un vistazo a cuántas personas llega tu congregación fuera del templo.',
          como: [
            { accion: 'Consultarlo', pasos: ['Revisa "Personas alcanzadas" (suma de los tres frentes) y el gráfico "Personas alcanzadas por frente".', 'Si necesitas registrar algo, entra directamente al módulo correspondiente — aquí no se edita nada.', 'Exporta con los botones CSV/Excel/PDF si necesitas compartir el consolidado.'] },
          ],
        },
      ],
    },
    {
      seccion: 'Administración de tu congregación (solo el pastor)',
      items: [
        {
          titulo: 'Equipo de trabajo',
          queEs: 'Da o retira acceso web y/o responsabilidad operativa (captura desde la app móvil, sin acceso web) a personas del censo de tu congregación.',
          como: [
            { accion: 'Dar acceso a alguien', pasos: ['"Agregar o actualizar acceso" → selecciona la persona (debe estar en tu censo).', 'Marca "Acceso web" (opcional, con el perfil que va a operar) y/o "Responsabilidad operativa" (opcional, captura móvil de un módulo específico).', 'Guarda — recibe la invitación real por correo si le diste acceso web.'] },
          ],
        },
        {
          titulo: 'Módulos y actividades',
          queEs: 'Configura la estructura operativa: qué módulos existen (ej. Ujieres), sus tipos de actividad, la lista de ujieres, los catálogos de lecciones de REFAM/ESFOB/Discipulado, y qué comité corresponde a cada rango de edad. "Evangelismo" y "Misión Juvenil" están bloqueados aquí porque se administran desde sus propias pantallas.',
          como: [
            { accion: 'Crear un módulo y sus actividades', pasos: ['En "Módulos activos", escribe el nombre y clic en el botón "+".', 'Selecciona el módulo y en el panel derecho agrega el nombre de la actividad (ej. "Culto dominical") con el botón "+".', 'Usa el lápiz para editar o el icono de energía para desactivar/reactivar (los módulos del sistema no se pueden tocar aquí).'] },
            { accion: 'Definir el comité sugerido por edad', pasos: ['En "Rangos de edad y comités", llena Nombre del rango, Edad desde/hasta, Género y Estado civil (opcionales) y el Comité.', '"Agregar" — esto solo sugiere el comité correcto en Feligresía, nunca traslada a nadie automáticamente.'] },
          ],
        },
        {
          titulo: 'Configuración local',
          queEs: 'Identidad de la congregación, preferencias de comportamiento del sistema (alertas, exigencias al registrar asistencia) y catálogos propios (categorías demográficas, etapas de Amigos, tipos y cargos de comité).',
          como: [
            { accion: 'Ajustar preferencias de alertas', pasos: ['En "Preferencias de la congregación", define el Umbral de alerta por disminución (%) y el Módulo predeterminado al registrar asistencia.', 'Marca "Exigir responsable" y/o "Solicitar novedades" si quieres volverlos obligatorios → "Guardar preferencias".'] },
            { accion: 'Agregar un cargo de comité', pasos: ['En "Cargos de comité", llena Nombre y Código.', 'Marca "Requiere estar sellado con el Espíritu Santo" solo si ese cargo lo exige además de estar bautizado (bautizado ya es obligatorio siempre) → "Agregar cargo".'] },
          ],
        },
        {
          titulo: 'Auditoría de Feligresía',
          queEs: 'Historial de cambios del censo y seguimiento pastoral: quién creó, actualizó o eliminó un registro, y qué cambió exactamente (antes/después).',
          como: [
            { accion: 'Consultar e investigar un cambio', pasos: ['En "Filtros de auditoría", elige Entidad y Acción (Creaciones/Actualizaciones/Eliminaciones) y un rango de fechas si hace falta.', 'Clic en "Ver cambios" junto al registro que te interesa para ver el detalle antes/después.'] },
          ],
        },
      ],
    },
  ],
  distrital: [
    {
      seccion: 'Tu día a día',
      items: [
        {
          titulo: 'Resumen',
          queEs: 'Consolida en un vistazo la situación de todas las congregaciones del distrito (feligreses activos, vacantes de pastor, bautizados/sellados, crecimiento) para detectar qué congregación necesita atención.',
          como: [
            { accion: 'Revisarlo', pasos: ['Revisa el "Semáforo del distrito" — cada fila muestra un punto verde o rojo con el detalle de qué está fallando.', 'En "Comparativa por congregación", usa "Ordenar por..." (nuevas 3 meses, personas activas, asistencia último mes, bajas 3 meses) para ver quién crece o retrocede.', 'Clic en "Ir a Pastoral Distrital" para pasar a la acción.'] },
          ],
        },
      ],
    },
    {
      seccion: 'Gestión pastoral',
      items: [
        {
          titulo: 'Registrar nueva congregación',
          queEs: 'Da de alta una congregación nueva de tu distrito junto con su primer pastor, en un solo paso. Al guardar se envía una invitación real por correo al pastor, y la congregación queda pendiente de aprobación hasta activarla en "Aprobaciones".',
          como: [
            { accion: 'Registrarla', pasos: ['En la tarjeta "Registrar nueva congregación", escribe o elige el nombre (hay sugerencias del catálogo oficial IPUC).', 'Llena Ciudad/Municipio, Nombres y Apellidos del pastor, Teléfono (opcional) y Correo del pastor (obligatorio, ahí llega la invitación).', 'Clic en "Crear congregación e invitar pastor" — el aviso confirma si la invitación se envió.'] },
          ],
        },
        {
          titulo: 'Directiva distrital',
          queEs: 'Censo de quién ejerce cada uno de los 6 cargos oficiales (Supervisor, Secretario, Tesorero, Presbítero A, Presbítero B, Veedor) — separado del acceso al software, asignar el cargo aquí no da ni quita permisos de SIGAP.',
          como: [
            { accion: 'Asignar un cargo', pasos: ['En "Directiva distrital", elige la Persona (debe estar en el censo activo de alguna congregación del distrito), el Cargo y la fecha "Desde".', 'Clic en "Asignar cargo".', 'Para cerrar un periodo, clic en "Terminar periodo" en la fila de esa persona.'] },
          ],
        },
        {
          titulo: 'Comités por congregación',
          queEs: 'Series de tarjetas (una por cada uno de los 11 comités/frentes: Escuela Dominical, Damas Dorcas, Obra Carcelaria, Música, Educación Artística, Educación Teológica, Conquistadores, Obra Social, Misión Juvenil, Red de Familias y Ruta Evangelística) consolidando todas las congregaciones del distrito, sin tener que entrar a cada una.',
          como: [
            { accion: 'Revisar un comité', pasos: ['Baja hasta la tarjeta del comité que te interesa (ej. "Escuela Dominical por congregación").', 'Usa el selector "Ordenar por..." propio de esa tarjeta para identificar quién lidera o quién está en cero.'] },
          ],
        },
        {
          titulo: 'Formación y traslados pastorales',
          queEs: 'Maneja el ciclo de vida de un pastor en el distrito: registrarlo, trasladarlo, ascender su licencia ministerial, dejar constancia de su formación académica y cerrar su asignación cuando se retira.',
          como: [
            { accion: 'Registrar un pastor nuevo', pasos: ['"Registrar pastor" → Nombres, Apellidos, Teléfono, Familia pastoral, Correo, busca la Congregación (solo muestra las que no tienen pastor), elige el Cargo (Pastor local/asociado/auxiliar o Coordinador) y la fecha "Desde".', 'Clic en "Registrar pastor".'] },
            { accion: 'Trasladar un pastor a otra congregación', pasos: ['"Trasladar pastor" → selecciona Pastor, Nueva congregación, Fecha y observaciones opcionales.', 'Clic en "Confirmar traslado" — la congregación anterior queda vacante de inmediato.'] },
            { accion: 'Finalizar una asignación pastoral', pasos: ['"Finalizar asignación pastoral" → selecciona Pastor, Fecha y el motivo en Observaciones.', 'Clic en "Finalizar asignación" — deja la congregación vacante y revoca el acceso del pastor.'] },
          ],
        },
      ],
    },
    {
      seccion: 'Supervisión',
      items: [
        {
          titulo: 'Impacto Misionero',
          queEs: 'Consolida el alcance de Obra Carcelaria, Misión Juvenil y Obra Social de todo el distrito.',
          como: [{ accion: 'Consultarlo', pasos: ['Revisa las tarjetas de personas alcanzadas y el gráfico por frente.', 'Exporta con CSV/Excel/PDF si necesitas compartirlo.'] }],
        },
        {
          titulo: 'Auditoría de Feligresía',
          queEs: 'Cambios en el censo de cualquier congregación de tu distrito, con quién los hizo y cuándo.',
          como: [{ accion: 'Investigar un cambio', pasos: ['Filtra por Entidad y Acción en "Filtros de auditoría".', 'Clic en "Ver cambios" para el detalle antes/después.'] }],
        },
        {
          titulo: 'Aprobaciones',
          queEs: 'Activa, suspende o anula las congregaciones de tu distrito. Una congregación registrada no puede usar el sistema hasta ser aprobada aquí.',
          como: [
            { accion: 'Aprobar, suspender o anular', pasos: ['Ubica la fila con estado "Pendiente de aprobación".', 'Clic en el ícono verde (✓) para aprobar, el rojo (✗) para suspender, o la papelera para anular (pide confirmar "Sí, anular" — no se puede deshacer).', 'Para una congregación activa hay un enlace "Suspender"; para una suspendida, "Reactivar".'] },
          ],
        },
      ],
    },
  ],
  nacional: [
    {
      seccion: 'Tu día a día',
      items: [
        {
          titulo: 'Resumen',
          queEs: 'Consolida los 36 distritos de la IPUC en Colombia en un solo lugar (feligreses, vacantes, bautizados/sellados, crecimiento) para comparar y decidir a escala país.',
          como: [
            { accion: 'Revisarlo', pasos: ['Revisa el "Semáforo nacional" (mismas 5 señales que el distrital, sumadas a nivel país).', 'En "Comparativa por distrito", usa "Ordenar por..." para ubicar el distrito que necesita apoyo.', 'Clic en "Ir a Gestión Pastoral Nacional" para pasar a la acción.'] },
          ],
        },
      ],
    },
    {
      seccion: 'Visión país',
      items: [
        {
          titulo: 'Gestión Pastoral Nacional',
          queEs: 'Escalafón ministerial (Obrero → Licencia Local → Licencia General → Ordenación) y directiva de los 36 distritos. También es donde se otorga acceso al sistema a un nuevo líder distrital (o nacional, si eres super_admin).',
          como: [
            { accion: 'Otorgar acceso a un nuevo líder', pasos: ['En "Otorgar acceso al sistema", busca la persona en "Persona (buscar en el censo nacional)".', 'Elige el Nivel a otorgar (Distrital, o Nacional si eres super_admin) y, si es Distrital, el Distrito.', 'Escribe el Correo de acceso → "Otorgar acceso".'] },
            { accion: 'Descargar el informe trimestral', pasos: ['En "Informe trimestral por distrito", elige Año y Trimestre.', 'Ordena por Bautizados/Sellados/Reconciliados/Entregados nuevos y clic en "Descargar PDF".'] },
          ],
        },
        {
          titulo: 'Comités Nacional',
          queEs: 'Consolida a escala país los 10 comités reales de la IPUC — la misma información que ve cada distrital de su propio distrito, sumada nacionalmente. Es de solo lectura, sin formularios.',
          como: [{ accion: 'Consultarlo', pasos: ['Revisa las 10 tarjetas KPI (una por comité, total nacional).', 'Baja a la tabla "Por distrito" para el desglose por los 36 distritos.'] }],
        },
        {
          titulo: 'Catálogo de distritos',
          queEs: 'Catálogo maestro de los 36 distritos (identificados solo por número, sin nombre propio) y el lugar para reasignar una congregación de un distrito a otro cuando quedó mal ubicada.',
          como: [
            { accion: 'Crear o editar un distrito', pasos: ['"Nuevo distrito" → escribe el Número (1 a 36) → "Crear distrito".'] },
            { accion: 'Reasignar una congregación', pasos: ['En "Congregaciones por distrito", busca la congregación, elige el nuevo distrito en el desplegable → "Mover" (solo se activa si el destino cambió).'] },
          ],
        },
        {
          titulo: 'Impacto Misionero',
          queEs: 'Igual que en distrital, pero consolida Obra Carcelaria, Misión Juvenil y Obra Social de toda la IPUC en Colombia.',
          como: [{ accion: 'Consultarlo', pasos: ['Revisa las tarjetas KPI y el gráfico "Personas alcanzadas por frente".', 'Exporta el consolidado nacional con CSV/Excel/PDF.'] }],
        },
      ],
    },
    {
      seccion: 'Supervisión',
      items: [
        {
          titulo: 'Auditoría de Feligresía',
          queEs: 'Cambios en el censo de cualquier congregación del país.',
          como: [{ accion: 'Investigar un cambio', pasos: ['Aplica los mismos filtros de Entidad/Acción/fechas.', 'Clic en "Ver cambios" para el detalle de cualquier congregación del país.'] }],
        },
        {
          titulo: 'Aprobaciones',
          queEs: 'Igual que distrital, pero para cualquier congregación pendiente de aprobación del país.',
          como: [{ accion: 'Aprobar, suspender o anular', pasos: ['Ubica la congregación pendiente (columna Distrito indica cuál).', 'Clic en ✓ para aprobar, ✗ para suspender, o la papelera para anular.'] }],
        },
      ],
    },
  ],
  super_admin: [
    {
      seccion: 'Tu día a día',
      items: [
        {
          titulo: 'Panel de negocio (Resumen)',
          queEs: 'El Resumen exclusivo de super_admin — a diferencia de nacional (datos pastorales de la IPUC), este panel es 100% sobre el negocio SIGAP: congregaciones activas/pendientes/nuevas, estado de suscripciones, ingresos y qué tan rápido está creciendo el negocio.',
          como: [
            { accion: 'Leerlo', pasos: ['Revisa las tarjetas de arriba (Congregaciones totales/Activas/Pendientes/Nuevas).', 'En "Crecimiento", revisa la tendencia de nuevas congregaciones por mes y usa el "Simulador" (nuevas congregaciones esperadas por mes) para proyectar a 3/6/12 meses.', 'En "Requieren atención pronto", actúa sobre las bloqueadas/en gracia/por vencer con el botón "Ir a Suscripciones".'] },
            { accion: 'Descargar el informe de negocio', pasos: ['Clic en "CSV", "Excel" o "PDF" junto a "Informe de negocio" — sale con marca SIGAP (no IPUC), listo para compartir, por ejemplo contigo mismo como CEO.'] },
          ],
        },
      ],
    },
    {
      seccion: 'Negocio SIGAP (exclusivo de super_admin)',
      items: [
        {
          titulo: 'Suscripciones',
          queEs: 'Cobro por congregación (mensual o anual, cobro manual por Nequi/transferencia). Define el método de pago que ve cada congregación y registra cuándo te pagaron.',
          como: [
            { accion: 'Configurar el método de pago', pasos: ['En "Método de pago para las congregaciones", llena los datos de Nequi/banco → "Guardar método de pago".'] },
            { accion: 'Registrar un pago', pasos: ['En la fila de la congregación, clic en "Registrar pago" — mueve la fecha de próximo pago un mes o un año según el plan, sin perder tiempo ya pagado si lo registras antes de tiempo.'] },
          ],
        },
        {
          titulo: 'Errores del sistema',
          queEs: 'Cualquier error real de JavaScript que le pase a un usuario (pantalla rota, algo que falló) queda registrado aquí automáticamente, sin que nadie tenga que reportarlo.',
          como: [
            { accion: 'Revisar y atender', pasos: ['Activa "Mostrar solo sin revisar" para enfocarte en lo nuevo.', 'Clic en "Ver stack" para el detalle técnico si lo necesitas.', 'Clic en "Marcar revisado" cuando lo atiendas, o elimínalo si ya no aplica.'] },
          ],
        },
      ],
    },
  ],
}

const HERRAMIENTAS_GENERALES = [
  {
    titulo: 'Reportes',
    queEs: 'Lectura de asistencia y actividad por periodo, con el detalle completo cargado por páginas de 50 registros.',
    como: [{ accion: 'Consultar y exportar', pasos: ['Elige el periodo en el selector superior (últimos 30 días, histórico, etc.).', 'Descarga con los botones CSV / Excel / PDF (con membrete oficial IPUC).'] }],
  },
  {
    titulo: 'Soporte',
    queEs: 'Reporta un problema técnico o algo que no funcione — llega directo al equipo que mantiene SIGAP, con copia por correo. (super_admin además ve y resuelve los reportes de todo el país, no solo los propios.)',
    como: [{ accion: 'Enviar un reporte', pasos: ['Escribe el Asunto y la Descripción (qué pasó, en qué pantalla, qué esperabas).', 'Clic en "Enviar reporte". Si es urgente, también puedes escribir a soportesigasoftware@gmail.com.'] }],
  },
  {
    titulo: 'Solicitudes internas',
    queEs: 'Canal formal (no un chat) para comunicarte con tu distrital o nacional — pedir algo, reportar una situación o hacer una sugerencia, con estado de seguimiento hasta que se resuelva.',
    como: [{ accion: 'Enviar una solicitud', pasos: ['Elige el Tipo (Administrativa, Queja, Sugerencia, Recurso, Otro) y la Prioridad.', 'Escribe Asunto y Descripción, y envía — sigue el estado (Pendiente/En proceso/Resuelto/Cerrado) desde la misma pantalla.'] }],
  },
  {
    titulo: 'Preferencias personales / Mi perfil',
    queEs: 'Tu propia cuenta: corregir tu nombre (el mismo que ves en el censo), cambiar tu contraseña, ver tus roles/permisos activos, formato de fecha y activar la verificación en dos pasos.',
    como: [{ accion: 'Ajustarla', pasos: ['Clic en tu nombre o "Perfil" (arriba a la derecha) para corregir nombre/apellidos.', 'En "Preferencias personales", activa la Verificación en dos pasos si quieres una capa extra de seguridad.'] }],
  },
]

const NIVEL_LABEL = {
  local: 'Nivel local',
  distrital: 'Nivel distrital',
  nacional: 'Nivel nacional',
  super_admin: 'Super admin',
}

function ManualItem({ item }) {
  return (
    <div className="card p-5">
      <h3 className="font-medium">{item.titulo}</h3>
      <p className="text-sm text-secondary leading-6 mt-2">{item.queEs}</p>
      {item.como?.length > 0 && (
        <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border">
          {item.como.map((flujo) => (
            <div key={flujo.accion}>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-accent">{flujo.accion}</p>
              <ol className="list-decimal list-inside text-sm text-secondary leading-6 mt-1.5 flex flex-col gap-1">
                {flujo.pasos.map((paso, index) => <li key={index}>{paso}</li>)}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Manual() {
  const { rolPrincipal, loading } = useMiRol()

  if (loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando el manual...</div>

  const nivel = rolPrincipal?.nivel ?? 'local'
  const secciones = MANUAL[nivel] ?? MANUAL.local

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">Documentación · {NIVEL_LABEL[nivel] ?? 'Nivel local'}</p>
        <h1 className="section-title">Manual de uso</h1>
        <p className="text-sm text-secondary mt-0.5">Qué es cada pantalla de SIGAP y cómo se usa, paso a paso — según tu propio rol.</p>
      </header>

      <div className="flex flex-col gap-8">
        {secciones.map((grupo) => (
          <section key={grupo.seccion}>
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted mb-3">{grupo.seccion}</h2>
            <div className="grid gap-3">
              {grupo.items.map((item) => <ManualItem key={item.titulo} item={item} />)}
            </div>
          </section>
        ))}

        <section>
          <h2 className="text-xs uppercase tracking-[0.14em] text-muted mb-3">Herramientas generales (todos los niveles)</h2>
          <div className="grid gap-3">
            {HERRAMIENTAS_GENERALES.map((item) => <ManualItem key={item.titulo} item={item} />)}
          </div>
        </section>
      </div>

      <p className="text-xs text-muted flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> ¿Algo no funciona como se describe aquí? Repórtalo desde Soporte.</p>
    </div>
  )
}
