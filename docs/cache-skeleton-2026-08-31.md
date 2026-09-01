# Caché de datos entre navegaciones + skeleton de carga (2026-08-31)

## Motivación

El usuario notó que, al cambiar de módulo en el Sidebar, aparecía
brevemente una pantalla distinta (vacía o con el texto genérico
"Cargando...") antes de mostrar el contenido real. Esto pasa porque cada
página vuelve a pedir sus datos a Supabase justo al montarse, sin importar
si ya se habían cargado antes en la misma sesión.

Se aplicaron dos técnicas estándar de la industria a los 3 módulos más
usados (Resumen/Dashboard, Feligresía, Misiones y Evangelismo), dejando el
patrón listo para replicar al resto del Sidebar en una siguiente pasada:

1. **Caché de datos en memoria** (stale-while-revalidate): cada página
	 guarda lo último cargado en un `Map` a nivel de módulo, indexado por una
	 clave de alcance (congregación + filtros relevantes). Al revisitar la
	 pantalla en la misma sesión del navegador, el dato en caché se muestra
	 de inmediato (sin "Cargando") y, en paralelo, se dispara igual la
	 consulta real para refrescar en segundo plano.
2. **Skeleton screens**: mientras no hay caché (primera visita real), en
	 vez de un espacio vacío o un texto de "Cargando", se muestra la silueta
	 gris de la pantalla final (`src/components/Skeleton.jsx`, usando
	 `animate-pulse` de Tailwind).

Generaliza el mismo patrón que ya usaban `useMiRol.js`/`usePreferencias.js`
(`Map` a nivel de módulo, cacheado por clave), en vez de inventar un hook
genérico nuevo — cada página mantiene su propia forma de estado (por
ejemplo, `FeligresiaAdmin.jsx` reparte sus datos en ~15 `useState`
distintos, no en un solo objeto).

## Cambios

- **`src/components/Skeleton.jsx`** (nuevo): `SkeletonStatTiles`,
	`SkeletonCard`, `SkeletonChart`, `SkeletonList`, `SkeletonTableRows`.
- **`src/pages/Dashboard.jsx`** (rama local `Dashboard()`): `dashboardCache`
	por `${nivel}:${congregacion_id}`; el "Reintentar" manual (botón de
	error) sigue forzando una carga real, ignorando la caché. La rama
	distrital (`DashboardDistrital`) queda pendiente para otra pasada.
- **`src/pages/MisionesEvangelismo.jsx`**: `metricsCache` por
	`congregacionId`.
- **`src/pages/FeligresiaAdmin.jsx`**: `feligresiaCache` por
	`${congregacionId}:${personStatus}:${deferredSearch}:${peoplePage}`
	(las mismas variables de las que depende su `load()`). La pestaña
	Población muestra `SkeletonList` en vez del mensaje "No hay personas con
	estos filtros." durante la primera carga real.

## Verificación

`npm run build` sin errores. Verificado con Playwright contra el **build de
producción** (`npm run preview`, no el servidor de desarrollo — React
StrictMode en desarrollo duplica renders/efectos y genera falsos positivos
de "parpadeo" que no existen en producción real):

- Primera visita a cada una de las 3 pantallas en la sesión: aparece el
	skeleton (confirmado contando nodos `.animate-pulse` mientras carga) y
	luego el contenido real, sin espacios en blanco.
- Segunda visita (navegando internamente por el Sidebar, no recargando la
	página completa — la caché es en memoria y no sobrevive un F5): el
	contenido aparece de inmediato, cero nodos `.animate-pulse` en toda la
	ventana de espera.
- Capturas de pantalla confirmaron que ningún layout se rompe mientras el
	skeleton está activo.

## Nota importante para el futuro

La caché es **en memoria (un `Map` de JS)**, no `localStorage`/cookies:
vive mientras la pestaña del navegador sigue en la misma sesión de la SPA.
Sobrevive a navegar entre módulos del Sidebar (que es justo el caso que
pedía el usuario), pero **no sobrevive a un F5 o cerrar la pestaña** — eso
es intencional, evita mostrar datos desactualizados de una sesión anterior
sin ningún control de expiración.

## Pendiente

El resto de los ~17 módulos del Sidebar (Amigos, Evangelismo, Misión
Juvenil, Escuela Dominical, Damas Dorcas, Red de Familias, Pastoral
Distrital, Reportes, etc.) todavía cargan con el patrón viejo
(`useState(true)` + "Cargando..." bloqueante) y no tienen caché. Replicar
este mismo patrón ahí en una siguiente pasada, empezando por los que el
usuario use con más frecuencia después de estos 3.
