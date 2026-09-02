# Un solo nombre real: cuenta y censo no deben divergir (2026-09-02)

## Contexto

Después de agregar un campo editable de nombre en Mi perfil (guardado en
los metadatos de Auth), el usuario detectó que ese nombre no se reflejaba
en el encabezado junto a Notificaciones — porque esa parte sigue leyendo
el nombre real del censo (`personas.nombres/apellidos`). Al preguntarle,
aclaró la política correcta: debe existir **un solo nombre real** para
cada persona. El campo de Mi perfil existe para corregir ese nombre si
quedó mal escrito o vacío al registrarse — no para crear un nombre de
cuenta distinto al del censo.

## Diseño final

- **Si la cuenta está vinculada a una persona del censo** (el caso normal
  de cualquier usuario local invitado desde Equipo de trabajo): el campo
  "Nombre" en Mi perfil edita directamente `personas.nombres/apellidos`
  a través de la nueva función `actualizar_mi_nombre(p_nombres,
  p_apellidos)` — nunca se guarda un nombre paralelo en Auth. La función
  solo puede tocar la fila vinculada a la propia cuenta
  (`auth_user_id = auth.uid()`), nunca la de otra persona.
- **Si la cuenta no tiene ninguna persona vinculada** (nacional o
  distrital puros, sin registro de censo): no hay ningún nombre "real"
  que corregir, así que en ese caso sí se guarda en los metadatos de Auth
  (`user_metadata.nombres/apellidos`).
- El encabezado (`MainLayout.jsx`) y Mi perfil (`Perfil.jsx`) usan
  exactamente la misma prioridad: censo primero si existe persona
  vinculada, metadatos de Auth como único respaldo si no.
- Al guardar un nombre vinculado al censo, la página se recarga sola —
  el rol/persona vinculada se cachea en `useMiRol()` y no había una forma
  ligera de invalidar ese caché sin tocar su arquitectura, así que se
  optó por la recarga completa en vez de dejar datos desactualizados en
  pantalla.

## Acción requerida del usuario

Ejecutar `supabase/actualizar_mi_nombre.sql` en el SQL Editor.
