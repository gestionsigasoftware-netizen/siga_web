# Plan funcional: Feligresia y Red de Familias

Fecha de inicio: 28 de agosto de 2026
Estado: Primera entrega implementada; validacion Supabase pendiente

## 1. Proposito

SIGA debe convertir la informacion ministerial en decisiones y acciones
concretas. Cada dato debe responder tres preguntas:

1. Que esta ocurriendo.
2. A quien o a que grupo afecta.
3. Que accion puede realizar el equipo autorizado y cuando debe revisarse.

La interfaz no debe presentar metricas aisladas ni diagnosticos automaticos.
Cada indicador debe explicar su poblacion, periodo, unidad de medida y siguiente
paso sugerido.

## 2. Limites entre dominios

### Feligresia

Es el censo ministerial local y la fuente de verdad de las personas que
pertenecen a la congregacion. Incluye ninos, adolescentes, jovenes, adultos y
personas mayores.

Administra:

- datos personales y fecha de nacimiento;
- estado ministerial: activo, apartado, trasladado, inactivo o fallecido;
- bautismo y fecha de bautismo;
- estado civil;
- familias, nucleos y parentescos;
- relaciones genealogicas;
- comites, integrantes y cargos;
- seguimiento pastoral general;
- evolucion de la poblacion y calidad de los datos.

Feligresia no registra Amigos en ruta, zonas de Evangelismo ni asistencia
agregada de actividades.

### Amigos en ruta

Es el proceso de acompanamiento de personas que aun no pertenecen al censo
ministerial. Un Amigo permanece en ruta hasta llegar al estado espiritual
`bautizado`.

Solo un Amigo bautizado puede incorporarse a Feligresia. La incorporacion crea
una sola ficha, conserva el registro original y enlaza ambos registros. No se
permite incorporar Amigos en ruta ni duplicar personas.

### Red de Familias / DEFAM

Es el dominio de intervencion y fortalecimiento familiar. Consume personas,
familias, parentescos y senales de Feligresia, pero no duplica ese censo.

Administra:

- acompanamiento especializado de hogares;
- visitas domiciliarias;
- consejerias y orientaciones;
- talleres, escuelas y capacitaciones;
- campanas y programas;
- compromisos, responsables, resultados y remisiones;
- reportes operativos para pastor, junta local y niveles superiores.

## 3. Modelo de informacion

La ficha de una persona debe existir una sola vez.

Una persona puede:

- pertenecer a varios nucleos mediante `familia_miembros`;
- tener varias relaciones genealogicas mediante `relaciones_familiares`;
- integrar varios comites;
- tener cargos vigentes o historicos;
- recibir seguimiento general y especializado.

El nucleo familiar representa una estructura de pertenencia. La relacion
familiar representa el vinculo entre personas. Esta separacion permite modelar
abuelos, padres, conyuges, hijos y nietos sin duplicar fichas.

## 4. Submodulos de Feligresia

### Poblacion

Pregunta principal: cuantos miembros tiene la congregacion y con que recurso
humano puede contar.

Debe permitir:

- alta, edicion, consulta, importacion y exportacion;
- fecha de nacimiento y calculo de rango de edad;
- estado ministerial y bautismo;
- estado civil y familia;
- busqueda y filtros;
- acceso a comites, cargos y seguimientos relacionados.

Metricas base:

- personas activas;
- apartados;
- bautizados activos;
- distribucion por edad;
- personas sin fecha de nacimiento;
- personas sin familia;
- personas sin asistencia reciente, cuando exista ese dato.

Acciones sugeridas: completar datos, contactar, revisar reactivacion,
incorporar a un comite o abrir seguimiento.

### Familias

Pregunta principal: como estan conformados los nucleos y que relaciones
familiares deben conocer el pastor y el equipo autorizado.

Debe permitir:

- crear nucleos;
- vincular una persona a varios nucleos;
- definir parentesco dentro de cada nucleo;
- registrar relaciones genealogicas;
- consultar arbol familiar;
- abrir fichas individuales;
- visualizar edades, estado civil y estado ministerial como contexto.

No debe etiquetar automaticamente hogares como disfuncionales. Puede mostrar
senales descriptivas o acompanamiento solicitado.

Metricas base:

- nucleos registrados;
- integrantes por nucleo;
- porcentaje de personas con familia;
- hogares con ninos o adultos mayores;
- personas viudas, divorciadas o apartadas;
- hogares sin revision o contacto reciente, si existe ese registro.

### Comites

Pregunta principal: con que personas cuenta la congregacion para realizar
labores ministeriales y como estan distribuidas las responsabilidades.

Debe permitir:

- crear y activar/desactivar comites;
- seleccionar personas del censo, no de asistencia ni de Evangelismo;
- asignar integrantes y cargos;
- conservar historial;
- identificar comites sin integrantes o con cargos vacantes.

Metricas base:

- comites activos;
- personas en comites;
- cargos vigentes;
- personas con varias responsabilidades;
- comites sin integrantes;
- personas activas sin participacion, como oportunidad y no como defecto.

### Seguimiento pastoral

Pregunta principal: que personas requieren contacto, que se hizo y cual es el
proximo paso.

Debe permitir:

- agenda de pendientes, vencidos y proximos;
- tipo de situacion;
- accion realizada;
- responsable;
- fecha realizada;
- proximo contacto;
- notas necesarias y protegidas;
- estados pendiente, completado y cancelado;
- cierre de alertas con trazabilidad.

Metricas base:

- seguimientos pendientes;
- seguimientos vencidos;
- contactos proximos;
- casos completados;
- tiempo de atencion;
- alertas por familia, bautismo, asistencia individual o comite.

Acciones sugeridas: contactar, visitar, registrar resultado, programar proximo
contacto o remitir a la ruta correspondiente.

### Evolucion

Pregunta principal: como cambia la poblacion y donde conviene concentrar el
trabajo ministerial.

Debe mostrar con claridad:

- periodo exacto;
- poblacion analizada;
- unidad de medida;
- variacion porcentual y absoluta;
- advertencia cuando los datos sean insuficientes;
- distribucion por edades, estados, bautismo y estado civil;
- ingresos y cambios ministeriales cuando exista historial suficiente.

No debe presentarse como evolucion completa si solo mide ingresos. En ese caso
la etiqueta debe ser `Ingresos de poblacion` hasta que exista historial de
estados y eventos.

## 5. Red de Familias / DEFAM

Se propone un modulo separado en el Sidebar porque su finalidad es operar
programas, no administrar el censo.

Submodulos iniciales:

1. Panorama familiar.
2. Acompanamiento.
3. Visitas domiciliarias.
4. Consejeria y orientacion.
5. Talleres y escuela de familia.
6. Campanas y programas.
7. Reportes DEFAM.

Cada registro debe enlazar a una familia o persona existente. No debe crear
copias de nombres, edades, parentescos o estados civiles.

## 6. Criterios eticos

SIGA describe datos y facilita acompanamiento. No emite diagnósticos sociales,
clinicos ni familiares.

- No usar el campo `disfuncional`.
- No inferir problemas por viudez, divorcio, union libre, edad, pobreza,
discapacidad o composicion familiar.
- Usar expresiones neutrales: `requiere revision`, `acompanamiento solicitado`,
`visita pendiente` o `necesidad identificada`.
- Registrar solo la informacion necesaria para una accion concreta.
- Proteger notas sensibles con RLS y permisos diferenciados.
- Permitir correccion y trazabilidad de los seguimientos.
- Derivar situaciones de riesgo conforme a protocolos institucionales y la ley
aplicable.

## 7. Navegacion propuesta

Mantener Familias dentro de Feligresia. El arbol genealogico pertenece a la
fuente de verdad del censo.

Agregar Red de Familias como modulo independiente cuando exista su flujo
operativo. Desde Red de Familias se debe poder abrir la estructura familiar de
Feligresia en modo contextual, sin duplicar su administracion.

Orden sugerido del Sidebar local:

1. Resumen.
2. Feligresia.
3. Red de Familias.
4. Amigos en ruta.
5. Evangelismo.
6. Mision Juvenil.
7. Resto de herramientas operativas y administrativas.

El acceso al modulo y a las notas debe depender de permisos especificos. El
pastor conserva supervision; los integrantes del comite reciben solo el
alcance necesario para su labor.

## 8. Plan de ejecucion

### Etapa 1: fundamento y calidad

- aplicar y validar el modelo de Feligresia;
- validar aislamiento A/B con JWT reales;
- completar fecha de nacimiento, estado civil y parentescos;
- corregir estados de carga, error y permisos;
- aprobar arbol familiar con un caso real controlado.

### Etapa 2: decisiones de Feligresia

- completar metricas de poblacion, familias y comites;
- separar poblacion activa, apartados e historico;
- mejorar evolucion con historial de estados;
- agregar acciones desde cada insight;
- incorporar tabla alternativa accesible a los graficos.

### Etapa 3: Red de Familias

- crear tablas de programas, visitas, acompanamientos y actividades;
- definir permisos local, distrital y nacional;
- crear vistas agregadas sin duplicar Feligresia;
- agregar notificaciones y agenda;
- construir reportes DEFAM.

Estado de la primera entrega: implementados el modulo `/red-familias`, el
panorama de prioridades, acompanamientos, visitas domiciliarias y actividades
DEFAM. La base usa `red_familias.sql` y enlaza a `familias` y `personas` sin
duplicarlas.

### Etapa 4: validacion y despliegue

- matriz de roles y congregaciones;
- prueba de datos incompletos;
- prueba de duplicados y concurrencia;
- prueba de privacidad de notas;
- prueba de usabilidad con pastor y miembro del equipo;
- actualizar estado del proyecto y pendientes antes de produccion.

## 9. Criterios de aceptacion

- Cada modulo responde una pregunta de trabajo comprensible.
- Cada metrica declara poblacion, periodo y unidad.
- Cada insight propone una accion posible y no estigmatizante.
- Feligresia no mezcla datos extramurales.
- Red de Familias no duplica personas ni familias.
- Un Amigo solo pasa a Feligresia en estado bautizado.
- Una persona puede pertenecer a varios nucleos sin duplicarse.
- Los permisos visibles coinciden con RLS.
- Los graficos tienen resumen textual o tabla equivalente.
- La matriz A/B no muestra datos cruzados.
- Las decisiones pastorales quedan bajo responsabilidad humana.

## 10. Estado actual

Ya implementado:

- modelo inicial de Feligresia;
- fecha de nacimiento y estado civil;
- apartados diferenciados de Amigos;
- transferencia formal de Amigo bautizado a Feligresia;
- `familia_miembros` y `relaciones_familiares`;
- arbol familiar inicial;
- metricas y graficos iniciales de Evolucion;
- documentacion de criterios eticos.
- primera entrega de Red de Familias con Panorama, Acompanamiento, Visitas y
	Actividades;
- permisos `red_familias.consultar` y `red_familias.editar`;
- ruta protegida y entrada del Sidebar debajo de Feligresia.

Pendiente:

- ejecutar y validar la migracion completa en Supabase;
- construir el modulo Red de Familias;
- agregar notificaciones automaticas de agenda y cambios de casos;
- crear reportes DEFAM avanzados y filtros por periodo/responsable;
- crear historial formal de cambios ministeriales;
- validar usabilidad con usuarios finales;
- completar pruebas de seguridad, privacidad y concurrencia.
