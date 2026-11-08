# Paginación en Corrección y Contingencia — 2026-11-08

## Contexto

Después de agregar paginación a "Mi historial" en la PWA (ver
`docs/mantenimiento/` o memoria de sesión), el usuario preguntó si
"Corrección y Contingencia" (`/registrar`, `RegistrarAsistencia.jsx`)
tenía lo mismo. No lo tenía: la tabla de abajo del formulario traía
los registros con un `.limit(10)` fijo, sin ninguna forma de ver el
resto del historial de esa congregación.

## Corrección

Mismo patrón ya establecido en otras pantallas de la web
(`Amigos.jsx`, `AuditoriaFeligresia.jsx`, `FeligresiaAdmin.jsx`,
`ReportesOptimizado.jsx`): `.select(..., { count: 'exact' })` +
`.range(pagina * TAM, pagina * TAM + TAM - 1)` + orden estable con
`.order('fecha', ...).order('id', ...)`, con botones
"Anterior"/"Siguiente" (`btn-secondary`, deshabilitados en los
extremos) y el texto "Página X de Y · N registros" — paginación real
de páginas fijas de 10, nunca scroll infinito.

La carga de esta tabla se separó del resto del formulario (módulos,
categorías, reglas de captura) para poder paginar sin repetir esas
otras consultas cada vez. Al guardar una corrección nueva, se vuelve
a la página 1 (el registro nuevo aparece ahí, por ser el más
reciente).

Se renombró el título de "Registros recientes" a "Historial de
registros" en los 3 idiomas — ya no son solo los recientes, es el
historial completo paginado (mismo ajuste de nombre que se hizo en
"Mi historial" de la PWA por la misma razón).

Commit `904ff6b`, pusheado.
