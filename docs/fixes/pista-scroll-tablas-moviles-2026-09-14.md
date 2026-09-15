# Pista visual de scroll horizontal en tablas móviles — 2026-09-14

## Contexto

El usuario pidió una recomendación de mejora ahora que SIGAP está en
producción. Se propusieron dos candidatas: (1) invalidación de cache
entre pantallas que comparten datos de congregaciones (Aprobaciones/
Suscripciones/Pastoral Distrital/Distritos), y (2) pista visual de
scroll en tablas anchas en móvil (hallazgo ya confirmado en la
auditoría visual del 2026-09-11). El usuario pidió avanzar con la
primera.

## Hallazgo al investigar más a fondo antes de tocar código

Al revisar el patrón de cache real (`aprobacionesCache`,
`suscripcionesCache`, `pastoralDistritalCache`, y los ~30 caches
similares del resto de la app), **no es el bug que se pensó**: cada
página usa un patrón "stale-while-revalidate" -- muestra el dato en
cache de inmediato (para no parpadear un loader), pero SIEMPRE
dispara una consulta fresca en segundo plano en cada montaje de la
página (`useEffect(() => { load() }, [...])`, y dentro de `load()` el
`Promise.all(...)` se ejecuta sin condicionarlo a si hubo o no cache).
Es decir: cualquier pantalla que dependa de datos de congregaciones ya
se autocorrige en cuanto el usuario navega a ella -- no hace falta
ninguna invalidación cruzada entre pantallas, el "bug" no existe tal
como se planteó. Se decidió no construir una solución para un
problema que no está confirmado, y avanzar con la segunda
recomendación (real y ya verificada).

## Construido

Nueva clase compartida `.table-scroll` en `src/index.css` -- técnica
de "scroll shadows" en CSS puro (dos capas de fondo fijas a la
ventana que hacen de sombra, y dos capas que se mueven con el
contenido del mismo color de fondo): la sombra solo se ve en el borde
que todavía tiene contenido sin revelar, y desaparece sola al llegar
al final del scroll. No requiere JavaScript ni escuchar el evento de
scroll.

Aplicada donde reemplaza directamente al `overflow-x-auto` plano que
ya existía:
- `src/pages/ReportesOptimizado.jsx` -- "Comparativa distrital" y
  "Detalle de registros".
- `src/pages/RegistrarAsistencia.jsx` -- "Registros recientes" (esta
  tabla ni siquiera tenía contenedor de scroll -- se le agregó uno
  nuevo con esta misma clase).

## Verificación

- `npm run build` sin errores.
- Con Playwright a 390px de ancho (viewport móvil real), confirmado
  que el contenedor de "Detalle de registros" sí desborda
  (`scrollWidth: 474 > clientWidth: 356`) y que el degradado de sombra
  está aplicado (`getComputedStyle(...).backgroundImage`). Captura
  recortada del borde derecho confirma la sombra visible.

## Pendiente

Ninguna acción de base de datos. Solo frontend, ya desplegado. Si en
el futuro aparece evidencia real de datos desactualizados entre
pantallas (no solo la sospecha inicial), retomar la idea de
invalidación cruzada -- por ahora no aplica.
