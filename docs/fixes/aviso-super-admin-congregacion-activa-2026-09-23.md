# Aviso a super_admin + periodo de prueba real al activar una congregación -- 2026-09-23

## Contexto

Segunda mitad del pedido del usuario (ver
`docs/fixes/bloqueo-congregacion-pendiente-2026-09-23.md` para la
primera): el cobro es 100% opt-in manual -- una congregación sin fila
en `suscripciones` nunca se bloquea (diseño intencional, documentado
en `supabase/modulos/suscripciones.sql`), pero **nada le avisaba a
super_admin que una congregación nueva existía**. Si super_admin no
entraba por su cuenta a revisar Aprobaciones o Suscripciones, esa
congregación podía usar SIGAP gratis indefinidamente sin que el
negocio se enterara -- exactamente el riesgo de "fraude"/uso gratuito
que el usuario quería cerrar.

## Diagnóstico

No existía ningún mecanismo para notificar a un ROL completo (solo a
una persona puntual, vía `crear_notificacion_usuario`) ni ningún
trigger en el `INSERT` de `congregaciones` -- solo uno en el `UPDATE de
estado` (`congregaciones_notificacion_estado`, en
`supabase/modulos/notificaciones.sql`), que avisaba a la propia
congregación cuando cambiaba de estado, nunca a super_admin.

## Corrección

Se extendió ese mismo trigger existente (`notificar_cambio_congregacion()`,
mismo nombre de función -- el trigger ya apuntaba ahí, no hizo falta
recrearlo) para que, cuando una congregación pasa a `'activa'`:

1. **Si no tiene fila en `suscripciones` todavía**, le crea una con
   **15 días de periodo de prueba** (`plan: 'mensual'`,
   `fecha_proximo_pago: hoy + 15 días`, `dias_gracia` en su default de
   5). Esto reutiliza el mecanismo de bloqueo por impago que ya existe
   y ya funciona (`calcularEstadoSuscripcion`, el banner "en_gracia" y
   el bloqueo en `MainLayout.jsx`) -- sin inventar nada nuevo del lado
   de UI, solo garantiza que TODA congregación activa arranca con un
   reloj de cobro real en vez de quedar "sin configurar" para siempre.
   `on conflict (congregacion_id) do nothing`, así que reactivar una
   congregación que ya tenía suscripción (ej. después de una
   suspensión) no le reinicia ni le duplica el plan.
2. **Avisa a todos los super_admin** (nuevo helper
   `notificar_super_admin()`, mismo patrón que la función existente
   pero recorre `roles_sistema` filtrando por `nivel = 'super_admin'`
   en vez de las personas de una congregación puntual) con un mensaje
   con el nombre y distrito de la congregación, y enlace directo a
   `/suscripciones`.

Los 15 días son un número de partida razonable (tiempo para que
super_admin y el distrito cierren el pago real por WhatsApp) pero es
fácil de ajustar -- es un literal en el SQL, no requiere cambiar nada
más del diseño.

Archivos: `supabase/modulos/fix_aviso_super_admin_congregacion_activa.sql`
(nuevo, autocontenido) y `supabase/modulos/notificaciones.sql`
actualizado como fuente de verdad para instalaciones nuevas.

## Verificación

- `npm run build` sin errores (cambio puramente de SQL, sin tocar
  frontend en esta pieza).
- **No se pudo probar en vivo** (crear una congregación real desde un
  distrital y confirmar que super_admin recibe la notificación y que
  aparece la suscripción de prueba) -- no hay cuenta de prueba con rol
  distrital ni super_admin. Pendiente de que el usuario lo confirme
  una vez aplicado el SQL.
- **Falta ejecutar `supabase/modulos/fix_aviso_super_admin_congregacion_activa.sql`
  en el SQL Editor de Supabase (producción real)**, después de
  `fix_bloqueo_congregacion_pendiente.sql`.
