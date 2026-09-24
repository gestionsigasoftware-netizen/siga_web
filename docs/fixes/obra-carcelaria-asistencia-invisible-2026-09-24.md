# Obra Carcelaria: asistencia individual capturada pero nunca mostrada

**Fecha:** 2026-09-24
**Módulo:** `src/pages/ObraCarcelaria.jsx` -- pestaña "Internos"

## Contexto

Barrido de bugs "masivo" pedido por el usuario ("revisa bugs y cosas
que no esten funcionando o que requieran mejora") en toda la web, no
solo en un submódulo. Se reutilizó `.eslintrc-audit.cjs` (la
herramienta de auditoría creada el 2026-08-31) para volver a correr el
barrido de `no-undef`/`no-unused-vars`/`react-hooks/exhaustive-deps`
en las 33+ pantallas y revisar cada resultado real contra el código.

## Bug real encontrado

Al crear un culto en "Cultos y REFAM", el formulario SÍ pide marcar
asistencia individual por interno activo (`asistenciaMarcada[interno.id]`)
y la guarda en `obra_carcelaria_asistencia` (`ObraCarcelaria.jsx:247`).
Esos datos también se vuelven a leer al cargar la pantalla
(`load()`, línea 134, hacia el estado `asistencias`).

Pero **nada en la pantalla mostraba esa asistencia de vuelta**: ni por
interno (quién ha estado viniendo) ni por culto (quién asistió ese
día). El estado `asistencias` se llenaba y no se leía en ningún otro
lado -- exactamente el mismo patrón que el bug de Comités de hoy
temprano (metadata capturada, nunca mostrada). Confirmado con
`eslint` (`'asistencias' is assigned a value but never used`) y
verificado leyendo el archivo completo.

Esto es justo el dato que más le importa a este ministerio: saber qué
interno ha dejado de asistir para hacerle seguimiento.

## Corrección

Nuevo cálculo derivado (mismo patrón que `ultimaVisitaPorInterno`, ya
existente en el archivo), sin ninguna consulta nueva a Supabase:

```js
const cultoIdsEnPeriodo = new Set(cultos.map((item) => item.id));
const asistenciaPorInterno = new Map();
asistencias.forEach((item) => {
  if (!cultoIdsEnPeriodo.has(item.culto_id)) return;
  asistenciaPorInterno.set(item.interno_id, (asistenciaPorInterno.get(item.interno_id) || 0) + 1);
});
```

Se acota a los cultos del periodo seleccionado (`asistencias` en sí
trae historial completo sin filtro de fecha) para que el número
coincida con lo que el pastor ve en "Cultos y REFAM".

En la tarjeta de cada interno activo, nuevo badge:
- Si asistió >=1 vez en el periodo: "Asistió a N cultos en este
  periodo" (neutral).
- Si no asistió ninguna vez y sí hubo cultos en el periodo: "Sin
  asistencia registrada en este periodo" (badge de alerta,
  `bg-warning-bg`) -- señal directa para seguimiento pastoral.

## Otra limpieza (mismo barrido)

Variables calculadas y nunca usadas (código muerto real, sin impacto
visible pero confuso para mantenimiento futuro):
- `ObraCarcelaria.jsx`: `hoy` (línea 333, ya no se usaba desde que
  `en30dias` se calcula directo con `Date.now()`).
- `Dashboard.jsx`: `maxAsistenciaRankingDistrital` -- se calculaba un
  máximo para un ranking de barras que nunca se llegó a renderizar
  (solo se usa el "líder" en una sola tarjeta, igual que la versión
  nacional que nunca tuvo ese cálculo). No se construyó ninguna UI
  nueva para esto porque el patrón real de esta pantalla (confirmado
  comparando con la versión nacional) es un solo destacado, no una
  lista de ranking.
- `Conquistadores.jsx` / `DamasDorcas.jsx`: `tendenciaVariacion`
  (junto con `mitad`/`primeraMitad`/`segundaMitad`) -- cálculo
  duplicado y reemplazado hace tiempo por `variacion30Dias`, que es
  el que de verdad se muestra en pantalla.
- `src/components/ErrorBoundary.jsx` -- el audit marcó un "parsing
  error" en la sintaxis de class fields (`state = {...}`); es un
  falso positivo del parser de ESLint 8 sin plugin de class-fields,
  no un bug real (el archivo compila y funciona en producción).

## Verificación

1. `npm run build` sin errores.
2. Playwright + login real (`pueba691@gmail.com`, rol local) contra
   `npm run dev`: el badge "Asistió a 1 culto en este periodo"
   aparece en la ficha del interno activo con datos reales de esa
   congregación, sin errores de consola.

## Pendiente

Ninguno -- limpieza y corrección cerradas. El resto del barrido
`.eslintrc-audit.cjs` (avisos de `react-hooks/exhaustive-deps` sobre
`load` faltante en las dependencias) sigue siendo el mismo patrón
intencional ya descartado el 2026-08-31 (repetido en ~20 archivos,
cambiarlo sería reproceso de estilo, no corrección de bug).
