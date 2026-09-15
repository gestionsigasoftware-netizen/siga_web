# "Cómo estuvimos" — desgloses por congregación/distrito y cargo — 2026-09-15

## Contexto

Continuación directa de la comparación mockup vs. producción de la
pieza anterior. El usuario notó que, además de las secciones que
faltaban, el TEXTO de los insights que sí existían en distrital/
nacional era más genérico que el del mockup: el mockup nombraba
quién aportó más ("Puerto Tejada y Villarrica aportan 8 de las 11
altas") y qué cargo específico faltaba ("Falta cubrir Veedor desde
hace 2 quincenas"), mientras que lo construido solo daba conteos
agregados ("X congregaciones tuvieron al menos un bautismo").

## Diagnóstico

Confirmado con el código: no era una limitación real de datos.
`resumen_distrital()`/`resumen_nacional()` ya traen los campos por
congregación/distrito (`asistencia_ultimo_mes`, `altas_3m`,
`bautismos_3m`) — solo no se estaban usando para identificar al mayor
contribuyente. Para el cargo vacante específico, el catálogo de los 6
cargos de junta distrital (`supervisor, secretario, tesorero,
presbitero_a, presbitero_b, veedor`) ya existía en
`PastoralDistrital.jsx`, solo que `Dashboard.jsx` nunca lo usaba para
nombrar cuál faltaba, solo contaba cuántos.

## Construido

### Refactor previo
`CARGO_DISTRITAL_LABELS` (antes solo en `PastoralDistrital.jsx`) se
movió a `src/lib/cargosDistritales.js` junto con
`CARGOS_DISTRITALES_REQUERIDOS` (los 6 cargos obligatorios, sin
"otro"), para reutilizarse en `Dashboard.jsx` sin duplicar el catálogo.

### Nuevo helper `topContribuyentes(lista, campo, etiqueta)`
Función de módulo en `Dashboard.jsx`: ordena una lista (congregaciones
o distritos) por un campo numérico y devuelve hasta 2 nombres que más
aportaron, más la suma de su aporte. Se usa igual en distrital y
nacional para no duplicar la lógica.

### Insights enriquecidos (distrital y nacional)
Las tarjetas "Asistencia", "Altas/Bajas" y "Bautismos" ahora nombran
a quién aportó más, en vez de solo un conteo agregado:
- Asistencia: "Promedio de X asistencias por congregación este mes.
  [Congregación] aporta Y de las Z." (el nombre solo aparece si hay
  más de 1 congregación/distrito -- con solo 1 sería una frase trivial
  y se omite).
- Altas/Bajas: "[Congregación] aporta Y de las Z altas en 3 meses."
  más, si aplica, cuántas tienen más bajas que altas.
- Bautismos: "[Congregación] aporta Y de los Z, el resto repartido en
  el distrito/país."

### Cargo vacante específico (solo distrital, no aplica a nacional)
La consulta de `cargos_distritales` se amplió (`select('cargo,
fecha_fin')`, sin filtrar por `fecha_fin is null`) para traer también
el historial, no solo los cargos activos -- necesario para calcular
hace cuánto quedó vacante uno. El estado se renombró de
`cargosVigentes` a `cargosDistritalesHistorial` para reflejar que ya
no son solo los vigentes.

La fila "Directiva distrital" del Semáforo ahora dice:
- Si falta exactamente 1 cargo: nombra cuál (p.ej. "Falta cubrir
  Veedor") y, si hay un registro histórico de quién lo ocupó antes,
  agrega "desde hace N días"; si nunca tuvo responsable, dice
  "(nunca ha tenido responsable asignado)" en vez de inventar una
  fecha.
- Si faltan varios: los lista todos por nombre, sin duración (para no
  alargar demasiado la frase).

**No se aplicó a nacional**: nombrar un cargo específico por cada uno
de los ~36 distritos en una sola frase agregada no tiene sentido -- el
semáforo nacional se queda con el conteo agregado que ya tenía
("X distritos con al menos un cargo vacante"), que es la escala
correcta para ese nivel.

## Verificación

- `npm run build` sin errores.
- Playwright con la cuenta real `pueba691@gmail.com` (vía el mismo
  parche temporal de enrutamiento usado en piezas anteriores,
  revertido antes de este commit): confirmado en distrital que
  "PUERTO TEJADA CAUCA CENTRAL aporta 2 de las 2 altas en 3 meses" y
  "aporta 1 de los 1" bautismos -- datos reales, sin inventar nada. El
  distrito de prueba no tiene ningún cargo de junta asignado, así que
  el semáforo mostró correctamente los 6 nombres ("Falta cubrir
  Supervisor, Secretario, Tesorero, Presbítero A, Presbítero B,
  Veedor"), validando el caso de múltiples vacantes. En nacional,
  mismo patrón con "Distrito 6 aporta 2 de las 2 altas" y "1 de los 1"
  bautismos.
- Cero errores de consola en ambas pantallas.

## Pendiente (comunicado al usuario, no construido)

Quedó fuera de esta pieza, por ser cosmético y no funcional: los 3
niveles (local/distrital/nacional) usan el mismo color de acento azul
en la card negra de "Cómo estuvimos" -- el mockup original usaba un
tono distinto por nivel (ámbar para nacional). No afecta datos, es
pendiente de diseño si se quiere retomar.
