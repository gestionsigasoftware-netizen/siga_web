# Editar/Trasladar pastor: buscador de congregación y corrección de licencia (2026-09-03)

## Bug reportado: "Editar" y "Trasladar" no hacían nada

El usuario probó con su único pastor (Damil Lerma) y ni "Editar" ni
"Trasladar" parecían funcionar. Causa real: los formularios
correspondientes ("Editar pastor" y "Trasladar pastor") están más
arriba en la página que la lista de pastores donde están esos botones.
Al hacer clic, el formulario sí se llenaba con los datos correctos —
solo que quedaba fuera de la vista, sin ningún indicio visual de que
había pasado algo.

**Corrección**: ambos botones ahora hacen scroll automático
(`scrollIntoView({ behavior: 'smooth' })`) hacia su formulario
correspondiente al hacer clic.

## Pedido 1: buscador para elegir congregación en "Editar pastor"

El campo "Congregación" del formulario de editar/registrar pastor era
un `<select>` nativo. Se cambió al mismo patrón de buscador con
autocompletado ya usado en Equipo de trabajo y en "Registrar nueva
congregación" (texto + lista filtrada + clic para elegir). Al abrir el
editor de un pastor, el buscador ya arranca con el nombre de su
congregación actual escrito.

## Pedido 2: poder corregir la licencia ministerial directamente

Ya existía "Ascender licencia ministerial" (más abajo en la página),
que mueve a un pastor exactamente un nivel hacia adelante (Obrero →
Licencia Local → Licencia General → Ordenación) y nunca retrocede ni
salta niveles — es una regla de negocio real de la IPUC, a propósito.

El usuario pidió explícitamente poder **corregir** la licencia
libremente (ej. si se capturó mal desde el inicio), no ascenderla. Se
le preguntó para no romper esa regla de negocio sin querer, y confirmó
que quería la corrección libre como una vía aparte.

**Solución**: nueva función `corregir_licencia_pastor(pastor_id,
licencia, observaciones)`, independiente de `ascender_licencia_pastor`
— permite fijar cualquiera de los 4 niveles directamente. Queda
registrada en el mismo `historial_licencias_pastorales`, pero con una
columna nueva `tipo` (`ascenso` / `correccion`) para no mezclarse
visualmente con los ascensos reales — el historial ahora muestra una
etiqueta "Corrección" en las que vinieron de aquí.

En el formulario "Editar pastor" apareció un select "Licencia
ministerial" (solo visible al editar, no al registrar uno nuevo) con
los 4 niveles y una nota aclarando la diferencia con el ascenso real.
Al guardar, si el valor cambió respecto al que tenía, se llama a
`corregir_licencia_pastor`.

## Verificación

`npm run build` corre limpio.

## Acción requerida del usuario

Ejecutar `supabase/corregir_licencia_pastor.sql` (agrega la columna
`tipo` al historial y crea la función).
