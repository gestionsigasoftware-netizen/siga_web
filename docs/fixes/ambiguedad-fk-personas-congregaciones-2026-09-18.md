# "No se pudo cargar el consolidado del distrito" — 2026-09-18

## Contexto

El usuario (rol distrital) reportó ver "No se pudo cargar el
consolidado del distrito" en Resumen, sin entender por qué.

## Causa raíz

El 2026-09-16, al construir los "campos rápidos del censo", se agregó
`personas.congregacion_bautismo_id` (FK opcional a `congregaciones`,
para registrar dónde se bautizó alguien). Eso creó una **segunda
relación** entre `personas` y `congregaciones` (la original,
`congregacion_id`, y la nueva, `congregacion_bautismo_id`).

Cualquier consulta que le pidiera a Supabase (PostgREST) "incrusta la
congregación de esta persona" sin decir CUÁL de las dos relaciones
usar quedó ambigua desde ese momento. Confirmado contra la base real:

```
code: 'PGRST201'
message: "Could not embed because more than one relationship was
found for 'personas' and 'congregaciones'"
```

Esto rompió silenciosamente dos consultas que ya existían desde antes
(no se tocaron el 2026-09-16, simplemente dejaron de funcionar porque
la columna nueva las volvió ambiguas):

- `src/pages/Dashboard.jsx:294` — el consolidado del distrito en
  Resumen (el error exacto que reportó el usuario).
- `src/pages/PastoralDistrital.jsx:473` — la lista de personas activas
  del distrito dentro de "Gestión pastoral distrital" (mismo problema,
  no reportado aún pero habría fallado igual).

## Arreglo

En ambas, se cambió `congregaciones!inner(distrito_id)` por
`congregaciones!personas_congregacion_id_fkey!inner(distrito_id)` --
el nombre exacto de la relación original, tal como lo sugiere el
`hint` que Supabase devuelve en el error. El resto de la consulta
(el `.eq('congregaciones.distrito_id', ...)`) no cambia, porque el
embed sigue exponiéndose bajo la misma clave `congregaciones`.

No se tocó ninguna otra consulta: se revisó todo el código en busca
del mismo patrón (`personas` + `congregaciones!inner` o
`congregaciones(...)` incrustada) y solo aparecían estas dos. La
consulta ya existente en `FeligresiaAdmin.jsx` para el bautismo
(`congregaciones_bautismo:congregacion_bautismo_id(nombre, ciudad)`)
no tiene este problema porque ya nombra la columna FK exacta.

## Verificación

- Confirmado el error real contra producción antes de tocar nada
  (`PGRST201`), y confirmada la consulta corregida sin error, con la
  cuenta real.
- `npm run build` sin errores.
- Verificación visual con Playwright: se forzó temporalmente el
  Resumen a renderizar como distrital (con el `distrito_id` real de
  Puerto Tejada, Distrito 6) -- el consolidado cargó completo (Cómo
  estuvimos, semáforo, insights BI, pirámide poblacional, comparativa
  por congregación), sin el mensaje de error y sin errores de consola.
  El parche temporal se revirtió de inmediato después de la captura.
- La consulta de `PastoralDistrital.jsx` se verificó directamente
  contra la base real con el mismo `distrito_id` (9 personas activas
  devueltas sin error).
