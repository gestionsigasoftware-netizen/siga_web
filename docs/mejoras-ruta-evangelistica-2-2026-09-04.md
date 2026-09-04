# Mejoras a la Ruta Evangelística (2): lecciones medibles, línea de tiempo, responsable obligatorio, distrital y exportable (2026-09-04)

## El pedido

Tras el rediseño de la Ruta Evangelística en 6 tableros, el usuario pidió
dos cosas: (1) que REFAM y ESFOB tengan un catálogo de lecciones con
título y descripción, con progreso medible persona por persona (quien
inicia una lección permanece en ella hasta que el responsable la marca
completada, sin poder saltarse), y (2) cuatro mejoras adicionales que se
propusieron y el usuario aceptó todas. Pidió construir las 6, eligiendo
yo el orden, y un solo commit + push al final.

## Decisión de diseño

El catálogo de lecciones de REFAM y de ESFOB es **compartido por
congregación** (un solo currículo, no uno por grupo/líder) -- igual que
ya funcionan `caracteres_culto` y `ujieres_congregacion`. Discipulado no
usa este patrón (su tabla usa objetivos/servicio actual, no lecciones).

## Las 6 mejoras

### 1. Responsable obligatorio al iniciar en una estación

`iniciarOMoverEstacion` (`src/lib/rutaEvangelistica.js`) ahora rechaza un
alta nueva (no un traslado de un proceso ya activo) sin
`responsablePersonaId`. Los selectores de responsable en
`EstacionUnoMas.jsx`, `EstacionBis.jsx`, `RutaFormacion.jsx` pasaron de
opcionales a obligatorios; `EstacionRefam.jsx` ahora pide responsable al
agregar un participante (antes no lo pedía).

### 2. Línea de tiempo del amigo

`Amigos.jsx` trae ahora el historial completo de `ruta_procesos` (no
solo el activo) y lo muestra como una línea de tiempo simple: estación,
fecha de inicio → cierre (o "en curso"), responsable.

### 3. Reporte exportable por persona

Botón "Exportar" junto a la línea de tiempo -- genera un PDF con
`descargarPdf` (`src/lib/reportExport.js`, ya existente, sin cambios)
con el recorrido completo de esa persona.

### 4. Desglose por estación en Pastoral Distrital

Nueva función `resumen_ruta_evangelistica_distrital(p_distrito_id)`
(`supabase/resumen_ruta_distrital.sql`), consumida en
`PastoralDistrital.jsx` como una tabla más: congregación × Uno Más ×
BIS × REFAM × ESFOB × Discipulado × bautismos de los últimos 3 meses.
**No se pudo probar visualmente** con la cuenta de prueba (es pastor
local, y esta sección es exclusiva del rol distrital) -- sí se confirmó
que la función SQL devuelve datos correctos vía RPC directo.

### 5 y 6. Catálogo de lecciones + progreso medible -- REFAM y ESFOB

**`supabase/lecciones_ruta_evangelistica.sql`** (nuevo): `refam_lecciones`
y `esfob_lecciones` (catálogo compartido: número, título, descripción),
`refam_progreso_leccion` y `esfob_progreso_leccion` (una fila por
lección completada), y `leccion_actual_id` agregado a
`refam_participantes`/`esfob_procesos`.

**`src/pages/Modulos.jsx`**: dos secciones nuevas, "Lecciones REFAM" y
"Lecciones ESFOB / EFOB", mismo patrón que los demás catálogos (agregar,
editar, activar/desactivar). El número de cada lección se autoasigna
(siguiente disponible), no se edita a mano.

**`src/pages/EstacionRefam.jsx`**: al agregar un participante, se le
asigna automáticamente la lección #1 del catálogo. Cada participante
muestra su lección actual y un botón "Marcar completada" (solo
`canEdit`) que registra el progreso y avanza a la siguiente lección del
catálogo -- o marca el currículo como terminado si no hay siguiente.

**`src/pages/RutaFormacion.jsx`** (modo ESFOB): "Iniciar proceso" ya no
pide "lecciones totales" a mano -- se toma del tamaño del catálogo. Cada
proceso activo muestra su lección actual y el mismo botón "Marcar
lección completada", que también actualiza el contador
`lecciones_completadas` ya existente (usado por "candidatos a
trasladar").

## Verificación

`npm run build` limpio en cada paso. Verificado de punta a punta con
Playwright + confirmación directa en base de datos:

- Responsable obligatorio: el `<select>` queda inválido (HTML5) sin
  seleccionar responsable; la función de librería lo rechaza igual si
  se intentara sin pasar por el formulario.
- Línea de tiempo + exportar: amigo movido Uno Más → BIS, la ficha
  muestra ambas estaciones con "en curso" en la activa, y el botón
  "Exportar" genera el PDF descargable.
- Catálogo + progreso REFAM: se creó un catálogo de 2 lecciones, un
  participante avanzó de la #1 a la #2 y luego a "currículo completado",
  con `refam_progreso_leccion` registrando las 2 lecciones y
  `leccion_actual_id` en null al terminar.
- Catálogo + progreso ESFOB: mismo resultado -- "Iniciar proceso" ya no
  pide lecciones a mano, el proceso avanzó lección por lección hasta
  completar el currículo, actualizando `lecciones_completadas` (2/2) y
  disparando el badge "Listo para trasladar".
- Desglose distrital: función SQL confirmada por RPC directo; la
  pantalla en sí no se pudo ver con la cuenta de prueba (rol pastor
  local, sección exclusiva de distrital).

Todos los datos de prueba (amigos, grupo, catálogo de prueba, procesos)
se eliminaron al terminar.

## Hallazgo aparte, ya resuelto en la misma sesión

De paso se confirmó y corrigió el hallazgo de `historial_amigos`
(404 en Supabase, tabla nunca creada) -- ver
`docs/rediseno-ruta-evangelistica-2026-09-04.md` para el detalle; el
usuario ya ejecutó `supabase/evangelismo.sql` y se verificó que el
historial de etapas funciona correctamente desde ahora.
