# Menú desplegable tapado por la tarjeta siguiente — 2026-11-06

## Síntoma

En `/equipo-congregacion`, el menú de sugerencias al escribir en
"Persona" aparecía cortado justo donde empezaba la tarjeta "Perfiles
activos" — y al mover el mouse por la lista, parpadeaba y no dejaba
seleccionar nada.

## Causa real (dos partes, no una)

`.card` en este proyecto usa `backdrop-filter` (efecto "vidrio") —
eso crea su propia burbuja de apilamiento (stacking context) en CSS,
aislada del resto de la página. El menú `position: absolute` con
`z-index` alto dentro de esa tarjeta solo competía contra otros
elementos de esa misma tarjeta, nunca contra la tarjeta hermana que
viene después en el HTML, que siempre se pintaba encima.

Arreglar solo eso (quitando `backdrop-filter` con
`style={{ backdropFilter: 'none' }}`) no bastó: `.card:hover` aplica
`transform: translateY(-2px)`, y cualquier `transform` distinto de
`none` TAMBIÉN crea su propia burbuja de apilamiento — pero solo
mientras el mouse está encima. Confirmado con `elementFromPoint` en
cada paso de un movimiento de mouse real (no con una sola captura):
el `transform` se prendía y apagaba según la posición exacta del
cursor, y cada vez que se prendía, el menú volvía a quedar atrapado
— de ahí el parpadeo real.

## Arreglo

Clase nueva `.card-menu-flotante:hover { transform: none; }` en
`index.css`, aplicada JUNTO con `backdropFilter: 'none'` a la
tarjeta que contiene el menú. Aplicada en los 3 lugares de la app
con este patrón: `EquipoCongregacion.jsx`,
`GestionPastoralNacional.jsx` y los 2 formularios de
`PastoralDistrital.jsx` (uno de estos ya tenía solo la mitad del
arreglo, de antes de esta sesión).

Verificado con movimiento de mouse real + hit-testing en cada punto
del recorrido (sin oscilación) y con un clic real sobre un ítem de la
lista (selecciona correctamente).

Ver memoria del proyecto para la regla general a aplicar en cualquier
dropdown nuevo dentro de una `.card`.
