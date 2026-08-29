# Auditoría de alineación: Ruta Evangelística y SIGA

Fecha: 28 de agosto de 2026
Estado: auditoría preliminar para decisión de arquitectura

## Conclusión ejecutiva

La implementación actual de SIGA está parcialmente alineada con la Ruta Evangelística descrita, pero no representa todavía las seis estaciones como módulos operativos. Actualmente `amigos.etapa_id` funciona como un estado lineal de avance de una persona:

`Contactado -> Visitado -> Asistió -> En seguimiento -> Convertido`

Las seis estaciones de la Ruta Evangelística son procesos con propósito, responsables y resultados diferentes:

`Métodos -> Uno Más -> BIS -> REFAM -> ESFOB/EFOB -> Discipulado`

Por tanto, no deben reemplazarse directamente las etapas actuales por los nombres de las estaciones.

## Comparación

| Ruta actual en SIGA | Relación posible | Hallazgo |
|---|---|---|
| Contactado | Inicio de Métodos o Uno Más | Es un estado de contacto, no evidencia de diagnóstico ni compromiso del miembro. |
| Visitado | Uno Más o BIS | Puede registrar una visita, pero no demuestra que se haya completado el proceso BIS. |
| Asistió | BIS | Se aproxima al primer contacto con el templo, pero BIS también requiere atención, integración y seguimiento posterior. |
| En seguimiento | BIS, REFAM o acompañamiento general | Es demasiado amplio para saber si la persona está en enseñanza bíblica, consolidación o acompañamiento. |
| Convertido | Bautismo / salida de ESFOB | Es ambiguo: el código actual marca `convertido` y `estado_espiritual='bautizado'`, pero no registra ESFOB, fecha de bautismo ni paso a Discipulado como estación independiente. |

## Lo que ya existe

- `Evangelismo`: análisis territorial, zonas, metodologías y registros agregados.
- `Amigos en ruta`: ficha individual, etapas, zonas, notas, historial de etapas, métricas y conversión.
- `Red de Familias`: módulo administrativo separado para casos y visitas familiares; no es REFAM.
- `Feligresía`: censo ministerial; un amigo solo se incorpora mediante la RPC de bautizados.
- `Misión Juvenil`: instituciones, estudiantes, grupos juveniles y aplicación juvenil de REFAM.
- `registros_actividad`: contrato común para capturas agregadas de Evangelismo y otros módulos.

## Brechas frente a las seis estaciones

### Métodos: caracterización y diagnóstico

Existe base territorial en Evangelismo, pero faltan diagnóstico comunitario estructurado, necesidades, perfiles de población, estrategia elegida y resultado del diagnóstico.

### Uno Más: tarea de todos

No existe como proceso explícito. `invitado_por` registra una referencia, pero no identifica miembro responsable, persona objetivo, compromiso, fecha de seguimiento ni resultado.

### BIS: bienvenida, integración y seguimiento

`Amigos en ruta` cubre registro, primer contacto y seguimiento básico, pero no separa llegada al templo, atención durante la visita, contacto posterior, integración y derivación a la estación REFAM.

### REFAM: enseñanza personalizada

La estación REFAM no existe todavía como proceso formal en SIGA: faltan reuniones familiares y de amistad, anfitrión, lecciones, avance y resultado. REFAM puede desarrollarse también en Misión Juvenil como estrategia evangelística juvenil. `Red de Familias` es un módulo distinto y no debe usarse como sustituto.

### ESFOB/EFOB: formación bautismal

No existe un subproceso específico de formación bautismal, asistencia a lecciones, avance, aprobación o fecha prevista de bautismo.

### Discipulado: formar y crecer

No existe como etapa operativa posterior al bautismo. La incorporación a Feligresía no equivale por sí sola a discipulado.

## Decisión arquitectónica recomendada

Se recomienda una organización superior llamada **Misiones y Evangelismo** o **Ruta Evangelística**, pero no se debe renombrar ni eliminar de inmediato el módulo técnico `Evangelismo` porque la PWA, `registros_actividad`, metodologías y consultas existentes dependen de ese contrato.

La opción más segura es:

- Mantener `Evangelismo` como nombre técnico de datos y compatibilidad.
- Cambiar progresivamente el nombre visible a **Misiones y Evangelismo** si la congregación aprueba esa denominación.
- Incorporar submódulos de la Ruta Evangelística dentro de esa experiencia, sin duplicar personas ni registros.
- Mantener `Red de Familias` como módulo funcional propio, sin convertirlo en REFAM. La relación futura debe enlazar REFAM con Misiones/Evangelismo y, cuando corresponda, con Misión Juvenil, sin reutilizar la pantalla administrativa familiar como sustituto.
- Mantener `Amigos en ruta` como ficha individual de personas en proceso, evolucionándola hacia BIS y las derivaciones de la ruta.
- Mantener `Feligresía` como destino ministerial posterior al bautismo, no como sustituto de ESFOB o Discipulado.

## Modelo recomendado para datos

Separar dos conceptos:

1. **Estación de la ruta:** Métodos, Uno Más, BIS, REFAM, ESFOB y Discipulado.
2. **Estado de la persona:** contactado, visitado, asistió, en seguimiento, bautizado, incorporado y otros estados institucionales aprobados.

Una persona debe poder tener una estación activa, historial de estaciones, responsable, fecha de inicio, fecha de cierre, resultado y derivación. El estado actual no debe borrar ni reemplazar el historial.

## Recomendación de siguiente implementación

1. Confirmar con la dirección de la IPUC los nombres, orden y criterios de salida de las seis estaciones.
2. Crear catálogo configurable de estaciones y resultados, sin alterar aún `etapas_seguimiento`.
3. Añadir historial de estaciones y responsables para Amigos.
4. Crear el proceso REFAM dentro de Misiones/Evangelismo y vincular Amigos con sus reuniones mediante una relación explícita, no solo por nombres o notas.
5. Crear el subproceso ESFOB/EFOB antes de usar `bautizado` como única señal de conversión.
6. Crear Discipulado como proceso posterior al bautismo.
7. Conservar la regla: solo una persona bautizada puede pasar a Feligresía.
8. Ejecutar pruebas con una congregación piloto antes de cambiar el nombre visible del Sidebar.

## Decisión sobre las etapas actuales

Las etapas actuales pueden conservarse como compatibilidad y como estados resumidos durante la transición. No deben presentarse como las seis estaciones oficiales sin añadir el modelo de estación, actividades, responsables y resultados.
