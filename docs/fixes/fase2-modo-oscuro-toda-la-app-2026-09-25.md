# Fase 2: modo oscuro en toda la app web

**Fecha:** 2026-09-25
**Archivos clave:** `tailwind.config.js`, `src/index.css`,
`src/components/layout/MainLayout.jsx`, + 20 archivos más (barrido
mecánico de un solo patrón, ver abajo).

## Contexto

Fase 1 (sesión anterior) construyó el modo día/noche solo para
Inicio. El usuario pidió continuar con la Fase 2: extender el mismo
modo día/noche al resto de la app web (~45 pantallas autenticadas).

## Decisión de arquitectura

En vez de tocar cada una de las ~45 páginas para agregarles clases
`dark:`, se convirtieron los tokens de color de `tailwind.config.js`
(ink, surface, surface-1, surface-2, border, muted, secondary,
accent, success, warning, danger + sus variantes -bg/-dark) en
**variables CSS** definidas en `src/index.css` (`:root` = valores
claros de siempre, `:root.dark` = valores oscuros nuevos). Como
*toda* la app ya usaba consistentemente estas clases semánticas
(`bg-surface-1`, `text-ink`, `border-border`, etc. -- confirmado
durante la revisión UX de ayer en ~40 pantallas), esto le dio modo
oscuro a prácticamente toda la app **sin tocar cada archivo de
página**.

Detalle técnico importante: los valores se guardan como tripletes RGB
sin envolver (`--color-accent-rgb: 42 120 214`) y `tailwind.config.js`
los referencia como `rgb(var(--color-accent-rgb) / <alpha-value>)` --
la única forma en que Tailwind puede seguir generando utilidades con
opacidad (`bg-accent/10`, `ring-accent/30`, usadas en decenas de
lugares) sobre un color que cambia por tema. Un primer intento con
`var(--color-x)` envuelto en hex directo rompió el build
(`ring-accent/30` "no existe" según PostCSS) hasta corregir esto.

## Bug real encontrado y corregido: `bg-ink` no debía invertirse

Al probar el Dashboard en oscuro, el banner "Hola, [congregación]"
quedó con texto casi invisible (fondo claro, texto claro). Causa:
`ink` se usa en la app con DOS significados distintos que compartían
el mismo token:
1. Como **texto** (`text-ink`) -- debe invertirse (oscuro→claro) para
   seguir siendo legible en modo oscuro. Uso correcto y mayoritario.
2. Como **relleno** (`bg-ink`, `border-ink`) en botones, banners tipo
   "hero", overlays de modal y el toast -- superficies deliberadamente
   oscuras SIEMPRE, igual que el Sidebar (que ya es oscuro
   permanentemente). Con `ink` reactivo, estas se volvían casi
   blancas en modo oscuro.

Se separaron los dos usos: `ink` sigue reactivo (para texto);
se agregó un token nuevo **`night`**, fijo en los dos temas
(`#0B0B0B` siempre), y se migraron las ~22 apariciones reales de
`bg-ink`/`border-ink`/`bg-ink/NN` de fondo a `bg-night`/`border-night`
-- barrido mecánico (mismo patrón textual, `sed`) en: `.btn-primary`
y el overlay de modal en `index.css`, más `Dashboard.jsx` (4 banners +
2 botones), `InicioPublico.jsx` (4 superficies), `Login.jsx`,
`Legal.jsx`, `UndoToast.jsx`, `LanguageSwitcher.jsx`, `MainLayout.jsx`
(diálogo de inactividad), `FeligresiaAdmin.jsx` (2 modales),
`Suscripciones.jsx`, `Solicitudes.jsx`, y los botones de "Periodo"
(30/90/Todo días) repetidos en 10 páginas de módulos
(EducacionTeologica, EducacionArtistica, EscuelaDominical,
DamasDorcas, Conquistadores, Evangelismo, ObraSocial, MisionJuvenil,
ObraCarcelaria, Musica, ReportesOptimizado).

## Interruptor real para usuarios autenticados

`MainLayout.jsx` (el shell de toda la app logueada) ahora monta
`<ThemeToggle />` en el header, junto a Notificaciones -- antes el
interruptor solo existía en Inicio (pública). No se agregó el
selector de idioma ahí todavía a propósito: cambiar de idioma sin
haber traducido el resto de la app sería confuso (ver "pendiente"
abajo).

## Qué NO se tocó (a propósito)

- **Gráficos (Chart.js, `src/lib/chartTheme.js`)**: sus colores están
  en JS, no en CSS, así que no heredan las variables automáticamente.
  Se verificó en `/reportes` con datos reales en modo oscuro y **ya
  se ven legibles** (el gris medio de ejes/grillas funciona
  razonablemente en los dos temas) -- no se encontró un problema real
  que justifique rehacer `chartTheme.js` ahora mismo. Queda como
  posible pulido fino futuro, no como pendiente crítico.
- **Traducción del resto de la app (i18n)**: la Fase 2 de este pedido
  es específicamente el tema día/noche. Traducir las ~45 pantallas a
  inglés/portugués es un trabajo de contenido igual de grande, mejor
  como su propia fase (probablemente por grupos de módulos) en vez de
  mezclado con esta.
- **PWA** (`siga-pwa-nacional`): sigue siendo la Fase 3, proyecto
  aparte todavía sin tocar.
- Detalles decorativos muy menores (anillo de sombra de
  `.censo-avatar`/`.censo-badge`) se dejaron con su rgba original --
  se ven un poco menos pronunciados en oscuro pero no rotos.

## Verificación

1. `npm run build` sin errores (dos veces: antes y después de
   corregir el bug de `bg-ink`/`bg-night`).
2. Playwright + login real (rol local), navegación por 4 pantallas
   reales sin tocarlas directamente (Dashboard, Auditoría de
   Feligresía, Feligresía, Reportes con gráficos): capturas de
   pantalla confirman fondo, tarjetas, tablas, badges, filtros,
   inputs y gráficos todos coherentes en oscuro, con el mismo aspecto
   de siempre en claro (sin regresión). `getComputedStyle` confirmó
   valores RGB reales aplicados (`rgb(11, 11, 11)` de fondo,
   degradado de tarjeta oscuro), no solo la clase `dark` presente.
3. Cero errores de consola en ningún punto.

## Pendiente (fases siguientes)

- **Traducción del resto de la app** a inglés/portugués (contenido,
  no infraestructura -- la infraestructura de i18next ya existe
  desde la Fase 1).
- **Fase 3**: mismo tema día/noche + idiomas en la PWA
  (`SIGA\siga movil\siga-pwa-nacional`).
- Pulido opcional: `chartTheme.js` podría afinar sus colores para
  verse aún mejor en oscuro (hoy ya es legible, no roto).
