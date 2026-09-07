# Botón "Reasignar comité" independiente del traslado — 2026-09-07

## Contexto

Cuarto y último ítem del plan de cierre del rediseño Ruta
Evangelística + comités. Responde a la pregunta que el propio usuario
pidió ayuda a decidir durante el diseño: ¿el comité responsable de una
persona debe trasladarse definitivamente, o debe poder ser temporal?

Decisión (ya tomada en la discusión de diseño, ver memoria de
proyecto): no se crea un mecanismo de temporalidad nuevo -- el modelo
ya construido (responsable atado a la fila activa de la estación
actual, historial preservado en filas cerradas) ya es "temporal" en el
sentido correcto. El gap real era otro: **no existía forma de cambiar
el comité responsable sin también cambiar de estación** (la única vía
era "Trasladar", que siempre exige una estación destino). Esta pieza
cierra ese gap.

## Hallazgo antes de construir

El único precedente existente para "actualizar responsable sin mover
de estación" era el cortocircuito de `iniciarOMoverEstacion()` (cuando
alguien ya está activo en la estación destino) -- pero ese
cortocircuito **solo actualiza `ruta_procesos`**, nunca las columnas
espejo `esfob_procesos.responsable_comite_id` ni
`discipulado_procesos.mentor_comite_id`, que son las que las pantallas
de ESFOB/Discipulado realmente leen (`config.table` en
`RutaFormacion.jsx`). Reutilizar ese cortocircuito tal cual habría
dejado la ficha desincronizada.

## Construido

**`src/lib/rutaEvangelistica.js`** -- nueva función
`reasignarComiteResponsable({ procesoId, estacionCodigo, nuevoComiteId })`:
- Rechaza estaciones persona-only (Uno Más/BIS) usando
  `TIPO_RESPONSABLE_ESTACION`, igual que el resto del módulo.
- Actualiza `ruta_procesos.responsable_comite_id` (y limpia
  `responsable_persona_id`).
- Si la estación es `esfob` o `discipulado`, además actualiza la fila
  correspondiente de `esfob_procesos`/`discipulado_procesos` (match
  por `proceso_id`, la misma columna que `trasladarEstacion` ya usa
  para vincular ambas tablas). REFAM no tiene columna espejo en
  `refam_participantes`, así que ahí basta con `ruta_procesos`.

**UI -- reutiliza el select de comité que ya existía junto al
traslado (`trasladoComite`), sin agregar estado nuevo:**
- `src/pages/EstacionRefam.jsx`: nuevo botón "Reasignar comité" junto
  al trío de traslado en la lista de activos.
- `src/pages/RutaFormacion.jsx` modo `esfob`: mismo botón junto al
  trío de traslado ya existente en el panel de ficha.
- `src/pages/RutaFormacion.jsx` modo `discipulado`: **no existía
  ningún bloque de traslado** (correcto, es la última estación) -- se
  agregó un bloque nuevo y pequeño (solo select de comité + botón,
  sin selector de estación destino) debajo del formulario de
  seguimiento.

## Verificación

Contra la base de datos real (congregación Puerto Tejada Cauca
Central), con el usuario de prueba `pueba691@gmail.com`, usando dos
comités reales de la congregación:

1. REFAM: reasignación actualiza `ruta_procesos.responsable_comite_id`
   y limpia `responsable_persona_id`.
2. ESFOB: reasignación actualiza **tanto** `ruta_procesos` **como**
   `esfob_procesos` (columna espejo), limpiando el mentor-persona en
   ambas.
3. Discipulado: reasignación actualiza `discipulado_procesos.mentor_comite_id`
   y limpia `mentor_persona_id`.
4. BIS (persona-only) rechaza correctamente un intento de reasignar
   comité.
5. Limpieza completa, sin residuos.

`npm run build` sin errores.

## Cierre del plan

Con esta pieza se completa el plan de cierre del rediseño Ruta
Evangelística + comités (ver
`C:\Users\T460s\.claude\plans\giggly-gliding-sun.md` y la memoria de
proyecto `project_siga_ruta_evangelistica_2026_09.md`): comité como
responsable, catálogo de rangos de edad, sugerencia visible, Vincular
en Misión Juvenil, Vincular en la entrada inicial de Obra Carcelaria,
y este botón de reasignación.
