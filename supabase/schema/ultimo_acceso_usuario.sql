-- Guarda la fecha/hora de acceso de cada usuario, en dos columnas:
--
-- - ultimo_acceso: el login que ACABA de ocurrir (se sobrescribe en
--   cada inicio de sesión, apenas ocurre).
-- - acceso_anterior: el valor que tenía ultimo_acceso justo ANTES de
--   sobrescribirlo -- es decir, el login de la vez anterior. Esta es
--   la columna que se le muestra al usuario ("tu último acceso fue
--   el...").
--
-- Por qué dos columnas y no una sola: Supabase actualiza
-- auth.users.last_sign_in_at en el momento del login que acaba de
-- ocurrir, así que ese campo nunca sirve para mostrar "tu último
-- acceso" -- muestra la hora en la que la persona acaba de entrar, no
-- la vez anterior. Guardar un solo valor en preferencias_usuario tiene
-- el mismo problema si se lee más tarde en la misma sesión (por
-- ejemplo, al visitar Configuración media hora después de entrar): ya
-- se sobrescribió con el login actual. Con dos columnas,
-- acceso_anterior queda "congelado" con el valor correcto durante
-- toda la sesión, sin importar cuándo se consulte.
--
-- El flujo de login (src/hooks/useAuth.js: registrarAcceso) lee
-- ultimo_acceso antes de tocarlo, y en la misma escritura mueve ese
-- valor a acceso_anterior y pone la hora de ahora en ultimo_acceso.
alter table preferencias_usuario add column if not exists ultimo_acceso timestamptz;
alter table preferencias_usuario add column if not exists acceso_anterior timestamptz;

comment on column preferencias_usuario.ultimo_acceso is 'Fecha/hora del login que acaba de ocurrir. Se sobrescribe en cada inicio de sesión (ver useAuth.js: registrarAcceso). No usar para mostrarle al usuario "tu último acceso" -- usar acceso_anterior.';
comment on column preferencias_usuario.acceso_anterior is 'Fecha/hora del login ANTERIOR al actual -- lo que se le muestra al usuario como "tu último acceso fue...". Queda fijo durante toda la sesión (ver useAuth.js: registrarAcceso).';
