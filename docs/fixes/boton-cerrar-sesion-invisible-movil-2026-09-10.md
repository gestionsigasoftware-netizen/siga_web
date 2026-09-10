# Botón "Cerrar sesión" no aparecía en el menú móvil (2026-09-10)

El usuario reportó desde el celular, en `sigap.com.co`, que tras
entrar normalmente el botón "Cerrar sesión" no se veía por ningún
lado en el menú hamburguesa.

## Causa

`src/components/layout/Sidebar.jsx` usaba `h-screen` (`100vh`) para
la altura del drawer móvil cuando está abierto. En navegadores
móviles (Safari iOS y varios Android), `100vh` se calcula sobre la
altura máxima posible del viewport (con la barra de direcciones
oculta), no sobre el área realmente visible en cada momento. El
contenedor interno con scroll (`overflow-y-auto`) calcula su propio
desbordamiento contra esa altura inflada, así que "cree" que todo su
contenido cabe aunque en la pantalla real (más corta, por la barra de
direcciones visible) el botón de cerrar sesión -- al final de la
lista de navegación -- quede renderizado por debajo del área
visible, sin ningún scroll disponible para alcanzarlo.

## Corrección

`h-screen`/`md:h-screen` → `h-dvh`/`md:h-dvh` (altura de viewport
dinámica, ya soportada por Tailwind 3.4.13, el que usa el proyecto).
`dvh` se recalcula según el espacio realmente visible en cada
momento, así que el contenedor con scroll detecta el desbordamiento
real y el botón queda alcanzable (con scroll si la lista de módulos
del rol es larga, visible directamente si no).

## Verificación

- `npm run build` limpio; confirmado que el CSS generado incluye
  `100dvh`.
- Playwright con emulación de iPhone 12: se abrió el menú hamburguesa
  con la cuenta de prueba real, y el botón "Cerrar sesión" quedó
  dentro del área visible del viewport (captura de pantalla
  confirmada visualmente).
- Limitación: un navegador headless no reproduce el colapso real de
  la barra de direcciones de un navegador móvil físico, así que esto
  no reproduce el bug original tal cual --pero el cambio de `vh` a
  `dvh` es la corrección estándar para esta clase de problema, no
  introduce regresión (build y captura limpios), y no toca nada más
  del layout.
