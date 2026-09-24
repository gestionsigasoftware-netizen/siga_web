# Punto "en vivo" del Sidebar animado con pulso

**Fecha:** 2026-09-24
**Archivo:** `src/index.css` (`.sidebar-status`)

## Contexto

El usuario preguntó si el puntico junto a "Tu acceso" (arriba del
Sidebar) se podía animar con pulsos, como señal visual de "esto está
en vivo".

## Versión 1 (descartada en la misma sesión)

Primer intento: anillo verde que crecía y se desvanecía hacia afuera
(`scale(1)` → `scale(2.6)`, `opacity: 0.8` → `0`), reutilizando la
misma curva del pulso de los puntos del mapa en Impacto Misionero
(`siga-map-pulse` en `GeoMap.jsx`). El usuario pidió otra cosa: no un
anillo que crece, sino el color del propio punto apagándose y
encendiéndose, y en blanco en vez de verde.

## Versión final (la que quedó)

- Color cambiado de verde (`bg-success`) a **blanco brillante**
  (`#ffffff`) con `box-shadow` de resplandor
  (`0 0 8px 2px rgba(255,255,255,0.85)`).
- Animación cambiada de "anillo que crece" a **"respiración" de
  brillo**: la `opacity` del punto (que incluye su resplandor, porque
  ambos viven en el mismo elemento) sube y baja en bucle --
  `0%/100%: opacity 0.3` → `50%: opacity 1` -- cada 1.8s con
  `ease-in-out`. Se apaga y se enciende, no crece hacia afuera.
- `@media (prefers-reduced-motion: reduce)`: la animación se
  desactiva y el punto queda fijo en `opacity: 1` (encendido,
  visible), respetando la preferencia de accesibilidad del sistema.

## Verificación

1. `npm run build` sin errores en ambas versiones.
2. Verificación real (no solo captura de pantalla -- ver
   `feedback_verificacion_visual_screenshots_puede_ser_falso_positivo`
   en memoria): con login real, `getComputedStyle` confirmó
   `backgroundColor: rgb(255, 255, 255)` y `animationName:
   "sidebar-status-pulse"`; se tomaron 4 muestras de `opacity` cada
   500ms (`0.67 → 1.0 → 0.32 → 0.63`) -- suben y bajan, no crecen de
   forma monótona, confirmando que es una respiración real y no un
   efecto de una sola dirección.
