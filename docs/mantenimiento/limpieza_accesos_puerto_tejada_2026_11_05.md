# Limpieza de accesos de prueba en Puerto Tejada Cauca Central — 2026-11-05

## Contexto

Al revisar el error "no se puede eliminar, tiene historial" sobre una
persona de prueba, el usuario pidió averiguar qué cuenta tenía el
pastor real de la única congregación real con pastor activo (Puerto
Tejada Cauca Central) y si era la misma del rol super_admin.

## Hallazgo

La congregación tenía **6 roles `local` activos simultáneamente**,
cuando solo deberían quedar 2: super_admin (siempre tiene acceso a
todo) y el pastor real, Damil Lerma. Los otros 4 eran residuos de
pruebas que nunca se revocaron -- y 3 de ellos, además, contaban como
feligreses "activos" reales en las estadísticas de esta congregación
real (`estado_membresia='activo'`, con `bautizado`/`fecha_ingreso`
realistas).

Antes de borrar nada, se confirmó con diagnósticos de solo lectura
que ninguna de las 4 cuentas a eliminar tenía ningún rol en otro
lado -- borrar su perfil no dejaba a nadie sin acceso a SIGAP.

## Qué se hizo

- **Borradas por completo** (rol + seguimientos pastorales + ficha de
  censo): "Usuario de Pruebas", "Carlos Mina" (cuenta personal del
  usuario, decisión explícita suya) y "Natalia Guacha Noriega".
- **Conservada, solo limpiada**: "Jhan Carlos Sanchez Banguero"
  (antes llamada literalmente "super admin" en el censo -- se
  renombró para que no se vea como una cuenta de sistema; es
  puramente cosmético, no toca su rol de super_admin ni su acceso).
- **Jhan Sanchez** (la cuenta de pruebas `pueba691@gmail.com` que se
  venía usando para verificar cambios con Playwright en esta sesión)
  se dejó primero sin sus datos (seguimientos borrados) y
  posteriormente, a pedido del usuario, se borró también por
  completo -- de ahora en adelante las verificaciones con Playwright
  usan la congregación demo pública (`/demo`), no esta cuenta.

## Pregunta de arquitectura que surgió (respondida, sin cambios de código)

El usuario preguntó si podía tener acceso de super_admin sin aparecer
en ningún censo. Respuesta confirmada revisando el código: el acceso
de lectura/administración de super_admin (`mis_congregaciones()`,
la mayoría de RLS) ya funciona en todas las congregaciones sin
necesitar ningún rol local ni ficha de censo. Pero
`puede_administrar_feligresia()` y `puede_gestionar_comite()` sí
exigen un rol `local` real, sin ningún atajo para super_admin -- es a
propósito (un operador de la plataforma no debería editar
directamente los registros pastorales de una iglesia). Conclusión:
no hay forma de tener un rol sin ninguna ficha de censo en ninguna
congregación sin un cambio real de arquitectura (`roles_sistema.
persona_id` y `personas.congregacion_id` son obligatorios) -- no se
hizo ese cambio, se optó por mantener una ficha renombrada en su
lugar.

## Scripts (en `supabase/schema/`, commit `999ed4c`)

`diagnostico_pastor_puerto_tejada.sql`,
`diagnostico_accesos_prueba_puerto_tejada.sql`,
`diagnostico_otros_roles_4_cuentas.sql`,
`limpiar_accesos_prueba_puerto_tejada.sql`,
`renombrar_admin_y_borrar_jhan_sanchez.sql`.
