# Revision de modulo: Feligresia

Fecha: 28 de agosto de 2026

## Alcance revisado

- Poblacion y busqueda paginada.
- Familias y asociacion familiar.
- Comites, integrantes y cargos.
- Seguimiento pastoral y agenda.
- Historial de cargos.
- Importacion y exportacion del censo.
- Permisos, RLS, vistas y estados de carga.

La ruta efectiva del Sidebar es `/feligresia` y carga `FeligresiaAdmin.jsx`.
`Feligresia.jsx` es una implementación antigua que no debe usarse para nuevas
funciones.

## Propósito de cada submódulo

- **Población:** censo administrativo de personas pertenecientes a la
	congregación. No consulta asistencia, zonas, módulos ni datos extramurales.
- **Familias:** relación de hogares y parentescos del censo local.
- **Comités:** organización interna, integrantes y cargos de la congregación.
- **Seguimiento pastoral:** agenda de acompañamiento, alertas y próximos
	contactos sobre personas del censo.
- **Evolución:** lectura de ingresos, estados, edades, bautismo y capacidad de
	organización. No es un módulo de captura de asistencia.

## Definición ministerial del censo

Población representa el recurso humano de la congregación local: niños,
adolescentes, jóvenes, adultos y personas mayores que pertenecen al censo
ministerial. No representa Amigos en ruta ni participantes extramurales.

Una persona puede pertenecer a una familia, participar en uno o varios
comités, tener cargos históricos y recibir seguimiento pastoral. Los comités
se alimentan de esta población, no de registros de asistencia ni de zonas de
Evangelismo.

La fecha de nacimiento permite calcular rangos de edad automáticamente. El
estado civil permite observar viudez, divorcio, matrimonio y unión libre. Estos
datos generan señales para el acompañamiento, pero no clasifican por sí solos
un hogar como disfuncional: esa conclusión requiere criterios pastorales y
registro cualitativo.

`apartado` es un estado consolidado del censo, distinto de un Amigo no
convertido. Puede cruzarse con familia, última asistencia, historial de cargos
y seguimientos para decidir una ruta de reactivación.

## Traslado formal desde Amigos

Un Amigo permanece en Amigos en ruta durante todo el proceso. Solo puede
incorporarse a Feligresía cuando `estado_espiritual = bautizado` y existe fecha
de nacimiento. La RPC `incorporar_amigo_bautizado` exige confirmar nombres,
apellidos, estado civil y fecha de nacimiento; crea la persona, conserva el
registro original y guarda `amigos.persona_id`. El indice unico impide duplicar
la incorporacion. El estado anterior a bautismo sigue siendo `en_ruta` y no
puede entrar al censo ministerial.

El nombre del Amigo se conserva en el seguimiento y la incorporacion solicita
completar estado civil y fecha de nacimiento. La asignacion de familia,
parentesco, comites y cargos ocurre despues en Feligresía, con autorizacion
local.

## Familias ampliadas y árbol genealógico

La familia se representa en dos niveles:

- `familia_miembros`: pertenencia a un núcleo y parentesco dentro de ese
	núcleo. Una ficha puede pertenecer a varios núcleos.
- `relaciones_familiares`: vínculo genealógico entre dos personas de la misma
	congregación, como padre, madre, hijo/a, cónyuge o hermano/a.

Así se puede registrar un núcleo de abuelos con sus hijos, nueras y nietos, y
otro núcleo para los padres e hijos, compartiendo las mismas fichas sin
duplicarlas. El árbol permite consultar jerarquías, abrir fichas, agregar
personas a otro núcleo y registrar relaciones.

La interfaz no infiere parentescos por apellido, edad, convivencia o estado
civil. La jerarquía solo aparece cuando el equipo autorizado la registra.

Las pestañas permanecen bajo los indicadores porque agrupan navegación del
mismo dominio y son fáciles de localizar. Ahora usan `role=tablist` y
`aria-selected`; en móvil conservan desplazamiento horizontal sin comprimir
las etiquetas.

## Correcciones aplicadas

- Se agrego `reloadToken` para reintentar la carga completa desde la interfaz.
- El mensaje de error de carga ahora incluye accion `Reintentar`.
- El modo de consulta oculta los formularios de escritura de Feligresia.
- La vista sigue mostrando datos de consulta a perfiles sin `feligresia.editar`.
- Se conservaron las validaciones existentes de nombres, fechas, familias, comites, seguimiento y cargos.
- La vista `vw_resumen_feligresia` usa `security_invoker` y sus bautizados corresponden a personas activas.
- La ficha de población captura fecha de nacimiento y estado civil; ambos datos
	se incluyen en exportación e importación.
- Evolución muestra rangos de edad, estado civil, viudez, divorcio y apartados
	como señales del recurso humano y del acompañamiento local.
- Familias y la agenda pastoral reciben `analyticsPeople`, evitando depender de
	la página visible de 50 personas para identificar integrantes y responsables.
- Evolución usa población activa para sus métricas de bautismo y cobertura,
	evitando que sus denominadores contradigan el resumen superior.

## Hallazgos funcionales

### Resueltos

- Las operaciones de escritura ya estaban protegidas por `canEdit` y RLS; ahora la interfaz evita presentar formularios de alta y edición a perfiles de consulta.
- Las acciones de seguimiento, cargos, familias y comites mantienen validacion de permiso en el handler.
- La navegación distingue consulta de escritura: el perfil de consulta no debe
	recibir formularios de alta/edición, mientras conserva los paneles de lectura.
- La paginacion de poblacion evita descargar todo el censo para la lista principal.
- La importacion tiene vista previa, limite de 500 filas, deteccion de coincidencias y errores por fila.

### Pendientes de validacion

- Probar con JWT reales el aislamiento de personas, familias, comites, seguimientos, cargos, alertas y auditoria entre congregaciones A y B.
- Confirmar que las vistas con `security_invoker` funcionan en la version de PostgreSQL del proyecto.
- Probar perfiles `pastor`, `estadisticas` y `consulta` con acciones permitidas y rechazadas.
- Probar importacion con fechas de Excel, duplicados dentro del mismo archivo y familias inexistentes.

### Mejoras futuras identificadas

- Las tarjetas de Familias y los nombres de integrantes de Comites deben usar una consulta analitica completa, no la pagina visible de 50 personas, para que sus conteos y nombres no queden parciales.
- La consulta analítica completa ya se carga para relaciones; falta optimizarla
	con RPC o búsqueda remota si el censo alcanza un volumen muy alto.
- Añadir estado de carga bloqueante o skeleton para evitar que el usuario interprete metricas provisionales durante la primera consulta.
- Añadir busqueda y filtro propio en Familias y Comites cuando el censo sea grande.
- Explicar con mayor claridad la diferencia entre miembro activo, apartado, trasladado, inactivo y fallecido.
- Considerar una vista alternativa de tabla para el historial y sus graficos.
- Definir en el modelo si `personas` representa únicamente miembros/convertidos o
	también responsables operativos. La decisión funcional actual es que
	`personas` representa miembros del censo ministerial; queda pendiente
	formalizar el origen de conversión y el vínculo transaccional entre
	`amigos.convertido` y el alta en el censo.
- Definir criterios pastorales para hogares que requieran acompañamiento; no se
	deben inferir diagnósticos familiares únicamente desde estado civil o
	parentesco.
- Aplicar `feligresia.sql` para crear el flujo de traslado y sus campos nuevos;
	luego probarlo con un Amigo en ruta, uno bautizado y un segundo intento sobre
	el mismo Amigo.

## Validacion ejecutada

- `npm run build`: correcto.
- Diagnosticos del editor en `FeligresiaAdmin.jsx`: sin errores conocidos.
- No se ejecuto `supabase db lint --local` porque la base PostgreSQL local no esta iniciada.

## Criterio de aceptacion

Feligresia se considera lista para la siguiente ronda cuando cada perfil vea solo su alcance, las acciones no autorizadas no aparezcan ni funcionen por API, los conteos de relaciones usen el conjunto completo y la matriz A/B quede aprobada con evidencia.
