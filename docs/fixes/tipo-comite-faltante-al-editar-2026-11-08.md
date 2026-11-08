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
