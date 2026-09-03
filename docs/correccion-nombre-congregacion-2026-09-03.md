# Congregación oficial en Editar pastor + corrección de nombre (2026-09-03)

## Lo que pedía el usuario

El campo "Congregación" en Editar pastor ya buscaba, pero solo entre
las congregaciones que **ya existen como reales en SIGAP** (casi
siempre solo 1 o 2 en un distrito recién empezando) — no contra la
lista oficial de 5,367 que se cargó de Debora. El usuario aclaró que
necesitaba forzar que ese campo solo aceptara nombres de la lista
oficial, para poder corregir un pastor que quedó mal asignado.

Se le preguntó qué debía pasar si elegía una congregación oficial que
**todavía no está registrada** en SIGAP: ¿renombrar la congregación
actual del pastor, o crear una nueva y trasladarlo? Confirmó
**renombrar la actual** — es la misma congregación, solo se corrige
cómo quedó mal registrada desde el inicio, no se crea una segunda.

## Diseño

El buscador de "Congregación" en Editar pastor ahora combina dos
fuentes:

1. **Congregaciones reales de SIGAP** (como antes) — elegir una
   dispara el traslado real de siempre (`trasladar_pastor`).
2. **Congregaciones oficiales del catálogo (Debora) que aún no están
   registradas** — marcadas visualmente "Oficial · sin registrar".
   Elegir una de estas NO traslada al pastor: renombra la congregación
   que ya tiene, vía la nueva función `corregir_nombre_congregacion`.

Esto hace que el campo **siempre fuerce elegir de una lista oficial**,
nunca texto libre — igual que ya pasa en "Registrar nueva
congregación".

## Backend — `supabase/corregir_nombre_congregacion.sql`

`corregir_nombre_congregacion(congregacion_id, catalogo_id)`:
verifica que quien llama sea líder del distrito de esa congregación,
que la fila del catálogo pertenezca al mismo distrito, libera
cualquier vínculo previo de esa congregación en el catálogo (por si
tenía otro nombre oficial ligado por error), actualiza
`congregaciones.nombre` al nombre oficial, y liga la fila del catálogo
a esa congregación (para que dejen de contarse como pendiente).

## Bug de layout corregido de paso

El mismo problema de `backdrop-filter` que tapaba el desplegable en
"Registrar nueva congregación" (corregido en un commit anterior)
también aplicaba al formulario "Registrar/Editar pastor", que ahora
también tiene un buscador. Se desactivó `backdrop-filter` ahí también,
antes de que se reportara como bug aparte.

## Verificación

`npm run build` corre limpio.

## Acción requerida del usuario

Ejecutar `supabase/corregir_nombre_congregacion.sql`.
