# Permitir eliminar lecciones de REFAM/ESFOB/Discipulado — 2026-11-08

## Síntoma

El usuario pidió poder eliminar una lección desde "Módulos y
actividades" — hasta ahora solo se podía desactivar.

## Investigación antes de implementar

`refam_lecciones`, `esfob_lecciones` y `discipulado_lecciones` son
catálogos reales, y 6 tablas los referencian:
`refam_progreso_leccion`, `refam_notas_leccion`,
`esfob_progreso_leccion`, `esfob_notas_leccion`,
`discipulado_progreso_leccion`, `discipulado_notas_leccion` — todas
con `leccion_id ... on delete cascade`. Un `DELETE` directo sobre una
lección con historial real habría borrado en silencio el progreso y
las notas de acompañamiento de cada persona en esa lección, sin
ningún aviso — el mismo riesgo que ya se evitó con "eliminar persona
del censo" en noviembre.

## Corrección

**Migración** (`supabase/modulos/eliminar_lecciones_ruta.sql`,
pendiente de correr en producción): cambia las 6 referencias de
`on delete cascade` a `on delete restrict`. Así, Postgres bloquea solo
el borrado de una lección con progreso o notas reales (error
`23503`), y una lección recién creada por error, sin nadie que la
haya trabajado todavía, se puede borrar sin problema.

**Frontend** (`Modulos.jsx`): se agregó un botón "Eliminar" (ícono de
basura) junto al de activar/desactivar en las 3 listas de lecciones,
reutilizando el patrón de "deshacer" (`useUndoDelete`/`registerDelete`)
que el archivo ya usa para eliminar ujieres — sin `window.confirm`: el
borrado es inmediato y aparece un aviso de "Deshacer" por 8 segundos.
Si el borrado falla por `23503`, se muestra un mensaje claro
("esta lección ya tiene progreso o notas registradas... desactívala
en su lugar") en vez del error crudo de Postgres.

Commit `3e97725`, pusheado. **Pendiente, e IMPORTANTE: correr la
migración en producción antes de usar el botón nuevo** — sin ella, las
referencias siguen en `on delete cascade`, así que el botón Eliminar
ya funciona pero sin la protección: borraría una lección con historial
real sin avisar, en vez de bloquearlo con el mensaje claro.
