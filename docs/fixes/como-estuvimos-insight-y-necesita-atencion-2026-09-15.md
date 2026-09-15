# "Cómo estuvimos" — texto de insight + "Necesita tu atención" — 2026-09-15

## Contexto

El usuario comparó capturas de la vista previa original (Artifact
"Radiografía SIGAP") contra lo construido en producción y notó que
varias tarjetas del mockup traían una frase de contexto debajo del
número, y que dos secciones completas del mockup ("Necesita tu
atención" y "Actividad por comité") nunca se llevaron a código.
Se le explicó con precisión qué era redundancia real (evitada a
propósito) y qué simplemente no se había construido, y se acordó
completar lo pendiente. A mitad de esa conversación pidió además
revisar y aplicar el mismo criterio en Distrital y Nacional.

## Diagnóstico (antes de tocar código)

- **"Personas activas" y "Ritmo de asistencia"** del mockup **sí** ya
  existían como sus propias secciones más abajo en la misma pantalla
  (StatTile y el gráfico de 6 periodos) — no duplicar era correcto.
- **El texto de insight por tarjeta** (p.ej. "el censo sigue creciendo
  de forma sostenida") nunca se construyó — simplificación real, no
  una decisión deliberada.
- **"Necesita tu atención"** (familias sin asociar, comités sin
  integrantes, sugeridos para comité) y **"Actividad por comité"**
  (desglose por frente) no existían en ningún lugar de la app *en esta
  forma agregada*, aunque partes de la lógica sí existían dispersas:
  `CommitteeAnalytics` en Feligresía ya calculaba "comités sin
  integrantes" (`withoutMembers`), y la ficha de cada persona ya
  mostraba "comités sugeridos" vía `sugerirComites()`
  (`src/lib/comitesPorPoblacion.js`). Se reutilizaron esas mismas
  definiciones para no mostrar nunca un número distinto entre
  pantallas.

## Construido

### Refactor pequeño previo
`MOVIMIENTO_LABELS` (antes solo en `FeligresiaAdmin.jsx`) se movió a
`src/lib/movimientos.js` para poder reutilizarlo también en
`Dashboard.jsx` sin duplicar el mapa de etiquetas.

### Rol local (`Dashboard.jsx`)

**Nuevas consultas** (2, ambas en el mismo `Promise.all` que ya
existía, sin efectos nuevos): `comites` con `membresias_comite`
anidado, y `rangos_edad_comite` vía `getRangosEdadComite()`. Se
agregó `genero, estado_civil` a la consulta de `personas` que ya se
hacía (necesarios para `sugerirComites`).

**Texto de insight en las 4 tarjetas de "Cómo estuvimos"**, todo con
datos ya calculados (cero consultas nuevas para esto):
- Asistencia: actividades registradas vs. el periodo anterior.
- Bautizados/Sellados: cuántos de los bautizados del periodo aún no
  están sellados (comparando por persona, no solo por conteo).
- Altas/Bajas: motivo real de cada movimiento (`baja_traslado`,
  `alta_recibimiento`, etc., vía `MOVIMIENTO_LABELS`) — igual que el
  mockup mostraba "la baja fue por traslado", pero con el dato real en
  vez de inventado.
- Alertas: referencia cruzada al conteo de "Necesita tu atención".

**Nueva sección "Necesita tu atención"**: familias/personas activas
sin `familia_id`, comités activos sin integrantes vigentes (misma
definición exacta que `CommitteeAnalytics`), y sugeridos para comité
(bautizados, sin comité activo, que calzan por edad/género/estado
civil con algún `rango_edad_comite` configurado).

**Nueva sección "Actividad por categoría"**: reutiliza
`categoriasConTotal` (ya calculado para el periodo actual, usado por
el selector de categoría) como grid, en vez de tener que hacer clic
categoría por categoría para verlas todas.

### Distrital y Nacional (`Dashboard.jsx`)

Solo se agregó el texto de insight a las 4 tarjetas existentes de
"Cómo estuvimos este mes" (promedio por congregación/distrito, quiénes
no crecieron, balance de altas/bajas, cobertura de bautismos) — todo
agregado de datos que `resumen_distrital()`/`resumen_nacional()` ya
traían, cero consultas nuevas.

**"Necesita tu atención" y "Actividad por comité" NO se replicaron
ahí**, porque en esos dos niveles el equivalente real ya existe en la
misma pantalla: "Semáforo del distrito/nacional" ya cubre vacantes de
pastor, actividad congregacional y directiva vacante, y "Comparativa
por congregación/distrito" ya es el desglose por unidad. Replicarlo
habría sido la redundancia real que sí se evitó a propósito.

## Verificación

- `npm run build` sin errores en cada paso.
- Playwright con la cuenta real `pueba691@gmail.com`: capturas del
  rol local (con datos reales de comités: 2 comités activos sin
  integrantes detectados y mostrados correctamente, coincidiendo con
  las alertas pastorales ya existentes en la misma pantalla; 4
  personas activas sin familia asociada; grid de "Actividad por
  categoría" con números idénticos a los que ya mostraba la sección
  "Composición" más abajo, confirmando que no hay doble cálculo).
- Distrital y nacional verificados con el mismo parche temporal de
  enrutamiento usado en la pieza anterior (revertido antes de este
  commit) — insight de las 4 tarjetas visible y correcto en ambos.
- Cero errores de consola en las 3 pantallas.
