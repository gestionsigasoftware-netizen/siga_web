# "Cómo estuvimos" en el Resumen local — 2026-09-14

## Contexto

El usuario pidió, en vez de un resumen periódico por correo, una
sección dentro del propio Resumen que responda "cómo estuvimos esta
semana/quincena". Se acordó primero una vista previa (Artifact,
"Radiografía SIGAP") estilo BI para validar el tono visual antes de
construirlo real, y luego se aprobó para llevarlo al código.

## Construido (rol local)

`src/pages/Dashboard.jsx`:

- **"Quincenal" agregado como frecuencia real**, no solo visual:
  `FRECUENCIAS`, `inicioPeriodo`, `desplazarPeriodo`, `etiquetaPeriodo`
  y `FRECUENCIA_PERIODOS` extendidos (ventana rodante de 14 días,
  sin alineación a un calendario -- no existe un "quincenario" oficial
  como sí lo hay para semana ISO o mes calendario). Se detectó y
  corrigió de paso un bug real: `FRECUENCIA_PERIODOS` no tenía la
  entrada `quincenal`, lo que habría dejado `undefined` en frases ya
  existentes ("Asistentes del ...") en cuanto alguien seleccionara esa
  frecuencia.
- **Nueva sección "Cómo estuvimos [este/esta período]"**, justo debajo
  del hero, con:
  - Veredicto en una frase (creciste/bajaste/te mantuviste igual X%),
    calculado con la misma `variacion` que ya usaba "Ritmo de
    asistencia" -- nunca puede mostrar un número distinto al resto de
    la pantalla para el mismo período.
  - Insignia de logro (🏆) solo si el período actual iguala o supera
    el máximo de asistencia de los últimos 6 períodos visibles -- no
    se muestra si no es realmente el mejor (verificado con datos
    reales en cero, donde correctamente no aparece).
  - 4 tarjetas: Asistencia (con variación), Bautizados/Sellados del
    período (nuevo: se agregaron `fecha_bautismo`,
    `sellado_espiritu_santo`, `fecha_sellado` a la consulta de
    personas que ya se hacía), Altas/Bajas con balance neto y
    comparación contra el período anterior (nuevo: se agregó `fecha`
    a la consulta de `movimientos_membresia`, antes solo traía
    `tipo`), y Alertas pastorales activas ahora mismo.
  - Botón "Descargar informe" reutilizando el PDF que ya existía.
- **Corrección de gramática real** encontrada al probar con datos
  reales: la frase decía "esta mensual" / "esta semanal" (adjetivo sin
  sustantivo, español inválido). Se agregó `FRECUENCIA_ESTA` (mapa con
  el artículo correcto por género: "esta semana", "este mes", "esta
  quincena"...) y se cambiaron las frases de comparación a "frente al
  periodo anterior" (sustantivo fijo, evita tener que declinar género
  en cada frase).

**Deliberadamente NO se inventó**: un conteo de "alertas resueltas
esta semana/quincena" -- no existe un registro histórico de cuándo se
resolvió cada alerta (son vistas de estado actual, no un log), así que
la tarjeta de alertas muestra el total activo ahora mismo, sin fingir
una comparación de período que no se puede sustentar con datos reales.

## Pendiente / alcance no cubierto todavía

**Distrital y nacional NO tienen esta sección todavía.** A diferencia
de local, esos dos dashboards no tienen ningún sistema de frecuencia
seleccionable (semana/quincena/mes) -- usan ventanas fijas (30/60/90
días) ya calculadas en `resumen_distrital()`/`resumen_nacional()`.
Construir la misma experiencia con período seleccionable ahí implica
una pieza de trabajo separada (nueva agregación SQL o extender las
funciones existentes). Queda para retomar si el usuario lo pide
explícitamente -- no se asumió que había que hacerlo en la misma
sesión sin confirmar alcance.

## Verificación

- `npm run build` sin errores en cada paso.
- Playwright con la cuenta real `pueba691@gmail.com`: capturas en
  Mensual (77% de crecimiento real, logro mostrado correctamente),
  Quincenal (mismo patrón, gramática corregida) y Semanal (0
  asistencias reales en la semana en curso -- verificado que la
  sección no rompe ni inventa nada con datos en cero, y que
  correctamente NO muestra el logro).
- Cero errores de consola en las 3 frecuencias probadas.
