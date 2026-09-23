# El estado de la congregación ahora sí bloquea el uso real -- 2026-09-23

## Contexto

El usuario, revisando el flujo de alta de una congregación nueva,
preguntó si una congregación creada por un distrital podía usar SIGAP
libremente incluso sin aprobación ni pago. Investigación (sin tocar
código todavía) confirmó que sí:

- `congregaciones.estado` (`pendiente_aprobacion`/`activa`/
  `suspendida`) **no bloqueaba nada técnicamente**. `crear_congregacion_con_pastor()`
  siembra los módulos operativos y envía la invitación por correo **de
  inmediato**, antes de cualquier aprobación. Ni `mis_congregaciones()`
  (la función detrás de casi todas las políticas RLS operativas) ni
  ninguna pantalla revisaban `estado`. El propio texto de
  `Aprobaciones.jsx` ("Una congregación registrada no puede usar el
  sistema hasta ser aprobada aquí") no era cierto en la práctica.

Ver también `docs/fixes/aviso-super-admin-congregacion-activa-2026-09-23.md`
(la segunda mitad del mismo pedido: que super_admin se entere y arranque
un periodo de prueba de cobro real).

## Corrección

**Diseño clave** (evita un problema real que se encontró al investigar):
no se modificó `mis_congregaciones()` a lo bruto, porque eso le habría
quitado al propio pastor la visibilidad de su propia congregación
(nombre, estado) -- rompiendo el sidebar y cualquier pantalla que
necesite mostrarle "tu congregación está pendiente". Por eso, primero
se agregó una política nueva y aditiva, y solo después se restringió
`mis_congregaciones()`:

1. **Política nueva** `congregaciones_select_propia_pendiente`: un
   pastor SIEMPRE ve la fila de su propia congregación sin importar el
   estado.
2. **`mis_congregaciones()` modificada** (un solo punto de cambio,
   arregla automáticamente las ~30 tablas operativas que ya dependen
   de ella -- personas, familias, comités, registros de actividad,
   todos los módulos de ministerio): la rama local ahora exige
   `estado = 'activa'`. Las ramas de distrital/nacional/super_admin
   quedan intactas -- siguen viendo congregaciones pendientes en
   Aprobaciones y en los dashboards, como deben.

Archivos: `supabase/schema/fix_bloqueo_congregacion_pendiente.sql`
(nuevo, para ejecutar en producción) y `supabase/schema/schema.sql`
actualizado como fuente de verdad para instalaciones nuevas.

**Frontend**:
- `src/lib/supabase.js`, `getMisRoles()`: se agregó `estado` al
  `select` embebido de `congregaciones(...)` (antes no se traía, así
  que el frontend no podía saber si estaba pendiente/suspendida).
- `src/components/layout/MainLayout.jsx`: se extendió el mismo patrón
  que ya existía para el bloqueo por impago (`bloqueado`,
  `RUTAS_PERMITIDAS_BLOQUEADO`) con una segunda condición,
  `bloqueadoPorEstado`, que muestra un mensaje claro ("Congregación
  pendiente de aprobación" / "Congregación suspendida") en vez de
  romper la pantalla o dejar pasar el acceso. `/perfil` y `/soporte`
  siguen siendo alcanzables mientras está bloqueado, igual que en el
  caso de impago.

## Verificación

- `npm run build` sin errores.
- Confirmado en vivo contra producción real (cuenta
  `pueba691@gmail.com`, Puerto Tejada, ya `activa`): la nueva consulta
  con `estado` funciona, devuelve `"estado": "activa"`, y el acceso a
  `personas` (vía RLS/`mis_congregaciones()`) sigue funcionando con
  normalidad -- **no se rompe nada para las congregaciones que ya
  están activas hoy**, que es el caso más común y el más importante de
  no dañar.
- **No se pudo probar el bloqueo en sí** (no hay cuenta de prueba con
  rol distrital para crear una congregación de prueba y verla como
  pastor pendiente). Pendiente de que el usuario lo confirme una vez
  aplicado el SQL: crear una congregación real desde un distrital,
  confirmar que el pastor ve la pantalla de bloqueo antes de ser
  aprobada, y que el acceso normal aparece justo después de aprobarla.
- **Falta ejecutar `supabase/schema/fix_bloqueo_congregacion_pendiente.sql`
  en el SQL Editor de Supabase (producción real)** -- sin esto, el
  frontend ya muestra el banner correctamente pero la RLS de fondo
  sigue sin bloquear nada (el mismo patrón de "defensa en profundidad"
  ya usado hoy: sin el SQL, alguien con DevTools todavía podría saltarse
  el banner llamando la API directo).
