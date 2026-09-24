# Punto "en vivo" del Sidebar animado con pulso

**Fecha:** 2026-09-24
**Archivo:** `src/index.css` (`.sidebar-status`)

## Contexto

El usuario preguntó si el puntico verde junto a "Tu acceso" (arriba
del Sidebar) se podía animar con pulsos, como una señal visual de
"esto está en vivo".

## Cambio

Se reutiliza exactamente la misma curva de animación ya usada para el
pulso "en vivo" de los puntos del mapa en Impacto Misionero
(`siga-map-pulse` en `GeoMap.jsx`), para mantener el mismo lenguaje
visual en toda la app en vez de inventar una animación nueva:

- `.sidebar-status::after`: un anillo que crece (`scale(1)` →
  `scale(2.6)`) y se desvanece (`opacity: 0.8` → `0`) en bucle cada 2
  segundos, con `cubic-bezier(0.15, 0.6, 0.35, 1)`.
- El punto verde sólido original (`.sidebar-status`) se queda igual,
  visible en todo momento -- el anillo pulsa alrededor de él.
- `@media (prefers-reduced-motion: reduce)`: la animación se
  desactiva y el anillo queda apagado (`opacity: 0`), respetando la
  preferencia de accesibilidad del sistema operativo -- mismo patrón
  que ya usa `GeoMap.jsx` para su propio pulso.

## Verificación

1. `npm run build` sin errores.
2. Verificación real (no solo captura de pantalla, que puede dar
   falso positivo -- ver
   `feedback_verificacion_visual_screenshots_puede_ser_falso_positivo`
   en memoria): con login real y `getComputedStyle(el, '::after')`
   se confirmó `animationName: "sidebar-status-pulse"`,
   `animationIterationCount: "infinite"`, y se tomaron dos muestras
   de `transform`/`opacity` con ~900ms de diferencia que cambiaron de
   verdad entre sí -- prueba de que la animación corre, no solo que
   está declarada en CSS.
