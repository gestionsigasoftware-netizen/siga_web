# Traslado real de feligreses y finalización de asignación pastoral (2026-09-02)

## Contexto

El usuario notó dos huecos reales al pensar en el día a día de una
congregación: qué pasa cuando un feligrés se muda de ciudad (traslado
entre congregaciones), y qué pasa cuando un pastor deja su congregación
sin ir a otra específica (retiro/renuncia) — ¿quién queda a cargo de la
información en SIGAP?

## 1. Traslado de feligreses (carta de traslado)

**Confirmado en el código antes de proponer nada**: lo único que existía
(`movimientos_membresia`, tipo "Baja por traslado"/"Alta por
recibimiento") es solo una anotación estadística para el conteo nacional
de altas/bajas — nunca movía a la persona ni la vinculaba a la
congregación destino. Si el pastor receptor quería registrarla, debía
crearla como persona nueva, perdiendo todo el historial (bautismo,
sellado, familia, cargos, la línea de tiempo espiritual).

**Diseño implementado** (como una carta de traslado real, confirmado con
el usuario):

- **`supabase/traslados_feligresia.sql`** (nuevo): tabla
  `traslados_feligresia` (persona, congregación origen/destino, estado
  pendiente/recibido/cancelado), con un índice único que impide más de
  un traslado pendiente por persona a la vez.
- `solicitar_traslado_persona(persona_id, congregacion_destino_id,
  observaciones)`: el pastor de origen la inicia — la persona queda
  `estado_membresia = 'trasladado'` (deja de contar como activa en el
  censo de origen) y se registra el movimiento estadístico
  correspondiente.
- `recibir_traslado_persona(traslado_id)`: el pastor de destino la
  recibe con un clic — el **mismo registro** (`personas.id` no cambia)
  pasa a pertenecer a la nueva congregación y vuelve a `'activo'`. Todo
  su historial viaja con ella automáticamente porque nunca se creó un
  registro nuevo.
- `cancelar_traslado_persona(traslado_id)`: el pastor de origen puede
  cancelar un traslado que aún no fue recibido.
- `buscar_congregaciones(busqueda)`: búsqueda nacional de congregaciones
  activas por nombre/ciudad, para elegir el destino sin necesidad de
  conocer de antemano en qué distrito queda.
- **Frontend** (`FeligresiaAdmin.jsx`): nueva pestaña "Traslados"
  (recibidos pendientes con botón Recibir, enviados pendientes con botón
  Cancelar) y una sección "Trasladar a otra congregación" dentro del
  panel de Movimientos de la ficha de cada persona.

## 2. Finalizar asignación pastoral (sin destino conocido)

**Confirmado en el código**: `trasladar_pastor()` ya sincroniza
correctamente el acceso cuando un pastor se mueve a OTRA congregación
específica — la de origen queda vacante y lista para
`registrar_pastor_con_acceso()`. El hueco real era cuando el pastor
simplemente se retira sin ir a un lugar que SIGAP gestione: no había
forma de vaciar su congregación ni de revocar su acceso sin intervenir
la base de datos manualmente.

- **`supabase/finalizar_asignacion_pastoral.sql`** (nuevo):
  `finalizar_asignacion_pastoral(pastor_id, fecha, observaciones)` — cierra
  la asignación pastoral activa, deja la congregación vacante
  (`pastor_id`/`pastor_nombre` en null) y revoca el acceso local del
  pastor saliente (`fecha_fin` en su `roles_sistema`), lista para que el
  distrital registre al pastor entrante con `registrar_pastor_con_acceso()`.
- **Frontend** (`PastoralDistrital.jsx`): nuevo formulario "Finalizar
  asignación pastoral" junto a "Trasladar pastor".

## Acción requerida del usuario

Ejecutar en el SQL Editor de Supabase:
1. `supabase/traslados_feligresia.sql`
2. `supabase/finalizar_asignacion_pastoral.sql`
