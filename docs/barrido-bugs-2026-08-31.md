# Barrido automatizado de bugs en todo el código

Fecha: 31 de agosto de 2026

## Objetivo

Después de encontrar el bug de Población (variable no declarada que
resolvía en silencio a una propiedad global del navegador), el usuario pidió
verificar si el mismo patrón u otros bugs similares existen en el resto del
código, sin reabrir nada ya corregido ni documentado como pendiente
conocido.

## Método

Se instaló ESLint (`eslint@8`, `eslint-plugin-react`,
`eslint-plugin-react-hooks`) como devDependency, con una configuración de
auditoría (`.eslintrc-audit.cjs`, no es la configuración de lint del
proyecto) que activa:

- `no-undef`: variables referenciadas sin declarar.
- `no-restricted-globals`: identificadores como `status`, `name`, `top`,
	`open`, `close`, `find`, `event`, `history`... que son propiedades reales
	de `window` y por eso NO producen error en el navegador cuando se usan sin
	declarar — exactamente el mecanismo del bug de Población. Esta regla los
	prohíbe explícitamente.
- `no-unused-vars`: variables declaradas y nunca usadas (código muerto o
	features a medio conectar).
- `react-hooks/exhaustive-deps`: dependencias faltantes en `useEffect`.

Se validó la herramienta reproduciendo el bug de Población en un archivo de
prueba antes de confiar en el resultado contra el código real.

## Resultado

**Cero coincidencias de `no-undef` o `no-restricted-globals` en las 33
pantallas.** El bug de Población era un caso aislado, no un patrón repetido.

De las advertencias de `no-unused-vars` y `exhaustive-deps` (232 antes de
corregir el falso-positivo de detección de uso en JSX, 27 después), casi
todas fueron descartadas por ser:

- Íconos o componentes importados y no usados (limpieza cosmética, no bugs).
- El mismo patrón intencional repetido en casi toda la app:
	`useEffect(() => { load() }, [congregacionId, ...])` sin listar `load` en
	las dependencias. Es deliberado: `load` no está memoizada, así que
	agregarla causaría un bucle infinito. Cambiar esto en 15 archivos sería
	reproceso de estilo, no una corrección de bug, así que no se tocó.
- `NotificationCenter.jsx`: el aviso sobre `preferences` es inofensivo — la
	suscripción en tiempo real ya usa el patrón correcto (`setPreferences`
	con función actualizadora) para evitar el problema real.

## Corregido

- **Red de Familias — Visitas**: la constante `VISIT_STATES` (Programada/
	Realizada/Cancelada) existía pero nunca se usaba. La lista de visitas no
	mostraba ninguna etiqueta de estado, y no había forma de cancelar una
	visita (solo "Marcar realizada"). Se agregó la etiqueta de estado visible
	y el botón "Cancelar", reutilizando la función `updateVisitState` ya
	existente (genérica, no necesitó cambios). Verificado con una visita real:
	se ve "PROGRAMADA" en azul con ambos botones, y al cancelar cambia a
	"CANCELADA" en rojo y los botones desaparecen correctamente.
- **`src/pages/Reportes.jsx` eliminado**: era una versión antigua,
	completamente reemplazada por `ReportesOptimizado.jsx` (la que de verdad
	usa la ruta `/reportes`). Confirmado que ningún archivo la importaba —
	era código muerto que solo generaba confusión sobre cuál pantalla es la
	real.

## No se tocó (fuera de alcance de "bug", o ya sin impacto real)

- `Configuracion.jsx`: una consulta a `congregaciones` guarda su resultado
	en una variable que nunca se lee después — no causa ningún problema
	visible, solo una consulta de más. No es un bug funcional.
- `FeligresiaAdmin.jsx`: dependencia `editPerson` faltante en el efecto que
	abre una ficha desde la URL — mismo patrón de `load`, sin evidencia de
	fallo real.
- Limpieza de imports no usados en el resto de archivos — cosmético, no
	afecta funcionamiento; se puede hacer después sin urgencia.

## Validación ejecutada

- `npm run build`: correcto.
- Verificación visual con Playwright y datos reales para el fix de Red de
	Familias (visita de prueba creada, verificada visualmente en los dos
	estados, y eliminada al terminar).

## Archivos modificados

- `src/pages/RedFamilias.jsx`
- `src/pages/Reportes.jsx` (eliminado)
- `.eslintrc-audit.cjs` (nuevo — herramienta de auditoría, no es la
	configuración de lint del proyecto)
- `docs/barrido-bugs-2026-08-31.md`
