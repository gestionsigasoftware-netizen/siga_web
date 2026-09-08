# Anular una congregación creada por error — 2026-09-08

## Contexto

Detectado en la ronda de QA del 2026-09-04: no había forma de deshacer
una congregación creada por error desde "Registrar nueva congregación"
(`/pastoral-distrital`). Por diseño, `congregaciones` nunca tuvo
política de DELETE para el cliente (evita borrados accidentales de un
tenant real con datos verdaderos) -- esta pieza **no cambia esa regla**,
resuelve el problema real con un mecanismo mucho más estrecho.

## Diseño

`anular_congregacion()` es el inverso exacto de
`crear_congregacion_con_pastor()`: borra la fila de `congregaciones`,
la `persona` del pastor autocreada, su `roles_sistema`, su fila en
`pastores` y su `asignaciones_pastorales` -- nada más.

Guardas de seguridad (para que esto siga siendo "deshacer una
creación", no un DELETE general):

1. Solo funciona si `estado = 'pendiente_aprobacion'` -- una
   congregación ya aprobada o suspendida no se puede anular así
   (queda, a propósito, para el SQL Editor).
2. Solo funciona si no hay más de 1 persona en esa congregación (el
   pastor autocreado) -- si ya se registró censo real, se rechaza.

Se decidió **no** exigir que el pastor todavía no tenga cuenta
vinculada (`auth_user_id`), porque el flujo real de
`createCongregation()` en `PastoralDistrital.jsx` invita al pastor
inmediatamente después de crear la congregación -- exigir eso habría
bloqueado la anulación casi siempre, justo cuando más se necesita (el
usuario nota el error segundos después de crearla). Un `auth.users`
huérfano de una invitación no confirmada es inofensivo -- no representa
riesgo real, y esta función no puede borrarlo de todas formas (requiere
la API de administración de Auth, no disponible desde SQL de cliente).

## Construido

- `supabase/distrital/anular_congregacion.sql`: función
  `anular_congregacion(p_congregacion_id uuid)`, `security definer`,
  permisos igual que el resto de funciones distritales (distrital de
  ese distrito, nacional o super_admin).
- `src/pages/Aprobaciones.jsx`: nuevo botón "Anular" (ícono papelera)
  junto a Aprobar/Suspender, solo visible para congregaciones
  `pendiente_aprobacion`, con confirmación inline ("¿Anular? No se
  puede deshacer" / "Sí, anular" / "Cancelar") antes de ejecutar.

## Verificación

`npm run build` sin errores. Verificación funcional pendiente de que
el usuario ejecute `supabase/distrital/anular_congregacion.sql` en el
SQL Editor -- una vez ejecutado, se puede probar creando una
congregación de prueba desde Pastoral Distrital y anulándola desde
Aprobaciones, confirmando que desaparece de ambas pantallas y que sus
filas relacionadas (persona, rol, pastor, asignación) también
desaparecen.

**Acción requerida del usuario**: ejecutar
`supabase/distrital/anular_congregacion.sql` en el SQL Editor de
Supabase.
