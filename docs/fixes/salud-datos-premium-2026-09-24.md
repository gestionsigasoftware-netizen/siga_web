# Salud de Datos "premium": más información e insights por rol

**Fecha:** 2026-09-24
**Módulo:** `src/pages/SaludDatos.jsx`, `supabase/reportes/fix_salud_datos_consistencia_bautismo_sellado.sql`

## Contexto

El usuario preguntó si Salud de Datos estaba bien o le faltaba algo.
Revisando el código real: solo medía 5 campos (fecha de nacimiento,
género, teléfono, familia, fecha de ingreso), sin ningún gráfico, sin
forma de saber A QUIÉN le falta el dato, sin exportar, y sin medir
bautizado/sellado -- justo los campos que alimentan el Informe
Trimestral y varios KPIs del Dashboard, pese a que el propio texto de
la pantalla dice que la pirámide/cumpleaños/proyección "solo son tan
buenas como estos datos". El usuario pidió dejarlo "premium con la
información y lo que debería tener cada rol".

## Hallazgo importante durante la investigación

`bautizado` y `sellado_espiritu_santo` son `boolean not null default
false` (`supabase/modulos/feligresia.sql`, `hitos_espirituales.sql`) --
a diferencia de `fecha_nacimiento`/`genero`/`telefono`, un `false` ahí
**no es necesariamente un dato faltante** (puede ser real: la persona
legítimamente no está bautizada todavía). La métrica correcta, la que
sí es una inconsistencia real y accionable, es: `bautizado = true` con
`fecha_bautismo is null` (dice que está bautizado pero no sabe cuándo)
-- mismo patrón para `sellado_espiritu_santo`/`fecha_sellado`. Es la
que se agregó, no un "% con bautizado".

## Cambios de SQL (pendiente de ejecutar en producción)

`supabase/reportes/fix_salud_datos_consistencia_bautismo_sellado.sql`
(nuevo, no se editó el archivo original ya ejecutado) amplía
`resumen_salud_datos_distrital(uuid)` y `resumen_salud_datos_nacional()`
con 4 columnas: `bautizados`, `bautizados_sin_fecha`, `sellados`,
`sellados_sin_fecha`. Mismo filtro por `mis_congregaciones()`/`mis_distritos()`
que ya tenían, sin cambios de RLS.

## Cambios de frontend

- **Encabezado**: `ExportButtons` (CSV/Excel/PDF) agregado -- era uno
  de los pocos módulos sin exportación.
- **Fila de métricas** (nueva): completitud promedio, personas activas
  medidas, bautizados sin fecha, sellados sin fecha (estas 2 últimas
  en rojo si son mayores a 0 -- son alertas, no "cuánto falta llenar").
- **"Ver quién"** (nuevo, solo local): cada barra de completitud y cada
  inconsistencia de bautismo/sellado tiene una lista expandible con los
  nombres reales de las personas afectadas -- el frontend ya tenía la
  lista completa de personas en memoria, no hizo falta ninguna consulta
  nueva.
- **Congregaciones sin ubicación en el mapa** (nuevo, distrital/nacional):
  conecta con el trabajo de mapas de hoy -- una congregación sin
  `latitud`/`longitud` no aparece en el Mapa de presencia ni en
  Territorio alcanzado (Impacto Misionero), y antes nadie se enteraba
  desde Salud de Datos.
- **Gráfico de ranking** (nuevo, distrital/nacional): barras
  (`distributionDataset`, mismo patrón que Dashboard/Impacto Misionero)
  ordenando congregaciones/distritos de menor a mayor completitud --
  responde directo a "dónde enfocar el trabajo primero".
- **Drill-down nacional** (nuevo): cada fila de distrito es expandible;
  al abrirla, llama a `resumen_salud_datos_distrital(distrito_id)` --
  la misma función que ya usa distrital, reutilizada tal cual (nacional
  ya puede invocarla porque `mis_congregaciones()` le devuelve todas
  las congregaciones, verificado leyendo `schema.sql` antes de asumirlo)
  -- y muestra la tabla de congregaciones de ese distrito anidada, sin
  necesidad de ninguna función RPC nueva para esto.
- Tabla existente (`TablaSalud`, ahora un componente reutilizado dos
  veces: nivel principal y detalle anidado) ampliada con las 2 columnas
  nuevas de consistencia.

## Verificación

1. `npm run build` sin errores.
2. **Bug real encontrado y corregido antes de construir**: la primera
   versión de `TablaSalud` usaba fragmentos abreviados `<>...</>`
   dentro de un `.map()` -- React exige una key en el elemento que
   envuelve cada item de una lista, y un fragmento abreviado no puede
   llevarla. Corregido usando `<Fragment key={id}>` explícito
   (`import { Fragment } from 'react'`).
3. Verificación real con login (cuenta de prueba, rol local) vía
   Playwright: `/salud-datos` carga sin errores de consola ni de
   página, las 4 métricas muestran datos reales (9 personas activas,
   51% completitud promedio, 0 inconsistencias), y "Ver quién" expande
   una lista con nombres reales de personas a las que les falta el dato.
4. **Limitación aceptada, igual que otras piezas de hoy**: sin cuenta
   de prueba con rol distrital/nacional, no hubo clics reales posibles
   sobre el ranking ni el drill-down -- verificado por código
   (columnas de la función RPC ampliada coinciden exactamente con lo
   que lee el frontend) en vez de por interacción real.

## Pendiente del usuario

Ejecutar `supabase/reportes/fix_salud_datos_consistencia_bautismo_sellado.sql`
en el SQL Editor de Supabase -- sin esto, las vistas distrital/nacional
seguirán funcionando con las columnas viejas (Postgres/PostgREST
simplemente no encontrará `bautizados_sin_fecha`/`sellados_sin_fecha`
en la respuesta, esos valores quedarán como `undefined`/`0` en el
frontend hasta que se ejecute).
