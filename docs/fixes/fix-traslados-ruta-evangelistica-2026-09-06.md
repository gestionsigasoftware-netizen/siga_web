# Fix: traslados entre estaciones de la Ruta Evangelística — 2026-09-06

## El reporte del usuario

Probando la Ruta Evangelística en su congregación real (Puerto Tejada
Cauca Central, amigo de prueba "Manuel Antonio García Rodríguez"), el
usuario reportó con mucho detalle que:

- Al trasladar a alguien hacia ESFOB, esa persona no aparecía en la
  lista de ESFOB (solo el botón "Iniciar proceso", como si no hubiera
  nadie).
- ESFOB no tenía ningún botón para marcar a alguien como bautizado tras
  completar sus lecciones, pese a que el insight de la pantalla ya
  sugería revisar candidatos al bautismo.
- El único destino que ofrecía el selector "Trasladar a..." desde ESFOB
  para alguien listo era "Discipulado" -- pero al hacerlo, la persona
  desaparecía de ESFOB y tampoco aparecía en Discipulado.
- El formulario "Iniciar proceso" de Discipulado nunca iba a mostrar a
  esa persona, porque su selector de personas es el censo de Feligresía
  (correctamente filtrado a `bautizado = true`) y un amigo trasladado
  así nunca pasó por el bautismo real.

Preguntó explícitamente si esto era un error suyo o un fallo real del
flujo.

## Diagnóstico (confirmado contra la base de datos real, no solo leyendo código)

Se confirmó consultando directamente los datos del amigo de prueba:
`ruta_procesos` mostraba correctamente su avance Uno Más → BIS → ESFOB
→ Discipulado, pero `esfob_procesos` tenía una fila `en_formacion` sin
cerrar nunca, y `discipulado_procesos` estaba completamente vacía. Era
un fallo real del flujo, no una confusión del usuario.

**Causa raíz**: `ruta_procesos` es la tabla genérica de la ruta, pero
tres estaciones (`refam_participantes`, `esfob_procesos`,
`discipulado_procesos`) tienen además su **propia tabla de detalle**
(lecciones, mentor, etc.), y sus pantallas (`EstacionRefam.jsx`,
`RutaFormacion.jsx` para esfob/discipulado) leen **de esas tablas de
detalle, no de `ruta_procesos`**. La función `trasladar()` de las 4
pantallas de estación solo movía `ruta_procesos` (vía
`iniciarOMoverEstacion`) y nunca tocaba las tablas de detalle -- por
eso la persona se volvía invisible en el destino y quedaba "fantasma"
(activa) en el origen.

Además, el selector "Trasladar a..." permitía elegir "Discipulado"
desde una estación de amigos, algo imposible por esquema
(`discipulado_procesos.persona_id` es `not null`, no acepta amigos) y
conceptualmente incorrecto: solo el bautismo pasa a alguien de amigo a
feligrés, nunca un simple avance de estación.

## Arreglo (parte 1: traslados)

Un solo mecanismo centralizado en `src/lib/rutaEvangelistica.js`
(`trasladarEstacion`, más el mapa `DETALLE_ESTACION`), usado ahora por
las 4 pantallas de estación (`EstacionBis.jsx`, `EstacionUnoMas.jsx`,
`EstacionRefam.jsx`, `RutaFormacion.jsx`):

1. Valida que el destino acepte el tipo de persona que se está
   trasladando -- bloquea amigo→Discipulado y persona→ESFOB antes de
   tocar la base de datos, con un mensaje explicando por qué.
2. Mueve `ruta_procesos` (igual que antes, sin cambios).
3. Si la estación de **origen** tiene tabla de detalle, cierra esa fila
   (`esfob_procesos`/`discipulado_procesos` → `retirado`;
   `refam_participantes` → `completado`, igual que ya hacía
   `EstacionRefam.jsx` antes del fix).
4. Si la estación de **destino** tiene tabla de detalle y puede
   crearse con la información disponible, la crea con
   `fecha_inicio = hoyBogota()` (para que el contador de días sea
   exacto, no el `current_date` del servidor) -- ESFOB: engancha
   además la primera lección del catálogo si existe; Discipulado: fija
   el mentor. **REFAM es la excepción**: su tabla exige un `grupo_id`
   (célula/hogar) que este mecanismo genérico no puede adivinar, así
   que solo mueve `ruta_procesos` y devuelve un aviso (`avisoRefam`)
   para que la pantalla le diga al usuario que complete el alta desde
   REFAM, agregándola a un grupo específico.

También se agregó el botón **"Marcar bautizado"** en ESFOB (visible
solo cuando la persona ya completó todas sus lecciones): actualiza
`amigos` (`estado_espiritual: 'bautizado', bautizado: true,
fecha_bautismo`, mismo patrón que ya usa `Amigos.jsx`) y cierra su
`esfob_procesos` con `estado: 'aprobado'` (el estado de éxito del
esquema, distinto del `retirado` genérico). No incorpora
automáticamente a Feligresía ni inicia Discipulado -- eso sigue siendo
un paso manual en `Amigos.jsx`, que ya tiene el formulario completo
(fecha de nacimiento, etc.) para hacerlo bien.

Y se corrigieron los selectores "Trasladar a..." de las 4 pantallas
para excluir el destino que no corresponde al tipo de persona (amigo
no ve "Discipulado", persona no ve "ESFOB").

## Arreglo (parte 2: "nuevo bautizado" en el censo)

Tras el primer fix, el usuario planteó un requisito adicional: quien
acaba de bautizarse no debería tratarse igual que un feligrés
establecido para efectos de asignarle un cargo o comité -- debe
notarse que está "en formación" en Discipulado, con un contador de
días, hasta cumplir un mínimo antes de considerarse disponible para
servicio.

Aclaración importante confirmada con el usuario: "Marcar bautizado" en
ESFOB **no** incorpora automáticamente a Feligresía (eso ya era y sigue
siendo un paso deliberado y manual en `Amigos.jsx`, por diseño -- ver
`project_siga_arquitectura_negocio`). Lo que sí ya funciona de punta a
punta después de la parte 1 de este fix es la cadena completa: marcar
bautizado en ESFOB → incorporar a Feligresía en Amigos.jsx → iniciar
Discipulado (su selector ya exigía `bautizado = true`, sin cambios).

Se preguntó al usuario el alcance antes de construir, y se decidió:
solo una marca informativa en el censo (no advertencias dentro de cada
módulo de comité, que hubiera significado tocar muchos archivos
independientes: Damas Dorcas, Conquistadores, Música, etc.), con un
umbral fijo de 30 días (igual convención que el resto de umbrales de la
ruta, ej. `UMBRAL_DIAS_ESTACION`).

Construido:

- **`UMBRAL_DIAS_NUEVO_BAUTIZADO = 30`** (nuevo, en
  `rutaEvangelistica.js`, junto a `UMBRAL_DIAS_ESTACION`).
- **`FeligresiaAdmin.jsx`**: se agregó la consulta a
  `discipulado_procesos` (activos) al `Promise.all` de `load()`
  (al final, sin alterar el destructure posicional existente). Con eso
  se calcula, por persona, los días transcurridos desde
  `discipulado_procesos.fecha_inicio` (vía `diasDesde()`, ya usado en
  toda la Ruta Evangelística).
- Mientras esos días sean menores al umbral, se muestra una marca
  "Nuevo bautizado · Nd en Discipulado" en tres lugares del censo: la
  lista de personas, la ficha de edición (con el mensaje completo
  explicando que conviene esperar antes de asignarle un cargo), y el
  panel de "Cargos" de esa misma ficha (el punto más directo donde se
  registraría una responsabilidad).
- Se corrigió de paso `trasladarEstacion()` (parte 1) para que fije
  `fecha_inicio: hoyBogota()` al crear la fila de detalle del destino
  -- antes quedaba en blanco y caza el `current_date` del servidor, lo
  que podía desfasar el contador de días en un día cerca de la
  medianoche en Bogotá.

## Verificación

Contra la base de datos real (cuenta de prueba, congregación Puerto
Tejada Cauca Central), reproduciendo `trasladarEstacion()` con datos
frescos (sin tocar el registro real de Manuel Antonio, que es la
prueba manual en curso del propio usuario):

- BIS → ESFOB: ahora sí crea `esfob_procesos` (antes no existía).
- ESFOB → REFAM: cierra `esfob_procesos` como `retirado` (antes
  quedaba activo para siempre) y confirma que avisa sobre REFAM en vez
  de crear una fila inválida.
- REFAM (persona) → Discipulado: cierra `refam_participantes` como
  `completado` y crea `discipulado_procesos` (antes quedaba vacía).
- Se confirmó además que la base de datos rechaza por esquema un
  `discipulado_procesos` sin `persona_id`, validando por qué el
  bloqueo amigo→Discipulado es correcto y no solo una preferencia de
  UI.
- Para la marca de "nuevo bautizado": se creó una persona + proceso de
  Discipulado activo de prueba y se confirmó que la consulta nueva de
  `FeligresiaAdmin.jsx` la encuentra y calcula el contador de días
  correctamente.

Todos los datos de prueba se crearon y limpiaron en la misma corrida
(sin quedar residuos, verificado con una consulta posterior). `npm run
build` sin errores en ambas rondas.

## Nota para el usuario

El amigo de prueba "Manuel Antonio García Rodríguez" (el de tu prueba
manual) se dejó tal cual está -- no se tocó su `esfob_procesos` ni
`discipulado_procesos`. Si quieres, puedes repetir su traslado desde
ESFOB ahora para ver el flujo corregido en vivo, o decirme y lo dejo
en un estado limpio para que retomes la prueba desde cero.
