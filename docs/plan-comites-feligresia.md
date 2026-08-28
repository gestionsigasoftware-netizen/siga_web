# Plan funcional: Comités dentro de Feligresía

Fecha: 28 de agosto de 2026
Estado: Especificación para ejecución por etapas

## 1. Decisión de arquitectura

Comités permanecerá como submódulo de Feligresía:

```text
Feligresía
  ├── Población
  ├── Familias
  ├── Comités
  ├── Seguimiento pastoral
  └── Evolución
```

La decisión se basa en que los comités se alimentan directamente del censo
ministerial. Sus integrantes son personas de Feligresía, sus familias y
estados ministeriales pertenecen a ese dominio, y sus cargos representan el
recurso humano disponible para servir localmente.

No se creará un segundo censo ni otra tabla de personas.

## 2. Cuándo podría convertirse en módulo independiente

La funcionalidad podría extraerse posteriormente a un módulo del Sidebar si
se requiere administrar comités locales, distritales y nacionales con reglas,
permisos, periodos, actas, reuniones, tareas y reportes institucionales
propios.

En ese escenario, el módulo podría llamarse `Organización ministerial` o
`Comités y responsabilidades`, pero seguiría consumiendo personas y familias
desde Feligresía.

## 3. Propósito del submódulo

Comités debe responder:

- ¿Qué comités activos tiene la congregación?
- ¿Cuál es el propósito y estado de cada comité?
- ¿Quiénes lo integran?
- ¿Quién es responsable de cada función?
- ¿Qué cargos están ocupados o vacantes?
- ¿Desde cuándo está vigente cada responsabilidad?
- ¿Quién reemplazó a quién y por qué?
- ¿Qué personas están disponibles para servir?
- ¿Hay concentración excesiva de responsabilidades en pocas personas?

## 4. Alcance de la primera etapa

### Catálogo de comités

Cada comité debe tener:

- nombre;
- código interno;
- tipo o área ministerial;
- descripción y propósito;
- estado activo/inactivo;
- fecha de inicio;
- fecha de finalización opcional;
- responsable principal;
- observaciones.

El catálogo debe poder adaptarse a la estructura aprobada por la
congregación y no debe imponer nombres institucionales que aún no hayan sido
confirmados.

### Catálogo de cargos

Los cargos no deben depender únicamente de texto libre. Cada cargo debe poder
definir:

- nombre;
- código;
- descripción de la responsabilidad;
- si es obligatorio;
- si puede existir una sola vez por comité;
- si admite suplente;
- orden de presentación.

Ejemplos posibles: presidente, secretario, tesorero, vocal, coordinador,
integrante, asesor y suplente. Estos nombres deben poder ajustarse a las
reglas institucionales de la IPUC.

### Integrantes y responsabilidades

Cada asignación debe registrar:

- comité;
- persona del censo de Feligresía;
- cargo normalizado;
- fecha de inicio;
- fecha de finalización;
- estado vigente/histórico;
- motivo de retiro;
- persona reemplazada o reemplazo relacionado;
- observaciones;
- usuario que realizó el cambio.

Una persona puede participar en varios comités, pero el sistema debe mostrar
la cantidad de responsabilidades para evitar sobrecarga involuntaria.

## 5. Reglas de integridad

- Solo se pueden asignar personas de la misma congregación.
- No debe existir la misma persona dos veces activa en el mismo comité.
- Los cargos configurados como únicos no pueden repetirse dentro del comité.
- Una fecha final no puede ser anterior a la fecha inicial.
- No deben existir periodos activos superpuestos para el mismo cargo único.
- Un responsable debe pertenecer a la congregación correspondiente.
- Retirar una persona debe cerrar su vigencia, no borrar su historial.
- Un reemplazo debe poder registrar fecha efectiva y motivo.
- Desactivar un comité no debe borrar integrantes ni responsabilidades
  históricas.
- Las validaciones deben existir en SQL/RLS, no solamente en React.

## 6. Permisos

Se deben separar las capacidades:

- `comites.consultar`: ver comités, integrantes y cargos permitidos.
- `comites.editar`: crear y modificar comités y responsabilidades.
- `comites.gestionar_integrantes`: asignar, retirar y reemplazar integrantes.
- `comites.gestionar_catalogo`: administrar cargos y tipos de comité.
- `comites.consultar_historial`: consultar cambios y vigencias históricas.

El pastor local conserva supervisión general. Un líder de comité puede recibir
permisos sobre su comité, sin obtener acceso irrestricto a toda la
administración de Feligresía. Los perfiles de consulta solo deben ver la
información autorizada.

## 7. Niveles de alcance

La primera etapa se limita a comités locales de una congregación.

El soporte distrital y nacional requiere posteriormente un modelo con:

- nivel de organización;
- distrito o congregación propietaria;
- comité institucional;
- delegados o representantes;
- permisos por alcance;
- reportes consolidados.

No se deben simular comités distritales o nacionales usando solamente
`congregacion_id`.

## 8. Experiencia de usuario

La sección debe conservarse como pestaña dentro de Feligresía porque comparte
contexto con Población y Familias.

La vista recomendada incluye:

1. Resumen de comités activos.
2. Filtros por estado, área, cargo e integrante.
3. Buscador remoto de personas del censo.
4. Tarjetas o tabla de comités.
5. Estado de cargos: ocupado, vacante o vencido.
6. Panel de integrantes vigentes.
7. Historial de cambios.
8. Acción clara para reemplazar una responsabilidad.
9. Acceso a la ficha de la persona.
10. Mensajes de carga, error, vacío y permiso.

Los controles de escritura deben ocultarse para perfiles sin permiso. El
usuario de consulta no debe ver formularios ni botones que luego fallen por
RLS.

## 9. Métricas para toma de decisiones

El submódulo debe ayudar al pastor y a la junta local a responder:

- ¿Cuántos comités están activos?
- ¿Cuántos cargos están ocupados?
- ¿Cuántas vacantes existen?
- ¿Qué comités no tienen integrantes?
- ¿Qué comités tienen un responsable vigente?
- ¿Cuántas personas sirven en uno, dos o varios comités?
- ¿Qué personas activas aún no participan en un comité?
- ¿Qué cargos vencen próximamente?
- ¿Qué comités requieren reorganización?

Las métricas deben diferenciar oportunidad de juicio. Una persona sin cargo
no es una deficiencia; puede ser una persona disponible, nueva o asignada a
otra labor.

## 10. Insights y acciones

Cada insight debe combinar dato, interpretación prudente y acción:

- **Cargo vacante:** revisar candidatos elegibles y programar designación.
- **Comité sin integrantes:** confirmar si sigue activo o asignar equipo.
- **Responsabilidad próxima a vencer:** revisar continuidad o reemplazo.
- **Persona con varias responsabilidades:** conversar sobre carga y
  disponibilidad.
- **Persona activa sin participación:** explorar dones, interés y formación,
  sin asumir obligación de servir.
- **Comité sin responsable:** asignar responsable o dejar constancia de
  transición.

No deben generarse etiquetas negativas sobre personas ni inferencias sobre su
valor, compromiso o espiritualidad a partir de una métrica.

## 11. Auditoría y privacidad

Deben auditarse:

- creación y edición de comités;
- alta, retiro y reemplazo de integrantes;
- cambios de cargos;
- cambios de responsables;
- activación y desactivación;
- modificaciones de catálogo.

Las notas sensibles no deben guardarse en campos públicos sin necesidad. La
visibilidad debe seguir el alcance de la congregación y el permiso del usuario.

## 12. Plan de ejecución

Estado de ejecución al 28 de agosto de 2026: las Etapas A y B tienen la base
SQL y parte de la interfaz implementadas; la Etapa C tiene métricas, insights,
historial y exportación iniciales. Los pendientes concretos se mantienen en
`docs/ejecucion-etapa-c-comites-2026-08-28.md` y no se consideran terminados
hasta su validación en Supabase.

### Etapa A: normalización

- Crear catálogo de cargos y tipos de comité.
- Mantener compatibilidad con cargos históricos existentes.
- Añadir códigos, responsables y vigencias.
- Crear restricciones de fechas y unicidad.

### Etapa B: operación

- Mejorar formulario de comité.
- Mejorar asignación y retiro de integrantes.
- Añadir reemplazo transaccional.
- Incorporar búsqueda remota de personas.
- Añadir filtros de comité, cargo, estado y vigencia.

### Etapa C: análisis

- Métricas de vacantes, cobertura y concentración de responsabilidades.
- Insights con acción concreta.
- Historial visible y exportación específica.
- Tabla alternativa para accesibilidad.

### Etapa D: permisos y alcance

- Aplicar permisos específicos.
- Definir el alcance real de líderes de comité.
- Probar pastor, consulta, estadísticas y líder autorizado.
- Diseñar posteriormente el alcance distrital/nacional.

### Etapa E: validación

- Pruebas de duplicados y concurrencia.
- Pruebas de fechas superpuestas.
- Pruebas de reemplazos.
- Prueba A/B de aislamiento entre congregaciones.
- Pruebas de lectura y escritura por perfil.
- Validación de usabilidad con pastor y responsable de comité.

### Pendientes identificados

- Completar la búsqueda remota de personas del censo para asignaciones; la
  interfaz actual carga una lista local.
- Completar la edición avanzada del responsable y tipo desde el detalle del
  comité.
- Crear la interfaz de administración de tipos y cargos normalizados.
- Mostrar y editar responsable y tipo en el detalle del comité.
- Aplicar permisos específicos `comites.consultar`, `comites.editar`,
  `comites.gestionar_integrantes`, `comites.gestionar_catalogo` y
  `comites.consultar_historial` en RLS y controles de la interfaz.
- Completar la tabla alternativa accesible del análisis y los filtros de
  historial.
- Ejecutar contra Supabase las pruebas de duplicados, concurrencia, fechas,
  reemplazos, aislamiento entre congregaciones y perfiles autorizados.
- Validar que las métricas de vencimiento utilicen tanto responsabilidades
  vigentes como responsabilidades con fecha próxima de finalización.

## 13. Criterios de aceptación

- Comités sigue ubicado dentro de Feligresía.
- Todos los integrantes provienen del censo ministerial.
- No se mezclan personas de Amigos, Evangelismo o asistencia extramural.
- Los cargos importantes pueden identificarse sin depender de texto libre.
- El sistema identifica vacantes y responsabilidades vencidas.
- Los reemplazos conservan historial y motivo.
- Una persona puede pertenecer a varios comités sin duplicar su ficha.
- Las métricas declaran población y periodo.
- Los insights proponen acciones concretas y respetuosas.
- Los permisos visibles coinciden con RLS.
- La información de una congregación no aparece en otra.
- El módulo es útil para decisiones locales antes de ampliar su alcance.

## 14. Estado actual

Actualmente existe un registro local básico de comités, integrantes, cargos de
texto libre, fechas y auditoría. La siguiente implementación debe fortalecer
ese submódulo sin convertirlo todavía en una pantalla independiente del
Sidebar.
