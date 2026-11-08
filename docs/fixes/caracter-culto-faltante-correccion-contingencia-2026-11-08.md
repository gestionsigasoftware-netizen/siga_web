# Faltaba el selector de "Carácter del culto" en Corrección y Contingencia — 2026-11-08

## Síntoma

El usuario creó varios "caracteres de culto" (Enseñanza, Alabanza,
Evangelismo, etc. — catálogo administrado en "Módulos y
actividades", `Modulos.jsx`) pero al registrar asistencia desde la
web, en "Corrección y Contingencia" (`/registrar`,
`RegistrarAsistencia.jsx`), no había ninguna opción para elegirlo.

## Causa

`caracteres_culto` es una tabla real desde antes (`registros_actividad.caracter_id`
referencia a ella) y la **PWA** (`CapturaActividad.jsx`) ya tenía el
selector completo: carga `getCaracteresCulto(congregacionId)`, muestra
un `<select>` opcional ("Carácter del culto") y lo guarda en el
insert. La pantalla web nunca recibió este campo — solo leía
`tipos_actividad.caracter` (un texto suelto por tipo de actividad, no
relacionado con el catálogo nuevo) para mostrarlo junto al nombre del
tipo en el desplegable, pero nunca dejaba elegir ni guardar un
`caracter_id`.

## Corrección

Mismo criterio exacto que la PWA: se agrega `caracteres_culto` a la
carga inicial de la pantalla, un `<select>` opcional (con `InfoTip`
explicando qué es) que solo aparece si la congregación tiene al menos
un carácter activo creado, y se guarda como `caracter_id` al insertar
en `registros_actividad`. Se limpia al guardar, igual que los demás
campos del formulario.

Commit `8bd5230`, pusheado.
