# Soporte técnico exclusivo de super_admin — 2026-09-11

## Contexto

El usuario preguntó explícitamente si había algo visible para
`nacional` que en realidad correspondiera solo a `super_admin`, dado
que **local/distrital/nacional son roles pastorales manejados por
personas con acceso limitado a lo suyo, mientras que super_admin es
quien administra el negocio SIGAP y debe tener acceso a todo lo de su
propio nivel** -- ver `feedback_super_admin_vs_nacional` en memoria.

## Hallazgo

`src/pages/Soporte.jsx` + `supabase/soporte/reportes_soporte.sql`: el
propio comentario del archivo SQL ya decía "Soporte técnico hacia el
equipo que mantiene SIGAP" -- es la bandeja de reportes técnicos sobre
el software mismo (con aviso a `soportesigasoftware@gmail.com`), no un
PQRS pastoral. Pese a eso, `ADMIN_LEVELS = ['nacional', 'super_admin']`
le daba a `nacional` el mismo acceso que a `super_admin`: ver TODOS
los reportes de cualquier congregación del país y marcarlos resueltos.

Esto es justo el tipo de función que debería ser exclusiva de
`super_admin` -- es el equipo que mantiene SIGAP, no el rol pastoral
cliente. Probablemente quedó así porque, en la práctica actual, la
misma persona opera ambas cuentas -- pero el diseño correcto (y el que
ya usan `suscripciones.sql` y `monitoreo_errores_frontend.sql`) es
`super_admin` en solitario.

Se revisó todo lo demás visible para `nacional`
(Aprobaciones de congregaciones, Solicitudes internas, Comités
Nacional, Gestión pastoral nacional, Distritos, Salud de datos) y es
legítimamente pastoral -- decisiones sobre la estructura/operación de
la IPUC, no del negocio SIGAP. Sin más hallazgos.

## Corregido

- `supabase/soporte/reportes_soporte.sql` (comentario actualizado) +
  `supabase/soporte/fix_reportes_soporte_solo_super_admin.sql` (nuevo,
  el que hay que ejecutar): políticas `reportes_soporte_select`/
  `reportes_soporte_update_admin` ahora solo `es_super_admin()`
  (se quitó `es_nacional()`). Cualquier usuario sigue pudiendo ver y
  enviar SU PROPIO reporte (`usuario_id = auth.uid()`), eso no cambió.
- `src/pages/Soporte.jsx`: `ADMIN_LEVELS = ['super_admin']` (antes
  incluía `'nacional'`), y el texto "Visible solo para
  nacional/super_admin" corregido a "Visible solo para super_admin".

## Verificación

- `npm run build` sin errores.
- Playwright con la cuenta real `pueba691@gmail.com` (rol local): la
  sección "Todos los reportes" ya no aparece, pero el formulario
  "Reportar un problema" (autoservicio) sigue funcionando igual.

## Pendiente de ejecutar por el usuario

`supabase/soporte/fix_reportes_soporte_solo_super_admin.sql`.
