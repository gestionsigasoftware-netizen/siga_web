# Ruta Evangelística y Misión Juvenil: version avanzada

Fecha: 31 de agosto de 2026

## Objetivo

El usuario pidio llevar a nivel "avanzado" lo que hasta ahora funcionaba en
forma basica: las 4 tablas relacionales de la Ruta Evangelistica sin UI
(Metodos, Uno Mas, BIS, REFAM) y las 3 de Mision Juvenil (lecciones,
asistencia individual, lideres). Todas las tablas ya existian, aplicadas en
la base de datos real; este trabajo es exclusivamente de frontend, sin
migraciones nuevas.

## Metodos — Diagnostico territorial

`src/pages/Evangelismo.jsx`, nueva seccion "Diagnostico de caracterizacion
territorial". Vincula zona + responsable, crea (o reutiliza si ya existe) un
`ruta_procesos` con `estacion=metodos` y `persona_id` del responsable, luego
guarda el diagnostico en `ruta_diagnosticos`: periodo, poblacion estimada,
necesidades y recursos (listas), estrategia, comite responsable, resultado.

## Uno Mas y BIS — dentro de la ficha del Amigo

`src/pages/Amigos.jsx`, seccion "Ruta Evangelistica" ya existente en la ficha
de cada amigo. Se agrego, condicionado a la estacion activa del amigo:

- Si `uno_mas`: formulario de compromiso (`uno_mas_compromisos`) — miembro
  comprometido, fechas de contacto, estado, resultado, notas. Un compromiso
  por proceso activo (se actualiza el mismo registro, no se duplica).
- Si `bis`: registro repetible de atenciones (`bis_atenciones`) — fecha de
  visita, primera visita, recibimiento, necesidad inmediata, contacto
  posterior, integrado, derivado a, con historial de todas las atenciones.

No se creo un flujo paralelo para mover a alguien de estacion: se sigue
usando el mecanismo ya existente (`moveRouteProcess`) para no duplicar la
forma en que una persona avanza entre estaciones; lo nuevo es exclusivamente
el detalle que se captura una vez la persona ya esta en esa estacion.

### Bug critico encontrado y corregido de paso

`moveRouteProcess` (el traslado de estacion) llamaba a `setNotice(...)` sin
que existiera ese estado en el archivo — un `ReferenceError` real. Como esa
linea se ejecuta antes de `setSaving(false)`, cada traslado de estacion
exitoso dejaba **toda la pantalla de Amigos en ruta trabada en "Guardando..."**
hasta recargar la pagina. Se agrego el estado `notice` faltante y su
renderizado.

## REFAM — grupos, participantes y reuniones

`src/pages/Evangelismo.jsx`, nueva seccion "Grupos, participantes y
reuniones". No usa `ruta_procesos` (esas tablas no tienen esa relacion en el
esquema): CRUD independiente de `refam_grupos` (nombre, zona, anfitrion,
lider, direccion, dia de reunion), con un grupo seleccionable que muestra sus
`refam_participantes` (amigo o persona) y permite registrar `refam_reuniones`
(fecha, numero de leccion, tema, asistentes, visitantes, resultado).

## Misión Juvenil — lecciones, asistencia individual y líderes

`src/pages/MisionJuvenil.jsx`:

- Cada grupo de la lista "Grupos y lecciones" ahora es seleccionable; al
  elegirlo se puede registrar una nueva `mision_leccion` (numero automatico,
  tema, fecha, notas) con una lista de chequeo de asistencia individual por
  estudiante de la misma institucion (`mision_asistencia_estudiante`). Al
  guardar, tambien actualiza `mision_grupos.leccion_actual` si la nueva
  leccion supera el conteo previo, para que el indicador agregado no quede
  desincronizado del detalle.
- Nueva seccion "Lideres de Mision Juvenil": alta y baja (activo/inactivo)
  contra `mision_lideres`, con mensaje claro si la persona ya esta
  registrada como lider (restriccion unica de la tabla).

## Validacion ejecutada

- `npm run build`: correcto despues de cada pieza.
- Verificacion visual con Playwright: capturas de las 4 secciones nuevas
  renderizando sin errores de consola.
- **Verificacion de extremo a extremo contra la base de datos real** (no solo
  lectura de codigo): se crearon y leyeron registros reales de prueba para
  `ruta_diagnosticos`, `refam_grupos`, `uno_mas_compromisos`,
  `bis_atenciones`, `mision_lecciones`, `mision_asistencia_estudiante` y
  `mision_lideres`, confirmando que las politicas RLS ya existentes permiten
  exactamente las operaciones que el nuevo codigo ejecuta. Todos los datos de
  prueba se eliminaron al terminar cada verificacion.

## Archivos modificados

- `src/pages/Evangelismo.jsx`
- `src/pages/Amigos.jsx`
- `src/pages/MisionJuvenil.jsx`
- `docs/ruta-evangelistica-avanzada-2026-08-31.md`

## Pendiente

- Ninguna migracion nueva pendiente — todo el esquema ya estaba aplicado.
- Falta probar estas pantallas con perfiles distintos a pastor (estadisticas,
  consulta) para confirmar que `canEdit` oculta correctamente los formularios
  segun el permiso `ruta_evangelistica.editar` / `.registrar` y
  `mision_juvenil.editar`.
- El calculo de `mision_grupos.leccion_actual` ahora se actualiza solo al
  registrar lecciones desde esta pantalla; si alguien lo edita manualmente
  desde el formulario de creacion del grupo, ambos caminos coexisten sin
  conflicto pero conviene decidir cual es la fuente de verdad a futuro.
