# Faltaba el tipo de comité al editar — 2026-11-08

## Síntoma

El usuario reportó que al crear un comité sí aparece la opción de
elegir el "Tipo de comité", pero si se crea sin elegirlo (algo que a
cualquiera se le puede olvidar) y luego se va a editar, no hay forma
de agregarlo o corregirlo.

## Causa

El diálogo de edición de un comité (`renameCommittee()` en
`FeligresiaAdmin.jsx`) nunca incluyó el campo `tipo_id` en su lista de
campos editables — solo nombre, código, descripción y fechas. El
formulario de **creación** (`CommitteeCreateForm`) sí lo tiene desde
antes.

## Corrección

Se agregó el mismo selector de tipo al diálogo de edición, en la
misma posición relativa que en el de creación (después de "código",
antes de "descripción"), reutilizando el catálogo ya cargado
(`committeeTypes`) y las mismas llaves de traducción del formulario de
creación — no hizo falta ninguna llave nueva.

Commit `6751116`, pusheado.

## Seguimiento el mismo día: cargo del integrante no se mostraba

El usuario mandó una captura real de la tarjeta de "Junta Local". En
ese momento se asumió que el tipo simplemente no estaba asignado
(comportamiento esperado) — **resultó ser una suposición incorrecta,
ver la corrección de abajo**. De paso, en esa misma captura se notó un
problema real: en el grupo "Otro" de integrantes, cada fila solo
mostraba el nombre de la persona, sin ningún indicio de qué cargo
desempeñaba.

`membresias_comite.cargo` (texto libre, se llena siempre que se
asigna un integrante — sea del catálogo `cargos_comite` o escrito a
mano) nunca se mostraba en la fila del integrante, solo el nombre.
Era más grave justo en el grupo "Otro" (quienes no calzan con el
catálogo activo de cargos), donde no había ninguna otra pista.

Corrección: se agrega `{member.cargo && <span> · {member.cargo}</span>}`
junto al nombre, reutilizando el mismo formato " · {cargo}" que ya se
usaba en otra parte de este mismo archivo (la ficha de la persona,
línea 119). Commit `24b23ff`, pusheado.

## Corrección real: la suposición de "comportamiento esperado" era falsa

El usuario probó de verdad: editó "Junta Local", eligió un tipo,
guardó — y nunca apareció. Lo repitió 3 veces con el mismo resultado
y lo reportó. Causa real: el `select()` de `comites` en `load()`
**nunca pedía la columna `tipo_id`** a Supabase. El `UPDATE` sí
guardaba el valor correctamente en la base de datos, pero la pantalla
jamás lo volvía a traer — ni en la tarjeta ni al reabrir "Editar"
(que por eso siempre mostraba "Sin tipo" de nuevo, dando la impresión
de que cada intento se perdía).

Corrección: se agregó `tipo_id` a la lista de columnas de ese
`select()`. Commit `328bbaf`, pusheado. **Lección**: la primera
hipótesis ("este comité nunca tuvo tipo asignado") sonaba razonable
pero no se verificó contra el código real antes de darla por buena —
el usuario tuvo que probarlo tres veces para demostrar que sí era un
bug.

## Mismo día, mismo hueco: el responsable tampoco se podía editar

El usuario pidió, en la misma pantalla, poder cambiar el responsable
del comité (y su fecha) al editarlo — mismo problema exacto que el
tipo: `renameCommittee()` nunca tenía campo para `responsable_id`,
solo se podía elegir al crear. Las fechas de inicio/fin del comité ya
eran editables desde antes (no hacía falta tocar nada ahí).

Se agregó el mismo selector que ya usa `CommitteeCreateForm`
(`analyticsPeople` filtrado a personas activas), reutilizando sus
llaves i18n. Esta vez, antes de dar el cambio por terminado, se
verificó explícitamente que `responsable_id` sí estuviera en el
`select()` de `comites` (ya lo estaba) — para no repetir el mismo
error que con `tipo_id`.

Commit `0a753bf`, pusheado.
