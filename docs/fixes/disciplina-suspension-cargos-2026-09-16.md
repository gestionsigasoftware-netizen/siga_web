# Disciplina/suspensión de cargos (item 11 de los 13 pedidos) — 2026-09-16

## Contexto

Segunda pieza de los 13 pedidos por WhatsApp, con una consigna explícita
del usuario: que las piezas que faltan no queden como pantallas sueltas,
sino que alimenten la misma analítica de decisión pastoral que ya se
viene construyendo (salud, comités). Antes de construir se preguntó y
confirmó: (1) empezar por disciplina/suspensión antes que familias
mixtas/consentimiento, y (2) que una disciplina activa **bloquee
automáticamente** la asignación a un cargo o comité nuevo -- no solo
quede como aviso informativo.

## Construido

`supabase/modulos/disciplina_pastoral.sql` (confirmado ejecutado):
`disciplinas_pastorales` (persona, motivo, fecha_inicio,
fecha_fin_prevista, fecha_restauracion, notas_restauracion; `nivel`
queda en el esquema para distrital/nacional cuando haya cuenta real de
esos roles para probarlo -- por ahora solo se expone local) y
`disciplinas_seguimiento` (notas fechadas, como se pidió). Un índice
único impide que una persona tenga dos disciplinas activas (sin
restaurar) a la vez.

### Frontend

`src/pages/FeligresiaAdmin.jsx`: nueva sección plegable "Disciplina/
suspensión de cargos" en la ficha de persona (se abre sola si hay una
activa), con botones para registrar, agregar seguimiento y registrar
restauración -- mismo patrón `AdminDialog` ya usado en el resto del
módulo. Se extendió `AdminDialog` para aceptar campos `textarea` (antes
solo soportaba texto de una línea).

**El bloqueo real** vive en `assignCommittee()`: si la persona elegida
tiene una disciplina sin `fecha_restauracion`, la asignación se rechaza
con un mensaje que dice desde cuándo y por qué motivo, antes de tocar
la base de datos.

**Analítica (la consigna del usuario)**: en vez de crear una pantalla
aparte, se extendió el panel "Análisis de comités" que ya existe (tab
Evolución) -- porque la disciplina afecta directamente la elegibilidad
para cargos que esa analítica ya mide. Nueva métrica "Con disciplina
activa" y un insight cuando hay alguna.

## Bug real encontrado durante la verificación (no relacionado con disciplina)

Al probar la asignación exitosa después de una restauración, apareció
un error de consola: `Cannot read properties of null (reading 'reset')`.
Causa: `assignCommittee`, `savePastoralFollowup` y `saveCargo` usaban
`event.currentTarget` **después de un `await`** -- React pone
`currentTarget` en `null` en cuanto termina la fase síncrona del
evento, así que acceder a él tras esperar una respuesta de Supabase
revienta. El resultado real: la asignación SÍ se guardaba en la base,
pero el aviso de éxito nunca aparecía y la lista no se refrescaba
(dejando al usuario creyendo que falló). Corregido capturando
`event.currentTarget` en una variable ANTES del `await`, en las 3
funciones -- mismo patrón que ya usaba correctamente `saveMovimiento`
en el mismo archivo.

## Verificación

- `npm run build` sin errores en cada paso.
- Consulta directa contra la base real: disciplina activa creada;
  segunda disciplina activa para la misma persona RECHAZADA por el
  índice único (código 23505); seguimiento agregado y leído anidado
  correctamente; restauración registrada; nueva disciplina activa
  permitida después de la restauración. Registros de prueba eliminados
  (cascada), cero residuo.
- Playwright de punta a punta con la cuenta real, dos corridas
  consecutivas sin fallos: se creó una persona bautizada, se le
  registró una disciplina, la métrica y el insight de "Análisis de
  comités" aparecieron correctamente, el intento de asignarla a un
  comité fue bloqueado con el mensaje exacto esperado, se registró la
  restauración, y la asignación posterior sí se completó (con aviso de
  éxito, ya sin el bug de `event.currentTarget`). Cero errores de
  consola. Persona y membresía de prueba eliminadas, cero residuo.
