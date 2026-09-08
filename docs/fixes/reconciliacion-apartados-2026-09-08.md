# Reconciliación de apartados como estadística propia — 2026-09-08

## Contexto

El usuario compartió el testimonio real de un líder distrital de la
IPUC describiendo cómo se recogen hoy las estadísticas en el terreno.
Entre lo que reporta cada trimestre está "cuántas personas se
reconciliaron" -- concepto que el usuario aclaró explícitamente:

> "reconciliado es igual que apartado es decir ya en feligresia
> manejamos apartados ahi deberiamos medir cuantos de esos apartados
> se vuelven reconciliados"

Es decir: no es un estado nuevo, es medir cuántas personas en estado
`apartado` vuelven a `activo`.

## Hallazgo

- `movimientos_membresia.tipo` ya incluía `'reactivacion'` en su
  check constraint y ya tenía su etiqueta en español
  (`MOVIMIENTO_LABELS`), pero era solo una bitácora manual: registrar
  el movimiento nunca actualizaba `personas.estado_membresia`. El
  pastor tenía que además editar por separado el `<select>` de Estado
  -- dos pasos sueltos, sin garantía de que se hicieran juntos.
- El Dashboard agrupaba movimientos de los últimos 90 días por
  prefijo `alta_`/`baja_` para su tarjeta de resumen -- `'reactivacion'`
  no calzaba en ninguno de los dos, así que desaparecía silenciosamente
  del conteo.
- No existía ninguna tarjeta ni cifra que respondiera directamente
  "¿cuántos apartados se reconciliaron?", que es justo la pregunta que
  hoy se reporta a mano cada trimestre.

## Construido

1. **`src/pages/FeligresiaAdmin.jsx`**: nueva función
   `reconciliarPersona(person)` (patrón `setDialog` de confirmación,
   igual que `deactivateCommittee`) que en un solo paso: actualiza
   `personas.estado_membresia = 'activo'` e inserta el movimiento
   `tipo: 'reactivacion'` en `movimientos_membresia`. Nuevo botón
   "Reconciliar" en la ficha de la persona (`PersonFormEditor`), junto
   al selector de Estado, visible solo cuando la persona está
   `apartado`. El `<select>` manual de Estado se deja intacto como vía
   alterna.
2. **`src/pages/Dashboard.jsx`**: el conteo de movimientos de 90 días
   ahora separa `reconciliaciones` (`tipo === 'reactivacion'`) de
   `altas`/`bajas`, en vez de perderlo. Nueva tarjeta "Reconciliados"
   junto a la de "Apartados" (grid ajustado de 5 a 6 columnas).

## Verificación

`npm run build` sin errores. Verificado contra la base real
(congregación Puerto Tejada Cauca Central, cuenta de prueba): se creó
una persona de prueba en estado `apartado`, se simuló exactamente la
lógica de `reconciliarPersona` (update + insert), se confirmó que el
estado final queda en `activo` y que el conteo de `reactivacion` en
los últimos 90 días la captura correctamente. Se limpió la persona y
el movimiento de prueba; se confirmó cero residuos.
