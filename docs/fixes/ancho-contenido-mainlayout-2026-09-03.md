# Contenedor de contenido no llegaba a su ancho real (2026-09-03)

## El bug reportado

El usuario reportó que el esqueleto de carga del Resumen (Dashboard) se
veía "como móvil" dentro de la pantalla de escritorio — mucho más
angosto de lo esperado, con márgenes grandes a los lados.

## Investigación

La primera hipótesis (¿hay un esqueleto separado para móvil que se
carga por error en web?) se descartó: `src/components/Skeleton.jsx`
tiene un solo set de componentes, sin variantes por tamaño de pantalla.

Para no seguir adivinando desde capturas de pantalla, se armó una
réplica exacta del layout real (mismas clases de `MainLayout.jsx` +
`Sidebar.jsx` + el skeleton real de `Dashboard.jsx`) en una vista
temporal, verificada con Playwright a 1920×1080 y un contorno rojo
marcando el contenedor de contenido. Eso mostró el problema real: el
contenedor `mx-auto max-w-[1220px] flex-1` (en `MainLayout.jsx`, el que
envuelve TODO el contenido de cada pantalla vía `<Outlet />`) no estaba
llegando a los 1220px — se encogía al tamaño de su contenido en vez de
estirarse a su ancho máximo.

## Causa raíz

`flex-1` (flex-grow/flex-shrink/flex-basis:0%) dentro de un contenedor
`flex flex-col` (como `<main>`) controla el **eje principal**, que en un
`flex-col` es el vertical (alto), no el ancho. Sin una clase `w-full`
explícita, el div dependía del comportamiento por defecto del eje
transversal (ancho) para estirarse -- y con contenido "liviano" (como
las barras pequeñas del esqueleto, que no fuerzan un ancho), el
navegador lo encogía al tamaño de su contenido en vez de llenar el
espacio disponible hasta el `max-w-[1220px]`. Con contenido "pesado"
(una tabla ancha, por ejemplo) el div sí terminaba viéndose del ancho
correcto por accidente -- por eso el bug era inconsistente y parecía
"a veces" en vez de siempre.

Como este contenedor envuelve **todas** las pantallas de la app (es el
mismo `<Outlet />` de `MainLayout.jsx`), el bug no era exclusivo del
esqueleto de carga -- cualquier pantalla con contenido "liviano" podía
verse angosta de la misma forma.

## Corrección

Se agregó `w-full` explícito al contenedor en `MainLayout.jsx`. Se
verificó con la misma réplica del layout (Playwright + contorno rojo)
que ahora sí llega a los 1220px completos, igual que el encabezado de
arriba.

## Verificación

`npm run build` corre limpio. Verificado visualmente con captura de
pantalla real (antes/después) usando el layout real, no una
aproximación.

## Acción requerida del usuario

Ninguna en base de datos. Confirmar en producción que el Resumen (y el
resto de pantallas) ya no se ven angostas al cargar.
