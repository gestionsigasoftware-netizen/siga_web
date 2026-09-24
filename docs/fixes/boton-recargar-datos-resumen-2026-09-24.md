# Botón "Recargar datos" en Resumen (los 4 roles)

**Fecha:** 2026-09-24
**Módulo:** `src/pages/Dashboard.jsx` (los 4 componentes: local, distrital, nacional, super_admin)

## Contexto

El usuario reportó que, tras capturar información desde la PWA o
ingresar datos en otro módulo, los gráficos del Resumen no se
actualizan hasta recargar la página completa -- pero recargar toda la
página no es necesario, solo hace falta volver a pedir los datos a
Supabase.

El dashboard local ya tenía un mecanismo parcial: un estado
`reloadToken` que, al incrementarse, salta la caché en memoria
(`dashboardCache`) y vuelve a consultar todo. Pero solo estaba
conectado a un botón "Reintentar" que **únicamente aparecía cuando ya
había un error de carga** -- no había ninguna forma de refrescar datos
manualmente en un estado normal, ni en los otros 3 componentes
(distrital/nacional/super_admin, que ni siquiera tenían el mecanismo).

## Cambios

- Nuevo componente compartido `BotonRecargar` (ícono `RefreshCw` de
  lucide-react, gira mientras `refreshing` es `true`) en la cabecera
  oscura de cada uno de los 4 paneles, junto al enlace que ya tenían
  (o solo, en el caso del panel local, que no tenía enlace).
- `DashboardDistrital`, `DashboardNacional`, `DashboardSuperAdmin`:
  se les agregó `reloadToken` + `refreshing` (no existían) y el efecto
  de carga ahora depende de `reloadToken`. También se agregó (o se
  volvió visible en todo momento, no solo en la carga inicial) el
  mensaje de error.
- **Diferencia clave frente a "Reintentar"**: un clic en "Recargar
  datos" **no reemplaza el contenido por el esqueleto de carga** --
  los números/gráficos actuales se quedan visibles mientras llega la
  información fresca; solo el botón cambia a "Actualizando..." con el
  ícono girando. El esqueleto completo (`if (loading) return ...`)
  sigue existiendo, pero ahora solo se dispara en el primer montaje
  real (o, en el panel local, al cambiar de rol/congregación sin
  caché todavía) -- nunca en un refresco manual.
- Panel local: se agregó `loadedCacheKey` para distinguir "recargar la
  misma vista que ya se ve" (silencioso, con `refreshing`) de "cambiar
  de rol/congregación sin datos en caché" (sí muestra el esqueleto
  completo, para no mostrar por un instante datos del rol anterior).

## Verificación

Login real con la cuenta de prueba (`pueba691@gmail.com`, rol local,
Puerto Tejada) vía Playwright, contra el servidor de desarrollo:
- El botón "Recargar datos" existe y es clicable.
- Justo después del clic, el botón muestra "Actualizando..." y el
  título del panel (`<h1>`) sigue presente en el DOM -- no hay
  blanqueo de pantalla.
- El clic disparó 11 peticiones reales a Supabase (coincide con las
  consultas en paralelo de `load()`).
- El botón vuelve a decir "Recargar datos" al terminar.

Solo se probó en profundidad el panel local (única cuenta de prueba
disponible con rol real); los otros 3 paneles usan exactamente el
mismo patrón de código, verificado por lectura, pero sin clics reales
por falta de cuenta distrital/nacional/super_admin de prueba -- misma
limitación que otras piezas de este proyecto documentadas antes.
