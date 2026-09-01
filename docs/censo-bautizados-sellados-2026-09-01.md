# Censo de bautizados y sellados con el Espíritu Santo (2026-09-01)

## Qué se construyó

A pedido explícito del usuario: bautizado en agua y sellado/lleno con el
Espíritu Santo son **hitos independientes** (no secuenciales — se puede
recibir el Espíritu Santo antes o después del bautismo, o nunca), y deben
medirse en **cada módulo con ficha individual** de la IPUC, tanto
intramural (Feligresía, comités, Escuela Dominical, Damas Dorcas) como
extramural (Amigos en ruta evangelística, Misión Juvenil, Obra
Carcelaria) — el objetivo es que ningún censo de la IPUC (niños, mujeres,
jóvenes, amigos en ruta, feligreses o privados de libertad) quede sin
esta medición, alineado a como la coordinación nacional/distrital/local
de estadísticas de la IPUC necesita ver los datos.

Estado antes de este cambio (verificado leyendo código, no asumido):
Feligresía (`personas`) y Obra Carcelaria (`obra_carcelaria_internos`) ya
tenían `bautizado`/`fecha_bautismo`/`sellado`/`fecha_sellado` como campos
independientes. Escuela Dominical y Damas Dorcas no tenían nada. Misión
Juvenil y Amigos solo tenían un valor dentro de un campo `estado`/
`estado_espiritual` tipo embudo, sin fecha propia — no eran hitos
independientes de verdad.

**REFAM se mencionó en la conversación pero el usuario aclaró
explícitamente que lo mencionó como categoría de "fruto" espiritual, no
como una tabla a construir — no se tocó REFAM.**

## Cambios

### Base de datos (`supabase/censo_bautizados_sellados.sql`, nuevo)

- `bautizado, fecha_bautismo, sellado, fecha_sellado` agregados a
  `escuela_dominical_ninos`, `damas_dorcas_beneficiarias`,
  `mision_estudiantes` y `amigos`.
- `cargos_comite.requiere_sellado` (boolean, configurable por el pastor en
  su propio catálogo — no hardcodeado por nombre de cargo, porque cada
  congregación nombra sus cargos distinto).
- **Bloqueo real de comités** (trigger `validar_requisitos_comite()` en
  `membresias_comite`, antes de insertar o cambiar `persona_id`/
  `cargo_id`): ninguna persona no bautizada puede pertenecer a un comité;
  si el cargo tiene `requiere_sellado = true`, además exige estar sellada.
  Es un bloqueo de base de datos, no solo de formulario — verificado
  insertando directo por la API sin pasar por la UI, y el trigger lo
  rechazó igual.
- `incorporar_amigo_bautizado()` actualizada: antes asumía "bautizado
  hoy mismo" al pasar un amigo a Feligresía; ahora copia la fecha real de
  bautismo y el estado de sellado que el amigo ya tenía registrado como
  amigo, para no perder esa información.

### Frontend

- **`EscuelaDominical.jsx`, `DamasDorcas.jsx`, `MisionJuvenil.jsx`**:
  botones "Marcar bautizado"/"Marcar sellado" por fila en el censo (mismo
  patrón `marcarHito()` que ya se usó en Obra Carcelaria), 2 tarjetas KPI
  nuevas (Bautizados, Sellados) con el mensaje explícito de que son hitos
  independientes.
  - En Misión Juvenil, la métrica "Bautizados" ya existía pero estaba
    **rota en la práctica**: dependía de un campo `estado` que nunca tenía
    ninguna acción en la UI para cambiarlo, así que siempre mostraba 0.
    Se corrigió para usar el nuevo campo `bautizado` (con su botón real),
    y se agregó "Sellados" al lado.
- **`Amigos.jsx`**: nuevo botón "Marcar sellado con el Espíritu Santo" en
  la ficha del amigo, independiente de `markBaptized()`. Nuevo insight en
  "Lectura de la ruta": "N amigo(s) en ruta ya fue/fueron sellado(s) con
  el Espíritu Santo aunque aún no se ha/han bautizado" — el KPI que pidió
  el usuario explícitamente. `markBaptized()` ahora también guarda
  `bautizado`/`fecha_bautismo` (antes solo tocaba el campo de embudo
  `estado_espiritual`, sin fecha real).
- **`Configuracion.jsx`**: el catálogo "Cargos de comité" gana un checkbox
  "Requiere estar sellado con el Espíritu Santo" al crear un cargo, y lo
  muestra con una etiqueta "+ sellado" en la lista.
- **`FeligresiaAdmin.jsx`**: `assignCommittee()` valida en el cliente
  antes de enviar (mensaje claro para cada caso), además del bloqueo de
  base de datos.

### Bug encontrado y corregido de paso (no relacionado con este trabajo)

Al probar el registro de un amigo nuevo en `Amigos.jsx`, el formulario
"Registrar amigo" **siempre fallaba** con `invalid input syntax for type
date: ""` — `createFriend()`/`saveFriend()` enviaban `fecha_nacimiento:
""` directo a una columna `date`, y ese campo ni siquiera tiene un input
visible en el formulario de creación (solo aparece en la ficha de
edición). Corregido convirtiendo `""` a `null` en ambos payloads, mismo
patrón ya usado en el resto del archivo para `etapa_id`/`zona_id`.

## Verificación

`npm run build` sin errores. Verificado en vivo con Playwright (rol local
de la cuenta de prueba):

- Escuela Dominical, Damas Dorcas y Misión Juvenil: se registró una ficha
  de prueba en cada una, se marcó bautizado y sellado por separado, y las
  tarjetas KPI se actualizaron correctamente.
- Amigos: se registró un amigo, se marcó sellado (sin bautizar), y el
  insight "N amigo(s) en ruta ya fue sellado... aunque aún no se ha
  bautizado" apareció correctamente.
- Comités: se creó un cargo con "Requiere sellado", se registró una
  persona sin bautizar y se intentó asignarla a un comité → bloqueado con
  "Esta persona debe estar bautizada...". Se marcó bautizada (sin sellar)
  y se reintentó con el cargo que exige sellado → bloqueado con "Este
  cargo requiere que la persona esté sellada con el Espíritu Santo.".
- **Bloqueo a nivel de base de datos confirmado por separado**: se insertó
  directo por la API (sin pasar por el formulario de React) una membresía
  de comité para una persona no bautizada, y el trigger la rechazó con el
  mismo mensaje — confirma que la regla no depende solo de la UI.
- Todos los datos de prueba fueron eliminados al finalizar (0 residuos
  confirmados por consulta directa).

## Pendiente / fuera de alcance de esta tarea

- El usuario autorizó investigar en internet la metodología estadística
  real de la coordinación nacional de la IPUC, para alinear mejor las
  métricas del software a futuro. Es una tarea de investigación separada,
  no se hizo aquí para no diluir el alcance concreto ya acordado — queda
  ofrecida como siguiente paso.
- REFAM como módulo con ficha individual — explícitamente fuera de
  alcance, el usuario lo mencionó solo como categoría de "fruto".
