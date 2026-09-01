# Corrección: nombre del pastor no se actualizaba tras un traslado (2026-09-01)

## Síntoma reportado por el usuario

Después de asignar un pastor a una congregación (vía "Trasladar pastor" en
Pastoral Distrital), el nombre que se muestra donde debería ir "el nombre
del pastor" seguía mostrando a la persona anterior (en este caso, "Usuario
de Pruebas").

## Causa real (confirmada leyendo el código, no supuesta)

`congregaciones` guarda el nombre del pastor de dos formas distintas:

1. `pastor_id` → referencia real a `pastores.id` (la fuente de verdad,
   usada por todo el sistema de traslados/licencias).
2. `pastor_nombre` → un campo de texto **duplicado**, usado solo para
   mostrar el nombre sin tener que hacer join, en:
   `src/pages/Dashboard.jsx` (tabla comparativa distrital y el conteo de
   "vacantes"), `src/pages/Aprobaciones.jsx`, y la función
   `resumen_distrital()`.

`registrar_pastor_con_acceso()` (para un pastor nuevo en una congregación
vacante) sí sincronizaba ambos campos correctamente. Pero
`trasladar_pastor()` (`supabase/gestion_pastoral_distrital_v2.sql`) —
la función que se usa para mover a un pastor **ya existente** a otra
congregación — solo actualizaba `pastor_id` en la congregación de origen y
destino, y **nunca tocaba `pastor_nombre`**. Resultado: después de un
traslado, la congregación destino seguía mostrando el nombre del pastor
que tenía *antes* del traslado (o el de cuando se creó la congregación), y
la de origen seguía mostrando al pastor que ya se fue, en vez de aparecer
como "Vacante".

**Hallazgo adicional en el camino**: `congregaciones.pastor_nombre` tenía
`NOT NULL` desde el esquema original (`schema.sql`), pero el propio
`Dashboard.jsx` ya esperaba que pudiera quedar vacío para una congregación
sin pastor (`c.pastor_nombre || 'Vacante'`, `!c.pastor_nombre` para contar
vacantes) — esa restricción nunca se había relajado para permitirlo de
verdad.

## Corrección aplicada (`supabase/gestion_pastoral_distrital_v2.sql`)

1. `alter table congregaciones alter column pastor_nombre drop not null;`
   — para que "vacante" se pueda representar de verdad como `null`.
2. `trasladar_pastor()`: ahora actualiza `pastor_nombre` en **ambos** lados
   del traslado — `null` en la congregación de origen (queda vacante de
   verdad) y el nombre completo del pastor en la de destino, igual que ya
   hacía `registrar_pastor_con_acceso()`.
3. **Corrección de datos de una sola vez** (segura de repetir): un
   `update congregaciones set pastor_nombre = ...` que recalcula el
   nombre de **todas** las congregaciones a partir de su `pastor_id` real,
   para arreglar cualquier congregación que haya quedado desincronizada
   por este bug antes de la corrección — incluida la que reportó el
   usuario.

El archivo sigue siendo idempotente (ya lo era, "Es repetible"), así que
**hay que volver a ejecutar el archivo completo
`supabase/gestion_pastoral_distrital_v2.sql` en el SQL Editor** para que
la corrección de la función Y la corrección de datos queden aplicadas.

## Impacto

Cambio seguro: solo agrega sincronización donde antes no la había y
relaja una restricción para permitir un estado que la propia aplicación
ya esperaba. No cambia el comportamiento de ninguna otra función.

## Segundo hallazgo, al intentar aplicar la corrección

Al volver a ejecutar el archivo, Supabase devolvió:

```
ERROR: 42P13: cannot change return type of existing function
HINT: Use DROP FUNCTION resumen_distrital(uuid) first.
```

Causa: `resumen_distrital()` estaba definida **dos veces** en el repo —
en `gestion_pastoral_distrital_v2.sql` (11 columnas, la versión original)
y en `bi_fase2_insights.sql` (19 columnas, con `drop function if exists`
propio, y que su encabezado ya indica que se ejecuta *después* de este
archivo). Como la versión de 19 columnas ya estaba aplicada en la base
real, volver a correr la versión vieja de 11 columnas chocaba con el
error clásico de Postgres al intentar cambiar la lista de columnas de una
`returns table(...)` sin borrarla primero.

**Corrección**: se retiró la definición vieja de `resumen_distrital()` de
`gestion_pastoral_distrital_v2.sql` — la función sigue existiendo y
funcionando igual, su definición vigente es la de `bi_fase2_insights.sql`
(que ya incluye `pastor_nombre`, así que la corrección de
`trasladar_pastor()` se refleja igual ahí). Esto también deja
`gestion_pastoral_distrital_v2.sql` genuinamente repetible otra vez, sin
depender de en qué orden se haya ejecutado todo antes.
