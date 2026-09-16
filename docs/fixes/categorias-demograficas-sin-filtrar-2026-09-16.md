# Categorías demográficas duplicadas en el Resumen — 2026-09-16

## Contexto

El usuario reportó (captura de pantalla) ver la sección "Actividad por
categoría" del Resumen local con las mismas 9 categorías **dos
veces**: una con números reales (Damas 194, Jóvenes 144...) y otra
idéntica con todo en cero. La cuenta usada tenía nombre visible
"super admin" -- una cuenta con doble rol (super_admin + pastor local
de Puerto Tejada), viendo el rol local.

## Causa real (confirmada, no una hipótesis)

`src/pages/Dashboard.jsx:1460` cargaba las categorías demográficas
así:

```js
supabase.from('categorias_demograficas').select('id, nombre').order('orden')
```

**Sin `.eq('congregacion_id', ...)`** -- a diferencia de todas las
demás consultas del mismo `Promise.all`, que sí filtran por
congregación. La consulta confiaba por completo en el permiso de la
base de datos (RLS) para acotar el resultado.

Eso funciona bien para un pastor local normal, porque su permiso
(`mis_congregaciones()`) solo le da su propia congregación. Pero para
una cuenta con rol `super_admin` (o `nacional`), `mis_congregaciones()`
devuelve **todas las congregaciones del país** (confirmado en
`supabase/schema/schema.sql`: `select id from congregaciones where
es_super_admin() or es_nacional()`). Y como cada congregación nueva
se siembra automáticamente con el mismo set de 9 nombres de categoría
(Niños, Adolescentes, Jóvenes, Caballeros, Damas, Ancianos, Amigos,
Población sorda, Población indígena/étnica -- ver
`supabase/schema/schema.sql` líneas 313-318), la consulta sin filtrar
trajo las categorías (mismos nombres, distinto `id`) de otra
congregación además de las de Puerto Tejada. Las de Puerto Tejada
mostraron sus números reales; las de la otra congregación mostraron 0
porque sus IDs nunca aparecen en el `desglose` de los registros de
Puerto Tejada.

## Corregido

Se agregó el filtro que faltaba:

```js
supabase.from('categorias_demograficas').select('id, nombre').eq('congregacion_id', rolPrincipal.congregacion_id).order('orden')
```

## Hallazgo relacionado, NO corregido todavía

`src/pages/ReportesOptimizado.jsx:59` tiene el mismo patrón sin
filtrar. Ahí el síntoma sería distinto: ese archivo sí filtra por
congregación en otras consultas (`detailRequest`), pero para
distrital/nacional/super_admin viendo "todas las congregaciones"
combinadas, `categoryTotals` agrupa por `id` de categoría, no por
nombre -- así que si dos congregaciones distintas ambas tienen una
categoría "Niños" con datos reales, en vez de sumarse en una sola
tarjeta "Niños: X" aparecerían como dos tarjetas separadas con el
mismo nombre y totales parciales. No se corrigió en esta pieza porque
requiere una cuenta real distrital/nacional para verificar el
comportamiento exacto (no se tiene credencial para eso esta sesión) y
porque la corrección correcta ahí es distinta (agrupar por nombre al
combinar congregaciones, no solo agregar un filtro). Queda pendiente
para retomar si se confirma como problema real.

## Verificación

- `npm run build` sin errores.
- Consulta directa a `categorias_demograficas` para Puerto Tejada:
  confirmadas exactamente 9 filas reales (sin duplicados en la tabla
  -- el problema era de la consulta, no de datos corruptos).
- Playwright con la cuenta real: "Actividad por categoría" ahora
  muestra exactamente 9 tarjetas, con los 9 nombres reales, sin
  duplicados ni ceros fantasma.
- Cero errores de consola.
