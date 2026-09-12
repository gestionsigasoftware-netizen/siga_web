# "Guardar cambios" sin ningún aviso visible — 2026-09-11

## Contexto

El usuario reportó, con un caso real (el amigo "Pepito higo" en
Amigos en ruta), que al hacer clic en "Guardar cambios" en el
formulario de edición no pasaba nada, y preguntó si el problema era
de ese formulario únicamente o se repetía en otros lados.

## Diagnóstico

Se probó el mismo `update` que ejecuta `saveFriend` directamente
contra la base de datos real (congregación Puerto Tejada Cauca
Central, usuario `pueba691@gmail.com`), sobre el registro real de
"Pepito higo": el guardado **sí se ejecutaba sin ningún error**. El
problema no era el guardado en sí, sino que `saveFriend`
(`src/pages/Amigos.jsx`) nunca llamaba a `setNotice(...)` en el
camino de éxito, y tampoco producía ningún otro cambio visible (no
cierra un modal, no cambia el texto de un botón, no quita/agrega una
fila) -- el formulario queda exactamente igual antes y después de
guardar, así que un guardado exitoso es indistinguible de un botón
roto.

Se revisaron las demás acciones de esa misma pantalla (marcar
bautizado, marcar sellado, incorporar a Feligresía, eliminar,
agregar nota) y todas sí dan alguna señal visible (el botón cambia de
texto o se deshabilita, la fila desaparece, la nota nueva aparece),
así que no comparten el mismo problema.

Se delegó una auditoría de los mismos 17 archivos de `src/pages/`
buscando funciones `.update()`/`.insert()` cuyo camino de éxito no
llame a `setNotice(...)` ni produzca ningún cambio visible obvio.
Encontró un segundo caso real:

`src/pages/Aprobaciones.jsx`, función `actualizarMadurez` (el
`<select>` de "Madurez" de cada sede): el `<select>` ya muestra la
opción elegida por comportamiento nativo del navegador
independientemente de si el guardado tuvo éxito, y el estado `busy`
se activa/desactiva igual en éxito o error -- nada distingue
"guardado" de "no pasó nada".

Todas las demás funciones revisadas ya cumplían la convención
(llaman `setNotice`, cierran un modal, o cambian visiblemente una
fila/badge).

## Corregido

- `src/pages/Amigos.jsx` — `saveFriend`: agrega
  `setNotice("Cambios guardados.")` antes de retornar en éxito.
- `src/pages/Aprobaciones.jsx` — `actualizarMadurez`: agrega
  `setNotice('Madurez de la sede actualizada.')` antes de `load()`.

Ambas pantallas ya tenían `notice` conectado al componente `Toast`
flotante (migración de mensajes del 2026-09-11), así que el aviso ya
aparece con auto-desaparición a los 4.5s sin cambios adicionales.

## Verificación

- Update real contra la base de datos de producción confirmado sin
  error para el caso de "Pepito higo" (revertido después, sin
  residuo).
- `npm run build` sin errores tras cada cambio.
