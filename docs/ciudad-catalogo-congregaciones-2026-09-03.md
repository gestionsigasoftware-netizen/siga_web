# Ciudad automática en el catálogo de congregaciones (2026-09-03)

## Pregunta del usuario

Al elegir una congregación oficial en "Registrar nueva congregación",
el nombre se autocompleta pero "Ciudad/Municipio" queda vacío. Pidió
que la ciudad (no el departamento) se capturara automáticamente.

## Por qué estaba vacío

Debora solo entrega `{id, name}` por congregación — no un campo de
ciudad separado. El nombre ya trae la ciudad "pegada" como texto libre,
ej. `"AGUACHICA 3 LA UNION CESAR"` (Aguachica = ciudad, Cesar =
departamento) o `"SAN RAFAEL SANTANDER DE QUILICHAO CAUCA"` (Santander
de Quilichao = ciudad, un municipio real de varias palabras).

## Cómo se extrajo

Se cruzó cada uno de los 5,367 nombres contra la lista oficial de
municipios de Colombia (dataset público
[marcovega/colombia-json](https://github.com/marcovega/colombia-json),
31 departamentos y ~1,124 municipios reales — no se adivina por
posición fija de palabra):

1. Se identifica el departamento comparando el final del nombre contra
   los 33 departamentos reales (probando primero los de nombre más
   largo, para que "Norte de Santander" no se confunda con
   "Santander").
2. Dentro de lo que queda del nombre, se busca el municipio real más
   largo de ese departamento que aparezca como palabra completa.
3. Se expandieron abreviaturas reales encontradas en los datos de
   Debora antes de buscar (BOG→Bogotá, BQUILLA→Barranquilla,
   CGENA→Cartagena, BMANGA→Bucaramanga, BMEJA→Barrancabermeja,
   VDUPAR→Valledupar, VCIO→Villavicencio) — confirmadas contando
   ocurrencias reales, no adivinadas al azar.

Resultado: **3,305 de 5,367 (61.6%)** quedaron con ciudad identificada
con confianza. El resto (nombres con errores de tipeo en el
departamento, abreviaturas no cubiertas, o nombres administrativos que
no son congregaciones reales como "DISTRITO 1" o "CONGREGACIÓN DE
PRUEBA D2") se dejó en blanco — no se adivina para no meter datos
incorrectos.

## Backend — `supabase/agregar_ciudad_catalogo_congregaciones.sql`

Agrega la columna `ciudad` a `catalogo_congregaciones_ipuc` y hace un
solo `update` masivo (no miles de sentencias sueltas) con los 3,305
pares `(distrito_numero, id_debora) -> ciudad` ya resueltos.

## Frontend

`loadCatalogoCongregaciones()` ahora trae también `ciudad`. Al elegir
una sugerencia en "Registrar nueva congregación", si esa fila del
catálogo tiene ciudad identificada, se autocompleta el campo
"Ciudad/Municipio" junto con el nombre. Si no la tiene, el campo queda
como estaba (vacío, para llenarlo a mano).

## Verificación

`npm run build` corre limpio.

## Acción requerida del usuario

Ejecutar `supabase/agregar_ciudad_catalogo_congregaciones.sql`.
