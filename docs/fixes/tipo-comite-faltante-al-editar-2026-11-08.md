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

El usuario mandó una captura real de la tarjeta de "Junta Local"
confirmando que, en efecto, el tipo no aparecía (ese comité en
particular nunca tuvo uno asignado — comportamiento esperado, no
bug). Pero de paso notó un problema real: en el grupo "Otro" de
integrantes, cada fila solo mostraba el nombre de la persona, sin
ningún indicio de qué cargo desempeñaba.

`membresias_comite.cargo` (texto libre, se llena siempre que se
asigna un integrante — sea del catálogo `cargos_comite` o escrito a
mano) nunca se mostraba en la fila del integrante, solo el nombre.
Era más grave justo en el grupo "Otro" (quienes no calzan con el
catálogo activo de cargos), donde no había ninguna otra pista.

Corrección: se agrega `{member.cargo && <span> · {member.cargo}</span>}`
junto al nombre, reutilizando el mismo formato " · {cargo}" que ya se
usaba en otra parte de este mismo archivo (la ficha de la persona,
línea 119). Commit `24b23ff`, pusheado.
