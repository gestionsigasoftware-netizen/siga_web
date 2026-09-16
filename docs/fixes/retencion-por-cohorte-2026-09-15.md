# Retención por cohorte de ingreso — 2026-09-15

## Contexto

El usuario preguntó si SIGAP web ya es suficiente para análisis/toma
de decisiones. Se hizo un balance honesto: lo descriptivo (pirámide,
ciclo de vida, embudo evangelístico, semáforos, comparativas) ya está
fuerte, pero faltaba responder "de los que entraron hace tiempo,
¿cuántos siguen activos?" -- la pregunta clásica de retención. De las
3 brechas identificadas (tendencia histórica distrital/nacional,
retención/cohortes, detección de anomalías), se eligió retención por
ser la única calculable HOY con datos que ya existen, sin nueva
infraestructura.

## Qué se decidió construir (y qué no)

Una curva de retención "real" (% activo al mes 1, 2, 3... desde el
ingreso) requeriría reconstruir el estado histórico de cada persona
mes a mes -- SIGAP solo guarda el estado ACTUAL (`estado_membresia`),
no un historial de estados. Inventar esa curva sería fabricar datos
que no existen.

En su lugar se construyó algo más simple y honesto: agrupar a las
personas por el trimestre en que ingresaron (cohorte), y para cada
cohorte mostrar cuántas de esas personas siguen activas **hoy**. No es
una curva de retención en el tiempo, es una fotografía actual por
cohorte -- pero es información real y ya responde la pregunta de fondo
("¿qué trimestre retuvo peor?").

## Construido

`src/pages/FeligresiaAdmin.jsx`, dentro de `FeligresiaInsights`
(pestaña "Evolución" de Feligresía), nueva sección "Retención por
cohorte de ingreso", justo después de "Evolución de ingresos" (mismo
tema, orden natural):

- Agrupa `people` (censo completo, ya cargado -- cero consultas
  nuevas) por trimestre de `fecha_ingreso`, usando `trimestreDe()` de
  `src/lib/trimestre.js` (ya existía, reutilizado del Informe
  Trimestral).
- **Deliberadamente usa el censo completo sin filtro**, no
  `filteredPeople`: si se filtrara por estado "activo" (el filtro que
  ya tiene esta pantalla), cada cohorte mostraría 100% de forma
  trivial y sin sentido.
- Tabla por cohorte: cuántos ingresaron, cuántos activos hoy, %
  retención, y desglose de por qué los demás no están activos
  (apartados / trasladados / otras bajas -- inactivo o fallecido).
  El desglose importa porque un traslado no es lo mismo que un
  apartamiento: alguien trasladado sigue en la iglesia, solo cambió de
  congregación.
- Insight automático: nombra las cohortes con al menos 3 ingresos y
  menos de 60% de retención (umbral mínimo de 3 para no señalar una
  cohorte de 1 persona como "crisis" por un solo caso).
- Reutiliza `.table-scroll` (la clase de sombra de scroll ya
  construida esta sesión) para la tabla en móvil.

## Verificación

- `npm run build` sin errores.
- Playwright con la cuenta real: la pestaña "Evolución" de Feligresía
  muestra cohortes reales desde T4 2012 hasta T3 2026, cada una con su
  retención calculada correctamente (100% en todas, dato real de esta
  congregación pequeña -- nadie se ha apartado/trasladado todavía) y
  el mensaje de insight correctamente en verde (sin cohortes de
  riesgo).
- Cero errores de consola.

## Pendiente (comunicado, no construido)

Las otras dos brechas identificadas en la conversación con el usuario
(tendencia histórica real en distrital/nacional, detección de
anomalías en las comparativas) quedan para retomar si se piden
explícitamente -- la primera requiere decidir si vale la pena
construir infraestructura de snapshots con tan pocas congregaciones
reales activas hoy; la segunda es una capa de análisis más avanzada
sobre las tablas comparativas que ya existen.
