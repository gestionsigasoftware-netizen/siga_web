# "Cómo estuvimos" en tema claro — 2026-09-15

## Contexto

El usuario pidió suavizar el color de la sección "Cómo estuvimos" (los
3 roles: local, distrital, nacional) — sugirió blanco — y cuidar que
el texto y demás elementos queden bien en UX/UI con el nuevo fondo.
Se dejó intencionalmente sin tocar el hero de bienvenida de arriba
("Hola, [congregación]" / "Panel nacional" / "Distrito X"), que sigue
oscuro -- el pedido era específicamente sobre "ese cómo estuvimos".

## Construido

Reemplazado en los 3 roles (`src/pages/Dashboard.jsx`):
`bg-ink text-white` → clase `.card` existente (el mismo fondo blanco
con sombra en capas que usa el resto de tarjetas de la app), y cada
color literal blanco-sobre-oscuro por su token equivalente ya
definido en `tailwind.config.js` (nunca colores nuevos inventados):

- Fondo decorativo: el círculo azul saturado a 40% de opacidad se
  cambió por un tinte de `accent-bg` (#E6F1FB, ya casi blanco) a 70%
  -- da profundidad sutil sin "gritar".
- Etiqueta "CÓMO ESTUVIMOS..." : `text-white/60` → `text-accent`
  (azul de marca), para que la sección se siga distinguiendo como
  destacada aunque el fondo ya no sea oscuro.
- Insignia de logro/líder (🏆): `border-[#F0C876]/40 bg-[#F0C876]/10`
  (color inventado) → `border-warning/30 bg-warning-bg
  text-warning-dark` (tokens reales ya existentes, casualmente el
  mismo tono dorado/ámbar).
- Tarjetas internas: `bg-white/[0.06] border-white/10` →
  `bg-surface-1 border-border` (gris muy claro, mismo patrón que usan
  el resto de tarjetas secundarias de la app).
- Textos secundarios/insight: `text-white/50-70` → `text-secondary` o
  `text-muted` según jerarquía.
- Botón "Descargar informe" (solo existe en local): invertido de
  `bg-white text-ink` a `bg-ink text-white` -- mismo botón, ahora
  legible sobre el fondo blanco.

No se tocaron los textos ni la lógica de datos, solo estilos.

## Verificación

- `npm run build` sin errores.
- Playwright con la cuenta real, capturas de los 3 roles (distrital y
  nacional vía el mismo parche temporal de enrutamiento usado en
  piezas anteriores, revertido antes de este commit): buen contraste
  en headline/tarjetas/insight/badge en los 3, cero errores de
  consola.
