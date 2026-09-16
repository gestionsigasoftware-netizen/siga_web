# Matrimonio, defunción y certificado de defunción — 2026-09-16

## Contexto

El usuario notó tres huecos en el censo de Feligresía: no había forma
de registrar con quién está casada una persona (solo la etiqueta
`estado_civil='casado'`, sin vínculo real), no había fecha de
fallecimiento ni un flujo dedicado para "qué pasa después", y no
existía un certificado de defunción como sí existe el de bautismo.

Antes de construir se confirmaron 3 decisiones con el usuario (todas
"recomendado" aceptadas):
1. Al marcar fallecido, el cónyuge pasa automáticamente a "Viudo/a".
2. Al marcar fallecido, sus cargos y comités vigentes se cierran solos.
3. La persona fallecida sigue apareciendo en el censo (como ya pasa
   con apartados/trasladados), solo distinguida por la insignia.

## Construido

### Esquema (`supabase/modulos/matrimonio_y_defuncion.sql`, confirmado ejecutado)
- `personas.conyuge_id` (FK a `personas`, `on delete set null`),
  `fecha_matrimonio`.
- `personas.fecha_fallecimiento`, `notas_fallecimiento`.
- Nuevo tipo `baja_fallecimiento` en el catálogo de
  `movimientos_membresia` (no existía -- un fallecimiento no quedaba
  en el historial de movimientos, a diferencia de traslados/
  disciplina/exclusión).

**`conyuge_id` es simétrico por diseño, mantenido por la aplicación
(dos `update` explícitos), no por un trigger de base de datos** -- un
trigger bidireccional con updates anidados sobre la misma tabla es una
fuente clásica de bugs de recursión en Postgres, y el único punto de
escritura real es esta pantalla, así que resolverlo en JS es más
simple y más fácil de depurar.

### `src/pages/FeligresiaAdmin.jsx`
- `vincularConyuge(person)` / `desvincularConyuge(person)`: diálogo
  reutilizando el sistema de `AdminDialog` ya existente (mismo patrón
  que "Editar responsabilidad", con campo `select` poblado desde
  `analyticsPeople`). Solo ofrece como candidatos personas activas que
  **todavía no tienen cónyuge**, para no pisar por accidente el
  matrimonio de alguien más. Al vincular, actualiza `estado_civil` a
  "Casado/a" en ambas fichas.
- `marcarFallecido(person)`: único camino para llegar a
  `estado_membresia='fallecido'` -- deliberadamente **no** se puede
  elegir desde el `<select>` genérico de estado (queda excluido de las
  opciones, y el select se bloquea una vez ya es fallecido), porque
  exige fecha obligatoria y dispara varios efectos que no tendría
  sentido dejar a medias: inserta en `movimientos_membresia`
  (`baja_fallecimiento`), actualiza al cónyuge a "Viudo/a" si hay uno
  vinculado, y cierra (`fecha_fin`) los cargos (`historial_cargos`) y
  membresías de comité (`membresias_comite`) vigentes -- mismo patrón
  exacto que ya usa "Retirar integrante" para comités.
- `descargarCertificadoDefuncionPersona(person)`: botón visible solo
  cuando `estado_membresia === 'fallecido'`.
- `SpiritualTimeline`: ahora incluye "Contrajo matrimonio" y
  "Falleció" como hitos, con sus iconos (`Heart`, `Flower2`).
- Las 3 consultas que traen la ficha de una persona (`peopleQuery`,
  `analyticsPeople`, `openPersonFromFollowup`) se ampliaron con los
  campos nuevos.

### `src/lib/certificadoDefuncion.js` (nuevo)
Mismo patrón que `certificadoBautismo.js` (HTML/CSS real + html2canvas
→ imagen en jsPDF, no las primitivas de texto de jsPDF -- ver ese
archivo para el porqué). Comparte familia visual con el certificado de
bautismo (mismo marco, tipografías, logo).

## Bug real encontrado y corregido durante la prueba (no relacionado a esta pieza, pero grave)

Al verificar visualmente que la fecha de fallecimiento guardada
coincidiera con la mostrada, se encontró un bug de zona horaria en
**`formatFecha()`** (`src/lib/dateFormat.js`), usado en 12 archivos de
toda la app: un valor de solo fecha ("2026-09-10", sin hora, como
devuelve cualquier columna `date` de Postgres) lo interpreta JavaScript
como medianoche UTC. En cualquier zona horaria detrás de UTC --
Colombia es siempre UTC-5, sin horario de verano -- esa medianoche UTC
cae en hora local del día **anterior**, así que la fecha se mostraba
sistemáticamente un día atrás. Se reprodujo exacto: se guardó
"2026-09-10", la pantalla mostraba "09/09/2026".

Corregido agregando `T00:00:00` (sin `Z`) a los valores que no traen
ya una hora -- el mismo arreglo que ya usaba
`certificadoBautismo.js` (`formatearFechaLarga`) para este mismo
problema, ahora aplicado en la función compartida. Los timestamps
completos (con hora, ej. `creado_en`) no se tocan.

**Alcance de este bug**: afecta a cualquier fecha de tipo `date` (no
timestamp) mostrada con `formatFecha()` en cualquiera de los 12
archivos que la usan -- fecha de ingreso, de nacimiento, de bautismo,
de sellado, etc., donde sea que se muestren con esta función. No se
auditaron uno por uno todos los usos existentes en esta sesión (fuera
de alcance de esta pieza), pero el arreglo es en la función
compartida, así que corrige el problema en todos los usos actuales y
futuros a la vez.

## Verificación

- `npm run build` sin errores en cada paso.
- Playwright + consultas directas con la cuenta real: creadas 2
  personas de prueba, vinculadas como cónyuges (confirmado simétrico
  en ambas fichas, estado civil "Casado/a" en ambas), registrado el
  fallecimiento de una (fecha correcta tras el arreglo de zona
  horaria, `movimientos_membresia` con `baja_fallecimiento` insertado,
  cónyuge actualizado a "Viudo/a" automáticamente), certificado de
  defunción descargado correctamente (PDF real, nombre de archivo
  correcto). Los 2 registros de prueba se eliminaron de la base real
  al terminar -- confirmado cero residuo, incluido el movimiento de
  membresía (se borró solo por `on delete cascade` al borrar la
  persona).
- Cero errores de consola en todas las pruebas.
