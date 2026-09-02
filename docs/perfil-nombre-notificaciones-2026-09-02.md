# Nombre de cuenta, link de notificación y tarjetas reales en Preferencias (2026-09-02)

## Contexto

Al probar el flujo completo de invitación (con SMTP y plantillas ya
funcionando), el usuario encontró dos problemas reales al registrarse con
un usuario de prueba: (1) el botón "Ver detalle" de la notificación de
bienvenida llevaba a Preferencias personales en vez de mostrar el detalle
del nuevo acceso, y (2) su nombre real no aparecía en ningún lado — se
veía "Usuario SIGAP" en su lugar. De paso, pidió revisar si las tarjetas
de estado de Preferencias personales tenían contenido real o eran solo
texto decorativo.

## 1. Link de notificación corregido

`notificar_asignacion_acceso()` (`supabase/notificaciones.sql`) creaba la
notificación "Nuevo perfil de acceso" con `enlace = '/configuracion-sistema'`
— la página de preferencias personales, que no tiene relación con el
acceso recién asignado. Se cambió a `/perfil`, donde sí existe la sección
"Permisos asignados" con el rol y la congregación reales.

- **Acción del usuario**: volver a ejecutar `supabase/notificaciones.sql`
  (es `create or replace function`, no requiere `drop` antes).
- Para la notificación que ya quedó guardada con el link viejo:
  `supabase/fix_enlace_notificaciones_acceso.sql` (ejecutar una sola vez).

## 2. Nombre genérico — causa raíz y arreglo

La función `invitar-usuario` (Edge Function) ya tenía el nombre real de la
persona disponible (`personas.nombres`, `personas.apellidos`, porque la
invitación siempre parte de seleccionar una persona ya existente en el
censo) pero nunca se lo pasaba a Supabase al crear la cuenta de
autenticación — por eso `user_metadata.full_name` quedaba vacío y la app
caía en el texto genérico "Usuario SIGAP".

- **`supabase/functions/invitar-usuario/index.ts`**: ahora selecciona
  `nombres, apellidos` de la persona y se los pasa como
  `data: { full_name }` a `inviteUserByEmail()`. Esto arregla todas las
  invitaciones **futuras** automáticamente.
- **Acción del usuario**: redesplegar la función —
  `supabase functions deploy invitar-usuario` (mismo comando de siempre,
  documentado en `docs/despliegue-operacion.md`).
- **`src/pages/Perfil.jsx`**: se agregó un campo "Nombre de la cuenta"
  editable (usa el nuevo `updateProfile()` de `useAuth.js`, que llama
  `supabase.auth.updateUser({ data: { full_name } })`) — corrige el caso
  actual y cualquier cuenta que en el futuro necesite ajustar su nombre
  manualmente. Además, mientras no haya un nombre guardado en Auth, el
  encabezado ya no muestra el texto genérico primero: usa el nombre real
  del censo (`personas.nombres/apellidos`, vía el rol vinculado) como
  siguiente opción antes de caer en "Usuario SIGAP".

## 3. Tarjetas de "Estado del sistema" en Preferencias personales

Se revisaron las 4 tarjetas de `ConfiguracionSistema.jsx`:

- **"Idioma y región"** y **"Notificaciones"**: ya reflejaban datos reales
  (el formato de fecha y las preferencias elegidas arriba mismo) — se
  dejaron igual.
- **"Seguridad"** y la que decía **"Información actualizada"**: tenían
  texto fijo ("Política activa", "Estado verificado") sin ningún dato
  real detrás. Se reemplazaron por:
  - **Seguridad**: último acceso (`user.last_sign_in_at`) y si el correo
    está verificado (`user.email_confirmed_at`) — datos ya disponibles en
    la sesión de Supabase Auth, sin consultas nuevas.
  - **Vinculación al censo** (antes "Información actualizada"): si la
    cuenta está conectada a una persona real del censo o no, y desde
    cuándo existe la cuenta. Esta es justo la señal que habría hecho
    evidente el problema del nombre genérico si hubiera existido antes.

## Acción requerida del usuario

1. Ejecutar `supabase/notificaciones.sql` de nuevo.
2. Ejecutar `supabase/fix_enlace_notificaciones_acceso.sql` (una sola vez).
3. `supabase functions deploy invitar-usuario`.
