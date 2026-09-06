# Menú móvil como overlay fijo, no contenido que empuja la página (2026-09-02)

## El bug reportado

El usuario probó en el celular: el Sidebar aparecía "completo" y, al
hacer scroll hacia abajo, recién ahí aparecía el contenido real (Resumen
en adelante).

## Causa

En móvil, el `<aside>` del Sidebar (`Sidebar.jsx`) no era un elemento
`fixed` — vivía en el flujo normal del documento (solo se volvía `fixed`
a partir de `md:`). Al abrir el menú (o incluso en su versión colapsada,
solo la barra con el logo), su contenido — tarjeta de perfil + ~25 ítems
de navegación + botón de cerrar sesión — se renderizaba como bloque
normal ANTES que `<main>`, empujando todo el contenido real de la
pantalla hacia abajo. El usuario tenía que hacer scroll a través de todo
el menú para llegar al Dashboard. Ese es exactamente el comportamiento
que se reportó.

## Corrección

`src/components/layout/Sidebar.jsx`:

- El `<aside>` ahora es `fixed` en todos los tamaños de pantalla (antes
  solo desde `md:`), con una altura condicional: `h-16` (igual a la
  barra superior con el logo) cuando el menú móvil está cerrado, y
  `h-screen` cuando está abierto.
- El panel expandible (perfil + navegación + cerrar sesión) pasó de
  `hidden`/`block` a `hidden`/`flex flex-col flex-1 min-h-0
  overflow-y-auto` — con el `<aside>` ahora en `h-screen` cuando está
  abierto, este panel se comporta como un overlay a pantalla completa
  con su propio scroll interno, en vez de empujar `<main>`.
- El `<nav>` interno ya no tiene su propio límite de altura/scroll en
  móvil (`max-h-[calc(100vh-220px)]`) — quedaría un scroll anidado
  dentro del nuevo overlay, que ya scrollea completo. Se dejó ese límite
  solo para desktop (`md:overflow-y-auto`), donde el `<aside>` sigue
  siendo una columna fija de altura completa.

`src/components/layout/MainLayout.jsx`:

- Como el `<aside>` ahora es `fixed` también en móvil (antes vivía en el
  flujo normal), `<main>` necesita un padding-top propio para no quedar
  tapado por la barra superior de 64px: `pt-20` en móvil (64px de barra +
  16px de aire), `md:p-6` como antes en desktop (ahí el Sidebar es una
  columna a la izquierda, no una barra arriba, así que no aplica).
- El encabezado sticky de cada pantalla (`main-header`) se movió de
  `sticky top-0` a `sticky top-16 md:top-0`, para que al hacer scroll se
  pegue justo debajo de la barra del Sidebar en vez de quedar tapado por
  ella.

## Verificación

`npm run build` corre limpio. No fue posible verificar visualmente en un
viewport móvil real con Playwright porque no hay credenciales de una
cuenta de prueba disponibles en esta sesión — la corrección se basa en
inspección de código (la causa del bug es clara e inequívoca: el overlay
móvil no estaba `fixed`). Se recomienda que el usuario confirme en su
celular.

## Acción requerida del usuario

Ninguna en base de datos. Probar en el celular y confirmar que el menú
ahora se abre como un panel superpuesto (no empuja el contenido).
