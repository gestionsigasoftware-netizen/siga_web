# Auditoria de modulos del Sidebar: Preferencias personales

Fecha: 31 de agosto de 2026

## Objetivo

Continuar la auditoria modulo por modulo del Sidebar. Se reviso
"Preferencias personales" (`src/pages/ConfiguracionSistema.jsx`) para
confirmar si cumple su proposito.

## Hallazgo

De las tres preferencias que ofrece la pantalla:

- `recibir_notificaciones` y `recibir_alertas` si funcionan: `NotificationCenter.jsx`
  las usa para filtrar que aparece en la campana de notificaciones.
- `formato_fecha` (DD/MM/AAAA vs MM/DD/AAAA) se guardaba correctamente en
  `preferencias_usuario`, pero **no lo consumia ningun otro lugar de la
  aplicacion**. Ocho archivos formateaban fechas con `toLocaleDateString`/
  `toLocaleString('es-CO', ...)` fijo, ignorando la preferencia. La unica
  "confirmacion" de que la opcion hacia algo era una tarjeta en la misma
  pantalla que repetia el valor recien elegido.

Nota secundaria (no corregida hoy): las tarjetas "Seguridad" e "Informacion
actualizada" en la misma pantalla muestran texto estatico siempre en verde
("Politica activa", "Estado verificado"), sin verificar nada real —
`docs/seguridad-produccion.md` documenta MFA y otros controles como
pendientes, asi que esa tarjeta puede dar una falsa sensacion de seguridad.

## Cambio aplicado

Se implemento de verdad la preferencia de formato de fecha:

- `src/lib/dateFormat.js`: funcion pura `formatFecha(value, { formato, conHora })`
  que arma la fecha numerica en el orden elegido (dia/mes o mes/dia), sin
  depender de cambiar el locale (para no perder los nombres de mes en
  espanol donde ya se usan formatos con mes escrito, que no son ambiguos y
  no se tocaron).
- `src/hooks/usePreferencias.js`: hook cacheado por usuario (mismo patron que
  `useMiRol()`), que se actualiza al instante cuando `ConfiguracionSistema.jsx`
  guarda un cambio, disparando el evento `siga:preferencias-actualizadas`
  (mismo patron ya usado para el nombre de la congregacion).
- Se aplico `formatFecha()` en los seis lugares donde el orden dia/mes era
  realmente ambiguo: `NotificationCenter.jsx`, `AuditoriaFeligresia.jsx`,
  `Amigos.jsx` (notas y historial de etapas), `FeligresiaAdmin.jsx`
  (historial de comites) y `Dashboard.jsx` (rango de periodo). Los formatos
  con mes escrito (ej. "25 ago 2026") no se tocaron porque no tienen
  ambiguedad que la preferencia deba resolver.

## Archivos modificados

- `src/lib/dateFormat.js` (nuevo)
- `src/hooks/usePreferencias.js` (nuevo)
- `src/pages/ConfiguracionSistema.jsx`
- `src/components/layout/NotificationCenter.jsx`
- `src/pages/AuditoriaFeligresia.jsx`
- `src/pages/Amigos.jsx`
- `src/pages/FeligresiaAdmin.jsx`
- `src/pages/Dashboard.jsx`
- `docs/auditoria-sidebar-preferencias-2026-08-31.md`

## Validacion ejecutada

- `npm run build`: correcto.
- Verificacion visual con Playwright y la cuenta de prueba: se confirmo que
  una fecha real en Auditoria de Feligresia cambia de `28/08/2026` a
  `08/28/2026` al cambiar la preferencia, y se revirtio la cuenta a
  DD/MM/AAAA al terminar.

## Validacion pendiente

- Revisar si la tarjeta "Seguridad" de Preferencias personales deberia
  reflejar un estado real (MFA activo, ultima sesion) en vez de texto
  estatico, una vez se resuelvan los pendientes de `docs/seguridad-produccion.md`.
