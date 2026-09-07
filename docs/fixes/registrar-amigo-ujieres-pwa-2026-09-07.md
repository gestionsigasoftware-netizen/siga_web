# Habilitar "Registrar amigo nuevo" desde la PWA para Ujieres (intramural) — 2026-09-07

## Contexto

Cambio en el proyecto PWA hermano `siga-pwa-nacional`
(`C:\Users\T460s\Desktop\SIGA\siga movil\siga-pwa-nacional`, mismo
backend Supabase), a raíz de una discusión de arquitectura con el
usuario sobre cómo capturar una conversión que ocurre en un **culto
normal** (intramural) -- distinto de la conversión extramural (visita
de campo de Evangelismo/Misión Juvenil), que ya tenía esta captura
desde el 2026-09-04.

La pantalla "Registrar amigo nuevo" (`CapturaAmigo.jsx` en la PWA) ya
existía y ya escribe directo en la tabla `amigos` (la misma que
alimenta "Amigos en ruta" en la web), pero solo estaba habilitada para
módulos con `requiere_zona = true` (Evangelismo, Misión Juvenil).
Ujieres -- el comité que recibe y ubica a las personas en el salón de
predicación durante cualquier culto, y por eso ya captura la
asistencia general -- no maneja zonas (no administra territorio), así
que quedaba fuera.

El usuario aclaró un punto clave: **Ujieres no administra personas**,
solo recibe/ubica y toma asistencia -- así que cuando alguien se
convierte en el culto, Ujieres puede capturar el hecho (nombre de la
persona), pero normalmente NO sabrá a qué comité (Jóvenes, Damas
Dorcas, etc.) le corresponderá el seguimiento real. Por eso el comité
de origen debe quedar como **opcional** en este flujo -- si no se sabe
en el momento, el pastor lo asigna después desde `Amigos.jsx` en la
web (mismo campo `comite_origen_id` construido hoy mismo en la pieza
anterior).

## Hallazgo antes de construir (dos bloqueos reales de RLS)

1. **`amigos_write`** exige `tengo_acceso_zona(zona_id)` (o ser pastor
   vía `roles_sistema`) -- con `zona_id = null` (el caso de Ujieres),
   `tengo_acceso_zona(null)` siempre es falso, así que un ujier normal
   (sin ser también pastor) no podría insertar en `amigos` aunque la
   pantalla se lo permitiera.
2. **`comites_read`** solo permite leer comités a quien tiene un rol
   en `roles_sistema` (pastor local/distrital/nacional) -- un cargo
   normal (ujier, evangelista de campo) no podría cargar el selector
   de comité de origen.

Ambos bloqueos afectan a cualquier cargo (no solo Ujieres), porque
ninguno de esos roles opera vía `roles_sistema`.

## Construido

**`supabase/modulos/tengo_cargo_activo_rls.sql`** (nuevo):
- Función `tengo_cargo_activo_congregacion(p_congregacion_id)` --
  existe una fila activa en `asignaciones_cargo` (de cualquier cargo,
  cualquier módulo) para esa congregación. **Nombre elegido
  deliberadamente distinto** de `tengo_cargo_activo(p_modulo_id)`, que
  ya existía en `supabase/pwa/rls_cargo_pwa.sql` con un propósito
  distinto (chequeo por módulo, no por congregación) -- error real de
  colisión de nombres detectado al ejecutar la primera versión de esta
  migración (`42P13: cannot change name of input parameter`),
  corregido antes de la segunda ejecución.
- Política nueva `amigos_insert_cargo` (**solo INSERT**, no toca las
  políticas existentes `amigos_select`/`amigos_write`) -- permite
  registrar un amigo nuevo a cualquiera con cargo activo en esa
  congregación, sin ampliar su acceso de lectura/edición sobre amigos
  de otras zonas.
- Política nueva `comites_read_cargo` (**solo SELECT**, no toca
  `comites_read`/`comites_write`) -- mismo criterio, solo para leer
  nombres de comités.

## PWA (`siga-pwa-nacional`)

- `Home.jsx`: `permiteAmigos` ahora también es verdadero cuando el
  módulo es Ujieres (`esModuloUjieres`, ya existente en
  `lib/modulos.js`), no solo cuando `requiere_zona`.
- `CapturaAmigo.jsx`: el bloqueo "tu cargo no tiene zona asignada"
  ahora solo aplica cuando el módulo `requiere_zona` -- Ujieres puede
  entrar sin zona. Nuevo selector opcional "Comité que lo recibió"
  (usa la nueva función `getComites(congregacionId)` en
  `lib/supabase.js`).
- `registrarAmigo()`: acepta y guarda `comiteOrigenId` (columna
  `comite_origen_id`, la misma que se agregó hoy en la web).

## Verificación

Contra la base de datos real (congregación Puerto Tejada Cauca
Central), con el usuario de prueba `pueba691@gmail.com`:

1. La función `tengo_cargo_activo_congregacion` ejecuta sin error vía
   RPC.
2. Al crear una asignación de cargo activa (módulo Ujieres, sin zona)
   para esa congregación, la función pasa de `false` a `true`
   correctamente.
3. `npm run build` de la PWA sin errores.

**Limitación de esta verificación**: no se pudo probar de extremo a
extremo con una cuenta que SOLO tenga cargo (sin rol de pastor), ya
que el entorno no tiene una clave de servicio (`service_role`) para
crear una segunda identidad de prueba real -- la cuenta de prueba
disponible ya es pastor local, así que insertar/leer siempre le
funciona vía las políticas existentes, sin importar si la nueva
política aporta algo. Recomendado: probar con una cuenta real de un
ujier (solo cargo, sin rol de pastor) en la PWA cuando esté
disponible.

## Pendiente

- Ojo con residuos de prueba: un primer intento de verificación dejó
  un `cargo`/`asignación` temporal ("QA Ujier Temporal") sin limpiar
  por un error en el script de prueba (no relacionado con el cambio en
  sí) -- ya se limpió en un paso posterior, confirmado sin residuos.
- Confirmar con una cuenta real de ujier que el flujo completo
  funciona en producción.
