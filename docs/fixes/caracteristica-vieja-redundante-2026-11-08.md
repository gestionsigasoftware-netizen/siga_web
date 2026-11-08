# Campo viejo "Característica" quitado de Módulos y actividades — 2026-11-08

## Síntoma

El usuario notó que, al crear un culto en "Módulos y actividades", el
formulario tenía un segundo input con placeholder "Característica", y
que cada culto mostraba esa característica como una etiqueta azul
debajo del nombre (ej. "Jueves" → "Oración", "Sábado" → "Jóvenes").
Con el catálogo real de `caracteres_culto` ya existente (ver
`docs/fixes/caracter-culto-faltante-correccion-contingencia-2026-11-08.md`),
ese campo de texto libre quedó redundante y confuso.

## Causa

`tipos_actividad.caracter` es un campo de texto libre, más viejo que
el catálogo `caracteres_culto` (una tabla real, administrable,
reutilizable entre cultos). Nunca se eliminó del formulario de
creación ni de los desplegables cuando se agregó el catálogo nuevo.

## Corrección (solo UI, sin tocar la base de datos)

- **`Modulos.jsx`**: se quita el input "Característica (opcional)"
  del formulario de creación de culto, y la etiqueta azul que lo
  mostraba en la lista de cultos de un módulo.
- **`RegistrarAsistencia.jsx`** (web) y **`CapturaActividad.jsx`**
  (PWA): se quita el " — {característica}" que se pegaba al nombre
  del tipo de actividad en el desplegable de "¿Qué culto registras?".

La columna `tipos_actividad.caracter` **no se borró** de la base de
datos — los datos históricos siguen ahí, solo se dejó de capturar y
de mostrar en la interfaz. Si en el futuro se decide limpiarla de
verdad, sería un paso aparte (migración + verificar que nada más la
lea).

Commits `5ba7c6a` (web) + `f6e5ee9` (PWA), pusheados.
