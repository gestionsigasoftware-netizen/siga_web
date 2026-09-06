# Logo real de SIGAP integrado en la app (2026-09-02)

## Contexto

El usuario compartió el logo real de la app ("SIGAP" en azul + 3 barras
ascendentes) pidiendo colocarlo donde corresponda. No fue posible acceder
al archivo original en disco (se recibió solo como imagen dentro del
chat, sin ruta de archivo localizable) — se le preguntó al usuario cómo
prefería resolverlo y eligió que se **recreara como SVG** en vez de
esperar a que exportara el archivo original.

## Qué se hizo

- **`src/assets/sigap-logo.svg`** (azul, para fondos claros) y
  **`src/assets/sigap-logo-white.svg`** (blanco, para fondos oscuros):
  recreación vectorial del wordmark "SIGAP" + las 3 barras ascendentes,
  a partir de lo observado en la imagen. Al ser SVG, no tiene fondo
  blanco ni de ningún color — soluciona directamente el problema que
  el usuario señaló ("el logo debe ir sin el fondo blanco").
- Reemplazó la marca placeholder (cuadro con la letra "S" + texto
  "SIGAP") en los 4 lugares reales donde aparecía como logo (no como
  simple mención de texto):
  - `Sidebar.jsx` (fondo oscuro → versión blanca)
  - `Login.jsx`, panel izquierdo oscuro (→ versión blanca) y encabezado
    móvil claro (→ versión azul)
  - `InicioPublico.jsx`, barra de navegación (→ versión azul)
- **`public/favicon.svg`**: la app no tenía favicon configurado; se
  agregó uno simple (cuadrado azul con "S", el mismo monograma que ya
  se usaba como marca) enlazado desde `index.html`.

## Explícitamente no tocado

- Las menciones de "SIGAP" como texto simple (encabezados, descripciones,
  `RoleChooser.jsx`, `Dashboard.jsx`, etc.) se dejaron igual — no son
  marcas de logo, son texto de contenido.
- El membrete de las exportaciones PDF/Excel (`src/lib/reportExport.js`)
  sigue usando solo el logo de la IPUC — ese membrete representa a la
  iglesia (remitente institucional del informe), no al software.

## Verificación

Se levantó `npm run preview` y se tomaron capturas con Playwright de la
página pública y de Login: el logo se ve nítido y sin caja blanca tanto
en fondo claro como en fondo oscuro.
