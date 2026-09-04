# Rediseño del flujo de la Ruta Evangelística (2026-09-04)

## El problema

El usuario reportó que al hacer clic en "Uno Más" o "BIS" (desde
Misiones y Evangelismo) llegaba de vuelta a la misma pantalla genérica
de "Amigos en ruta", sin nada propio de esa estación. Se auditó el
código real y se confirmó que no era una confusión suya:

- "Uno Más" y "BIS" enlazaban a `/amigos?station=uno_mas` / `?station=bis`,
  pero ese parámetro casi no se usaba (para `uno_mas` ni siquiera se
  leía; para `bis` solo ocultaba un botón y mostraba un aviso). Ninguna
  de las dos filtraba nada ni mostraba métricas propias.
- **REFAM** gestionaba grupos/participantes/reuniones dentro de
  `Evangelismo.jsx`, pero nunca creaba una fila en `ruta_procesos` --
  esto no era solo un problema de UI: `resumen_distrital()`
  (`bi_fase2_insights.sql`) ya calculaba `funnel_refam` contando esas
  filas, así que ese número llevaba mal desde que existe.
- **ESFOB / Discipulado** sí tenían página propia, pero "Iniciar
  proceso" insertaba directo en `ruta_procesos` con
  `estado: config.activeState` (ej. `'en_formacion'`) -- un valor que
  **no existe** en el check constraint de `ruta_procesos.estado`
  (`'activo' | 'completado' | 'pausado' | 'cancelado'`). Este insert
  llevaba tiempo fallando en silencio (mensaje genérico de error), lo
  cual también significaba que ningún proceso de ESFOB/Discipulado
  iniciado desde ahí quedaba realmente registrado en la Ruta
  Evangelística -- un bug real, no solo cosmético, descubierto en el
  proceso de esta auditoría.
- Ninguna de las 6 estaciones mostraba cuánto tiempo llevaba cada
  persona ahí, ni tenía forma de trasladarla libremente a otra
  estación (solo existía un avance secuencial "a la siguiente", que no
  reflejaba cómo se usa esto en la práctica).

## Decisiones de diseño (confirmadas con el usuario)

1. El orden de las 6 estaciones **no es obligatorio**. Cada estación
   representa una metodología o situación real -- alguien que recibe
   REFAM en su barrio entra directo a REFAM, no tiene que pasar antes
   por Uno Más/BIS. El líder de zona caracteriza en qué estación está
   realmente un amigo, y el traslado entre estaciones debe poder
   hacerse **libremente**, no solo "a la siguiente".
2. Alguien que se estancó y retoma meses después no debe verse forzado
   a reiniciar -- esto ya lo resuelve la arquitectura sin código nuevo:
   como nada cierra automáticamente un proceso activo, la persona sigue
   apareciendo en su última estación; lo que faltaba era que esa
   estación tuviera un tablero donde el líder la viera y la retomara
   (la señal de "lleva muchos días sin avance" cumple ese rol).
3. REFAM se sincroniza con `ruta_procesos` (corrige `funnel_refam`).
4. Umbrales de "días sin avance" fijos: Uno Más 15, BIS 30, REFAM 60,
   ESFOB 90 (con las lecciones completadas como señal principal),
   Discipulado 180 (recordatorio de continuidad, no "graduación").
5. Se mide el tiempo promedio de conversión (primer contacto → bautismo)
   por metodología y por zona, para saber qué funciona mejor por
   barrio/líder.

## Modelo resultante

- **"Amigos en ruta" (`Amigos.jsx`) = ficha maestra del amigo.** Datos
  personales, notas, historial de etapas, bautizar/sellar/incorporar a
  Feligresía. Ya no tiene el selector de traslado ni los formularios de
  compromiso Uno Más/atención BIS -- solo muestra en solo lectura la
  estación actual, los días, y un enlace a esa estación.
- **Cada una de las 5 estaciones de persona tiene su propio tablero**
  (`EstacionUnoMas.jsx`, `EstacionBis.jsx`, `EstacionRefam.jsx`, y
  `RutaFormacion.jsx` para ESFOB/Discipulado): quién está activo + días,
  alta/traslado libre, el detalle propio de cada estación (compromiso,
  atención, grupos/reuniones, lecciones/objetivos -- sin cambios en esa
  parte), métricas, candidatos a trasladar, gráfico por zona, insight.
  Métodos se queda en `Evangelismo.jsx` porque diagnostica zonas, no
  amigos individuales.
- **Un solo mecanismo de traslado** (`iniciarOMoverEstacion` en
  `src/lib/rutaEvangelistica.js`), reutilizado en las 5 páginas: si la
  persona ya tiene un proceso activo en cualquier estación, lo cierra
  como completado y abre uno nuevo en el destino; si no tiene ninguno,
  lo crea. Sin restricción de orden secuencial.

## Cambios

- **`src/lib/rutaEvangelistica.js`** (nuevo): `UMBRAL_DIAS_ESTACION`,
  `diasDesde`, `getEstacion`, `getEstacionActivos`,
  `iniciarOMoverEstacion`.
- **`src/pages/EstacionUnoMas.jsx`** (nuevo, ruta `/uno-mas`): tablero
  completo, con el CRUD de `uno_mas_compromisos` movido desde
  `Amigos.jsx`.
- **`src/pages/EstacionBis.jsx`** (nuevo, ruta `/bis`): tablero
  completo, con el CRUD de `bis_atenciones` movido desde `Amigos.jsx`.
- **`src/pages/EstacionRefam.jsx`** (nuevo, ruta `/refam`): la gestión
  de grupos/participantes/reuniones se movió aquí desde
  `Evangelismo.jsx`; agregar un participante ahora también sincroniza
  `ruta_procesos` (corrige el bug de `funnel_refam`); trasladar a otra
  estación también marca `refam_participantes.estado = 'completado'`.
- **`src/pages/Amigos.jsx`**: se quitó el bloque de traslado/compromiso/
  atención; queda un renglón de solo lectura con la estación y los días.
- **`src/pages/Evangelismo.jsx`**: se quitó la sección REFAM (con enlace
  a la nueva página); se agregó el gráfico e insight de días promedio
  hasta el bautismo, por metodología y por zona.
- **`src/pages/RutaFormacion.jsx`** (ESFOB/Discipulado): usa
  `iniciarOMoverEstacion` (corrige el bug del `estado` inválido en
  `ruta_procesos`); agrega días en la estación, candidatos a trasladar,
  gráfico por zona (solo ESFOB, que usa amigos con zona) y botón de
  traslado libre a cualquier otra estación.
- **`src/pages/MisionesEvangelismo.jsx`**: los enlaces de Uno Más, BIS y
  REFAM ahora apuntan a sus tableros propios.
- **`src/App.jsx`**: 3 rutas nuevas (`/uno-mas`, `/bis`, `/refam`).

## Verificación

`npm run build` corre limpio. Cada estación se probó de punta a punta
con Playwright y confirmación directa en base de datos (no solo mensaje
de éxito en pantalla):

- Uno Más → BIS: traslado libre, atención con `integrado=true`, badge
  "listo para trasladar", ficha de Amigos ya sin el formulario viejo.
- REFAM: agregar un participante sincroniza `ruta_procesos`; trasladar
  a ESFOB marca el participante como completado.
- ESFOB: inicio directo (sin pasar por Uno Más/BIS/REFAM) con 4/4
  lecciones, badge de listo para trasladar.
- Discipulado: inicio directo para una persona bautizada del censo.

Todos los datos de prueba creados se eliminaron al terminar cada
verificación.

## Hallazgo aparte (no corregido, fuera de este plan)

Al verificar "Amigos en ruta" se encontró que la consulta a
`historial_amigos` devuelve 404 -- Supabase/PostgREST no encuentra esa
tabla en el schema cache (`PGRST205`), pese a que
`evangelismo.sql` la crea. El historial de etapas en la ficha del amigo
nunca ha funcionado en este proyecto (falla en silencio, no rompe la
página). No se investigó ni se corrigió -- es un hallazgo aparte, no
relacionado con este rediseño.

## Explícitamente fuera de este plan

- Traslado de un "amigo" entre congregaciones distintas.
- Umbrales de días configurables por congregación (se pidieron fijos).
- Cambios al modelo de "Métodos" (diagnóstico de zonas).
